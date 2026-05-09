from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas import ChartSuggestion


@dataclass
class ChartSuggestionService:
    """Suggests a safe default chart from tabular panel output."""

    def suggest(self, *, columns: list[dict[str, Any]], rows: list[list[Any]]) -> ChartSuggestion:
        if not columns:
            return ChartSuggestion(chart_type="table_only", reason="No columns available for charting.")

        numeric_indexes: list[int] = []
        temporal_indexes: list[int] = []
        categorical_indexes: list[int] = []

        for idx, column in enumerate(columns):
            data_type = str(column.get("dataType", "")).lower()
            if any(token in data_type for token in ("int", "float", "double", "decimal", "number")):
                numeric_indexes.append(idx)
                continue
            if any(token in data_type for token in ("date", "time", "timestamp")):
                temporal_indexes.append(idx)
                continue
            categorical_indexes.append(idx)

        if temporal_indexes and numeric_indexes:
            return ChartSuggestion(
                chart_type="line",
                reason="Detected temporal and numeric columns.",
                axes={
                    "x": str(columns[temporal_indexes[0]].get("name", "x")),
                    "y": str(columns[numeric_indexes[0]].get("name", "y")),
                },
            )

        if categorical_indexes and numeric_indexes:
            return ChartSuggestion(
                chart_type="bar",
                reason="Detected categorical and numeric columns.",
                axes={
                    "x": str(columns[categorical_indexes[0]].get("name", "x")),
                    "y": str(columns[numeric_indexes[0]].get("name", "y")),
                },
            )

        if len(numeric_indexes) >= 2:
            return ChartSuggestion(
                chart_type="scatter",
                reason="Detected two numeric columns.",
                axes={
                    "x": str(columns[numeric_indexes[0]].get("name", "x")),
                    "y": str(columns[numeric_indexes[1]].get("name", "y")),
                },
            )

        if rows and len(columns) == 2 and numeric_indexes:
            return ChartSuggestion(chart_type="pie", reason="Two-column output can be summarized as composition.")

        return ChartSuggestion(chart_type="table_only", reason="No safe chart heuristic matched; table fallback applied.")
