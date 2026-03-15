"""
Account management views — registration, login, token refresh, logout, profile.
"""
from django.contrib.auth import get_user_model
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
    UserProfileSerializer,
)

User = get_user_model()


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
