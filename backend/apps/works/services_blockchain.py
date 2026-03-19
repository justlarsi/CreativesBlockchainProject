import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from eth_abi import encode
from eth_utils import keccak

from .models import ContentHash, CreativeWork


class BlockchainPreparationError(Exception):
    pass


class BlockchainRPCError(Exception):
    pass


class BlockchainVerificationError(Exception):
    pass


class ReceiptPendingError(BlockchainVerificationError):
    pass


@dataclass
class RpcResult:
    payload: dict[str, Any]
    rpc_url: str


def _normalize_url(value: str) -> str:
    return (value or '').strip()


def _rpc_urls() -> list[str]:
    primary = _normalize_url(getattr(settings, 'POLYGON_AMOY_RPC_URL', ''))
    fallback = _normalize_url(getattr(settings, 'POLYGON_AMOY_RPC_FALLBACK_URL', ''))
    urls = []
    if primary:
        urls.append(primary)
    if fallback and fallback != primary:
        urls.append(fallback)
    return urls


def _rpc_timeout_seconds() -> float:
    return float(getattr(settings, 'BLOCKCHAIN_RPC_REQUEST_TIMEOUT_SEC', 10.0))


def _rpc_max_retries() -> int:
    return max(1, int(getattr(settings, 'BLOCKCHAIN_RPC_MAX_RETRIES', 2)))


def _rpc_backoff_seconds() -> float:
    return max(0.0, float(getattr(settings, 'BLOCKCHAIN_RPC_RETRY_BASE_SECONDS', 0.5)))


