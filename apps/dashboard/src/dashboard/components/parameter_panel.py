from __future__ import annotations

from typing import Any

import streamlit as st

from dashboard.shared import get_app_config


def render_parameter_panel(
    *,
    parameter_schema: list[dict[str, Any]],
    initial_values: dict[str, Any] | None,
) -> tuple[dict[str, Any], list[str]]:
    _ = get_app_config()
    values: dict[str, Any] = {}
    errors: list[str] = []
    initial_values = initial_values or {}

    if not parameter_schema:
        return values, errors

    with st.expander("Parameters", expanded=True):
        for spec in parameter_schema:
            name = str(spec.get("name") or spec.get("parameterName") or spec.get("parameterId") or "param")
            required = bool(spec.get("required", False))
            label = f"{name}{' *' if required else ''}"
            default_value = initial_values.get(name, spec.get("defaultValue", ""))
            param_type = str(spec.get("parameterType", spec.get("type", "text"))).lower()

            if param_type in {"numeric", "number", "int", "integer", "float", "decimal"}:
                raw = st.text_input(label, value=str(default_value) if default_value is not None else "", key=f"p-{name}")
                if raw == "":
                    if required:
                        errors.append(f"{name} is required")
                    continue
                try:
                    values[name] = float(raw)
                except ValueError:
                    errors.append(f"{name} must be numeric")
                continue

            values[name] = st.text_input(label, value=str(default_value) if default_value is not None else "", key=f"p-{name}")
            if required and values[name] == "":
                errors.append(f"{name} is required")

    return values, errors
