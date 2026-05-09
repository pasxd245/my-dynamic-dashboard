from __future__ import annotations

import streamlit as st

from src.api.dashboard_api import DashboardApiClient, DashboardApiError


st.set_page_config(page_title="Dynamic Dashboard", layout="wide")


def main() -> None:
    st.title("Dynamic Dashboard MVP")
    st.caption("Spec 005 skeleton app")

    client = DashboardApiClient.from_env()

    with st.sidebar:
        st.header("Connection")
        st.write(f"Backend: {client.base_url}")
        workspace_id = st.text_input("Workspace ID", value="")
        dashboard_id = st.text_input("Dashboard ID (optional)", value="")

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
                st.json(dashboards)
            except DashboardApiError as exc:
                st.error(str(exc))

    if workspace_id and dashboard_id and st.button("Load Dashboard Detail"):
        try:
            detail = client.get_dashboard(workspace_id=workspace_id, dashboard_id=dashboard_id)
            st.subheader("Dashboard Detail")
            st.json(detail)
        except DashboardApiError as exc:
            st.error(str(exc))


if __name__ == "__main__":
    main()