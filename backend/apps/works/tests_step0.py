from unittest.mock import Mock, patch

from celery.exceptions import TimeoutError as CeleryTimeoutError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase

from apps.works.tasks import step0_smoke_task


class Step0SmokeTaskTests(SimpleTestCase):
    def test_step0_smoke_task_returns_expected_payload(self):
        result = step0_smoke_task("step0")

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["payload"], "step0")


class VerifyCeleryCommandTests(SimpleTestCase):
    @patch("apps.works.management.commands.verify_celery.step0_smoke_task")
    def test_verify_celery_command_succeeds_when_task_is_consumed(self, mock_task):
        mock_async_result = Mock()
        mock_async_result.get.return_value = {"status": "ok", "payload": "step0"}
        mock_task.delay.return_value = mock_async_result

        call_command("verify_celery", timeout=1)

        mock_task.delay.assert_called_once_with("step0")
        mock_async_result.get.assert_called_once_with(timeout=1)

    @patch("apps.works.management.commands.verify_celery.step0_smoke_task")
    def test_verify_celery_command_raises_on_timeout(self, mock_task):
        mock_async_result = Mock()
        mock_async_result.get.side_effect = CeleryTimeoutError("timed out")
        mock_task.delay.return_value = mock_async_result

        with self.assertRaisesMessage(
            CommandError,
            "Celery worker did not consume the smoke task before timeout.",
        ):
            call_command("verify_celery", timeout=1)

