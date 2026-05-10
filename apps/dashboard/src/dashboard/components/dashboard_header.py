from __future__ import annotations

from typing import Any

import streamlit as st


CADENCE_OPTIONS = ["manual", "15min", "60min"]


def render_dashboard_header(
    *,
    dashboard: dict[str, Any],
    service_health: dict[str, Any] | None,
    parameter_chips: dict[str, Any] | None,
) -> tuple[bool, str | None]:
    title = dashboard.get("dashboard_name", "Dashboard")
    workspace_id = dashboard.get("workspace_id", "unknown")
    last_refreshed = dashboard.get("last_refreshed_at") or "Never"
    cadence = str(dashboard.get("refresh_cadence", "manual"))

    st.subheader(title)
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Workspace", workspace_id)
    col2.metric("Last Refresh", str(last_refreshed))
    col3.metric("Cadence", cadence)

    health_text = "unknown"
    if service_health:
        health_text = str(service_health.get("status", "unknown"))
    col4.metric("Health", health_text)

    if parameter_chips:
        chips = [f"{key}={value}" for key, value in parameter_chips.items()]
        st.caption("Parameters: " + " | ".join(chips))

    run_now = st.button("Refresh Now", key="refresh-now")
    new_cadence = st.selectbox(
        "Refresh cadence",
        CADENCE_OPTIONS,
        index=CADENCE_OPTIONS.index(cadence) if cadence in CADENCE_OPTIONS else 0,
    )

    return run_now, new_cadence if new_cadence != cadence else None


def render_run_history(runs: list[dict[str, Any]]) -> None:
    with st.expander("Run History", expanded=False):
        if not runs:
            st.info("No runs yet.")
            return
        timeline_rows = []
        for run in runs:
            timeline_rows.append(
                {
                    "run_id": run.get("run_id"),
                    "run_number": run.get("run_number"),
                    "status": run.get("status"),
                    "triggered_by": run.get("triggered_by"),
                    "created_at": run.get("created_at"),
                    "completed_at": run.get("completed_at"),
                    "duration_ms": run.get("total_duration_ms"),
                }
            )
        st.dataframe(timeline_rows, use_container_width=True)

        selected = st.selectbox(
            "Run for panel status",
            options=[str(run.get("run_id", "")) for run in runs if run.get("run_id")],
            key="run-history-selected-run",
        )
        selected_detail = st.session_state.get("run_details_by_id", {}).get(selected)
        if not selected_detail:
            st.caption("Panel status drilldown unavailable for this run in current session.")
            return

        panel_rows = [
            {
                "panel_id": panel.get("panel_id"),
                "status": panel.get("status"),
                "row_count": panel.get("row_count"),
                "error_type": panel.get("error_type"),
                "error_message": panel.get("error_message"),
            }
            for panel in selected_detail.get("panels", [])
        ]
        st.dataframe(panel_rows, use_container_width=True)


def render_service_health_banner(health: dict[str, Any] | None) -> None:
    if not health:
        return
    status = str(health.get("status", "unknown")).lower()
    if status in {"healthy", "ok"}:
        return
    reason = str(health.get("reason", "Service may be degraded."))
    st.warning(f"Service health: {status}. {reason}")
