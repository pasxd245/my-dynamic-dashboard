"""Workspaces router — R13 in-memory store.

Persistence (DuckDB / SQLite / file) is explicitly deferred per
`.agents/plan/cycles/Round_13.md`. The module-level list dies on
process restart; that's the point.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class Workspace(BaseModel):
    id: str
    name: str
    createdAt: str  # noqa: N815 — mirrors the TS shape on the wire


class CreateWorkspace(BaseModel):
    name: str = Field(min_length=1, max_length=80)


_store: list[Workspace] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    return f"ws_{secrets.token_hex(4)}"


def reset_store_for_tests() -> None:
    _store.clear()


@router.get("", response_model=list[Workspace])
def list_workspaces() -> list[Workspace]:
    # Most-recent-first; createdAt is a sortable ISO-8601 string.
    return sorted(_store, key=lambda w: w.createdAt, reverse=True)


@router.post("", response_model=Workspace, status_code=status.HTTP_201_CREATED)
def create_workspace(body: CreateWorkspace) -> Workspace:
    ws = Workspace(id=_new_id(), name=body.name, createdAt=_now_iso())
    _store.append(ws)
    return ws
