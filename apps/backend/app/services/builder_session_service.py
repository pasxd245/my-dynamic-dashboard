from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas import (
    ActiveContextResponse,
    ActiveSourceContext,
    ActiveWorkspaceContext,
    BuilderSessionState,
    ConnectionStatus,
    WorkflowStage,
    WorkflowStageKey,
)


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _resolve_current_stage(
    *,
    upload_complete: bool,
    active_context_resolved: bool,
    query_validated: bool,
    requested_stage: WorkflowStageKey | None,
) -> WorkflowStageKey:
    if requested_stage == "results_saved" and query_validated:
        return requested_stage
    if requested_stage == "query" and active_context_resolved and not query_validated:
        return requested_stage
    if requested_stage == "schema_sheet" and upload_complete:
        return requested_stage
    if requested_stage == "upload_source" and not upload_complete:
        return requested_stage

    if not upload_complete:
        return "upload_source"
    if not active_context_resolved:
        return "schema_sheet"
    if not query_validated:
        return "schema_sheet"
    return "results_saved"


def _stage_status(base_status: str, stage_key: WorkflowStageKey, current_stage: WorkflowStageKey) -> str:
    if base_status == "ready" and stage_key == current_stage:
        return "in_progress"
    return base_status


def _build_stages(
    *,
    current_stage: WorkflowStageKey,
    upload_complete: bool,
    active_context_resolved: bool,
    query_validated: bool,
) -> list[WorkflowStage]:
    return [
        WorkflowStage(
            stage_key="upload_source",
            title="Upload + Source",
            order_index=1,
            status="completed" if upload_complete else "in_progress",
            prerequisites=[],
            next_stage_key="schema_sheet",
        ),
        WorkflowStage(
            stage_key="schema_sheet",
            title="Schema + Sheet",
            order_index=2,
            status=_stage_status("ready" if upload_complete else "locked", "schema_sheet", current_stage),
            prerequisites=["upload_complete"],
            missing_prerequisites=[] if upload_complete else ["upload_complete"],
            previous_stage_key="upload_source",
            next_stage_key="query",
        ),
        WorkflowStage(
            stage_key="query",
            title="Query",
            order_index=3,
            status=(
                "completed"
                if query_validated
                else _stage_status(
                    "ready" if active_context_resolved else "locked",
                    "query",
                    current_stage,
                )
            ),
            prerequisites=["active_context_resolved"],
            missing_prerequisites=[] if active_context_resolved else ["active_context_resolved"],
            previous_stage_key="schema_sheet",
            next_stage_key="results_saved",
        ),
        WorkflowStage(
            stage_key="results_saved",
            title="Results + Saved",
            order_index=4,
            status=_stage_status("ready" if query_validated else "locked", "results_saved", current_stage),
            prerequisites=["query_validated"],
            missing_prerequisites=[] if query_validated else ["query_validated"],
            previous_stage_key="query",
        ),
    ]


@dataclass
class BuilderSessionService:
    _active_context: ActiveContextResponse | None = field(default=None)
    _validated_workspace_id: str | None = field(default=None)

    def build_default_state(
        self,
        *,
        connection_status: ConnectionStatus,
        current_stage: WorkflowStageKey | None = None,
    ) -> BuilderSessionState:
        active_workspace = ActiveWorkspaceContext(state="unresolved")
        active_source = ActiveSourceContext(state="unresolved")
        if self._active_context is not None:
            active_workspace = self._active_context.workspace
            active_source = self._active_context.source

        upload_complete = active_source.state == "resolved"
        active_context_resolved = active_workspace.state == "resolved" and active_source.state == "resolved"
        query_validated = (
            active_context_resolved
            and active_workspace.workspace_id is not None
            and self._validated_workspace_id == active_workspace.workspace_id
        )
        resolved_current_stage = _resolve_current_stage(
            upload_complete=upload_complete,
            active_context_resolved=active_context_resolved,
            query_validated=query_validated,
            requested_stage=current_stage,
        )

        return BuilderSessionState(
            connection_status=connection_status,
            active_workspace=active_workspace,
            active_source=active_source,
            current_stage=resolved_current_stage,
            stages=_build_stages(
                current_stage=resolved_current_stage,
                upload_complete=upload_complete,
                active_context_resolved=active_context_resolved,
                query_validated=query_validated,
            ),
        )

    def resolve_active_context(
        self,
        *,
        workspace_id: str,
        workspace_name: str | None,
        source_id: str,
        source_name: str | None,
    ) -> ActiveContextResponse:
        now = _utc_now_iso()
        workspace = ActiveWorkspaceContext(
            state="resolved",
            workspace_id=workspace_id,
            workspace_name=workspace_name,
            selected_at_utc=now,
            resolved_at_utc=now,
        )
        source = ActiveSourceContext(
            state="resolved",
            source_id=source_id,
            source_name=source_name,
            workspace_id=workspace_id,
            selected_at_utc=now,
            resolved_at_utc=now,
        )
        self._active_context = ActiveContextResponse(workspace=workspace, source=source)
        self._validated_workspace_id = None
        return self._active_context

    def get_active_context(self) -> ActiveContextResponse | None:
        return self._active_context

    def mark_query_validated(self, workspace_id: str) -> None:
        self._validated_workspace_id = workspace_id

    def reset_active_context(self) -> None:
        self._active_context = None
        self._validated_workspace_id = None
