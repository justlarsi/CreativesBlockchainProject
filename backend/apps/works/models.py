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

	owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creative_works')
	title = models.CharField(max_length=255)
	description = models.TextField(blank=True, default='')
	category = models.CharField(max_length=20, choices=Category.choices)
	status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_UPLOAD)

	file = models.FileField(upload_to='works/%Y/%m/%d/', blank=True, null=True)
	original_filename = models.CharField(max_length=255, blank=True, default='')
	file_size = models.BigIntegerField(null=True, blank=True)
	mime_type = models.CharField(max_length=100, blank=True, default='')

	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'works_creative_work'
		ordering = ['-created_at']

	def __str__(self) -> str:
		return f'{self.id}:{self.title}'
