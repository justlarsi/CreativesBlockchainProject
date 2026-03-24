from django.urls import path

from .views import CreatorDashboardView

app_name = 'analytics'

urlpatterns = [
    path('dashboard/', CreatorDashboardView.as_view(), name='dashboard'),
]

