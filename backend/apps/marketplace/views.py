"""
Marketplace views
"""
import hashlib
from decimal import Decimal, InvalidOperation

from django.core.cache import cache
from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.works.models import CreativeWork

from .models import MarketplaceListing
from .pagination import MarketplaceCursorPagination
from .serializers import MarketplaceListingDetailSerializer, MarketplaceListingListSerializer


class MarketplaceListView(generics.ListAPIView):
    """Browse marketplace"""
    CACHE_TTL_SECONDS = 60

    permission_classes = [AllowAny]
    serializer_class = MarketplaceListingListSerializer
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
        queryset = (
            MarketplaceListing.objects
            .select_related('work', 'work__owner')
            .prefetch_related('work__owner__wallets')
            .filter(
                is_listed=True,
                work__status=CreativeWork.Status.REGISTERED,
            )
        )

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(work__category=category)

        license_type = self.request.query_params.get('license_type')
        if license_type:
            queryset = queryset.filter(license_type=license_type)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(work__title__icontains=search) | Q(work__description__icontains=search)
            )

        min_price = self.request.query_params.get('min_price')
        if min_price not in (None, ''):
            queryset = queryset.filter(price_amount__gte=self._parse_decimal(min_price, 'min_price'))

        max_price = self.request.query_params.get('max_price')
        if max_price not in (None, ''):
            queryset = queryset.filter(price_amount__lte=self._parse_decimal(max_price, 'max_price'))

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
    serializer_class = MarketplaceListingDetailSerializer
    lookup_field = 'work_id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return (
            MarketplaceListing.objects
            .select_related('work', 'work__owner')
            .prefetch_related('work__owner__wallets')
            .filter(
                is_listed=True,
                work__status=CreativeWork.Status.REGISTERED,
            )
        )
