from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.metadata_db import get_connection
from app.schemas import (
    AddPanelRequest,
    CreateDashboardRequest,
    Dashboard,
    DashboardDetail,
    DashboardPanel,
    DashboardRun,
    DashboardRunDetail,
    DashboardRunPanel,
    DashboardRunSummary,
    PanelDataResponse,
    RunDashboardRequest,
    SetRefreshCadenceRequest,
    UpdateDashboardRequest,
    UpdatePanelRequest,
)
from app.services.panel_executor_service import PanelExecutorService, PanelValidationError


class DashboardNotFoundError(Exception):
    pass


class DashboardConflictError(Exception):
    pass


class DashboardValidationError(Exception):
    pass


class DashboardRunConflictError(Exception):
    pass


class DashboardRunNotFoundError(Exception):
    pass


class PanelNotFoundError(Exception):
    pass


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@dataclass
class DashboardService:
    db_path: Path
    panel_executor: PanelExecutorService

    def _dashboard_from_row(self, row: Any) -> Dashboard:
        return Dashboard(
            dashboard_id=str(row["dashboard_id"]),
            workspace_id=str(row["workspace_id"]),
            owner_user_id=str(row["owner_user_id"]),
            dashboard_name=str(row["dashboard_name"]),
            description=row["description"],
            refresh_cadence=str(row["refresh_cadence"]),
            last_refreshed_at=row["last_refreshed_at"],
            current_run_id=row["current_run_id"],
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    def _panel_from_row(self, row: Any) -> DashboardPanel:
        return DashboardPanel(
            panel_id=str(row["panel_id"]),
            dashboard_id=str(row["dashboard_id"]),
            saved_query_id=str(row["saved_query_id"]),
            panel_name=row["panel_name"],
            panel_order=int(row["panel_order"]),
            is_visible=bool(row["is_visible"]),
            chart_config_json=json.loads(row["chart_config_json"]) if row["chart_config_json"] else None,
            parameter_overrides_json=(
                json.loads(row["parameter_overrides_json"]) if row["parameter_overrides_json"] else None
            ),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    def _run_from_row(self, row: Any) -> DashboardRun:
        return DashboardRun(
            run_id=str(row["run_id"]),
            dashboard_id=str(row["dashboard_id"]),
            run_number=int(row["run_number"]),
            triggered_by=str(row["triggered_by"]),
            status=str(row["status"]),
            parameters_json=json.loads(row["parameters_json"]) if row["parameters_json"] else {},
            created_at=str(row["created_at"]),
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            total_duration_ms=row["total_duration_ms"],
        )

    def _run_panel_from_row(self, row: Any) -> DashboardRunPanel:
        return DashboardRunPanel(
            run_panel_id=str(row["run_panel_id"]),
            panel_id=str(row["panel_id"]),
            status=str(row["status"]),
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            duration_ms=row["duration_ms"],
            row_count=row["row_count"],
            is_aggregated=bool(row["is_aggregated"]),
            error_type=row["error_type"],
            error_message=row["error_message"],
            chart_suggestion_type=row["chart_suggestion_type"],
            chart_suggestion_reason=row["chart_suggestion_reason"],
            kpi_value=row["kpi_value"],
            kpi_label=row["kpi_label"],
        )

    def _get_dashboard_row(self, conn: Any, *, workspace_id: str, dashboard_id: str) -> Any:
        row = conn.execute(
            """
            SELECT * FROM dashboards
            WHERE dashboard_id = ? AND workspace_id = ? AND deleted_at IS NULL
            """,
            (dashboard_id, workspace_id),
        ).fetchone()
        if row is None:
            raise DashboardNotFoundError(f"Dashboard '{dashboard_id}' not found.")
        return row

    def _ensure_saved_query(self, conn: Any, *, workspace_id: str, saved_query_id: str) -> dict[str, Any]:
        row = conn.execute(
            """
            SELECT query_id, query_config
            FROM saved_queries
            WHERE query_id = ? AND workspace_id = ? AND deleted_at IS NULL
            """,
            (saved_query_id, workspace_id),
        ).fetchone()
        if row is None:
            raise DashboardValidationError(f"Saved query '{saved_query_id}' not found in workspace.")
        snapshot_raw = row["query_config"]
        snapshot: dict[str, Any]
        try:
            snapshot = json.loads(snapshot_raw) if snapshot_raw else {}
        except json.JSONDecodeError:
            snapshot = {}
        return {"query_id": str(row["query_id"]), "snapshot": snapshot}

    def list_dashboards(self, *, workspace_id: str, owner_user_id: str = "system") -> list[Dashboard]:
        with get_connection(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT * FROM dashboards
                WHERE workspace_id = ? AND owner_user_id = ? AND deleted_at IS NULL
                ORDER BY updated_at DESC
                """,
                (workspace_id, owner_user_id),
            ).fetchall()
        return [self._dashboard_from_row(row) for row in rows]

    def create_dashboard(
        self,
        *,
        workspace_id: str,
        request: CreateDashboardRequest,
        owner_user_id: str = "system",
    ) -> Dashboard:
        now = _utc_now_iso()
        dashboard_id = str(uuid.uuid4())
        with get_connection(self.db_path) as conn:
            existing = conn.execute(
                """
                SELECT dashboard_id FROM dashboards
                WHERE workspace_id = ? AND owner_user_id = ? AND dashboard_name = ? AND deleted_at IS NULL
                """,
                (workspace_id, owner_user_id, request.dashboard_name),
            ).fetchone()
            if existing is not None:
                raise DashboardConflictError(f"Dashboard name '{request.dashboard_name}' already exists.")

            conn.execute(
                """
                INSERT INTO dashboards (
                    dashboard_id, workspace_id, owner_user_id, dashboard_name, description,
                    refresh_cadence, current_run_id, last_refreshed_at, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
                """,
                (
                    dashboard_id,
                    workspace_id,
                    owner_user_id,
                    request.dashboard_name,
                    request.description,
                    request.refresh_cadence,
                    now,
                    now,
                ),
            )
            row = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
        return self._dashboard_from_row(row)

    def get_dashboard_detail(self, *, workspace_id: str, dashboard_id: str) -> DashboardDetail:
        with get_connection(self.db_path) as conn:
            dashboard_row = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            panel_rows = conn.execute(
                """
                SELECT * FROM dashboard_panels
                WHERE dashboard_id = ?
                ORDER BY panel_order ASC
                """,
                (dashboard_id,),
            ).fetchall()

        dashboard = self._dashboard_from_row(dashboard_row)
        return DashboardDetail(**dashboard.model_dump(), panels=[self._panel_from_row(row) for row in panel_rows])

    def update_dashboard(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        request: UpdateDashboardRequest,
    ) -> Dashboard:
        now = _utc_now_iso()
        with get_connection(self.db_path) as conn:
            row = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)

            dashboard_name = request.dashboard_name if request.dashboard_name is not None else row["dashboard_name"]
            description = request.description if request.description is not None else row["description"]
            cadence = request.refresh_cadence if request.refresh_cadence is not None else row["refresh_cadence"]

            if request.dashboard_name:
                conflict = conn.execute(
                    """
                    SELECT dashboard_id FROM dashboards
                    WHERE workspace_id = ? AND owner_user_id = ? AND dashboard_name = ?
                      AND deleted_at IS NULL AND dashboard_id != ?
                    """,
                    (workspace_id, row["owner_user_id"], request.dashboard_name, dashboard_id),
                ).fetchone()
                if conflict is not None:
                    raise DashboardConflictError(f"Dashboard name '{request.dashboard_name}' already exists.")

            conn.execute(
                """
                UPDATE dashboards
                SET dashboard_name = ?, description = ?, refresh_cadence = ?, updated_at = ?
                WHERE dashboard_id = ?
                """,
                (dashboard_name, description, cadence, now, dashboard_id),
            )
            updated = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
        return self._dashboard_from_row(updated)

    def delete_dashboard(self, *, workspace_id: str, dashboard_id: str) -> None:
        now = _utc_now_iso()
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            conn.execute(
                "UPDATE dashboards SET deleted_at = ?, updated_at = ? WHERE dashboard_id = ?",
                (now, now, dashboard_id),
            )

    def add_panel(self, *, workspace_id: str, dashboard_id: str, request: AddPanelRequest) -> DashboardPanel:
        panel_id = str(uuid.uuid4())
        now = _utc_now_iso()
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            _ = self._ensure_saved_query(conn, workspace_id=workspace_id, saved_query_id=request.saved_query_id)
            next_order = conn.execute(
                "SELECT COALESCE(MAX(panel_order), -1) + 1 AS next_order FROM dashboard_panels WHERE dashboard_id = ?",
                (dashboard_id,),
            ).fetchone()["next_order"]

            conn.execute(
                """
                INSERT INTO dashboard_panels (
                    panel_id, dashboard_id, saved_query_id, panel_name, panel_order, is_visible,
                    chart_config_json, parameter_overrides_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                """,
                (
                    panel_id,
                    dashboard_id,
                    request.saved_query_id,
                    request.panel_name,
                    int(next_order),
                    json.dumps(request.chart_config_json) if request.chart_config_json is not None else None,
                    json.dumps(request.parameter_overrides_json)
                    if request.parameter_overrides_json is not None
                    else None,
                    now,
                    now,
                ),
            )
            panel_row = conn.execute("SELECT * FROM dashboard_panels WHERE panel_id = ?", (panel_id,)).fetchone()
            conn.execute("UPDATE dashboards SET updated_at = ? WHERE dashboard_id = ?", (now, dashboard_id))
        return self._panel_from_row(panel_row)

    def update_panel(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        panel_id: str,
        request: UpdatePanelRequest,
    ) -> DashboardPanel:
        now = _utc_now_iso()
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            row = conn.execute(
                "SELECT * FROM dashboard_panels WHERE panel_id = ? AND dashboard_id = ?",
                (panel_id, dashboard_id),
            ).fetchone()
            if row is None:
                raise PanelNotFoundError(f"Panel '{panel_id}' not found.")

            panel_order = request.panel_order if request.panel_order is not None else int(row["panel_order"])
            panel_name = request.panel_name if request.panel_name is not None else row["panel_name"]
            is_visible = request.is_visible if request.is_visible is not None else bool(row["is_visible"])
            chart_config_json = (
                json.dumps(request.chart_config_json)
                if request.chart_config_json is not None
                else row["chart_config_json"]
            )
            parameter_overrides_json = (
                json.dumps(request.parameter_overrides_json)
                if request.parameter_overrides_json is not None
                else row["parameter_overrides_json"]
            )

            conn.execute(
                """
                UPDATE dashboard_panels
                SET panel_order = ?, panel_name = ?, is_visible = ?, chart_config_json = ?,
                    parameter_overrides_json = ?, updated_at = ?
                WHERE panel_id = ?
                """,
                (
                    panel_order,
                    panel_name,
                    int(is_visible),
                    chart_config_json,
                    parameter_overrides_json,
                    now,
                    panel_id,
                ),
            )
            panel_row = conn.execute("SELECT * FROM dashboard_panels WHERE panel_id = ?", (panel_id,)).fetchone()

            if request.panel_order is not None:
                reordered = conn.execute(
                    "SELECT panel_id FROM dashboard_panels WHERE dashboard_id = ? ORDER BY panel_order, created_at",
                    (dashboard_id,),
                ).fetchall()
                for idx, panel in enumerate(reordered):
                    conn.execute(
                        "UPDATE dashboard_panels SET panel_order = ? WHERE panel_id = ?",
                        (idx, panel["panel_id"]),
                    )
                panel_row = conn.execute("SELECT * FROM dashboard_panels WHERE panel_id = ?", (panel_id,)).fetchone()

            conn.execute("UPDATE dashboards SET updated_at = ? WHERE dashboard_id = ?", (now, dashboard_id))
        return self._panel_from_row(panel_row)

    def delete_panel(self, *, workspace_id: str, dashboard_id: str, panel_id: str) -> None:
        now = _utc_now_iso()
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            row = conn.execute(
                "SELECT panel_id FROM dashboard_panels WHERE panel_id = ? AND dashboard_id = ?",
                (panel_id, dashboard_id),
            ).fetchone()
            if row is None:
                raise PanelNotFoundError(f"Panel '{panel_id}' not found.")

            conn.execute("DELETE FROM dashboard_panels WHERE panel_id = ?", (panel_id,))
            remaining = conn.execute(
                "SELECT panel_id FROM dashboard_panels WHERE dashboard_id = ? ORDER BY panel_order, created_at",
                (dashboard_id,),
            ).fetchall()
            for idx, panel in enumerate(remaining):
                conn.execute(
                    "UPDATE dashboard_panels SET panel_order = ?, updated_at = ? WHERE panel_id = ?",
                    (idx, now, panel["panel_id"]),
                )
            conn.execute("UPDATE dashboards SET updated_at = ? WHERE dashboard_id = ?", (now, dashboard_id))

    def _ensure_no_overlap(self, conn: Any, *, dashboard_id: str) -> None:
        active = conn.execute(
            "SELECT run_id FROM dashboard_runs WHERE dashboard_id = ? AND status IN ('pending', 'running')",
            (dashboard_id,),
        ).fetchone()
        if active is not None:
            raise DashboardRunConflictError("Dashboard run already in progress.")

    def _record_run_event(
        self,
        conn: Any,
        *,
        run_id: str,
        event_type: str,
        event_details: dict[str, Any] | None = None,
    ) -> None:
        conn.execute(
            """
            INSERT INTO dashboard_run_events (event_id, run_id, event_type, event_details_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                run_id,
                event_type,
                json.dumps(event_details or {}),
                _utc_now_iso(),
            ),
        )

    def _transition_run_status(
        self,
        conn: Any,
        *,
        run_id: str,
        status: str,
        completed_at: str | None = None,
        total_duration_ms: int | None = None,
    ) -> None:
        conn.execute(
            """
            UPDATE dashboard_runs
            SET status = ?, completed_at = ?, total_duration_ms = ?
            WHERE run_id = ?
            """,
            (status, completed_at, total_duration_ms, run_id),
        )

    def run_dashboard(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        request: RunDashboardRequest,
    ) -> DashboardRun:
        now = _utc_now_iso()
        started_monotonic = time.monotonic()
        run_id = str(uuid.uuid4())
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            self._ensure_no_overlap(conn, dashboard_id=dashboard_id)

            last_run = conn.execute(
                "SELECT COALESCE(MAX(run_number), 0) AS max_run FROM dashboard_runs WHERE dashboard_id = ?",
                (dashboard_id,),
            ).fetchone()["max_run"]
            run_number = int(last_run) + 1

            conn.execute(
                """
                INSERT INTO dashboard_runs (
                    run_id, dashboard_id, run_number, triggered_by, status, parameters_json,
                    created_at, started_at, completed_at, total_duration_ms
                ) VALUES (?, ?, ?, 'manual', 'running', ?, ?, ?, NULL, NULL)
                """,
                (run_id, dashboard_id, run_number, json.dumps(request.parameters), now, now),
            )
            self._record_run_event(conn, run_id=run_id, event_type="run_started")

            panel_rows = conn.execute(
                "SELECT * FROM dashboard_panels WHERE dashboard_id = ? ORDER BY panel_order ASC",
                (dashboard_id,),
            ).fetchall()

            for panel in panel_rows:
                run_panel_id = str(uuid.uuid4())
                panel_started_at = _utc_now_iso()
                panel_status = "completed"
                error_type = None
                error_message = None
                chart_type = "table_only"
                chart_reason = "No data available."
                rows: list[list[Any]] = []
                columns: list[dict[str, Any]] = []
                row_count = 0

                try:
                    sq = self._ensure_saved_query(
                        conn,
                        workspace_id=workspace_id,
                        saved_query_id=str(panel["saved_query_id"]),
                    )
                    panel_overrides = (
                        json.loads(panel["parameter_overrides_json"]) if panel["parameter_overrides_json"] else {}
                    )
                    merged = self.panel_executor.merge_run_parameters(
                        dashboard_parameters=request.parameters,
                        panel_overrides=panel_overrides,
                        snapshot=sq["snapshot"],
                    )
                    columns = self.panel_executor.default_columns_from_snapshot(sq["snapshot"])
                    suggestion = self.panel_executor.chart_service.suggest(columns=columns, rows=rows)
                    chart_type = suggestion.chart_type
                    chart_reason = suggestion.reason
                    row_count = len(rows)
                except (DashboardValidationError, PanelValidationError) as exc:
                    panel_status = "failed"
                    error_type = "validation"
                    error_message = str(exc)
                except TimeoutError as exc:
                    panel_status = "timeout"
                    error_type = "timeout"
                    error_message = str(exc) or "Panel execution timed out."
                except Exception as exc:  # pragma: no cover - defensive safety net
                    panel_status = "failed"
                    error_type = "unexpected"
                    error_message = str(exc)

                panel_completed_at = _utc_now_iso()
                conn.execute(
                    """
                    INSERT INTO dashboard_run_panels (
                        run_panel_id, run_id, panel_id, status, started_at, completed_at, duration_ms,
                        row_count, is_aggregated, error_type, error_message,
                        chart_suggestion_type, chart_suggestion_reason,
                        kpi_value, kpi_label, result_columns_json, result_rows_json
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, NULL, NULL, ?, ?)
                    """,
                    (
                        run_panel_id,
                        run_id,
                        panel["panel_id"],
                        panel_status,
                        panel_started_at,
                        panel_completed_at,
                        row_count,
                        error_type,
                        error_message,
                        chart_type,
                        chart_reason,
                        json.dumps(columns),
                        json.dumps(rows),
                    ),
                )
                self._record_run_event(
                    conn,
                    run_id=run_id,
                    event_type="panel_completed" if panel_status == "completed" else "panel_failed",
                    event_details={
                        "panel_id": str(panel["panel_id"]),
                        "status": panel_status,
                        "error_type": error_type,
                    },
                )

            completed_at = _utc_now_iso()
            total_duration_ms = int((time.monotonic() - started_monotonic) * 1000)
            self._transition_run_status(
                conn,
                run_id=run_id,
                status="completed",
                completed_at=completed_at,
                total_duration_ms=total_duration_ms,
            )
            self._record_run_event(conn, run_id=run_id, event_type="run_completed")
            conn.execute(
                """
                UPDATE dashboards
                SET current_run_id = ?, last_refreshed_at = ?, updated_at = ?
                WHERE dashboard_id = ?
                """,
                (run_id, completed_at, completed_at, dashboard_id),
            )

            run_row = conn.execute("SELECT * FROM dashboard_runs WHERE run_id = ?", (run_id,)).fetchone()
        return self._run_from_row(run_row)

    def set_refresh_cadence(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        request: SetRefreshCadenceRequest,
    ) -> Dashboard:
        return self.update_dashboard(
            workspace_id=workspace_id,
            dashboard_id=dashboard_id,
            request=UpdateDashboardRequest(refresh_cadence=request.refresh_cadence),
        )

    def list_runs(self, *, workspace_id: str, dashboard_id: str, limit: int = 20) -> list[DashboardRunSummary]:
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            rows = conn.execute(
                """
                SELECT * FROM dashboard_runs
                WHERE dashboard_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (dashboard_id, limit),
            ).fetchall()

        summaries: list[DashboardRunSummary] = []
        for row in rows:
            summaries.append(
                DashboardRunSummary(
                    run_id=str(row["run_id"]),
                    run_number=int(row["run_number"]),
                    status=str(row["status"]),
                    triggered_by=str(row["triggered_by"]),
                    created_at=str(row["created_at"]),
                    completed_at=row["completed_at"],
                    total_duration_ms=row["total_duration_ms"],
                )
            )
        return summaries

    def get_run_detail(self, *, workspace_id: str, dashboard_id: str, run_id: str) -> DashboardRunDetail:
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            run_row = conn.execute(
                "SELECT * FROM dashboard_runs WHERE run_id = ? AND dashboard_id = ?",
                (run_id, dashboard_id),
            ).fetchone()
            if run_row is None:
                raise DashboardRunNotFoundError(f"Run '{run_id}' not found.")

            panel_rows = conn.execute(
                "SELECT * FROM dashboard_run_panels WHERE run_id = ? ORDER BY started_at ASC",
                (run_id,),
            ).fetchall()

        run = self._run_from_row(run_row)
        return DashboardRunDetail(**run.model_dump(), panels=[self._run_panel_from_row(row) for row in panel_rows])

    def get_panel_data(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        run_id: str,
        panel_id: str,
        limit: int,
        offset: int,
    ) -> PanelDataResponse:
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            run_row = conn.execute(
                "SELECT run_id FROM dashboard_runs WHERE run_id = ? AND dashboard_id = ?",
                (run_id, dashboard_id),
            ).fetchone()
            if run_row is None:
                raise DashboardRunNotFoundError(f"Run '{run_id}' not found.")

            panel_row = conn.execute(
                """
                SELECT * FROM dashboard_run_panels
                WHERE run_id = ? AND panel_id = ?
                """,
                (run_id, panel_id),
            ).fetchone()
            if panel_row is None:
                raise PanelNotFoundError(f"Panel '{panel_id}' not found in run.")

        columns = self.panel_executor.parse_columns(panel_row["result_columns_json"])
        rows = self.panel_executor.parse_rows(panel_row["result_rows_json"])
        return self.panel_executor.panel_data_response(
            panel_id=panel_id,
            columns=columns,
            rows=rows,
            is_aggregated=bool(panel_row["is_aggregated"]),
            limit=limit,
            offset=offset,
        )

    def get_chart_suggestion(
        self,
        *,
        workspace_id: str,
        dashboard_id: str,
        run_id: str,
        panel_id: str,
    ) -> dict[str, Any]:
        with get_connection(self.db_path) as conn:
            _ = self._get_dashboard_row(conn, workspace_id=workspace_id, dashboard_id=dashboard_id)
            panel_row = conn.execute(
                """
                SELECT chart_suggestion_type, chart_suggestion_reason, result_columns_json
                FROM dashboard_run_panels
                WHERE run_id = ? AND panel_id = ?
                """,
                (run_id, panel_id),
            ).fetchone()
            if panel_row is None:
                raise PanelNotFoundError(f"Panel '{panel_id}' not found in run.")

        columns = self.panel_executor.parse_columns(panel_row["result_columns_json"])
        chart_type = panel_row["chart_suggestion_type"] or "table_only"
        reason = panel_row["chart_suggestion_reason"] or "No chart suggestion available."

        axes: dict[str, str] | None = None
        if len(columns) >= 2:
            axes = {"x": str(columns[0].get("name", "x")), "y": str(columns[1].get("name", "y"))}

        return {"chart_type": chart_type, "reason": reason, "axes": axes}
