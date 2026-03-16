from celery.exceptions import TimeoutError
from django.core.management.base import BaseCommand, CommandError

from apps.works.tasks import step0_smoke_task


class Command(BaseCommand):
    help = "Verify Celery worker connectivity by executing a simple smoke task."

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=int,
            default=10,
            help="Seconds to wait for the worker to finish the smoke task (default: 10)",
        )

    def handle(self, *args, **options):
        timeout = options["timeout"]
        async_result = step0_smoke_task.delay("step0")

        try:
            result = async_result.get(timeout=timeout)
        except TimeoutError as exc:
            raise CommandError(
                "Celery worker did not consume the smoke task before timeout."
            ) from exc

        if result.get("status") != "ok":
            raise CommandError(f"Unexpected task result payload: {result}")

        self.stdout.write(self.style.SUCCESS("Celery smoke task consumed successfully."))


