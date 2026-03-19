from unittest.mock import patch
from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit_logs.models import AuditLog

from .models import ContentHash, CreativeWork
from .tasks import hash_work_task, pin_work_metadata_task, verify_work_registration_receipt_task

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
        self.pin_dispatch_patcher = patch('apps.works.tasks.pin_work_metadata_task.delay')
        self.mock_pin_dispatch = self.pin_dispatch_patcher.start()
        self.addCleanup(self.pin_dispatch_patcher.stop)

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

    def test_hash_task_dispatches_ipfs_pinning_after_success(self):
        work = self._make_uploaded_work()
        hash_work_task(work.id)
        self.mock_pin_dispatch.assert_called_once_with(work.id)


class IPFSPinningTaskTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='pinner', email='pinner@example.com')
        self.pin_dispatch_patcher = patch('apps.works.tasks.pin_work_metadata_task.delay')
        self.pin_dispatch_patcher.start()
        self.addCleanup(self.pin_dispatch_patcher.stop)

    def _make_processed_work(self, category=CreativeWork.Category.IMAGE, raw=None):
        from django.core.files.base import ContentFile

        work = CreativeWork.objects.create(
            owner=self.user,
            title='IPFS Test Work',
            description='Pin me',
            category=category,
            status=CreativeWork.Status.UPLOADED,
            mime_type='image/png',
            file_size=68,
        )
        content = raw if raw is not None else _minimal_png_bytes()
        work.file.save('test.png', ContentFile(content), save=True)
        hash_work_task(work.id)
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.PROCESSING_COMPLETE)
        return work

    @patch('apps.works.services_ipfs.PinataClient.pin_json', return_value='bafy-step5-cid')
    def test_pin_task_persists_cid_and_sets_explicit_success_status(self, mock_pin_json):
        work = self._make_processed_work()

        result = pin_work_metadata_task(work.id)

        self.assertEqual(result['status'], 'ok')
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.IPFS_PINNING_COMPLETE)
        self.assertEqual(work.ipfs_metadata_cid, 'bafy-step5-cid')
        self.assertIsNotNone(work.ipfs_pinned_at)
        self.assertEqual(work.ipfs_error_message, '')
        mock_pin_json.assert_called_once()

    @patch('apps.works.services_ipfs.PinataClient.pin_json', return_value='bafy-schema-cid')
    def test_pin_task_payload_contains_web3_style_and_required_fields(self, mock_pin_json):
        work = self._make_processed_work()

        pin_work_metadata_task(work.id)

        args, kwargs = mock_pin_json.call_args
        payload = args[0]
        self.assertEqual(payload['name'], work.title)
        self.assertEqual(payload['description'], work.description)
        self.assertIn('attributes', payload)
        self.assertIn('properties', payload)

        properties = payload['properties']
        self.assertEqual(properties['work_id'], work.id)
        self.assertEqual(properties['owner_id'], work.owner_id)
        self.assertEqual(properties['title'], work.title)
        self.assertEqual(properties['description'], work.description)
        self.assertEqual(properties['category'], work.category)
        self.assertEqual(properties['mime_type'], work.mime_type)
        self.assertEqual(properties['file_size'], work.file_size)
        self.assertIn('created_at', properties)
        self.assertIn('content_hashes', properties)
        self.assertIn(ContentHash.HashType.SHA256, properties['content_hashes'])
        self.assertEqual(kwargs['metadata_name'], f'creative-work-{work.id}-metadata')

    @patch('apps.works.services_ipfs.PinataClient.pin_json', side_effect=Exception('unexpected'))
    def test_pin_task_marks_failed_after_retry_exhaustion(self, mock_pin_json):
        work = self._make_processed_work()

        with patch.object(pin_work_metadata_task, 'max_retries', 0):
            result = pin_work_metadata_task(work.id)

        self.assertEqual(result['status'], 'failed')
        work.refresh_from_db()
        self.assertEqual(work.status, CreativeWork.Status.IPFS_PINNING_FAILED)
        self.assertIn('unexpected', work.ipfs_error_message)
        mock_pin_json.assert_called_once()

    @patch('apps.works.services_ipfs.PinataClient.pin_json', side_effect=Exception('temporary pinata outage'))
    def test_pin_task_retries_before_exhaustion(self, _mock_pin_json):
        work = self._make_processed_work()
        # Before exhaustion, Celery retries — expect an exception that wraps the retry
        with self.assertRaises(Exception):
            pin_work_metadata_task(work.id)

    @patch('apps.works.services_ipfs.PinataClient.pin_json', return_value='bafy-visible-cid')
    def test_cid_is_exposed_in_serializer_response(self, _mock_pin_json):
        work = self._make_processed_work()
        pin_work_metadata_task(work.id)

        response = self.client.get(f'{WORKS_BASE}{work.id}/', **auth_header(self.user))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ipfs_metadata_cid', response.data)
        self.assertEqual(response.data['ipfs_metadata_cid'], 'bafy-visible-cid')


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


class BlockchainRegistrationFlowTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='chainuser', email='chain@example.com')
        self.work = CreativeWork.objects.create(
            owner=self.user,
            title='On-chain Work',
            category=CreativeWork.Category.IMAGE,
            status=CreativeWork.Status.IPFS_PINNING_COMPLETE,
            ipfs_metadata_cid='bafy-step5',
        )
        ContentHash.objects.create(
            work=self.work,
            hash_type=ContentHash.HashType.SHA256,
            hash_value='a' * 64,
        )

    @patch('apps.works.services_blockchain._contract_address', return_value='0xbf559FA83ecB20f65030CF1265E2E65a12d67be3')
    def test_prepare_endpoint_returns_to_and_data(self, _mock_address):
        response = self.client.post(
            f'{WORKS_BASE}{self.work.id}/register-blockchain/prepare/',
            {},
            format='json',
            **auth_header(self.user),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('to', response.data)
        self.assertIn('data', response.data)
        self.assertTrue(response.data['data'].startswith('0x'))

    @patch('apps.works.tasks.verify_work_registration_receipt_task.delay')
    def test_receipt_endpoint_returns_202_and_queues_task(self, mock_delay):
        tx_hash = '0x' + 'b' * 64
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f'{WORKS_BASE}{self.work.id}/register-blockchain/receipt/',
                {'tx_hash': tx_hash},
                format='json',
                **auth_header(self.user),
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING)
        self.assertEqual(response.data['tx_hash'], tx_hash)
        self.work.refresh_from_db()
        self.assertEqual(self.work.status, CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING)
        self.assertEqual(self.work.blockchain_tx_hash, tx_hash)
        mock_delay.assert_called_once_with(self.work.id, tx_hash)

    @patch('apps.works.services_blockchain.verify_registration_receipt')
    def test_receipt_task_marks_work_registered(self, mock_verify):
        tx_hash = '0x' + 'c' * 64
        self.work.status = CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING
        self.work.blockchain_tx_hash = tx_hash
        self.work.save(update_fields=['status', 'blockchain_tx_hash', 'updated_at'])

        mock_verify.return_value = {
            'tx_hash': tx_hash,
            'block_number': 123,
            'registration_timestamp': datetime(2026, 3, 19, 12, 0, tzinfo=dt_timezone.utc),
            'explorer_url': f'https://amoy.polygonscan.com/tx/{tx_hash}',
        }

        result = verify_work_registration_receipt_task(self.work.id, tx_hash)

        self.assertEqual(result['status'], 'ok')
        self.work.refresh_from_db()
        self.assertEqual(self.work.status, CreativeWork.Status.REGISTERED)
        self.assertEqual(self.work.blockchain_block_number, 123)

    @patch('apps.works.services_blockchain.verify_registration_receipt')
    def test_receipt_task_marks_failed_after_timeout(self, mock_verify):
        from .services_blockchain import ReceiptPendingError

        tx_hash = '0x' + 'd' * 64
        self.work.status = CreativeWork.Status.BLOCKCHAIN_REGISTRATION_PENDING
        self.work.blockchain_tx_hash = tx_hash
        self.work.save(update_fields=['status', 'blockchain_tx_hash', 'updated_at'])

        mock_verify.side_effect = ReceiptPendingError('still pending')

        with patch.object(verify_work_registration_receipt_task, 'max_retries', 0):
            result = verify_work_registration_receipt_task(self.work.id, tx_hash)

        self.assertEqual(result['status'], 'failed')
        self.work.refresh_from_db()
        self.assertEqual(self.work.status, CreativeWork.Status.BLOCKCHAIN_REGISTRATION_FAILED)



