"""
Collaboration management views
"""
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from apps.audit_logs.models import AuditLog

from .models import Collaboration, CollaborationMember, CollaborationMedia, CollaborationRequest
from .serializers import (
    CollaborationApproveSerializer,
    CollaborationCreateSerializer,
    CollaborationRequestCreateSerializer,
    CollaborationRequestSerializer,
    CollaborationReceiptSerializer,
    CollaborationSerializer,
    CollaborationMediaSerializer,
    CollaborationMediaUploadSerializer,
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


class PendingCollaborationRequestsView(generics.ListAPIView):
    """List and create marketplace collaboration requests."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CollaborationRequestCreateSerializer
        return CollaborationRequestSerializer

    def get_queryset(self):
        return (
            CollaborationRequest.objects
            .select_related('work', 'creator', 'requester', 'collaboration')
            .filter(creator=self.request.user, status=CollaborationRequest.Status.PENDING)
            .distinct()
            .order_by('-created_at')
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        collaboration_request = serializer.save()

        AuditLog.objects.create(
            user=request.user,
            action='collaboration_request_created',
            entity_type='collaboration_request',
            entity_id=str(collaboration_request.id),
            metadata={
                'work_id': collaboration_request.work_id,
                'creator_id': collaboration_request.creator_id,
                'proposed_split_bps': collaboration_request.proposed_split_bps,
            },
        )

        return Response(CollaborationRequestSerializer(collaboration_request).data, status=status.HTTP_201_CREATED)


class AcceptCollaborationRequestView(generics.GenericAPIView):
    """Accept a marketplace collaboration request and create a collaboration."""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        request_id = kwargs.get('pk')
        collaboration_request = get_object_or_404(
            CollaborationRequest.objects.select_related('work', 'creator', 'requester').prefetch_related('work__owner__wallets'),
            id=request_id,
        )

        if collaboration_request.creator_id != request.user.id:
            raise ValidationError({'detail': 'You do not own this collaboration request.'})
        if collaboration_request.status != CollaborationRequest.Status.PENDING:
            raise ValidationError({'detail': 'This collaboration request is no longer pending.'})

        if hasattr(collaboration_request.work, 'collaboration'):
            raise ValidationError({'detail': 'This work already has an active collaboration.'})

        creator_split_bps = 10000 - collaboration_request.proposed_split_bps
        if creator_split_bps <= 0:
            raise ValidationError({'detail': 'Proposed split must leave a positive share for the creator.'})

        with transaction.atomic():
            collaboration = Collaboration.objects.create(
                work=collaboration_request.work,
                creator=request.user,
                status=Collaboration.Status.PENDING_APPROVAL,
            )

            creator_wallet = request.user.wallets.filter(is_primary=True).first() or request.user.wallets.first()
            requester_wallet = collaboration_request.requester.wallets.filter(is_primary=True).first() or collaboration_request.requester.wallets.first()
            if creator_wallet is None or requester_wallet is None:
                raise ValidationError({'detail': 'Both creator and requester must have a linked wallet.'})

            CollaborationMember.objects.create(
                collaboration=collaboration,
                user=request.user,
                wallet_address=creator_wallet.address,
                split_bps=creator_split_bps,
                approval_status=CollaborationMember.ApprovalStatus.APPROVED,
                approved_at=timezone.now(),
            )
            CollaborationMember.objects.create(
                collaboration=collaboration,
                user=collaboration_request.requester,
                wallet_address=requester_wallet.address,
                split_bps=collaboration_request.proposed_split_bps,
                approval_status=CollaborationMember.ApprovalStatus.PENDING,
            )

            collaboration_request.status = CollaborationRequest.Status.ACCEPTED
            collaboration_request.collaboration = collaboration
            collaboration_request.responded_at = timezone.now()
            collaboration_request.save(update_fields=['status', 'collaboration', 'responded_at', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            action='collaboration_request_accepted',
            entity_type='collaboration_request',
            entity_id=str(collaboration_request.id),
            metadata={
                'collaboration_id': collaboration.id,
                'requester_id': collaboration_request.requester_id,
            },
        )

        return Response(CollaborationSerializer(collaboration).data, status=status.HTTP_200_OK)


class RejectCollaborationRequestView(generics.GenericAPIView):
    """Reject a marketplace collaboration request."""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        request_id = kwargs.get('pk')
        collaboration_request = get_object_or_404(
            CollaborationRequest.objects.select_related('work', 'creator', 'requester'),
            id=request_id,
        )

        if collaboration_request.creator_id != request.user.id:
            raise ValidationError({'detail': 'You do not own this collaboration request.'})
        if collaboration_request.status != CollaborationRequest.Status.PENDING:
            raise ValidationError({'detail': 'This collaboration request is no longer pending.'})

        collaboration_request.status = CollaborationRequest.Status.REJECTED
        collaboration_request.responded_at = timezone.now()
        collaboration_request.save(update_fields=['status', 'responded_at', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            action='collaboration_request_rejected',
            entity_type='collaboration_request',
            entity_id=str(collaboration_request.id),
            metadata={'requester_id': collaboration_request.requester_id, 'work_id': collaboration_request.work_id},
        )

        return Response(
            {'status': 'rejected', 'request_id': collaboration_request.id},
            status=status.HTTP_200_OK,
        )


class CollaborationMediaUploadView(generics.GenericAPIView):
    """Upload media to a collaboration"""
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborationMediaUploadSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        collaboration_id = kwargs.get('pk')
        collaboration = get_object_or_404(
            Collaboration.objects.prefetch_related('members'),
            id=collaboration_id,
            members__user=request.user,
            members__approval_status=CollaborationMember.ApprovalStatus.APPROVED,
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_obj = request.FILES.get('file')
        if not file_obj:
            raise ValidationError({'file': 'File is required.'})

        # Create media record
        media = CollaborationMedia.objects.create(
            collaboration=collaboration,
            user=request.user,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            mime_type=file_obj.content_type,
            description=serializer.validated_data.get('description', ''),
        )

        # Update collaboration media count
        collaboration.media_count = collaboration.media.count()
        collaboration.save(update_fields=['media_count', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            action='collaboration_media_uploaded',
            entity_type='collaboration',
            entity_id=str(collaboration.id),
            metadata={
                'media_id': media.id,
                'filename': media.filename,
                'file_size': media.file_size,
            },
        )

        return Response(
            CollaborationMediaSerializer(media).data,
            status=status.HTTP_201_CREATED,
        )


class CollaborationMediaListView(generics.ListAPIView):
    """List media files for a collaboration"""
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborationMediaSerializer

    def get_queryset(self):
        collaboration_id = self.kwargs.get('pk')
        return (
            CollaborationMedia.objects
            .select_related('user')
            .filter(
                collaboration_id=collaboration_id,
                collaboration__members__user=self.request.user,
            )
            .order_by('-created_at')
        )
