from __future__ import annotations

from pathlib import Path

from app.apps.workspace_app import WorkspaceApp
from app.core.metadata_db import init_metadata_db
from app.schemas import WorkspaceCreateRequest
import app.apps.workspace_app as workspace_app_module


def test_workspace_app_create_and_list(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / "metadata.db"
    init_metadata_db(db_path)
    monkeypatch.setattr(workspace_app_module, "current_db_path", lambda: db_path)

    workspace_app = WorkspaceApp()
    first = workspace_app.create_workspace(WorkspaceCreateRequest(name="ws-alpha"))
    second = workspace_app.create_workspace(WorkspaceCreateRequest(name="ws-beta"))

    listed = workspace_app.list_workspaces()

    ids = [item.id for item in listed]
    names = [item.name for item in listed]

    assert first.id in ids
    assert second.id in ids
    assert "ws-alpha" in names
    assert "ws-beta" in names
