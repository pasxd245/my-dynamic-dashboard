"""Query execution engine — R133 extraction (behavior-preserving).

The resolution + transform-step engine, lifted OUT of ``routers/queries.py`` so
BOTH the queries router AND the workflows router (R134) share it, instead of a
router→router BIZ import ([[backend-router-layer-debt]]). The functions are
verbatim from `queries.py` (R69–R129); the queries router now imports them.

No HTTP routing lives here — helpers raise ``HTTPException`` exactly where they
always did (callers still map reasons to their own status), and the routers own
the endpoints. This module is the shared "how to resolve a saved query's driving
source + joins + filters into a relation, and how to validate/apply its transform
steps" — the reusable core the Workflow noun stands on.
"""

from __future__ import annotations

import json
import sqlite3

from fastapi import HTTPException, status

from app.ingest.filters import build_definition_predicates
from app.ingest.rows_reader import (
    build_effective_columns,
    build_joined_select,
    build_single_inner,
    query_joined_rows,
    run_steps,
)
from app.models.common import ResolvedColumn
from app.routers._shared import _compatible, _dtype_of
from app.storage import dataset_dir, workflow_dir


_SELECT_DATASET = "SELECT * FROM datasets WHERE id = ?"
_SELECT_QUERY = "SELECT * FROM queries WHERE id = ?"
_SELECT_WORKFLOW = "SELECT * FROM workflows WHERE id = ?"


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

    if source_id.startswith("wf_"):
        return _resolve_workflow_leaf(con, source_id, workspace_id)

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


