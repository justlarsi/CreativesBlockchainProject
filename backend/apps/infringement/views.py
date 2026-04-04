"""Infringement detection and alert lifecycle views."""
from django.conf import settings
from django.db.models import Q
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
    InfringementPublicScanSerializer,
    InfringementLegacyCleanupSerializer,
    InfringementAlertStatusUpdateSerializer,
    InfringementScanTriggerSerializer,
)
from .services import discover_public_candidates_for_work, run_simulated_scan_for_work


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
            CreativeWork.objects.prefetch_related('content_hashes'),
            id=serializer.validated_data['work_id'],
            owner=request.user,
        )
        candidates = serializer.validated_data['candidates']

        # Manual trigger executes synchronously so users instantly see scan results.
        sync_result = run_simulated_scan_for_work(work, candidates)

        AuditLog.objects.create(
            user=request.user,
            action='infringement_scan_triggered',
            entity_type='creative_work',
            entity_id=str(work.id),
            metadata={
                'candidates_count': len(candidates),
                'matched_candidates': sync_result['matched_candidates'],
                'created_alert_ids': sync_result['created_alert_ids'],
            },
        )

        return Response(
            {
                'status': 'processed',
                'work_id': work.id,
                'candidates_count': len(candidates),
                'matched_candidates': sync_result['matched_candidates'],
                'created_alert_ids': sync_result['created_alert_ids'],
            },
            status=status.HTTP_202_ACCEPTED,
        )


class InfringementPublicScanView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InfringementPublicScanSerializer

    def post(self, request, *args, **kwargs):
        if not settings.INFRINGEMENT_PUBLIC_SCAN_ENABLED:
            return Response(
                {'detail': 'Public scan is disabled by configuration.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work = get_object_or_404(
            CreativeWork.objects.prefetch_related('content_hashes'),
            id=serializer.validated_data['work_id'],
            owner=request.user,
        )
        requested_platforms = serializer.validated_data.get('platforms')

        discovered_candidates, used_platforms = discover_public_candidates_for_work(
            work,
            platforms=requested_platforms,
            max_results=settings.INFRINGEMENT_PUBLIC_SCAN_MAX_RESULTS,
        )
        scan_result = run_simulated_scan_for_work(work, discovered_candidates)

        AuditLog.objects.create(
            user=request.user,
            action='infringement_public_scan_triggered',
            entity_type='creative_work',
            entity_id=str(work.id),
            metadata={
                'platforms': used_platforms,
                'discovered_candidates': len(discovered_candidates),
                'matched_candidates': scan_result['matched_candidates'],
                'created_alert_ids': scan_result['created_alert_ids'],
            },
        )

        return Response(
            {
                'status': 'processed',
                'work_id': work.id,
                'platforms': used_platforms,
                'scanned_candidates': len(discovered_candidates),
                'matched_candidates': scan_result['matched_candidates'],
                'created_alert_ids': scan_result['created_alert_ids'],
            },
            status=status.HTTP_202_ACCEPTED,
        )


class InfringementLegacyCleanupView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InfringementLegacyCleanupSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data['mode']

        legacy_qs = InfringementAlert.objects.filter(
            creator=request.user,
        ).filter(
            Q(source_platform='mock-platform.example') | Q(source_url__icontains='mock-platform.example')
        )

        total_legacy = legacy_qs.count()
        now = timezone.now()

        hidden_count = 0
        deleted_count = 0
        deleted_active_count = 0
        if mode == 'delete':
            active_qs = InfringementAlert.objects.filter(
                creator=request.user,
                status__in=[InfringementAlert.Status.PENDING, InfringementAlert.Status.CONFIRMED],
            )
            active_total = active_qs.count()
            deleted_count, _ = InfringementAlert.objects.filter(
                creator=request.user,
            ).filter(
                Q(source_platform='mock-platform.example')
                | Q(source_url__icontains='mock-platform.example')
                | Q(status__in=[InfringementAlert.Status.PENDING, InfringementAlert.Status.CONFIRMED])
            ).delete()
            deleted_active_count = active_total
            action = 'infringement_legacy_alerts_deleted'
        else:
            hidden_count = legacy_qs.exclude(
                status__in=[InfringementAlert.Status.FALSE_POSITIVE, InfringementAlert.Status.RESOLVED]
            ).update(
                status=InfringementAlert.Status.FALSE_POSITIVE,
                resolved_at=now,
                resolution_notes='Legacy simulated alert cleanup',
                updated_at=now,
            )
            action = 'infringement_legacy_alerts_hidden'

        AuditLog.objects.create(
            user=request.user,
            action=action,
            entity_type='infringement_alert',
            entity_id='bulk',
            metadata={
                'mode': mode,
                'total_legacy': total_legacy,
                'hidden_count': hidden_count,
                'deleted_count': deleted_count,
                'deleted_active_count': deleted_active_count,
            },
        )

        return Response(
            {
                'status': 'ok',
                'mode': mode,
                'total_legacy': total_legacy,
                'hidden_count': hidden_count,
                'deleted_count': deleted_count,
                'deleted_active_count': deleted_active_count,
            },
            status=status.HTTP_200_OK,
        )

