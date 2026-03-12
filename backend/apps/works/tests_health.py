from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase


class HealthEndpointTests(APITestCase):
    @patch("creativechain.health._check_database")
    @patch("creativechain.health._check_redis")
    @patch("creativechain.health._check_blockchain")
    def test_health_is_healthy_when_all_checks_pass(
        self,
        mock_blockchain_check,
        mock_redis_check,
        mock_db_check,
    ):
        mock_db_check.return_value = {"component": "database", "status": "healthy", "details": {}}
        mock_redis_check.return_value = {"component": "redis", "status": "healthy", "details": {}}
        mock_blockchain_check.return_value = {
            "component": "blockchain",
            "status": "healthy",
            "details": {"latest_block": 1},
        }

        response = self.client.get("/api/v1/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")
        self.assertIn("database", response.data["checks"])
        self.assertIn("redis", response.data["checks"])
        self.assertIn("blockchain", response.data["checks"])

    @patch("creativechain.health._check_database")
    @patch("creativechain.health._check_redis")
    @patch("creativechain.health._check_blockchain")
    def test_health_is_unhealthy_when_any_check_fails(
        self,
        mock_blockchain_check,
        mock_redis_check,
        mock_db_check,
    ):
        mock_db_check.return_value = {"component": "database", "status": "healthy", "details": {}}
        mock_redis_check.return_value = {"component": "redis", "status": "healthy", "details": {}}
        mock_blockchain_check.return_value = {
            "component": "blockchain",
            "status": "unhealthy",
            "details": {"error": "rpc down"},
        }

        response = self.client.get("/health")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["status"], "unhealthy")
        self.assertEqual(response.data["checks"]["blockchain"]["status"], "unhealthy")

