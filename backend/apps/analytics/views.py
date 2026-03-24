from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import CreatorDashboardSerializer, DashboardQuerySerializer
from .services import build_creator_dashboard_metrics


class CreatorDashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DashboardQuerySerializer

    def get(self, request, *args, **kwargs):
        query_serializer = self.get_serializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        metrics_payload = build_creator_dashboard_metrics(
            user=request.user,
            start_date=query_serializer.validated_data.get('start_date'),
            end_date=query_serializer.validated_data.get('end_date'),
        )

        response_serializer = CreatorDashboardSerializer(metrics_payload)
        return Response(response_serializer.data)

