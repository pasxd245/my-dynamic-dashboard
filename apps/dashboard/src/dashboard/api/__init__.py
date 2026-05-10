"""Dashboard API client layer."""

from dashboard.api.backend_client import DashboardApiClient
from dashboard.core.errors import DashboardApiError

__all__ = ["DashboardApiClient", "DashboardApiError"]
