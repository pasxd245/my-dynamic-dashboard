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

from app.ingest.filters import FilterPredicate, build_filter_sql


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

    # Compose the two fragments with AND.
    where_terms = [t for t in (filter_sql, q_sql) if t]
    if where_terms:
        where_clause = "WHERE " + " AND ".join(where_terms)
    else:
        where_clause = ""
    where_params: list[Any] = [*filter_params, *q_params]

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
