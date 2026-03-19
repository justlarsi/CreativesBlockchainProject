from django.urls import path
from . import views

app_name = 'works'

urlpatterns = [
    path('', views.CreativeWorkListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', views.CreativeWorkDetailView.as_view(), name='detail'),
    path('<int:pk>/upload/', views.CreativeWorkUploadView.as_view(), name='upload'),
    path(
        '<int:pk>/register-blockchain/prepare/',
        views.RegisterBlockchainPrepareView.as_view(),
        name='register-blockchain-prepare',
    ),
    path(
        '<int:pk>/register-blockchain/receipt/',
        views.RegisterBlockchainReceiptView.as_view(),
        name='register-blockchain-receipt',
    ),
]
