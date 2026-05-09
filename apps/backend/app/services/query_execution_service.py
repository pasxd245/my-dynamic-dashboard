from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class QueryExecutionService:
    """Executes translated SQL for preview/full runs with runtime guards."""

    default_timeout_seconds: int = 5

    def preview(
        self,
        *,
        sql: str,
        parameters: list[Any],
        timeout_seconds: int | None = None,
    ) -> dict[str, Any]:
        _ = (sql, parameters, timeout_seconds)
        return {
            "rows": [],
            "estimated_total_rows": 0,
            "execution_time_ms": 0,
        }

    def execute(
        self,
        *,
        sql: str,
        parameters: list[Any],
        timeout_seconds: int | None = None,
    ) -> dict[str, Any]:
        _ = (sql, parameters, timeout_seconds)
        return {
            "rows": [],
            "total_rows": 0,
            "execution_time_ms": 0,
        }
