"""Workspaces router — R16 SQLite-backed.

Wire shape unchanged from R13. Persistence migrated from a
module-level list to the SQLite `workspaces` table at
`apps/backend/data/app.sqlite` (configurable via `MDD_DB_PATH`).
The R13 in-memory list was explicitly deferred persistence; R16's
contract round locks the shape, so this round swaps the store
without changing the surface.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.db import get_conn
from app.models.common import Workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class CreateWorkspace(BaseModel):
    name: str = Field(min_length=1, max_length=80)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    return f"ws_{secrets.token_hex(4)}"


@router.get("", response_model=list[Workspace])
def list_workspaces() -> list[Workspace]:
    with get_conn() as con:
        rows = con.execute(
            "SELECT id, name, created_at FROM workspaces "
            "ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [
        Workspace(id=r["id"], name=r["name"], createdAt=r["created_at"]) for r in rows
    ]


@router.post("", response_model=Workspace, status_code=status.HTTP_201_CREATED)
def create_workspace(body: CreateWorkspace) -> Workspace:
    ws = Workspace(id=_new_id(), name=body.name, createdAt=_now_iso())
    with get_conn() as con:
        con.execute(
            "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
            (ws.id, ws.name, ws.createdAt),
        )
        con.commit()
    return ws
