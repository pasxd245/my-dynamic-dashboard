"""R183 — relationship self-check.

A relationship is DECLARED (left.col ↔ right.col, a cardinality); the data
may disagree. This measures, over the two committed parquets, what the keys
actually do — how many rows on each side find a partner, how many keys repeat
on each side — and names the observed cardinality next to the declared one.
A mismatch is a flag, never a block (purpose.md key design decision #5:
version, flag, adapt): the join still runs; the reader knows that it will
multiply rows, or that part of one side has no partner.

One DuckDB query over both files. Keys compare as text (the same CAST the join
uses); a NULL / empty key never matches.
"""

from __future__ import annotations

from pathlib import Path

from app import duck
from app.ingest.merge import _q, _q_path


def check_relationship(left_parquet: Path, left_col: str, right_parquet: Path, right_col: str) -> dict:
    sql = f"""
        WITH l AS (SELECT CAST({_q(left_col)} AS VARCHAR) AS k FROM read_parquet({_q_path(left_parquet)})),
             r AS (SELECT CAST({_q(right_col)} AS VARCHAR) AS k FROM read_parquet({_q_path(right_parquet)})),
             lk AS (SELECT k, count(*) AS n FROM l WHERE k IS NOT NULL AND k <> '' GROUP BY k),
             rk AS (SELECT k, count(*) AS n FROM r WHERE k IS NOT NULL AND k <> '' GROUP BY k)
        SELECT
          (SELECT count(*) FROM l) AS left_rows,
          (SELECT count(*) FROM r) AS right_rows,
          (SELECT count(*) FROM l WHERE k IN (SELECT k FROM rk)) AS left_matched,
          (SELECT count(*) FROM r WHERE k IN (SELECT k FROM lk)) AS right_matched,
          (SELECT count(*) FROM lk) AS left_keys,
          (SELECT count(*) FROM rk) AS right_keys,
          (SELECT coalesce(max(n), 0) FROM lk) AS left_max_per_key,
          (SELECT coalesce(max(n), 0) FROM rk) AS right_max_per_key
    """  # noqa: S608 — identifiers and paths quoted by the merge helpers
    with duck.connect() as con:
        row = con.execute(sql).fetchone()
    left_rows, right_rows, left_matched, right_matched, left_keys, right_keys, left_max, right_max = (
        int(v) for v in row
    )
    left_side = "one" if left_max <= 1 else "many"
    right_side = "one" if right_max <= 1 else "many"
    return {
        "leftRows": left_rows,
        "rightRows": right_rows,
        "leftMatchedRows": left_matched,
        "rightMatchedRows": right_matched,
        "leftUnmatchedRows": left_rows - left_matched,
        "rightUnmatchedRows": right_rows - right_matched,
        "leftCoverage": round(left_matched / left_rows, 6) if left_rows else 0.0,
        "rightCoverage": round(right_matched / right_rows, 6) if right_rows else 0.0,
        "leftDistinctKeys": left_keys,
        "rightDistinctKeys": right_keys,
        "leftMaxPerKey": left_max,
        "rightMaxPerKey": right_max,
        "observedCardinality": f"{left_side}_to_{right_side}",
        # Joining left → right (the query hop) multiplies a left row when its key
        # repeats on the right; and the other way round.
        "multipliesLeft": right_max > 1,
        "multipliesRight": left_max > 1,
    }
