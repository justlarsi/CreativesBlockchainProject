from django.urls import path
from . import views

app_name = 'infringement'

urlpatterns = [
    path('alerts/', views.InfringementAlertListView.as_view(), name='alerts'),
    path('alerts/<int:pk>/', views.InfringementAlertDetailView.as_view(), name='alert-detail'),
]
