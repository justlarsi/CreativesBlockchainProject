"""Licensing Step 9 views."""
from io import BytesIO

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.marketplace.models import MarketplaceListing

from .models import LicensePurchase
from .serializers import (
    LicensePurchasePrepareSerializer,
    LicensePurchaseSerializer,
    LicenseReceiptSubmissionSerializer,
)
from .services_blockchain import (
    LicensePreparationError,
    creator_wallet_address_for_listing,
    prepare_purchase_payload,
    tx_explorer_url,
    validate_purchase_request,
)


def _build_certificate_bytes(purchase: LicensePurchase) -> tuple[bytes, str, str]:
    """Generate an on-demand certificate without persisting files."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        pdf.setTitle(f'CreativeChain License Certificate #{purchase.id}')
        pdf.setFont('Helvetica-Bold', 16)
        pdf.drawString(72, 790, 'CreativeChain License Certificate')
        pdf.setFont('Helvetica', 11)
        lines = [
            f'Certificate ID: {purchase.id}',
            f'Issued At (UTC): {now().isoformat()}',
            f'Work ID: {purchase.work_id}',
            f'Work Title: {purchase.work.title}',
            f'Buyer: {purchase.buyer.username}',
            f'Creator: {purchase.creator.username}',
            f'Template: {purchase.template}',
            f'Rights Scope: {purchase.rights_scope}',
            f'Amount (wei): {purchase.amount_wei}',
            f'Tx Hash: {purchase.tx_hash}',
            f'Block Number: {purchase.block_number}',
            f'Purchased At: {purchase.purchased_at.isoformat() if purchase.purchased_at else ""}',
        ]
        y = 760
        for line in lines:
            pdf.drawString(72, y, line)
            y -= 18
        pdf.showPage()
        pdf.save()
        return buffer.getvalue(), 'application/pdf', f'license-certificate-{purchase.id}.pdf'
    except Exception:
        # Keep certificate downloadable even when optional PDF dependency is unavailable.
        body = (
            'CreativeChain License Certificate\n'
            f'Certificate ID: {purchase.id}\n'
            f'Issued At (UTC): {now().isoformat()}\n'
            f'Work ID: {purchase.work_id}\n'
            f'Work Title: {purchase.work.title}\n'
            f'Buyer: {purchase.buyer.username}\n'
            f'Creator: {purchase.creator.username}\n'
            f'Template: {purchase.template}\n'
            f'Rights Scope: {purchase.rights_scope}\n'
            f'Amount (wei): {purchase.amount_wei}\n'
            f'Tx Hash: {purchase.tx_hash}\n'
            f'Block Number: {purchase.block_number}\n'
            f'Purchased At: {purchase.purchased_at.isoformat() if purchase.purchased_at else ""}\n'
        )
        return body.encode('utf-8'), 'text/plain; charset=utf-8', f'license-certificate-{purchase.id}.txt'


class LicenseListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LicensePurchaseSerializer

    def get_queryset(self):
        return (
            LicensePurchase.objects
            .select_related('work', 'buyer', 'creator')
            .filter(buyer=self.request.user)
            .order_by('-created_at')
        )


class LicensePrepareView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LicensePurchasePrepareSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work_id = serializer.validated_data['work_id']
        template = serializer.validated_data['template']
        rights_scope = serializer.validated_data['rights_scope']

        listing = get_object_or_404(
            MarketplaceListing.objects.select_related('work', 'work__owner').prefetch_related('work__owner__wallets'),
            work_id=work_id,
        )

        try:
            validate_purchase_request(listing, request.user.id, template, rights_scope)
            creator_wallet = creator_wallet_address_for_listing(listing)
        except LicensePreparationError as exc:
            raise ValidationError({'detail': str(exc)})

        purchase = LicensePurchase.objects.create(
            work=listing.work,
            buyer=request.user,
            creator=listing.work.owner,
            template=template,
            rights_scope=rights_scope,
            is_exclusive=(template == LicensePurchase.Template.EXCLUSIVE),
            amount_wei=listing.price_wei,
        )
        payload = prepare_purchase_payload(purchase, creator_wallet)

        return Response(
            {
                'purchase_id': purchase.id,
                'status': purchase.status,
                'to': payload['to'],
                'data': payload['data'],
                'value': payload['value'],
                'chain_id': 80002,
                'max_retries': settings.BLOCKCHAIN_RECEIPT_MAX_RETRIES,
            },
            status=status.HTTP_201_CREATED,
        )


class LicenseReceiptView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LicenseReceiptSubmissionSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        purchase = get_object_or_404(
            LicensePurchase.objects.select_related('work', 'buyer', 'creator'),
            id=serializer.validated_data['purchase_id'],
            buyer=request.user,
        )

        if purchase.status == LicensePurchase.Status.ACTIVE:
            existing_key = purchase.receipt_idempotency_key
            submitted_key = serializer.validated_data['idempotency_key']
            if existing_key and existing_key != submitted_key:
                raise ValidationError({'detail': 'This purchase is already bound to a different idempotency key.'})
            return Response(
                {
                    'status': purchase.status,
                    'purchase_id': purchase.id,
                    'tx_hash': purchase.tx_hash,
                    'explorer_url': tx_explorer_url(purchase.tx_hash) if purchase.tx_hash else '',
                    'message': 'License purchase already confirmed.',
                },
                status=status.HTTP_200_OK,
            )

        idempotency_key = serializer.validated_data['idempotency_key']
        if purchase.receipt_idempotency_key and purchase.receipt_idempotency_key != idempotency_key:
            raise ValidationError({'detail': 'This purchase is already bound to a different idempotency key.'})

        tx_hash = serializer.validated_data['tx_hash']
        if purchase.tx_hash and purchase.tx_hash != tx_hash:
            raise ValidationError({'detail': 'This purchase is already bound to a different transaction hash.'})

        if (
            purchase.receipt_idempotency_key == idempotency_key
            and purchase.tx_hash == tx_hash
            and purchase.status == LicensePurchase.Status.PENDING_CONFIRMATION
        ):
            return Response(
                {
                    'status': LicensePurchase.Status.PENDING_CONFIRMATION,
                    'purchase_id': purchase.id,
                    'tx_hash': tx_hash,
                    'explorer_url': tx_explorer_url(tx_hash),
                    'message': 'Receipt verification already queued for this idempotency key.',
                    'max_retries': settings.BLOCKCHAIN_RECEIPT_MAX_RETRIES,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        purchase.tx_hash = tx_hash
        purchase.receipt_idempotency_key = idempotency_key
        purchase.status = LicensePurchase.Status.PENDING_CONFIRMATION
        purchase.error_message = ''
        purchase.save(update_fields=['tx_hash', 'receipt_idempotency_key', 'status', 'error_message', 'updated_at'])

        from .tasks import verify_license_receipt_task

        verify_license_receipt_task.delay(purchase.id, tx_hash)

        return Response(
            {
                'status': LicensePurchase.Status.PENDING_CONFIRMATION,
                'purchase_id': purchase.id,
                'tx_hash': tx_hash,
                'explorer_url': tx_explorer_url(tx_hash),
                'message': 'Receipt verification queued.',
                'max_retries': settings.BLOCKCHAIN_RECEIPT_MAX_RETRIES,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class LicenseDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LicensePurchaseSerializer

    def get_queryset(self):
        return (
            LicensePurchase.objects
            .select_related('work', 'buyer', 'creator')
            .filter(buyer=self.request.user)
        )


class LicenseCertificateDownloadView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        purchase = get_object_or_404(
            LicensePurchase.objects.select_related('work', 'buyer', 'creator'),
            id=kwargs['pk'],
            buyer=request.user,
        )
        if purchase.status != LicensePurchase.Status.ACTIVE:
            raise ValidationError({'detail': 'License certificate is available only after confirmed purchase.'})

        content, content_type, filename = _build_certificate_bytes(purchase)
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
