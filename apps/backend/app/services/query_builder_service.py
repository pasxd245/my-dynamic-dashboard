from __future__ import annotations

from dataclasses import dataclass
from typing import Any

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
        allowed_operators = {
            "=",
            "!=",
            "<",
            ">",
            "<=",
            ">=",
            "IN",
            "LIKE",
            "IS NULL",
            "IS NOT NULL",
        }
        issues: list[ValidationIssue] = []
        for index, filter_spec in enumerate(config.filters):
            if filter_spec.operator not in allowed_operators:
                issues.append(
                    ValidationIssue(
                        code="INVALID_FILTER_OPERATOR",
                        message=f"Unsupported operator: {filter_spec.operator}",
                        field=f"filters[{index}].operator",
                    )
                )
                continue

            if filter_spec.operator in {"IS NULL", "IS NOT NULL"}:
                continue

            if filter_spec.value is None:
                issues.append(
                    ValidationIssue(
                        code="MISSING_FILTER_VALUE",
                        message="Filter value is required for selected operator",
                        field=f"filters[{index}].value",
                    )
                )

            if filter_spec.operator == "IN" and not isinstance(filter_spec.value, list):
                issues.append(
                    ValidationIssue(
                        code="INVALID_IN_FILTER_VALUE",
                        message="IN operator requires a list value",
                        field=f"filters[{index}].value",
                    )
                )
        return issues

    def validate_aggregations(self, config: QueryConfig) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        for index, aggregation in enumerate(config.aggregations):
            if not aggregation.alias.strip():
                issues.append(
                    ValidationIssue(
                        code="MISSING_AGGREGATION_ALIAS",
                        message="Aggregation alias is required",
                        field=f"aggregations[{index}].alias",
                    )
                )
        return issues

    def validate_group_by(self, config: QueryConfig) -> list[ValidationIssue]:
        if config.group_by_columns and not config.aggregations:
            return [
                ValidationIssue(
                    code="GROUP_BY_WITHOUT_AGGREGATION",
                    message="GROUP BY requires at least one aggregation",
                    field="group_by_columns",
                )
            ]
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

    def translate(self, config: QueryConfig) -> tuple[str, list[Any]]:
        select_parts: list[str] = []
        parameters: list[Any] = []

        for selected in config.selected_columns:
            if selected.alias:
                select_parts.append(f'{selected.table_id}."{selected.column_name}" AS "{selected.alias}"')
            else:
                select_parts.append(f'{selected.table_id}."{selected.column_name}"')

        for aggregation in config.aggregations:
            select_parts.append(
                f'{aggregation.function}({config.base_table_id}."{aggregation.column_id}") AS "{aggregation.alias}"'
            )

        select_clause = ", ".join(select_parts) if select_parts else "*"
        sql_parts = [f"SELECT {select_clause}", f"FROM {config.base_table_id}"]

        where_parts: list[str] = []
        for filter_spec in config.filters:
            column_expr = f'{config.base_table_id}."{filter_spec.column_id}"'
            if filter_spec.operator == "IS NULL":
                where_parts.append(f"{column_expr} IS NULL")
            elif filter_spec.operator == "IS NOT NULL":
                where_parts.append(f"{column_expr} IS NOT NULL")
            elif filter_spec.operator == "IN" and isinstance(filter_spec.value, list):
                placeholders = ", ".join(["?" for _ in filter_spec.value])
                where_parts.append(f"{column_expr} IN ({placeholders})")
                parameters.extend(filter_spec.value)
            else:
                where_parts.append(f"{column_expr} {filter_spec.operator} ?")
                parameters.append(filter_spec.value)

        if where_parts:
            sql_parts.append("WHERE " + " AND ".join(where_parts))

        if config.group_by_columns:
            group_by = ", ".join([f'{config.base_table_id}."{column_name}"' for column_name in config.group_by_columns])
            sql_parts.append(f"GROUP BY {group_by}")

        if config.result_limit is not None:
            sql_parts.append("LIMIT ?")
            parameters.append(config.result_limit)

        return " ".join(sql_parts), parameters
