from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Wallet
from apps.marketplace.models import MarketplaceListing
from apps.works.models import ContentHash, CreativeWork

from .models import LicensePurchase
from .tasks import verify_license_receipt_task

User = get_user_model()

LICENSES_BASE = '/api/v1/licenses/'


def auth_header(user):
	refresh = RefreshToken.for_user(user)
	return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


class LicensingStep9Tests(APITestCase):
	def setUp(self):
		self.creator = User.objects.create_user(
			username='creator9',
			email='creator9@example.com',
			password='Str0ngPass!',
			bio='Creator for licensing tests',
		)
		Wallet.objects.create(
			user=self.creator,
			address='0x1111111111111111111111111111111111111111',
			is_primary=True,
		)
		self.buyer = User.objects.create_user(
			username='buyer9',
			email='buyer9@example.com',
			password='Str0ngPass!',
		)
		self.work = CreativeWork.objects.create(
			owner=self.creator,
			title='Step 9 Work',
			description='Licensing flow test',
			category=CreativeWork.Category.IMAGE,
			status=CreativeWork.Status.REGISTERED,
		)
		ContentHash.objects.create(
			work=self.work,
			hash_type=ContentHash.HashType.SHA256,
			hash_value='a' * 64,
		)
		self.listing = MarketplaceListing.objects.create(
			work=self.work,
			is_listed=True,
			license_type=MarketplaceListing.LicenseType.PERSONAL,
			price_amount='5.00',
			price_wei=5_000_000_000_000_000_000,
		)

	@patch('apps.licensing.tasks.verify_license_receipt_task.delay')
	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_prepare_and_receipt_queue_success(self, _mock_contract, mock_delay):
		prepare_response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'personal',
				'rights_scope': 'non_commercial',
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(prepare_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(prepare_response.data['status'], LicensePurchase.Status.PENDING_CONFIRMATION)
		purchase_id = prepare_response.data['purchase_id']

		tx_hash = '0x' + 'a' * 64
		receipt_response = self.client.post(
			f'{LICENSES_BASE}receipt/',
			{
				'purchase_id': purchase_id,
				'idempotency_key': 'receipt-key-1',
				'tx_hash': tx_hash,
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(receipt_response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(receipt_response.data['tx_hash'], tx_hash)
		mock_delay.assert_called_once_with(purchase_id, tx_hash)

	@patch('apps.licensing.tasks.verify_license_receipt_task.delay')
	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_receipt_idempotency_retries_with_same_key(self, _mock_contract, mock_delay):
		prepare_response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'personal',
				'rights_scope': 'non_commercial',
			},
			format='json',
			**auth_header(self.buyer),
		)
		purchase_id = prepare_response.data['purchase_id']
		tx_hash = '0x' + 'd' * 64

		first = self.client.post(
			f'{LICENSES_BASE}receipt/',
			{
				'purchase_id': purchase_id,
				'idempotency_key': 'retry-key-1',
				'tx_hash': tx_hash,
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)

		second = self.client.post(
			f'{LICENSES_BASE}receipt/',
			{
				'purchase_id': purchase_id,
				'idempotency_key': 'retry-key-1',
				'tx_hash': tx_hash,
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(second.status_code, status.HTTP_202_ACCEPTED)
		self.assertIn('already queued', second.data['message'])
		mock_delay.assert_called_once_with(purchase_id, tx_hash)

	@patch('apps.licensing.tasks.verify_license_receipt_task.delay')
	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_receipt_rejects_different_idempotency_key(self, _mock_contract, mock_delay):
		prepare_response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'personal',
				'rights_scope': 'non_commercial',
			},
			format='json',
			**auth_header(self.buyer),
		)
		purchase_id = prepare_response.data['purchase_id']
		tx_hash = '0x' + 'e' * 64

		first = self.client.post(
			f'{LICENSES_BASE}receipt/',
			{
				'purchase_id': purchase_id,
				'idempotency_key': 'key-one-1',
				'tx_hash': tx_hash,
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)

		second = self.client.post(
			f'{LICENSES_BASE}receipt/',
			{
				'purchase_id': purchase_id,
				'idempotency_key': 'key-two-2',
				'tx_hash': tx_hash,
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('different idempotency key', str(second.data))
		mock_delay.assert_called_once_with(purchase_id, tx_hash)

	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_template_enforcement_rejects_mismatched_template(self, _mock_contract):
		response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'commercial',
				'rights_scope': 'commercial',
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('match listing license type', str(response.data))

	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_rights_scope_enforcement_for_personal_template(self, _mock_contract):
		response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'personal',
				'rights_scope': 'commercial',
			},
			format='json',
			**auth_header(self.buyer),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Personal licenses require non_commercial', str(response.data))

	@patch('apps.licensing.services_blockchain._contract_address', return_value='0x2222222222222222222222222222222222222222')
	def test_exclusive_hard_block_after_existing_exclusive_purchase(self, _mock_contract):
		self.listing.license_type = MarketplaceListing.LicenseType.EXCLUSIVE
		self.listing.save(update_fields=['license_type', 'updated_at'])

		LicensePurchase.objects.create(
			work=self.work,
			buyer=self.buyer,
			creator=self.creator,
			template=LicensePurchase.Template.EXCLUSIVE,
			rights_scope=LicensePurchase.RightsScope.COMMERCIAL,
			is_exclusive=True,
			amount_wei=self.listing.price_wei,
			status=LicensePurchase.Status.ACTIVE,
			tx_hash='0x' + '1' * 64,
		)

		second_buyer = User.objects.create_user(
			username='secondbuyer',
			email='secondbuyer@example.com',
			password='Str0ngPass!',
		)
		response = self.client.post(
			f'{LICENSES_BASE}prepare/',
			{
				'work_id': self.work.id,
				'template': 'exclusive',
				'rights_scope': 'commercial',
			},
			format='json',
			**auth_header(second_buyer),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('exclusive license purchase', str(response.data))

	def test_certificate_download_for_active_purchase(self):
		purchase = LicensePurchase.objects.create(
			work=self.work,
			buyer=self.buyer,
			creator=self.creator,
			template=LicensePurchase.Template.PERSONAL,
			rights_scope=LicensePurchase.RightsScope.NON_COMMERCIAL,
			is_exclusive=False,
			amount_wei=self.listing.price_wei,
			status=LicensePurchase.Status.ACTIVE,
			tx_hash='0x' + 'b' * 64,
			block_number=123,
			purchased_at=datetime.now(dt_timezone.utc),
		)

		response = self.client.get(
			f'{LICENSES_BASE}{purchase.id}/certificate/',
			**auth_header(self.buyer),
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('attachment;', response['Content-Disposition'])
		self.assertGreater(len(response.content), 20)

	@patch('apps.licensing.tasks.verify_purchase_receipt')
	@patch('apps.licensing.tasks.creator_wallet_address_for_listing', return_value='0x1111111111111111111111111111111111111111')
	def test_task_marks_active_and_unlists_on_exclusive(self, _mock_wallet, mock_verify):
		self.listing.license_type = MarketplaceListing.LicenseType.EXCLUSIVE
		self.listing.save(update_fields=['license_type', 'updated_at'])

		purchase = LicensePurchase.objects.create(
			work=self.work,
			buyer=self.buyer,
			creator=self.creator,
			template=LicensePurchase.Template.EXCLUSIVE,
			rights_scope=LicensePurchase.RightsScope.COMMERCIAL,
			is_exclusive=True,
			amount_wei=self.listing.price_wei,
			status=LicensePurchase.Status.PENDING_CONFIRMATION,
			tx_hash='0x' + 'c' * 64,
		)
		mock_verify.return_value = {
			'tx_hash': purchase.tx_hash,
			'block_number': 222,
			'purchased_at': datetime.now(dt_timezone.utc),
			'explorer_url': 'https://amoy.polygonscan.com/tx/' + purchase.tx_hash,
		}

		result = verify_license_receipt_task(purchase.id, purchase.tx_hash)
		self.assertEqual(result['status'], 'ok')

		purchase.refresh_from_db()
		self.assertEqual(purchase.status, LicensePurchase.Status.ACTIVE)
		self.listing.refresh_from_db()
		self.assertFalse(self.listing.is_listed)
