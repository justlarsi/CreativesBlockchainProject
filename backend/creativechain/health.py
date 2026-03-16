"""Health checks for local/dev smoke testing."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from django.conf import settings
from django.db import connection
from django.utils import timezone
from redis import Redis
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def _healthy_result(component: str, details: dict | None = None) -> dict:
    return {
        "component": component,
        "status": "healthy",
        "details": details or {},
    }


def _unhealthy_result(component: str, error_message: str) -> dict:
    return {
        "component": component,
        "status": "unhealthy",
        "details": {"error": error_message},
    }


def _check_database() -> dict:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return _healthy_result("database")
    except Exception as exc:  # pragma: no cover - exercised via API tests
        return _unhealthy_result("database", str(exc))


def _check_redis() -> dict:
    try:
        redis_client = Redis.from_url(settings.REDIS_URL)
        redis_client.ping()
        return _healthy_result("redis")
    except Exception as exc:  # pragma: no cover - exercised via API tests
        return _unhealthy_result("redis", str(exc))


def _check_blockchain() -> dict:
    rpc_url = getattr(settings, "POLYGON_AMOY_RPC_URL", "").strip()
    if not rpc_url:
        return _unhealthy_result("blockchain", "POLYGON_AMOY_RPC_URL is not configured")

    payload = {
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": [],
        "id": 1,
    }

    request = urllib.request.Request(
        url=rpc_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            # Some public RPC gateways reject Python's default urllib user agent.
            "User-Agent": "creativechain-health/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            response_data = json.loads(response.read().decode("utf-8"))

        block_hex = response_data.get("result")
        if not isinstance(block_hex, str):
            return _unhealthy_result("blockchain", "RPC response did not include block number")

        latest_block = int(block_hex, 16)
        return _healthy_result("blockchain", {"latest_block": latest_block})
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return _unhealthy_result("blockchain", str(exc))


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(_request):
    checks = {
        "database": _check_database(),
        "redis": _check_redis(),
        "blockchain": _check_blockchain(),
    }

    is_healthy = all(check["status"] == "healthy" for check in checks.values())
    response_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return Response(
        {
            "status": "healthy" if is_healthy else "unhealthy",
            "timestamp": timezone.now().isoformat(),
            "checks": checks,
        },
        status=response_status,
    )

