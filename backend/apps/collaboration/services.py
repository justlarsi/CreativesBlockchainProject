from django.db import transaction
from django.utils import timezone

from apps.licensing.models import LicensePurchase

from .models import Collaboration, CollaborationMember, RevenueSplitRecord


def refresh_collaboration_status(collaboration: Collaboration) -> Collaboration:
    pending_exists = collaboration.members.exclude(user_id=collaboration.creator_id).exclude(
        approval_status=CollaborationMember.ApprovalStatus.APPROVED
    ).exists()
    target_status = Collaboration.Status.PENDING_APPROVAL if pending_exists else Collaboration.Status.APPROVED
    if collaboration.status != target_status:
        collaboration.status = target_status
        collaboration.save(update_fields=['status', 'updated_at'])
    return collaboration


@transaction.atomic
def approve_member(collaboration: Collaboration, user_id: int) -> CollaborationMember:
    member = collaboration.members.filter(user_id=user_id).first()
    if member is None:
        raise ValueError('You are not a member of this collaboration.')

    if member.approval_status != CollaborationMember.ApprovalStatus.APPROVED:
        member.approval_status = CollaborationMember.ApprovalStatus.APPROVED
        member.approved_at = timezone.now()
        member.save(update_fields=['approval_status', 'approved_at', 'updated_at'])

    refresh_collaboration_status(collaboration)
    return member


@transaction.atomic
def create_revenue_split_records_for_license(purchase: LicensePurchase) -> int:
    collaboration = getattr(purchase.work, 'collaboration', None)
    if not collaboration or collaboration.status != Collaboration.Status.REGISTERED:
        return 0

    created = 0
    tx_hash = purchase.tx_hash or ''
    for member in collaboration.members.all():
        amount_wei = (purchase.amount_wei * member.split_bps) // 10_000
        _, is_new = RevenueSplitRecord.objects.get_or_create(
            license_purchase=purchase,
            member=member,
            defaults={
                'collaboration': collaboration,
                'source_event': RevenueSplitRecord.SourceEvent.LICENSE_PURCHASE,
                'split_bps': member.split_bps,
                'amount_wei': amount_wei,
                'tx_hash': tx_hash,
            },
        )
        if is_new:
            created += 1

    return created

