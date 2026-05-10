from __future__ import annotations


class DashboardError(RuntimeError):
    """Base dashboard error for governance-friendly exception handling."""


class DashboardConfigError(DashboardError):
    """Raised when dashboard config resolution or validation fails."""


class DashboardApiError(DashboardError):
    """Raised when dashboard backend API calls fail."""
