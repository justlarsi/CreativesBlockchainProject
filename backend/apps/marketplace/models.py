from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.works.models import CreativeWork


class MarketplaceListing(models.Model):
	class LicenseType(models.TextChoices):
		PERSONAL = 'personal', 'Personal'
		COMMERCIAL = 'commercial', 'Commercial'
		EXCLUSIVE = 'exclusive', 'Exclusive'

	work = models.OneToOneField(
		CreativeWork,
		on_delete=models.CASCADE,
		related_name='marketplace_listing',
	)
	is_listed = models.BooleanField(default=False, db_index=True)
	license_type = models.CharField(max_length=20, choices=LicenseType.choices)
	price_amount = models.DecimalField(
		max_digits=12,
		decimal_places=2,
		validators=[MinValueValidator(Decimal('0.00'))],
	)
	# Canonical source-of-truth price for blockchain purchase flow.
	price_wei = models.BigIntegerField(default=0, validators=[MinValueValidator(0)])
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = 'marketplace_listing'
		ordering = ['-created_at']

	def __str__(self) -> str:
		return f'{self.work_id}:{self.license_type}:{self.price_amount}'

	def save(self, *args, **kwargs):
		if self.price_wei <= 0 and self.price_amount is not None:
			# Backfill from legacy 2-decimal display field without exceeding bigint range.
			self.price_wei = int((self.price_amount * Decimal('10000000000000000')).to_integral_value())
		super().save(*args, **kwargs)

