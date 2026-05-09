from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import requests


class DashboardApiError(RuntimeError):
    pass


@dataclass
class DashboardApiClient:
    base_url: str
    timeout_seconds: float = 10.0

    @classmethod
    def from_env(cls) -> "DashboardApiClient":
        base_url = os.getenv("DASHBOARD_API_BASE_URL", "http://localhost:8000")
        timeout_seconds = float(os.getenv("DASHBOARD_API_TIMEOUT_SECONDS", "10"))
        return cls(base_url=base_url.rstrip("/"), timeout_seconds=timeout_seconds)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self.base_url}{path}"
        response = requests.request(method, url, timeout=self.timeout_seconds, **kwargs)
        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {"error": {"message": response.text or "request failed"}}
            message = payload.get("error", {}).get("message", "request failed")
            raise DashboardApiError(f"{response.status_code}: {message}")
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/api/health")

    def list_dashboards(self, workspace_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/workspaces/{workspace_id}/dashboards")

    def get_dashboard(self, workspace_id: str, dashboard_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")