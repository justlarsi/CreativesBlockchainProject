from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.infringement.models import InfringementAlert
from apps.licensing.models import LicensePurchase
from apps.works.models import CreativeWork

User = get_user_model()

DASHBOARD_URL = '/api/v1/analytics/dashboard/'
ONE_MATIC_WEI = 10**18


def auth_header(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


def set_created_at(instance, value):
    instance.__class__.objects.filter(id=instance.id).update(created_at=value, updated_at=value)


class AnalyticsDashboardTests(APITestCase):
    def setUp(self):
        self.creator = User.objects.create_user(
            username='analytics-creator',
            email='analytics-creator@example.com',
            password='Str0ngPass!',
        )
        self.other_user = User.objects.create_user(
            username='analytics-other',
            email='analytics-other@example.com',
            password='Str0ngPass!',
        )

        self.now = timezone.now()
        self.range_start = (self.now - timedelta(days=45)).date().isoformat()
        self.range_end = self.now.date().isoformat()

        inside_time = self.now - timedelta(days=10)
        outside_time = self.now - timedelta(days=120)

        self.work_image_registered = CreativeWork.objects.create(
            owner=self.creator,
            title='Inside Registered Image',
            category=CreativeWork.Category.IMAGE,
            status=CreativeWork.Status.REGISTERED,
        )
        set_created_at(self.work_image_registered, inside_time)

        self.work_text_uploaded = CreativeWork.objects.create(
            owner=self.creator,
            title='Inside Draft Text',
            category=CreativeWork.Category.TEXT,
            status=CreativeWork.Status.UPLOADED,
        )
        set_created_at(self.work_text_uploaded, inside_time)

        self.work_audio_outside = CreativeWork.objects.create(
            owner=self.creator,
            title='Outside Audio',
            category=CreativeWork.Category.AUDIO,
            status=CreativeWork.Status.REGISTERED,
        )
        set_created_at(self.work_audio_outside, outside_time)

        # Other creator data must be excluded from metrics.
        CreativeWork.objects.create(
            owner=self.other_user,
            title='Other User Work',
            category=CreativeWork.Category.IMAGE,
            status=CreativeWork.Status.REGISTERED,
        )

        active_inside_one = LicensePurchase.objects.create(
            work=self.work_image_registered,
            buyer=self.other_user,
            creator=self.creator,
            template=LicensePurchase.Template.PERSONAL,
            rights_scope=LicensePurchase.RightsScope.NON_COMMERCIAL,
            is_exclusive=False,
            amount_wei=2 * ONE_MATIC_WEI,
            status=LicensePurchase.Status.ACTIVE,
        )
        LicensePurchase.objects.filter(id=active_inside_one.id).update(purchased_at=inside_time)

        active_inside_two = LicensePurchase.objects.create(
            work=self.work_text_uploaded,
            buyer=self.other_user,
            creator=self.creator,
            template=LicensePurchase.Template.COMMERCIAL,
            rights_scope=LicensePurchase.RightsScope.COMMERCIAL,
            is_exclusive=False,
            amount_wei=500_000_000_000_000_000,
            status=LicensePurchase.Status.ACTIVE,
        )
        LicensePurchase.objects.filter(id=active_inside_two.id).update(purchased_at=inside_time)

        active_outside = LicensePurchase.objects.create(
            work=self.work_audio_outside,
            buyer=self.other_user,
            creator=self.creator,
            template=LicensePurchase.Template.PERSONAL,
            rights_scope=LicensePurchase.RightsScope.NON_COMMERCIAL,
            is_exclusive=False,
            amount_wei=7 * ONE_MATIC_WEI,
            status=LicensePurchase.Status.ACTIVE,
        )
        LicensePurchase.objects.filter(id=active_outside.id).update(purchased_at=outside_time)

        LicensePurchase.objects.create(
            work=self.work_image_registered,
            buyer=self.other_user,
            creator=self.creator,
            template=LicensePurchase.Template.PERSONAL,
            rights_scope=LicensePurchase.RightsScope.NON_COMMERCIAL,
            is_exclusive=False,
            amount_wei=9 * ONE_MATIC_WEI,
            status=LicensePurchase.Status.PENDING_CONFIRMATION,
        )

        alert_pending_inside = InfringementAlert.objects.create(
            creator=self.creator,
            work=self.work_image_registered,
            source_url='https://example.com/pending',
            source_platform='example',
            source_fingerprint='a' * 64,
            similarity_score=0.9,
            severity=InfringementAlert.Severity.HIGH,
            status=InfringementAlert.Status.PENDING,
        )
        set_created_at(alert_pending_inside, inside_time)

        alert_resolved_inside = InfringementAlert.objects.create(
            creator=self.creator,
            work=self.work_text_uploaded,
            source_url='https://example.com/resolved',
            source_platform='example',
            source_fingerprint='b' * 64,
            similarity_score=0.84,
            severity=InfringementAlert.Severity.MEDIUM,
            status=InfringementAlert.Status.RESOLVED,
        )
        set_created_at(alert_resolved_inside, inside_time)

        alert_confirmed_outside = InfringementAlert.objects.create(
            creator=self.creator,
            work=self.work_audio_outside,
            source_url='https://example.com/outside',
            source_platform='example',
            source_fingerprint='c' * 64,
            similarity_score=0.99,
            severity=InfringementAlert.Severity.CRITICAL,
            status=InfringementAlert.Status.CONFIRMED,
        )
        set_created_at(alert_confirmed_outside, outside_time)

    def test_dashboard_requires_authentication(self):
        response = self.client.get(DASHBOARD_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_applies_date_range_to_kpis_and_series(self):
        response = self.client.get(
            DASHBOARD_URL,
            {'start_date': self.range_start, 'end_date': self.range_end},
            **auth_header(self.creator),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_works'], 2)
        self.assertEqual(response.data['registered_works'], 1)
        self.assertEqual(response.data['total_licenses_sold'], 2)

        self.assertEqual(response.data['revenue']['total_wei'], str(2 * ONE_MATIC_WEI + 500_000_000_000_000_000))
        self.assertEqual(response.data['revenue']['total_matic'], '2.500000')

        self.assertEqual(response.data['infringement']['total'], 2)
        by_status = {item['status']: item['total'] for item in response.data['infringement']['by_status']}
        self.assertEqual(by_status['pending'], 1)
        self.assertEqual(by_status['resolved'], 1)
        self.assertEqual(by_status['confirmed'], 0)
        self.assertEqual(by_status['false_positive'], 0)

        works_by_category = {item['category']: item for item in response.data['works_by_category']}
        self.assertEqual(works_by_category['image']['total'], 1)
        self.assertEqual(works_by_category['image']['registered'], 1)
        self.assertEqual(works_by_category['text']['total'], 1)
        self.assertEqual(works_by_category['text']['registered'], 0)
        self.assertNotIn('audio', works_by_category)

        self.assertTrue(len(response.data['revenue_over_time']) >= 1)
        first_point = response.data['revenue_over_time'][0]
        self.assertEqual(first_point['revenue_wei'], str(2 * ONE_MATIC_WEI + 500_000_000_000_000_000))
        self.assertEqual(first_point['revenue_matic'], '2.500000')
        self.assertEqual(first_point['licenses_sold'], 2)

    def test_dashboard_validates_date_range_query(self):
        response = self.client.get(
            DASHBOARD_URL,
            {'start_date': self.range_start},
            **auth_header(self.creator),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Both start_date and end_date', str(response.data))

