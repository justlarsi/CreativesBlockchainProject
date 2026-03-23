"""Legal document generation and retrieval views (Step 11)."""
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit_logs.models import AuditLog
from apps.infringement.models import InfringementAlert
from apps.works.models import CreativeWork

from .models import LegalDocument
from .serializers import LegalDocumentGenerateSerializer, LegalDocumentSerializer
from .services import generate_legal_document


class LegalDocumentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LegalDocumentSerializer

    def get_queryset(self):
        queryset = LegalDocument.objects.select_related('work', 'alert').order_by('-created_at')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(creator=self.request.user)


class GenerateLegalDocumentView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LegalDocumentGenerateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work = get_object_or_404(
            CreativeWork.objects.prefetch_related('content_hashes'),
            id=serializer.validated_data['work_id'],
            owner=request.user,
        )

        alert = None
        alert_id = serializer.validated_data.get('alert_id')
        if alert_id is not None:
            alert = get_object_or_404(
                InfringementAlert.objects.select_related('work'),
                id=alert_id,
                creator=request.user,
            )
            if alert.work_id != work.id:
                raise ValidationError({'alert_id': 'Alert must belong to the specified work.'})

        document = generate_legal_document(
            creator=request.user,
            work=work,
            alert=alert,
            document_type=serializer.validated_data['document_type'],
        )

        AuditLog.objects.create(
            user=request.user,
            action='legal_document_generated',
            entity_type='legal_document',
            entity_id=str(document.id),
            metadata={'document_type': document.document_type, 'work_id': work.id, 'alert_id': alert.id if alert else None},
        )

        response_serializer = LegalDocumentSerializer(document, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class DownloadLegalDocumentView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def _get_document(self, request, pk: int) -> LegalDocument:
        queryset = LegalDocument.objects.select_related('creator')
        if request.user.is_staff:
            return get_object_or_404(queryset, id=pk)
        return get_object_or_404(queryset, id=pk, creator=request.user)

    def get(self, request, *args, **kwargs):
        document = self._get_document(request, kwargs['pk'])

        AuditLog.objects.create(
            user=request.user,
            action='legal_document_downloaded',
            entity_type='legal_document',
            entity_id=str(document.id),
            metadata={'document_type': document.document_type},
        )

        file_handle = document.file.open('rb')
        filename = document.file.name.rsplit('/', 1)[-1]
        return FileResponse(file_handle, as_attachment=True, filename=filename)
