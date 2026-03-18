import hashlib
import io

from django.utils import timezone

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(name="works.step0_smoke_task")
def step0_smoke_task(payload: str = "ok") -> dict:
    """Simple task used to verify worker consumption during Step 0 checks."""
    return {"status": "ok", "payload": payload}


# ---------------------------------------------------------------------------
# Step 4 — async hashing
# ---------------------------------------------------------------------------

def _perceptual_avg_hash(raw_bytes: bytes) -> str:
    """
    8×8 average-hash (dHash variant) for images.
    Returns a 16-character hex string (64-bit hash).
    Requires Pillow.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(raw_bytes)).convert('L').resize((8, 8), Image.LANCZOS)
    pixels = list(img.getdata())
    avg = sum(pixels) / len(pixels)
    bits = ''.join('1' if p >= avg else '0' for p in pixels)
    value = int(bits, 2)
    return f'{value:016x}'


def _text_normalized_hash(raw_bytes: bytes) -> str:
    """
    Normalize text to lowercase stripped unicode, then SHA-256.
    Falls back gracefully on decode error.
    """
    try:
        text = raw_bytes.decode('utf-8', errors='replace').lower().strip()
    except Exception:
        text = raw_bytes.decode('latin-1', errors='replace').lower().strip()
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _build_ipfs_metadata_payload(work) -> dict:
    """Build NFT-compatible metadata while preserving required CreativeChain fields."""
    content_hashes = {
        item.hash_type: item.hash_value
        for item in work.content_hashes.all()
    }

    properties = {
        'work_id': work.id,
        'owner_id': work.owner_id,
        'title': work.title,
        'description': work.description,
        'category': work.category,
        'mime_type': work.mime_type,
        'file_size': work.file_size,
        'created_at': work.created_at.isoformat(),
        'content_hashes': content_hashes,
    }

    return {
        'name': work.title,
        'description': work.description,
        'attributes': [
            {'trait_type': 'category', 'value': work.category},
            {'trait_type': 'mime_type', 'value': work.mime_type},
            {'trait_type': 'file_size', 'value': work.file_size},
        ],
        'properties': properties,
    }


@shared_task(
    name='works.hash_work',
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=3,
)
def hash_work_task(self, work_id: int) -> dict:
    """
    Async task to compute and persist content hashes for a creative work.

    Lifecycle:
      UPLOADED → PROCESSING → PROCESSING_COMPLETE → IPFS_PINNING_COMPLETE
                            → PROCESSING_FAILED      (on unrecoverable hash error)
                                                 \-> IPFS_PINNING_FAILED (on unrecoverable pinning error)

    Hash types computed:
      - sha256            : always (all categories)
      - perceptual_avg    : image category only (Pillow)
      - text_normalized   : text/document categories only
    """
    from .models import ContentHash, CreativeWork

    try:
        work = CreativeWork.objects.get(id=work_id)
    except CreativeWork.DoesNotExist:
        logger.error('hash_work_task: work %s not found', work_id)
        return {'status': 'not_found', 'work_id': work_id}

    # Idempotency guard — skip states that are already terminal or ahead.
    eligible = {CreativeWork.Status.UPLOADED, CreativeWork.Status.PROCESSING_FAILED}
    if work.status not in eligible:
        logger.info('hash_work_task: work %s in status %s, skipping', work_id, work.status)
        return {'status': 'skipped', 'work_id': work_id, 'current_status': work.status}

    # Transition to PROCESSING.
    work.status = CreativeWork.Status.PROCESSING
    work.save(update_fields=['status', 'updated_at'])

    try:
        with work.file.open('rb') as fh:
            raw_bytes = fh.read()

        # SHA-256 — every category.
        sha256_hex = hashlib.sha256(raw_bytes).hexdigest()
        ContentHash.objects.update_or_create(
            work=work,
            hash_type=ContentHash.HashType.SHA256,
            defaults={'hash_value': sha256_hex},
        )

        # Modality-specific fingerprints.
        if work.category == CreativeWork.Category.IMAGE:
            perceptual = _perceptual_avg_hash(raw_bytes)
            ContentHash.objects.update_or_create(
                work=work,
                hash_type=ContentHash.HashType.PERCEPTUAL_AVG,
                defaults={'hash_value': perceptual},
            )
        elif work.category in (CreativeWork.Category.TEXT, CreativeWork.Category.DOCUMENT):
            text_hash = _text_normalized_hash(raw_bytes)
            ContentHash.objects.update_or_create(
                work=work,
                hash_type=ContentHash.HashType.TEXT_NORMALIZED,
                defaults={'hash_value': text_hash},
            )
        # AUDIO / VIDEO: SHA-256 only in Step 4; modality fingerprint deferred to Step 10.

        work.status = CreativeWork.Status.PROCESSING_COMPLETE
        work.save(update_fields=['status', 'updated_at'])

        # Step 5: auto-dispatch metadata pinning immediately after successful hashing.
        try:
            pin_work_metadata_task.delay(work.id)
        except Exception as exc:
            work.status = CreativeWork.Status.IPFS_PINNING_FAILED
            work.ipfs_error_message = f'Failed to enqueue IPFS pinning task: {exc}'
            work.save(update_fields=['status', 'ipfs_error_message', 'updated_at'])
            logger.error('hash_work_task: work %s could not enqueue pin task (%s)', work_id, exc)
            return {'status': 'ipfs_enqueue_failed', 'work_id': work_id}

        logger.info('hash_work_task: work %s completed sha256=%s', work_id, sha256_hex[:16])
        return {'status': 'ok', 'work_id': work_id, 'sha256': sha256_hex}

    except Exception as exc:
        logger.error('hash_work_task: work %s failed (%s) — attempt %s/%s',
                     work_id, exc, self.request.retries + 1, self.max_retries + 1)
        # Mark as PROCESSING_FAILED so it is eligible for manual re-trigger or retry.
        work.status = CreativeWork.Status.PROCESSING_FAILED
        work.save(update_fields=['status', 'updated_at'])
        raise  # triggers Celery autoretry


@shared_task(
    name='works.pin_work_metadata',
    bind=True,
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=3,
)
def pin_work_metadata_task(self, work_id: int) -> dict:
    """Pin normalized metadata JSON to IPFS and persist CID on the work record."""
    from .models import CreativeWork
    from .services_ipfs import PinataPinError, get_pinata_client

    try:
        work = CreativeWork.objects.get(id=work_id)
    except CreativeWork.DoesNotExist:
        logger.error('pin_work_metadata_task: work %s not found', work_id)
        return {'status': 'not_found', 'work_id': work_id}

    eligible = {CreativeWork.Status.PROCESSING_COMPLETE, CreativeWork.Status.IPFS_PINNING_FAILED}
    if work.status not in eligible:
        logger.info('pin_work_metadata_task: work %s in status %s, skipping', work_id, work.status)
        return {'status': 'skipped', 'work_id': work_id, 'current_status': work.status}

    payload = _build_ipfs_metadata_payload(work)
    metadata_name = f'creative-work-{work.id}-metadata'

    try:
        cid = get_pinata_client().pin_json(payload, metadata_name=metadata_name)
    except (PinataPinError, Exception) as exc:
        logger.error(
            'pin_work_metadata_task: work %s failed (%s) — attempt %s/%s',
            work_id,
            exc,
            self.request.retries + 1,
            self.max_retries + 1,
        )
        if self.request.retries >= self.max_retries:
            work.status = CreativeWork.Status.IPFS_PINNING_FAILED
            work.ipfs_error_message = str(exc)
            work.save(update_fields=['status', 'ipfs_error_message', 'updated_at'])
            return {'status': 'failed', 'work_id': work_id, 'error': str(exc)}
        raise self.retry(exc=exc)

    work.status = CreativeWork.Status.IPFS_PINNING_COMPLETE
    work.ipfs_metadata_cid = cid
    work.ipfs_pinned_at = timezone.now()
    work.ipfs_error_message = ''
    work.save(update_fields=['status', 'ipfs_metadata_cid', 'ipfs_pinned_at', 'ipfs_error_message', 'updated_at'])

    logger.info('pin_work_metadata_task: work %s pinned cid=%s', work_id, cid)
    return {'status': 'ok', 'work_id': work_id, 'ipfs_metadata_cid': cid}


