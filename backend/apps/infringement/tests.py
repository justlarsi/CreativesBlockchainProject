from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.works.models import ContentHash, CreativeWork

from .models import InfringementAlert
from .tasks import scan_work_for_infringement_task

User = get_user_model()

INFRINGEMENT_BASE = '/api/v1/infringement/'


def auth_header(user):
	refresh = RefreshToken.for_user(user)
	return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


class InfringementStep10Tests(APITestCase):
	def setUp(self):
		self.creator = User.objects.create_user(
			username='creator10',
			email='creator10@example.com',
			password='Str0ngPass!',
		)
		self.other_user = User.objects.create_user(
			username='other10',
			email='other10@example.com',
			password='Str0ngPass!',
		)
		self.work = CreativeWork.objects.create(
			owner=self.creator,
			title='Nairobi Skyline',
			description='Golden skyline photo set',
			category=CreativeWork.Category.IMAGE,
			status=CreativeWork.Status.REGISTERED,
		)
		ContentHash.objects.create(
			work=self.work,
			hash_type=ContentHash.HashType.SHA256,
			hash_value='a' * 64,
		)

	def test_scan_trigger_processes_owned_work_immediately(self):
		response = self.client.post(
			f'{INFRINGEMENT_BASE}scan/',
			{
				'work_id': self.work.id,
				'candidates': [
					{
						'source_url': 'https://mock.example/post/1',
						'source_platform': 'mock.example',
						'source_hash': 'a' * 64,
						'title': 'Nairobi Skyline',
					}
				],
			},
			format='json',
			**auth_header(self.creator),
		)

		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(response.data['status'], 'processed')
		self.assertEqual(response.data['work_id'], self.work.id)
		self.assertEqual(response.data['matched_candidates'], 1)
		self.assertEqual(len(response.data['created_alert_ids']), 1)
		self.assertEqual(InfringementAlert.objects.count(), 1)

	def test_scan_trigger_rejects_work_not_owned_by_user(self):
		response = self.client.post(
			f'{INFRINGEMENT_BASE}scan/',
			{
				'work_id': self.work.id,
				'candidates': [{'source_url': 'https://mock.example/post/1'}],
			},
			format='json',
			**auth_header(self.other_user),
		)
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

	@patch('apps.infringement.views.discover_public_candidates_for_work')
	def test_public_scan_discovers_candidates_and_creates_alerts(self, mock_discover):
		mock_discover.return_value = (
			[
				{
					'source_url': 'https://instagram.com/p/mock123',
					'source_platform': 'instagram.com',
					'source_hash': 'a' * 64,
					'title': 'Nairobi Skyline',
					'description': 'Golden skyline photo set',
				}
			],
			['instagram.com'],
		)

		response = self.client.post(
			f'{INFRINGEMENT_BASE}scan/public/',
			{'work_id': self.work.id, 'platforms': ['instagram.com']},
			format='json',
			**auth_header(self.creator),
		)

		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(response.data['status'], 'processed')
		self.assertEqual(response.data['work_id'], self.work.id)
		self.assertEqual(response.data['scanned_candidates'], 1)
		self.assertEqual(response.data['matched_candidates'], 1)
		self.assertEqual(len(response.data['created_alert_ids']), 1)
		self.assertEqual(response.data['platforms'], ['instagram.com'])

	def test_scan_task_creates_alert_and_deduplicates_open_alert(self):
		payload = [
			{
				'source_url': 'https://mock.example/post/42',
				'source_platform': 'mock.example',
				'source_hash': 'a' * 64,
				'title': 'Nairobi Skyline Copy',
				'description': 'Golden skyline photo set copy',
			}
		]

		first = scan_work_for_infringement_task(self.work.id, payload)
		self.assertEqual(first['status'], 'ok')
		self.assertEqual(InfringementAlert.objects.count(), 1)
		alert = InfringementAlert.objects.first()
		self.assertEqual(alert.status, InfringementAlert.Status.PENDING)

		second = scan_work_for_infringement_task(self.work.id, payload)
		self.assertEqual(second['status'], 'ok')
		self.assertEqual(InfringementAlert.objects.count(), 1)

	def test_creator_can_list_only_own_alerts(self):
		own_alert = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://mock.example/post/own',
			source_platform='mock.example',
			source_fingerprint='f' * 64,
			similarity_score=0.9,
			severity=InfringementAlert.Severity.HIGH,
			status=InfringementAlert.Status.PENDING,
		)
		other_work = CreativeWork.objects.create(
			owner=self.other_user,
			title='Other Work',
			description='Other desc',
			category=CreativeWork.Category.TEXT,
			status=CreativeWork.Status.REGISTERED,
		)
		InfringementAlert.objects.create(
			creator=self.other_user,
			work=other_work,
			source_url='https://mock.example/post/other',
			source_platform='mock.example',
			source_fingerprint='e' * 64,
			similarity_score=0.8,
			severity=InfringementAlert.Severity.MEDIUM,
			status=InfringementAlert.Status.PENDING,
		)

		response = self.client.get(f'{INFRINGEMENT_BASE}alerts/', **auth_header(self.creator))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['results']), 1)
		self.assertEqual(response.data['results'][0]['id'], own_alert.id)

	def test_status_transition_allows_pending_to_confirmed_and_confirmed_to_resolved(self):
		alert = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://mock.example/post/transition',
			source_platform='mock.example',
			source_fingerprint='d' * 64,
			similarity_score=0.92,
			severity=InfringementAlert.Severity.HIGH,
			status=InfringementAlert.Status.PENDING,
		)

		first = self.client.patch(
			f'{INFRINGEMENT_BASE}alerts/{alert.id}/',
			{'status': InfringementAlert.Status.CONFIRMED, 'resolution_notes': 'Likely infringement'},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(first.status_code, status.HTTP_200_OK)

		second = self.client.patch(
			f'{INFRINGEMENT_BASE}alerts/{alert.id}/',
			{'status': InfringementAlert.Status.RESOLVED, 'resolution_notes': 'Handled'},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(second.status_code, status.HTTP_200_OK)

	def test_status_transition_rejects_reopen(self):
		alert = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://mock.example/post/reopen',
			source_platform='mock.example',
			source_fingerprint='c' * 64,
			similarity_score=0.75,
			severity=InfringementAlert.Severity.MEDIUM,
			status=InfringementAlert.Status.RESOLVED,
		)

		response = self.client.patch(
			f'{INFRINGEMENT_BASE}alerts/{alert.id}/',
			{'status': InfringementAlert.Status.PENDING},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_cleanup_legacy_alerts_hides_or_deletes_only_mock_platform_entries(self):
		legacy_open = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://mock-platform.example/scan/123',
			source_platform='mock-platform.example',
			source_fingerprint='1' * 64,
			similarity_score=0.8,
			severity=InfringementAlert.Severity.MEDIUM,
			status=InfringementAlert.Status.PENDING,
		)
		legacy_closed = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://mock-platform.example/scan/456',
			source_platform='mock-platform.example',
			source_fingerprint='2' * 64,
			similarity_score=0.7,
			severity=InfringementAlert.Severity.LOW,
			status=InfringementAlert.Status.FALSE_POSITIVE,
		)
		non_legacy = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://instagram.com/p/real',
			source_platform='instagram.com',
			source_fingerprint='3' * 64,
			similarity_score=0.9,
			severity=InfringementAlert.Severity.HIGH,
			status=InfringementAlert.Status.PENDING,
		)

		hide_response = self.client.post(
			f'{INFRINGEMENT_BASE}alerts/cleanup-legacy/',
			{'mode': 'hide'},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(hide_response.status_code, status.HTTP_200_OK)
		self.assertEqual(hide_response.data['total_legacy'], 2)
		self.assertEqual(hide_response.data['hidden_count'], 1)

		legacy_open.refresh_from_db()
		legacy_closed.refresh_from_db()
		non_legacy.refresh_from_db()
		self.assertEqual(legacy_open.status, InfringementAlert.Status.FALSE_POSITIVE)
		self.assertEqual(legacy_closed.status, InfringementAlert.Status.FALSE_POSITIVE)
		self.assertEqual(non_legacy.status, InfringementAlert.Status.PENDING)

		delete_response = self.client.post(
			f'{INFRINGEMENT_BASE}alerts/cleanup-legacy/',
			{'mode': 'delete'},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
		self.assertEqual(delete_response.data['mode'], 'delete')
		self.assertEqual(delete_response.data['total_legacy'], 2)
		self.assertEqual(delete_response.data['deleted_count'], 3)
		self.assertEqual(delete_response.data['deleted_active_count'], 1)
		self.assertEqual(InfringementAlert.objects.filter(source_platform='mock-platform.example').count(), 0)
		self.assertEqual(InfringementAlert.objects.filter(id=non_legacy.id).count(), 0)
