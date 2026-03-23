from datetime import datetime, timezone as dt_timezone
from typing import Any

from django.conf import settings
from django.utils import timezone

from eth_abi import encode
from eth_utils import keccak

from apps.marketplace.models import MarketplaceListing
from apps.works.models import ContentHash, CreativeWork

from .models import LicensePurchase


class LicensePreparationError(Exception):
	pass


class LicenseVerificationError(Exception):
	pass


class ReceiptPendingError(LicenseVerificationError):
	pass


def _normalize(value: str) -> str:
	return (value or '').strip()


def _contract_address() -> str:
	address = _normalize(getattr(settings, 'CONTRACT_LICENSE_AGREEMENT_ADDRESS', ''))
	if not address:
		raise LicensePreparationError('LicenseAgreement contract address is not configured.')
	if not address.startswith('0x') or len(address) != 42:
		raise LicensePreparationError('LicenseAgreement contract address is invalid.')
	return address


def _license_selector() -> str:
	return keccak(text='purchaseLicense(address,string,uint256)')[:4].hex()


def _sha256_hash_for_work(work: CreativeWork) -> str:
	content_hash = (
		work.content_hashes.filter(hash_type=ContentHash.HashType.SHA256)
		.values_list('hash_value', flat=True)
		.first()
	)
	if not content_hash:
		raise LicensePreparationError('SHA-256 content hash is not available for this work.')
	return content_hash


def _creator_wallet_for_listing(listing: MarketplaceListing) -> str:
	owner = listing.work.owner
	primary = owner.wallets.filter(is_primary=True).first()
	wallet = primary or owner.wallets.first()
	if not wallet:
		raise LicensePreparationError('Creator wallet is not configured for this listing.')
	return wallet.address


def _validate_template_rules(
	listing: MarketplaceListing,
	template: str,
	rights_scope: str,
) -> None:
	if template not in {
		LicensePurchase.Template.PERSONAL,
		LicensePurchase.Template.COMMERCIAL,
		LicensePurchase.Template.EXCLUSIVE,
	}:
		raise LicensePreparationError('Unsupported license template.')

	if template != listing.license_type:
		raise LicensePreparationError('Requested template must match listing license type.')

	if template == LicensePurchase.Template.PERSONAL and rights_scope != LicensePurchase.RightsScope.NON_COMMERCIAL:
		raise LicensePreparationError('Personal licenses require non_commercial rights scope.')

	if template in {LicensePurchase.Template.COMMERCIAL, LicensePurchase.Template.EXCLUSIVE}:
		if rights_scope != LicensePurchase.RightsScope.COMMERCIAL:
			raise LicensePreparationError('Commercial and exclusive licenses require commercial rights scope.')


def _validate_listing_eligibility(listing: MarketplaceListing, buyer_id: int) -> None:
	if not listing.is_listed:
		raise LicensePreparationError('This work is not currently listed for licensing.')

	if listing.work.status != CreativeWork.Status.REGISTERED:
		raise LicensePreparationError('Only registered works can be licensed.')

	if listing.work.owner_id == buyer_id:
		raise LicensePreparationError('You cannot purchase a license for your own work.')


def _validate_exclusive_conflict(work_id: int) -> None:
	already_exclusive = LicensePurchase.objects.filter(
		work_id=work_id,
		is_exclusive=True,
		status__in=[LicensePurchase.Status.PENDING_CONFIRMATION, LicensePurchase.Status.ACTIVE],
	).exists()
	if already_exclusive:
		raise LicensePreparationError('This work already has an exclusive license purchase in progress or completed.')


def prepare_purchase_payload(purchase: LicensePurchase, creator_wallet_address: str) -> dict[str, str]:
	content_hash = _sha256_hash_for_work(purchase.work)
	encoded_args = encode(['address', 'string', 'uint256'], [creator_wallet_address, content_hash, 0]).hex()
	calldata = f'0x{_license_selector()}{encoded_args}'
	return {
		'to': _contract_address(),
		'data': calldata,
		'value': hex(int(purchase.amount_wei)),
	}


def validate_purchase_request(
	listing: MarketplaceListing,
	buyer_id: int,
	template: str,
	rights_scope: str,
) -> None:
	_validate_template_rules(listing, template, rights_scope)
	_validate_listing_eligibility(listing, buyer_id)
	if template == LicensePurchase.Template.EXCLUSIVE:
		_validate_exclusive_conflict(listing.work_id)


def _parse_hex_int(value: str | None) -> int | None:
	if not value:
		return None
	return int(value, 16)


def _block_timestamp(block_number_hex: str | None) -> datetime | None:
	if not block_number_hex:
		return None

	from apps.works.services_blockchain import rpc_call_with_failover

	block_result = rpc_call_with_failover('eth_getBlockByNumber', [block_number_hex, False]).payload
	block = block_result.get('result') or {}
	timestamp_hex = block.get('timestamp')
	if not timestamp_hex:
		return None
	return datetime.fromtimestamp(int(timestamp_hex, 16), tz=dt_timezone.utc)


def _expected_transaction(purchase: LicensePurchase, creator_wallet: str) -> tuple[str, str, int]:
	payload = prepare_purchase_payload(purchase, creator_wallet)
	return payload['to'].lower(), payload['data'].lower(), purchase.amount_wei


def verify_purchase_receipt(purchase: LicensePurchase, tx_hash: str, creator_wallet: str) -> dict[str, Any]:
	from apps.works.services_blockchain import rpc_call_with_failover

	tx_result = rpc_call_with_failover('eth_getTransactionByHash', [tx_hash]).payload
	tx_payload = tx_result.get('result')
	if not tx_payload:
		raise ReceiptPendingError('Transaction not yet available on RPC endpoint.')

	expected_to, expected_data, expected_amount = _expected_transaction(purchase, creator_wallet)
	tx_to = (tx_payload.get('to') or '').lower()
	tx_data = (tx_payload.get('input') or '').lower()
	tx_value = _parse_hex_int(tx_payload.get('value'))

	if tx_to != expected_to:
		raise LicenseVerificationError('Transaction target contract does not match LicenseAgreement address.')
	if tx_data != expected_data:
		raise LicenseVerificationError('Transaction call data does not match expected license purchase payload.')
	if tx_value != expected_amount:
		raise LicenseVerificationError('Transaction value does not match expected license price.')

	receipt_result = rpc_call_with_failover('eth_getTransactionReceipt', [tx_hash]).payload
	receipt = receipt_result.get('result')
	if not receipt:
		raise ReceiptPendingError('Transaction receipt not yet available.')

	tx_status = _parse_hex_int(receipt.get('status'))
	if tx_status != 1:
		raise LicenseVerificationError('License purchase transaction failed on-chain.')

	block_number = _parse_hex_int(receipt.get('blockNumber'))
	purchased_at = _block_timestamp(receipt.get('blockNumber')) or timezone.now()

	return {
		'tx_hash': tx_hash,
		'block_number': block_number,
		'purchased_at': purchased_at,
		'explorer_url': tx_explorer_url(tx_hash),
	}


def tx_explorer_url(tx_hash: str) -> str:
	base = _normalize(
		getattr(settings, 'POLYGON_AMOY_EXPLORER_TX_BASE_URL', 'https://amoy.polygonscan.com/tx/')
	)
	return f"{base.rstrip('/')}/{tx_hash}"


def creator_wallet_address_for_listing(listing: MarketplaceListing) -> str:
	return _creator_wallet_for_listing(listing)

