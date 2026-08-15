"""The one place a DuckDB connection is made (R172).

Every read and write in this app runs on an ephemeral ``:memory:`` DuckDB
connection created per call. They were built at 11 separate call sites with a
bare ``duckdb.connect(":memory:")``, which was fine until R171's close asked a
question nobody had asked: *why is paging correct?*

**The answer was a default.** ``query_dataset_rows`` and ``query_joined_rows``
page with ``LIMIT/OFFSET`` and **no** ``ORDER BY``. That partitions the result
correctly only because DuckDB's ``preserve_insertion_order`` is on, which makes
a scan emit file order — and carries probe-side order through a hash join —
even under parallel execution. Measured 2026-08-15: 200k rows / 20 threads / 60
pages and a 120k-row join / 40 pages, both zero duplicates and stable on repeat.

So the app depended on a setting it never set, never asserted and never
mentioned. **This module sets it**, once, so the dependency is declared where a
reader will meet it rather than inferred from the absence of an ``ORDER BY``
three files away. It is the DuckDB sibling of ``db.py`` (SQLite/SQLModel).

Not in scope, deliberately: this is not a connection-tuning module. It carries
**one** setting — the one correctness rests on. Memory limits, thread counts
and extensions are a different round with a different argument.

*(``preserve_insertion_order`` is already DuckDB's default, so setting it
changes no behaviour today. That is the point: the guard tests in
``test_paging_partitions.py`` fail if it ever stops being true, which is the
part that could not previously be noticed.)*
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator

import duckdb


@contextlib.contextmanager
def connect() -> Iterator[duckdb.DuckDBPyConnection]:
    """An ephemeral in-memory DuckDB connection with the ordering guarantee the
    paged reads depend on. Drop-in for ``duckdb.connect(":memory:")``."""
    with duckdb.connect(":memory:") as con:
        con.execute("SET preserve_insertion_order = true")
        yield con
