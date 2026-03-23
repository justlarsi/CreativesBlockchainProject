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

	@patch('apps.infringement.views.scan_work_for_infringement_task.delay')
	def test_scan_trigger_queues_task_for_owned_work(self, mock_delay):
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
		mock_delay.assert_called_once()

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
