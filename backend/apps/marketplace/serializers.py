from rest_framework import serializers

from .models import MarketplaceListing


class MarketplaceListingListSerializer(serializers.ModelSerializer):
	work_id = serializers.IntegerField(source='work.id', read_only=True)
	title = serializers.CharField(source='work.title', read_only=True)
	description = serializers.CharField(source='work.description', read_only=True)
	category = serializers.CharField(source='work.category', read_only=True)
	creator = serializers.SerializerMethodField()

	class Meta:
		model = MarketplaceListing
		fields = [
			'work_id',
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
			'username': obj.work.owner.username,
			# Avatar support is not implemented yet; keep nullable contract for frontend.
			'avatar_url': None,
		}


class MarketplaceListingDetailSerializer(serializers.ModelSerializer):
	work_id = serializers.IntegerField(source='work.id', read_only=True)
	title = serializers.CharField(source='work.title', read_only=True)
	description = serializers.CharField(source='work.description', read_only=True)
	category = serializers.CharField(source='work.category', read_only=True)
	status = serializers.CharField(source='work.status', read_only=True)
	ipfs_metadata_cid = serializers.CharField(source='work.ipfs_metadata_cid', read_only=True)
	created_at = serializers.DateTimeField(source='work.created_at', read_only=True)
	updated_at = serializers.DateTimeField(source='work.updated_at', read_only=True)
	creator = serializers.SerializerMethodField()

	class Meta:
		model = MarketplaceListing
		fields = [
			'work_id',
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

	def get_creator(self, obj):
		owner = obj.work.owner
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

