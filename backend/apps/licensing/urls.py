from django.urls import path
from . import views

app_name = 'licensing'

urlpatterns = [
    path('', views.LicenseListView.as_view(), name='list'),
    path('purchase/', views.LicensePurchaseView.as_view(), name='purchase'),
    path('<int:pk>/', views.LicenseDetailView.as_view(), name='detail'),
]
