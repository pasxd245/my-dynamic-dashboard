from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.api import ApiError, _get_workspace, _require_active_context_for_workspace
from app.apps.query_app import QUERY_APP
from app.schemas import (
    DuplicateSavedQueryRequest,
    LoadSavedQueryResponse,
    RecoveryWindowResponse,
    SavedQueryDetailResponse,
    SavedQueryLibraryResponse,
    SavedQueryRequest,
    SaveQueryRequest,
    SaveQueryResponse,
    UpdateSavedQueryRequest,
)
from app.services.actionable_error_service import with_correlation_details
from app.services.query_service import (
    DuplicateQueryNameError,
    QueryNotFoundError,
    RestoreWindowExpiredError,
    SavedQueryService,
)

router = APIRouter(tags=["saved-queries"])


def _sq_service() -> SavedQueryService:
    return QUERY_APP.saved_query_service()


def _handle_sq_errors(exc: Exception) -> None:
    if isinstance(exc, QueryNotFoundError):
        raise ApiError(status_code=404, code="query_not_found", message=str(exc))
    if isinstance(exc, DuplicateQueryNameError):
        raise ApiError(status_code=409, code="duplicate_query_name", message=str(exc))
    if isinstance(exc, RestoreWindowExpiredError):
        raise ApiError(
            status_code=409,
            code="restore_window_expired",
            message=str(exc),
            details={"recoverable_until": exc.recoverable_until},
        )
    raise exc


def _to_save_query_request(request: SaveQueryRequest | SavedQueryRequest) -> SaveQueryRequest:
    if isinstance(request, SaveQueryRequest):
        return request
    config_payload = request.config.model_dump() if hasattr(request.config, "model_dump") else request.config
    return SaveQueryRequest(
        name=request.name,
        description=request.description,
        builder_snapshot=config_payload,
        tags=[],
    )


@router.get("/api/v1/saved-queries")
def list_saved_queries_for_active_context(
    workspace_id: str,
    source_id: str,
    state: str = "active",
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    if not workspace_id or not source_id:
        from app.api import _active_context_error_response

        return _active_context_error_response(
            status_code=400,
            stage="results_saved",
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="workspace_id and source_id are required.",
            next_steps=["Set active context", "Retry saved query listing"],
        )

    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="results_saved",
    )
    if guard_error is not None:
        return guard_error

    result = _sq_service().list_queries(
        workspace_id=workspace_id,
        state=state,
        tag=tag,
        limit=limit,
        offset=offset,
    )
    return [item.model_dump() for item in result.items]


