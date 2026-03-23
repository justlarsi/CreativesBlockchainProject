from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Wallet
from apps.works.models import CreativeWork

from .models import Collaboration, CollaborationMember

User = get_user_model()
TOTAL_BPS = 10_000


class CollaborationMemberInputSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False, min_value=1)
    email = serializers.EmailField(required=False)
    wallet_address = serializers.RegexField(
        regex=r'^0x[a-fA-F0-9]{40}$',
        error_messages={'invalid': 'wallet_address must be a 0x-prefixed 20-byte address.'},
    )
    split_bps = serializers.IntegerField(min_value=1, max_value=TOTAL_BPS)

    def validate(self, attrs):
        user_id = attrs.get('user_id')
        email = attrs.get('email')
        if bool(user_id) == bool(email):
            raise serializers.ValidationError('Provide exactly one identity field: user_id or email.')
        return attrs


class CollaborationMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = CollaborationMember
        fields = [
            'id',
            'user_id',
            'username',
            'email',
            'wallet_address',
            'split_bps',
            'approval_status',
            'approved_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class CollaborationSerializer(serializers.ModelSerializer):
    members = CollaborationMemberSerializer(many=True, read_only=True)
    approvals_required = serializers.SerializerMethodField()
    approvals_received = serializers.SerializerMethodField()

    class Meta:
        model = Collaboration
        fields = [
            'id',
            'work_id',
            'creator_id',
            'status',
            'blockchain_tx_hash',
            'blockchain_block_number',
            'blockchain_registered_at',
            'blockchain_error_message',
            'approvals_required',
            'approvals_received',
            'members',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_approvals_required(self, obj: Collaboration) -> int:
        return obj.members.exclude(user_id=obj.creator_id).count()

    def get_approvals_received(self, obj: Collaboration) -> int:
        return obj.members.exclude(user_id=obj.creator_id).filter(
            approval_status=CollaborationMember.ApprovalStatus.APPROVED
        ).count()


class CollaborationCreateSerializer(serializers.Serializer):
    work_id = serializers.IntegerField(min_value=1)
    members = CollaborationMemberInputSerializer(many=True, allow_empty=False)

    def _resolve_user(self, item: dict) -> User:
        user_id = item.get('user_id')
        email = item.get('email')
        if user_id:
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError(f'User id {user_id} does not exist.') from exc

        try:
            return User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError(f'User with email {email} does not exist.') from exc

    def _validate_wallet_ownership(self, user: User, wallet_address: str) -> None:
        owns_wallet = Wallet.objects.filter(user=user, address__iexact=wallet_address).exists()
        if not owns_wallet:
            raise serializers.ValidationError(
                f'Wallet {wallet_address} is not linked to user {user.id}.',
            )

    def validate(self, attrs):
        request = self.context['request']
        work_id = attrs['work_id']
        members_payload = attrs['members']

        try:
            work = CreativeWork.objects.get(id=work_id)
        except CreativeWork.DoesNotExist as exc:
            raise serializers.ValidationError({'work_id': 'Creative work does not exist.'}) from exc

        if work.owner_id != request.user.id:
            raise serializers.ValidationError({'work_id': 'Only the work owner can create a collaboration.'})

        if hasattr(work, 'collaboration'):
            raise serializers.ValidationError({'work_id': 'This work already has a collaboration.'})

        resolved_members = []
        seen_users = set()
        seen_wallets = set()
        total_bps = 0
        includes_creator = False

        for item in members_payload:
            user = self._resolve_user(item)
            wallet_address = item['wallet_address']
            self._validate_wallet_ownership(user, wallet_address)

            key_user = user.id
            key_wallet = wallet_address.lower()
            if key_user in seen_users:
                raise serializers.ValidationError('Duplicate collaborator user is not allowed.')
            if key_wallet in seen_wallets:
                raise serializers.ValidationError('Duplicate wallet_address is not allowed.')

            seen_users.add(key_user)
            seen_wallets.add(key_wallet)
            total_bps += item['split_bps']
            includes_creator = includes_creator or user.id == request.user.id

            resolved_members.append(
                {
                    'user': user,
                    'wallet_address': wallet_address,
                    'split_bps': item['split_bps'],
                }
            )

        if not includes_creator:
            raise serializers.ValidationError('Creator must be included in members and is auto-approved.')

        if total_bps != TOTAL_BPS:
            raise serializers.ValidationError(f'Split total must equal {TOTAL_BPS} bps (100%).')

        attrs['work'] = work
        attrs['resolved_members'] = resolved_members
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context['request']
        work = validated_data['work']

        collaboration = Collaboration.objects.create(
            work=work,
            creator=request.user,
            status=Collaboration.Status.PENDING_APPROVAL,
        )

        for member_data in validated_data['resolved_members']:
            is_creator = member_data['user'].id == request.user.id
            CollaborationMember.objects.create(
                collaboration=collaboration,
                user=member_data['user'],
                wallet_address=member_data['wallet_address'],
                split_bps=member_data['split_bps'],
                approval_status=(
                    CollaborationMember.ApprovalStatus.APPROVED
                    if is_creator
                    else CollaborationMember.ApprovalStatus.PENDING
                ),
                approved_at=timezone.now() if is_creator else None,
            )

        if not collaboration.members.exclude(user_id=request.user.id).exclude(
            approval_status=CollaborationMember.ApprovalStatus.APPROVED
        ).exists():
            collaboration.status = Collaboration.Status.APPROVED
            collaboration.save(update_fields=['status', 'updated_at'])

        return collaboration


class CollaborationApproveSerializer(serializers.Serializer):
    approved = serializers.BooleanField(default=True)

    def validate_approved(self, value):
        if not value:
            raise serializers.ValidationError('Only explicit approvals are supported in Step 12.')
        return value


class CollaborationReceiptSerializer(serializers.Serializer):
    tx_hash = serializers.RegexField(
        regex=r'^0x[a-fA-F0-9]{64}$',
        error_messages={'invalid': 'tx_hash must be a 0x-prefixed 32-byte transaction hash.'},
    )

