"""
Account serializers for registration, profile management, and JWT customisation.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Wallet, WalletChallenge

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for new user registration."""

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name')

    def validate_email(self, value: str) -> str:
        normalised = value.lower().strip()
        if User.objects.filter(email=normalised).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return normalised

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def create(self, validated_data: dict) -> User:
        return User.objects.create_user(**validated_data)


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for reading and updating the authenticated user's profile."""

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'bio',
            'is_email_verified',
            'created_at',
            'date_joined',
        )
        read_only_fields = (
            'id',
            'email',
            'username',
            'is_email_verified',
            'created_at',
            'date_joined',
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default pair serializer to include the user object in the
    login response, so the frontend does not need a separate /me call on first load.
    """

    def validate(self, attrs: dict) -> dict:
        data = super().validate(attrs)
        data['user'] = UserProfileSerializer(self.user).data
        return data


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ('id', 'address', 'is_primary', 'created_at')
        read_only_fields = ('id', 'created_at')


class WalletChallengeRequestSerializer(serializers.Serializer):
    address = serializers.CharField(max_length=42)

    def validate_address(self, value: str) -> str:
        if not value.startswith('0x') or len(value) != 42:
            raise serializers.ValidationError('Wallet address must be a valid EVM address.')
        return value.lower()


class WalletChallengeSerializer(serializers.ModelSerializer):
    challenge_id = serializers.IntegerField(source='id')
    message = serializers.SerializerMethodField()

    class Meta:
        model = WalletChallenge
        fields = ('challenge_id', 'wallet_address', 'message', 'expires_at')

    def get_message(self, obj: WalletChallenge) -> str:
        return (
            'CreativeChain Wallet Verification\n'
            f'User ID: {obj.user_id}\n'
            f'Wallet: {obj.wallet_address}\n'
            f'Nonce: {obj.nonce}\n'
            'Chain ID: 80002'
        )


class WalletVerifySerializer(serializers.Serializer):
    challenge_id = serializers.IntegerField()
    signature = serializers.CharField()
    chain_id = serializers.IntegerField()


