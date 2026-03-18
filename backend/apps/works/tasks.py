import hashlib
import io
import struct

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
      UPLOADED → PROCESSING → PROCESSING_COMPLETE
                            → PROCESSING_FAILED  (on unrecoverable error after max_retries)

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

        logger.info('hash_work_task: work %s completed sha256=%s', work_id, sha256_hex[:16])
        return {'status': 'ok', 'work_id': work_id, 'sha256': sha256_hex}

    except Exception as exc:
        logger.error('hash_work_task: work %s failed (%s) — attempt %s/%s',
                     work_id, exc, self.request.retries + 1, self.max_retries + 1)
        # Mark as PROCESSING_FAILED so it is eligible for manual re-trigger or retry.
        work.status = CreativeWork.Status.PROCESSING_FAILED
        work.save(update_fields=['status', 'updated_at'])
        raise  # triggers Celery autoretry


