from django.urls import path
from . import views

app_name = 'marketplace'

urlpatterns = [
    path('', views.MarketplaceListView.as_view(), name='list'),
    path('works/<int:pk>/', views.MarketplaceWorkDetailView.as_view(), name='work-detail'),
]
