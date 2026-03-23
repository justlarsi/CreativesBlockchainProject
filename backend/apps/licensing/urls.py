from django.urls import path
from . import views

app_name = 'licensing'

urlpatterns = [
    path('', views.LicenseListView.as_view(), name='list'),
    path('prepare/', views.LicensePrepareView.as_view(), name='prepare'),
    path('receipt/', views.LicenseReceiptView.as_view(), name='receipt'),
    path('<int:pk>/', views.LicenseDetailView.as_view(), name='detail'),
    path('<int:pk>/certificate/', views.LicenseCertificateDownloadView.as_view(), name='certificate'),
]
