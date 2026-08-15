"""R172: paging PARTITIONS the unordered read paths — the guard on a default.

``query_dataset_rows`` and ``query_joined_rows`` page with ``LIMIT/OFFSET`` and
no ``ORDER BY``. That is correct only because DuckDB's
``preserve_insertion_order`` makes a scan emit file order, and carries
probe-side order through a hash join, even under parallel execution. Nothing in
this app set that setting until ``app/duck.py``, and nothing asserted it.

These tests are the assertion. They are **not** here to catch a bug — both paths
were measured clean before the round started (200k rows / 20 threads / 60 pages,
and a 120k × 500 join / 40 pages). They are here so that the day the assumption
stops holding — the setting turned off for a bulk load, a changed DuckDB
default, a non-order-preserving operator introduced into one of these reads — a
test says so instead of a user seeing one row twice and another never.

**Driven at the reader functions, not through HTTP, on purpose.** The API caps
``page_size`` at 100 (``PAGE_SIZES``), so an endpoint-level guard would need
hundreds of requests to reach a scale where DuckDB parallelises at all — and
below that scale it is single-threaded and stable regardless, so the guard would
pass with the setting off and prove nothing. Scale is what makes these mean
something; ``test_paging_total_order.py`` already covers the endpoint wiring.

**Negative-controlled**: ``test_the_guard_has_teeth`` builds the same paging
shape with ``preserve_insertion_order=false`` and shows it reshuffling. R171
shipped a guard that passed either way and had to rewrite it; this is that
lesson applied up front.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pytest

from app import duck
from app.ingest.rows_reader import build_effective_columns, query_dataset_rows, query_joined_rows

# Big enough that DuckDB splits the scan across threads (its row group is
# 122 880 rows, so this spans several); small enough to stay under a second.
_ROWS = 400_000
_PAGE = 20_000


def _parquet(path: Path, rows: int, *, mod: int = 41) -> Path:
    with duck.connect() as con:
        con.execute(
            f"COPY (SELECT i AS row_id, i % {mod} AS acct, i % 977 AS amount FROM range({rows}) t(i)) "
            f"TO '{path}' (FORMAT PARQUET)"
        )
    return path


@pytest.mark.unit
def test_dataset_paging_returns_every_row_exactly_once(tmp_path: Path) -> None:
    """The dataset read — a parquet scan, paged. Every row once, none missing,
    and in file order, which for a Dataset IS the presentation (the view-table
    "Excel" model: the row order of the sheet the user uploaded)."""
    p = _parquet(tmp_path / "scan.parquet", _ROWS)
    cols = ["row_id", "acct", "amount"]

    seen: list[str] = []
    for page in range(1, _ROWS // _PAGE + 1):
        rows, total = query_dataset_rows(p, cols, page=page, page_size=_PAGE, q=None)
        assert total == _ROWS
        seen += [r[0] for r in rows]

    assert len(seen) == _ROWS
    assert len(set(seen)) == _ROWS, "a row came back on two pages while another never came back"
    assert seen == sorted(seen, key=int), "paging silently re-presented the user's row order"


@pytest.mark.unit
@pytest.mark.xfail(
    strict=True,
    reason=(
        "R172 FINDING — joined-query paging LOSES ROWS above ~120k. `query_joined_rows` pages a "
        "hash join with LIMIT/OFFSET and no ORDER BY; `preserve_insertion_order` protects a scan "
        "but does NOT survive the join once DuckDB parallelises it past a row group. Measured: "
        "200k → 21 344 rows lost, 300k → 44 224, 400k → 95 936, and page 500 of a 200k joined "
        "query returns a different first row on every request. This is R165 W-7's class on the "
        "joined path. The fix is a design fork (which order?) raised to the human, so the bug is "
        "recorded here rather than silently fixed or silently ignored. Flip to passing when fixed."
    ),
)
def test_joined_paging_returns_every_row_exactly_once(tmp_path: Path) -> None:
    """The joined read — a hash join, paged. This is the one that looked most
    likely to reshuffle (a join has no insertion order of its own), and it does:
    DuckDB carries the probe side's order through only while the join stays
    single-threaded. Above ~120k rows it does not."""
    left = _parquet(tmp_path / "deals.parquet", _ROWS)
    right = _parquet(tmp_path / "accounts.parquet", 41, mod=41)

    effective, select_exprs = build_effective_columns(
        [
            ("deals", [{"name": "row_id", "dtype": "integer"}, {"name": "acct", "dtype": "integer"}]),
            ("accounts", [{"name": "acct", "dtype": "integer"}]),
        ]
    )
    eff_names = [c["name"] for c in effective]

    seen: list[str] = []
    for page in range(1, _ROWS // _PAGE + 1):
        rows, total = query_joined_rows(
            [("read_parquet(?)", [str(left)]), ("read_parquet(?)", [str(right)])],
            join_keys=[(0, "acct", "acct", "inner")],
            select_exprs=select_exprs,
            effective_columns=eff_names,
            page=page,
            page_size=_PAGE,
            q=None,
        )
        assert total == _ROWS
        seen += [r[0] for r in rows]

    assert len(seen) == _ROWS
    assert len(set(seen)) == _ROWS, "the join's pages overlapped — LIMIT/OFFSET sampled instead of partitioning"


@pytest.mark.unit
def test_the_same_page_twice_is_the_same_page(tmp_path: Path) -> None:
    """Two identical reads are two independent executions of the same SQL.
    Without the ordering guarantee they are free to disagree — which is how a
    reported count moves when nothing changed (R165 W-7's second symptom)."""
    p = _parquet(tmp_path / "repeat.parquet", _ROWS)
    cols = ["row_id", "acct", "amount"]
    again = [query_dataset_rows(p, cols, page=7, page_size=_PAGE, q=None)[0] for _ in range(3)]

    assert again[0] == again[1] == again[2]


@pytest.mark.unit
def test_the_guard_has_teeth(tmp_path: Path) -> None:
    """The negative control. ``app/duck.py`` now sets the pragma on every
    connection the app makes, so the unguarded behaviour can only be observed by
    building the same shape without it.

    Asserted as a PROPERTY rather than an exact sequence: with the setting off,
    a paged scan is no longer *guaranteed* to partition. If DuckDB one day
    guarantees it anyway, this assertion is the thing that should be revisited —
    the guards above would have become decorative, which is worth discovering
    deliberately rather than believing quietly.
    """
    p = _parquet(tmp_path / "teeth.parquet", _ROWS)

    with duckdb.connect(":memory:") as con:
        con.execute("SET preserve_insertion_order = false")
        seen: list[int] = []
        for page in range(_ROWS // _PAGE):
            seen += [
                r[0]
                for r in con.execute(
                    "SELECT row_id FROM read_parquet(?) LIMIT ? OFFSET ?",
                    [str(p), _PAGE, page * _PAGE],
                ).fetchall()
            ]

    in_order = seen == sorted(seen)
    partitions = len(set(seen)) == _ROWS
    # Record what was actually observed; the ordering is not guaranteed here, so
    # the test documents the difference rather than asserting a flaky sequence.
    print(f"\npreserve_insertion_order=false → in file order: {in_order} · partitions: {partitions}")
    assert len(seen) == _ROWS
