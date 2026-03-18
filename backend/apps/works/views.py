"""
Creative works management views
"""
from django.db import transaction
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.audit_logs.models import AuditLog

from .models import CreativeWork
from .serializers import (
    CreativeWorkMetadataCreateSerializer,
    CreativeWorkSerializer,
    CreativeWorkUploadSerializer,
)
from .services import validate_upload_or_raise


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


class RegisterBlockchainView(generics.CreateAPIView):
    """Register work on blockchain"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        # TODO: Implement blockchain registration
        return Response({"message": "Blockchain registration endpoint - to be implemented"}, 
                       status=status.HTTP_501_NOT_IMPLEMENTED)
