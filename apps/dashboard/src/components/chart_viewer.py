from __future__ import annotations

from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st


def render_chart(
    *,
    chart_suggestion: dict[str, Any] | None,
    rows: list[list[Any]],
    columns: list[dict[str, Any]],
) -> None:
    if not chart_suggestion:
        st.info("No chart suggestion available.")
        return

    chart_type = chart_suggestion.get("chart_type", "table_only")
    reason = chart_suggestion.get("reason", "")
    st.caption(f"Chart: {chart_type} | {reason}")

    if chart_type == "table_only" or not rows or not columns:
        return

    column_names = [str(col.get("name", "")) for col in columns]
    if not column_names or any(name == "" for name in column_names):
        st.info("Unable to render chart due to missing column names.")
        return

    frame = pd.DataFrame(rows, columns=column_names)
    axes = chart_suggestion.get("axes") or {}
    x_axis = str(axes.get("x") or column_names[0])
    y_axis = str(axes.get("y") or (column_names[1] if len(column_names) > 1 else column_names[0]))

    if x_axis not in frame.columns:
        x_axis = column_names[0]
    if y_axis not in frame.columns:
        y_axis = column_names[1] if len(column_names) > 1 else column_names[0]

    if len(frame) > 1000:
        frame = frame.head(1000)
        st.caption("Showing first 1000 rows for chart rendering performance.")

    try:
        if chart_type == "line":
            figure = px.line(frame, x=x_axis, y=y_axis)
        elif chart_type == "bar":
            figure = px.bar(frame, x=x_axis, y=y_axis)
        elif chart_type == "scatter":
            figure = px.scatter(frame, x=x_axis, y=y_axis)
        elif chart_type == "pie":
            figure = px.pie(frame, names=x_axis, values=y_axis)
        elif chart_type == "heatmap":
            matrix = frame[[x_axis, y_axis]].copy()
            matrix["count"] = 1
            matrix = matrix.groupby([x_axis, y_axis], as_index=False)["count"].sum()
            figure = px.density_heatmap(matrix, x=x_axis, y=y_axis, z="count")
        else:
            st.info("Unsupported chart type for rendering; showing table only.")
            return

        st.plotly_chart(figure, use_container_width=True)
    except Exception:
        st.info("Chart rendering failed for current data shape; table view remains available.")


def render_chart_config_editor(
    *,
    panel_id: str,
    chart_config: dict[str, Any] | None,
) -> dict[str, Any] | None:
    chart_config = dict(chart_config or {})

    with st.expander(f"Chart configuration ({panel_id})", expanded=False):
        chart_type = st.selectbox(
            "Chart type",
            ["bar", "line", "scatter", "pie", "heatmap", "table_only"],
            index=["bar", "line", "scatter", "pie", "heatmap", "table_only"].index(
                chart_config.get("chartType", "bar") if chart_config.get("chartType", "bar") in ["bar", "line", "scatter", "pie", "heatmap", "table_only"] else "bar"
            ),
            key=f"chart-type-{panel_id}",
        )
        x_axis = st.text_input("X axis", value=str(chart_config.get("xAxis", "")), key=f"chart-x-{panel_id}")
        y_axis = st.text_input("Y axis", value=str(chart_config.get("yAxis", "")), key=f"chart-y-{panel_id}")
        palette = st.text_input("Palette", value=str(chart_config.get("palette", "default")), key=f"chart-palette-{panel_id}")

        if st.button("Apply chart config", key=f"chart-apply-{panel_id}"):
            return {
                "chartType": chart_type,
                "xAxis": x_axis,
                "yAxis": y_axis,
                "palette": palette,
            }

    return None
