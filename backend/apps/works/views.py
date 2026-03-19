"""
Creative works management views
"""
from django.db import transaction
from django.conf import settings
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.audit_logs.models import AuditLog

from .models import CreativeWork
from .serializers import (
    BlockchainReceiptSubmissionSerializer,
    CreativeWorkMetadataCreateSerializer,
    CreativeWorkSerializer,
    CreativeWorkUploadSerializer,
)
from .services import validate_upload_or_raise
from .services_blockchain import (
    BlockchainPreparationError,
    prepare_registration_payload,
    set_registration_pending,
    tx_explorer_url,
)


class CreativeWorkListCreateView(generics.ListCreateAPIView):
    """List and create creative works"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CreativeWork.objects.filter(owner=self.request.user).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreativeWorkMetadataCreateSerializer
        return CreativeWorkSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work = serializer.save(owner=request.user, status=CreativeWork.Status.PENDING_UPLOAD)
        return Response(CreativeWorkSerializer(work).data, status=status.HTTP_201_CREATED)


class CreativeWorkDetailView(generics.RetrieveAPIView):
    """Get creative work details"""
    permission_classes = [IsAuthenticated]
    serializer_class = CreativeWorkSerializer

    def get_queryset(self):
        return CreativeWork.objects.filter(owner=self.request.user)


class CreativeWorkUploadView(generics.UpdateAPIView):
    """Upload binary content for an existing creative work metadata record"""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = CreativeWorkUploadSerializer

    def get_queryset(self):
        return CreativeWork.objects.filter(owner=self.request.user)

    def put(self, request, *args, **kwargs):
        work = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data['file']

        try:
            sanitized_name, mime_type = validate_upload_or_raise(work, uploaded_file)
        except ValidationError:
            work.status = CreativeWork.Status.VALIDATION_FAILED
            work.save(update_fields=['status', 'updated_at'])
            raise

        try:
            with transaction.atomic():
                work.file.save(sanitized_name, uploaded_file, save=False)
                work.original_filename = sanitized_name
                work.file_size = uploaded_file.size
                work.mime_type = mime_type
                work.status = CreativeWork.Status.UPLOADED
                work.save()

                AuditLog.objects.create(
                    user=request.user,
                    action='work_uploaded',
                    entity_type='creative_work',
                    entity_id=str(work.id),
                    metadata={
                        'mime_type': mime_type,
                        'file_size': uploaded_file.size,
                        'category': work.category,
                    },
                )

                # Dispatch hashing task after commit so the file is persisted first.
                from .tasks import hash_work_task
                transaction.on_commit(lambda: hash_work_task.delay(work.id))
        except Exception as exc:
            work.status = CreativeWork.Status.UPLOAD_FAILED
            work.save(update_fields=['status', 'updated_at'])
            raise ValidationError({'file': [f'Upload failed: {exc}']})

        return Response(CreativeWorkSerializer(work).data, status=status.HTTP_200_OK)


class RegisterBlockchainPrepareView(generics.GenericAPIView):
    """Prepare calldata for wallet signing/submission."""
    permission_classes = [IsAuthenticated]
    serializer_class = CreativeWorkSerializer

    def get_queryset(self):
        return CreativeWork.objects.filter(owner=self.request.user)

    def post(self, request, *args, **kwargs):
        work = self.get_object()
        try:
            payload = prepare_registration_payload(work)
        except BlockchainPreparationError as exc:
            raise ValidationError({'detail': str(exc)})

        return Response(payload, status=status.HTTP_200_OK)


class RegisterBlockchainReceiptView(generics.GenericAPIView):
    """Accept tx hash and enqueue asynchronous receipt verification."""

    permission_classes = [IsAuthenticated]
    serializer_class = BlockchainReceiptSubmissionSerializer

    def get_queryset(self):
        return CreativeWork.objects.filter(owner=self.request.user)

    def post(self, request, *args, **kwargs):
        work = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if work.status == CreativeWork.Status.REGISTERED:
            raise ValidationError({'detail': 'Work is already registered on-chain.'})

        tx_hash = serializer.validated_data['tx_hash']
        set_registration_pending(work, tx_hash)

        from .tasks import verify_work_registration_receipt_task

        transaction.on_commit(lambda: verify_work_registration_receipt_task.delay(work.id, tx_hash))

        return Response(
            {
                'status': CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING,
                'tx_hash': tx_hash,
                'explorer_url': tx_explorer_url(tx_hash),
                'message': 'Receipt verification queued.',
                'max_retries': settings.BLOCKCHAIN_RECEIPT_MAX_RETRIES,
            },
            status=status.HTTP_202_ACCEPTED,
        )
