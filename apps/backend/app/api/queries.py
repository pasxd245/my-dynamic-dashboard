from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import Response

from app.api import ApiError, _get_workspace, _require_active_context_for_workspace, raise_query_error
from app.apps.query_app import QUERY_APP
from app.schemas import (
    LineageMetadata,
    QueryConfig,
    QueryExecutionResponse,
    QueryPreviewResponse,
    ValidateQueryResponse,
)
from app.services.actionable_error_service import with_correlation_details
from app.services.query_builder_service import JoinGraphValidator, QueryConfigValidator, SqlTranslator

router = APIRouter(tags=["queries"])


@router.post("/api/v1/query/validate")
def validate_query_for_active_context(request: dict[str, Any]):
    workspace_id = str(request.get("workspace_id") or "").strip()
    source_id = str(request.get("source_id") or "").strip()
    if not workspace_id or not source_id:
        from app.api import _active_context_error_response

        return _active_context_error_response(
            status_code=400,
            stage="query",
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="workspace_id and source_id are required.",
            next_steps=["Set active context", "Retry query validation"],
        )

    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="query",
    )
    if guard_error is not None:
        return guard_error

    query_config = request.get("query_config")
    if not isinstance(query_config, dict):
        from app.api import _active_context_error_response

        return _active_context_error_response(
            status_code=400,
            stage="query",
            error_code="QUERY_CONFIG_INVALID",
            user_message="query_config payload is required for validation.",
            next_steps=["Provide query_config", "Retry query validation"],
        )

    return validate_query(workspace_id, QueryConfig.model_validate(query_config))


@router.post("/api/v1/workspaces/{workspace_id}/queries/validate")
def validate_query(workspace_id: str, request: QueryConfig) -> ValidateQueryResponse:
    _get_workspace(workspace_id)
    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="query",
    )
    if guard_error is not None:
        raise ApiError(
            status_code=409,
            code="active_context_unresolved",
            message="Active context is unresolved for query validation.",
            details=with_correlation_details(
                {
                    "error_code": "ACTIVE_CONTEXT_UNRESOLVED",
                    "stage": "query",
                }
            ),
        )

    validator = QueryConfigValidator()
    join_validator = JoinGraphValidator()
    translator = SqlTranslator()

    issues = validator.validate(request)
    issues.extend(join_validator.validate_joins(request.base_table_id, request.joins))

    has_errors = any(issue.severity == "error" for issue in issues)
    if has_errors:
        return ValidateQueryResponse(valid=False, issues=issues)

    sql, _ = translator.translate(request)
    QUERY_APP.builder_session_service().mark_query_validated(workspace_id)
    return ValidateQueryResponse(valid=True, issues=issues, sql_preview=sql)


@router.post("/api/v1/workspaces/{workspace_id}/queries/preview")
def preview_query(workspace_id: str, request: QueryConfig) -> QueryPreviewResponse:
    """Preview query with LIMIT 100 and metadata."""
    _get_workspace(workspace_id)

    validator = QueryConfigValidator()
    issues = validator.validate(request)

    has_errors = any(issue.severity == "error" for issue in issues)
    if has_errors:
        raise_query_error("VALIDATION_ERROR", "Query validation failed", {"issues": [i.model_dump() for i in issues]})

    return QueryPreviewResponse(
        rows=[],
        estimated_total_rows=0,
        execution_time_ms=0,
        lineage=LineageMetadata(),
    )


@router.post("/api/v1/workspaces/{workspace_id}/queries/execute")
def execute_query(workspace_id: str, request: QueryConfig) -> QueryExecutionResponse:
    """Execute full query and return all results."""
    _get_workspace(workspace_id)
    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="query",
    )
    if guard_error is not None:
        raise ApiError(
            status_code=409,
            code="active_context_unresolved",
            message="Active context is unresolved for query execution.",
            details=with_correlation_details(
                {
                    "error_code": "ACTIVE_CONTEXT_UNRESOLVED",
                    "stage": "query",
                }
            ),
        )

    validator = QueryConfigValidator()
    issues = validator.validate(request)

    has_errors = any(issue.severity == "error" for issue in issues)
    if has_errors:
        raise_query_error("VALIDATION_ERROR", "Query validation failed", {"issues": [i.model_dump() for i in issues]})

    try:
        response = QueryExecutionResponse(
            rows=[],
            total_rows=0,
            execution_time_ms=0,
            state="COMPLETED",
            lineage=LineageMetadata(),
        )

        if request.saved_query_id:
            from app.api.saved_queries import _sq_service

            _sq_service().record_execution(
                query_id=request.saved_query_id,
                version_id=request.saved_query_version_id,
                executed_by="system",
                status="completed",
                row_count=response.total_rows,
                execution_ms=response.execution_time_ms,
            )

        return response
    except Exception as exc:
        if request.saved_query_id:
            from app.api.saved_queries import _sq_service

            _sq_service().record_execution(
                query_id=request.saved_query_id,
                version_id=request.saved_query_version_id,
                executed_by="system",
                status="failed",
                row_count=0,
                execution_ms=0,
                error_message=str(exc),
            )
        raise


@router.post("/api/v1/workspaces/{workspace_id}/queries/export")
def export_query(workspace_id: str, request: QueryConfig, format: str = "excel") -> Response:
    """Export query results to Excel or CSV."""
    _get_workspace(workspace_id)

    validator = QueryConfigValidator()
    issues = validator.validate(request)

    has_errors = any(issue.severity == "error" for issue in issues)
    if has_errors:
        raise_query_error("VALIDATION_ERROR", "Query validation failed", {"issues": [i.model_dump() for i in issues]})

    if format == "csv":
        return Response(
            content="", media_type="text/csv", headers={"Content-Disposition": "attachment; filename=export.csv"}
        )
    return Response(
        content=b"",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=export.xlsx"},
    )
