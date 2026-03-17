"""
Account management views — registration, login, token refresh, logout, profile.
"""
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from eth_account import Account
from eth_account.messages import encode_defunct
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    WalletChallengeRequestSerializer,
    WalletChallengeSerializer,
    WalletSerializer,
    WalletVerifySerializer,
    UserProfileSerializer,
)
from .models import Wallet, WalletChallenge

User = get_user_model()
AMOY_CHAIN_ID = 80002
WALLET_CHALLENGE_TTL_MINUTES = 10


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/

    Creates a new user account and returns JWT tokens immediately.
    Email verification is deferred to a later step.
    """

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'user': UserProfileSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class CustomLoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/

    Returns access + refresh tokens alongside the user profile object so the
    frontend can bootstrap state in a single request.
    """

    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Blacklists the supplied refresh token (server-side invalidation).
    Body: { "refresh": "<refresh_token>" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs) -> Response:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_205_RESET_CONTENT)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/v1/auth/me/  — return authenticated user's profile.
    PATCH /api/v1/auth/me/ — update allowed profile fields (first_name, last_name, bio).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self) -> User:
        return self.request.user


class WalletListView(generics.ListAPIView):
    """GET /api/v1/auth/wallets/"""

    permission_classes = [IsAuthenticated]
    serializer_class = WalletSerializer

    def get_queryset(self):
        return Wallet.objects.filter(user=self.request.user).order_by('-is_primary', '-created_at')


class WalletChallengeView(APIView):
    """POST /api/v1/auth/wallets/challenge/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs) -> Response:
        serializer = WalletChallengeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = serializer.validated_data['address']
        challenge = WalletChallenge.objects.create(
            user=request.user,
            wallet_address=address,
            nonce=secrets.token_hex(16),
            expires_at=timezone.now() + timedelta(minutes=WALLET_CHALLENGE_TTL_MINUTES),
        )
        return Response(WalletChallengeSerializer(challenge).data, status=status.HTTP_201_CREATED)


class WalletVerifyView(APIView):
    """POST /api/v1/auth/wallets/verify/"""

    permission_classes = [IsAuthenticated]

    @staticmethod
    def _build_message(challenge: WalletChallenge) -> str:
        return (
            'CreativeChain Wallet Verification\n'
            f'User ID: {challenge.user_id}\n'
            f'Wallet: {challenge.wallet_address}\n'
            f'Nonce: {challenge.nonce}\n'
            f'Chain ID: {AMOY_CHAIN_ID}'
        )

    def post(self, request, *args, **kwargs) -> Response:
        serializer = WalletVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data['chain_id'] != AMOY_CHAIN_ID:
            return Response(
                {'detail': 'Wallet must be connected to Polygon Amoy (chainId 80002).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            challenge = WalletChallenge.objects.get(
                id=serializer.validated_data['challenge_id'],
                user=request.user,
            )
        except WalletChallenge.DoesNotExist:
            return Response({'detail': 'Challenge not found.'}, status=status.HTTP_404_NOT_FOUND)

        if challenge.is_used:
            return Response({'detail': 'Challenge already used.'}, status=status.HTTP_400_BAD_REQUEST)
        if challenge.expires_at < timezone.now():
            return Response({'detail': 'Challenge expired.'}, status=status.HTTP_400_BAD_REQUEST)

        message = self._build_message(challenge)
        try:
            recovered = Account.recover_message(
                encode_defunct(text=message),
                signature=serializer.validated_data['signature'],
            )
        except Exception:
            return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

        if recovered.lower() != challenge.wallet_address.lower():
            return Response({'detail': 'Signature does not match wallet address.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            challenge.used_at = timezone.now()
            challenge.save(update_fields=['used_at'])
            wallet, _created = Wallet.objects.get_or_create(
                user=request.user,
                address=challenge.wallet_address.lower(),
                defaults={'is_primary': not Wallet.objects.filter(user=request.user, is_primary=True).exists()},
            )

        return Response(WalletSerializer(wallet).data, status=status.HTTP_200_OK)


class WalletDisconnectView(APIView):
    """DELETE /api/v1/auth/wallets/<id>/"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, wallet_id: int, *args, **kwargs) -> Response:
        try:
            wallet = Wallet.objects.get(id=wallet_id, user=request.user)
        except Wallet.DoesNotExist:
            return Response({'detail': 'Wallet not found.'}, status=status.HTTP_404_NOT_FOUND)

        was_primary = wallet.is_primary
        wallet.delete()

        if was_primary:
            replacement = Wallet.objects.filter(user=request.user).order_by('created_at').first()
            if replacement:
                replacement.is_primary = True
                replacement.save(update_fields=['is_primary'])

        return Response(status=status.HTTP_204_NO_CONTENT)


class WalletSetPrimaryView(APIView):
    """POST /api/v1/auth/wallets/<id>/set-primary/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, wallet_id: int, *args, **kwargs) -> Response:
        try:
            wallet = Wallet.objects.get(id=wallet_id, user=request.user)
        except Wallet.DoesNotExist:
            return Response({'detail': 'Wallet not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            Wallet.objects.filter(user=request.user, is_primary=True).update(is_primary=False)
            wallet.is_primary = True
            wallet.save(update_fields=['is_primary'])

        return Response(WalletSerializer(wallet).data, status=status.HTTP_200_OK)


