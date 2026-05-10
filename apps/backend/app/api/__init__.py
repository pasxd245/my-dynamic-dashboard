from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse

from app.core.metadata_db import get_connection
from app.schemas import ApiErrorModel, ErrorResponse
from app.services.actionable_error_service import (
    build_actionable_error,
    build_actionable_error_from_api_error,
    with_correlation_details,
)
from app.services.builder_session_service import BuilderSessionService
from app.shared import current_db_path, current_parquet_root


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, object] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


QUERY_ERROR_STATUS_BY_CODE = {
    "VALIDATION_ERROR": 400,
    "TIMEOUT": 408,
    "UNAPPROVED_RELATIONSHIP": 409,
    "MEMORY_ERROR": 413,
}


def raise_query_error(
    code: str,
    message: str,
    details: dict[str, object] | None = None,
) -> None:
    status_code = QUERY_ERROR_STATUS_BY_CODE.get(code, 400)
    raise ApiError(
        status_code=status_code,
        code=code,
        message=message,
        details=with_correlation_details(details),
    )


def raise_bad_request(message: str, *, code: str = "bad_request") -> None:
    raise ApiError(
        status_code=400,
        code=code,
        message=message,
        details=with_correlation_details(),
    )


def raise_not_found(message: str, *, code: str = "not_found") -> None:
    raise ApiError(
        status_code=404,
        code=code,
        message=message,
        details=with_correlation_details(),
    )


def raise_conflict(message: str, *, code: str = "conflict") -> None:
    raise ApiError(
        status_code=409,
        code=code,
        message=message,
        details=with_correlation_details(),
    )


def raise_service_unavailable(message: str, *, code: str = "service_unavailable") -> None:
    raise ApiError(
        status_code=503,
        code=code,
        message=message,
        details=with_correlation_details(),
    )


def _get_workspace(workspace_id: str) -> dict[str, str | int]:
    with get_connection(current_db_path()) as conn:
        row = conn.execute(
            "SELECT id, name, status, manifest_version FROM workspaces WHERE id = ?",
            (workspace_id,),
        ).fetchone()

    if row is None:
        raise ApiError(status_code=404, code="workspace_not_found", message="Workspace not found")

    return {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "status": str(row["status"]),
        "manifest_version": int(row["manifest_version"]),
    }


def _active_context_error_response(
    *,
    status_code: int,
    stage: str,
    error_code: str,
    user_message: str,
    next_steps: list[str],
    technical_details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload = build_actionable_error(
        error_code=error_code,
        stage=stage,
        user_message=user_message,
        next_steps=next_steps,
        technical_details=technical_details,
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _require_active_context_for_workspace(
    *,
    builder_session_service: BuilderSessionService,
    workspace_id: str,
    stage: str,
) -> JSONResponse | None:
    active_context = builder_session_service.get_active_context()
    if active_context is None:
        return _active_context_error_response(
            status_code=409,
            stage=stage,
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="Select an active workspace and source before continuing.",
            next_steps=[
                "Open context selector",
                "Choose workspace and source",
                "Retry this action",
            ],
        )

    workspace_state = active_context.workspace.state
    source_state = active_context.source.state
    active_workspace_id = active_context.workspace.workspace_id
    active_source_workspace_id = active_context.source.workspace_id

    if workspace_state != "resolved" or source_state != "resolved":
        return _active_context_error_response(
            status_code=409,
            stage=stage,
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="Active context is unresolved and cannot be used for this action.",
            next_steps=[
                "Re-open context selector",
                "Resolve workspace and source",
                "Retry this action",
            ],
        )

    if active_workspace_id != workspace_id or active_source_workspace_id != workspace_id:
        return _active_context_error_response(
            status_code=409,
            stage=stage,
            error_code="ACTIVE_CONTEXT_STALE",
            user_message="Active context does not match the selected workspace.",
            next_steps=[
                "Re-select workspace and source",
                "Confirm the context matches the target workspace",
                "Retry this action",
            ],
            technical_details={
                "requested_workspace_id": workspace_id,
                "active_workspace_id": active_workspace_id,
            },
        )

    return None
