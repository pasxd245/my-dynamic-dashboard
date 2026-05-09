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

    def validate_declared_parameters(self, *, snapshot: dict[str, Any], provided: dict[str, Any]) -> None:
        declared = snapshot.get("parameters")
        if not declared:
            return

        if not isinstance(declared, list):
            raise PanelValidationError("Saved query parameter schema is invalid.")

        declared_names = {
            str(item.get("name"))
            for item in declared
            if isinstance(item, dict) and item.get("name") is not None
        }
        unknown = sorted(set(provided.keys()) - declared_names)
        if unknown:
            raise PanelValidationError(
                f"Undeclared parameters provided: {', '.join(unknown)}"
            )

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
            PanelDataColumn(name=str(col.get("name", "")), dataType=str(col.get("dataType", "text")))
            for col in columns
        ]
        return PanelDataResponse(
            panel_id=panel_id,
            row_count=len(rows),
            is_aggregated=is_aggregated,
            columns=response_columns,
            rows=paged_rows,
            has_more=has_more,
        )

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
