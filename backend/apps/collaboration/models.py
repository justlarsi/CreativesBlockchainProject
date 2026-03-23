from django.conf import settings
from django.db import models

from apps.licensing.models import LicensePurchase
from apps.works.models import CreativeWork


class Collaboration(models.Model):
	class Status(models.TextChoices):
		PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending approval'
		APPROVED = 'APPROVED', 'Approved'
		BLOCKCHAIN_REGISTRATION_PENDING = 'BLOCKCHAIN_REGISTRATION_PENDING', 'Blockchain registration pending'
		REGISTERED = 'REGISTERED', 'Registered'
		BLOCKCHAIN_REGISTRATION_FAILED = 'BLOCKCHAIN_REGISTRATION_FAILED', 'Blockchain registration failed'

	work = models.OneToOneField(
		CreativeWork,
		on_delete=models.CASCADE,
		related_name='collaboration',
	)
	creator = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.PROTECT,
		related_name='created_collaborations',
	)
	status = models.CharField(max_length=40, choices=Status.choices, default=Status.PENDING_APPROVAL)
	blockchain_tx_hash = models.CharField(max_length=66, blank=True, default='')
	blockchain_block_number = models.BigIntegerField(null=True, blank=True)
	blockchain_registered_at = models.DateTimeField(null=True, blank=True)
	blockchain_error_message = models.TextField(blank=True, default='')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'collaboration_collaboration'
		ordering = ['-created_at']

	def __str__(self) -> str:
		return f'{self.id}:{self.work_id}:{self.status}'


class CollaborationMember(models.Model):
	class ApprovalStatus(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		APPROVED = 'APPROVED', 'Approved'

	collaboration = models.ForeignKey(Collaboration, on_delete=models.CASCADE, related_name='members')
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='collaboration_memberships')
	wallet_address = models.CharField(max_length=42)
	split_bps = models.PositiveIntegerField()
	approval_status = models.CharField(max_length=16, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
	approved_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'collaboration_member'
		ordering = ['id']
		constraints = [
			models.UniqueConstraint(fields=['collaboration', 'user'], name='collab_unique_user_per_collaboration'),
			models.UniqueConstraint(fields=['collaboration', 'wallet_address'], name='collab_unique_wallet_per_collaboration'),
			models.CheckConstraint(check=models.Q(split_bps__gte=1) & models.Q(split_bps__lte=10000), name='collab_member_split_bps_range'),
		]

	def __str__(self) -> str:
		return f'{self.collaboration_id}:{self.user_id}:{self.split_bps}'


class RevenueSplitRecord(models.Model):
	class SourceEvent(models.TextChoices):
		LICENSE_PURCHASE = 'LICENSE_PURCHASE', 'License purchase'

	collaboration = models.ForeignKey(Collaboration, on_delete=models.PROTECT, related_name='revenue_records')
	member = models.ForeignKey(CollaborationMember, on_delete=models.PROTECT, related_name='revenue_records')
	license_purchase = models.ForeignKey(
		LicensePurchase,
		on_delete=models.PROTECT,
		related_name='collaboration_revenue_records',
	)
	source_event = models.CharField(max_length=32, choices=SourceEvent.choices)
	split_bps = models.PositiveIntegerField()
	amount_wei = models.BigIntegerField()
	tx_hash = models.CharField(max_length=66, blank=True, default='')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'collaboration_revenue_split_record'
		ordering = ['id']
		constraints = [
			models.UniqueConstraint(fields=['license_purchase', 'member'], name='collab_unique_license_member_revenue_record'),
			models.CheckConstraint(check=models.Q(split_bps__gte=1) & models.Q(split_bps__lte=10000), name='collab_revenue_split_bps_range'),
			models.CheckConstraint(check=models.Q(amount_wei__gte=0), name='collab_revenue_amount_non_negative'),
		]

	def __str__(self) -> str:
		return f'{self.collaboration_id}:{self.member_id}:{self.amount_wei}'
