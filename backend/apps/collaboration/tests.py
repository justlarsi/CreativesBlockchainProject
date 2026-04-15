from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Wallet
from apps.works.models import ContentHash, CreativeWork

from .models import Collaboration, CollaborationMember, CollaborationRequest

User = get_user_model()

COLLABORATIONS_BASE = '/api/v1/collaborations/'
COLLABORATION_REQUESTS_BASE = '/api/v1/collaborations/requests/'


def auth_header(user):
	refresh = RefreshToken.for_user(user)
	return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


class CollaborationStep12Tests(APITestCase):
	def setUp(self):
		self.creator = User.objects.create_user(
			username='creator12',
			email='creator12@example.com',
			password='Str0ngPass!',
		)
		self.member_a = User.objects.create_user(
			username='membera',
			email='membera@example.com',
			password='Str0ngPass!',
		)
		self.member_b = User.objects.create_user(
			username='memberb',
			email='memberb@example.com',
			password='Str0ngPass!',
		)

		Wallet.objects.create(user=self.creator, address='0x1111111111111111111111111111111111111111', is_primary=True)
		Wallet.objects.create(user=self.member_a, address='0x2222222222222222222222222222222222222222', is_primary=True)
		Wallet.objects.create(user=self.member_b, address='0x3333333333333333333333333333333333333333', is_primary=True)

		self.work = CreativeWork.objects.create(
			owner=self.creator,
			title='Step 12 Collaborative Work',
			description='Collaboration test work',
			category=CreativeWork.Category.IMAGE,
			status=CreativeWork.Status.IPFS_PINNING_COMPLETE,
		)
		ContentHash.objects.create(
			work=self.work,
			hash_type=ContentHash.HashType.SHA256,
			hash_value='a' * 64,
		)

	def _create_collaboration(self):
		response = self.client.post(
			COLLABORATIONS_BASE,
			{
				'work_id': self.work.id,
				'members': [
					{
						'user_id': self.creator.id,
						'wallet_address': '0x1111111111111111111111111111111111111111',
						'split_bps': 5000,
					},
					{
						'email': self.member_a.email,
						'wallet_address': '0x2222222222222222222222222222222222222222',
						'split_bps': 3000,
					},
					{
						'user_id': self.member_b.id,
						'wallet_address': '0x3333333333333333333333333333333333333333',
						'split_bps': 2000,
					},
				],
			},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		return response

	def test_create_collaboration_hybrid_payload_and_creator_auto_approved(self):
		response = self._create_collaboration()
		self.assertEqual(response.data['status'], Collaboration.Status.PENDING_APPROVAL)
		self.assertEqual(len(response.data['members']), 3)

		creator_member = CollaborationMember.objects.get(collaboration_id=response.data['id'], user=self.creator)
		self.assertEqual(creator_member.approval_status, CollaborationMember.ApprovalStatus.APPROVED)

	def test_create_collaboration_rejects_invalid_split_total(self):
		response = self.client.post(
			COLLABORATIONS_BASE,
			{
				'work_id': self.work.id,
				'members': [
					{
						'user_id': self.creator.id,
						'wallet_address': '0x1111111111111111111111111111111111111111',
						'split_bps': 7000,
					},
					{
						'user_id': self.member_a.id,
						'wallet_address': '0x2222222222222222222222222222222222222222',
						'split_bps': 2000,
					},
				],
			},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Split total must equal 10000 bps', str(response.data))

	def test_member_approval_transitions_collaboration_to_approved(self):
		creation = self._create_collaboration()
		collab_id = creation.data['id']

		first = self.client.patch(
			f'{COLLABORATIONS_BASE}{collab_id}/approve/',
			{'approved': True},
			format='json',
			**auth_header(self.member_a),
		)
		self.assertEqual(first.status_code, status.HTTP_200_OK)
		self.assertEqual(first.data['status'], Collaboration.Status.PENDING_APPROVAL)

		second = self.client.patch(
			f'{COLLABORATIONS_BASE}{collab_id}/approve/',
			{'approved': True},
			format='json',
			**auth_header(self.member_b),
		)
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertEqual(second.data['status'], Collaboration.Status.APPROVED)

	def test_work_registration_prepare_is_blocked_until_collaboration_approved(self):
		self._create_collaboration()

		response = self.client.post(
			f'/api/v1/works/{self.work.id}/register-blockchain/prepare/',
			{},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Collaboration must be fully approved', str(response.data))

	@patch('apps.collaboration.tasks.verify_collaboration_receipt_task.delay')
	@patch('apps.collaboration.services_blockchain._contract_address', return_value='0x4444444444444444444444444444444444444444')
	def test_collaboration_prepare_and_receipt_queue(self, _mock_contract, mock_delay):
		creation = self._create_collaboration()
		collab_id = creation.data['id']

		self.client.patch(
			f'{COLLABORATIONS_BASE}{collab_id}/approve/',
			{'approved': True},
			format='json',
			**auth_header(self.member_a),
		)
		self.client.patch(
			f'{COLLABORATIONS_BASE}{collab_id}/approve/',
			{'approved': True},
			format='json',
			**auth_header(self.member_b),
		)

		prepare_response = self.client.post(
			f'{COLLABORATIONS_BASE}{collab_id}/register-blockchain/prepare/',
			{},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(prepare_response.status_code, status.HTTP_200_OK)
		self.assertEqual(prepare_response.data['to'], '0x4444444444444444444444444444444444444444')
		self.assertTrue(prepare_response.data['data'].startswith('0x'))

		tx_hash = '0x' + 'f' * 64
		receipt_response = self.client.post(
			f'{COLLABORATIONS_BASE}{collab_id}/register-blockchain/receipt/',
			{'tx_hash': tx_hash},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(receipt_response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(receipt_response.data['tx_hash'], tx_hash)
		mock_delay.assert_called_once_with(collab_id, tx_hash)

	def test_marketplace_collaboration_request_lifecycle(self):
		create_response = self.client.post(
			COLLABORATION_REQUESTS_BASE,
			{
				'work_id': self.work.id,
				'message': 'I would like to collaborate on the photography direction.',
				'proposed_split_bps': 3000,
			},
			format='json',
			**auth_header(self.member_a),
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data['status'], CollaborationRequest.Status.PENDING)

		requests_response = self.client.get(COLLABORATION_REQUESTS_BASE, **auth_header(self.creator))
		self.assertEqual(requests_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(requests_response.data), 1)
		self.assertEqual(requests_response.data[0]['requester_username'], 'membera')

		accept_response = self.client.post(
			f'{COLLABORATION_REQUESTS_BASE}{create_response.data["id"]}/accept/',
			{},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
		self.assertEqual(accept_response.data['status'], Collaboration.Status.PENDING_APPROVAL)

		request = CollaborationRequest.objects.get(id=create_response.data['id'])
		self.assertEqual(request.status, CollaborationRequest.Status.ACCEPTED)
		self.assertIsNotNone(request.collaboration_id)
		collaboration = Collaboration.objects.get(id=request.collaboration_id)
		self.assertEqual(collaboration.members.count(), 2)
		self.assertEqual(collaboration.creator, self.creator)
