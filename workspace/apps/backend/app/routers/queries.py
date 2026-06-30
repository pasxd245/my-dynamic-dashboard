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
from app.ingest.rows_reader import (
    build_effective_columns,
    build_joined_select,
    build_single_inner,
    query_aggregate_rows,
    query_dataset_rows,
    query_joined_rows,
    run_steps,
)
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
    ResolvedColumn,
    UpdateQueryBody,
)
from app.routers._shared import (
    RowsPage,
    _compatible,
    _dtype_of,
    _is_unique_violation,
    _now_iso,
)
from app.storage import dataset_dir


router = APIRouter(tags=["queries"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]

_PAGE_SIZE_ALLOWED = PAGE_SIZES  # R72 — centralized (values.yaml → constants)

_SELECT_DATASET = "SELECT * FROM datasets WHERE id = ?"
_SELECT_QUERY = "SELECT * FROM queries WHERE id = ?"


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
    # R93 — a leaf dataset's columns own themselves 1:1: each carries its
    # ownerSourceId (this `ds_`) + sourceColumn (its own bare name). build_effective_columns
    # rides this through (a `qr_` source passes its sub-query's provenance up instead).
    cols = [{**c, "ownerSourceId": ds["id"], "sourceColumn": c["name"]} for c in json.loads(ds["columns_json"])]
    return (
        {
            "relation": ("read_parquet(?)", [_parquet_of(ds)]),
            "columns": cols,
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


def _to_resolved(c: dict) -> ResolvedColumn:
    """R93 — map an effective-column dict (`name`/`dtype` + the leaf provenance
    `ownerSourceId`/`sourceColumn` that `build_effective_columns` rode through) to
    the wire model. A derived column (no single owner) carries neither — the
    optional fields stay `None` and are dropped via `exclude_none`."""
    return ResolvedColumn(
        name=c["name"],
        dtype=c["dtype"],
        ownerSourceId=c.get("ownerSourceId"),
        sourceColumn=c.get("sourceColumn"),
    )


def _resolved_columns(
    con: sqlite3.Connection, definition: dict, source_id: str, workspace_id: str
) -> list[ResolvedColumn] | None:
    """The effective columns for a multi-source query (joined or composed) and/or a
    query with transform steps; None for a plain single-source query, or when the
    graph/step no longer resolves (get/list never error — they just omit it). R93 —
    each carries its leaf provenance (a step's derived columns carry none). R120 —
    a query with `steps` exposes its POST-step output columns here."""
    chain = _chain_of(definition)
    steps = definition.get("steps") or []
    multi = _is_multi_source(source_id, chain)
    if not multi and not steps:
        return None
    if multi:
        payload, reason = _resolve_chain(con, source_id, chain, _rels_of(definition), workspace_id)
        if reason is not None:
            return None
        base = payload["effective"]
    else:
        ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
        if ds is None or ds["workspace_id"] != workspace_id:
            return None
        base = json.loads(ds["columns_json"])
    if steps:
        out = _step_output_columns(steps, base)
        if out is None:
            return None
        # A step's output columns are derived (no single leaf owner) → no provenance.
        return [ResolvedColumn(name=c["name"], dtype=c["dtype"]) for c in out]
    return [_to_resolved(c) for c in base]


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


def _resolve_plan(
    con: sqlite3.Connection,
    source_id: str,
    chain: list[dict],
    query_rels: dict[str, dict],
    workspace_id: str,
) -> tuple[dict | None, str | None]:
    """Resolve a definition's driving source to a PLAN — the shared front half of
    create / update / run / preview (R106 extraction; behavior-preserving). The
    four endpoints used to repeat this branch inline; the resolve mechanics are
    unified here, while each caller keeps its own reason→HTTP mapping (which
    genuinely differs: create/update reject a bad definition 422, run/preview map
    drift to 409-stale).

    Returns ``(plan, None)`` or ``(None, reason)``:

    - **multi-source** (composed ``qr_`` base or ≥1 join hop) → delegates to
      ``_resolve_chain``; ``plan = {"kind": "join", "payload": …, "columns":
      payload["effective"]}``; ``reason`` is the chain's failure reason
      (``composition_cycle`` / ``relationship_stale`` / ``unknown_relationship`` …).
    - **single dataset** → ``plan = {"kind": "single", "ds": <row>, "columns":
      <columns_meta>}``; an absent OR cross-workspace dataset → reason
      ``"source_missing"`` (callers map it to 404 or 422 per their contract).

    ``columns`` is the validation/effective column space either way, so callers
    read a single ``plan["columns"]``. The single-source workspace check is a
    no-op for the trusted run/update paths (a saved query's ``ds_`` source is
    invariantly in the query's own workspace — datasets don't move) and
    reproduces the inline membership check create/preview do on a user-supplied
    ``sourceId``."""
    if _is_multi_source(source_id, chain):
        payload, reason = _resolve_chain(con, source_id, chain, query_rels, workspace_id)
        if reason is not None:
            return None, reason
        return {"kind": "join", "payload": payload, "columns": payload["effective"]}, None
    ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
    if ds is None or ds["workspace_id"] != workspace_id:
        return None, "source_missing"
    return {"kind": "single", "ds": ds, "columns": json.loads(ds["columns_json"])}, None


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


_NUMERIC_DTYPES = {"integer", "float"}


def _agg_422(loc: list[str], msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[{"loc": loc, "msg": msg, "type": "value_error"}],
    )


def _validate_measure(m: dict, by_name: dict, loc: list) -> tuple[str | None, str]:
    """Validate one measure → its ``(col, agg)`` plan entry, or 422. ``count`` omits
    ``col``; ``sum`` needs a numeric ``col``."""
    agg, col_name = m.get("agg"), m.get("col")
    if agg != "sum":  # count
        if col_name is not None:
            raise _agg_422([*loc, "col"], "measure_col_forbidden: agg 'count' must omit col")
        return (None, "count")
    if col_name is None:
        raise _agg_422([*loc, "col"], "measure_col_required: agg 'sum' requires col")
    col = by_name.get(col_name)
    if col is None:
        raise _agg_422([*loc, "col"], f"unknown_column: {col_name!r} is not a column of this query")
    if col["dtype"] not in _NUMERIC_DTYPES:
        raise _agg_422([*loc, "col"], f"measure_not_numeric: {col_name!r} is {col['dtype']}, not numeric")
    return (col_name, "sum")


def _validate_aggregate(
    dimensions: list[str], measures: list[dict], columns: list[dict], loc: list
) -> list[tuple[str | None, str]]:
    """Re-check an aggregate spec (`dimensions` + `measures`) against the EFFECTIVE
    columns → 422 (with `loc`-rooted detail) on a bad reference. Returns the ordered
    ``(col, agg)`` measure plan. Shared by the R119 ``/aggregate`` endpoint and the
    R120 aggregate STEP. `measures` are dicts (`{col?, agg}`) so it serves both a
    request body (model-dumped) and a saved step definition."""
    by_name = {c["name"]: c for c in columns}
    for i, d in enumerate(dimensions):
        if d not in by_name:
            raise _agg_422([*loc, "dimensions", i], f"unknown_column: {d!r} is not a column of this query")
    return [_validate_measure(m, by_name, [*loc, "measures", i]) for i, m in enumerate(measures)]


def _aggregate_output_columns(
    dimensions: list[str], measures_plan: list[tuple[str | None, str]], columns: list[dict]
) -> list[dict]:
    """The output columns of an aggregate (dimensions then measures): a dimension
    keeps its source dtype; a ``sum`` keeps the measure's numeric dtype; a ``count``
    is ``integer`` named ``count``."""
    by_name = {c["name"]: c for c in columns}
    out = [{"name": d, "dtype": by_name[d]["dtype"]} for d in dimensions]
    for col, agg in measures_plan:
        out.append({"name": "count", "dtype": "integer"} if agg == "count" else {"name": col, "dtype": by_name[col]["dtype"]})
    return out


def _build_inner_relation(plan: dict, q: str | None, filters: list, advanced: list) -> tuple[str, list]:
    """The typed inner relation (filters applied, no pagination) for a resolved
    plan — a joined CTE or a single-source ``read_parquet`` — shared by the
    ``/aggregate`` endpoint and the aggregate-step run path."""
    if plan["kind"] == "join":
        payload = plan["payload"]
        return build_joined_select(
            payload["relations"],
            join_keys=payload["join_keys"],
            select_exprs=payload["select_exprs"],
            effective_columns=[c["name"] for c in payload["effective"]],
            q=q,
            filters=filters,
            advanced=advanced,
        )
    return build_single_inner(
        _parquet_of(plan["ds"]), [c["name"] for c in plan["columns"]], q=q, filters=filters, advanced=advanced
    )


_MAX_STEPS = 8


def _plan_one_step(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """Validate one step against the CURRENT column space; return its normalized
    descriptor (for the typed `run_steps` engine) + the column space AFTER it.
    ``aggregate`` reshapes; ``top_n`` preserves columns (orders + caps)."""
    kind = step.get("kind")
    if kind == "aggregate":
        dims = step.get("dimensions", [])
        measures_plan = _validate_aggregate(dims, step.get("measures", []), cur_cols, loc)
        out_cols = _aggregate_output_columns(dims, measures_plan, cur_cols)
        return {"kind": "aggregate", "dimensions": dims, "measures_plan": measures_plan,
                "output_cols": [c["name"] for c in out_cols]}, out_cols
    if kind == "top_n":
        col = step.get("col")
        if col not in {c["name"] for c in cur_cols}:
            raise _agg_422([*loc, "col"], f"unknown_column: {col!r} is not a column at this step")
        return {"kind": "top_n", "col": col, "descending": bool(step.get("descending")), "n": step.get("n")}, cur_cols
    raise _agg_422([*loc, "kind"], f"unknown_step_kind: {kind!r}")


def _step_plan(steps: list[dict], columns: list[dict]) -> tuple[list[dict], list[dict]] | None:
    """Validate a query's ordered transform `steps` by FOLDING over the evolving
    column space; return ``(normalized_steps, final_output_columns)`` — or ``None``
    when there are no steps. Raises 422 on a bad step (callers map it: create/update
    → 422, run/preview → 409 query_stale, read → None). Capped at ``_MAX_STEPS``."""
    if not steps:
        return None
    if len(steps) > _MAX_STEPS:
        raise _agg_422(["body", "definition", "steps"], f"too_many_steps: at most {_MAX_STEPS}")
    normalized: list[dict] = []
    cur_cols = columns
    for i, step in enumerate(steps):
        norm, cur_cols = _plan_one_step(step, cur_cols, ["body", "definition", "steps", i])
        normalized.append(norm)
    return normalized, cur_cols


def _step_output_columns(steps: list[dict], columns: list[dict]) -> list[dict] | None:
    """Read-path helper: the POST-step output columns, or ``None`` if there are no
    steps OR a step no longer validates (a drifted saved query — get/list never
    error, they just omit `resolvedColumns`)."""
    try:
        plan = _step_plan(steps, columns)
    except HTTPException:
        return None
    return plan[1] if plan else None


def _run_steps(
    plan: dict, q: str | None, filters: list, advanced: list, step_plan: tuple[list[dict], list[dict]]
) -> list[list[str | None]]:
    """Execute a query's chained transform steps over its resolved + filtered
    relation → the shaped rows (typed intermediates, final stringify)."""
    normalized, _final_cols = step_plan
    inner_sql, inner_params = _build_inner_relation(plan, q, filters, advanced)
    return run_steps(inner_sql, inner_params, [c["name"] for c in plan["columns"]], normalized)


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
        content = {"rows": rows, "page": 1, "pageSize": len(rows), "total": len(rows), "resolvedColumns": resolved}
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
