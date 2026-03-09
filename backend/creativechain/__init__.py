"""
Celery app import.

We keep this optional so `runserver` can start even if Celery isn't installed yet.
"""

try:
    # This will make sure the app is always imported when
    # Django starts so that shared_task will use this app.
    from .celery import app as celery_app  # type: ignore
except Exception:  # pragma: no cover
    celery_app = None  # type: ignore

__all__ = ("celery_app",)
