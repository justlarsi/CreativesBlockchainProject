"""Infringement detection and alert lifecycle views."""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit_logs.models import AuditLog
from apps.works.models import CreativeWork

from .models import InfringementAlert
from .serializers import (
    InfringementAlertSerializer,
    InfringementAlertStatusUpdateSerializer,
    InfringementScanTriggerSerializer,
)
from .tasks import scan_work_for_infringement_task


class InfringementAlertListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InfringementAlertSerializer

    def get_queryset(self):
        return (
            InfringementAlert.objects
            .select_related('work')
            .filter(creator=self.request.user)
            .order_by('-last_detected_at', '-created_at')
        )


class InfringementAlertDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            InfringementAlert.objects
            .select_related('work')
            .filter(creator=self.request.user)
        )

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return InfringementAlertStatusUpdateSerializer
        return InfringementAlertSerializer

    def perform_update(self, serializer):
        alert: InfringementAlert = self.get_object()
        previous_status = alert.status
        updated_alert: InfringementAlert = serializer.save()

        if updated_alert.status in {InfringementAlert.Status.FALSE_POSITIVE, InfringementAlert.Status.RESOLVED}:
            updated_alert.resolved_at = timezone.now()
        else:
            updated_alert.resolved_at = None
        updated_alert.save(update_fields=['resolved_at', 'updated_at'])

        AuditLog.objects.create(
            user=self.request.user,
            action='infringement_alert_status_updated',
            entity_type='infringement_alert',
            entity_id=str(updated_alert.id),
            metadata={
                'from_status': previous_status,
                'to_status': updated_alert.status,
            },
        )


class InfringementScanTriggerView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InfringementScanTriggerSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work = get_object_or_404(
            CreativeWork.objects.only('id', 'owner_id'),
            id=serializer.validated_data['work_id'],
            owner=request.user,
        )
        candidates = serializer.validated_data['candidates']

        scan_work_for_infringement_task.delay(work.id, candidates)
        AuditLog.objects.create(
            user=request.user,
            action='infringement_scan_triggered',
            entity_type='creative_work',
            entity_id=str(work.id),
            metadata={'candidates_count': len(candidates)},
        )

        return Response(
            {
                'status': 'queued',
                'work_id': work.id,
                'candidates_count': len(candidates),
            },
            status=status.HTTP_202_ACCEPTED,
        )

