from django.urls import path
from . import views

app_name = 'legal'

urlpatterns = [
    path('documents/', views.LegalDocumentListView.as_view(), name='documents'),
    path('documents/generate/', views.GenerateLegalDocumentView.as_view(), name='generate'),
    path('documents/<int:pk>/download/', views.DownloadLegalDocumentView.as_view(), name='download'),
]
