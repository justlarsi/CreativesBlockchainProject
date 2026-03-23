from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.marketplace.models import MarketplaceListing

from .models import LicensePurchase
from .services_blockchain import (
    LicenseVerificationError,
    ReceiptPendingError,
    creator_wallet_address_for_listing,
    tx_explorer_url,
    verify_purchase_receipt,
)

logger = get_task_logger(__name__)


@shared_task(
    name='licensing.verify_license_receipt',
    bind=True,
    max_retries=getattr(settings, 'BLOCKCHAIN_RECEIPT_MAX_RETRIES', 8),
    retry_backoff=True,
    retry_backoff_max=120,
)
def verify_license_receipt_task(self, purchase_id: int, tx_hash: str) -> dict:
    try:
        purchase = (
            LicensePurchase.objects
            .select_related('work', 'buyer', 'creator', 'work__owner')
            .prefetch_related('work__owner__wallets')
            .get(id=purchase_id)
        )
    except LicensePurchase.DoesNotExist:
        logger.error('verify_license_receipt_task: purchase %s not found', purchase_id)
        return {'status': 'not_found', 'purchase_id': purchase_id}

    if purchase.status == LicensePurchase.Status.ACTIVE:
        return {'status': 'already_active', 'purchase_id': purchase.id, 'tx_hash': purchase.tx_hash}

    if purchase.status != LicensePurchase.Status.PENDING_CONFIRMATION:
        return {'status': 'skipped', 'purchase_id': purchase.id, 'current_status': purchase.status}

    try:
        listing = MarketplaceListing.objects.select_related('work', 'work__owner').prefetch_related('work__owner__wallets').get(
            work_id=purchase.work_id
        )
        creator_wallet = creator_wallet_address_for_listing(listing)
        verification = verify_purchase_receipt(purchase, tx_hash, creator_wallet)
    except ReceiptPendingError as exc:
        if self.request.retries >= self.max_retries:
            message = 'Transaction receipt not confirmed before timeout.'
            purchase.status = LicensePurchase.Status.FAILED
            purchase.error_message = message
            purchase.save(update_fields=['status', 'error_message', 'updated_at'])
            AuditLog.objects.create(
                user=purchase.buyer,
                action='license_purchase_failed',
                entity_type='license_purchase',
                entity_id=str(purchase.id),
                metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
            )
            return {'status': 'failed', 'purchase_id': purchase.id, 'reason': message}
        raise self.retry(exc=exc)
    except LicenseVerificationError as exc:
        message = str(exc)
        purchase.status = LicensePurchase.Status.FAILED
        purchase.error_message = message
        purchase.save(update_fields=['status', 'error_message', 'updated_at'])
        AuditLog.objects.create(
            user=purchase.buyer,
            action='license_purchase_failed',
            entity_type='license_purchase',
            entity_id=str(purchase.id),
            metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
        )
        return {'status': 'failed', 'purchase_id': purchase.id, 'reason': message}
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            message = f'License verification failed: {exc}'
            purchase.status = LicensePurchase.Status.FAILED
            purchase.error_message = message
            purchase.save(update_fields=['status', 'error_message', 'updated_at'])
            AuditLog.objects.create(
                user=purchase.buyer,
                action='license_purchase_failed',
                entity_type='license_purchase',
                entity_id=str(purchase.id),
                metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
            )
            return {'status': 'failed', 'purchase_id': purchase.id, 'reason': message}
        raise self.retry(exc=exc)

    purchase.tx_hash = verification['tx_hash']
    purchase.block_number = verification['block_number']
    purchase.purchased_at = verification['purchased_at']
    purchase.status = LicensePurchase.Status.ACTIVE
    purchase.error_message = ''
    purchase.save(
        update_fields=['tx_hash', 'block_number', 'purchased_at', 'status', 'error_message', 'updated_at']
    )

    if purchase.is_exclusive:
        MarketplaceListing.objects.filter(work_id=purchase.work_id).update(is_listed=False, updated_at=timezone.now())

    AuditLog.objects.create(
        user=purchase.buyer,
        action='license_purchase_confirmed',
        entity_type='license_purchase',
        entity_id=str(purchase.id),
        metadata={
            'tx_hash': verification['tx_hash'],
            'block_number': verification['block_number'],
            'purchased_at': verification['purchased_at'].isoformat(),
            'explorer_url': verification['explorer_url'],
        },
    )
    return {
        'status': 'ok',
        'purchase_id': purchase.id,
        'tx_hash': verification['tx_hash'],
        'block_number': verification['block_number'],
        'is_exclusive': purchase.is_exclusive,
    }

