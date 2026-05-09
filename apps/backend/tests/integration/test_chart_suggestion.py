"""Integration tests for chart suggestion heuristics."""
from __future__ import annotations

from app.services.chart_suggestion_service import ChartSuggestionService


def test_chart_suggestion_line_for_temporal_numeric() -> None:
    service = ChartSuggestionService()
    suggestion = service.suggest(
        columns=[
            {"name": "week", "dataType": "timestamp"},
            {"name": "revenue", "dataType": "double"},
        ],
        rows=[["2026-01-01", 12.0]],
    )
    assert suggestion.chart_type == "line"


def test_chart_suggestion_bar_for_category_numeric() -> None:
    service = ChartSuggestionService()
    suggestion = service.suggest(
        columns=[
            {"name": "category", "dataType": "text"},
            {"name": "revenue", "dataType": "decimal"},
        ],
        rows=[["A", 12.0]],
    )
    assert suggestion.chart_type == "bar"


def test_chart_suggestion_scatter_for_two_numeric() -> None:
    service = ChartSuggestionService()
    suggestion = service.suggest(
        columns=[
            {"name": "x", "dataType": "double"},
            {"name": "y", "dataType": "double"},
        ],
        rows=[[1.0, 2.0]],
    )
    assert suggestion.chart_type == "scatter"


def test_chart_suggestion_table_fallback_for_sparse_schema() -> None:
    service = ChartSuggestionService()
    suggestion = service.suggest(columns=[], rows=[])
    assert suggestion.chart_type == "table_only"
