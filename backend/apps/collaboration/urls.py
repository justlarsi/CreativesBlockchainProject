from django.urls import path
from . import views

app_name = 'collaboration'

urlpatterns = [
    path('', views.CollaborationListView.as_view(), name='list'),
    path('requests/', views.PendingCollaborationRequestsView.as_view(), name='pending-requests'),
    path('<int:pk>/', views.CollaborationDetailView.as_view(), name='detail'),
    path('<int:pk>/approve/', views.ApproveCollaborationView.as_view(), name='approve'),
    path('requests/<int:pk>/accept/', views.AcceptCollaborationRequestView.as_view(), name='accept-request'),
    path('requests/<int:pk>/reject/', views.RejectCollaborationRequestView.as_view(), name='reject-request'),
    path('<int:pk>/media/', views.CollaborationMediaListView.as_view(), name='media-list'),
    path('<int:pk>/media/upload/', views.CollaborationMediaUploadView.as_view(), name='media-upload'),
    path('<int:pk>/register-blockchain/prepare/', views.CollaborationRegisterPrepareView.as_view(), name='register-blockchain-prepare'),
    path('<int:pk>/register-blockchain/receipt/', views.CollaborationRegisterReceiptView.as_view(), name='register-blockchain-receipt'),
]