def _resolve_workflow_leaf(
    con: sqlite3.Connection, source_id: str, workspace_id: str
) -> tuple[dict | None, str | None]:
    """R135 — a WORKFLOW output used as a source is a LEAF, not a recursive
    composition: it reads the workflow's already-MATERIALIZED parquet (frozen at its
    last run), exactly like a dataset leaf. Because it never resolves the workflow's
    own definition, no cycle is possible (a stale self-reference just reads the prior
    frozen output). An un-run workflow has no output → a missing composition base."""
    wrow = con.execute(_SELECT_WORKFLOW, (source_id,)).fetchone()
    if wrow is None or wrow["workspace_id"] != workspace_id or wrow["output_columns_json"] is None:
        return None, "composition_base_missing"
    out_cols = json.loads(wrow["output_columns_json"])
    cols = [{**c, "ownerSourceId": source_id, "sourceColumn": c["name"]} for c in out_cols]
    parquet = str(workflow_dir(wrow["workspace_id"], wrow["id"]) / "output.parquet")
    return (
        {
            "relation": ("read_parquet(?)", [parquet]),
            "columns": cols,
            "dataset_ids": {source_id},
            "name": wrow["name"],
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
    """True when the run needs the join engine: a composed (`qr_`) driving source, a
    workflow-output (`wf_`) leaf (R135), OR at least one join hop. A bare dataset
    with no hops is single-source (the plain ``read_parquet`` path)."""
    return source_id.startswith(("qr_", "wf_")) or bool(chain)


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


# ─── Transform steps (R119–R123) — validation + execution ────────────

_NUMERIC_DTYPES = {"integer", "float"}


def _agg_422(loc: list[str], msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[{"loc": loc, "msg": msg, "type": "value_error"}],
    )


# R140 — per-agg column dtype rules: `sum`/`avg` need numeric; `min`/`max` need
# an ORDERABLE dtype (numeric or date/datetime); `count_distinct` takes any.
_NUMERIC_AGGS = {"sum", "avg"}
_ORDERABLE_DTYPES = _NUMERIC_DTYPES | {"date", "datetime"}


def _validate_measure(m: dict, by_name: dict, loc: list) -> tuple[str | None, str]:
    """Validate one measure → its ``(col, agg)`` plan entry, or 422. ``count`` omits
    ``col``; every other agg requires one (R140 dtype rules per ``agg``)."""
    agg, col_name = m.get("agg"), m.get("col")
    if agg == "count":
        if col_name is not None:
            raise _agg_422([*loc, "col"], "measure_col_forbidden: agg 'count' must omit col")
        return (None, "count")
    if col_name is None:
        raise _agg_422([*loc, "col"], f"measure_col_required: agg {agg!r} requires col")
    col = by_name.get(col_name)
    if col is None:
        raise _agg_422([*loc, "col"], f"unknown_column: {col_name!r} is not a column of this query")
    if agg in _NUMERIC_AGGS and col["dtype"] not in _NUMERIC_DTYPES:
        raise _agg_422([*loc, "col"], f"measure_not_numeric: {col_name!r} is {col['dtype']}, not numeric")
    if agg in ("min", "max") and col["dtype"] not in _ORDERABLE_DTYPES:
        raise _agg_422(
            [*loc, "col"],
            f"measure_not_orderable: {col_name!r} is {col['dtype']}, not numeric/date/datetime",
        )
    return (col_name, agg)


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
    keeps its source dtype. R140 measure dtypes — ``sum``/``min``/``max`` keep the
    col's dtype; ``avg`` is ``float``; ``count``/``count_distinct`` are ``integer``.
    ``count`` is named ``count``; every other measure keeps its col's name."""
    by_name = {c["name"]: c for c in columns}
    out = [{"name": d, "dtype": by_name[d]["dtype"]} for d in dimensions]
    for col, agg in measures_plan:
        if agg == "count":
            out.append({"name": "count", "dtype": "integer"})
        elif agg == "count_distinct":
            out.append({"name": col, "dtype": "integer"})
        elif agg == "avg":
            out.append({"name": col, "dtype": "float"})
        else:  # sum / min / max — keep the col's dtype
            out.append({"name": col, "dtype": by_name[col]["dtype"]})
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


def _require_numeric(col: str | None, by_name: dict, loc: list) -> None:
    """The column must exist at this step AND be numeric (a derive operand) → 422."""
    c = by_name.get(col)
    if c is None:
        raise _agg_422(loc, f"unknown_column: {col!r} is not a column at this step")
    if c["dtype"] not in _NUMERIC_DTYPES:
        raise _agg_422(loc, f"derive_operand_not_numeric: {col!r} is {c['dtype']}, not numeric")


def _plan_derive(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R122 — validate a derive step (numeric operands, no name collision) → its
    normalized descriptor + column space (base ++ the new `float` column)."""
    by_name = {c["name"]: c for c in cur_cols}
    name = step.get("name")
    if name in by_name:
        raise _agg_422([*loc, "name"], f"column_exists: {name!r} is already a column")
    _require_numeric(step.get("left"), by_name, [*loc, "left"])
    right = step.get("right", {})
    norm = {"kind": "derive", "name": name, "left": step.get("left"), "op": step.get("op"), "right_kind": right.get("kind")}
    if right.get("kind") == "col":
        _require_numeric(right.get("col"), by_name, [*loc, "right", "col"])
        norm["right_col"] = right.get("col")
    else:
        norm["right_value"] = right.get("value")
    return norm, [*cur_cols, {"name": name, "dtype": "float"}]


def _plan_filter(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R123 — validate a filter step's predicates against the CURRENT columns. Maps
    each predicate's col NAME → its index, then reuses ``build_definition_predicates``
    (the source-filter validator: op-for-dtype + operand parse → 422). Returns the
    normalized descriptor (carrying the built ``FilterPredicate``s) + unchanged cols."""
    name_to_idx = {c["name"]: i for i, c in enumerate(cur_cols)}
    atoms: list[dict] = []
    for j, pred in enumerate(step.get("predicates", [])):
        idx = name_to_idx.get(pred.get("col"))
        if idx is None:
            raise _agg_422([*loc, "predicates", j, "col"], f"unknown_column: {pred.get('col')!r} is not a column at this step")
        atoms.append({"col": idx, "op": pred.get("op"), "val": pred.get("val"), "min": pred.get("min"), "max": pred.get("max")})
    predicates_fp, _ = build_definition_predicates({"filters": atoms, "advanced": []}, cur_cols)
    return {"kind": "filter", "predicates_fp": predicates_fp}, cur_cols


# R144 — the date_bucket granularity vocabulary (each is a DuckDB date_trunc
# unit). Guarded here because the granularity is INLINED into the step SQL —
# a saved definition's value must re-validate on every plan, never be trusted.
_BUCKET_GRANULARITIES = frozenset({"day", "week", "month", "quarter", "year"})


def _plan_date_bucket(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R144 — validate a date_bucket step (date/datetime col, known granularity,
    no name collision) → its normalized descriptor + column space (base ++ the
    new `date` column). The output value is the period's START date (week =
    ISO-8601 Monday-start, DuckDB's native date_trunc)."""
    by_name = {c["name"]: c for c in cur_cols}
    name = step.get("name")
    if name in by_name:
        raise _agg_422([*loc, "name"], f"column_exists: {name!r} is already a column")
    col = by_name.get(step.get("col"))
    if col is None:
        raise _agg_422([*loc, "col"], f"unknown_column: {step.get('col')!r} is not a column at this step")
    if col["dtype"] not in ("date", "datetime"):
        raise _agg_422(
            [*loc, "col"],
            f"bucket_col_not_date: {step.get('col')!r} is {col['dtype']}, not date/datetime",
        )
    granularity = step.get("granularity")
    if granularity not in _BUCKET_GRANULARITIES:
        raise _agg_422([*loc, "granularity"], f"unknown_granularity: {granularity!r}")
    norm = {"kind": "date_bucket", "col": step.get("col"), "granularity": granularity, "name": name}
    return norm, [*cur_cols, {"name": name, "dtype": "date"}]


def _plan_sort(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R141 — validate a sort step's keys against the CURRENT columns (any dtype
    orders). Returns the normalized descriptor + unchanged cols."""
    names = {c["name"] for c in cur_cols}
    keys: list[dict] = []
    for j, key in enumerate(step.get("keys", [])):
        col = key.get("col")
        if col not in names:
            raise _agg_422([*loc, "keys", j, "col"], f"unknown_column: {col!r} is not a column at this step")
        keys.append({"col": col, "descending": bool(key.get("descending"))})
    return {"kind": "sort", "keys": keys}, cur_cols


def _plan_select(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R141 — validate a select step (every ``col`` exists; output names
    ``name ?? col`` unique) → its normalized descriptor + the projected/renamed
    column space (dtypes kept, NEW names — a rename is a re-binding)."""
    by_name = {c["name"]: c for c in cur_cols}
    cols: list[dict] = []
    out_cols: list[dict] = []
    seen: set[str] = set()
    for j, entry in enumerate(step.get("cols", [])):
        col = entry.get("col")
        src = by_name.get(col)
        if src is None:
            raise _agg_422([*loc, "cols", j, "col"], f"unknown_column: {col!r} is not a column at this step")
        out_name = entry.get("name") or col
        if out_name in seen:
            raise _agg_422([*loc, "cols", j, "name"], f"duplicate_output_column: {out_name!r} appears twice")
        seen.add(out_name)
        cols.append({"col": col, "name": out_name})
        out_cols.append({"name": out_name, "dtype": src["dtype"]})
    return {"kind": "select", "cols": cols, "output_cols": [c["name"] for c in out_cols]}, out_cols


def _plan_one_step(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """Validate one step against the CURRENT column space; return its normalized
    descriptor (for the typed `run_steps` engine) + the column space AFTER it.
    ``aggregate`` reshapes; ``top_n``/``sort`` preserve; ``derive``/``date_bucket``
    append; ``filter`` narrows; ``select`` re-binds (projection + rename + reorder)."""
    kind = step.get("kind")
    if kind == "filter":
        return _plan_filter(step, cur_cols, loc)
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
    if kind == "derive":
        return _plan_derive(step, cur_cols, loc)
    if kind == "sort":
        return _plan_sort(step, cur_cols, loc)
    if kind == "select":
        return _plan_select(step, cur_cols, loc)
    if kind == "date_bucket":
        return _plan_date_bucket(step, cur_cols, loc)
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
    plan: dict,
    q: str | None,
    filters: list,
    advanced: list,
    step_plan: tuple[list[dict], list[dict]],
    *,
    page: int = 1,
    page_size: int | None = None,
) -> tuple[list[list[str | None]], int]:
    """Execute a query's chained transform steps over its resolved + filtered
    relation → ``(shaped rows, total)`` (typed intermediates, final stringify).
    R144 — pages the shaped relation (see ``run_steps``)."""
    normalized, _final_cols = step_plan
    inner_sql, inner_params = _build_inner_relation(plan, q, filters, advanced)
    return run_steps(
        inner_sql, inner_params, [c["name"] for c in plan["columns"]], normalized, page=page, page_size=page_size
    )


def build_consolidated_relation(
    con: sqlite3.Connection, sources: list[str], workspace_id: str
) -> tuple[dict | None, str | None]:
    """R135 — CONSOLIDATE ≥1 source (saved query ``qr_`` or workflow-output ``wf_``)
    into ONE typed relation by stacking them with ``UNION ALL BY NAME`` — the
    same-schema consolidation the ``queries ⇒ workflows`` module exists for (many
    period/provider exports → one table). ``BY NAME`` aligns columns by name, so a
    column-order difference between sources is tolerated; a genuinely divergent
    schema is best-effort (missing columns read NULL) — v1 assumes same-shape
    sources. Each source's OWN filters are already baked into its resolved
    sub-relation, so no extra predicate is applied here.

    Returns ``({"sql", "params", "columns"}, None)`` — ``columns`` is the FIRST
    source's column space (the declared consolidation schema, used for step
    validation + output capture) — or ``(None, reason)`` from the first source that
    fails to resolve (callers map the reason to their status)."""
    parts: list[str] = []
    params: list = []
    columns: list[dict] | None = None
    for src in sources:
        plan, reason = _resolve_plan(con, src, [], {}, workspace_id)
        if reason is not None:
            return None, reason
        sql, p = _build_inner_relation(plan, None, [], [])
        parts.append(f"SELECT * FROM ({sql})")
        params.extend(p)
        if columns is None:
            columns = plan["columns"]
    return {"sql": " UNION ALL BY NAME ".join(parts), "params": params, "columns": columns}, None
