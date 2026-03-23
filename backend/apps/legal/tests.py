import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.infringement.models import InfringementAlert
from apps.works.models import ContentHash, CreativeWork

from .models import LegalDocument

User = get_user_model()

LEGAL_BASE = '/api/v1/legal/'
TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix='legal-tests-')


def auth_header(user):
	refresh = RefreshToken.for_user(user)
	return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class LegalStep11Tests(APITestCase):
	@classmethod
	def tearDownClass(cls):
		super().tearDownClass()
		shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

	def setUp(self):
		self.creator = User.objects.create_user(
			username='creator11',
			email='creator11@example.com',
			password='Str0ngPass!',
		)
		self.other_user = User.objects.create_user(
			username='other11',
			email='other11@example.com',
			password='Str0ngPass!',
		)
		self.staff_user = User.objects.create_user(
			username='staff11',
			email='staff11@example.com',
			password='Str0ngPass!',
			is_staff=True,
		)

		self.work = CreativeWork.objects.create(
			owner=self.creator,
			title='Step 11 Work',
			description='Protected work for legal docs',
			category=CreativeWork.Category.IMAGE,
			status=CreativeWork.Status.REGISTERED,
			blockchain_tx_hash='0x' + '1' * 64,
			blockchain_block_number=12345,
			ipfs_metadata_cid='bafybeigdyrztq',
		)
		ContentHash.objects.create(
			work=self.work,
			hash_type=ContentHash.HashType.SHA256,
			hash_value='a' * 64,
		)
		self.alert = InfringementAlert.objects.create(
			creator=self.creator,
			work=self.work,
			source_url='https://example.com/copied-work',
			source_platform='example',
			source_fingerprint='b' * 64,
			similarity_score=0.95,
			severity=InfringementAlert.Severity.HIGH,
			status=InfringementAlert.Status.CONFIRMED,
		)

	def test_generate_dmca_with_alert_creates_pdf_record(self):
		response = self.client.post(
			f'{LEGAL_BASE}documents/generate/',
			{
				'work_id': self.work.id,
				'alert_id': self.alert.id,
				'document_type': LegalDocument.DocumentType.DMCA,
			},
			format='json',
			**auth_header(self.creator),
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['document_type'], LegalDocument.DocumentType.DMCA)
		self.assertEqual(response.data['work_id'], self.work.id)
		self.assertEqual(response.data['alert_id'], self.alert.id)

		document = LegalDocument.objects.get(id=response.data['id'])
		self.assertTrue(document.file.name.endswith('.pdf'))
		self.assertGreater(document.file.size, 100)

	def test_generate_c_and_d_without_alert_is_allowed(self):
		response = self.client.post(
			f'{LEGAL_BASE}documents/generate/',
			{
				'work_id': self.work.id,
				'document_type': LegalDocument.DocumentType.CEASE_AND_DESIST,
			},
			format='json',
			**auth_header(self.creator),
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertIsNone(response.data['alert_id'])

	def test_generate_rejects_alert_from_different_work(self):
		other_work = CreativeWork.objects.create(
			owner=self.creator,
			title='Another work',
			category=CreativeWork.Category.TEXT,
			status=CreativeWork.Status.REGISTERED,
		)
		mismatched_alert = InfringementAlert.objects.create(
			creator=self.creator,
			work=other_work,
			source_url='https://example.com/other-copy',
			source_platform='example',
			source_fingerprint='c' * 64,
			similarity_score=0.8,
			severity=InfringementAlert.Severity.MEDIUM,
			status=InfringementAlert.Status.PENDING,
		)

		response = self.client.post(
			f'{LEGAL_BASE}documents/generate/',
			{
				'work_id': self.work.id,
				'alert_id': mismatched_alert.id,
				'document_type': LegalDocument.DocumentType.DMCA,
			},
			format='json',
			**auth_header(self.creator),
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Alert must belong', str(response.data))

	def test_generate_rejects_non_owner_work(self):
		response = self.client.post(
			f'{LEGAL_BASE}documents/generate/',
			{
				'work_id': self.work.id,
				'document_type': LegalDocument.DocumentType.DMCA,
			},
			format='json',
			**auth_header(self.other_user),
		)
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

	def test_list_returns_only_creator_documents(self):
		own_document = LegalDocument.objects.create(
			creator=self.creator,
			work=self.work,
			alert=self.alert,
			document_type=LegalDocument.DocumentType.DMCA,
			file='legal/documents/2026/03/23/own.pdf',
		)
		other_work = CreativeWork.objects.create(
			owner=self.other_user,
			title='Other legal work',
			category=CreativeWork.Category.TEXT,
			status=CreativeWork.Status.REGISTERED,
		)
		LegalDocument.objects.create(
			creator=self.other_user,
			work=other_work,
			document_type=LegalDocument.DocumentType.CEASE_AND_DESIST,
			file='legal/documents/2026/03/23/other.pdf',
		)

		response = self.client.get(f'{LEGAL_BASE}documents/', **auth_header(self.creator))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['results']), 1)
		self.assertEqual(response.data['results'][0]['id'], own_document.id)

	def test_download_allowed_for_creator_and_staff(self):
		generate_response = self.client.post(
			f'{LEGAL_BASE}documents/generate/',
			{
				'work_id': self.work.id,
				'document_type': LegalDocument.DocumentType.DMCA,
			},
			format='json',
			**auth_header(self.creator),
		)
		document_id = generate_response.data['id']

		creator_response = self.client.get(
			f'{LEGAL_BASE}documents/{document_id}/download/',
			**auth_header(self.creator),
		)
		self.assertEqual(creator_response.status_code, status.HTTP_200_OK)
		self.assertIn('attachment;', creator_response['Content-Disposition'])

		staff_response = self.client.get(
			f'{LEGAL_BASE}documents/{document_id}/download/',
			**auth_header(self.staff_user),
		)
		self.assertEqual(staff_response.status_code, status.HTTP_200_OK)

	def test_download_rejected_for_unrelated_user(self):
		document = LegalDocument.objects.create(
			creator=self.creator,
			work=self.work,
			document_type=LegalDocument.DocumentType.DMCA,
			file='legal/documents/2026/03/23/doc.pdf',
		)
		response = self.client.get(
			f'{LEGAL_BASE}documents/{document.id}/download/',
			**auth_header(self.other_user),
		)
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
