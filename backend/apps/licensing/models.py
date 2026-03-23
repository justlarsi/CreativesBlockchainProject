from django.conf import settings
from django.db import models

from apps.works.models import CreativeWork


class LicensePurchase(models.Model):
	class Template(models.TextChoices):
		PERSONAL = 'personal', 'Personal'
		COMMERCIAL = 'commercial', 'Commercial'
		EXCLUSIVE = 'exclusive', 'Exclusive'

	class RightsScope(models.TextChoices):
		NON_COMMERCIAL = 'non_commercial', 'Non-commercial'
		COMMERCIAL = 'commercial', 'Commercial'

	class Status(models.TextChoices):
		PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', 'Pending confirmation'
		ACTIVE = 'ACTIVE', 'Active'
		FAILED = 'FAILED', 'Failed'

	work = models.ForeignKey(CreativeWork, on_delete=models.PROTECT, related_name='licenses')
	buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='purchased_licenses')
	creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sold_licenses')

	template = models.CharField(max_length=20, choices=Template.choices)
	rights_scope = models.CharField(max_length=20, choices=RightsScope.choices)
	is_exclusive = models.BooleanField(default=False, db_index=True)

	amount_wei = models.BigIntegerField()

	tx_hash = models.CharField(max_length=66, blank=True, default='')
	receipt_idempotency_key = models.CharField(max_length=128, blank=True, default='')
	block_number = models.BigIntegerField(null=True, blank=True)
	purchased_at = models.DateTimeField(null=True, blank=True)
	status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_CONFIRMATION)
	error_message = models.TextField(blank=True, default='')

	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'licensing_license_purchase'
		ordering = ['-created_at']
		constraints = [
			models.UniqueConstraint(fields=['tx_hash'], name='licensing_unique_tx_hash', condition=~models.Q(tx_hash='')),
			models.UniqueConstraint(
				fields=['receipt_idempotency_key'],
				name='licensing_unique_receipt_idempotency_key',
				condition=~models.Q(receipt_idempotency_key=''),
			),
		]

	def __str__(self) -> str:
		return f'{self.id}:{self.work_id}:{self.template}:{self.status}'
