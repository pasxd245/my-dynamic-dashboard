from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from dashboard.core.errors import DashboardApiError
from dashboard.shared import DashboardAppConfig, get_app_config


@dataclass
class DashboardApiClient:
    base_url: str
    timeout_seconds: float = 10.0
    retries: int = 2

    def __post_init__(self) -> None:
        self._session = requests.Session()
        retry_policy = Retry(
            total=self.retries,
            backoff_factor=0.5,
            status_forcelist=[408, 429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PATCH", "DELETE"],
        )
        adapter = HTTPAdapter(max_retries=retry_policy)
        self._session.mount("http://", adapter)
        self._session.mount("https://", adapter)

    @classmethod
    def from_config(cls, config: DashboardAppConfig) -> "DashboardApiClient":
        return cls(
            base_url=config.api_base_url.rstrip("/"),
            timeout_seconds=config.api_timeout_seconds,
            retries=config.api_retries,
        )

    @classmethod
    def from_env(cls) -> "DashboardApiClient":
        return cls.from_config(get_app_config())

    def map_error_message(self, status_code: int, message: str) -> str:
        lowered = message.lower()
        if "required" in lowered or "undeclared" in lowered:
            return f"Validation error: {message}"
        if "schema" in lowered:
            return f"Schema drift: {message}"
        if "relationship" in lowered:
            return f"Broken relationship: {message}"
        if "timeout" in lowered:
            return f"Timeout: {message}"
        if status_code >= 500:
            return "Unexpected server error. Please retry."
        return message

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self.base_url}{path}"
        response = self._session.request(method, url, timeout=self.timeout_seconds, **kwargs)
        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {"error": {"message": response.text or "request failed"}}
            message = payload.get("error", {}).get("message", "request failed")
            mapped = self.map_error_message(response.status_code, message)
            raise DashboardApiError(f"{response.status_code}: {mapped}")
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

    def add_panel(self, workspace_id: str, dashboard_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels",
            json=payload,
        )

    def patch_panel(
        self,
        workspace_id: str,
        dashboard_id: str,
        panel_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}",
            json=payload,
        )

    def delete_panel(self, workspace_id: str, dashboard_id: str, panel_id: str) -> None:
        self._request(
            "DELETE",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}",
        )

    def run_dashboard(self, workspace_id: str, dashboard_id: str, parameters: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run",
            json={"parameters": parameters},
        )

    def set_refresh_cadence(self, workspace_id: str, dashboard_id: str, cadence: str) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/refresh-cadence",
            json={"refresh_cadence": cadence},
        )

    def list_runs(self, workspace_id: str, dashboard_id: str, limit: int = 20) -> list[dict[str, Any]]:
        payload = self._request(
            "GET",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs?limit={limit}",
        )
        return list(payload.get("runs", []))

    def get_run_detail(self, workspace_id: str, dashboard_id: str, run_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}",
        )

    def get_panel_data(
        self,
        workspace_id: str,
        dashboard_id: str,
        run_id: str,
        panel_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            (
                f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}"
                f"/panels/{panel_id}/data?limit={limit}&offset={offset}"
            ),
        )

    def get_chart_suggestion(
        self,
        workspace_id: str,
        dashboard_id: str,
        run_id: str,
        panel_id: str,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            (
                f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}"
                f"/panels/{panel_id}/chart-suggestion"
            ),
        )

    def export_dashboard(self, workspace_id: str, dashboard_id: str, file_format: str) -> bytes:
        response = self._session.post(
            f"{self.base_url}/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export",
            json={"format": file_format},
            timeout=self.timeout_seconds,
        )
        if response.status_code >= 400:
            raise DashboardApiError(f"{response.status_code}: failed to export dashboard")
        return response.content

    def export_panel(
        self,
        workspace_id: str,
        dashboard_id: str,
        run_id: str,
        panel_id: str,
        file_format: str,
    ) -> bytes:
        response = self._session.post(
            (
                f"{self.base_url}/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}"
                f"/panels/{panel_id}/export"
            ),
            json={"format": file_format},
            timeout=self.timeout_seconds,
        )
        if response.status_code >= 400:
            raise DashboardApiError(f"{response.status_code}: failed to export panel")
        return response.content

    def get_service_health(self, workspace_id: str, dashboard_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/service-health",
        )