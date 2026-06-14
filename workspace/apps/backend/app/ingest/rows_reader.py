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


def query_joined_rows(
    parquets: list[Path],
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
    """Return ``(rows, total)`` for one page of an INNER-join CHAIN over
    ``parquets`` (the ordered chain ``T0, T1, …, Tn``).

    ``join_keys[k] = (left_idx, left_col, right_col, kind)`` is hop ``k``'s key pair:
    hop ``k`` joins the new source ``T{k+1}`` to an EARLIER source ``T{left_idx}`` on
    ``T{left_idx}.left_col = T{k+1}.right_col`` (R74), with the SQL keyword for
    ``kind`` ∈ {inner, left, right, full} (R75 — an outer join keeps unmatched rows,
    NULL on the unmatched side). When ``left_idx == k`` for every hop the graph is a
    strict linear path (R73); a hop whose ``left_idx`` points at an earlier source
    than its predecessor's right makes the graph a TREE (a star). Sources arrive in
    topological order, so ``T{left_idx}`` is always already in the FROM clause.
    ``effective_columns`` is the output column order (collision-qualified names);
    ``filters``/``advanced`` predicates carry those effective names so the reused
    fragment builders compose over the joined CTE. R71's two-source join is the
    single-hop (``len(parquets) == 2``) case.
    """
    quoted_eff = [_quote_ident(c) for c in effective_columns]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted_eff)

    filter_sql, filter_params = build_filter_sql(filters or [])
    advanced_sql, advanced_params = build_advanced_sql(advanced or [])

    q_sql: str
    q_params: list[Any]
    if q:
        like = f"%{q.lower()}%"
        q_sql = "(" + " OR ".join(f"lower(CAST({c} AS VARCHAR)) LIKE ?" for c in quoted_eff) + ")"
        q_params = [like] * len(quoted_eff)
    else:
        q_sql, q_params = "", []

    where_terms = [t for t in (filter_sql, advanced_sql, q_sql) if t]
    where_clause = ("WHERE " + " AND ".join(where_terms)) if where_terms else ""
    where_params: list[Any] = [*filter_params, *advanced_params, *q_params]

    # FROM read_parquet(?) AS T0 {KW} JOIN read_parquet(?) AS T{k+1}
    #   ON T{left_idx}.k = T{k+1}.k …  — each hop joins its new source against its
    # OWN left source (R74 tree), with hop k's SQL keyword (R75 — outer keeps
    # unmatched rows). `inner` is the default; an unknown kind falls back to inner.
    from_parts = ["read_parquet(?) AS T0"]
    for k, (left_idx, left_col, right_col, kind) in enumerate(join_keys):
        keyword = _JOIN_KEYWORDS.get(kind, "INNER JOIN")
        from_parts.append(
            f"{keyword} read_parquet(?) AS T{k + 1} "
            f"ON T{left_idx}.{_quote_ident(left_col)} = T{k + 1}.{_quote_ident(right_col)}"
        )
    from_clause = " ".join(from_parts)

    # Inner CTE: fold the chain, aliasing every output column to its effective
    # (collision-qualified) name; the outer query filters + pages it.
    cte = f"WITH joined AS (SELECT {', '.join(select_exprs)} FROM {from_clause})"
    parquet_params = [str(p) for p in parquets]
    offset = (page - 1) * page_size

    with duckdb.connect(":memory:") as con:
        rows_sql = f"{cte} SELECT {select_list} FROM joined {where_clause} LIMIT ? OFFSET ?"
        rows_params: list[Any] = [*parquet_params, *where_params, page_size, offset]
        page_rows = con.execute(rows_sql, rows_params).fetchall()

        count_sql = f"{cte} SELECT COUNT(*) FROM joined {where_clause}"
        count_params: list[Any] = [*parquet_params, *where_params]
        (total,) = con.execute(count_sql, count_params).fetchone()

    return [list(r) for r in page_rows], int(total)
