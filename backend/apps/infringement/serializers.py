from rest_framework import serializers

from .models import InfringementAlert


class InfringementAlertSerializer(serializers.ModelSerializer):
    work_id = serializers.IntegerField(source='work.id', read_only=True)
    work_title = serializers.CharField(source='work.title', read_only=True)

    class Meta:
        model = InfringementAlert
        fields = [
            'id',
            'work_id',
            'work_title',
            'source_url',
            'source_platform',
            'source_fingerprint',
            'similarity_score',
            'severity',
            'status',
            'detection_reason',
            'evidence',
            'resolution_notes',
            'first_detected_at',
            'last_detected_at',
            'resolved_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'work_id',
            'work_title',
            'source_fingerprint',
            'similarity_score',
            'severity',
            'detection_reason',
            'evidence',
            'first_detected_at',
            'last_detected_at',
            'resolved_at',
            'created_at',
            'updated_at',
        ]


class InfringementAlertStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InfringementAlert
        fields = ['status', 'resolution_notes']

    def validate_status(self, value: str) -> str:
        instance: InfringementAlert = self.instance
        allowed_transitions = {
            InfringementAlert.Status.PENDING: {
                InfringementAlert.Status.CONFIRMED,
                InfringementAlert.Status.FALSE_POSITIVE,
                InfringementAlert.Status.RESOLVED,
            },
            InfringementAlert.Status.CONFIRMED: {InfringementAlert.Status.RESOLVED},
            InfringementAlert.Status.FALSE_POSITIVE: set(),
            InfringementAlert.Status.RESOLVED: set(),
        }

        if value == instance.status:
            return value

        if value not in allowed_transitions.get(instance.status, set()):
            raise serializers.ValidationError(
                f'Invalid status transition from {instance.status} to {value}.'
            )
        return value


class SimulatedSourceCandidateSerializer(serializers.Serializer):
    source_url = serializers.URLField(max_length=1000)
    source_platform = serializers.CharField(max_length=100, required=False, allow_blank=True)
    source_hash = serializers.CharField(max_length=256, required=False, allow_blank=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)


class InfringementScanTriggerSerializer(serializers.Serializer):
    work_id = serializers.IntegerField()
    candidates = SimulatedSourceCandidateSerializer(many=True)


class InfringementPublicScanSerializer(serializers.Serializer):
    work_id = serializers.IntegerField(min_value=1)
    platforms = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
    )


class InfringementLegacyCleanupSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(
        choices=['hide', 'delete'],
        required=False,
        default='hide',
    )

