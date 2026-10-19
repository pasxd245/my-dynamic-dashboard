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
- ``POST   /workflows/{id}/publish``    — publish the output as a dataset with
  lineage (R192, item 3.6a): create it, or replace its rows.

Run REUSES the shared ``app.query_engine`` (R133 extraction) — no router→router
import. Persistence is raw-SQLite + Pydantic. Step validation is deferred to RUN
(the output materializes on run, not live). R186: save checks that every source
exists, resolves now, is listed once, and has the first source's shape.
"""

from __future__ import annotations

import json
import secrets
import shutil
import sqlite3
from typing import Annotated

import pyarrow.parquet as pq

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import DASHBOARD_MAX_ROWS, ID_PATTERNS, PAGE_SIZES
from app.db import get_conn
from app.ingest.rows_reader import materialize_steps, query_dataset_rows
from app.ingest.parquet_writer import PROVENANCE_COLUMN
from app.ingest.profile import profile_date_coverage
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorNotPublishable,
    ApiErrorQueryStale,
    ApiErrorStepInvalid,
    Column,
    CreateWorkflowBody,
    PublishWorkflowBody,
    UpdateWorkflowBody,
    Workflow as WorkflowModel,
    WorkflowDefinition,
    WorkflowPublished,
    WorkflowRun,
    WorkflowStaleSource,
)
from app import history
from app.metadata import definition_version
from app.metadata import sweep as metadata_sweep
from app.workflow_runs import new_run_id, stale_sources, stamp_sources
from app.params import ParamError, check_workflow_steps, one_today
from app.query_engine import _source_name, _step_plan, build_consolidated_relation
from app.saved_copies import read_only_refusal
from app.routers._shared import (
    NounGone,
    RowsPage,
    _carry_forward_hidden,
    _dataset_from_row,
    _is_unique_violation,
    _now_iso,
)
from app.storage import dataset_dir, workflow_dir


router = APIRouter(tags=["workflows"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
WfIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workflow"])]

_SELECT_WORKFLOW = "SELECT * FROM workflows WHERE id = ?"


def _new_wf_id() -> str:
    return f"wf_{secrets.token_hex(4)}"


def _workflow_from_row(row: sqlite3.Row, con: sqlite3.Connection | None = None) -> WorkflowModel:
    definition = json.loads(row["definition_json"])
    out_cols = row["output_columns_json"]
    resolved = [Column(**c) for c in json.loads(out_cols)] if out_cols else None
    run = stale = None
    if row["run_json"] is not None and row["run_id"] is not None:
        # R187 — the stamp, and (with a connection) the sources that moved since.
        stamp = json.loads(row["run_json"])
        run = WorkflowRun(id=row["run_id"], number=row["run_number"], **stamp)
        if con is not None:
            stale = [WorkflowStaleSource(**s) for s in stale_sources(con, stamp)] or None
    published = _published_of(con, row) if con is not None else None
    return WorkflowModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        name=row["name"],
        definition=WorkflowDefinition(**definition),
        resolvedColumns=resolved,
        materializedAt=row["materialized_at"],
        run=run,
        staleSources=stale,
        published=published,
        createdAt=row["created_at"],
    )


def _published_row(con: sqlite3.Connection, workspace_id: str, workflow_id: str) -> sqlite3.Row | None:
    """R192 — the dataset this workflow publishes into, in its own workspace
    (at most one: `idx_datasets_published_unique`)."""
    return con.execute(
        "SELECT * FROM datasets WHERE workspace_id = ? AND published_workflow_id = ?",
        (workspace_id, workflow_id),
    ).fetchone()


def _published_of(con: sqlite3.Connection, row: sqlite3.Row) -> WorkflowPublished | None:
    ds = _published_row(con, row["workspace_id"], row["id"])
    if ds is None or not ds["lineage_json"]:
        return None
    lineage = json.loads(ds["lineage_json"])
    return WorkflowPublished(
        datasetId=ds["id"],
        datasetName=ds["name"],
        dataVersion=ds["data_version"],
        runId=lineage["runId"],
        runNumber=lineage["runNumber"],
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


def _consolidation_problem(problem: dict | None, index_of: list[int] | None = None) -> None:
    """Raise a consolidation problem as the route's 422 (the code leads `msg`);
    `index_of` maps the checked list's index back to the definition's."""
    if problem is None:
        return
    index = problem["index"] if index_of is None else index_of[problem["index"]]
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[
            {
                "loc": ["body", "definition", "sources", index],
                "msg": f"{problem['reason']}: {problem['msg']}",
                "type": "value_error",
            }
        ],
    )


def _validate_consolidation(con: sqlite3.Connection, sources: list[str], workspace_id: str) -> None:
    """R186 (W-2 / W-3 / W-5) — validate on SAVE what the run would otherwise find
    out later: every source resolves NOW (a workflow source has been run), no source
    is listed twice, and every source has the first one's shape. 422 with the
    offending source's index; the codes lead the `msg` (`unresolved_source`,
    `duplicate_source`, `sources_diverge`)."""
    _consolidated, problem = build_consolidated_relation(con, sources, workspace_id)
    _consolidation_problem(problem)


def _check_sources(
    con: sqlite3.Connection, sources: list[str], workspace_id: str, *, defer_unrun: bool
) -> None:
    """The save checks on a workflow's sources: each exists in the workspace, then
    (R186) they consolidate now. R201 (4.8, BA C8) — with ``defer_unrun`` (the
    definition-pack import only) a ``wf_`` source WITHOUT an output (new,
    replaced, never run) cannot be compared yet, so ONLY its comparison waits for
    the run (which refuses as it always has, ``409 query_stale``). Everything
    else still runs at save (CR-1): a source listed twice anywhere in the list
    (``duplicate_source``), and the full R186 check — resolution, parameters with
    no default, ``sources_diverge`` — over every source that can be checked now
    (the queries and the workflows that have an output). The routes keep R186's
    save check whole."""
    _validate_sources(con, sources, workspace_id)
    unrun: set[str] = set()
    if defer_unrun:
        for src in sources:
            if src.startswith("wf_"):
                row = con.execute("SELECT output_columns_json FROM workflows WHERE id = ?", (src,)).fetchone()
                if row is not None and row["output_columns_json"] is None:
                    unrun.add(src)
    if not unrun:
        _validate_consolidation(con, sources, workspace_id)
        return
    seen: dict[str, int] = {}
    for i, src in enumerate(sources):
        if src in seen:
            _consolidation_problem(
                {
                    "reason": "duplicate_source",
                    "index": i,
                    "msg": f"'{_source_name(con, src)}' is already source {seen[src] + 1}; listing it twice doubles every row",
                }
            )
        seen[src] = i
    ready = [i for i, src in enumerate(sources) if src not in unrun]
    if ready:
        _consolidated, problem = build_consolidated_relation(con, [sources[i] for i in ready], workspace_id)
        _consolidation_problem(problem, ready)


def write_workflow_create(
    con: sqlite3.Connection,
    workspace_id: str,
    name: str,
    definition: dict,
    writer: tuple[str | None, str | None],
    now: str,
    *,
    defer_unrun: bool = False,
) -> str:
    """R201 (4.8) — the body of ``POST /workspaces/{id}/workflows`` on the
    caller's connection, without a commit: no parameter refs in the steps, the
    sources (422), then the ``INSERT`` and the R200 history row. A name
    collision surfaces as ``sqlite3.IntegrityError``."""
    check_workflow_steps(definition["steps"])  # R194 (D6) — no parameter refs
    _check_sources(con, list(definition["sources"]), workspace_id, defer_unrun=defer_unrun)
    wid = _new_wf_id()
    definition_json = json.dumps(definition)
    con.execute(
        "INSERT INTO workflows (id, workspace_id, name, definition_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (wid, workspace_id, name, definition_json, now),
    )
    # R200 (4.4) — the first history row, in the create's transaction.
    history.record(con, "workflow", wid, definition_json, "create", writer, now)
    return wid


def write_workflow_update(
    con: sqlite3.Connection,
    workflow_id: str,
    name: str,
    definition: dict,
    writer: tuple[str | None, str | None],
    now: str,
    *,
    defer_unrun: bool = False,
) -> None:
    """R201 (4.8) — the body of ``PUT /workflows/{id}`` on the caller's
    connection, which already holds the write lock, without a commit:
    ``NounGone`` when the workflow is gone; the steps and sources (422); the
    ``UPDATE`` (a changed definition clears the output — R133 / CR-6); one
    history row when the definition changed. A name collision surfaces as
    ``sqlite3.IntegrityError``."""
    check_workflow_steps(definition["steps"])  # R194 (D6) — no parameter refs
    old = con.execute("SELECT workspace_id, definition_json FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    if old is None:
        raise NounGone(workflow_id)
    _check_sources(con, list(definition["sources"]), old["workspace_id"], defer_unrun=defer_unrun)
    definition_json = json.dumps(definition)
    # CR-6 — the same null-stripped hash as the history, so a re-save of an
    # unchanged definition (other key order, `null`s spelled out) keeps the output.
    if definition_version(definition) != definition_version(json.loads(old["definition_json"])):
        # Invalidate the stale materialized output — must re-run.
        # R187 — the run stamp goes with the output; the counter stays.
        con.execute(
            "UPDATE workflows SET name = ?, definition_json = ?, "
            "output_columns_json = NULL, materialized_at = NULL, run_id = NULL, run_json = NULL "
            "WHERE id = ?",
            (name, definition_json, workflow_id),
        )
    else:
        con.execute("UPDATE workflows SET name = ?, definition_json = ? WHERE id = ?", (name, definition_json, workflow_id))
    # R200 (4.4) — a definition change (not a rename) writes one history row.
    history.record_if_changed(con, "workflow", workflow_id, old["definition_json"], definition_json, writer, now)


@router.post("/workspaces/{id}/workflows", status_code=status.HTTP_201_CREATED)
def create_workflow(
    id: WsIdPath,  # noqa: A002
    body: CreateWorkflowBody,
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    """Save a workflow. Every source query must exist AND belong to this
    workspace (else 422). Names are unique per workspace."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workspaces=[id])) is not None:
        return ro
    created_at = _now_iso()
    try:
        with get_conn() as con:
            wid = write_workflow_create(
                con, id, body.name, body.definition.model_dump(), history.writer_of(authorization), created_at
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_workflows_name_unique" in str(err) or _is_unique_violation(err, "workflows.name"):
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        raise

    created = WorkflowModel(id=wid, workspaceId=id, name=body.name, definition=body.definition, createdAt=created_at)
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/workflows")
def list_workflows(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved workflows, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_workflow_from_row(r, con).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/workflows/{id}")
def get_workflow(id: WfIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved workflow (definition + metadata; resolvedColumns once run)."""
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        content = _workflow_from_row(row, con).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.put("/workflows/{id}")
def update_workflow(
    id: WfIdPath,  # noqa: A002
    body: UpdateWorkflowBody,
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    """Edit a saved workflow's name + definition. Every source must still exist in
    the workspace (422); names stay unique per workspace (409). Changing the
    DEFINITION invalidates the materialized output (the frozen result no longer
    matches the definition) → `resolvedColumns`/`materializedAt` are cleared and
    the workflow must be re-run. A name-only edit keeps the materialized output."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workflows=[id])) is not None:
        return ro
    with get_conn() as con:
        try:
            # R200 (4.4) — the write lock first, so the definition compared is the one replaced.
            con.execute("BEGIN IMMEDIATE")
            write_workflow_update(
                con, id, body.name, body.definition.model_dump(), history.writer_of(authorization), _now_iso()
            )
            con.commit()
        except NounGone:
            con.rollback()
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        except sqlite3.IntegrityError as err:
            if "idx_workflows_name_unique" in str(err) or _is_unique_violation(err, "workflows.name"):
                return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
            raise
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        content = _workflow_from_row(row, con).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.delete("/workflows/{id}")
def delete_workflow(id: WfIdPath) -> Response:  # noqa: A002
    """Delete a saved workflow. 404 if already absent."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workflows=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute("SELECT id FROM workflows WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM workflows WHERE id = ?", (id,))
        # R197 (3.8) — its metadata entries go with it (archived in metadata_entries_swept).
        metadata_sweep(con, _now_iso())
        history.sweep(con)  # R200 (4.4) — and its definition history
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
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workflows=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        workspace_id = row["workspace_id"]
        definition = json.loads(row["definition_json"])
        sources = definition["sources"]  # R135 — ≥1; consolidated via UNION ALL BY NAME
        steps = definition.get("steps") or []
        # R194 — one "today" for the whole run: the sources resolve their defaults and
        # the stamp records them on the same day.
        with one_today():
            consolidated, reason = build_consolidated_relation(con, sources, workspace_id)
            # R187 — stamp what this run reads, from the same connection that resolved it.
            stamp = (
                {"definitionHash": definition_version(definition), "sources": stamp_sources(con, sources, workspace_id)}
                if reason is None
                else None
            )

    if reason is not None and reason.get("param_unbound") is not None:
        # R194 (D6) — a source uses a parameter with no default: a run uses defaults
        # only, so it refuses, naming the parameter and the source.
        unbound = reason["param_unbound"]
        return ParamError("param_unbound", unbound.param, label=unbound.label, sourceId=unbound.source_id).response()
    if reason is not None:
        # A source query/workflow deleted / drifted / not-yet-run, or (R186) the
        # sources' shapes diverged since save → can't run.
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
    materialize_steps(consolidated["sql"], consolidated["params"], [c["name"] for c in columns], normalized, out_path)

    output_columns = [{"name": c["name"], "dtype": c["dtype"]} for c in final_cols]
    materialized_at = _now_iso()
    with get_conn() as con:
        con.execute(
            "UPDATE workflows SET output_columns_json = ?, materialized_at = ?, "
            "run_id = ?, run_number = run_number + 1, run_json = ? WHERE id = ?",
            (json.dumps(output_columns), materialized_at, new_run_id(), json.dumps(stamp), id),
        )
        con.commit()
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        content = _workflow_from_row(row, con).model_dump(exclude_none=True)
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


def _not_publishable(reason: str, stale: list[WorkflowStaleSource] | None = None) -> JSONResponse:
    body = ApiErrorNotPublishable(reason=reason, staleSources=stale)  # type: ignore[arg-type]
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body.model_dump(exclude_none=True))


@router.post("/workflows/{id}/publish")
def publish_workflow(id: WfIdPath, body: PublishWorkflowBody | None = None) -> JSONResponse:  # noqa: A002
    """R192 (item 3.6a) — publish the frozen output as a dataset in the
    workflow's workspace. First publish → 201 (a new dataset, `dataVersion` 1);
    re-publish → 200 (the same dataset, rows replaced, `dataVersion` + 1). The
    lineage is copied from the run stamp; nothing a client sends can set it.

    Refused with `409 not_publishable` — and nothing written — when the workflow
    has no stamped output (`never_run`), its output is out of date (`stale`),
    or a direct source of the run reads the dataset this publish would replace
    (`reads_itself`). A first publish onto a taken name is `409 name_taken`."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workflows=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute(_SELECT_WORKFLOW, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        wf = _workflow_from_row(row, con)
        target = _published_row(con, row["workspace_id"], id)
    ws_id = row["workspace_id"]
    output = workflow_dir(ws_id, id) / "output.parquet"
    if wf.materializedAt is None or wf.run is None or not output.exists():
        return _not_publishable("never_run")
    if wf.staleSources:
        return _not_publishable("stale", wf.staleSources)
    if target is not None and any(target["id"] in (s.dataVersions or {}) for s in wf.run.sources):
        return _not_publishable("reads_itself")
    if target is not None and json.loads(target["lineage_json"] or "{}").get("runId") == wf.run.id:
        # This run is already the published one: nothing to replace. Answer the
        # dataset as it is — no version bump, so nothing downstream reads as
        # "refreshed" when no row changed.
        return JSONResponse(
            status_code=status.HTTP_200_OK, content=_dataset_from_row(target).model_dump(exclude_none=True)
        )

    now = _now_iso()
    lineage = {
        "workflowId": id,
        "workflowName": wf.name,
        "runId": wf.run.id,
        "runNumber": wf.run.number,
        "runAt": wf.materializedAt,
        "definitionHash": wf.run.definitionHash,
        "sources": [s.model_dump(exclude_none=True) for s in wf.run.sources],
        "publishedAt": now,
    }
    cols = [{"name": c.name, "dtype": c.dtype} for c in wf.resolvedColumns or []]
    run_id = wf.run.id
    if target is None:
        # An upload's file-name column (`Source.Name`, R156) passing through the
        # workflow stays hidden by default, as it is on the upload.
        for c in cols:
            if c["name"] == PROVENANCE_COLUMN:
                c["hidden"] = True
        name = ((body.name if body else None) or wf.name).strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{"loc": ["body", "name"], "msg": "name is blank", "type": "value_error"}],
            )
        return _publish_new(ws_id, id, name, output, cols, lineage, now, run_id)
    return _republish(target, output, cols, lineage, now, run_id)


def _run_moved(workflow_id: str, run_id: str) -> bool:
    """True when the workflow ran again (or was edited, or deleted) since the
    publish read its stamp — the copied output may belong to another run."""
    with get_conn() as con:
        row = con.execute("SELECT run_id FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    return row is None or row["run_id"] != run_id


def _stage(dest_dir, output, cols: list[dict]) -> int:  # type: ignore[no-untyped-def]
    """Copy the output parquet into `dest_dir/parsed.parquet`, write source.json,
    profile date coverage into `cols` (in place); return the row count."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    parquet = dest_dir / "parsed.parquet"
    shutil.copyfile(output, parquet)
    (dest_dir / "source.json").write_text(json.dumps({"sourceFormat": "workflow"}))
    profile_date_coverage(parquet, cols)
    return pq.ParquetFile(parquet).metadata.num_rows


def _publish_new(  # type: ignore[no-untyped-def]
    ws_id: str, wf_id: str, name: str, output, cols: list[dict], lineage: dict, now: str, run_id: str
) -> JSONResponse:
    ds_id = f"ds_{secrets.token_hex(4)}"
    ds_dir = dataset_dir(ws_id, ds_id)
    try:
        row_count = _stage(ds_dir, output, cols)
        if _run_moved(wf_id, run_id):
            # A run finished while the output was copied: the rows may be the new
            # run's under the old stamp. Publish nothing; the page reloads.
            shutil.rmtree(ds_dir, ignore_errors=True)
            return _not_publishable("stale")
        with get_conn() as con:
            con.execute(
                "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
                "source_format, sheet_name, created_at, refreshed_at, data_version, lineage_json, "
                "published_workflow_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'workflow', NULL, ?, ?, 1, ?, ?)",
                (
                    ds_id,
                    ws_id,
                    name,
                    (ds_dir / "parsed.parquet").stat().st_size,
                    row_count,
                    len(cols),
                    json.dumps(cols, ensure_ascii=False),
                    now,
                    now,
                    json.dumps(lineage, ensure_ascii=False),
                    wf_id,
                ),
            )
            con.commit()
            created = con.execute("SELECT * FROM datasets WHERE id = ?", (ds_id,)).fetchone()
    except sqlite3.IntegrityError as exc:
        shutil.rmtree(ds_dir, ignore_errors=True)
        if "published_workflow_id" in str(exc):
            # A concurrent first publish won the race: this one is a re-publish.
            with get_conn() as con:
                target = _published_row(con, ws_id, wf_id)
            if target is not None:
                return _republish(target, output, cols, lineage, now, run_id)
        if _is_unique_violation(exc, "datasets.name") or "idx_datasets_name_unique" in str(exc):
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        raise
    except Exception:
        shutil.rmtree(ds_dir, ignore_errors=True)
        raise
    return JSONResponse(
        status_code=status.HTTP_201_CREATED, content=_dataset_from_row(created).model_dump(exclude_none=True)
    )


def _republish(  # type: ignore[no-untyped-def]
    target: sqlite3.Row, output, cols: list[dict], lineage: dict, now: str, run_id: str
) -> JSONResponse:
    """Replace the published dataset's rows — a refresh to every reader: stage,
    swap the directory, then bump `data_version` and stamp `refreshed_at` in the
    same UPDATE that records the new columns and lineage (R185's invariant). Any
    failure restores the previous directory."""
    ds_id = target["id"]
    ds_dir = dataset_dir(target["workspace_id"], ds_id)
    # Per-request names: two publishes at once never share (or delete) each
    # other's staging or backup directory.
    token = secrets.token_hex(4)
    staging_dir = ds_dir.parent / f"{ds_id}.staging-{token}"
    bak_dir = ds_dir.parent / f"{ds_id}.bak-{token}"
    _carry_forward_hidden(cols, json.loads(target["columns_json"]))
    try:
        row_count = _stage(staging_dir, output, cols)
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise
    if _run_moved(lineage["workflowId"], run_id):
        shutil.rmtree(staging_dir, ignore_errors=True)
        return _not_publishable("stale")
    size = (staging_dir / "parsed.parquet").stat().st_size
    had_dir = ds_dir.exists()  # a dataset directory lost on disk is replaced, not backed up
    if had_dir:
        ds_dir.replace(bak_dir)
    try:
        staging_dir.replace(ds_dir)
        with get_conn() as con:
            con.execute(
                "UPDATE datasets SET row_count=?, column_count=?, columns_json=?, size_bytes=?, refreshed_at=?, "
                "data_version=data_version+1, lineage_json=? WHERE id=?",
                (
                    row_count,
                    len(cols),
                    json.dumps(cols, ensure_ascii=False),
                    size,
                    now,
                    json.dumps(lineage, ensure_ascii=False),
                    ds_id,
                ),
            )
            con.commit()
            updated = con.execute("SELECT * FROM datasets WHERE id = ?", (ds_id,)).fetchone()
    except Exception:
        shutil.rmtree(ds_dir, ignore_errors=True)
        if had_dir:
            bak_dir.replace(ds_dir)
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise
    shutil.rmtree(bak_dir, ignore_errors=True)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content=_dataset_from_row(updated).model_dump(exclude_none=True)
    )
