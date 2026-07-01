"""Queries router — R69 Saved Query MVP.

Five endpoints (see workspace/packages/contracts/queries/*):

- ``POST   /workspaces/{id}/queries`` — save a query (validate-on-save).
- ``GET    /workspaces/{id}/queries`` — list, most-recent-first.
- ``GET    /queries/{id}``            — one saved query.
- ``GET    /queries/{id}/rows``       — RUN: live re-run, paged.
- ``DELETE /queries/{id}``            — delete (204).

Persistence is raw-SQLite + Pydantic (the established backend standard),
NOT SQLModel — see Round_69 Do (J-3 build-time deviation). The run path
re-validates the saved definition against the dataset's CURRENT columns
and delegates to the shipped ``query_dataset_rows`` engine; a definition
that no longer validates returns ``409 query_stale`` instead of executing.
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
from app.ingest.filters import build_definition_predicates
from app.ingest.rows_reader import query_aggregate_rows, query_dataset_rows
from app.models.common import (
    AggregateBody,
    ApiErrorCompositionCycle,
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorQueryStale,
    ApiErrorRelationshipStale,
    CreateQueryBody,
    PreviewQueryBody,
    Query as QueryModel,
    QueryDefinition,
    UpdateQueryBody,
)
from app.query_engine import (
    _SELECT_QUERY,
    _aggregate_output_columns,
    _build_inner_relation,
    _chain_of,
    _execute_chain,
    _rels_of,
    _resolve_plan,
    _resolved_columns,
    _run_steps,
    _step_plan,
    _to_resolved,
    _validate_aggregate,
)
from app.routers._shared import RowsPage, _is_unique_violation, _now_iso
from app.storage import dataset_dir


router = APIRouter(tags=["queries"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]

_PAGE_SIZE_ALLOWED = PAGE_SIZES  # R72 — centralized (values.yaml → constants)

# `_SELECT_QUERY` + the resolution/step engine now live in `app.query_engine`
# (R133 extraction — shared with the workflows router).


def _new_qr_id() -> str:
    return f"qr_{secrets.token_hex(4)}"


def _query_from_row(con: sqlite3.Connection, row: sqlite3.Row) -> QueryModel:
    definition = json.loads(row["definition_json"])
    source_id = row["source_id"]
    return QueryModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        sourceId=source_id,
        name=row["name"],
        definition=QueryDefinition(**definition),
        resolvedColumns=_resolved_columns(con, definition, source_id, row["workspace_id"]),
        createdAt=row["created_at"],
    )


@router.post("/workspaces/{id}/queries", status_code=status.HTTP_201_CREATED)
def create_query(id: WsIdPath, body: CreateQueryBody) -> JSONResponse:  # noqa: A002
    """Save a query. The source dataset must exist AND belong to this
    workspace; the definition is validated against its current columns
    (a definition that can't run is rejected 422). Names are unique
    per workspace."""
    definition_dict = body.definition.model_dump()
    chain = _chain_of(definition_dict)
    # R79 — the driving source is the single, canonical `sourceId` (a `ds_` dataset
    # or a `qr_` composed base).
    source_id = body.sourceId
    # R71/R73/R76 — a joined OR composed query's atoms index the EFFECTIVE space;
    # the driving source + every hop must resolve at save time (resolve_source
    # checks the base dataset/query exists + is in-workspace). A cycle (a query
    # built transitively on itself) is rejected as composition_cycle. A bare
    # single-dataset query validates against its one dataset's columns.
    with get_conn() as con:
        plan, reason = _resolve_plan(con, source_id, chain, _rels_of(definition_dict), id)
    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason == "source_missing":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": ["body", "sourceId"],
                    "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                    "type": "value_error",
                }
            ],
        )
    if reason is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot persist a query that can't run).
    build_definition_predicates(definition_dict, plan["columns"])
    # R120 — transform steps validate against the same (pre-step) column space → 422.
    _step_plan(definition_dict.get("steps") or [], plan["columns"])

    qid = _new_qr_id()
    created_at = _now_iso()
    definition_json = json.dumps(body.definition.model_dump())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO queries "
                "(id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (qid, id, source_id, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_queries_name_unique" in str(err) or _is_unique_violation(err, "queries.name"):
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        raise

    created = QueryModel(
        id=qid,
        workspaceId=id,
        sourceId=source_id,
        name=body.name,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/queries")
def list_queries(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved queries, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM queries WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_query_from_row(con, r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/queries/{id}")
def get_query(id: QueryIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved query (definition + metadata; resolvedColumns when joined)."""
    with get_conn() as con:
        row = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        content = _query_from_row(con, row).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.get("/queries/{id}/rows")
def run_query(  # noqa: A002
    id: QueryIdPath,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
    unpaged: Annotated[bool, Query()] = False,
) -> JSONResponse:
    """RUN the saved query: re-execute its definition against CURRENT data,
    paged. For a JOINED query (R71) the two related datasets are read as one;
    409 relationship_stale if the join key drifted (the join is blocked), 409
    query_stale if a predicate atom drifted.

    R107 — ``unpaged=true`` is the dashboard widget's single-request load path:
    paging is bypassed and rows are returned in ONE response, capped
    server-side at ``DASHBOARD_MAX_ROWS`` (the name is the mechanism, not a
    completeness promise — an oversized result is still capped). ``total`` still
    carries the full matched count, so a capped/partial result is detectable via
    ``total > len(rows)``."""
    if unpaged:
        # Unpaged: read the first page sized to the cap. `total` (computed
        # separately) stays the full matched count, preserving the over-cap warning.
        eff_page, eff_page_size = 1, DASHBOARD_MAX_ROWS
    else:
        if page_size not in _PAGE_SIZE_ALLOWED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
            )
        eff_page, eff_page_size = page, page_size

    # Gather the run plan under the sqlite connection; execute the (duckdb) read
    # after it closes — the existing single-source discipline, extended for join.
    # R71/R73/R76 — a joined OR composed run resolves the driving source + every
    # hop with valid keys; a drift BLOCKS the run (409 relationship_stale), and a
    # base that loops back → 409 composition_cycle — never silently wrong, never an
    # infinite recursion.
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])

    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason == "source_missing":
        # Defensive: the app-level cascade (R79) removes queries when their source
        # dataset is deleted, so this is a belt-and-braces 404.
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())
    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
        step_plan = _step_plan(definition.get("steps") or [], plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise

    q = definition.get("q")
    # R120 — a query with a transform step returns its SHAPED (grouped) rows: the
    # step runs over the resolved+filtered relation, server-side over the whole
    # result (one row per group), so paging/`unpaged` don't apply (the result is
    # small by construction). A stepless query takes the existing paged path.
    if step_plan is not None:
        rows = _run_steps(plan, q, filters, advanced, step_plan)
        body = RowsPage(rows=rows, page=1, pageSize=len(rows), total=len(rows))
        return JSONResponse(status_code=status.HTTP_200_OK, content=body.model_dump())

    if plan["kind"] == "join":
        rows, total = _execute_chain(
            plan["payload"], page=eff_page, page_size=eff_page_size, q=q, filters=filters, advanced=advanced
        )
    else:
        ds = plan["ds"]
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in plan["columns"]],
            page=eff_page,
            page_size=eff_page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )

    # Unpaged response echoes the returned row count as pageSize (it's not a
    # "page" in the pager sense); paged response echoes the requested size.
    echoed_page_size = len(rows) if unpaged else eff_page_size
    body = RowsPage(rows=rows, page=eff_page, pageSize=echoed_page_size, total=total)
    return JSONResponse(status_code=status.HTTP_200_OK, content=body.model_dump())


