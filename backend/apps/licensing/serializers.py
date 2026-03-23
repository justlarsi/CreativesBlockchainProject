from rest_framework import serializers

from .models import LicensePurchase


class LicensePurchasePrepareSerializer(serializers.Serializer):
    work_id = serializers.IntegerField(min_value=1)
    template = serializers.ChoiceField(choices=LicensePurchase.Template.choices)
    rights_scope = serializers.ChoiceField(choices=LicensePurchase.RightsScope.choices)


class LicenseReceiptSubmissionSerializer(serializers.Serializer):
    purchase_id = serializers.IntegerField(min_value=1)
    idempotency_key = serializers.RegexField(
        regex=r'^[A-Za-z0-9._:-]{8,128}$',
        error_messages={'invalid': 'idempotency_key must be 8-128 chars using letters, digits, dot, underscore, colon, or dash.'},
    )
    tx_hash = serializers.RegexField(
        regex=r'^0x[a-fA-F0-9]{64}$',
        error_messages={'invalid': 'tx_hash must be a 0x-prefixed 32-byte transaction hash.'},
    )


class LicensePurchaseSerializer(serializers.ModelSerializer):
    explorer_url = serializers.SerializerMethodField()

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
            'receipt_idempotency_key',
            'block_number',
            'purchased_at',
            'status',
            'error_message',
            'explorer_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_explorer_url(self, obj: LicensePurchase) -> str:
        if not obj.tx_hash:
            return ''
        from .services_blockchain import tx_explorer_url

        return tx_explorer_url(obj.tx_hash)

