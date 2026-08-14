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
    build_steps_relation,
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


def _resolve_dataset_leaf(
    con: sqlite3.Connection, source_id: str, workspace_id: str
) -> tuple[dict | None, str | None]:
    """Resolve a DATASET (``ds_…``) to a ``read_parquet`` leaf — the only kind of
    source a QUERY reads since R167.

    Split out of ``resolve_source`` so the join path can call it DIRECTLY: a hop's
    right is a ``DsId`` now, so resolving one must not route through the polymorphic
    resolver and its composition machinery. That leaves ``resolve_source`` reachable
    from exactly ONE call site (a DRIVING source), which is the narrowing finding A
    asked for — Workflow's boundary is now visible in the call graph instead of
    tangled with a capability the product no longer has."""
    ds = con.execute(_SELECT_DATASET, (source_id,)).fetchone()
    if ds is None or ds["workspace_id"] != workspace_id:
        return None, "relationship_dataset_missing"
    # R93 — a leaf dataset's columns own themselves 1:1: each carries its
    # ownerSourceId (this `ds_`) + sourceColumn (its own bare name). build_effective_columns
    # rides this through.
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


def resolve_source(
    con: sqlite3.Connection, source_id: str, workspace_id: str, visited: frozenset[str]
) -> tuple[dict | None, str | None]:
    """Resolve a DRIVING table-source to a SQL relation. Returns ``(info, None)`` or
    ``(None, reason)``, where ``info`` is
    ``{relation: (sql, params), columns, dataset_ids, name}``:

    - a Dataset (``ds_…``) → a ``read_parquet`` leaf. The QUERY path.
    - a saved Query (``qr_…``) → **what that query RETURNS** — its own source +
      joins + filters + **its own steps** — wrapped ``( … )`` as a sub-relation.
      **R167 — this is WORKFLOW'S READER, and nothing else's.**
    - a workflow output (``wf_…``) → a frozen parquet leaf (R135).

    **Why the ``qr_`` branch survives a round that retires composition** (finding A):
    a Workflow's sources are ``qr_``/``wf_`` and NEVER ``ds_``, and it consolidates
    them through this same resolver. Deleting the branch would break Workflow
    outright. What changed is who can reach it: a Query's ``sourceId`` and every join
    operand are ``ds_`` since R167, so the only way in is a Workflow supplying the
    driving source.

    The ``visited`` cycle guard is retained as a **structural invariant**, not as a
    reachable path: R168 ruled a workflow source FROZEN for good, so with `ds_`-only
    query sources no resolution can revisit an id. It costs one set membership and it
    is what would catch a cycle if that ever stopped being true."""
    if source_id.startswith("qr_"):
        return _resolve_query_source(con, source_id, workspace_id, visited)

    if source_id.startswith("wf_"):
        return _resolve_workflow_leaf(con, source_id, workspace_id)

    return _resolve_dataset_leaf(con, source_id, workspace_id)