def _eth_rpc_call(rpc_url: str, method: str, params: list[Any]) -> dict[str, Any]:
    payload = {
        'jsonrpc': '2.0',
        'method': method,
        'params': params,
        'id': str(uuid.uuid4()),
    }
    request = Request(
        rpc_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    try:
        with urlopen(request, timeout=_rpc_timeout_seconds()) as response:
            raw = response.read().decode('utf-8')
    except (URLError, HTTPError, TimeoutError) as exc:
        raise BlockchainRPCError(f'RPC transport failed for {method}: {exc}') from exc

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise BlockchainRPCError(f'RPC returned invalid JSON for {method}') from exc

    if parsed.get('error'):
        raise BlockchainRPCError(f'RPC error for {method}: {parsed["error"]}')

    if 'result' not in parsed:
        raise BlockchainRPCError(f'RPC response missing result for {method}')

    return parsed


def rpc_call_with_failover(method: str, params: list[Any]) -> RpcResult:
    urls = _rpc_urls()
    if not urls:
        raise BlockchainRPCError('No blockchain RPC URLs configured.')

    last_error: Exception | None = None
    for attempt in range(_rpc_max_retries()):
        for rpc_url in urls:
            try:
                return RpcResult(payload=_eth_rpc_call(rpc_url, method, params), rpc_url=rpc_url)
            except BlockchainRPCError as exc:
                last_error = exc

        if attempt < _rpc_max_retries() - 1 and _rpc_backoff_seconds() > 0:
            time.sleep(_rpc_backoff_seconds() * (2 ** attempt))

    raise BlockchainRPCError(str(last_error) if last_error else f'RPC call failed: {method}')


def _register_work_selector() -> str:
    return keccak(text='registerWork(string)')[:4].hex()


def encode_register_work_calldata(content_hash: str) -> str:
    encoded_args = encode(['string'], [content_hash]).hex()
    return f'0x{_register_work_selector()}{encoded_args}'


def _contract_address() -> str:
    contract_address = _normalize_url(getattr(settings, 'CONTRACT_IP_REGISTRY_ADDRESS', ''))
    if not contract_address:
        raise BlockchainPreparationError('IPRegistry contract address is not configured.')
    if not contract_address.startswith('0x') or len(contract_address) != 42:
        raise BlockchainPreparationError('IPRegistry contract address is invalid.')
    return contract_address


def _sha256_hash_for_work(work: CreativeWork) -> str:
    content_hash = (
        work.content_hashes.filter(hash_type=ContentHash.HashType.SHA256)
        .values_list('hash_value', flat=True)
        .first()
    )
    if not content_hash:
        raise BlockchainPreparationError('SHA-256 hash is not available for this work.')
    return content_hash


def prepare_registration_payload(work: CreativeWork) -> dict[str, str]:
    eligible = {
        CreativeWork.Status.IPFS_PINNING_COMPLETE,
        CreativeWork.Status.BLOCKCHAIN_REGISTRATION_FAILED,
    }
    if work.status not in eligible:
        raise BlockchainPreparationError('Work is not ready for blockchain registration.')

    content_hash = _sha256_hash_for_work(work)
    return {
        'to': _contract_address(),
        'data': encode_register_work_calldata(content_hash),
    }


def _parse_hex_int(value: str | None) -> int | None:
    if not value:
        return None
    return int(value, 16)


def _tx_explorer_url(tx_hash: str) -> str:
    base = _normalize_url(
        getattr(settings, 'POLYGON_AMOY_EXPLORER_TX_BASE_URL', 'https://amoy.polygonscan.com/tx/')
    )
    return f"{base.rstrip('/')}/{tx_hash}"


def _mark_work_failed(work: CreativeWork, message: str) -> None:
    work.status = CreativeWork.Status.BLOCKCHAIN_REGISTRATION_FAILED
    work.blockchain_error_message = message
    work.save(update_fields=['status', 'blockchain_error_message', 'updated_at'])


def _confirm_transaction_matches_expected(work: CreativeWork, tx_payload: dict[str, Any]) -> None:
    expected_data = encode_register_work_calldata(_sha256_hash_for_work(work)).lower()
    tx_to = (tx_payload.get('to') or '').lower()
    tx_data = (tx_payload.get('input') or '').lower()

    if tx_to != _contract_address().lower():
        raise BlockchainVerificationError('Transaction target contract does not match IPRegistry address.')
    if tx_data != expected_data:
        raise BlockchainVerificationError('Transaction call data does not match expected content hash.')


def _block_timestamp(block_number_hex: str | None) -> datetime | None:
    if not block_number_hex:
        return None
    block_result = rpc_call_with_failover('eth_getBlockByNumber', [block_number_hex, False]).payload
    block = block_result.get('result') or {}
    timestamp_hex = block.get('timestamp')
    if not timestamp_hex:
        return None
    return datetime.fromtimestamp(int(timestamp_hex, 16), tz=dt_timezone.utc)


def verify_registration_receipt(work: CreativeWork, tx_hash: str) -> dict[str, Any]:
    tx_result = rpc_call_with_failover('eth_getTransactionByHash', [tx_hash]).payload
    tx_payload = tx_result.get('result')
    if not tx_payload:
        raise ReceiptPendingError('Transaction not yet available on RPC endpoint.')

    _confirm_transaction_matches_expected(work, tx_payload)

    receipt_result = rpc_call_with_failover('eth_getTransactionReceipt', [tx_hash]).payload
    receipt = receipt_result.get('result')
    if not receipt:
        raise ReceiptPendingError('Transaction receipt not yet available.')

    tx_status = _parse_hex_int(receipt.get('status'))
    if tx_status != 1:
        raise BlockchainVerificationError('Blockchain transaction failed on-chain.')

    block_number = _parse_hex_int(receipt.get('blockNumber'))
    registered_at = _block_timestamp(receipt.get('blockNumber')) or timezone.now()

    return {
        'tx_hash': tx_hash,
        'block_number': block_number,
        'registration_timestamp': registered_at,
        'explorer_url': _tx_explorer_url(tx_hash),
    }


def set_registration_pending(work: CreativeWork, tx_hash: str) -> None:
    work.status = CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING
    work.blockchain_tx_hash = tx_hash
    work.blockchain_block_number = None
    work.blockchain_registration_timestamp = None
    work.blockchain_error_message = ''
    work.save(
        update_fields=[
            'status',
            'blockchain_tx_hash',
            'blockchain_block_number',
            'blockchain_registration_timestamp',
            'blockchain_error_message',
            'updated_at',
        ]
    )


def mark_registration_confirmed(work: CreativeWork, verification: dict[str, Any]) -> None:
    work.status = CreativeWork.Status.REGISTERED
    work.blockchain_tx_hash = verification['tx_hash']
    work.blockchain_block_number = verification['block_number']
    work.blockchain_registration_timestamp = verification['registration_timestamp']
    work.blockchain_error_message = ''
    work.save(
        update_fields=[
            'status',
            'blockchain_tx_hash',
            'blockchain_block_number',
            'blockchain_registration_timestamp',
            'blockchain_error_message',
            'updated_at',
        ]
    )


def mark_registration_failed(work: CreativeWork, message: str) -> None:
    _mark_work_failed(work, message)


def tx_explorer_url(tx_hash: str) -> str:
    return _tx_explorer_url(tx_hash)

