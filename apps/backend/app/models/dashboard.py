from __future__ import annotations

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class Dashboard(SQLModel, table=True):
    __tablename__ = "dashboards"
    __table_args__ = (
        UniqueConstraint("workspace_id", "owner_user_id", "dashboard_name"),
        CheckConstraint("refresh_cadence IN ('manual', '15min', '60min')"),
    )

    dashboard_id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    owner_user_id: str
    dashboard_name: str
    description: str | None = None
    refresh_cadence: str = Field(default="manual")
    current_run_id: str | None = None
    last_refreshed_at: str | None = None
    created_at: str
    updated_at: str
    deleted_at: str | None = None


class DashboardPanel(SQLModel, table=True):
    __tablename__ = "dashboard_panels"

    panel_id: str = Field(primary_key=True)
    dashboard_id: str = Field(foreign_key="dashboards.dashboard_id")
    saved_query_id: str = Field(foreign_key="saved_queries.query_id")
    panel_name: str | None = None
    panel_order: int
    is_visible: int = Field(default=1)
    chart_config_json: str | None = None
    parameter_overrides_json: str | None = None
    created_at: str
    updated_at: str


class DashboardRun(SQLModel, table=True):
    __tablename__ = "dashboard_runs"

    run_id: str = Field(primary_key=True)
    dashboard_id: str = Field(foreign_key="dashboards.dashboard_id")
    run_number: int
    triggered_by: str
    status: str
    parameters_json: str
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    total_duration_ms: int | None = None


class DashboardRunPanel(SQLModel, table=True):
    __tablename__ = "dashboard_run_panels"

    run_panel_id: str = Field(primary_key=True)
    run_id: str = Field(foreign_key="dashboard_runs.run_id")
    panel_id: str = Field(foreign_key="dashboard_panels.panel_id")
    status: str
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    row_count: int | None = None
    is_aggregated: int = Field(default=0)
    error_type: str | None = None
    error_message: str | None = None
    chart_suggestion_type: str | None = None
    chart_suggestion_reason: str | None = None
    kpi_value: float | None = None
    kpi_label: str | None = None
    result_columns_json: str | None = None
    result_rows_json: str | None = None


class DashboardRunEvent(SQLModel, table=True):
    __tablename__ = "dashboard_run_events"

    event_id: str = Field(primary_key=True)
    run_id: str = Field(foreign_key="dashboard_runs.run_id")
    event_type: str
    event_details_json: str | None = None
    created_at: str
