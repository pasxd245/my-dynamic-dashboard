"""R178 — date coverage profiling.

For every `date` / `datetime` column of a committed parquet, the earliest and
latest non-blank value and the share of blank rows. Computed by the server at
commit and at every refresh (replace / merge / append), stored in
`datasets.columns_json` next to the column, and served on the dataset noun —
so a reader can tell what period a dataset covers before trusting a number
built on it (purpose.md key design decision #5: version, flag, adapt — not
reject).

Reads the parquet DuckDB already wrote; never touches the data.
"""

from __future__ import annotations

from pathlib import Path

from app import duck
from app.ingest.merge import _q, _q_path

TEMPORAL_DTYPES = frozenset({"date", "datetime"})


def _iso(v: object) -> str:
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def profile_date_coverage(parquet: Path, cols: list[dict]) -> None:
    """Attach `coverage` to every temporal column dict in `cols`, in place.

    One query per dataset: `min`, `max` and a NULL count per temporal column
    plus the row count. A column that is all blank gets `{"blankShare": 1.0}`
    with no min / max; an empty table gets `blankShare` 0.0 and no min / max.
    Non-temporal columns are left untouched (and keep any stale `coverage`
    out: a column whose dtype changed on refresh drops it)."""
    temporal = [c for c in cols if c.get("dtype") in TEMPORAL_DTYPES]
    for c in cols:
        if c.get("dtype") not in TEMPORAL_DTYPES:
            c.pop("coverage", None)
    if not temporal:
        return
    selects = ["count(*)"]
    for c in temporal:
        q = _q(c["name"])
        selects.append(f"min({q})")
        selects.append(f"max({q})")
        selects.append(f"count(*) FILTER (WHERE {q} IS NULL)")
    with duck.connect() as con:
        row = con.execute(
            f"SELECT {', '.join(selects)} FROM read_parquet({_q_path(parquet)})"  # noqa: S608 — idents quoted
        ).fetchone()
    total = int(row[0])
    for i, c in enumerate(temporal):
        lo, hi, blanks = row[1 + i * 3], row[2 + i * 3], int(row[3 + i * 3])
        cov: dict = {"blankShare": round(blanks / total, 6) if total else 0.0}
        if lo is not None and hi is not None:
            cov["min"] = _iso(lo)
            cov["max"] = _iso(hi)
        c["coverage"] = cov
