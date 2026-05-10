from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.schemas import ChartSuggestion, DashboardRunPanel, PanelDataColumn, PanelDataResponse
from app.services.chart_suggestion_service import ChartSuggestionService


class PanelValidationError(Exception):
    pass


@dataclass
class PanelExecutorService:
    """Validates panel params and projects run outputs for APIs."""

    chart_service: ChartSuggestionService

    def merge_parameters(
        self,
        *,
        dashboard_parameters: dict[str, Any] | None,
        panel_overrides: dict[str, Any] | None,
    ) -> dict[str, Any]:
        merged: dict[str, Any] = {}
        if dashboard_parameters:
            merged.update(dashboard_parameters)
        if panel_overrides:
            merged.update(panel_overrides)
        return merged

    def merge_run_parameters(
        self,
        *,
        dashboard_parameters: dict[str, Any] | None,
        panel_overrides: dict[str, Any] | None,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        merged = self.merge_parameters(
            dashboard_parameters=dashboard_parameters,
            panel_overrides=panel_overrides,
        )
        self.validate_declared_parameters(snapshot=snapshot, provided=merged)
        return merged

    def _iter_declared_parameter_specs(self, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
        declared = snapshot.get("parameters")
        if declared is None:
            return []
        if not isinstance(declared, list):
            raise PanelValidationError("Saved query parameter schema is invalid.")
        return [item for item in declared if isinstance(item, dict)]

    def _extract_declared_parameter_name(self, spec: dict[str, Any]) -> str:
        for key in ("name", "parameterName", "parameter_id", "parameterId", "id"):
            value = spec.get(key)
            if value is not None and str(value).strip():
                return str(value)
        raise PanelValidationError("Saved query parameter schema is invalid.")

    def _is_required(self, spec: dict[str, Any]) -> bool:
        return bool(spec.get("required", False))

    def _parameter_type(self, spec: dict[str, Any]) -> str:
        raw = spec.get("parameterType", spec.get("type", "text"))
        return str(raw).lower()

    def _validate_value_by_type(self, name: str, value: Any, spec: dict[str, Any]) -> None:
        param_type = self._parameter_type(spec)
        validation = spec.get("validation")
        validation_obj = validation if isinstance(validation, dict) else {}

        if param_type in {"numeric", "number", "int", "integer", "float", "decimal"}:
            if not isinstance(value, (int, float)):
                raise PanelValidationError(f"Parameter '{name}' must be numeric.")
            min_value = validation_obj.get("min")
            max_value = validation_obj.get("max")
            if isinstance(min_value, (int, float)) and value < min_value:
                raise PanelValidationError(f"Parameter '{name}' must be >= {min_value}.")
            if isinstance(max_value, (int, float)) and value > max_value:
                raise PanelValidationError(f"Parameter '{name}' must be <= {max_value}.")
            return

        if param_type in {"categorical", "enum", "select"}:
            allowed = spec.get("allowedValues")
            if isinstance(allowed, list) and allowed and value not in allowed:
                raise PanelValidationError(
                    f"Parameter '{name}' must be one of: {', '.join([str(v) for v in allowed])}."
                )
            return

        if param_type in {"date", "datetime"}:
            if not isinstance(value, str):
                raise PanelValidationError(f"Parameter '{name}' must be an ISO date string.")
            if len(value) < 8:
                raise PanelValidationError(f"Parameter '{name}' must be an ISO date string.")

    def validate_declared_parameters(self, *, snapshot: dict[str, Any], provided: dict[str, Any]) -> None:
        declared_specs = self._iter_declared_parameter_specs(snapshot)
        if not declared_specs:
            return

        declared_names = {self._extract_declared_parameter_name(spec) for spec in declared_specs}
        unknown = sorted(set(provided.keys()) - declared_names)
        if unknown:
            raise PanelValidationError(f"Undeclared parameters provided: {', '.join(unknown)}")

        for spec in declared_specs:
            name = self._extract_declared_parameter_name(spec)
            if self._is_required(spec) and name not in provided:
                raise PanelValidationError(f"Parameter '{name}' is required.")

            if name not in provided:
                continue

            value = provided.get(name)
            if value is None:
                if self._is_required(spec):
                    raise PanelValidationError(f"Parameter '{name}' cannot be null.")
                continue

            self._validate_value_by_type(name=name, value=value, spec=spec)

    def build_projection(self, *, rows: list[list[Any]], limit: int, offset: int) -> tuple[list[list[Any]], bool]:
        if offset < 0:
            offset = 0
        if limit <= 0:
            limit = 100
        sliced = rows[offset : offset + limit]
        has_more = offset + limit < len(rows)
        return sliced, has_more

    def panel_data_response(
        self,
        *,
        panel_id: str,
        columns: list[dict[str, Any]],
        rows: list[list[Any]],
        is_aggregated: bool,
        limit: int,
        offset: int,
    ) -> PanelDataResponse:
        paged_rows, has_more = self.build_projection(rows=rows, limit=limit, offset=offset)
        response_columns = [
            PanelDataColumn(name=str(col.get("name", "")), dataType=str(col.get("dataType", "text"))) for col in columns
        ]
        return PanelDataResponse(
            panel_id=panel_id,
            row_count=len(rows),
            is_aggregated=is_aggregated,
            columns=response_columns,
            rows=paged_rows,
            has_more=has_more,
        )

    def ensure_export_eligible(self, *, panel_status: str, allow_partial: bool = False) -> None:
        normalized_status = panel_status.lower()
        if normalized_status == "completed":
            return
        if allow_partial and normalized_status in {"failed", "timeout"}:
            return
        raise PanelValidationError("Panel export is blocked until the panel run is completed.")

    def default_columns_from_snapshot(self, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
        selected = snapshot.get("selected_columns")
        if not isinstance(selected, list):
            return []
        columns: list[dict[str, Any]] = []
        for col in selected:
            if not isinstance(col, dict):
                continue
            name = str(col.get("alias") or col.get("column_name") or "column")
            columns.append({"name": name, "dataType": "text"})
        return columns

    def build_run_panel(
        self,
        *,
        run_panel_id: str,
        panel_id: str,
        status: str,
        columns: list[dict[str, Any]],
        rows: list[list[Any]],
    ) -> DashboardRunPanel:
        suggestion: ChartSuggestion = self.chart_service.suggest(columns=columns, rows=rows)
        return DashboardRunPanel(
            run_panel_id=run_panel_id,
            panel_id=panel_id,
            status=status,
            row_count=len(rows),
            is_aggregated=False,
            chart_suggestion_type=suggestion.chart_type,
            chart_suggestion_reason=suggestion.reason,
        )

    def parse_rows(self, raw_rows: str | None) -> list[list[Any]]:
        if not raw_rows:
            return []
        try:
            payload = json.loads(raw_rows)
        except json.JSONDecodeError:
            return []
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, list)]
        return []

    def parse_columns(self, raw_columns: str | None) -> list[dict[str, Any]]:
        if not raw_columns:
            return []
        try:
            payload = json.loads(raw_columns)
        except json.JSONDecodeError:
            return []
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        return []
