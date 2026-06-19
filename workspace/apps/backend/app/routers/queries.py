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
from app.ingest.rows_reader import (
    build_effective_columns,
    build_joined_select,
    query_dataset_rows,
    query_joined_rows,
)
from app.models.common import (
    ApiErrorCompositionCycle,
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

_SELECT_DATASET = "SELECT * FROM datasets WHERE id = ?"
_SELECT_QUERY = "SELECT * FROM queries WHERE id = ?"


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


def _rels_of(definition: dict) -> dict[str, dict]:
    """Index a definition's QUERY-OWNED relationships by id (R88). Each `JoinStep`
    resolves its edge through this map by `queryRelId` — the query runs on its own
    embedded snapshot, never a live workspace-store `rel_` lookup."""
    return {r["id"]: r for r in definition.get("relationships") or []}


def _parquet_of(row: sqlite3.Row) -> str:
    """The committed parquet path for a dataset row."""
    return str(dataset_dir(row["workspace_id"], row["id"]) / "parsed.parquet")


def resolve_source(
    con: sqlite3.Connection, source_id: str, workspace_id: str, visited: frozenset[str]
) -> tuple[dict | None, str | None]:
    """Resolve a DRIVING table-source to a SQL relation (R76 — the unified
    ``ds_``/``qr_`` resolver, J-2′). Returns ``(info, None)`` or ``(None, reason)``,
    where ``info`` is ``{relation: (sql, params), columns, dataset_ids, name}``:

    - a Dataset (``ds_…``) → ``read_parquet(?)`` over its parquet, raw columns.
    - a saved Query (``qr_…``) → its full typed SELECT (its own driving source +
      joins + its OWN filters) wrapped ``( … )`` as a sub-relation, exposing its
      EFFECTIVE columns. RECURSES (its base may itself be composed); a ``qr_``
      already on the recursion path is a **composition cycle** (``visited``)."""
    if source_id.startswith("qr_"):
        if source_id in visited:
            return None, "composition_cycle"
        qrow = con.execute(_SELECT_QUERY, (source_id,)).fetchone()
        if qrow is None or qrow["workspace_id"] != workspace_id:
            return None, "composition_base_missing"
        base_def = json.loads(qrow["definition_json"])
        base_src = qrow["source_id"]
        payload, reason = _resolve_chain(
            con, base_src, _chain_of(base_def), _rels_of(base_def), workspace_id, visited | {source_id}
        )
        if reason is not None:
            return None, reason
        # The base's OWN filters define its virtual table (baked into the sub-relation).
        try:
            b_filters, b_advanced = build_definition_predicates(base_def, payload["effective"])
        except HTTPException:
            return None, "relationship_stale"
        sql, params = build_joined_select(
            payload["relations"],
            join_keys=payload["join_keys"],
            select_exprs=payload["select_exprs"],
            effective_columns=[c["name"] for c in payload["effective"]],
            q=base_def.get("q"),
            filters=b_filters,
            advanced=b_advanced,
        )
        return (
            {
                "relation": (f"({sql})", params),
                "columns": payload["effective"],
                "dataset_ids": payload["dataset_ids"],
                "name": qrow["name"],
            },
            None,
        )

    ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
    if ds is None or ds["workspace_id"] != workspace_id:
        return None, "relationship_dataset_missing"
    return (
        {
            "relation": ("read_parquet(?)", [_parquet_of(ds)]),
            "columns": json.loads(ds["columns_json"]),
            "dataset_ids": {ds["id"]},
            "name": ds["name"],
        },
        None,
    )


def _resolve_chain(
    con: sqlite3.Connection,
    source_id: str,
    chain: list[dict],
    query_rels: dict[str, dict],
    workspace_id: str,
    visited: frozenset[str] = frozenset(),
) -> tuple[dict | None, str | None]:
    """Resolve a join GRAPH (driving source + hops) against current schemas.
    Returns ``(payload, None)`` when runnable, else ``(None, reason)`` — callers map
    the reason to their status (create/update → 422 / 409 composition_cycle; run →
    409 relationship_stale / composition_cycle). R71's single join is length-1.

    The DRIVING source (``T0``) is polymorphic (R76): a Dataset, or a composed Query
    sub-relation (via ``resolve_source``, which recurses + cycle-guards). R88 — each
    hop joins DATASETS via the query's OWN relationship (``query_rels`` keyed by
    ``queryRelId``), not a live workspace ``rel_`` lookup, so editing/deleting a
    governed rel can't break a saved query (it runs on its embedded snapshot). The
    TREE invariant (R74) generalizes: a hop's left dataset must be a member of some
    source already in the graph — including a dataset INSIDE a composed base
    (provenance) — else ``disconnected_join``; its right must be new, else
    ``cyclic_join``. The join key must still exist with compatible dtypes on both
    sides, re-checked against CURRENT dataset columns (R70's check); a drift, or a
    base that doesn't expose the left key under its effective name, →
    ``relationship_stale``."""
    t0, reason = resolve_source(con, source_id, workspace_id, visited)
    if reason is not None:
        return None, reason
    # Per source: its (qualified) columns + the leaf dataset ids it reads. A hop's
    # left dataset is matched against these sets (provenance), so a composed base's
    # inner datasets are joinable targets.
    source_cols: list[tuple[str, list[dict]]] = [(t0["name"], t0["columns"])]
    dataset_id_sets: list[set[str]] = [set(t0["dataset_ids"])]
    relations = [t0["relation"]]
    join_keys: list[tuple[int, str, str, str]] = []
    for hop in chain:
        # R88 — the edge is the query's OWN relationship (copy-on-pick / free-form),
        # read from the definition's `relationships[]` by `queryRelId`, NOT a live
        # workspace-store lookup. An unknown id (a hop with no matching query-owned
        # rel) is a malformed definition → `unknown_relationship`.
        qrel = query_rels.get(hop["queryRelId"])
        if qrel is None:
            return None, "unknown_relationship"
        left_idx = next((i for i, ids in enumerate(dataset_id_sets) if qrel["leftSourceId"] in ids), None)
        if left_idx is None:
            return None, "disconnected_join"
        # R91 — the RIGHT side is polymorphic: a dataset (`ds_`) OR a saved Query
        # (`qr_…`, a query×query join), resolved through the SAME unified
        # ``resolve_source`` the driving base uses — a ``read_parquet`` leaf for a
        # dataset, or the joined-in query baked as a ``( … )`` sub-relation exposing its
        # EFFECTIVE (collision-qualified) columns. ``visited`` threads through, so a
        # query that joins itself in (directly or transitively) → ``composition_cycle``.
        right, reason = resolve_source(con, qrel["rightSourceId"], workspace_id, visited)
        if reason is not None:
            return None, reason
        right_ids = set(right["dataset_ids"])
        # The right must be NEW — the tree invariant. A `qr_` right brings a SET of
        # leaf datasets, so any overlap with the graph (the same dataset appearing
        # twice → ambiguous columns) → `cyclic_join`. For a `ds_` right this is the
        # original "right dataset already present" check.
        if any(right_ids & ids for ids in dataset_id_sets):
            return None, "cyclic_join"
        left_cols = source_cols[left_idx][1]
        right_cols = right["columns"]
        # The join key must exist on both sides with compatible dtypes, re-checked
        # against CURRENT columns. For a composed base / `qr_` right, the columns are
        # EFFECTIVE names: a missing/qualified key (provenance ambiguity) → `_dtype_of`
        # None → relationship_stale, not a silently-wrong join. A query-owned key column
        # that drifted away → the same stale.
        if not _compatible(_dtype_of(left_cols, qrel["leftColumn"]), _dtype_of(right_cols, qrel["rightColumn"])):
            return None, "relationship_stale"
        relations.append(right["relation"])
        source_cols.append((right["name"], right_cols))
        dataset_id_sets.append(right_ids)
        join_keys.append((left_idx, qrel["leftColumn"], qrel["rightColumn"], hop.get("type", "inner")))

    effective, select_exprs = build_effective_columns(source_cols)
    return (
        {
            "relations": relations,
            "join_keys": join_keys,
            "effective": effective,
            "select_exprs": select_exprs,
            "dataset_ids": set().union(*dataset_id_sets),
        },
        None,
    )


def _is_multi_source(source_id: str, chain: list[dict]) -> bool:
    """True when the run needs the join engine: a composed (`qr_`) driving source
    OR at least one join hop. A bare dataset with no hops is single-source."""
    return source_id.startswith("qr_") or bool(chain)


def _resolved_columns(
    con: sqlite3.Connection, definition: dict, source_id: str, workspace_id: str
) -> list[Column] | None:
    """The effective columns for a multi-source query (joined or composed); None
    for a single dataset source, or when the graph no longer resolves (get/list
    never error — they just omit it)."""
    chain = _chain_of(definition)
    if not _is_multi_source(source_id, chain):
        return None
    payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition), workspace_id)
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
    """Run a resolved graph plan through the unified engine (shared by the saved
    run + the stateless preview). Each source is a parquet leaf or a composed
    sub-relation (R76)."""
    return query_joined_rows(
        payload["relations"],
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
    with get_conn() as con:
        # R71/R73/R76 — a joined OR composed query's atoms index the EFFECTIVE space;
        # the driving source + every hop must resolve at save time (resolve_source
        # checks the base dataset/query exists + is in-workspace). A cycle (a query
        # built transitively on itself) is rejected as composition_cycle. A bare
        # single-dataset query validates against its one dataset's columns.
        if _is_multi_source(source_id, chain):
            payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition_dict), id)
            if reason == "composition_cycle":
                return JSONResponse(status_code=409, content=ApiErrorCompositionCycle().model_dump())
            if reason is not None:
                raise HTTPException(
                    status_code=422,
                    detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
                )
            validation_columns = payload["effective"]
        else:
            ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
            if ds is None or ds["workspace_id"] != id:
                raise HTTPException(
                    status_code=422,
                    detail=[
                        {
                            "loc": ["body", "sourceId"],
                            "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                            "type": "value_error",
                        }
                    ],
                )
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
                "(id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (qid, id, source_id, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_queries_name_unique" in str(err) or _is_unique_violation(err, "queries.name"):
            return JSONResponse(status_code=409, content=ApiErrorNameTaken().model_dump())
        raise

    created = QueryModel(
        id=qid,
        workspaceId=id,
        sourceId=source_id,
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
        source_id = qrow["source_id"]

        if _is_multi_source(source_id, chain):
            # R71/R73/R76 — joined OR composed run. The driving source + every hop
            # must still resolve with valid keys; a drift BLOCKS the run (409
            # relationship_stale), and a base that loops back → 409 composition_cycle
            # — never silently wrong, never an infinite recursion.
            payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition), qrow["workspace_id"])
            if reason == "composition_cycle":
                return JSONResponse(status_code=409, content=ApiErrorCompositionCycle().model_dump())
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
            ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
            if ds is None:
                # Defensive: the app-level cascade (R79) removes queries when their
                # source dataset is deleted, so this is a belt-and-braces 404.
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
    source_id = body.sourceId  # R79 — the canonical driving source (ds_ or qr_)
    with get_conn() as con:
        if _is_multi_source(source_id, chain):
            payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition), id)
            if reason == "composition_cycle":
                return JSONResponse(status_code=409, content=ApiErrorCompositionCycle().model_dump())
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
            ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
            if ds is None or ds["workspace_id"] != id:
                raise HTTPException(
                    status_code=422,
                    detail=[
                        {
                            "loc": ["body", "sourceId"],
                            "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                            "type": "value_error",
                        }
                    ],
                )
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
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        # The driving source is unchanged by a definition-only PUT (R72); R76/R79 — a
        # composed query keeps its `qr_` base, a dataset-rooted one its `ds_`.
        source_id = qrow["source_id"]
        if _is_multi_source(source_id, chain):
            payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition), qrow["workspace_id"])
            if reason == "composition_cycle":
                return JSONResponse(status_code=409, content=ApiErrorCompositionCycle().model_dump())
            if reason is not None:
                raise HTTPException(
                    status_code=422,
                    detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
                )
            validation_columns = payload["effective"]
        else:
            ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
            if ds is None:
                return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
            validation_columns = json.loads(ds["columns_json"])

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot save a definition that can't run) — the create-time semantics.
    build_definition_predicates(definition, validation_columns)

    definition_json = json.dumps(body.definition.model_dump())
    with get_conn() as con:
        con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (definition_json, id))
        con.commit()
        updated = _query_from_row(con, con.execute(_SELECT_QUERY, (id,)).fetchone())
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
