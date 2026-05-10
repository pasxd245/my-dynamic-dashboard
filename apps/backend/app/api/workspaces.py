from __future__ import annotations

from fastapi import APIRouter

from app.api import _active_context_error_response, _get_workspace
from app.apps.workspace_app import WORKSPACE_APP
from app.schemas import SetActiveContextRequest, WorkspaceCreateRequest, WorkspaceResponse
from app.services.builder_session_service import BuilderSessionService

router = APIRouter(tags=["workspaces"])


BUILDER_SESSION_SERVICE = WORKSPACE_APP.builder_session_service()


def _builder_session_service() -> BuilderSessionService:
    return BUILDER_SESSION_SERVICE


def _source_workspace(source_id: str) -> str | None:
    return WORKSPACE_APP.source_workspace(source_id)


@router.post("/api/v1/workspaces")
def create_workspace(request: WorkspaceCreateRequest) -> WorkspaceResponse:
    return WORKSPACE_APP.create_workspace(request)


@router.put("/api/v1/workspaces/active-context")
def set_active_context(request: SetActiveContextRequest):
    workspace_id = request.workspace_id.strip()
    source_id = request.source_id.strip()
    if not workspace_id or not source_id:
        return _active_context_error_response(
            status_code=400,
            stage="global",
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="Workspace and source selection are both required.",
            next_steps=["Choose a workspace", "Choose a source", "Retry this action"],
        )

    workspace = _get_workspace(workspace_id)
    source_workspace_id = _source_workspace(source_id)
    if source_workspace_id is None:
        return _active_context_error_response(
            status_code=404,
            stage="global",
            error_code="ACTIVE_CONTEXT_UNRESOLVED",
            user_message="Selected source was not found.",
            next_steps=[
                "Upload or select an existing source",
                "Choose the source again",
                "Retry this action",
            ],
        )

    if source_workspace_id != workspace_id:
        return _active_context_error_response(
            status_code=409,
            stage="global",
            error_code="ACTIVE_CONTEXT_STALE",
            user_message="Selected source belongs to a different workspace.",
            next_steps=[
                "Select a source from the current workspace",
                "Reconfirm active context",
                "Retry this action",
            ],
            technical_details={
                "workspace_id": workspace_id,
                "source_workspace_id": source_workspace_id,
            },
        )

    return WORKSPACE_APP.builder_session_service().resolve_active_context(
        workspace_id=workspace_id,
        workspace_name=str(workspace["name"]),
        source_id=source_id,
        source_name=source_id,
    )
