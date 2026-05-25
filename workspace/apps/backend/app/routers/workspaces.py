"""Workspaces router — R16 SQLite-backed.

Wire shape unchanged from R13. Persistence migrated from a
module-level list to the SQLite `workspaces` table at
`<data_root>/app.sqlite` (data root configurable via
`backend.data_dir` config / `MDD_BACKEND__DATA_DIR` env var as
of R30). The R13 in-memory list was explicitly deferred
persistence; R16's contract round locks the shape, so this
round swaps the store without changing the surface.
"""

from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Path, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app._generated.constants import ID_PATTERNS, NAME_LENGTHS
from app.db import get_conn
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNonEmpty,
    ApiErrorNotFound,
    Workspace,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class CreateWorkspace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["workspace_max"])]


class RenameWorkspaceBody(BaseModel):
    """PATCH /workspaces/{id} body — workspace `name` bound from
    NAME_LENGTHS (R29 — was hardcoded 1-80)."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["workspace_max"])]


# Path parameter type — pattern sourced from ID_PATTERNS (R29 — was
# hardcoded `^ws_[0-9a-f]{8}$`).
WsIdPath = Annotated[str, Path(pattern=ID_PATTERNS["workspace"])]


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    return f"ws_{secrets.token_hex(4)}"


def _is_unique_violation(err: sqlite3.IntegrityError, table_index_substr: str) -> bool:
    """SQLite IntegrityError message names the violated index, e.g.
    'UNIQUE constraint failed: workspaces.name'."""
    return table_index_substr in str(err)


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


@router.post("", status_code=status.HTTP_201_CREATED)
def create_workspace(body: CreateWorkspace) -> JSONResponse:
    """Create a workspace.

    R25 tightening: global uniqueness on `name`. A collision returns
    409 `name_taken` (was: silent dup-allow in R13). The unique index
    `idx_workspaces_name_unique` enforces the constraint at the DB
    level; this handler maps `IntegrityError` to the code-first
    envelope per the R23 design.
    """
    ws = Workspace(id=_new_id(), name=body.name, createdAt=_now_iso())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
                (ws.id, ws.name, ws.createdAt),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if _is_unique_violation(err, "workspaces.name"):
            return JSONResponse(
                status_code=409,
                content=ApiErrorNameTaken().model_dump(),
            )
        raise
    return JSONResponse(
        status_code=201,
        content=ws.model_dump(),
    )


@router.patch("/{id}")
def rename_workspace(  # noqa: A002 — match contract path param name
    id: WsIdPath,
    body: RenameWorkspaceBody,
) -> JSONResponse:
    """Rename a workspace.

    R23 design + R24 contract. Pre-checks existence (404 if missing);
    UPDATE may still violate the unique-name index (409 `name_taken`).
    """
    with get_conn() as con:
        row = con.execute(
            "SELECT id, name, created_at FROM workspaces WHERE id = ?", (id,)
        ).fetchone()
        if row is None:
            return JSONResponse(
                status_code=404, content=ApiErrorNotFound().model_dump()
            )
        try:
            con.execute(
                "UPDATE workspaces SET name = ? WHERE id = ?",
                (body.name, id),
            )
            con.commit()
        except sqlite3.IntegrityError as err:
            if _is_unique_violation(err, "workspaces.name"):
                return JSONResponse(
                    status_code=409,
                    content=ApiErrorNameTaken().model_dump(),
                )
            raise

    ws = Workspace(id=id, name=body.name, createdAt=row["created_at"])
    return JSONResponse(status_code=200, content=ws.model_dump())


@router.delete("/{id}")
def delete_workspace(id: WsIdPath) -> Response:  # noqa: A002
    """Delete a workspace.

    Pre-checks dataset count and blocks (409 `non_empty` with
    `datasetCount`) if any datasets reference the workspace. The
    existing `ON DELETE CASCADE` foreign key is a belt-and-braces;
    the pre-check is the design intent (R23 chose block, not
    cascade).

    On success: 204 No Content. On already-absent: 404
    `not_found` (lets the FE distinguish "you did this" from
    "someone else did").
    """
    with get_conn() as con:
        ws_row = con.execute(
            "SELECT id FROM workspaces WHERE id = ?", (id,)
        ).fetchone()
        if ws_row is None:
            return JSONResponse(
                status_code=404, content=ApiErrorNotFound().model_dump()
            )

        (count,) = con.execute(
            "SELECT COUNT(*) FROM datasets WHERE workspace_id = ?", (id,)
        ).fetchone()
        if count > 0:
            return JSONResponse(
                status_code=409,
                content=ApiErrorNonEmpty(datasetCount=count).model_dump(),
            )

        con.execute("DELETE FROM workspaces WHERE id = ?", (id,))
        con.commit()

    return Response(status_code=204)
