# Phase 1 Step 4 Evidence

Date: 2026-03-17
Status: Done

## Implemented Scope

- `ContentHash` model (`works_content_hash` table) with unique `(work, hash_type)` constraint
- New `CreativeWork.Status` values: `PROCESSING`, `PROCESSING_COMPLETE`, `PROCESSING_FAILED`
- `hash_work_task` Celery task (`works.hash_work`):
  - SHA-256 for all categories (stdlib `hashlib`)
  - `perceptual_avg` hash for images (Pillow 8×8 average-hash)
  - `text_normalized` hash for text/document (utf-8 normalize + SHA-256)
  - Audio/Video: SHA-256 only (modality fingerprint deferred to Step 10)
  - `autoretry_for=(Exception,)`, `retry_backoff=True`, `max_retries=3`
  - Idempotency guard: skips works not in `UPLOADED` or `PROCESSING_FAILED`
  - Dispatched via `transaction.on_commit` after successful binary upload
- Migration: `works.0002_step4_contenthash_processing_statuses`
- `ContentHash` embedded in `CreativeWorkSerializer` response
- `ContentHashAdmin` registered in Django admin
- Frontend `WorkRecord` type extended with `content_hashes` and new status values
- Works page status mapper updated to handle `PROCESSING`, `PROCESSING_COMPLETE`, `PROCESSING_FAILED`

## Verification Run Log

- `python manage.py migrate --noinput` → applied `works.0002_step4_contenthash_processing_statuses`
- `python manage.py test apps.works.tests --keepdb --noinput` → **18/18 pass**
- `npm test` (frontend) → **8/8 pass**

## Test Coverage (Step 4)

- `test_hash_task_transitions_to_processing_complete`
- `test_hash_task_creates_sha256_record`
- `test_hash_task_creates_perceptual_hash_for_image`
- `test_hash_task_creates_text_normalized_hash_for_text`
- `test_hash_task_audio_only_sha256_no_perceptual`
- `test_hash_task_idempotency_skips_already_complete`
- `test_hash_task_sets_processing_failed_on_error`
- `test_hash_task_retries_from_processing_failed`
- `test_hash_task_returns_not_found_for_missing_work`
- `test_upload_dispatches_hash_task`
- `test_failed_upload_does_not_dispatch_hash_task`

