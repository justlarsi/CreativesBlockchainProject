from django.db import models
from django.conf import settings


class CreativeWork(models.Model):
    class Category(models.TextChoices):
        IMAGE = 'image', 'Image'
        AUDIO = 'audio', 'Audio'
        VIDEO = 'video', 'Video'
        TEXT = 'text', 'Text'
        DOCUMENT = 'document', 'Document'

    class Status(models.TextChoices):
        PENDING_UPLOAD = 'PENDING_UPLOAD', 'Pending upload'
        UPLOADED = 'UPLOADED', 'Uploaded'
        VALIDATION_FAILED = 'VALIDATION_FAILED', 'Validation failed'
        UPLOAD_FAILED = 'UPLOAD_FAILED', 'Upload failed'
        # Step 4 statuses
        PROCESSING = 'PROCESSING', 'Processing'
        PROCESSING_COMPLETE = 'PROCESSING_COMPLETE', 'Processing complete'
        PROCESSING_FAILED = 'PROCESSING_FAILED', 'Processing failed'
        # Step 5 statuses
        IPFS_PINNING_COMPLETE = 'IPFS_PINNING_COMPLETE', 'IPFS pinning complete'
        IPFS_PINNING_FAILED = 'IPFS_PINNING_FAILED', 'IPFS pinning failed'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creative_works')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=20, choices=Category.choices)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_UPLOAD)

    file = models.FileField(upload_to='works/%Y/%m/%d/', blank=True, null=True)
    original_filename = models.CharField(max_length=255, blank=True, default='')
    file_size = models.BigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True, default='')
    ipfs_metadata_cid = models.CharField(max_length=255, blank=True, default='')
    ipfs_pinned_at = models.DateTimeField(null=True, blank=True)
    ipfs_error_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'works_creative_work'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.id}:{self.title}'


class ContentHash(models.Model):
    """One hash record per (work, hash_type) pair — created by the async hashing task."""

    class HashType(models.TextChoices):
        SHA256 = 'sha256', 'SHA-256'
        PERCEPTUAL_AVG = 'perceptual_avg', 'Perceptual average hash (image)'
        TEXT_NORMALIZED = 'text_normalized', 'Text normalized hash'

    work = models.ForeignKey(CreativeWork, on_delete=models.CASCADE, related_name='content_hashes')
    hash_type = models.CharField(max_length=30, choices=HashType.choices)
    hash_value = models.CharField(max_length=256)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'works_content_hash'
        unique_together = [('work', 'hash_type')]
        ordering = ['hash_type']

    def __str__(self) -> str:
        return f'{self.work_id}:{self.hash_type}:{self.hash_value[:16]}'

