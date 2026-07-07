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


# ─── R154: on-demand column profile ──────────────────────────────────
#
# Backs `GET /datasets/{id}/profile`. A read-only DuckDB aggregate over the
# parquet — it never writes back. Cost guard (the round's headline risk): a
# profile is a full-scan aggregate, so on a wide/deep parquet computing it on
# every drawer-open would be a silent cost. When `row_count` exceeds
# `full_scan_max` we materialize an approximate `USING SAMPLE n ROWS` reservoir
# sample once and run every stat over that single sample (so the counts are
# self-consistent), flagging the result `approx`. Otherwise we materialize the
# full (bounded ≤ full_scan_max) table. Nothing is cached — the cost is
# re-paid per call but bounded.

_NUMERIC_DTYPES = frozenset({"integer", "float"})
_TEMPORAL_DTYPES = frozenset({"date", "datetime"})


def profile_dataset_columns(
    parquet_path: Path,
    columns: list[dict[str, str]],
    *,
    row_count: int,
    full_scan_max: int,
    top_k: int = 5,
) -> tuple[list[dict[str, Any]], bool, int | None]:
    """Return ``(column_profiles, approx, sampled_rows)``.

    ``columns`` is the committed ``[{name, dtype}, …]`` list (canonical order).
    Each profile dict carries: ``name``, ``dtype``, ``null_count``,
    ``null_pct``, ``distinct_count``, ``min``, ``max``, ``sample`` — with
    ``min``/``max`` set only for numeric/temporal dtypes, ``sample`` (top-k)
    only for strings, and every other slot ``None`` (the predictable-shape
    contract). ``format`` is folded in by the caller (it lives in
    ``commitSettings``, not the parquet).
    """
    approx = row_count > full_scan_max
    sample_n = full_scan_max

    # Build the per-column aggregate select list against the materialized
    # source table `_prof`. min/max are emitted for numeric/temporal only;
    # a NULL::VARCHAR slot keeps the column offsets predictable otherwise.
    agg_terms: list[str] = ["COUNT(*) AS __total"]
    for i, col in enumerate(columns):
        qc = _quote_ident(col["name"])
        agg_terms.append(f"COUNT(*) - COUNT({qc}) AS n{i}")
        agg_terms.append(f"COUNT(DISTINCT {qc}) AS d{i}")
        if col["dtype"] in _NUMERIC_DTYPES or col["dtype"] in _TEMPORAL_DTYPES:
            agg_terms.append(f"CAST(MIN({qc}) AS VARCHAR) AS mn{i}")
            agg_terms.append(f"CAST(MAX({qc}) AS VARCHAR) AS mx{i}")
        else:
            agg_terms.append(f"CAST(NULL AS VARCHAR) AS mn{i}")
            agg_terms.append(f"CAST(NULL AS VARCHAR) AS mx{i}")

    with duckdb.connect(":memory:") as con:
        # Materialize once so the aggregate and every top-k query read the SAME
        # rows (a fresh `USING SAMPLE` per query would reservoir-sample
        # differently). `sample_n` is a server-controlled int — safe to inline.
        if approx:
            con.execute(
                f"CREATE TEMP TABLE _prof AS SELECT * FROM read_parquet(?) USING SAMPLE {sample_n} ROWS",
                [str(parquet_path)],
            )
        else:
            con.execute("CREATE TEMP TABLE _prof AS SELECT * FROM read_parquet(?)", [str(parquet_path)])

        agg_row = con.execute(f"SELECT {', '.join(agg_terms)} FROM _prof").fetchone()
        scanned_total = int(agg_row[0])

        profiles: list[dict[str, Any]] = []
        for i, col in enumerate(columns):
            base = 1 + i * 4  # __total occupies slot 0; 4 slots per column
            null_count = int(agg_row[base])
            distinct_count = int(agg_row[base + 1])
            mn = agg_row[base + 2]
            mx = agg_row[base + 3]
            sample: list[str | None] | None = None
            if col["dtype"] == "string":
                qc = _quote_ident(col["name"])
                rows = con.execute(
                    f"SELECT CAST({qc} AS VARCHAR) FROM _prof WHERE {qc} IS NOT NULL "
                    f"GROUP BY 1 ORDER BY COUNT(*) DESC, 1 LIMIT ?",
                    [top_k],
                ).fetchall()
                sample = [r[0] for r in rows]
            profiles.append(
                {
                    "name": col["name"],
                    "dtype": col["dtype"],
                    "null_count": null_count,
                    "null_pct": 0.0 if scanned_total == 0 else round(null_count / scanned_total * 100, 2),
                    "distinct_count": distinct_count,
                    "min": mn,
                    "max": mx,
                    "sample": sample,
                }
            )

    return profiles, approx, (scanned_total if approx else None)


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
        if agg == "count":
            select_terms.append(_agg_term("COUNT(*)", '"count"', stringify))
        else:  # col is validated present + dtype-checked per agg by the caller (R140)
            qc = _quote_ident(col or "")
            # sum/avg coalesce an all-NULL group to 0 (client `toNum` parity);
            # min/max stay honest NULL; count_distinct is never NULL.
            expr = {
                "sum": f"COALESCE(SUM({qc}), 0)",
                "avg": f"COALESCE(AVG({qc}), 0)",
                "min": f"MIN({qc})",
                "max": f"MAX({qc})",
                "count_distinct": f"COUNT(DISTINCT {qc})",
            }[agg]
            select_terms.append(_agg_term(expr, qc, stringify))
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
    column; ``date_bucket`` appends a truncated date column (R144); ``filter``
    narrows rows; ``select`` re-binds (projection + rename + reorder, R141)."""
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
    sql, params, cols = inner_sql, inner_params, list(base_columns)
    for step in steps:
        sql, params, cols = _apply_step(step, sql, params, cols)
    quoted = [_quote_ident(c) for c in cols]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted)
    page_sql = f"SELECT {select_list} FROM ({sql}) AS _final"
    page_params = list(params)
    if page_size is not None:
        page_sql += " LIMIT ? OFFSET ?"
        page_params += [page_size, (page - 1) * page_size]
    with duckdb.connect(":memory:") as con:
        total = con.execute(f"SELECT COUNT(*) FROM ({sql}) AS _c", params).fetchone()[0]  # noqa: S608 — composed from validated steps
        rows = con.execute(page_sql, page_params).fetchall()
    return [list(r) for r in rows], int(total)


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
    empty ``steps`` list writes the inner relation verbatim (passthrough)."""
    sql, params, _cols = inner_sql, inner_params, list(base_columns)
    for step in steps:
        sql, params, _cols = _apply_step(step, sql, params, _cols)
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