@router.post("/queries/{id}/aggregate")
def aggregate_query(id: QueryIdPath, body: AggregateBody) -> JSONResponse:  # noqa: A002
    """R119 — SERVER-SIDE AGGREGATE: a stateless ``GROUP BY (dimensions) →
    measures`` over the saved query's resolved rows, computed in DuckDB over the
    WHOLE result (no row cap — the result is one row per group). The dashboard
    consumer (bar/pie/line/scalar KPI) binds to this instead of rolling capped
    raw rows up client-side, so totals are correct regardless of the fetch cap.

    Resolves the saved query's plan with the SAME engine as the run path
    (driving source + joins + its OWN definition filters), so drift semantics
    are inherited verbatim: 404 absent · 409 composition_cycle /
    relationship_stale / query_stale. The aggregate spec is re-validated against
    the EFFECTIVE columns (422). ``filters`` are the runtime dashboard filters
    (R103), pushed server-side as a name-based one-of so an aggregated widget
    honours an active filter; a filter on a column this query lacks is skipped
    (mirrors the client ``applyFilters``)."""
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])

    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason == "source_missing":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())

    # Validate the aggregate spec against the effective columns (422) BEFORE the
    # predicate re-check, so a malformed request 422s regardless of query state.
    measures = _validate_aggregate(body.dimensions, [m.model_dump() for m in body.measures], plan["columns"], ["body"])

    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise

    # A dashboard filter on a column this query lacks is skipped (R103 semantics).
    col_names = {c["name"] for c in plan["columns"]}
    dashboard_filters = [(f.column, f.values) for f in body.filters if f.column in col_names]

    inner_sql, inner_params = _build_inner_relation(plan, definition.get("q"), filters, advanced)
    rows = query_aggregate_rows(
        inner_sql,
        inner_params,
        dimensions=body.dimensions,
        measures=measures,
        dashboard_filters=dashboard_filters,
    )
    out_columns = _aggregate_output_columns(body.dimensions, measures, plan["columns"])
    content = {"columns": out_columns, "rows": rows, "total": len(rows)}
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.post("/workspaces/{id}/queries/preview")
def preview_query(  # noqa: A002
    id: WsIdPath,
    body: PreviewQueryBody,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
) -> JSONResponse:
    """R72 — PREVIEW an UNSAVED working-copy definition (the construction
    surface's live preview), paged. Runs the SAME engines as the saved run
    against current data, but persists NOTHING. Mirrors the saved run's drift
    semantics: a drifted join key → 409 relationship_stale; a drifted predicate
    atom → 409 query_stale. A structurally-bad request (unknown / cross-workspace
    dataset or edge, bad page_size) → 422. Joined → the result carries the
    server-computed resolvedColumns (the builder's headers)."""
    if page_size not in _PAGE_SIZE_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
        )

    definition = body.definition.model_dump()
    chain = _chain_of(definition)
    source_id = body.sourceId  # R79 — the canonical driving source (ds_ or qr_)
    with get_conn() as con:
        plan, reason = _resolve_plan(con, source_id, chain, _rels_of(definition), id)

    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason == "relationship_stale":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())
    if reason == "source_missing":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": ["body", "sourceId"],
                    "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                    "type": "value_error",
                }
            ],
        )
    if reason is not None:
        # unknown / cross-workspace / dataset-missing edge, or a disconnected /
        # cyclic join → structurally unpreviewable (it could never be saved either).
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )
    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
        step_plan = _step_plan(definition.get("steps") or [], plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise

    q = definition.get("q")
    # R120 — a stepped preview returns the SHAPED rows + the post-step columns as
    # `resolvedColumns` (the builder's headers for the transformed result).
    if step_plan is not None:
        rows = _run_steps(plan, q, filters, advanced, step_plan)
        resolved = [{"name": c["name"], "dtype": c["dtype"]} for c in step_plan[1]]
        # R129 — the PRE-step effective columns, so the builder's join/filter editors
        # author against the base while the steps editor + table use the result.
        base = [{"name": c["name"], "dtype": c["dtype"]} for c in plan["columns"]]
        content = {
            "rows": rows, "page": 1, "pageSize": len(rows), "total": len(rows),
            "resolvedColumns": resolved, "baseColumns": base,
        }
        return JSONResponse(status_code=status.HTTP_200_OK, content=content)

    if plan["kind"] == "join":
        rows, total = _execute_chain(
            plan["payload"], page=page, page_size=page_size, q=q, filters=filters, advanced=advanced
        )
        resolved = [_to_resolved(c).model_dump(exclude_none=True) for c in plan["payload"]["effective"]]
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total, "resolvedColumns": resolved}
    else:
        ds = plan["ds"]
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in plan["columns"]],
            page=page,
            page_size=page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total}

    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.put("/queries/{id}")
