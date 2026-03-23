from rest_framework import serializers

from .models import LicensePurchase


class LicenseReceiptSubmissionSerializer(serializers.Serializer):
    tx_hash = serializers.RegexField(
        regex=r'^0x[a-fA-F0-9]{64}$',
        error_messages={'invalid': 'tx_hash must be a 0x-prefixed 32-byte transaction hash.'},
    )


class LicensePurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicensePurchase
        fields = [
            'id',
            'work_id',
            'buyer_id',
            'creator_id',
            'template',
            'rights_scope',
            'is_exclusive',
            'amount_wei',
            'tx_hash',
            'block_number',
            'purchased_at',
            'status',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

