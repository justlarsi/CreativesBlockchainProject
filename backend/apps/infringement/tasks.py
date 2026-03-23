from __future__ import annotations

from celery import shared_task
from celery.utils.log import get_task_logger
from django.core.mail import send_mail

from apps.audit_logs.models import AuditLog
from apps.works.models import CreativeWork

from .models import InfringementAlert
from .services import default_daily_candidates_for_work, run_simulated_scan_for_work

logger = get_task_logger(__name__)


@shared_task(name='infringement.scan_work_for_alerts')
def scan_work_for_infringement_task(work_id: int, candidates: list[dict]) -> dict:
    try:
        work = (
            CreativeWork.objects
            .select_related('owner')
            .prefetch_related('content_hashes')
            .get(id=work_id)
        )
    except CreativeWork.DoesNotExist:
        return {'status': 'not_found', 'work_id': work_id}

    result = run_simulated_scan_for_work(work, candidates)

    for alert_id in result['created_alert_ids']:
        queue_infringement_notification_task.delay(alert_id)

    return {'status': 'ok', **result}


@shared_task(name='infringement.daily_simulated_scan')
def run_daily_simulated_scan_task() -> dict:
    queued = 0
    for work in CreativeWork.objects.filter(status=CreativeWork.Status.REGISTERED).only('id', 'title', 'description'):
        scan_work_for_infringement_task.delay(work.id, default_daily_candidates_for_work(work))
        queued += 1

    logger.info('run_daily_simulated_scan_task: queued %s works', queued)
    return {'status': 'ok', 'queued_works': queued}


@shared_task(name='infringement.queue_alert_notification')
def queue_infringement_notification_task(alert_id: int) -> dict:
    try:
        alert = (
            InfringementAlert.objects
            .select_related('creator', 'work')
            .get(id=alert_id)
        )
    except InfringementAlert.DoesNotExist:
        return {'status': 'not_found', 'alert_id': alert_id}

    send_mail(
        subject=f'CreativeChain Alert: Possible infringement for "{alert.work.title}"',
        message=(
            'A possible infringement was detected for your registered work.\n\n'
            f'Work ID: {alert.work_id}\n'
            f'Alert ID: {alert.id}\n'
            f'Severity: {alert.severity}\n'
            f'Source: {alert.source_url}\n'
            f'Reason: {alert.detection_reason}\n'
        ),
        from_email=None,
        recipient_list=[alert.creator.email],
        fail_silently=True,
    )

    AuditLog.objects.create(
        user=alert.creator,
        action='infringement_alert_notification_queued',
        entity_type='infringement_alert',
        entity_id=str(alert.id),
        metadata={
            'work_id': alert.work_id,
            'severity': alert.severity,
            'source_url': alert.source_url,
        },
    )

    return {'status': 'ok', 'alert_id': alert.id}