@router.post("/api/v1/workspaces/{workspace_id}/saved-queries", status_code=201)
def save_query(workspace_id: str, request: SaveQueryRequest | SavedQueryRequest) -> SaveQueryResponse:
    """Save a query configuration for later reuse."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().create_query(workspace_id=workspace_id, request=_to_save_query_request(request))
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/saved-queries/search")
def search_saved_queries(
    workspace_id: str,
    q: str = "",
    state: str = "active",
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> SavedQueryLibraryResponse:
    """Search saved queries by keyword."""
    _get_workspace(workspace_id)
    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="results_saved",
    )
    if guard_error is not None:
        raise ApiError(
            status_code=409,
            code="active_context_unresolved",
            message="Active context is unresolved for saved query search.",
            details=with_correlation_details(
                {
                    "error_code": "ACTIVE_CONTEXT_UNRESOLVED",
                    "stage": "results_saved",
                }
            ),
        )
    return _sq_service().search_queries(
        workspace_id=workspace_id, q=q, state=state, tag=tag, limit=limit, offset=offset
    )


@router.get("/api/v1/workspaces/{workspace_id}/saved-queries")
def list_saved_queries(
    workspace_id: str,
    state: str = "active",
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """List saved queries in a workspace."""
    _get_workspace(workspace_id)
    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="results_saved",
    )
    if guard_error is not None:
        raise ApiError(
            status_code=409,
            code="active_context_unresolved",
            message="Active context is unresolved for listing saved queries.",
            details=with_correlation_details(
                {
                    "error_code": "ACTIVE_CONTEXT_UNRESOLVED",
                    "stage": "results_saved",
                }
            ),
        )
    result = _sq_service().list_queries(workspace_id=workspace_id, state=state, tag=tag, limit=limit, offset=offset)
    payload = result.model_dump()
    payload["queries"] = payload["items"]
    return payload


@router.get("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
def get_saved_query(workspace_id: str, query_id: str) -> SavedQueryDetailResponse:
    """Get a specific saved query with version history."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().get_query_detail(workspace_id=workspace_id, query_id=query_id)
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.post("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/load")
def load_saved_query(workspace_id: str, query_id: str, version_id: str | None = None) -> LoadSavedQueryResponse:
    """Load a saved query snapshot, returning revalidation warnings."""
    _get_workspace(workspace_id)
    guard_error = _require_active_context_for_workspace(
        builder_session_service=QUERY_APP.builder_session_service(),
        workspace_id=workspace_id,
        stage="results_saved",
    )
    if guard_error is not None:
        raise ApiError(
            status_code=409,
            code="active_context_unresolved",
            message="Active context is unresolved for loading saved queries.",
            details=with_correlation_details(
                {
                    "error_code": "ACTIVE_CONTEXT_UNRESOLVED",
                    "stage": "results_saved",
                }
            ),
        )
    try:
        return _sq_service().load_query(workspace_id=workspace_id, query_id=query_id, version_id=version_id)
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.patch("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
def patch_saved_query(workspace_id: str, query_id: str, request: UpdateSavedQueryRequest) -> SavedQueryDetailResponse:
    """Update saved query metadata or create a new version."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().update_query(
            workspace_id=workspace_id,
            query_id=query_id,
            name=request.name,
            description=request.description,
            tags=request.tags,
            builder_snapshot=request.builder_snapshot,
            change_summary=request.change_summary,
            updated_by=request.updated_by,
        )
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.put("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
def update_saved_query_legacy(workspace_id: str, query_id: str, request: SavedQueryRequest) -> SavedQueryDetailResponse:
    """Backward-compatible update endpoint using legacy payload shape."""
    _get_workspace(workspace_id)
    try:
        config_payload = request.config.model_dump() if hasattr(request.config, "model_dump") else request.config
        return _sq_service().update_query(
            workspace_id=workspace_id,
            query_id=query_id,
            name=request.name,
            description=request.description,
            builder_snapshot=config_payload,
        )
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.post("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/duplicate", status_code=201)
def duplicate_saved_query(workspace_id: str, query_id: str, request: DuplicateSavedQueryRequest) -> SaveQueryResponse:
    """Duplicate a saved query as a new library entry."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().duplicate_query(
            workspace_id=workspace_id,
            query_id=query_id,
            name=request.name,
            description=request.description,
            tags=request.tags,
            created_by=request.created_by,
        )
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.delete("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}")
def delete_saved_query(workspace_id: str, query_id: str) -> RecoveryWindowResponse:
    """Soft-delete a saved query (recoverable within 24 hours)."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().delete_query(workspace_id=workspace_id, query_id=query_id)
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.post("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/restore")
def restore_saved_query(workspace_id: str, query_id: str) -> SavedQueryDetailResponse:
    """Restore a soft-deleted saved query within the grace window."""
    _get_workspace(workspace_id)
    try:
        return _sq_service().restore_query(workspace_id=workspace_id, query_id=query_id)
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")


@router.get("/api/v1/workspaces/{workspace_id}/saved-queries/{query_id}/executions")
def get_query_execution_history(
    workspace_id: str,
    query_id: str,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Get execution history for a saved query."""
    _get_workspace(workspace_id)
    try:
        result = _sq_service().get_execution_history(
            workspace_id=workspace_id, query_id=query_id, limit=limit, offset=offset
        )
        payload = result.model_dump()
        payload["executions"] = payload["items"]
        return payload
    except (QueryNotFoundError, DuplicateQueryNameError, RestoreWindowExpiredError) as exc:
        _handle_sq_errors(exc)
    raise AssertionError("unreachable")
