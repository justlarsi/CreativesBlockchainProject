from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit_logs.models import AuditLog

from .models import ContentHash, CreativeWork
from .tasks import hash_work_task

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


# ---------------------------------------------------------------------------
# Step 4 — Async hashing task tests
# ---------------------------------------------------------------------------

def _minimal_png_bytes() -> bytes:
    """1×1 white PNG, valid Pillow-decodable, all stdlib — no files on disk."""
    import struct, zlib
    def chunk(name: bytes, data: bytes) -> bytes:
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xFFFFFFFF)

    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(b'\x00\xFF\xFF\xFF'))
    iend = chunk(b'IEND', b'')
    return b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend


class HashTaskTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='hasher', email='hasher@example.com')

    def _make_uploaded_work(self, category=CreativeWork.Category.IMAGE, raw=None):
        """Create a work with an in-memory file already attached."""
        from django.core.files.base import ContentFile
        work = CreativeWork.objects.create(
            owner=self.user,
            title='Hash Test Work',
            category=category,
            status=CreativeWork.Status.UPLOADED,
        )
        content = raw if raw is not None else _minimal_png_bytes()
        work.file.save('test.png', ContentFile(content), save=True)
        work.status = CreativeWork.Status.UPLOADED
        work.save(update_fields=['status', 'updated_at'])
        return work

    def test_hash_task_transitions_to_processing_complete(self):
        work = self._make_uploaded_work()
        result = hash_work_task(work.id)
        self.assertEqual(result['status'], 'ok')
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.PROCESSING_COMPLETE)

    def test_hash_task_creates_sha256_record(self):
        work = self._make_uploaded_work()
        hash_work_task(work.id)
        self.assertTrue(
            ContentHash.objects.filter(work=work, hash_type=ContentHash.HashType.SHA256).exists()
        )

    def test_hash_task_creates_perceptual_hash_for_image(self):
        work = self._make_uploaded_work(category=CreativeWork.Category.IMAGE)
        hash_work_task(work.id)
        self.assertTrue(
            ContentHash.objects.filter(work=work, hash_type=ContentHash.HashType.PERCEPTUAL_AVG).exists()
        )

    def test_hash_task_creates_text_normalized_hash_for_text(self):
        work = self._make_uploaded_work(
            category=CreativeWork.Category.TEXT,
            raw=b'Hello creative world\n',
        )
        hash_work_task(work.id)
        self.assertTrue(
            ContentHash.objects.filter(work=work, hash_type=ContentHash.HashType.TEXT_NORMALIZED).exists()
        )

    def test_hash_task_audio_only_sha256_no_perceptual(self):
        work = self._make_uploaded_work(
            category=CreativeWork.Category.AUDIO,
            raw=b'ID3fake',
        )
        hash_work_task(work.id)
        self.assertTrue(ContentHash.objects.filter(work=work, hash_type=ContentHash.HashType.SHA256).exists())
        self.assertFalse(ContentHash.objects.filter(work=work, hash_type=ContentHash.HashType.PERCEPTUAL_AVG).exists())

    def test_hash_task_idempotency_skips_already_complete(self):
        work = self._make_uploaded_work()
        hash_work_task(work.id)
        result = hash_work_task(work.id)  # second call
        self.assertEqual(result['status'], 'skipped')

    def test_hash_task_sets_processing_failed_on_error(self):
        work = self._make_uploaded_work()
        with patch('apps.works.tasks._perceptual_avg_hash', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                hash_work_task(work.id)
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.PROCESSING_FAILED)

    def test_hash_task_retries_from_processing_failed(self):
        work = self._make_uploaded_work()
        work.status = CreativeWork.Status.PROCESSING_FAILED
        work.save(update_fields=['status', 'updated_at'])
        result = hash_work_task(work.id)
        self.assertEqual(result['status'], 'ok')
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.PROCESSING_COMPLETE)

    def test_hash_task_returns_not_found_for_missing_work(self):
        result = hash_work_task(999999)
        self.assertEqual(result['status'], 'not_found')


class HashTaskDispatchTests(APITestCase):
    """Verify that a successful upload dispatches the Celery hash task."""

    def setUp(self):
        self.user = make_user(username='dispatcher', email='dispatcher@example.com')
        self.work = CreativeWork.objects.create(
            owner=self.user,
            title='Dispatch Test',
            category=CreativeWork.Category.IMAGE,
        )

    @patch('apps.works.tasks.hash_work_task.delay')
    def test_upload_dispatches_hash_task(self, mock_delay):
        upload = sample_png()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.put(
                f'{WORKS_BASE}{self.work.id}/upload/',
                {'file': upload},
                format='multipart',
                **auth_header(self.user),
            )
        mock_delay.assert_called_once_with(self.work.id)

    @patch('apps.works.tasks.hash_work_task.delay')
    def test_failed_upload_does_not_dispatch_hash_task(self, mock_delay):
        bad_file = SimpleUploadedFile('notes.txt', b'hello', content_type='text/plain')
        self.client.put(
            f'{WORKS_BASE}{self.work.id}/upload/',
            {'file': bad_file},
            format='multipart',
            **auth_header(self.user),
        )
        mock_delay.assert_not_called()



