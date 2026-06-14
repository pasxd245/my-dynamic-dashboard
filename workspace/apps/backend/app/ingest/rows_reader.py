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
            effective.append({"name": out, "dtype": c["dtype"]})
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
