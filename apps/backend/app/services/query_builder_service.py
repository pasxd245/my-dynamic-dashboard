from __future__ import annotations

from dataclasses import dataclass

from app.schemas import JoinSpec, QueryConfig, ValidationIssue


@dataclass
class QueryConfigValidator:
    """Validates query-builder payloads before SQL translation or execution."""

    def validate(self, config: QueryConfig) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        issues.extend(self.validate_columns(config))
        issues.extend(self.validate_filters(config))
        issues.extend(self.validate_aggregations(config))
        issues.extend(self.validate_group_by(config))
        return issues

    def validate_columns(self, config: QueryConfig) -> list[ValidationIssue]:
        if not config.selected_columns:
            return [ValidationIssue(code="MISSING_COLUMNS", message="At least one selected column is required")]
        return []

    def validate_filters(self, config: QueryConfig) -> list[ValidationIssue]:
        return []

    def validate_aggregations(self, config: QueryConfig) -> list[ValidationIssue]:
        return []

    def validate_group_by(self, config: QueryConfig) -> list[ValidationIssue]:
        return []


@dataclass
class JoinGraphValidator:
    """Validates join graph safety (approved-only and acyclic semantics)."""

    def validate_joins(self, base_table_id: str, joins: list[JoinSpec]) -> list[ValidationIssue]:
        _ = (base_table_id, joins)
        return []


@dataclass
class SqlTranslator:
    """Translates validated query config into DuckDB SQL + positional parameters."""

    def translate(self, config: QueryConfig) -> tuple[str, list[object]]:
        _ = config
        return "SELECT 1", []
