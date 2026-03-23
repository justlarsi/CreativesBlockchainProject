from datetime import datetime, timezone as dt_timezone
from typing import Any

from django.conf import settings
from django.utils import timezone

from eth_abi import encode
from eth_utils import keccak

from apps.works.models import ContentHash
from apps.works.services_blockchain import rpc_call_with_failover

from .models import Collaboration, CollaborationMember


class CollaborationPreparationError(Exception):
    pass


class CollaborationVerificationError(Exception):
    pass


class ReceiptPendingError(CollaborationVerificationError):
    pass


def _normalize(value: str) -> str:
    return (value or '').strip()


def _contract_address() -> str:
    address = _normalize(getattr(settings, 'CONTRACT_COLLABORATIVE_WORK_ADDRESS', ''))
    if not address:
        raise CollaborationPreparationError('CollaborativeWork contract address is not configured.')
    if not address.startswith('0x') or len(address) != 42:
        raise CollaborationPreparationError('CollaborativeWork contract address is invalid.')
    return address


def _selector() -> str:
    return keccak(text='createCollaboration(string,address[],uint16[])')[:4].hex()


def _sha256_hash_for_work(collaboration: Collaboration) -> str:
    value = (
        collaboration.work.content_hashes.filter(hash_type=ContentHash.HashType.SHA256)
        .values_list('hash_value', flat=True)
        .first()
    )
    if not value:
        raise CollaborationPreparationError('SHA-256 hash is not available for this work.')
    return value


def _members_for_payload(collaboration: Collaboration) -> tuple[list[str], list[int]]:
    members = list(collaboration.members.order_by('id'))
    if not members:
        raise CollaborationPreparationError('Collaboration has no members.')
    wallets = [m.wallet_address for m in members]
    splits = [int(m.split_bps) for m in members]
    return wallets, splits


def encode_create_collaboration_calldata(content_hash: str, wallets: list[str], splits: list[int]) -> str:
    encoded_args = encode(['string', 'address[]', 'uint16[]'], [content_hash, wallets, splits]).hex()
    return f'0x{_selector()}{encoded_args}'


def prepare_collaboration_payload(collaboration: Collaboration) -> dict[str, str]:
    if collaboration.status not in {Collaboration.Status.APPROVED, Collaboration.Status.BLOCKCHAIN_REGISTRATION_FAILED}:
        raise CollaborationPreparationError('Collaboration is not ready for blockchain registration.')

    content_hash = _sha256_hash_for_work(collaboration)
    wallets, splits = _members_for_payload(collaboration)
    return {
        'to': _contract_address(),
        'data': encode_create_collaboration_calldata(content_hash, wallets, splits),
    }


def _parse_hex_int(value: str | None) -> int | None:
    if not value:
        return None
    return int(value, 16)


def tx_explorer_url(tx_hash: str) -> str:
    base = _normalize(getattr(settings, 'POLYGON_AMOY_EXPLORER_TX_BASE_URL', 'https://amoy.polygonscan.com/tx/'))
    return f"{base.rstrip('/')}/{tx_hash}"


def _confirm_transaction_matches_expected(collaboration: Collaboration, tx_payload: dict[str, Any]) -> None:
    content_hash = _sha256_hash_for_work(collaboration)
    wallets, splits = _members_for_payload(collaboration)
    expected_data = encode_create_collaboration_calldata(content_hash, wallets, splits).lower()

    tx_to = (tx_payload.get('to') or '').lower()
    tx_data = (tx_payload.get('input') or '').lower()

    if tx_to != _contract_address().lower():
        raise CollaborationVerificationError('Transaction target contract does not match CollaborativeWork address.')
    if tx_data != expected_data:
        raise CollaborationVerificationError('Transaction call data does not match expected collaboration payload.')


def _block_timestamp(block_number_hex: str | None) -> datetime | None:
    if not block_number_hex:
        return None

    block_result = rpc_call_with_failover('eth_getBlockByNumber', [block_number_hex, False]).payload
    block = block_result.get('result') or {}
    timestamp_hex = block.get('timestamp')
    if not timestamp_hex:
        return None
    return datetime.fromtimestamp(int(timestamp_hex, 16), tz=dt_timezone.utc)


def verify_collaboration_receipt(collaboration: Collaboration, tx_hash: str) -> dict[str, Any]:
    tx_result = rpc_call_with_failover('eth_getTransactionByHash', [tx_hash]).payload
    tx_payload = tx_result.get('result')
    if not tx_payload:
        raise ReceiptPendingError('Transaction not yet available on RPC endpoint.')

    _confirm_transaction_matches_expected(collaboration, tx_payload)

    receipt_result = rpc_call_with_failover('eth_getTransactionReceipt', [tx_hash]).payload
    receipt = receipt_result.get('result')
    if not receipt:
        raise ReceiptPendingError('Transaction receipt not yet available.')

    tx_status = _parse_hex_int(receipt.get('status'))
    if tx_status != 1:
        raise CollaborationVerificationError('Collaboration transaction failed on-chain.')

    block_number = _parse_hex_int(receipt.get('blockNumber'))
    registered_at = _block_timestamp(receipt.get('blockNumber')) or timezone.now()

    return {
        'tx_hash': tx_hash,
        'block_number': block_number,
        'registered_at': registered_at,
        'explorer_url': tx_explorer_url(tx_hash),
    }


def set_registration_pending(collaboration: Collaboration, tx_hash: str) -> None:
    collaboration.status = Collaboration.Status.BLOCKCHAIN_REGISTRATION_PENDING
    collaboration.blockchain_tx_hash = tx_hash
    collaboration.blockchain_block_number = None
    collaboration.blockchain_registered_at = None
    collaboration.blockchain_error_message = ''
    collaboration.save(
        update_fields=[
            'status',
            'blockchain_tx_hash',
            'blockchain_block_number',
            'blockchain_registered_at',
            'blockchain_error_message',
            'updated_at',
        ]
    )


def mark_registration_confirmed(collaboration: Collaboration, verification: dict[str, Any]) -> None:
    collaboration.status = Collaboration.Status.REGISTERED
    collaboration.blockchain_tx_hash = verification['tx_hash']
    collaboration.blockchain_block_number = verification['block_number']
    collaboration.blockchain_registered_at = verification['registered_at']
    collaboration.blockchain_error_message = ''
    collaboration.save(
        update_fields=[
            'status',
            'blockchain_tx_hash',
            'blockchain_block_number',
            'blockchain_registered_at',
            'blockchain_error_message',
            'updated_at',
        ]
    )


def mark_registration_failed(collaboration: Collaboration, message: str) -> None:
    collaboration.status = Collaboration.Status.BLOCKCHAIN_REGISTRATION_FAILED
    collaboration.blockchain_error_message = message
    collaboration.save(update_fields=['status', 'blockchain_error_message', 'updated_at'])

