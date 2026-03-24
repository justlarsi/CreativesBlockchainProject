from rest_framework import serializers


class DashboardQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if bool(start_date) != bool(end_date):
            raise serializers.ValidationError('Both start_date and end_date must be provided together.')
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError('start_date must be less than or equal to end_date.')
        return attrs


class DateRangeSerializer(serializers.Serializer):
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)


class RevenueTotalsSerializer(serializers.Serializer):
    total_wei = serializers.CharField()
    total_matic = serializers.CharField()


class InfringementStatusCountSerializer(serializers.Serializer):
    status = serializers.CharField()
    total = serializers.IntegerField()


class WorksCategoryBreakdownSerializer(serializers.Serializer):
    category = serializers.CharField()
    total = serializers.IntegerField()
    registered = serializers.IntegerField()


class RevenueOverTimePointSerializer(serializers.Serializer):
    period = serializers.CharField()
    revenue_wei = serializers.CharField()
    revenue_matic = serializers.CharField()
    licenses_sold = serializers.IntegerField()


class InfringementMetricsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = InfringementStatusCountSerializer(many=True)


class CreatorDashboardSerializer(serializers.Serializer):
    date_range = DateRangeSerializer()
    generated_at = serializers.DateTimeField()

    total_works = serializers.IntegerField()
    registered_works = serializers.IntegerField()
    total_licenses_sold = serializers.IntegerField()

    revenue = RevenueTotalsSerializer()

    infringement = InfringementMetricsSerializer()
    works_by_category = WorksCategoryBreakdownSerializer(many=True)
    revenue_over_time = RevenueOverTimePointSerializer(many=True)


