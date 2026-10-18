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
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app._generated.constants import ID_PATTERNS, NAME_LENGTHS
from app.db import get_conn
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNonEmpty,
    ApiErrorNotFound,
    Workspace,
)
from app.routers._shared import _dataset_from_row, _is_unique_violation, _now_iso
from app.saved_copies import (
    LABEL_MAX,
    read_only_refusal,
    save_copies,
    workspace_from_row,
    workspace_json,
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


def _new_id() -> str:
    return f"ws_{secrets.token_hex(4)}"


class SaveCopiesBody(BaseModel):
    """R193 — POST /workspaces/{id}/saved-copies."""

    model_config = ConfigDict(extra="forbid")

    label: Annotated[str, Field(min_length=1, max_length=LABEL_MAX)]
    datasetIds: Annotated[  # noqa: N815 — wire shape
        list[Annotated[str, Field(pattern=ID_PATTERNS["dataset"])]], Field(min_length=1, max_length=20)
    ]

    @field_validator("label")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("label must not be blank")
        return v.strip()

    @field_validator("datasetIds")
    @classmethod
    def _unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("datasetIds must not repeat a dataset")
        return v


@router.get("", response_model=list[Workspace], response_model_exclude_none=True)
def list_workspaces() -> list[Workspace]:
    with get_conn() as con:
        rows = con.execute("SELECT * FROM workspaces ORDER BY created_at DESC, id DESC").fetchall()
    return [workspace_from_row(r) for r in rows]


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
                status_code=status.HTTP_409_CONFLICT,
                content=ApiErrorNameTaken().model_dump(),
            )
        raise
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=workspace_json(ws),
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
    if (ro := read_only_refusal(workspaces=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute("SELECT * FROM workspaces WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        try:
            con.execute(
                "UPDATE workspaces SET name = ? WHERE id = ?",
                (body.name, id),
            )
            con.commit()
        except sqlite3.IntegrityError as err:
            if _is_unique_violation(err, "workspaces.name"):
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content=ApiErrorNameTaken().model_dump(),
                )
            raise

        updated = con.execute("SELECT * FROM workspaces WHERE id = ?", (id,)).fetchone()
    return JSONResponse(status_code=status.HTTP_200_OK, content=workspace_json(workspace_from_row(updated)))


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

    R193 — a saved workspace is deleted like any other once empty (its copies
    are deleted one by one). A main workspace's saved copies count as its own:
    while it has any, the main workspace is `non_empty` — no saved workspace is
    ever left without its main one. An EMPTY saved workspace goes with its main
    workspace (nothing is lost).
    """
    with get_conn() as con:
        ws_row = con.execute("SELECT id FROM workspaces WHERE id = ?", (id,)).fetchone()
        if ws_row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())

        saved = con.execute("SELECT id FROM workspaces WHERE parent_workspace_id = ?", (id,)).fetchone()
        scope = [id] if saved is None else [id, saved["id"]]
        marks = ",".join("?" * len(scope))
        (count,) = con.execute(
            f"SELECT COUNT(*) FROM datasets WHERE workspace_id IN ({marks})",  # noqa: S608 — placeholders only
            scope,
        ).fetchone()
        if count > 0:
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=ApiErrorNonEmpty(datasetCount=count).model_dump(),
            )

        con.execute(f"DELETE FROM workspaces WHERE id IN ({marks})", scope)  # noqa: S608 — placeholders only
        con.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{id}/saved-copies", status_code=status.HTTP_201_CREATED)
def save_frozen_copies(id: WsIdPath, body: SaveCopiesBody) -> JSONResponse:  # noqa: A002
    """R193 (item 3.6b) — freeze datasets of this main workspace into its saved
    workspace (created on first use). All copies or none."""
    with get_conn() as con:
        main = con.execute("SELECT * FROM workspaces WHERE id = ?", (id,)).fetchone()
        if main is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        if main["kind"] == "saved":
            return read_only_refusal(workspaces=[id], con=con)  # type: ignore[return-value]
        marks = ",".join("?" * len(body.datasetIds))
        mine = {
            r["id"]
            for r in con.execute(
                f"SELECT id FROM datasets WHERE workspace_id = ? AND id IN ({marks})",  # noqa: S608 — placeholders only
                [id, *body.datasetIds],
            )
        }
    missing = [i for i, ds in enumerate(body.datasetIds) if ds not in mine]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": ["body", "datasetIds", i],
                    "msg": f"unknown_dataset: {body.datasetIds[i]} is not a dataset in workspace {id}",
                    "type": "unknown_dataset",
                }
                for i in missing
            ],
        )
    try:
        saved, rows = save_copies(main, body.label, body.datasetIds)
    except LookupError:  # an original deleted mid-save — nothing was written
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "datasetIds"], "msg": "unknown_dataset", "type": "unknown_dataset"}],
        ) from None
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "workspace": workspace_json(saved),
            "datasets": [_dataset_from_row(r).model_dump(exclude_none=True) for r in rows],
        },
    )
