"""Paged rows reader — R35.

Backs `GET /datasets/{id}/rows`. Opens an ephemeral
`duckdb.connect(":memory:")` per call, runs SQL against
`read_parquet(...)` to get the page slice + optional substring
filter + total. DuckDB handles column pushdown + predicate
pushdown automatically.

Cells are stringified by SQL `CAST("col" AS VARCHAR)` — booleans
render as `'true'`/`'false'`, dates as `'YYYY-MM-DD'`,
timestamps as `'YYYY-MM-DD HH:MM:SS'`, integers/floats in their
decimal form, NULL stays Python `None` (→ JSON `null`).

The substring filter is naive O(rows × cols):
`WHERE lower(CAST(c AS VARCHAR)) LIKE '%q%' OR …`. Fine at POC
scale (≤100 MB dataset cap); promote to a DuckDB FTS index when
100k+ rows × high q-frequency makes it visible.
"""

from __future__ import annotations

from pathlib import Path

import duckdb


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def query_dataset_rows(
    parquet_path: Path,
    columns: list[str],
    *,
    page: int,
    page_size: int,
    q: str | None,
) -> tuple[list[list[str | None]], int]:
    """Return ``(rows, total)`` for the requested page.

    `columns` is the canonical column order (from the dataset's
    committed `columns_json`); rows in the returned list line up
    with that order one-for-one.

    When `q` is set, both `rows` and `total` reflect the matched
    subset. When `q` is `None` (or empty), behavior is the
    unfiltered paged read.
    """
    quoted_cols = [_quote_ident(c) for c in columns]
    select_list = ", ".join(f"CAST({c} AS VARCHAR)" for c in quoted_cols)

    if q:
        like = f"%{q.lower()}%"
        where_terms = " OR ".join(
            f"lower(CAST({c} AS VARCHAR)) LIKE ?" for c in quoted_cols
        )
        where_clause = f"WHERE {where_terms}"
        where_params: list[object] = [like] * len(quoted_cols)
    else:
        where_clause = ""
        where_params = []

    offset = (page - 1) * page_size

    with duckdb.connect(":memory:") as con:
        rows_sql = (
            f"SELECT {select_list} FROM read_parquet(?) {where_clause} "
            f"LIMIT ? OFFSET ?"
        )
        rows_params: list[object] = [str(parquet_path), *where_params, page_size, offset]
        page_rows = con.execute(rows_sql, rows_params).fetchall()

        count_sql = f"SELECT COUNT(*) FROM read_parquet(?) {where_clause}"
        count_params: list[object] = [str(parquet_path), *where_params]
        (total,) = con.execute(count_sql, count_params).fetchone()

    # DuckDB returns tuples; convert each row to a list and preserve
    # None for nullable cells.
    return [list(r) for r in page_rows], int(total)
