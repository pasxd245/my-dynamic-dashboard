"""Workflows router — R132 (CRUD) + R134 (run → materialize + rows).

A **Workflow** (`wf_`) consolidates + transforms saved **queries** into a
MATERIALIZED output:

- ``POST   /workspaces/{id}/workflows`` — save (validate-on-save: sources exist).
- ``GET    /workspaces/{id}/workflows`` — list, most-recent-first.
- ``GET    /workflows/{id}``            — one saved workflow.
- ``DELETE /workflows/{id}``            — delete (204).
- ``POST   /workflows/{id}/run``        — resolve the source query, apply steps,
  write the TYPED output to parquet + capture its schema (R134).
- ``GET    /workflows/{id}/rows``       — page the materialized output (R134).

Run REUSES the shared ``app.query_engine`` (R133 extraction) — no router→router
import. Persistence is raw-SQLite + Pydantic. Step validation is deferred to RUN
(the output materializes on run, not live), so create only checks sources exist.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import DASHBOARD_MAX_ROWS, ID_PATTERNS, PAGE_SIZES
from app.db import get_conn
from app.ingest.rows_reader import materialize_steps, query_dataset_rows
from app.models.common import (
    ApiErrorCompositionCycle,
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorQueryStale,
    ApiErrorStepInvalid,
    Column,
    CreateWorkflowBody,
    UpdateWorkflowBody,
    Workflow as WorkflowModel,
    WorkflowDefinition,
)
from app.query_engine import _step_plan, build_consolidated_relation
from app.routers._shared import RowsPage, _is_unique_violation, _now_iso
from app.storage import workflow_dir


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
    """Each source must be a saved query (`qr_`) OR a workflow output (`wf_`, R135)
    in THIS workspace → else 422."""
    for i, src in enumerate(sources):
        table = "queries" if src.startswith("qr_") else "workflows"
        row = con.execute(f"SELECT workspace_id FROM {table} WHERE id = ?", (src,)).fetchone()
        if row is None or row["workspace_id"] != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[
                    {
                        "loc": ["body", "definition", "sources", i],
                        "msg": f"unknown_source: {src} is not a query/workflow in workspace {workspace_id}",
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


@router.put("/workflows/{id}")
def update_workflow(id: WfIdPath, body: UpdateWorkflowBody) -> JSONResponse:  # noqa: A002
    """Edit a saved workflow's name + definition. Every source must still exist in
    the workspace (422); names stay unique per workspace (409). Changing the
    DEFINITION invalidates the materialized output (the frozen result no longer
    matches the definition) → `resolvedColumns`/`materializedAt` are cleared and
    the workflow must be re-run. A name-only edit keeps the materialized output."""
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        _validate_sources(con, list(body.definition.sources), row["workspace_id"])

        new_definition = body.definition.model_dump()
        definition_changed = new_definition != json.loads(row["definition_json"])
        definition_json = json.dumps(new_definition)
        try:
            if definition_changed:
                # Invalidate the stale materialized output — must re-run.
                con.execute(
                    "UPDATE workflows SET name = ?, definition_json = ?, "
                    "output_columns_json = NULL, materialized_at = NULL WHERE id = ?",
                    (body.name, definition_json, id),
                )
            else:
                con.execute(
                    "UPDATE workflows SET name = ?, definition_json = ? WHERE id = ?",
                    (body.name, definition_json, id),
                )
            con.commit()
        except sqlite3.IntegrityError as err:
            if "idx_workflows_name_unique" in str(err) or _is_unique_violation(err, "workflows.name"):
                return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
            raise
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
    return JSONResponse(status_code=status.HTTP_200_OK, content=_workflow_from_row(row).model_dump(exclude_none=True))


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


@router.post("/workflows/{id}/run")
def run_workflow(id: WfIdPath) -> JSONResponse:  # noqa: A002
    """MATERIALIZE the workflow: resolve its (single, v1) source query via the
    shared engine, apply the workflow's steps over the resolved relation, write the
    TYPED result to ``output.parquet``, and capture the output schema. 404 if the
    workflow is absent; 409 if the source query cycles / drifted so the run can no
    longer resolve, or a step no longer validates against the current columns.

    The source query already bakes ITS own filters into the sub-relation the engine
    resolves, so the workflow layer runs with no extra predicates — only its steps."""
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        workspace_id = row["workspace_id"]
        definition = json.loads(row["definition_json"])
        sources = definition["sources"]  # R135 — ≥1; consolidated via UNION ALL BY NAME
        steps = definition.get("steps") or []
        consolidated, reason = build_consolidated_relation(con, sources, workspace_id)

    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason is not None:
        # A source query/workflow deleted / drifted / not-yet-run → can't run.
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
    columns = consolidated["columns"]
    try:
        step_plan = _step_plan(steps, columns)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            # R165 W-8 — a step the engine refuses is `step_invalid`, not `query_stale`
            # (which stays the code for a drifted source/predicate above).
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorStepInvalid().model_dump())
        raise

    normalized = step_plan[0] if step_plan else []
    final_cols = step_plan[1] if step_plan else columns
    out_path = workflow_dir(workspace_id, id) / "output.parquet"
    materialize_steps(
        consolidated["sql"], consolidated["params"], [c["name"] for c in columns], normalized, out_path
    )

    output_columns = [{"name": c["name"], "dtype": c["dtype"]} for c in final_cols]
    materialized_at = _now_iso()
    with get_conn() as con:
        con.execute(
            "UPDATE workflows SET output_columns_json = ?, materialized_at = ? WHERE id = ?",
            (json.dumps(output_columns), materialized_at, id),
        )
        con.commit()
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
    content = _workflow_from_row(row).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.get("/workflows/{id}/rows")
def workflow_rows(
    id: WfIdPath,  # noqa: A002
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
    unpaged: Annotated[bool, Query()] = False,
) -> JSONResponse:
    """Page a MATERIALIZED workflow's output (same ``RowsPage`` shape as the query
    rows path; ``unpaged=true`` is the widget load path, capped at
    ``dashboard_max_rows``). 404 if the workflow is absent OR has never been run
    (no materialized output yet — run it first)."""
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
    if row is None or row["output_columns_json"] is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())

    if unpaged:
        eff_page, eff_page_size = 1, DASHBOARD_MAX_ROWS
    else:
        if page_size not in PAGE_SIZES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"page_size must be one of {PAGE_SIZES}; got {page_size}",
            )
        eff_page, eff_page_size = page, page_size

    columns = [c["name"] for c in json.loads(row["output_columns_json"])]
    out_path = workflow_dir(row["workspace_id"], id) / "output.parquet"
    rows, total = query_dataset_rows(out_path, columns, page=eff_page, page_size=eff_page_size, q=None)
    echoed_page_size = len(rows) if unpaged else eff_page_size
    body = RowsPage(rows=rows, page=eff_page, pageSize=echoed_page_size, total=total)
    return JSONResponse(status_code=status.HTTP_200_OK, content=body.model_dump())
