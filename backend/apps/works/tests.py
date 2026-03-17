from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit_logs.models import AuditLog

from .models import CreativeWork

User = get_user_model()

WORKS_BASE = '/api/v1/works/'


def make_user(username='workuser', email='work@example.com', password='Str0ngPass!'):
	return User.objects.create_user(username=username, email=email, password=password)


def auth_header(user):
	refresh = RefreshToken.for_user(user)
	return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


def sample_png(name='sample.png'):
	data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
	return SimpleUploadedFile(name=name, content=data, content_type='image/png')


class CreativeWorkMetadataTests(APITestCase):
	def setUp(self):
		self.user = make_user()

	def test_create_metadata_success(self):
		payload = {
			'title': 'Test Work',
			'description': 'short description',
			'category': CreativeWork.Category.IMAGE,
		}
		response = self.client.post(WORKS_BASE, payload, format='json', **auth_header(self.user))
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['title'], 'Test Work')
		self.assertEqual(response.data['status'], CreativeWork.Status.PENDING_UPLOAD)

	def test_unauthenticated_create_returns_normalized_error(self):
		payload = {'title': 'No Auth', 'category': CreativeWork.Category.IMAGE}
		response = self.client.post(WORKS_BASE, payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertIn('error', response.data)
		self.assertIn('code', response.data['error'])

	def test_list_returns_only_owned_works(self):
		other = make_user(username='other', email='other@example.com')
		CreativeWork.objects.create(owner=self.user, title='Owned', category=CreativeWork.Category.TEXT)
		CreativeWork.objects.create(owner=other, title='Not Owned', category=CreativeWork.Category.TEXT)

		response = self.client.get(WORKS_BASE, **auth_header(self.user))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = [item['title'] for item in response.data['results']]
		self.assertEqual(titles, ['Owned'])


class CreativeWorkUploadTests(APITestCase):
	def setUp(self):
		self.user = make_user(username='uploader', email='uploader@example.com')
		self.work = CreativeWork.objects.create(
			owner=self.user,
			title='Upload Target',
			category=CreativeWork.Category.IMAGE,
		)

	def test_upload_success_updates_metadata_and_creates_audit_log(self):
		upload = sample_png(name='../../unsafe name.png')
		response = self.client.put(
			f'{WORKS_BASE}{self.work.id}/upload/',
			{'file': upload},
			format='multipart',
			**auth_header(self.user),
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.work.refresh_from_db()
		self.assertEqual(self.work.status, CreativeWork.Status.UPLOADED)
		self.assertEqual(self.work.mime_type, 'image/png')
		self.assertEqual(self.work.original_filename, 'unsafe_name.png')
		self.assertTrue(AuditLog.objects.filter(action='work_uploaded', entity_id=str(self.work.id)).exists())

	def test_upload_mime_mismatch_sets_validation_failed(self):
		bad_file = SimpleUploadedFile('notes.txt', b'hello world\n', content_type='text/plain')
		response = self.client.put(
			f'{WORKS_BASE}{self.work.id}/upload/',
			{'file': bad_file},
			format='multipart',
			**auth_header(self.user),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('error', response.data)
		self.work.refresh_from_db()
		self.assertEqual(self.work.status, CreativeWork.Status.VALIDATION_FAILED)

	def test_upload_too_large_sets_validation_failed(self):
		upload = sample_png()
		with patch('apps.works.services.MAX_UPLOAD_BYTES', 1):
			response = self.client.put(
				f'{WORKS_BASE}{self.work.id}/upload/',
				{'file': upload},
				format='multipart',
				**auth_header(self.user),
			)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.work.refresh_from_db()
		self.assertEqual(self.work.status, CreativeWork.Status.VALIDATION_FAILED)

	def test_upload_other_user_work_returns_404(self):
		other = make_user(username='other2', email='other2@example.com')
		response = self.client.put(
			f'{WORKS_BASE}{self.work.id}/upload/',
			{'file': sample_png()},
			format='multipart',
			**auth_header(other),
		)
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
