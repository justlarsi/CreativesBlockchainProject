from rest_framework import serializers

from apps.works.models import CreativeWork
from .models import MarketplaceListing


class MarketplaceWorkListSerializer(serializers.ModelSerializer):
	"""Serializer for work list in marketplace (with optional pricing)"""
	creator = serializers.SerializerMethodField()
	license_type = serializers.SerializerMethodField()
	price_amount = serializers.SerializerMethodField()

	class Meta:
		model = CreativeWork
		fields = [
			'id',
			'title',
			'description',
			'category',
			'license_type',
			'price_amount',
			'creator',
			'created_at',
		]
		read_only_fields = fields

	def get_creator(self, obj):
		return {
			'username': obj.owner.username,
			'avatar_url': None,
		}

	def get_license_type(self, obj):
		# Return license_type if marketplace listing exists, else None
		if hasattr(obj, 'marketplace_listing') and obj.marketplace_listing:
			return obj.marketplace_listing.license_type
		return None

	def get_price_amount(self, obj):
		# Return price if marketplace listing exists, else None
		if hasattr(obj, 'marketplace_listing') and obj.marketplace_listing:
			return str(obj.marketplace_listing.price_amount)
		return None


class MarketplaceWorkDetailSerializer(serializers.ModelSerializer):
	"""Serializer for work detail in marketplace (with optional pricing and creator info)"""
	license_type = serializers.SerializerMethodField()
	price_amount = serializers.SerializerMethodField()
	creator = serializers.SerializerMethodField()

	class Meta:
		model = CreativeWork
		fields = [
			'id',
			'title',
			'description',
			'category',
			'status',
			'ipfs_metadata_cid',
			'license_type',
			'price_amount',
			'creator',
			'created_at',
			'updated_at',
		]
		read_only_fields = fields

	def get_license_type(self, obj):
		# Return license_type if marketplace listing exists, else None
		if hasattr(obj, 'marketplace_listing') and obj.marketplace_listing:
			return obj.marketplace_listing.license_type
		return None

	def get_price_amount(self, obj):
		# Return price if marketplace listing exists, else None
		if hasattr(obj, 'marketplace_listing') and obj.marketplace_listing:
			return str(obj.marketplace_listing.price_amount)
		return None

	def get_creator(self, obj):
		owner = obj.owner
		primary_wallet = owner.wallets.filter(is_primary=True).first()
		wallet_address = primary_wallet.address if primary_wallet else None
		if wallet_address is None:
			fallback_wallet = owner.wallets.first()
			wallet_address = fallback_wallet.address if fallback_wallet else None

		return {
			'username': owner.username,
			'bio': owner.bio,
			'wallet_address': wallet_address,
		}

