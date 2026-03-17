from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = 'accounts'

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.UserProfileView.as_view(), name='profile'),
    path('wallets/', views.WalletListView.as_view(), name='wallet-list'),
    path('wallets/challenge/', views.WalletChallengeView.as_view(), name='wallet-challenge'),
    path('wallets/verify/', views.WalletVerifyView.as_view(), name='wallet-verify'),
    path('wallets/<int:wallet_id>/', views.WalletDisconnectView.as_view(), name='wallet-disconnect'),
    path('wallets/<int:wallet_id>/set-primary/', views.WalletSetPrimaryView.as_view(), name='wallet-set-primary'),
]
