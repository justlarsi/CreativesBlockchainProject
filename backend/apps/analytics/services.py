from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_DOWN

from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from apps.infringement.models import InfringementAlert
from apps.licensing.models import LicensePurchase
from apps.works.models import CreativeWork

WEI_IN_MATIC = Decimal('1000000000000000000')
MATIC_DECIMAL_PLACES = Decimal('0.000001')


@dataclass(frozen=True)
class DateRangeFilter:
    start_at: datetime
    end_at: datetime


def _format_matic(wei_amount: int) -> str:
    matic_value = (Decimal(wei_amount) / WEI_IN_MATIC).quantize(MATIC_DECIMAL_PLACES, rounding=ROUND_DOWN)
    return format(matic_value, 'f')


def _build_datetime_range(start_date: date | None, end_date: date | None) -> DateRangeFilter | None:
    if not start_date or not end_date:
        return None

    timezone_info = timezone.get_current_timezone()
    start_at = timezone.make_aware(datetime.combine(start_date, time.min), timezone_info)
    end_at = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), timezone_info)
    return DateRangeFilter(start_at=start_at, end_at=end_at)


def _apply_range(queryset, field_name: str, date_range: DateRangeFilter | None):
    if not date_range:
        return queryset
    return queryset.filter(
        **{
            f'{field_name}__gte': date_range.start_at,
            f'{field_name}__lt': date_range.end_at,
        }
    )


def build_creator_dashboard_metrics(*, user, start_date: date | None = None, end_date: date | None = None) -> dict:
    date_range = _build_datetime_range(start_date, end_date)

    works_queryset = _apply_range(
        CreativeWork.objects.filter(owner=user),
        'created_at',
        date_range,
    )
    total_works = works_queryset.count()
    registered_works = works_queryset.filter(status=CreativeWork.Status.REGISTERED).count()

    works_by_category_rows = (
        works_queryset
        .values('category')
        .annotate(
            total=Count('id'),
            registered=Count('id', filter=Q(status=CreativeWork.Status.REGISTERED)),
        )
        .order_by('category')
    )
    works_by_category = [
        {
            'category': row['category'],
            'total': row['total'],
            'registered': row['registered'],
        }
        for row in works_by_category_rows
    ]

    licenses_queryset = (
        LicensePurchase.objects
        .filter(
            creator=user,
            status=LicensePurchase.Status.ACTIVE,
        )
        .annotate(effective_at=Coalesce('purchased_at', 'created_at'))
    )
    if date_range:
        licenses_queryset = licenses_queryset.filter(
            effective_at__gte=date_range.start_at,
            effective_at__lt=date_range.end_at,
        )

    total_licenses_sold = licenses_queryset.count()
    revenue_total_wei_int = licenses_queryset.aggregate(total=Coalesce(Sum('amount_wei'), 0))['total'] or 0

    revenue_series_rows = (
        licenses_queryset
        .annotate(period=TruncMonth('effective_at'))
        .values('period')
        .annotate(revenue_wei=Coalesce(Sum('amount_wei'), 0), licenses_sold=Count('id'))
        .order_by('period')
    )
    revenue_over_time = [
        {
            'period': row['period'].date().isoformat()[:7],
            'revenue_wei': str(row['revenue_wei']),
            'revenue_matic': _format_matic(int(row['revenue_wei'])),
            'licenses_sold': row['licenses_sold'],
        }
        for row in revenue_series_rows
    ]

    infringement_queryset = _apply_range(
        InfringementAlert.objects.filter(creator=user),
        'created_at',
        date_range,
    )
    infringement_total = infringement_queryset.count()
    infringement_counts = {
        status: 0
        for status in InfringementAlert.Status.values
    }
    for row in infringement_queryset.values('status').annotate(total=Count('id')):
        infringement_counts[row['status']] = row['total']
    infringement_status_breakdown = [
        {'status': status, 'total': total}
        for status, total in infringement_counts.items()
    ]

    return {
        'date_range': {
            'start_date': start_date,
            'end_date': end_date,
        },
        'generated_at': timezone.now(),
        'total_works': total_works,
        'registered_works': registered_works,
        'total_licenses_sold': total_licenses_sold,
        'revenue': {
            'total_wei': str(revenue_total_wei_int),
            'total_matic': _format_matic(int(revenue_total_wei_int)),
        },
        'infringement': {
            'total': infringement_total,
            'by_status': infringement_status_breakdown,
        },
        'works_by_category': works_by_category,
        'revenue_over_time': revenue_over_time,
    }

