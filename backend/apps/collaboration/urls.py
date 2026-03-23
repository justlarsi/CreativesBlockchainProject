from django.urls import path
from . import views

app_name = 'collaboration'

urlpatterns = [
    path('', views.CollaborationListView.as_view(), name='list'),
    path('<int:pk>/', views.CollaborationDetailView.as_view(), name='detail'),
    path('<int:pk>/approve/', views.ApproveCollaborationView.as_view(), name='approve'),
    path('<int:pk>/register-blockchain/prepare/', views.CollaborationRegisterPrepareView.as_view(), name='register-blockchain-prepare'),
    path('<int:pk>/register-blockchain/receipt/', views.CollaborationRegisterReceiptView.as_view(), name='register-blockchain-receipt'),
]
