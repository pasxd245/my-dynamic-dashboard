"""Domain-level deterministic test factories."""

from __future__ import annotations

from typing import Any

from .base import (
    deterministic_iso_timestamp,
    deterministic_source_id,
    deterministic_workspace_id,
    with_overrides,
)


def make_workspace(*, index: int = 1, **overrides: Any) -> dict[str, Any]:
    base = {
        "id": deterministic_workspace_id(index),
        "name": f"workspace-{index:03d}",
    }
    return with_overrides(base, **overrides)


def make_source_file(*, workspace_id: str | None = None, index: int = 1, **overrides: Any) -> dict[str, Any]:
    resolved_workspace_id = workspace_id or deterministic_workspace_id(index)
    base = {
        "id": deterministic_source_id(index),
        "workspace_id": resolved_workspace_id,
        "filename_original": "sample.csv",
        "extension": "csv",
        "content_hash": "abc123",
        "encoding_detected": "utf-8",
        "parse_status": "parsed",
        "uploaded_at": deterministic_iso_timestamp(),
    }
    return with_overrides(base, **overrides)


def make_query_payload(**overrides: Any) -> dict[str, Any]:
    base = {
        "base_table_id": "sales",
        "selected_columns": [{"table_id": "sales", "column_name": "region", "alias": None}],
        "filters": [],
        "aggregations": [],
        "group_by_columns": [],
        "joins": [],
        "result_limit": 100,
        "execution_timeout_seconds": 5,
    }
    return with_overrides(base, **overrides)
