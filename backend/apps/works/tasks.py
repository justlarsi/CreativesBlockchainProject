from celery import shared_task


@shared_task(name="works.step0_smoke_task")
def step0_smoke_task(payload: str = "ok") -> dict:
    """Simple task used to verify worker consumption during Step 0 checks."""
    return {"status": "ok", "payload": payload}

