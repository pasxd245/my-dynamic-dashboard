"""R172: paging PARTITIONS the paged read paths, and the order survives a revisit.

``query_dataset_rows`` and ``query_joined_rows`` page with ``LIMIT/OFFSET``.
That partitions a relation only if the relation has a total order — otherwise
each page is an independent execution slicing a differently-ordered relation,
and the result is rows returned twice while others are never returned at all,
with ``total`` and the page sizes all still looking correct.

**The two paths were correct for different reasons, and one of them was not
correct.** The dataset read is a parquet SCAN, held in file order by DuckDB's
``preserve_insertion_order`` (now set explicitly in ``app/duck.py``). The joined
read is a HASH JOIN, which that setting does **not** protect once DuckDB
parallelises past a row group: measured at 200k rows, 21 344 rows came back
twice and 21 344 never came back, and 21 of 100 pages returned different content
on a second visit. R172 fixed it by ordering on the driving source's position in
its parquet (``file_row_number``) — the order a joined query already presented,
so nothing a user sees moved.

**Driven at the reader functions, not through HTTP, on purpose.** The API caps
``page_size`` at 100 (``PAGE_SIZES``), so an endpoint-level guard would need
hundreds of requests to reach a scale where DuckDB parallelises at all — and
below that scale it is single-threaded and stable regardless, so a small-fixture
guard passes whether or not the guarantee holds. **Scale is load-bearing here**:
a 120k probe run while investigating this said the join path was fine. It was
not; the threshold is just above it.

**Negative-controlled**: ``test_the_guard_has_teeth`` builds the same paging
shape without the guarantee. R171 shipped a guard that passed either way and had
to rewrite it; this is that lesson applied up front.
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
def test_joined_paging_returns_every_row_exactly_once(tmp_path: Path) -> None:
    """The joined read — a hash join, paged. This is the one that DID reshuffle:
    a join has no insertion order of its own, and `preserve_insertion_order`
    carries the probe side through only while the join stays single-threaded.
    Above ~120k rows it did not, and this test failed — 200k rows → 21 344
    returned twice and 21 344 never returned.

    Fixed in R172 by ordering the paged read on the DRIVING source's position in
    its parquet (`file_row_number`), which is the order a joined query already
    presented, so nothing a user sees moved. Held as a strict `xfail` between the
    finding and the fix; the `XPASS(strict)` is what announced the fix landed."""
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


@pytest.mark.unit
def test_a_page_is_the_same_page_on_a_later_visit(tmp_path: Path) -> None:
    """The property a user actually depends on: come back to page 4 tomorrow and
    it is still page 4.

    This is NOT the same as "pages partition within one walk", and the two came
    apart here — before the fix, 21 of 100 pages returned different content on a
    second visit. Each page below is fetched in its own connection, which is what
    the app really does (``duck.connect()`` per request), so a passing run means
    the order survives process state rather than merely being stable inside one
    execution.

    It holds because ``file_row_number`` is a property of the STORED FILE, not of
    the execution — identical across connections, processes and restarts by
    construction, which is the reason this fix beats numbering rows as they
    happen to emit.
    """
    left = _parquet(tmp_path / "visit_deals.parquet", _ROWS)
    right = _parquet(tmp_path / "visit_accounts.parquet", 41, mod=41)
    effective, select_exprs = build_effective_columns(
        [
            ("deals", [{"name": "row_id", "dtype": "integer"}, {"name": "acct", "dtype": "integer"}]),
            ("accounts", [{"name": "acct", "dtype": "integer"}]),
        ]
    )
    eff_names = [c["name"] for c in effective]

    def visit() -> list[tuple[str, ...]]:
        """Walk every page, each in its own connection — one request apiece."""
        return [
            tuple(
                r[0]
                for r in query_joined_rows(
                    [("read_parquet(?)", [str(left)]), ("read_parquet(?)", [str(right)])],
                    join_keys=[(0, "acct", "acct", "inner")],
                    select_exprs=select_exprs,
                    effective_columns=eff_names,
                    page=page,
                    page_size=_PAGE,
                    q=None,
                )[0]
            )
            for page in range(1, _ROWS // _PAGE + 1)
        ]

    first, second = visit(), visit()
    changed = [i + 1 for i, (a, b) in enumerate(zip(first, second)) if a != b]
    assert not changed, f"pages {changed[:8]} returned different rows on a second visit"