def update_query(id: QueryIdPath, body: UpdateQueryBody) -> JSONResponse:  # noqa: A002
    """R72 — UPDATE a saved query's DEFINITION (the construction surface's Save).
    The first mutate-existing path. Validate-on-save mirrors create: the new
    definition is checked against current columns / the edge (a join edge must
    still exist, be in-workspace, and have valid keys), and a definition that
    can't run is rejected 422. The Query's name + source are unchanged this
    round. Returns the updated Query (resolvedColumns recomputed when joined)."""
    definition = body.definition.model_dump()
    chain = _chain_of(definition)
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        # The driving source is unchanged by a definition-only PUT (R72); R76/R79 — a
        # composed query keeps its `qr_` base, a dataset-rooted one its `ds_`.
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])

    if reason == "composition_cycle":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorCompositionCycle().model_dump())
    if reason == "source_missing":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot save a definition that can't run) — the create-time semantics.
    build_definition_predicates(definition, plan["columns"])
    _step_plan(definition.get("steps") or [], plan["columns"])  # R120 — steps validate too

    definition_json = json.dumps(body.definition.model_dump())
    with get_conn() as con:
        con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (definition_json, id))
        con.commit()
        updated = _query_from_row(con, con.execute(_SELECT_QUERY, (id,)).fetchone())
    return JSONResponse(status_code=status.HTTP_200_OK, content=updated.model_dump(exclude_none=True))


@router.delete("/queries/{id}")
def delete_query(id: QueryIdPath) -> Response:  # noqa: A002
    """Delete a saved query. 404 if already absent."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM queries WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM queries WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
