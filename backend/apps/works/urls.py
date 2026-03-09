from django.urls import path
from . import views

app_name = 'works'

urlpatterns = [
    path('', views.CreativeWorkListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', views.CreativeWorkDetailView.as_view(), name='detail'),
    path('<int:pk>/register-blockchain/', views.RegisterBlockchainView.as_view(), name='register-blockchain'),
]
