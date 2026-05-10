from __future__ import annotations

import streamlit as st

from dashboard.shared import get_app_config


DASHBOARD_EXPORT_FORMATS = ["png", "pdf"]
PANEL_EXPORT_FORMATS = ["xlsx", "csv"]


def render_dashboard_export_controls() -> str | None:
    _ = get_app_config()
    with st.expander("Dashboard Export", expanded=False):
        export_format = st.selectbox("Dashboard format", DASHBOARD_EXPORT_FORMATS, key="dashboard-export-format")
        if st.button("Export dashboard", key="dashboard-export-btn"):
            return export_format
    return None


def render_panel_export_controls(panel_id: str) -> str | None:
    _ = get_app_config()
    with st.expander(f"Panel Export ({panel_id})", expanded=False):
        export_format = st.selectbox(
            "Panel format",
            PANEL_EXPORT_FORMATS,
            key=f"panel-export-format-{panel_id}",
        )
        if st.button("Export panel", key=f"panel-export-btn-{panel_id}"):
            return export_format
    return None
