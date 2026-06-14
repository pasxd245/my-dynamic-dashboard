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
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS, PAGE_SIZES
from app.db import get_conn
from app.ingest.filters import build_definition_predicates
from app.ingest.rows_reader import build_effective_columns, query_dataset_rows, query_joined_rows
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorQueryStale,
    ApiErrorRelationshipStale,
    Column,
    CreateQueryBody,
    PreviewQueryBody,
    Query as QueryModel,
    QueryDefinition,
    UpdateQueryBody,
)
from app.routers.datasets import RowsPage
from app.routers.relationships import _compatible, _dtype_of
from app.routers.workspaces import _is_unique_violation
from app.storage import dataset_dir


router = APIRouter(tags=["queries"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]

_PAGE_SIZE_ALLOWED = PAGE_SIZES  # R72 — centralized (values.yaml → constants)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_qr_id() -> str:
    return f"qr_{secrets.token_hex(4)}"


def _chain_of(definition: dict) -> list[dict]:
    """The definition's ordered join chain. Folds a legacy single `join` (R71/R72
    persisted data) into a length-1 chain so callers read one shape (`joins`)."""
    joins = definition.get("joins")
    if joins:
        return list(joins)
    legacy = definition.get("join")
    return [legacy] if legacy else []


def _resolve_chain(
    con: sqlite3.Connection, chain: list[dict], source_ds_id: str, workspace_id: str
) -> tuple[dict | None, str | None]:
    """Resolve a join GRAPH against current schemas. Returns ``(payload, None)``
    when every hop is runnable, else ``(None, reason)``. The reason lets callers
    map to their own status — create/update → 422 (unsavable), run → 409
    relationship_stale (join unavailable). R71's single join is the length-1 case.

    Enforces the TREE invariant (R74, relaxing R73's linear path): each hop's left
    dataset must ALREADY be in the graph (connected) — else ``disconnected_join`` —
    and its right dataset must NOT yet be in the graph (acyclic — a spanning tree,
    no diamonds/self-joins) — else ``cyclic_join``. The hops are stored in
    topological order, so each hop's left precedes it; its index in ``sources``
    becomes the engine's ``left_idx``. The linear chain (each hop's left = the
    prior tail) is the degenerate path case. Reuses R70's dtype-compat check per
    hop, so a drifted join key surfaces exactly as the governance layer computes
    `stale`."""
    source_ds = con.execute("SELECT * FROM datasets WHERE id = ?", (source_ds_id,)).fetchone()
    if source_ds is None:
        return None, "relationship_dataset_missing"
    sources = [source_ds]
    # Map each in-graph dataset id → its position in `sources` (the engine alias
    # index T{idx}); a hop joins its new source against T{left_idx}.
    index_of = {source_ds_id: 0}
    join_keys: list[tuple[int, str, str, str]] = []
    for hop in chain:
        rel = con.execute("SELECT * FROM relationships WHERE id = ?", (hop["relationshipId"],)).fetchone()
        if rel is None:
            return None, "unknown_relationship"
        if rel["workspace_id"] != workspace_id:
            return None, "cross_workspace_relationship"
        # Tree invariant: the hop's left must already be in the graph (connected);
        # its right must be new (acyclic — a tree, not a diamond/self-join).
        left_idx = index_of.get(rel["left_dataset_id"])
        if left_idx is None:
            return None, "disconnected_join"
        if rel["right_dataset_id"] in index_of:
            return None, "cyclic_join"
        left_ds = sources[left_idx]
        right_ds = con.execute("SELECT * FROM datasets WHERE id = ?", (rel["right_dataset_id"],)).fetchone()
        if right_ds is None:
            return None, "relationship_dataset_missing"
        left_cols = json.loads(left_ds["columns_json"])
        right_cols = json.loads(right_ds["columns_json"])
        # The join key must still exist on both sides with compatible dtypes (the
        # rule R70 governs the edge by). A drift here = the graph can't run.
        if not _compatible(_dtype_of(left_cols, rel["left_column"]), _dtype_of(right_cols, rel["right_column"])):
            return None, "relationship_stale"
        index_of[right_ds["id"]] = len(sources)
        sources.append(right_ds)
        join_keys.append((left_idx, rel["left_column"], rel["right_column"], hop.get("type", "inner")))

    effective, select_exprs = build_effective_columns(
        [(s["name"], json.loads(s["columns_json"])) for s in sources]
    )
    return (
        {
            "sources": sources,
            "join_keys": join_keys,
            "effective": effective,
            "select_exprs": select_exprs,
        },
        None,
    )


def _resolved_columns(
    con: sqlite3.Connection, definition: dict, source_ds_id: str, workspace_id: str
) -> list[Column] | None:
    """The effective columns for a joined query (None for single-source, or when
    the chain no longer resolves — get/list never error, they just omit it)."""
    chain = _chain_of(definition)
    if not chain:
        return None
    payload, reason = _resolve_chain(con, chain, source_ds_id, workspace_id)
    if reason is not None:
        return None
    return [Column(name=c["name"], dtype=c["dtype"]) for c in payload["effective"]]


def _execute_chain(
    payload: dict,
    *,
    page: int,
    page_size: int,
    q: str | None,
    filters: list,
    advanced: list,
) -> tuple[list[list[str | None]], int]:
    """Run a resolved chain plan through the N-source engine (shared by the saved
    run + the stateless preview)."""
    parquets = [dataset_dir(s["workspace_id"], s["id"]) / "parsed.parquet" for s in payload["sources"]]
    return query_joined_rows(
        parquets,
        join_keys=payload["join_keys"],
        select_exprs=payload["select_exprs"],
        effective_columns=[c["name"] for c in payload["effective"]],
        page=page,
        page_size=page_size,
        q=q,
        filters=filters,
        advanced=advanced,
    )


def _query_from_row(con: sqlite3.Connection, row: sqlite3.Row) -> QueryModel:
    definition = json.loads(row["definition_json"])
    return QueryModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        datasetId=row["dataset_id"],
        name=row["name"],
        definition=QueryDefinition(**definition),
        resolvedColumns=_resolved_columns(con, definition, row["dataset_id"], row["workspace_id"]),
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
    with get_conn() as con:
        ds = con.execute("SELECT * FROM datasets WHERE id = ?", (body.datasetId,)).fetchone()
        if ds is None or ds["workspace_id"] != id:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "loc": ["body", "datasetId"],
                        "msg": f"unknown_dataset: {body.datasetId} is not a dataset in workspace {id}",
                        "type": "value_error",
                    }
                ],
            )

        # R71/R73 — a joined query's atoms index the EFFECTIVE (chained) space;
        # every hop must resolve (exist, in-workspace, valid keys) and the chain
        # must be linear at save time. A single-source query validates against its
        # one dataset (unchanged).
        if chain:
            payload, reason = _resolve_chain(con, chain, body.datasetId, id)
            if reason is not None:
                raise HTTPException(
                    status_code=422,
                    detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
                )
            validation_columns = payload["effective"]
        else:
            validation_columns = json.loads(ds["columns_json"])

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot persist a query that can't run).
    build_definition_predicates(definition_dict, validation_columns)

    qid = _new_qr_id()
    created_at = _now_iso()
    definition_json = json.dumps(body.definition.model_dump())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO queries "
                "(id, workspace_id, dataset_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (qid, id, body.datasetId, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_queries_name_unique" in str(err) or _is_unique_violation(err, "queries.name"):
            return JSONResponse(status_code=409, content=ApiErrorNameTaken().model_dump())
        raise

    created = QueryModel(
        id=qid,
        workspaceId=id,
        datasetId=body.datasetId,
        name=body.name,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=201, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/queries")
def list_queries(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved queries, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM queries WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_query_from_row(con, r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=200, content=items)


@router.get("/queries/{id}")
def get_query(id: QueryIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved query (definition + metadata; resolvedColumns when joined)."""
    with get_conn() as con:
        row = con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        content = _query_from_row(con, row).model_dump(exclude_none=True)
    return JSONResponse(status_code=200, content=content)


@router.get("/queries/{id}/rows")
def run_query(  # noqa: A002
    id: QueryIdPath,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
) -> JSONResponse:
    """RUN the saved query: re-execute its definition against CURRENT data,
    paged. For a JOINED query (R71) the two related datasets are read as one;
    409 relationship_stale if the join key drifted (the join is blocked), 409
    query_stale if a predicate atom drifted."""
    if page_size not in _PAGE_SIZE_ALLOWED:
        raise HTTPException(
            status_code=422,
            detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
        )

    # Gather the run plan under the sqlite connection; execute the (duckdb) read
    # after it closes — the existing single-source discipline, extended for join.
    with get_conn() as con:
        qrow = con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)

        if chain:
            # R71/R73 — joined run. Every hop must still resolve with valid keys
            # and the chain stay linear; a drift here BLOCKS the join (409
            # relationship_stale), it is not silently wrong (the code R70 reserved
            # for exactly this consumer).
            payload, reason = _resolve_chain(con, chain, qrow["dataset_id"], qrow["workspace_id"])
            if reason is not None:
                return JSONResponse(status_code=409, content=ApiErrorRelationshipStale().model_dump())
            try:
                filters, advanced = build_definition_predicates(definition, payload["effective"])
            except HTTPException as exc:
                if exc.status_code == 422:
                    return JSONResponse(status_code=409, content=ApiErrorQueryStale().model_dump())
                raise
            plan: tuple = ("join", payload, filters, advanced)
        else:
            ds = con.execute("SELECT * FROM datasets WHERE id = ?", (qrow["dataset_id"],)).fetchone()
            if ds is None:
                # Defensive: the FK cascade should remove queries when their
                # dataset is deleted, so this is a belt-and-braces 404.
                return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
            columns_meta = json.loads(ds["columns_json"])
            try:
                filters, advanced = build_definition_predicates(definition, columns_meta)
            except HTTPException as exc:
                if exc.status_code == 422:
                    return JSONResponse(status_code=409, content=ApiErrorQueryStale().model_dump())
                raise
            plan = ("single", ds, columns_meta, filters, advanced)

    q = definition.get("q")
    if plan[0] == "join":
        _, payload, filters, advanced = plan
        rows, total = _execute_chain(
            payload, page=page, page_size=page_size, q=q, filters=filters, advanced=advanced
        )
    else:
        _, ds, columns_meta, filters, advanced = plan
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in columns_meta],
            page=page,
            page_size=page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )

    body = RowsPage(rows=rows, page=page, pageSize=page_size, total=total)
    return JSONResponse(status_code=200, content=body.model_dump())


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
            status_code=422,
            detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
        )

    definition = body.definition.model_dump()
    chain = _chain_of(definition)
    with get_conn() as con:
        ds = con.execute("SELECT * FROM datasets WHERE id = ?", (body.datasetId,)).fetchone()
        if ds is None or ds["workspace_id"] != id:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "loc": ["body", "datasetId"],
                        "msg": f"unknown_dataset: {body.datasetId} is not a dataset in workspace {id}",
                        "type": "value_error",
                    }
                ],
            )

        if chain:
            payload, reason = _resolve_chain(con, chain, body.datasetId, id)
            if reason == "relationship_stale":
                return JSONResponse(status_code=409, content=ApiErrorRelationshipStale().model_dump())
            if reason is not None:
                # unknown / cross-workspace / dataset-missing edge, or a
                # disconnected / cyclic join → structurally unpreviewable (it could
                # never be saved either).
                raise HTTPException(
                    status_code=422,
                    detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
                )
            try:
                filters, advanced = build_definition_predicates(definition, payload["effective"])
            except HTTPException as exc:
                if exc.status_code == 422:
                    return JSONResponse(status_code=409, content=ApiErrorQueryStale().model_dump())
                raise
            plan: tuple = ("join", payload, filters, advanced)
        else:
            columns_meta = json.loads(ds["columns_json"])
            try:
                filters, advanced = build_definition_predicates(definition, columns_meta)
            except HTTPException as exc:
                if exc.status_code == 422:
                    return JSONResponse(status_code=409, content=ApiErrorQueryStale().model_dump())
                raise
            plan = ("single", ds, columns_meta, filters, advanced)

    q = definition.get("q")
    if plan[0] == "join":
        _, payload, filters, advanced = plan
        rows, total = _execute_chain(
            payload, page=page, page_size=page_size, q=q, filters=filters, advanced=advanced
        )
        resolved = [Column(name=c["name"], dtype=c["dtype"]).model_dump() for c in payload["effective"]]
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total, "resolvedColumns": resolved}
    else:
        _, ds, columns_meta, filters, advanced = plan
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in columns_meta],
            page=page,
            page_size=page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total}

    return JSONResponse(status_code=200, content=content)


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
        qrow = con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        ds = con.execute("SELECT * FROM datasets WHERE id = ?", (qrow["dataset_id"],)).fetchone()
        if ds is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        if chain:
            payload, reason = _resolve_chain(con, chain, qrow["dataset_id"], qrow["workspace_id"])
            if reason is not None:
                raise HTTPException(
                    status_code=422,
                    detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
                )
            validation_columns = payload["effective"]
        else:
            validation_columns = json.loads(ds["columns_json"])

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot save a definition that can't run) — the create-time semantics.
    build_definition_predicates(definition, validation_columns)

    definition_json = json.dumps(body.definition.model_dump())
    with get_conn() as con:
        con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (definition_json, id))
        con.commit()
        updated = _query_from_row(con, con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone())
    return JSONResponse(status_code=200, content=updated.model_dump(exclude_none=True))


@router.delete("/queries/{id}")
def delete_query(id: QueryIdPath) -> Response:  # noqa: A002
    """Delete a saved query. 404 if already absent."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM queries WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM queries WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=204)
