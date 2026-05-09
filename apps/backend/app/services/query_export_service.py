from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class QueryExportService:
    """Handles export payload creation for excel/csv responses."""

    def export_excel(self, rows: list[dict[str, Any]], lineage: dict[str, Any]) -> bytes:
        _ = (rows, lineage)
        return b""

    def export_csv(self, rows: list[dict[str, Any]], lineage: dict[str, Any]) -> bytes:
        _ = (rows, lineage)
        return b""
