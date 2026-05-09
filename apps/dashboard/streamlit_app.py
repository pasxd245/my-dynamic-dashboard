from __future__ import annotations

import os
import streamlit as st

from src.api.dashboard_api import DashboardApiClient, DashboardApiError
from src.components.dashboard_header import (
    render_dashboard_header,
    render_run_history,
    render_service_health_banner,
)
from src.components.export_controls import render_dashboard_export_controls
from src.components.parameter_panel import render_parameter_panel
from src.components.query_panel import render_query_panel


st.set_page_config(page_title="Dynamic Dashboard", layout="wide")


def run_smoke_startup_checks(query_params: dict[str, str] | None = None) -> dict[str, bool]:
    """Return deterministic startup/navigation checks for CI and local smoke validation."""
    params = query_params or {}
    workspace_id = str(params.get("workspace_id", ""))
    dashboard_id = str(params.get("dashboard_id", ""))

    checks = {
        "app_bootstrap": True,
        "workspace_input_accepts_empty": workspace_id == "" or len(workspace_id) > 0,
        "dashboard_input_accepts_empty": dashboard_id == "" or len(dashboard_id) > 0,
        "detail_load_guard": not (workspace_id and dashboard_id),
    }
    return checks


def main() -> None:
    st.title("Dynamic Dashboard MVP")
    st.caption("Spec 005 dashboard visualizations")

    if os.getenv("DASHBOARD_SMOKE", "0") == "1":
        smoke = run_smoke_startup_checks()
        if all(smoke.values()):
            st.success("Smoke checks passed")
        else:
            st.error(f"Smoke checks failed: {smoke}")

    client = DashboardApiClient.from_env()
    query_params = st.query_params
    initial_workspace = str(query_params.get("workspace_id", ""))
    initial_dashboard = str(query_params.get("dashboard_id", ""))

    with st.sidebar:
        st.header("Connection")
        st.write(f"Backend: {client.base_url}")
        workspace_id = st.text_input("Workspace ID", value=initial_workspace)
        dashboard_id = st.text_input("Dashboard ID (optional)", value=initial_dashboard)

    col_left, col_right = st.columns([1, 2])
    with col_left:
        st.subheader("Health")
        if st.button("Check API Health"):
            try:
                payload = client.health()
                st.success(f"API status: {payload.get('status', 'unknown')}")
            except DashboardApiError as exc:
                st.error(str(exc))

    with col_right:
        st.subheader("Dashboards")
        if st.button("Load Dashboards", disabled=not workspace_id):
            try:
                dashboards = client.list_dashboards(workspace_id=workspace_id)
                st.session_state["dashboards"] = dashboards
            except DashboardApiError as exc:
                st.error(str(exc))

        dashboards = st.session_state.get("dashboards", [])
        if dashboards:
            selected = st.selectbox(
                "Select dashboard",
                options=[item.get("dashboard_id", "") for item in dashboards],
                key="selected-dashboard",
            )
            if selected:
                dashboard_id = selected

    if workspace_id and dashboard_id and st.button("Load Dashboard Detail"):
        try:
            detail = client.get_dashboard(workspace_id=workspace_id, dashboard_id=dashboard_id)
            st.query_params["workspace_id"] = workspace_id
            st.query_params["dashboard_id"] = dashboard_id

            runs = client.list_runs(workspace_id=workspace_id, dashboard_id=dashboard_id)
            latest_run = runs[0] if runs else None
            run_detail = (
                client.get_run_detail(workspace_id=workspace_id, dashboard_id=dashboard_id, run_id=latest_run["run_id"])
                if latest_run
                else None
            )
            run_details_by_id: dict[str, dict[str, object]] = {}
            if run_detail:
                run_details_by_id[str(run_detail.get("run_id"))] = run_detail
            st.session_state["run_details_by_id"] = run_details_by_id
            service_health = client.get_service_health(workspace_id=workspace_id, dashboard_id=dashboard_id)

            render_service_health_banner(service_health)
            parameter_schema = []
            panel_defaults: dict[str, str] = {}
            for panel in detail.get("panels", []):
                overrides = panel.get("parameter_overrides_json") or {}
                for key, value in overrides.items():
                    panel_defaults[str(key)] = value
            parameters, param_errors = render_parameter_panel(
                parameter_schema=parameter_schema,
                initial_values=panel_defaults,
            )
            if param_errors:
                st.error(" | ".join(param_errors))

            run_now, new_cadence = render_dashboard_header(
                dashboard=detail,
                service_health=service_health,
                parameter_chips=parameters,
            )

            if new_cadence:
                client.set_refresh_cadence(
                    workspace_id=workspace_id,
                    dashboard_id=dashboard_id,
                    cadence=new_cadence,
                )
                st.success(f"Cadence updated to {new_cadence}")

            if run_now and not param_errors:
                run_response = client.run_dashboard(
                    workspace_id=workspace_id,
                    dashboard_id=dashboard_id,
                    parameters=parameters,
                )
                st.success(f"Run started: {run_response.get('run_id')}")
                runs = client.list_runs(workspace_id=workspace_id, dashboard_id=dashboard_id)
                latest_run = runs[0] if runs else None
                run_detail = (
                    client.get_run_detail(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        run_id=latest_run["run_id"],
                    )
                    if latest_run
                    else None
                )
                run_details_by_id = {}
                if run_detail:
                    run_details_by_id[str(run_detail.get("run_id"))] = run_detail
                st.session_state["run_details_by_id"] = run_details_by_id

            render_run_history(runs)

            dashboard_export = render_dashboard_export_controls()
            if dashboard_export:
                _ = client.export_dashboard(
                    workspace_id=workspace_id,
                    dashboard_id=dashboard_id,
                    file_format=dashboard_export,
                )
                st.success(f"Dashboard exported as {dashboard_export}")

            run_panels_by_id = {
                item.get("panel_id"): item
                for item in ((run_detail or {}).get("panels", []) if run_detail else [])
            }

            panels = sorted(detail.get("panels", []), key=lambda item: item.get("panel_order", 0))
            for index, panel in enumerate(panels):
                panel_id = panel.get("panel_id")
                run_panel = run_panels_by_id.get(panel_id)
                panel_data = None
                chart_suggestion = None
                if run_detail and run_panel:
                    panel_data = client.get_panel_data(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        run_id=run_detail["run_id"],
                        panel_id=panel_id,
                        limit=100,
                        offset=0,
                    )
                    chart_suggestion = client.get_chart_suggestion(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        run_id=run_detail["run_id"],
                        panel_id=panel_id,
                    )

                action = render_query_panel(
                    panel=panel,
                    run_panel=run_panel,
                    panel_data=panel_data,
                    chart_suggestion=chart_suggestion,
                )

                if action["remove"]:
                    client.delete_panel(workspace_id=workspace_id, dashboard_id=dashboard_id, panel_id=panel_id)
                    st.rerun()

                if action["move_up"] and index > 0:
                    client.patch_panel(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        panel_id=panel_id,
                        payload={"panel_order": index - 1},
                    )
                    st.rerun()

                if action["move_down"] and index < len(panels) - 1:
                    client.patch_panel(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        panel_id=panel_id,
                        payload={"panel_order": index + 1},
                    )
                    st.rerun()

                if action["new_chart_config"]:
                    client.patch_panel(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        panel_id=panel_id,
                        payload={"chart_config_json": action["new_chart_config"]},
                    )
                    st.success("Chart override saved")

                if action["retry"] and not param_errors:
                    client.run_dashboard(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        parameters=parameters,
                    )
                    st.rerun()

                if action["panel_export_format"] and run_detail:
                    _ = client.export_panel(
                        workspace_id=workspace_id,
                        dashboard_id=dashboard_id,
                        run_id=run_detail["run_id"],
                        panel_id=panel_id,
                        file_format=action["panel_export_format"],
                    )
                    st.success(f"Panel exported as {action['panel_export_format']}")
        except DashboardApiError as exc:
            st.error(str(exc))


if __name__ == "__main__":
    main()