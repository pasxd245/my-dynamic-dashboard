"""Workflows router — R132 (the `queries ⇒ workflows` module, CRUD).

A **Workflow** (`wf_`) consolidates + transforms saved **queries** into a
MATERIALIZED output. This round is the noun's CRUD:

- ``POST   /workspaces/{id}/workflows`` — save (validate-on-save: sources exist).
- ``GET    /workspaces/{id}/workflows`` — list, most-recent-first.
- ``GET    /workflows/{id}``            — one saved workflow.
- ``DELETE /workflows/{id}``            — delete (204).

Run → materialize (R133) and multi-query/output-as-source (R134) come next.
Persistence is raw-SQLite + Pydantic (the established backend standard). Step
validation against the source's columns is deferred to RUN (R133) — the output
is materialized on run, not live — so create only checks the sources exist.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS
from app.db import get_conn
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    Column,
    CreateWorkflowBody,
    Workflow as WorkflowModel,
    WorkflowDefinition,
)
from app.routers._shared import _is_unique_violation, _now_iso


router = APIRouter(tags=["workflows"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
WfIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workflow"])]

_SELECT_WORKFLOW = "SELECT * FROM workflows WHERE id = ?"


def _new_wf_id() -> str:
    return f"wf_{secrets.token_hex(4)}"


def _workflow_from_row(row: sqlite3.Row) -> WorkflowModel:
    definition = json.loads(row["definition_json"])
    out_cols = row["output_columns_json"]
    resolved = [Column(**c) for c in json.loads(out_cols)] if out_cols else None
    return WorkflowModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        name=row["name"],
        definition=WorkflowDefinition(**definition),
        resolvedColumns=resolved,
        materializedAt=row["materialized_at"],
        createdAt=row["created_at"],
    )


def _validate_sources(con: sqlite3.Connection, sources: list[str], workspace_id: str) -> None:
    """Each source must be a saved query (`qr_`) in THIS workspace → else 422."""
    for i, src in enumerate(sources):
        row = con.execute("SELECT workspace_id FROM queries WHERE id = ?", (src,)).fetchone()
        if row is None or row["workspace_id"] != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[
                    {
                        "loc": ["body", "definition", "sources", i],
                        "msg": f"unknown_source: {src} is not a query in workspace {workspace_id}",
                        "type": "value_error",
                    }
                ],
            )


@router.post("/workspaces/{id}/workflows", status_code=status.HTTP_201_CREATED)
def create_workflow(id: WsIdPath, body: CreateWorkflowBody) -> JSONResponse:  # noqa: A002
    """Save a workflow. Every source query must exist AND belong to this
    workspace (else 422). Names are unique per workspace."""
    with get_conn() as con:
        _validate_sources(con, list(body.definition.sources), id)

    wid = _new_wf_id()
    created_at = _now_iso()
    definition_json = json.dumps(body.definition.model_dump())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO workflows (id, workspace_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (wid, id, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_workflows_name_unique" in str(err) or _is_unique_violation(err, "workflows.name"):
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        raise

    created = WorkflowModel(
        id=wid, workspaceId=id, name=body.name, definition=body.definition, createdAt=created_at
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/workflows")
def list_workflows(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved workflows, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_workflow_from_row(r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/workflows/{id}")
def get_workflow(id: WfIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved workflow (definition + metadata; resolvedColumns once run)."""
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        content = _workflow_from_row(row).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.delete("/workflows/{id}")
def delete_workflow(id: WfIdPath) -> Response:  # noqa: A002
    """Delete a saved workflow. 404 if already absent."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM workflows WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM workflows WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
