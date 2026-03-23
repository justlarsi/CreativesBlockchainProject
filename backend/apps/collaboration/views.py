"""
Collaboration management views
"""
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.audit_logs.models import AuditLog

from .models import Collaboration, CollaborationMember
from .serializers import (
    CollaborationApproveSerializer,
    CollaborationCreateSerializer,
    CollaborationReceiptSerializer,
    CollaborationSerializer,
)
from .services import approve_member
from .services_blockchain import (
    CollaborationPreparationError,
    prepare_collaboration_payload,
    set_registration_pending,
    tx_explorer_url,
)


class CollaborationListView(generics.ListCreateAPIView):
    """List and create collaborations"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Collaboration.objects
            .select_related('work', 'creator')
            .prefetch_related('members', 'members__user')
            .filter(members__user=self.request.user)
            .distinct()
            .order_by('-created_at')
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CollaborationCreateSerializer
        return CollaborationSerializer

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        collaboration = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action='collaboration_created',
            entity_type='collaboration',
            entity_id=str(collaboration.id),
            metadata={'work_id': collaboration.work_id, 'member_count': collaboration.members.count()},
        )
        return Response(CollaborationSerializer(collaboration).data, status=status.HTTP_201_CREATED)


class CollaborationDetailView(generics.RetrieveAPIView):
    """Get collaboration details"""
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborationSerializer

    def get_queryset(self):
        return (
            Collaboration.objects
            .select_related('work', 'creator')
            .prefetch_related('members', 'members__user')
            .filter(members__user=self.request.user)
            .distinct()
        )


class ApproveCollaborationView(generics.UpdateAPIView):
    """Approve collaboration"""
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborationApproveSerializer

    def get_queryset(self):
        return Collaboration.objects.prefetch_related('members').filter(members__user=self.request.user).distinct()

    def patch(self, request, *args, **kwargs):
        collaboration = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            member = approve_member(collaboration, request.user.id)
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})

        if member.user_id == collaboration.creator_id and member.approval_status == CollaborationMember.ApprovalStatus.APPROVED:
            return Response(
                {'detail': 'Creator is auto-approved at creation.'},
                status=status.HTTP_200_OK,
            )

        AuditLog.objects.create(
            user=request.user,
            action='collaboration_member_approved',
            entity_type='collaboration',
            entity_id=str(collaboration.id),
            metadata={'member_user_id': request.user.id},
        )
        collaboration.refresh_from_db()
        return Response(CollaborationSerializer(collaboration).data, status=status.HTTP_200_OK)


class CollaborationRegisterPrepareView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        collaboration = get_object_or_404(
            Collaboration.objects.prefetch_related('members'),
            id=kwargs['pk'],
            creator=request.user,
        )

        try:
            payload = prepare_collaboration_payload(collaboration)
        except CollaborationPreparationError as exc:
            raise ValidationError({'detail': str(exc)})

        return Response(payload, status=status.HTTP_200_OK)


class CollaborationRegisterReceiptView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborationReceiptSerializer

    def post(self, request, *args, **kwargs):
        collaboration = get_object_or_404(Collaboration, id=kwargs['pk'], creator=request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if collaboration.status == Collaboration.Status.REGISTERED:
            raise ValidationError({'detail': 'Collaboration is already registered on-chain.'})

        tx_hash = serializer.validated_data['tx_hash']
        set_registration_pending(collaboration, tx_hash)

        from .tasks import verify_collaboration_receipt_task

        verify_collaboration_receipt_task.delay(collaboration.id, tx_hash)

        return Response(
            {
                'status': Collaboration.Status.BLOCKCHAIN_REGISTRATION_PENDING,
                'tx_hash': tx_hash,
                'explorer_url': tx_explorer_url(tx_hash),
                'message': 'Receipt verification queued.',
                'max_retries': settings.BLOCKCHAIN_RECEIPT_MAX_RETRIES,
            },
            status=status.HTTP_202_ACCEPTED,
        )
