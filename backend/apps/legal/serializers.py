from rest_framework import serializers

from .models import LegalDocument


class LegalDocumentGenerateSerializer(serializers.Serializer):
	work_id = serializers.IntegerField(min_value=1)
	alert_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
	document_type = serializers.ChoiceField(choices=LegalDocument.DocumentType.choices)


class LegalDocumentSerializer(serializers.ModelSerializer):
	work_title = serializers.CharField(source='work.title', read_only=True)
	alert_status = serializers.CharField(source='alert.status', read_only=True)

	class Meta:
		model = LegalDocument
		fields = [
			'id',
			'document_type',
			'work_id',
			'work_title',
			'alert_id',
			'alert_status',
			'file',
			'proof_snapshot',
			'created_at',
			'updated_at',
		]
		read_only_fields = fields

