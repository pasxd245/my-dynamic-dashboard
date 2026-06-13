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
    left_cols: list[dict[str, str]],
    right_cols: list[dict[str, str]],
    left_ds_name: str,
    right_ds_name: str,
) -> tuple[list[dict[str, str]], list[str]]:
    """Compute a join's EFFECTIVE column space and the CTE select-expressions.

    Returns ``(effective, select_exprs)`` where ``effective`` is the ordered
    ``left ++ right`` columns (``{name, dtype}``) with names that **collide
    across the two sides** qualified by dataset name (``Deals.id`` /
    ``Accounts.id``); names unique across the join stay bare. ``select_exprs``
    alias each source column (``L."x"`` / ``R."x"``) to its effective output
    name so predicates can reference the effective name unqualified.
    """
    left_names = {c["name"] for c in left_cols}
    right_names = {c["name"] for c in right_cols}
    dupes = left_names & right_names

    effective: list[dict[str, str]] = []
    select_exprs: list[str] = []
    for side, cols, ds_name in (("L", left_cols, left_ds_name), ("R", right_cols, right_ds_name)):
        for c in cols:
            out = f"{ds_name}.{c['name']}" if c["name"] in dupes else c["name"]
            effective.append({"name": out, "dtype": c["dtype"]})
            select_exprs.append(f'{side}.{_quote_ident(c["name"])} AS {_quote_ident(out)}')
    return effective, select_exprs


def query_joined_rows(
    left_parquet: Path,
    right_parquet: Path,
    *,
    left_key: str,
    right_key: str,
    select_exprs: list[str],
    effective_columns: list[str],
    page: int,
    page_size: int,
    q: str | None,
    filters: list[FilterPredicate] | None = None,
    advanced: list[list[FilterPredicate]] | None = None,
) -> tuple[list[list[str | None]], int]:
    """Return ``(rows, total)`` for one page of an INNER join of two parquet
    sources on ``left_key = right_key``.

    `effective_columns` is the output column order (collision-qualified names);
    `filters`/`advanced` predicates must carry those effective names (built by
    re-validating the definition against the effective column space) so the
    reused fragment builders compose over the joined CTE.
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

    # Inner CTE: join the two sources, aliasing every output column to its
    # effective (collision-qualified) name; the outer query filters + pages it.
    cte = (
        "WITH joined AS ("
        f"SELECT {', '.join(select_exprs)} "
        "FROM read_parquet(?) AS L "
        f"INNER JOIN read_parquet(?) AS R ON L.{_quote_ident(left_key)} = R.{_quote_ident(right_key)}"
        ")"
    )
    offset = (page - 1) * page_size

    with duckdb.connect(":memory:") as con:
        rows_sql = f"{cte} SELECT {select_list} FROM joined {where_clause} LIMIT ? OFFSET ?"
        rows_params: list[Any] = [
            str(left_parquet),
            str(right_parquet),
            *where_params,
            page_size,
            offset,
        ]
        page_rows = con.execute(rows_sql, rows_params).fetchall()

        count_sql = f"{cte} SELECT COUNT(*) FROM joined {where_clause}"
        count_params: list[Any] = [str(left_parquet), str(right_parquet), *where_params]
        (total,) = con.execute(count_sql, count_params).fetchone()

    return [list(r) for r in page_rows], int(total)
