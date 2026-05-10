from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from fastapi.responses import Response

from app.api import ApiError, _get_workspace
from app.apps.dashboard_app import DASHBOARD_APP
from app.schemas import (
    AddPanelRequest,
    ChartSuggestion,
    CreateDashboardRequest,
    Dashboard,
    DashboardDetail,
    DashboardPanel,
    DashboardRun,
    DashboardRunDetail,
    ExportDashboardRequest,
    ExportPanelRequest,
    PanelDataResponse,
    RunDashboardRequest,
    SetRefreshCadenceRequest,
    UpdateDashboardRequest,
    UpdatePanelRequest,
)
from app.services.chart_suggestion_service import ChartSuggestionService
from app.services.dashboard_service import (
    DashboardConflictError,
    DashboardNotFoundError,
    DashboardRunConflictError,
    DashboardRunNotFoundError,
    DashboardService,
    DashboardValidationError,
    PanelNotFoundError,
)
from app.services.panel_executor_service import PanelExecutorService, PanelValidationError

router = APIRouter(tags=["dashboards"])


def _dashboard_service() -> DashboardService:
    return DASHBOARD_APP.dashboard_service()


def _handle_dashboard_errors(exc: Exception) -> None:
    if isinstance(exc, DashboardNotFoundError):
        raise ApiError(status_code=404, code="dashboard_not_found", message=str(exc))
    if isinstance(exc, PanelNotFoundError):
        raise ApiError(status_code=404, code="panel_not_found", message=str(exc))
    if isinstance(exc, DashboardRunNotFoundError):
        raise ApiError(status_code=404, code="run_not_found", message=str(exc))
    if isinstance(exc, DashboardConflictError):
        raise ApiError(status_code=409, code="dashboard_conflict", message=str(exc))
    if isinstance(exc, DashboardRunConflictError):
        raise ApiError(status_code=409, code="dashboard_run_conflict", message=str(exc))
    if isinstance(exc, PanelValidationError):
        raise ApiError(status_code=400, code="panel_validation_error", message=str(exc))
    if isinstance(exc, DashboardValidationError):
        raise ApiError(status_code=422, code="dashboard_validation_error", message=str(exc))
    raise ApiError(
        status_code=503,
        code="dashboard_service_unavailable",
        message="Dashboard service temporarily unavailable. Please retry.",
        details={"cause": str(exc)},
    )


_DASHBOARD_HANDLED_ERRORS = (
    DashboardNotFoundError,
    PanelNotFoundError,
    DashboardRunNotFoundError,
    DashboardConflictError,
    DashboardRunConflictError,
    DashboardValidationError,
    PanelValidationError,
)


@router.get("/api/v1/workspaces/{workspace_id}/dashboards")
def list_dashboards(workspace_id: str) -> list[Dashboard]:
    _get_workspace(workspace_id)
    return _dashboard_service().list_dashboards(workspace_id=workspace_id)


@router.post("/api/v1/workspaces/{workspace_id}/dashboards", status_code=201)
def create_dashboard(workspace_id: str, request: CreateDashboardRequest) -> Dashboard:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().create_dashboard(workspace_id=workspace_id, request=request)
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
def get_dashboard(workspace_id: str, dashboard_id: str) -> DashboardDetail:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().get_dashboard_detail(workspace_id=workspace_id, dashboard_id=dashboard_id)
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.patch("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}")
def patch_dashboard(
    workspace_id: str,
    dashboard_id: str,
    request: UpdateDashboardRequest,
) -> Dashboard:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().update_dashboard(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            request=request,
        )
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.delete(
    "/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
)
def delete_dashboard(workspace_id: str, dashboard_id: str) -> Response:
    _get_workspace(workspace_id)
    try:
        _dashboard_service().delete_dashboard(workspace_id=workspace_id, dashboard_id=dashboard_id)
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    return Response(status_code=204)


@router.post("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels", status_code=201)
def add_dashboard_panel(
    workspace_id: str,
    dashboard_id: str,
    request: AddPanelRequest,
) -> DashboardPanel:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().add_panel(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            request=request,
        )
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.patch("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}")
def patch_dashboard_panel(
    workspace_id: str,
    dashboard_id: str,
    panel_id: str,
    request: UpdatePanelRequest,
) -> DashboardPanel:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().update_panel(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            panel_id=panel_id,
            request=request,
        )
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.delete(
    "/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
)
def delete_dashboard_panel(workspace_id: str, dashboard_id: str, panel_id: str) -> Response:
    _get_workspace(workspace_id)
    try:
        _dashboard_service().delete_panel(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            panel_id=panel_id,
        )
    except _DASHBOARD_HANDLED_ERRORS as exc:
        _handle_dashboard_errors(exc)
    return Response(status_code=204)


