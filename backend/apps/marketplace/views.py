"""
Marketplace views
"""
import hashlib
from decimal import Decimal, InvalidOperation

from django.core.cache import cache
from django.db.models import Q, Prefetch
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.works.models import CreativeWork

from .models import MarketplaceListing
from .pagination import MarketplaceCursorPagination
from .serializers import MarketplaceWorkDetailSerializer, MarketplaceWorkListSerializer


class MarketplaceListView(generics.ListAPIView):
    """Browse marketplace - shows all registered works"""
    CACHE_TTL_SECONDS = 60

    permission_classes = [AllowAny]
    serializer_class = MarketplaceWorkListSerializer
    pagination_class = MarketplaceCursorPagination

    def _build_cache_key(self) -> str:
        # Cache key must include the exact request path + query string.
        digest = hashlib.sha256(self.request.get_full_path().encode('utf-8')).hexdigest()
        return f'marketplace:list:{digest}'

    def list(self, request, *args, **kwargs):
        cache_key = self._build_cache_key()
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return Response(cached_payload)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=self.CACHE_TTL_SECONDS)
        return response

    def get_queryset(self):
        # Prefetch optional marketplace listing (LEFT JOIN)
        listing_prefetch = Prefetch(
            'marketplace_listing',
            MarketplaceListing.objects.all()
        )

        queryset = (
            CreativeWork.objects
            .filter(status=CreativeWork.Status.REGISTERED)
            .select_related('owner')
            .prefetch_related('owner__wallets', listing_prefetch)
        )

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        # Price filters require the marketplace listing to exist
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        license_type = self.request.query_params.get('license_type')

        if min_price not in (None, '') or max_price not in (None, '') or license_type:
            # Only apply filters if listing exists for these fields
            queryset = queryset.filter(marketplace_listing__isnull=False)
            
            if license_type:
                queryset = queryset.filter(marketplace_listing__license_type=license_type)
            
            if min_price not in (None, ''):
                queryset = queryset.filter(
                    marketplace_listing__price_amount__gte=self._parse_decimal(min_price, 'min_price')
                )
            
            if max_price not in (None, ''):
                queryset = queryset.filter(
                    marketplace_listing__price_amount__lte=self._parse_decimal(max_price, 'max_price')
                )

        return queryset

    @staticmethod
    def _parse_decimal(raw_value: str, field_name: str) -> Decimal:
        try:
            return Decimal(raw_value)
        except (InvalidOperation, TypeError):
            raise ValidationError({field_name: 'Must be a valid decimal number.'})


class MarketplaceWorkDetailView(generics.RetrieveAPIView):
    """Get marketplace work details"""
    permission_classes = [AllowAny]
    serializer_class = MarketplaceWorkDetailSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        # Prefetch optional marketplace listing (LEFT JOIN)
        listing_prefetch = Prefetch(
            'marketplace_listing',
            MarketplaceListing.objects.all()
        )

        return (
            CreativeWork.objects
            .filter(status=CreativeWork.Status.REGISTERED)
            .select_related('owner')
            .prefetch_related('owner__wallets', listing_prefetch)
        )
