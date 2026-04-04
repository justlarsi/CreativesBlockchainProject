from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Wallet
from apps.works.models import CreativeWork

from .models import MarketplaceListing

User = get_user_model()

MARKETPLACE_BASE = '/api/v1/marketplace/'


class MarketplaceAPITests(APITestCase):
	def setUp(self):
		cache.clear()
		self.creator = User.objects.create_user(
			username='creator1',
			email='creator1@example.com',
			password='Str0ngPass!',
			bio='Nairobi-based creator',
		)
		Wallet.objects.create(
			user=self.creator,
			address='0x1111111111111111111111111111111111111111',
			is_primary=True,
		)

	def _create_work(self, *, title: str, status: str):
		return CreativeWork.objects.create(
			owner=self.creator,
			title=title,
			description='Marketplace test description',
			category=CreativeWork.Category.IMAGE,
			status=status,
		)

	def _create_listing(self, work, *, is_listed=True, license_type='personal', price='10.00'):
		return MarketplaceListing.objects.create(
			work=work,
			is_listed=is_listed,
			license_type=license_type,
			price_amount=Decimal(price),
		)

	def test_public_list_endpoint_is_accessible(self):
		work = self._create_work(title='Public Work', status=CreativeWork.Status.REGISTERED)
		self._create_listing(work, is_listed=True)

		response = self.client.get(MARKETPLACE_BASE)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['results']), 1)

	def test_list_includes_only_registered_and_explicitly_listed(self):
		included = self._create_work(title='Included', status=CreativeWork.Status.REGISTERED)
		self._create_listing(included, is_listed=True)

		not_registered = self._create_work(title='Not Registered', status=CreativeWork.Status.UPLOADED)
		self._create_listing(not_registered, is_listed=True)

		not_listed = self._create_work(title='Not Listed', status=CreativeWork.Status.REGISTERED)
		self._create_listing(not_listed, is_listed=False)

		response = self.client.get(MARKETPLACE_BASE)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = [item['title'] for item in response.data['results']]
		self.assertEqual(titles, ['Included'])

	def test_list_supports_filters_and_search(self):
		image_work = self._create_work(title='Sunset in Nairobi', status=CreativeWork.Status.REGISTERED)
		self._create_listing(image_work, license_type='commercial', price='75.00')

		text_work = CreativeWork.objects.create(
			owner=self.creator,
			title='Writers Room',
			description='Detailed scripts and stories',
			category=CreativeWork.Category.TEXT,
			status=CreativeWork.Status.REGISTERED,
		)
		self._create_listing(text_work, license_type='personal', price='15.00')

		response = self.client.get(
			f'{MARKETPLACE_BASE}?category=image&license_type=commercial&search=sunset&min_price=70&max_price=80'
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['results']), 1)
		self.assertEqual(response.data['results'][0]['title'], 'Sunset in Nairobi')

	def test_cursor_pagination_returns_next_link(self):
		for index in range(25):
			work = self._create_work(
				title=f'Work {index}',
				status=CreativeWork.Status.REGISTERED,
			)
			self._create_listing(work, price='20.00')

		response = self.client.get(MARKETPLACE_BASE)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['results']), 20)
		self.assertIsNotNone(response.data['next'])

	def test_detail_returns_creator_and_license_metadata(self):
		work = self._create_work(title='Detail Work', status=CreativeWork.Status.REGISTERED)
		self._create_listing(work, license_type='exclusive', price='250.00')

		response = self.client.get(f'{MARKETPLACE_BASE}works/{work.id}/')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['work_id'], work.id)
		self.assertEqual(response.data['license_type'], 'exclusive')
		self.assertEqual(response.data['creator']['username'], 'creator1')
		self.assertEqual(response.data['creator']['bio'], 'Nairobi-based creator')
		self.assertEqual(response.data['creator']['wallet_address'], '0x1111111111111111111111111111111111111111')

	def test_list_response_is_cached_for_same_query_for_ttl_window(self):
		work = self._create_work(title='Cached Title', status=CreativeWork.Status.REGISTERED)
		self._create_listing(work, is_listed=True)

		first = self.client.get(MARKETPLACE_BASE)
		self.assertEqual(first.status_code, status.HTTP_200_OK)
		self.assertEqual(first.data['results'][0]['title'], 'Cached Title')

		work.title = 'Updated Title'
		work.save(update_fields=['title', 'updated_at'])

		second = self.client.get(MARKETPLACE_BASE)
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertEqual(second.data['results'][0]['title'], 'Cached Title')

	def test_cache_is_scoped_by_query_params(self):
		image_work = self._create_work(title='Image Listing', status=CreativeWork.Status.REGISTERED)
		self._create_listing(image_work, is_listed=True, license_type='personal', price='10.00')

		text_work = CreativeWork.objects.create(
			owner=self.creator,
			title='Text Listing',
			description='Text listing description',
			category=CreativeWork.Category.TEXT,
			status=CreativeWork.Status.REGISTERED,
		)
		self._create_listing(text_work, is_listed=True, license_type='personal', price='12.00')

		image_only = self.client.get(f'{MARKETPLACE_BASE}?category=image')
		self.assertEqual(image_only.status_code, status.HTTP_200_OK)
		self.assertEqual(len(image_only.data['results']), 1)
		self.assertEqual(image_only.data['results'][0]['title'], 'Image Listing')

		text_only = self.client.get(f'{MARKETPLACE_BASE}?category=text')
		self.assertEqual(text_only.status_code, status.HTTP_200_OK)
		self.assertEqual(len(text_only.data['results']), 1)
		self.assertEqual(text_only.data['results'][0]['title'], 'Text Listing')
