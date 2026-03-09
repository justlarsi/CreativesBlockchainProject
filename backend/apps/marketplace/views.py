"""
Marketplace views
"""
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


class MarketplaceListView(generics.ListAPIView):
    """Browse marketplace"""
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        # TODO: Implement marketplace listing
        return Response({"message": "Marketplace endpoint - to be implemented"}, 
                       status=status.HTTP_501_NOT_IMPLEMENTED)


class MarketplaceWorkDetailView(generics.RetrieveAPIView):
    """Get marketplace work details"""
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        # TODO: Implement marketplace work detail
        return Response({"message": "Marketplace work detail endpoint - to be implemented"}, 
                       status=status.HTTP_501_NOT_IMPLEMENTED)
