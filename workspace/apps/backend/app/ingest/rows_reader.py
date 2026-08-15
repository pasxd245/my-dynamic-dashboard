"""Paged rows reader — R35 (R39 adds per-column filters).

Backs `GET /datasets/{id}/rows`. Opens an ephemeral
`duckdb.connect(":memory:")` per call, runs SQL against
`read_parquet(...)` to get the page slice + optional substring
filter + optional per-column filters + total. DuckDB handles
column pushdown + predicate pushdown automatically.

Cells are stringified by SQL `CAST("col" AS VARCHAR)` — booleans
render as `'true'`/`'false'`, dates as `'YYYY-MM-DD'`,
timestamps as `'YYYY-MM-DD HH:MM:SS'`, integers/floats in their
decimal form, NULL stays Python `None` (→ JSON `null`).

The substring filter is naive O(rows × cols):
`WHERE lower(CAST(c AS VARCHAR)) LIKE '%q%' OR …`. Fine at POC
scale (≤100 MB dataset cap); promote to a DuckDB FTS index when
100k+ rows × high q-frequency makes it visible.

Per-column filters (R39) AND-compose with the substring filter:
the combined WHERE clause becomes
`WHERE (filter1 AND filter2 …) AND (q substring across all cols)`
so `total` reflects the AND-composed matched count.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from app.ingest.filters import (
    FilterPredicate,
    build_advanced_sql,
    build_filter_sql,
)


# R75 — SQL keyword per join type. `inner` keeps only matches; the outer joins
# keep unmatched rows (NULL on the unmatched side).
_JOIN_KEYWORDS = {
    "inner": "INNER JOIN",
    "left": "LEFT JOIN",
    "right": "RIGHT JOIN",
    "full": "FULL OUTER JOIN",
}


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def query_dataset_rows(
    parquet_path: Path,
    columns: list[str],
    *,
    page: int,
    page_size: int,
    q: str | None,
    filters: list[FilterPredicate] | None = None,
    advanced: list[list[FilterPredicate]] | None = None,
) -> tuple[list[list[str | None]], int]:
    """Return ``(rows, total)`` for the requested page.

    `columns` is the canonical column order (from the dataset's
    committed `columns_json`); rows in the returned list line up
    with that order one-for-one.

    When `q` is set and/or `filters` is non-empty, both `rows`
    and `total` reflect the AND-composed matched subset.
    When neither is set, behavior is the unfiltered paged read.
    """
    quoted_cols = [_quote_ident(c) for c in columns]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted_cols)

    # Build the optional per-column filter fragment.
    filter_sql, filter_params = build_filter_sql(filters or [])

    # Build the optional advanced-query fragment (OR-of-AND, R51).
    advanced_sql, advanced_params = build_advanced_sql(advanced or [])

    # Build the optional `?q=` substring fragment.
    q_sql: str
    q_params: list[Any]
    if q:
        like = f"%{q.lower()}%"
        q_sql = " OR ".join(f"lower(CAST({c} AS VARCHAR)) LIKE ?" for c in quoted_cols)
        q_params = [like] * len(quoted_cols)
        # Wrap in parens — the OR-chain composes safely under outer AND.
        q_sql = "(" + q_sql + ")"
    else:
        q_sql = ""
        q_params = []

    # Compose the fragments with AND: chips ∧ advanced(OR-of-AND) ∧ q.
    # Param order must match the fragment order in the WHERE clause.
    where_terms = [t for t in (filter_sql, advanced_sql, q_sql) if t]
    if where_terms:
        where_clause = "WHERE " + " AND ".join(where_terms)
    else:
        where_clause = ""
    where_params: list[Any] = [*filter_params, *advanced_params, *q_params]

    offset = (page - 1) * page_size

    with duckdb.connect(":memory:") as con:
        rows_sql = f"SELECT {select_list} FROM read_parquet(?) {where_clause} LIMIT ? OFFSET ?"
        rows_params: list[Any] = [
            str(parquet_path),
            *where_params,
            page_size,
            offset,
        ]
        page_rows = con.execute(rows_sql, rows_params).fetchall()

        count_sql = f"SELECT COUNT(*) FROM read_parquet(?) {where_clause}"
        count_params: list[Any] = [str(parquet_path), *where_params]
        (total,) = con.execute(count_sql, count_params).fetchone()

    # DuckDB returns tuples; convert each row to a list and preserve
    # None for nullable cells.
    return [list(r) for r in page_rows], int(total)


# ─── R71: join execution ─────────────────────────────────────────────
#
# The single-source path above is `FROM read_parquet(?)` with unqualified
# column names — it CANNOT express a two-source join (a bare column name is
# ambiguous across two parquet sources). Join execution is therefore a NEW
# read path, not a reuse of query_dataset_rows; what it DOES reuse is the
# predicate fragment builders (build_filter_sql / build_advanced_sql /
# _predicate_sql) — by aliasing every joined output column to its EFFECTIVE
# (collision-qualified) name in an inner CTE, so the same unqualified-name
# fragments compose correctly over the joined relation.


def build_effective_columns(
    sources: list[tuple[str, list[dict[str, str]]]],
) -> tuple[list[dict[str, str]], list[str]]:
    """Compute a join CHAIN's EFFECTIVE column space and the CTE select-expressions.

    ``sources`` is the ordered chain ``[(dataset_name, columns), …]`` starting
    with the driving source dataset (alias ``T0``), then each chained dataset
    (``T1``, ``T2``, …) — R71's two-source join is the length-2 case.

    Returns ``(effective, select_exprs)`` where ``effective`` is the ordered
    concatenation of every source's columns (``{name, dtype}``) with names that
    **collide across two or more sources** qualified by dataset name
    (``Deals.id`` / ``Accounts.id``; ``accounts.tier`` / ``owners.tier``); names
    unique across the whole chain stay bare. ``select_exprs`` alias each source
    column (``T{i}."x"``) to its effective output name so predicates can
    reference the effective name unqualified.

    R93 — COLUMN PROVENANCE rides through unchanged: a source column carrying
    ``ownerSourceId`` (a leaf ``ds_``) + ``sourceColumn`` (its pre-qualification
    name) is copied onto the effective entry. Only the display ``name`` is
    collision-qualified; the leaf owner + ``sourceColumn`` are untouched, so a
    composed (``qr_``) source — whose columns already carry leaf provenance —
    passes it up to ANY depth. The SQL alias still keys on the source-exposed
    ``c["name"]`` (a leaf's bare name, or a sub-query's effective name), so the
    join/select machinery is unchanged.
    """
    name_counts: dict[str, int] = {}
    for _, cols in sources:
        for c in cols:
            name_counts[c["name"]] = name_counts.get(c["name"], 0) + 1

    effective: list[dict[str, str]] = []
    select_exprs: list[str] = []
    for i, (ds_name, cols) in enumerate(sources):
        alias = f"T{i}"
        for c in cols:
            out = f"{ds_name}.{c['name']}" if name_counts[c["name"]] > 1 else c["name"]
            eff_col: dict[str, str] = {"name": out, "dtype": c["dtype"]}
            if c.get("ownerSourceId"):
                eff_col["ownerSourceId"] = c["ownerSourceId"]
                eff_col["sourceColumn"] = c["sourceColumn"]
            effective.append(eff_col)
            select_exprs.append(f'{alias}.{_quote_ident(c["name"])} AS {_quote_ident(out)}')
    return effective, select_exprs


Relation = tuple[str, list[Any]]
"""A source RELATION for the fold: ``(sql_expr, params)``. ``sql_expr`` is either
``read_parquet(?)`` (a Dataset leaf) or a parenthesized sub-SELECT (a composed
Query used as a source, R76 — the unified ``ds_``/``qr_`` resolver, J-2′);
``params`` are its bound values, spliced into the FROM clause in source order."""


def _build_where(
    quoted_eff: list[str],
    q: str | None,
    filters: list[FilterPredicate] | None,
    advanced: list[list[FilterPredicate]] | None,
) -> tuple[str, list[Any]]:
    """The composed WHERE clause + params over the EFFECTIVE column space:
    chips ∧ advanced(OR-of-AND) ∧ ``?q=`` substring. Empty when no predicate."""
    filter_sql, filter_params = build_filter_sql(filters or [])
    advanced_sql, advanced_params = build_advanced_sql(advanced or [])
    if q:
        like = f"%{q.lower()}%"
        q_sql = "(" + " OR ".join(f"lower(CAST({c} AS VARCHAR)) LIKE ?" for c in quoted_eff) + ")"
        q_params: list[Any] = [like] * len(quoted_eff)
    else:
        q_sql, q_params = "", []
    where_terms = [t for t in (filter_sql, advanced_sql, q_sql) if t]
    where_clause = ("WHERE " + " AND ".join(where_terms)) if where_terms else ""
    return where_clause, [*filter_params, *advanced_params, *q_params]


def build_joined_select(
    relations: list[Relation],
    *,
    join_keys: list[tuple[int, str, str, str]],
    select_exprs: list[str],
    effective_columns: list[str],
    q: str | None,
    filters: list[FilterPredicate] | None = None,
    advanced: list[list[FilterPredicate]] | None = None,
) -> tuple[str, list[Any]]:
    """Build the TYPED relational SELECT (no CAST, no pagination) producing a
    (possibly joined) query's rows under their EFFECTIVE column names, with the
    query's OWN filters applied. Returns ``(sql, params)``.

    This is the composable core (R76): a Query used as a join SOURCE wraps this in
    ``( … )`` as its sub-relation — types are preserved so a downstream join key
    stays integer — and ``query_joined_rows`` wraps it for paged VARCHAR output.

    ``join_keys[k] = (left_idx, left_col, right_col, kind)`` joins the new source
    ``T{k+1}`` to an earlier source ``T{left_idx}`` (R74 tree) with ``kind``'s SQL
    keyword (R75 outer). Each source is a ``relations[i]`` expr aliased ``T{i}``;
    its params splice in source order. Filters reference the effective names, so
    they apply over a derived table that exposes the ``select_exprs`` aliases."""
    from_parts = [f"{relations[0][0]} AS T0"]
    for k, (left_idx, left_col, right_col, kind) in enumerate(join_keys):
        keyword = _JOIN_KEYWORDS.get(kind, "INNER JOIN")
        from_parts.append(
            f"{keyword} {relations[k + 1][0]} AS T{k + 1} "
            f"ON T{left_idx}.{_quote_ident(left_col)} = T{k + 1}.{_quote_ident(right_col)}"
        )
    from_clause = " ".join(from_parts)
    relation_params: list[Any] = [p for (_, params) in relations for p in params]

    quoted_eff = [_quote_ident(c) for c in effective_columns]
    where_clause, where_params = _build_where(quoted_eff, q, filters, advanced)
    projected = f"SELECT {', '.join(select_exprs)} FROM {from_clause}"
    # Apply the query's own filters at a level ABOVE the projection so they
    # reference the effective (collision-qualified) names the select_exprs alias.
    if where_clause:
        sql = f"SELECT * FROM ({projected}) AS _q {where_clause}"
    else:
        sql = projected
    return sql, [*relation_params, *where_params]


# ─── R119: server-side aggregate (GROUP BY) ──────────────────────────
#
# A widget that aggregates (bar/pie/line/scalar) asks for GROUP BY (dims) →
# measures computed server-side, instead of fetching capped raw rows and
# rolling them up client-side (a SUM over the first N rows is WRONG once
# capped, R110). The aggregate is a NEW PROJECTION over the SAME inner
# relation the run/preview path already builds (single-source read_parquet or
# the joined CTE), with the query's OWN filters applied — DuckDB GROUP BY, not
# a new engine. The result is one row per group, so no row cap applies.


def build_single_inner(
    parquet_path: Path,
    columns: list[str],
    *,
    q: str | None,
    filters: list[FilterPredicate] | None = None,
    advanced: list[list[FilterPredicate]] | None = None,
) -> tuple[str, list[Any]]:
    """Typed inner relation for a SINGLE-source query: ``read_parquet`` with the
    query's own filters applied — no CAST, no pagination (the aggregate wrapper
    groups over it). Mirrors the front half of ``query_dataset_rows``."""
    quoted_cols = [_quote_ident(c) for c in columns]
    where_clause, where_params = _build_where(quoted_cols, q, filters, advanced)
    sql = f"SELECT * FROM read_parquet(?) {where_clause}"
    return sql, [str(parquet_path), *where_params]


def _name_in_sql(dashboard_filters: list[tuple[str, list[Any]]]) -> tuple[str, list[Any]]:
    """The R103 runtime dashboard filters as a WHERE over the base relation:
    each is a categorical one-of on an effective column by NAME (AND-composed
    across filters). A ``None`` value matches a NULL/empty cell — the
    ``(blank)`` option — mirroring the client ``applyFilters``/``labelOf``."""
    terms: list[str] = []
    params: list[Any] = []
    for col, values in dashboard_filters:
        ident = _quote_ident(col)
        non_null = [v for v in values if v is not None]
        has_blank = any(v is None for v in values)
        ors: list[str] = []
        if non_null:
            placeholders = ", ".join("?" for _ in non_null)
            ors.append(f"CAST({ident} AS VARCHAR) IN ({placeholders})")
            params.extend(non_null)
        if has_blank:
            ors.append(f"({ident} IS NULL OR CAST({ident} AS VARCHAR) = '')")
        if ors:
            terms.append("(" + " OR ".join(ors) + ")")
    where = ("WHERE " + " AND ".join(terms)) if terms else ""
    return where, params


def _agg_term(expr: str, alias: str, stringify: bool) -> str:
    """An aggregate select term: typed (``expr AS alias``) or stringified
    (``CAST(expr AS VARCHAR) AS alias``). Typed terms let a step chain (R121) — a
    following ``top_n`` must order a NUMERIC measure, not a lexical string."""
    return f"CAST({expr} AS VARCHAR) AS {alias}" if stringify else f"{expr} AS {alias}"


_MEASURE_CALLS = {
    "sum": "SUM({c})",
    "avg": "AVG({c})",
    "min": "MIN({c})",
    "max": "MAX({c})",
    "count_distinct": "COUNT(DISTINCT {c})",
}
# sum/avg coalesce an all-NULL group to 0 (client `toNum` parity); min/max stay
# honest NULL; the counts are never NULL.
_COALESCING_AGGS = {"sum", "avg"}


def _measure_expr(agg: str, col: str | None, *, over: str | None = None) -> str:
    """One measure's SQL — COLLAPSING (``over=None``, a GROUP BY term) or WINDOWED
    (``over="PARTITION BY …"``, R163's within-group column). ``count`` tallies
    rows (``COUNT(*)``); every other agg reads a caller-validated, dtype-checked
    ``col`` (R140). The COALESCE wraps the WHOLE windowed call because ``OVER``
    binds to the aggregate itself — ``COALESCE(SUM(x), 0) OVER (…)`` is not valid
    SQL. Shared by both families so their vocabulary and NULL policy cannot drift
    into a lookalike.

    ``over`` is None-vs-str, NOT falsy-vs-truthy: R164's "across everything" is a
    legitimately EMPTY window (``OVER ()``, the whole table), which is a different
    thing from no window at all. Testing truthiness silently turned that case back
    into a collapsing aggregate — and the difference is invisible until a caller
    actually needs an empty partition."""
    expr = "COUNT(*)" if agg == "count" else _MEASURE_CALLS[agg].format(c=_quote_ident(col or ""))
    if over is not None:
        expr = f"{expr} OVER ({over})"
    return f"COALESCE({expr}, 0)" if agg in _COALESCING_AGGS else expr


def build_aggregate_select(
    inner_sql: str,
    inner_params: list[Any],
    *,
    dimensions: list[str],
    measures: list[tuple[str | None, str]],
    dashboard_filters: list[tuple[str, list[Any]]],
    stringify: bool = True,
) -> tuple[str, list[Any]]:
    """Compose a GROUP BY aggregate over a base relation (the single-source or
    joined inner SELECT, which already applies the query's OWN filters).
    ``measures`` is an ordered list of ``(col, agg)`` — ``agg='count'`` ignores
    ``col`` (``COUNT(*)``), ``agg='sum'`` totals a validated numeric ``col``
    (``COALESCE(SUM(col), 0)`` so an all-NULL group reads 0, matching the client
    ``toNum``). The dashboard filters apply as a WHERE over the base BEFORE the
    grouping; ``dimensions`` are the GROUP BY keys (empty = one scalar row).

    ``stringify`` (default True) casts output cells to ``VARCHAR`` (the rows-
    response shape). The R121 step engine passes ``False`` for a NON-final
    aggregate so the relation stays TYPED and a following step composes correctly."""
    where_sql, where_params = _name_in_sql(dashboard_filters)
    select_terms: list[str] = []
    for d in dimensions:
        qd = _quote_ident(d)
        select_terms.append(_agg_term(qd, qd, stringify))
    for col, agg in measures:
        # col is validated present + dtype-checked per agg by the caller (R140);
        # `count` has no col and is named `count`.
        alias = '"count"' if agg == "count" else _quote_ident(col or "")
        select_terms.append(_agg_term(_measure_expr(agg, col), alias, stringify))
    group_by = ("GROUP BY " + ", ".join(_quote_ident(d) for d in dimensions)) if dimensions else ""
    sql = f"SELECT {', '.join(select_terms)} FROM ({inner_sql}) AS _base {where_sql} {group_by}"
    return sql, [*inner_params, *where_params]


def _derive_expr(step: dict) -> str:
    """The R122 derive expression. The constant is a validated float (pydantic) →
    safe to inline, keeping ``?`` out of the SELECT clause (param-order sanity);
    ``÷`` guards the denominator with ``NULLIF(…, 0)`` → NULL, not a crash."""
    left = f"CAST({_quote_ident(step['left'])} AS DOUBLE)"
    right = (
        f"CAST({_quote_ident(step['right_col'])} AS DOUBLE)"
        if step["right_kind"] == "col"
        else f"CAST({float(step['right_value'])} AS DOUBLE)"
    )
    return f"({left} / NULLIF({right}, 0))" if step["op"] == "/" else f"({left} {step['op']} {right})"


def _apply_step(step: dict, sql: str, params: list[Any], cols: list[str]) -> tuple[str, list[Any], list[str]]:
    """Apply one TYPED step → ``(sql, params, columns)``. ``aggregate`` reshapes;
    ``top_n`` orders + caps; ``sort`` orders (R141, no limit); ``derive`` appends a
    column; ``date_bucket`` appends a truncated date column (R144);
    ``group_column`` appends a within-group aggregate WITHOUT collapsing rows
    (R163); ``window_column`` appends an ORDERED-window column (R164);
    ``filter`` narrows rows; ``select`` re-binds (projection + rename +
    reorder, R141)."""
    kind = step["kind"]
    if kind == "aggregate":
        sql, params = build_aggregate_select(
            sql, params, dimensions=step["dimensions"], measures=step["measures_plan"], dashboard_filters=[], stringify=False
        )
        return sql, params, step["output_cols"]
    if kind == "top_n":
        direction = "DESC" if step["descending"] else "ASC"
        return f"SELECT * FROM ({sql}) AS _t ORDER BY {_quote_ident(step['col'])} {direction} LIMIT ?", [*params, step["n"]], cols
    if kind == "sort":
        # Explicit NULLS LAST both directions — a deliverable keeps blanks at the bottom.
        order = ", ".join(
            f"{_quote_ident(k['col'])} {'DESC' if k['descending'] else 'ASC'} NULLS LAST" for k in step["keys"]
        )
        return f"SELECT * FROM ({sql}) AS _o ORDER BY {order}", params, cols
    if kind == "select":
        select_list = ", ".join(f"{_quote_ident(c['col'])} AS {_quote_ident(c['name'])}" for c in step["cols"])
        return f"SELECT {select_list} FROM ({sql}) AS _p", params, step["output_cols"]
    if kind == "derive":
        return f"SELECT *, {_derive_expr(step)} AS {_quote_ident(step['name'])} FROM ({sql}) AS _d", params, [*cols, step["name"]]
    if kind == "group_column":
        # R163 — the WITHIN-GROUP column: the same measure expression as a
        # collapsing aggregate, WINDOWED over the row's partition instead of
        # collapsing it, so the row count is unchanged. No in-window ORDER BY →
        # the frame is the whole partition and the value is order-independent.
        over = "PARTITION BY " + ", ".join(_quote_ident(g) for g in step["by"])
        expr = _measure_expr(step["agg"], step["col"], over=over)
        return f"SELECT *, {expr} AS {_quote_ident(step['name'])} FROM ({sql}) AS _n", params, [*cols, step["name"]]
    if kind == "window_column":
        # R164 — the ORDERED-WINDOW family. Same append-a-column shape as
        # `group_column`, plus an in-window ORDER BY and a frame. The measure SQL
        # still comes from `_measure_expr` (one vocabulary, one NULL policy) —
        # only the OVER(...) body differs per op.
        return _apply_window_column(step, sql, params, cols)
    if kind == "date_bucket":
        # R144 — append the period's START date (week = ISO Monday-start, DuckDB
        # native). granularity is enum-guarded by the planner → safe to inline.
        expr = f"CAST(date_trunc('{step['granularity']}', {_quote_ident(step['col'])}) AS DATE)"
        return f"SELECT *, {expr} AS {_quote_ident(step['name'])} FROM ({sql}) AS _g", params, [*cols, step["name"]]
    # filter — post-step WHERE (HAVING-like); params append AFTER the inner params.
    frag, fparams = build_filter_sql(step["predicates_fp"])
    if not frag:
        return sql, params, cols
    return f"SELECT * FROM ({sql}) AS _w WHERE {frag}", [*params, *fparams], cols


def _window_over(step: dict, *, order: str = "", frame: str = "") -> str:
    """The OVER(...) body shared by every ordered-window op: the partition (which
    MAY be empty — "across everything"), plus the op's own ordering and frame."""
    parts = []
    if step["by"]:
        parts.append("PARTITION BY " + ", ".join(_quote_ident(g) for g in step["by"]))
    if order:
        parts.append(order)
    if frame:
        parts.append(frame)
    return " ".join(parts)


def _window_order_sql(step: dict, *, nulls_last: bool) -> str:
    """The in-window ORDER BY. `NULLS LAST` in both directions matches the `sort`
    step's rule — a deliverable keeps blanks at the bottom — but it is OMITTED for
    the RANGE-framed op, whose ordering is a calendar axis, not a presentation."""
    suffix = " NULLS LAST" if nulls_last else ""
    keys = ", ".join(
        f"{_quote_ident(k['col'])} {'DESC' if k['descending'] else 'ASC'}{suffix}" for k in step["order_by"]
    )
    return f"ORDER BY {keys}"


def _apply_window_column(
    step: dict, sql: str, params: list[Any], cols: list[str]
) -> tuple[str, list[Any], list[str]]:
    """R164 — compile one ordered-window column to `SELECT *, <expr> AS name`.

    Every form here was verified against the PINNED DuckDB before it was written
    (R163's lesson: `COALESCE(agg(x), 0) OVER (…)` is a syntax error because
    `OVER` binds to the aggregate call, so the COALESCE has to wrap the *windowed*
    call — `_measure_expr` already does exactly that, which is why it is reused
    rather than re-derived here).

    `prior_period` is the one that carries a correctness decision rather than just
    a shape: a `RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND …` frame walks the
    CALENDAR, so on a Jan/Feb/APR axis April reads NULL. A positional `LAG` would
    report February's number there — a confident wrong number, silently. The unit
    and op are enum-guarded by the planner, so they are safe to inline."""
    op, name = step["op"], step["name"]
    col = step["col"]
    if op == "pct_of_total":
        # CAST the numerator: an integer/integer ratio must still read as a share.
        total = _measure_expr("sum", col, over=_window_over(step))
        expr = f"CAST({_quote_ident(col)} AS DOUBLE) / NULLIF({total}, 0)"
    elif op == "running_total":
        expr = _measure_expr(
            "sum",
            col,
            over=_window_over(
                step,
                order=_window_order_sql(step, nulls_last=True),
                frame="ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW",
            ),
        )
    elif op == "rank":
        # RANK, never ROW_NUMBER: ties SHARE a rank and the next rank SKIPS. Row
        # numbering would invent an order between genuinely equal rows, so the same
        # query could reshuffle a tie between runs (R164 D-7).
        expr = f"RANK() OVER ({_window_over(step, order=_window_order_sql(step, nulls_last=True))})"
    else:
        unit = step["unit"]
        frame = f"RANGE BETWEEN INTERVAL 1 {unit.upper()} PRECEDING AND INTERVAL 1 {unit.upper()} PRECEDING"
        over = _window_over(step, order=_window_order_sql(step, nulls_last=False), frame=frame)
        expr = f"FIRST_VALUE({_quote_ident(col)}) OVER ({over})"
    return f"SELECT *, {expr} AS {_quote_ident(name)} FROM ({sql}) AS _v", params, [*cols, name]


def build_steps_relation(
    inner_sql: str,
    inner_params: list[Any],
    base_columns: list[str],
    steps: list[dict],
) -> tuple[str, list[Any], list[str]]:
    """R168 — fold an ordered list of TYPED transform steps over an inner relation
    and return the SHAPED relation ``(sql, params, columns)`` **without executing
    it**, so the result composes as a sub-relation.

    This fold is the one thing every step consumer shares. ``run_steps`` stringifies
    it to rows, ``materialize_steps`` writes it to parquet, and ``resolve_source``'s
    ``qr_`` branch stacks it into a workflow's ``UNION ALL BY NAME`` — which is why
    it is extracted rather than repeated a third time. Steps are normalized dicts
    (validated by the router); an empty list is the identity."""
    sql, params, cols = inner_sql, inner_params, list(base_columns)
    for step in steps:
        sql, params, cols = _apply_step(step, sql, params, cols)
    return sql, params, cols


def run_steps(
    inner_sql: str,
    inner_params: list[Any],
    base_columns: list[str],
    steps: list[dict],
    *,
    page: int = 1,
    page_size: int | None = None,
) -> tuple[list[list[str | None]], int]:
    """R121 — apply an ordered list of TYPED transform steps over the inner
    relation, then stringify the FINAL relation to rows. ``steps`` are normalized
    dicts (validated by the router). Only the final output is CAST to VARCHAR, so
    intermediate types survive the chain (a ``top_n`` after an ``aggregate`` sorts
    the measure numerically; a ``filter`` compares a derived float numerically).

    R144 (Review finding #2) — returns ``(rows, total)`` and pages the SHAPED
    relation via LIMIT/OFFSET; ``total`` is the full shaped count. The R120
    "shaped results are small by construction" assumption died with the
    row-preserving steps (derive/filter/sort/date_bucket). ``page_size=None``
    returns everything (the callers' unpaged path is capped upstream)."""
    sql, params, cols = build_steps_relation(inner_sql, inner_params, base_columns, steps)
    quoted = [_quote_ident(c) for c in cols]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted)
    page_sql = f"SELECT {select_list} FROM ({sql}) AS _final"
    # W-7 — a total order, so LIMIT/OFFSET actually partitions. Guarded because an
    # empty column space would make `ORDER BY` a syntax error rather than a no-op.
    order = _page_order_sql(steps, cols)
    if order:
        page_sql += f" ORDER BY {order}"
    page_params = list(params)
    if page_size is not None:
        page_sql += " LIMIT ? OFFSET ?"
        page_params += [page_size, (page - 1) * page_size]
    with duckdb.connect(":memory:") as con:
        total = con.execute(f"SELECT COUNT(*) FROM ({sql}) AS _c", params).fetchone()[0]  # noqa: S608 — composed from validated steps
        rows = con.execute(page_sql, page_params).fetchall()
    return [list(r) for r in rows], int(total)


def _page_order_sql(steps: list[dict], cols: list[str]) -> str:
    """R165 walk W-7 — a DETERMINISTIC TOTAL order for the paged read.

    ``LIMIT/OFFSET`` over a relation with no total order does not partition it:
    each page is an independent execution free to return rows in a different
    order, so ``OFFSET`` slices a re-shuffled relation. Measured on the walk's own
    96-row chain: pages 1-4 returned 96 rows but only **63 distinct** ones — 33
    twice, 33 never. Latent since stepped queries shipped (R125); it is a property
    of the pager, not of any one step.

    The user's explicit ordering still WINS — the last ``sort``/``top_n`` supplies
    the leading keys, with the same `NULLS LAST`-both-directions rule those steps
    use — and every remaining column is appended as a **tiebreak** so the order is
    total. Without such a step the order is every column ascending: arbitrary as a
    presentation, but reproducible, which is the whole point. Ordering the TYPED
    columns of ``_final`` (not the VARCHAR casts in the select list) keeps numbers
    sorting numerically.
    """
    keys: list[str] = []
    used: set[str] = set()

    def add(col: str, *, descending: bool) -> None:
        if col in used or col not in cols:
            return
        used.add(col)
        keys.append(f"{_quote_ident(col)} {'DESC' if descending else 'ASC'} NULLS LAST")

    # The LAST ordering step is the one the reader sees; anything before it was
    # re-ordered by it, so only that one contributes leading keys.
    for step in reversed(steps):
        if step["kind"] == "sort":
            for key in step["keys"]:
                add(key["col"], descending=bool(key.get("descending")))
            break
        if step["kind"] == "top_n":
            add(step["col"], descending=bool(step.get("descending")))
            break
    for col in cols:
        add(col, descending=False)
    return ", ".join(keys)


def materialize_steps(
    inner_sql: str,
    inner_params: list[Any],
    base_columns: list[str],
    steps: list[dict],
    out_path: Path,
) -> None:
    """R134 — fold an ordered list of TYPED transform steps over the inner relation
    (a workflow's resolved + filtered source), then write the TYPED final relation
    to ``out_path`` as parquet. Unlike ``run_steps`` (which stringifies to rows for a
    response), this keeps native types — an integer stays integer — so the
    materialized output can later be read back as a typed table source (R135). An
    empty ``steps`` list writes the inner relation verbatim (passthrough).

    R171 item 8 — the write is ORDERED, by the same ``_page_order_sql`` keys the
    source query's paged read uses (R165 W-7). Without it the parquet came out in
    whatever order DuckDB's plan emitted, and the workflow's rows path reads that
    file order back verbatim: same rows, same values, a different sequence from the
    query they came from. Ordering the WRITE fixes it at the one point where the
    sequence is decided once, instead of re-sorting on every read.

    What this does NOT do: make the READ contractually ordered. ``query_dataset_rows``
    (which serves the workflow rows path and every dataset read) still has no
    ``ORDER BY``. That read is nonetheless STABLE in practice — and not by luck:
    DuckDB's ``preserve_insertion_order`` (default ``true``) makes a parquet SCAN emit
    file order even under a parallel scan. Measured 2026-08-15 on 200k rows / 20
    threads: 60 pages, zero duplicates, exact file order, stable across repeat requests
    and under a filter.

    So this is NOT the R165 W-7 case, and an earlier version of this comment said it
    was. W-7 reshuffled because ``build_steps_relation`` carries hash aggregates and
    window functions, where there is no insertion order to preserve. The residue here
    is a real but different thing: paging correctness on the dataset path rests on an
    engine DEFAULT we never set and never assert. It breaks if that setting is turned
    off (a normal bulk-load tuning), if the default changes, or if an aggregate/join is
    ever introduced into this read path."""
    sql, params, cols = build_steps_relation(inner_sql, inner_params, base_columns, steps)
    order = _page_order_sql(steps, cols)
    if order:
        sql = f"SELECT * FROM ({sql}) AS _ordered ORDER BY {order}"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    target = str(out_path).replace("'", "''")
    with duckdb.connect(":memory:") as con:
        # CREATE-then-COPY: the subquery binds `?` params; COPY's target must be a
        # SQL literal (DuckDB won't parameterize a COPY path). The path is server-
        # generated from validated ids, so the escaped literal is safe.
        con.execute(f"CREATE TABLE _out AS ({sql})", params)
        con.execute(f"COPY _out TO '{target}' (FORMAT PARQUET)")


def query_aggregate_rows(
    inner_sql: str,
    inner_params: list[Any],
    *,
    dimensions: list[str],
    measures: list[tuple[str | None, str]],
    dashboard_filters: list[tuple[str, list[Any]]],
) -> list[list[str | None]]:
    """Execute the GROUP BY aggregate; return stringified grouped rows (one per
    group; a scalar request — no dimensions — returns exactly one row). No row
    cap: the result is small by construction, so totals are correct regardless
    of the dashboard fetch cap (the R119 point)."""
    sql, params = build_aggregate_select(
        inner_sql,
        inner_params,
        dimensions=dimensions,
        measures=measures,
        dashboard_filters=dashboard_filters,
    )
    with duckdb.connect(":memory:") as con:
        rows = con.execute(sql, params).fetchall()
    return [list(r) for r in rows]


def query_joined_rows(
    relations: list[Relation],
    *,
    join_keys: list[tuple[int, str, str, str]],
    select_exprs: list[str],
    effective_columns: list[str],
    page: int,
    page_size: int,
    q: str | None,
    filters: list[FilterPredicate] | None = None,
    advanced: list[list[FilterPredicate]] | None = None,
) -> tuple[list[list[str | None]], int]:
    """Return ``(rows, total)`` for one page of a join over ``relations`` (the
    ordered sources ``T0, T1, …, Tn``). Each source is a ``read_parquet(?)`` leaf
    or a composed sub-SELECT (R76); R71's two-source join is the single-hop case.

    Delegates the typed fold (FROM + the query's own filters) to
    ``build_joined_select``, then CASTs to VARCHAR + paginates here. The CTE
    ``joined`` exposes the effective names; ``total`` reflects the filtered count.
    """
    inner_sql, inner_params = build_joined_select(
        relations,
        join_keys=join_keys,
        select_exprs=select_exprs,
        effective_columns=effective_columns,
        q=q,
        filters=filters,
        advanced=advanced,
    )
    quoted_eff = [_quote_ident(c) for c in effective_columns]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted_eff)
    offset = (page - 1) * page_size

    with duckdb.connect(":memory:") as con:
        rows_sql = f"WITH joined AS ({inner_sql}) SELECT {select_list} FROM joined LIMIT ? OFFSET ?"
        page_rows = con.execute(rows_sql, [*inner_params, page_size, offset]).fetchall()

        count_sql = f"WITH joined AS ({inner_sql}) SELECT COUNT(*) FROM joined"
        (total,) = con.execute(count_sql, [*inner_params]).fetchone()

    return [list(r) for r in page_rows], int(total)