@router.post("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/run", status_code=202)
def run_dashboard(
    workspace_id: str,
    dashboard_id: str,
    request: RunDashboardRequest,
) -> DashboardRun:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().run_dashboard(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            request=request,
        )
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.patch("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/refresh-cadence")
def set_dashboard_refresh_cadence(
    workspace_id: str,
    dashboard_id: str,
    request: SetRefreshCadenceRequest,
) -> Dashboard:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().set_refresh_cadence(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            request=request,
        )
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs")
def get_dashboard_runs(workspace_id: str, dashboard_id: str, limit: int = 20) -> dict[str, Any]:
    _get_workspace(workspace_id)
    try:
        runs = _dashboard_service().list_runs(workspace_id=workspace_id, dashboard_id=dashboard_id, limit=limit)
        return {"runs": [item.model_dump() for item in runs]}
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}")
def get_dashboard_run(workspace_id: str, dashboard_id: str, run_id: str) -> DashboardRunDetail:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().get_run_detail(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            run_id=run_id,
        )
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/service-health")
def get_dashboard_service_health(workspace_id: str, dashboard_id: str, stale_after_minutes: int = 90) -> dict[str, Any]:
    _get_workspace(workspace_id)
    try:
        dashboard = _dashboard_service().get_dashboard_detail(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
        )
    except Exception as exc:
        _handle_dashboard_errors(exc)
    last_refreshed_at = dashboard.last_refreshed_at
    if not last_refreshed_at:
        return {"status": "stale", "reason": "Dashboard has never been refreshed."}

    try:
        refreshed_at = datetime.fromisoformat(last_refreshed_at.replace("Z", "+00:00"))
    except ValueError:
        return {"status": "degraded", "reason": "Unable to parse refresh timestamp."}

    age_seconds = (datetime.now(tz=timezone.utc) - refreshed_at).total_seconds()
    if age_seconds > stale_after_minutes * 60:
        return {
            "status": "stale",
            "reason": "Dashboard data is older than the stale threshold.",
            "stale_after_minutes": stale_after_minutes,
        }
    return {"status": "healthy", "stale_after_minutes": stale_after_minutes}


@router.get("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/data")
def get_dashboard_panel_data(
    workspace_id: str,
    dashboard_id: str,
    run_id: str,
    panel_id: str,
    limit: int = 1000,
    offset: int = 0,
) -> PanelDataResponse:
    _get_workspace(workspace_id)
    try:
        return _dashboard_service().get_panel_data(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            run_id=run_id,
            panel_id=panel_id,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.get(
    "/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/chart-suggestion"
)
def get_dashboard_chart_suggestion(
    workspace_id: str,
    dashboard_id: str,
    run_id: str,
    panel_id: str,
) -> ChartSuggestion:
    _get_workspace(workspace_id)
    try:
        payload = _dashboard_service().get_chart_suggestion(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            run_id=run_id,
            panel_id=panel_id,
        )
        return ChartSuggestion(**payload)
    except Exception as exc:
        _handle_dashboard_errors(exc)
    raise AssertionError("unreachable")


@router.post("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export")
def export_dashboard_view(
    workspace_id: str,
    dashboard_id: str,
    request: ExportDashboardRequest,
) -> Response:
    _get_workspace(workspace_id)
    try:
        _ = _dashboard_service().get_dashboard_detail(workspace_id=workspace_id, dashboard_id=dashboard_id)
    except Exception as exc:
        _handle_dashboard_errors(exc)

    if request.format == "png":
        return Response(content=b"", media_type="image/png")
    return Response(content=b"%PDF-1.4\n", media_type="application/pdf")


@router.post("/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}/panels/{panel_id}/export")
def export_dashboard_panel_data(
    workspace_id: str,
    dashboard_id: str,
    run_id: str,
    panel_id: str,
    request: ExportPanelRequest,
) -> Response:
    _get_workspace(workspace_id)
    service = _dashboard_service()
    try:
        _ = service.get_panel_data(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            run_id=run_id,
            panel_id=panel_id,
            limit=1000,
            offset=0,
        )
        run_detail = service.get_run_detail(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            run_id=run_id,
        )
        panel = next((item for item in run_detail.panels if item.panel_id == panel_id), None)
        if panel is None:
            raise PanelValidationError(f"Panel '{panel_id}' not found in run.")
        service.panel_executor.ensure_export_eligible(panel_status=panel.status)
    except Exception as exc:
        _handle_dashboard_errors(exc)

    if request.format == "csv":
        return Response(content="", media_type="text/csv")
    return Response(
        content=b"",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