def _resolve_query_source(
    con: sqlite3.Connection, source_id: str, workspace_id: str, visited: frozenset[str]
) -> tuple[dict | None, str | None]:
    """R168 — resolve a saved Query to **what it returns**: its source + joins, then
    its own filters, then **its own steps** — the same three layers, in the same
    order, that ``GET /queries/{id}/rows`` applies.

    Applying the steps here is D1's repair. Without them a consolidating Workflow read
    the query's UN-shaped rows and, because a run materializes, **froze them to
    `output.parquet`** — while the builder had already offered the shaped columns
    (``resolvedColumns``) to build workflow steps on. The effective column space this
    returns is therefore the POST-step one, which is what a consumer validates its own
    steps against.

    Its one caller is Workflow's consolidation ([[query-shaping-surface]] item 4)."""
    if source_id in visited:
        return None, "composition_cycle"
    qrow = con.execute(_SELECT_QUERY, (source_id,)).fetchone()
    if qrow is None or qrow["workspace_id"] != workspace_id:
        return None, "composition_base_missing"
    base_def = json.loads(qrow["definition_json"])
    payload, reason = _resolve_chain(
        con, qrow["source_id"], _chain_of(base_def), _rels_of(base_def), workspace_id, visited | {source_id}
    )
    if reason is not None:
        return None, reason
    # The base's OWN filters define its virtual table (baked into the sub-relation).
    try:
        b_filters, b_advanced = build_definition_predicates(base_def, payload["effective"])
    except HTTPException:
        return None, "relationship_stale"
    base_cols = payload["effective"]
    sql, params = build_joined_select(
        payload["relations"],
        join_keys=payload["join_keys"],
        select_exprs=payload["select_exprs"],
        effective_columns=[c["name"] for c in base_cols],
        q=base_def.get("q"),
        filters=b_filters,
        advanced=b_advanced,
    )
    columns = base_cols
    steps = base_def.get("steps") or []
    if steps:
        try:
            normalized, columns = _step_plan(steps, base_cols)
        except HTTPException:
            # A saved query whose steps no longer validate against its current columns
            # is DRIFT, not a bad request — the consumer maps the reason to 409.
            return None, "query_stale"
        sql, params, _ = build_steps_relation(sql, params, [c["name"] for c in base_cols], normalized)
    return (
        {
            "relation": (f"({sql})", params),
            "columns": columns,
            "dataset_ids": payload["dataset_ids"],
            "name": qrow["name"],
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

    The DRIVING source (``T0``) is a Dataset for a QUERY (R167). It stays polymorphic
    in the signature because ``build_consolidated_relation`` reuses this path to
    resolve a WORKFLOW's ``qr_``/``wf_`` sources — the one remaining way into
    ``resolve_source``'s composition branch. R88 — each hop joins DATASETS via the
    query's OWN relationship (``query_rels`` keyed by ``queryRelId``), not a live
    workspace ``rel_`` lookup, so editing/deleting a governed rel can't break a saved
    query (it runs on its embedded snapshot). The TREE invariant (R74): a hop's left
    dataset must be a member of some source already in the graph — including a dataset
    inside a workflow-resolved base (provenance) — else ``disconnected_join``; its
    right must be new, else ``cyclic_join``. The join key must still exist with compatible dtypes on both
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
        # R167 — the RIGHT side is a DATASET, resolved through the dataset leaf
        # DIRECTLY. R91 had made it polymorphic (a saved Query joined in as a
        # sub-relation), which is `query×query` — retired with composition. Calling
        # `_resolve_dataset_leaf` rather than `resolve_source` is the structural half
        # of that retirement: the join path no longer reaches the composition
        # machinery at all, so nothing here can recurse or need a cycle guard.
        right_id = qrel["rightSourceId"]
        right, reason = _resolve_dataset_leaf(con, right_id, workspace_id)
        if reason is not None:
            return None, reason
        right_ids = set(right["dataset_ids"])
        # The right must be NEW — the tree invariant, and this is the SELF-JOIN
        # BOUNDARY, which stays rejected (`_noun-model.md`). R167 collapsed it from a
        # set-overlap to a single-id membership test (noun-model D2): a `qr_` right
        # used to bring a SET of leaf datasets that could overlap the graph, and a
        # dataset brings exactly itself. `cyclic_join` is NOT retired — only the
        # set-shaped form of the check is.
        if any(right_id in ids for ids in dataset_id_sets):
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
    """True when the run needs the join engine: at least one join hop, or a WORKFLOW
    source (`qr_` / `wf_`) being consolidated. A bare dataset with no hops is
    single-source (the plain ``read_parquet`` path). R167 — for a QUERY the `qr_` arm
    is now unreachable (`sourceId` is a `ds_`); it is kept for the workflow path,
    which shares this predicate."""
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


def _measure_dtype(col: str | None, agg: str, by_name: dict) -> str:
    """The output dtype of ONE measure (R140): ``count``/``count_distinct`` →
    ``integer``; ``avg`` → ``float``; ``sum``/``min``/``max`` keep the col's dtype.
    Shared by the collapsing aggregate's output columns and the R163 within-group
    column, so the two families cannot drift into a lookalike."""
    if agg in ("count", "count_distinct"):
        return "integer"
    if agg == "avg":
        return "float"
    return by_name[col]["dtype"]  # sum / min / max


def _aggregate_output_columns(
    dimensions: list[str], measures_plan: list[tuple[str | None, str]], columns: list[dict]
) -> list[dict]:
    """The output columns of an aggregate (dimensions then measures): a dimension
    keeps its source dtype, a measure takes ``_measure_dtype``. ``count`` is named
    ``count``; every other measure keeps its col's name."""
    by_name = {c["name"]: c for c in columns}
    out = [{"name": d, "dtype": by_name[d]["dtype"]} for d in dimensions]
    for col, agg in measures_plan:
        name = "count" if agg == "count" else col
        out.append({"name": name, "dtype": _measure_dtype(col, agg, by_name)})
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


def _plan_group_column(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R163 — validate a WITHIN-GROUP column: the measure vocabulary + dtype rules
    come from ``_validate_measure`` verbatim (so ``sum``/``avg`` need numeric,
    ``min``/``max`` orderable, ``count`` omits ``col``), the name must not collide,
    and ``by`` must be ≥1 DISTINCT column present at this step. Returns the
    normalized descriptor + column space (base ++ the new column, dtype by the SAME
    ``_measure_dtype`` rule as a collapsing measure).

    ``by`` is re-checked here rather than trusted from the model because a SAVED
    definition is re-planned on every run and its column names are INLINED into the
    window SQL (same discipline as ``_plan_date_bucket``'s granularity)."""
    by_name = {c["name"]: c for c in cur_cols}
    name = step.get("name")
    if name in by_name:
        raise _agg_422([*loc, "name"], f"column_exists: {name!r} is already a column")
    col, agg = _validate_measure({"agg": step.get("agg"), "col": step.get("col")}, by_name, loc)
    group_by: list[str] = []
    for j, g in enumerate(step.get("by") or []):
        if g not in by_name:
            raise _agg_422([*loc, "by", j], f"unknown_column: {g!r} is not a column at this step")
        if g in group_by:
            raise _agg_422([*loc, "by", j], f"duplicate_group_column: {g!r} appears twice")
        group_by.append(g)
    if not group_by:
        # `by: []` (the whole table — "% of total") is deliberately out of scope:
        # same mechanism, a later round. Never a silent global window.
        raise _agg_422([*loc, "by"], "group_by_required: at least one group column")
    norm = {"kind": "group_column", "name": name, "agg": agg, "col": col, "by": group_by}
    return norm, [*cur_cols, {"name": name, "dtype": _measure_dtype(col, agg, by_name)}]


# R164 — per-op field REQUIREMENTS for the ordered-window family. A field an op
# does not take is REFUSED, never silently ignored: a dropped control is how a
# user gets a column that disregards a setting they made.
#   (needs_col, needs_order, needs_unit)
_WINDOW_OP_SHAPE = {
    "pct_of_total": (True, False, False),
    "running_total": (True, True, False),
    "rank": (False, True, False),
    "prior_period": (True, True, True),
}
_WINDOW_UNITS = ("day", "week", "month", "quarter", "year")


def _plan_window_column(step: dict, cur_cols: list[dict], loc: list) -> tuple[dict, list[dict]]:
    """R164 — validate an ORDERED-WINDOW column. Everything is re-checked HERE
    rather than trusted from the model, because a saved definition is re-planned on
    every run and its column names, the op, and the unit are all INLINED into the
    window SQL (the same discipline as ``_plan_date_bucket``'s granularity and
    ``_plan_group_column``'s ``by``).

    The dtype vocabulary is ``_validate_measure``'s, reached by asking it about the
    equivalent measure rather than re-implementing the rule: ``pct_of_total`` and
    ``running_total`` sum, so they need what ``sum`` needs. One vocabulary, so a
    future dtype change cannot drift between the two families.

    Unlike ``group_column``, an EMPTY ``by`` is legal — the surface names that case
    ("Across everything"), and the guard there exists against a *silent* whole-table
    window."""
    by_name = {c["name"]: c for c in cur_cols}
    op = step.get("op")
    if op not in _WINDOW_OP_SHAPE:
        raise _agg_422([*loc, "op"], f"unknown_window_op: {op!r}")
    needs_col, needs_order, needs_unit = _WINDOW_OP_SHAPE[op]

    name = step.get("name")
    if name in by_name:
        raise _agg_422([*loc, "name"], f"column_exists: {name!r} is already a column")

    # `col` — required or forbidden per op; when required, the dtype rule comes
    # from the collapsing measure it corresponds to.
    col = step.get("col")
    if not needs_col:
        if col is not None:
            raise _agg_422([*loc, "col"], f"window_col_forbidden: op {op!r} must omit col")
    elif col is None:
        raise _agg_422([*loc, "col"], f"window_col_required: op {op!r} requires col")
    elif op in ("pct_of_total", "running_total"):
        # Both SUM, so both take `sum`'s rule — asked of the shared validator, not restated.
        _validate_measure({"agg": "sum", "col": col}, by_name, loc)
    elif col not in by_name:
        raise _agg_422([*loc, "col"], f"unknown_column: {col!r} is not a column at this step")

    # `orderBy` — the in-window ordering; `prior_period` needs exactly one
    # ASCENDING key on a temporal column (it walks a calendar).
    raw_order = step.get("orderBy") or []
    order_by: list[dict] = []
    if not needs_order:
        if raw_order:
            raise _agg_422([*loc, "orderBy"], f"window_order_forbidden: op {op!r} must omit orderBy")
    elif not raw_order:
        raise _agg_422([*loc, "orderBy"], f"window_order_required: op {op!r} requires orderBy")
    else:
        if op == "prior_period" and len(raw_order) != 1:
            raise _agg_422([*loc, "orderBy"], "window_order_single: 'prior_period' takes exactly one key")
        for j, key in enumerate(raw_order):
            k_col = key.get("col")
            if k_col not in by_name:
                raise _agg_422([*loc, "orderBy", j, "col"], f"unknown_column: {k_col!r} is not a column at this step")
            descending = bool(key.get("descending"))
            if op == "prior_period":
                if by_name[k_col]["dtype"] not in ("date", "datetime"):
                    raise _agg_422(
                        [*loc, "orderBy", j, "col"],
                        f"window_order_not_date: {k_col!r} is {by_name[k_col]['dtype']}, not date/datetime",
                    )
                if descending:
                    # Unreachable from the surface (no direction control is rendered);
                    # kept as the wire-level backstop, like `duplicate_group_column`.
                    raise _agg_422([*loc, "orderBy", j, "descending"], "window_order_desc: 'prior_period' orders ascending")
            order_by.append({"col": k_col, "descending": descending})

    # `unit` — the period length, `prior_period` only.
    unit = step.get("unit")
    if not needs_unit:
        if unit is not None:
            raise _agg_422([*loc, "unit"], f"window_unit_forbidden: op {op!r} must omit unit")
    elif unit not in _WINDOW_UNITS:
        raise _agg_422([*loc, "unit"], f"unknown_granularity: {unit!r}")

    # `by` — MAY be empty here; entries must exist and not repeat.
    group_by: list[str] = []
    for j, g in enumerate(step.get("by") or []):
        if g not in by_name:
            raise _agg_422([*loc, "by", j], f"unknown_column: {g!r} is not a column at this step")
        if g in group_by:
            raise _agg_422([*loc, "by", j], f"duplicate_group_column: {g!r} appears twice")
        group_by.append(g)

    norm = {
        "kind": "window_column",
        "op": op,
        "name": name,
        "col": col,
        "by": group_by,
        "order_by": order_by,
        "unit": unit,
    }
    return norm, [*cur_cols, {"name": name, "dtype": _window_output_dtype(op, col, by_name)}]


def _window_output_dtype(op: str, col: str | None, by_name: dict) -> str:
    """R164 — a SHARE is a ratio (always float, because percent FORMATTING is
    presentation); a RANK is an ordinal integer; the other two carry the source
    column's dtype forward, since they hand back a value of the same kind."""
    if op == "pct_of_total":
        return "float"
    if op == "rank":
        return "integer"
    return by_name.get(col or "", {}).get("dtype", "float")


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
    ``aggregate`` reshapes; ``top_n``/``sort`` preserve;
    ``derive``/``date_bucket``/``group_column``/``window_column`` append;
    ``filter`` narrows; ``select`` re-binds (projection + rename + reorder)."""
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
    if kind == "group_column":
        return _plan_group_column(step, cur_cols, loc)
    if kind == "window_column":
        return _plan_window_column(step, cur_cols, loc)
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
