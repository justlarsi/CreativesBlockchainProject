import hashlib

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.works.models import CreativeWork


class InfringementAlert(models.Model):
	class Status(models.TextChoices):
		PENDING = 'pending', 'Pending'
		CONFIRMED = 'confirmed', 'Confirmed'
		FALSE_POSITIVE = 'false_positive', 'False positive'
		RESOLVED = 'resolved', 'Resolved'

	class Severity(models.TextChoices):
		LOW = 'low', 'Low'
		MEDIUM = 'medium', 'Medium'
		HIGH = 'high', 'High'
		CRITICAL = 'critical', 'Critical'

	creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='infringement_alerts')
	work = models.ForeignKey(CreativeWork, on_delete=models.CASCADE, related_name='infringement_alerts')

	source_url = models.URLField(max_length=1000)
	source_platform = models.CharField(max_length=100, blank=True, default='')
	source_fingerprint = models.CharField(max_length=64, db_index=True)

	similarity_score = models.FloatField(default=0.0)
	severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.LOW)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

	evidence = models.JSONField(default=dict, blank=True)
	detection_reason = models.CharField(max_length=255, blank=True, default='')
	resolution_notes = models.TextField(blank=True, default='')

	first_detected_at = models.DateTimeField(auto_now_add=True)
	last_detected_at = models.DateTimeField(auto_now_add=True)
	resolved_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'infringement_alerts'
		ordering = ['-last_detected_at', '-created_at']
		constraints = [
			models.UniqueConstraint(
				fields=['work', 'source_fingerprint'],
				condition=Q(status__in=['pending', 'confirmed']),
				name='uniq_open_infringement_alert_per_work_source',
			),
		]

	def __str__(self) -> str:
		return f'alert:{self.id}:work:{self.work_id}:{self.status}'


def build_source_fingerprint(*, source_url: str, source_hash: str = '', title: str = '', description: str = '') -> str:
	raw = '|'.join(
		[
			(source_url or '').strip().lower(),
			(source_hash or '').strip().lower(),
			(title or '').strip().lower(),
			(description or '').strip().lower(),
		]
	)
	return hashlib.sha256(raw.encode('utf-8')).hexdigest()
