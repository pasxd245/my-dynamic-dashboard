from __future__ import annotations

import uuid

from app.core.metadata_db import get_connection
from app.schemas import WorkspaceCreateRequest, WorkspaceResponse
from app.services.builder_session_service import BuilderSessionService
from app.services.upload_service import utc_now_iso
from app.shared import current_db_path

ListWorkspacesResponse = list[WorkspaceResponse]


class WorkspaceApp:
    def __init__(
        self,
        *,
        builder_session_service: BuilderSessionService | None = None,
    ) -> None:
        self._builder_session_service = builder_session_service or BuilderSessionService()

    def builder_session_service(self) -> BuilderSessionService:
        return self._builder_session_service

    def source_workspace(self, source_id: str) -> str | None:
        with get_connection(current_db_path()) as conn:
            row = conn.execute(
                "SELECT workspace_id FROM source_files WHERE id = ?",
                (source_id,),
            ).fetchone()
        if row is None:
            return None
        return str(row["workspace_id"])

    def create_workspace(self, request: WorkspaceCreateRequest) -> WorkspaceResponse:
        workspace_id = str(uuid.uuid4())
        now = utc_now_iso()

        with get_connection(current_db_path()) as conn:
            conn.execute(
                """
                INSERT INTO workspaces (id, name, status, manifest_version, content_hash, created_at, updated_at)
                VALUES (?, ?, 'draft', 1, NULL, ?, ?)
                """,
                (workspace_id, request.name, now, now),
            )

        return WorkspaceResponse(
            id=workspace_id,
            name=request.name,
            status="draft",
            manifest_version=1,
        )

    def list_workspaces(self) -> ListWorkspacesResponse:
        with get_connection(current_db_path()) as conn:
            rows = conn.execute(
                "SELECT id, name, status, manifest_version FROM workspaces ORDER BY updated_at DESC"
            ).fetchall()

        return [
            WorkspaceResponse(
                id=str(row["id"]),
                name=str(row["name"]),
                status=str(row["status"]),
                manifest_version=int(row["manifest_version"]),
            )
            for row in rows
        ]


WORKSPACE_APP = WorkspaceApp()
