from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings

from apps.audit_logs.models import AuditLog

from .models import Collaboration
from .services_blockchain import (
    CollaborationVerificationError,
    ReceiptPendingError,
    mark_registration_confirmed,
    mark_registration_failed,
    tx_explorer_url,
    verify_collaboration_receipt,
)

logger = get_task_logger(__name__)


@shared_task(
    name='collaboration.verify_collaboration_receipt',
    bind=True,
    max_retries=getattr(settings, 'BLOCKCHAIN_RECEIPT_MAX_RETRIES', 8),
    retry_backoff=True,
    retry_backoff_max=120,
)
def verify_collaboration_receipt_task(self, collaboration_id: int, tx_hash: str) -> dict:
    try:
        collaboration = Collaboration.objects.select_related('creator', 'work').prefetch_related('members').get(id=collaboration_id)
    except Collaboration.DoesNotExist:
        logger.error('verify_collaboration_receipt_task: collaboration %s not found', collaboration_id)
        return {'status': 'not_found', 'collaboration_id': collaboration_id}

    if collaboration.status == Collaboration.Status.REGISTERED:
        return {'status': 'already_registered', 'collaboration_id': collaboration.id, 'tx_hash': collaboration.blockchain_tx_hash}

    if collaboration.status != Collaboration.Status.BLOCKCHAIN_REGISTRATION_PENDING:
        return {'status': 'skipped', 'collaboration_id': collaboration.id, 'current_status': collaboration.status}

    try:
        verification = verify_collaboration_receipt(collaboration, tx_hash)
    except ReceiptPendingError as exc:
        if self.request.retries >= self.max_retries:
            message = 'Transaction receipt not confirmed before timeout.'
            mark_registration_failed(collaboration, message)
            AuditLog.objects.create(
                user=collaboration.creator,
                action='collaboration_blockchain_registration_failed',
                entity_type='collaboration',
                entity_id=str(collaboration.id),
                metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
            )
            return {'status': 'failed', 'collaboration_id': collaboration.id, 'reason': message}
        raise self.retry(exc=exc)
    except CollaborationVerificationError as exc:
        message = str(exc)
        mark_registration_failed(collaboration, message)
        AuditLog.objects.create(
            user=collaboration.creator,
            action='collaboration_blockchain_registration_failed',
            entity_type='collaboration',
            entity_id=str(collaboration.id),
            metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
        )
        return {'status': 'failed', 'collaboration_id': collaboration.id, 'reason': message}
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            message = f'Collaboration verification failed: {exc}'
            mark_registration_failed(collaboration, message)
            AuditLog.objects.create(
                user=collaboration.creator,
                action='collaboration_blockchain_registration_failed',
                entity_type='collaboration',
                entity_id=str(collaboration.id),
                metadata={'tx_hash': tx_hash, 'reason': message, 'explorer_url': tx_explorer_url(tx_hash)},
            )
            return {'status': 'failed', 'collaboration_id': collaboration.id, 'reason': message}
        raise self.retry(exc=exc)

    mark_registration_confirmed(collaboration, verification)
    AuditLog.objects.create(
        user=collaboration.creator,
        action='collaboration_blockchain_registered',
        entity_type='collaboration',
        entity_id=str(collaboration.id),
        metadata={
            'tx_hash': verification['tx_hash'],
            'block_number': verification['block_number'],
            'registered_at': verification['registered_at'].isoformat(),
            'explorer_url': verification['explorer_url'],
        },
    )
    return {
        'status': 'ok',
        'collaboration_id': collaboration.id,
        'tx_hash': verification['tx_hash'],
        'block_number': verification['block_number'],
    }

