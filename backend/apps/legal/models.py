from django.conf import settings
from django.db import models

from apps.infringement.models import InfringementAlert
from apps.works.models import CreativeWork


class LegalDocument(models.Model):
	class DocumentType(models.TextChoices):
		DMCA = 'dmca', 'DMCA Takedown Notice'
		CEASE_AND_DESIST = 'cease_and_desist', 'Cease and Desist Letter'

	creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='legal_documents')
	work = models.ForeignKey(CreativeWork, on_delete=models.PROTECT, related_name='legal_documents')
	alert = models.ForeignKey(
		InfringementAlert,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='legal_documents',
	)
	document_type = models.CharField(max_length=24, choices=DocumentType.choices)
	file = models.FileField(upload_to='legal/documents/%Y/%m/%d/')
	proof_snapshot = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'legal_document'
		ordering = ['-created_at']

	def __str__(self) -> str:
		return f'legal_document:{self.id}:{self.document_type}:work:{self.work_id}'
