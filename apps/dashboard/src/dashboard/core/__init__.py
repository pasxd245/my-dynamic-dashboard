"""Core primitives for the dashboard package."""

from dashboard.core.base import ServiceResult
from dashboard.core.errors import DashboardApiError, DashboardConfigError, DashboardError

__all__ = ["DashboardApiError", "DashboardConfigError", "DashboardError", "ServiceResult"]
