from __future__ import annotations

from typing import Any

import streamlit as st

from src.components.chart_viewer import render_chart, render_chart_config_editor
from src.components.export_controls import render_panel_export_controls


def render_panel_controls(panel: dict[str, Any]) -> tuple[bool, bool, bool]:
    panel_id = str(panel.get("panel_id", ""))
    col1, col2, col3 = st.columns(3)
    remove = col1.button("Remove", key=f"remove-{panel_id}")
    move_up = col2.button("Move Up", key=f"move-up-{panel_id}")
    move_down = col3.button("Move Down", key=f"move-down-{panel_id}")
    return remove, move_up, move_down


def render_query_panel(
    *,
    panel: dict[str, Any],
    run_panel: dict[str, Any] | None,
    panel_data: dict[str, Any] | None,
    chart_suggestion: dict[str, Any] | None,
) -> dict[str, Any]:
    panel_id = str(panel.get("panel_id", ""))
    panel_name = panel.get("panel_name") or panel.get("saved_query_id", "Panel")

    st.markdown(f"### {panel_name}")
    st.caption(
        f"Panel ID: {panel_id} | Status: {(run_panel or {}).get('status', 'pending')} | "
        f"Version: {(run_panel or {}).get('saved_query_version_id', 'latest')}"
    )

    remove, move_up, move_down = render_panel_controls(panel)

    if run_panel and run_panel.get("error_type"):
        error_type = run_panel.get("error_type")
        message = run_panel.get("error_message") or "Unknown panel error"
        st.error(f"{error_type}: {message}")
        retry = st.button("Retry Panel", key=f"retry-{panel_id}")
    else:
        retry = False

    if run_panel and run_panel.get("status") == "running":
        st.info("Panel is still running...")

    kpi_value = (run_panel or {}).get("kpi_value")
    if kpi_value is not None:
        trust = "decision-ready" if (run_panel or {}).get("error_type") is None else "exploratory"
        st.metric(label=f"KPI ({trust})", value=kpi_value)

    if panel_data:
        rows = panel_data.get("rows", [])
        columns = panel_data.get("columns", [])
        row_count = panel_data.get("row_count", len(rows))
        has_more = panel_data.get("has_more", False)
        st.caption(f"Rows: {row_count} | Has more: {has_more}")

        render_chart(chart_suggestion=chart_suggestion, rows=rows, columns=columns)
        st.dataframe(rows, use_container_width=True)

        with st.expander("Lineage", expanded=False):
            st.json(
                {
                    "panel_id": panel_id,
                    "chart_suggestion": chart_suggestion,
                }
            )

    new_chart_config = render_chart_config_editor(
        panel_id=panel_id,
        chart_config=panel.get("chart_config_json") or {},
    )
    panel_export_format = render_panel_export_controls(panel_id)

    return {
        "remove": remove,
        "move_up": move_up,
        "move_down": move_down,
        "retry": retry,
        "new_chart_config": new_chart_config,
        "panel_export_format": panel_export_format,
    }
