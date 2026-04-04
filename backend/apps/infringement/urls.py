from django.urls import path
from . import views

app_name = 'infringement'

urlpatterns = [
    path('alerts/', views.InfringementAlertListView.as_view(), name='alerts'),
    path('alerts/<int:pk>/', views.InfringementAlertDetailView.as_view(), name='alert-detail'),
    path('alerts/cleanup-legacy/', views.InfringementLegacyCleanupView.as_view(), name='alerts-cleanup-legacy'),
    path('scan/', views.InfringementScanTriggerView.as_view(), name='scan-trigger'),
    path('scan/public/', views.InfringementPublicScanView.as_view(), name='scan-public'),
]
