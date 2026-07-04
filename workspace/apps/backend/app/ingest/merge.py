"""Merge-on-key parquet reconciliation — R147, upload.md § Refresh merge mode.

Keep-latest-per-key over two parquet tables: every INCOMING row supersedes
all committed rows sharing its key (incoming wins, whole row — D3);
incoming-only keys insert; committed-only keys are KEPT — the difference
from replace. Result schema = the incoming table's schema (D5): kept
committed rows NULL-fill added columns, CAST loudly into a drifted
column's incoming dtype, and drop removed columns.

Key existence/dtype guards are the CALLER's job (the router 422s before
any write) — by the time this runs, every key column exists on both sides
with a matching committed dtype (the F5×F2 false-non-overlap stop).
"""

from __future__ import annotations

from pathlib import Path

import duckdb

# Committed dtype → the canonical DuckDB physical type, for casting kept
# committed rows into the incoming schema and typed NULL-fill of added
# columns. The inverse direction of parquet_writer._DUCK_CONFORMS.
_DTYPE_TO_DUCK: dict[str, str] = {
    "string": "VARCHAR",
    "integer": "BIGINT",
    "float": "DOUBLE",
    "boolean": "BOOLEAN",
    "date": "DATE",
    "datetime": "TIMESTAMP",
}

_SAMPLE_KEYS_MAX = 5


class MergeDuplicateKeysError(Exception):
    """The incoming table has >1 row for at least one key value (D2 —
    loud stop; file row order is not time, so "last wins" would be a
    silent fiction)."""

    def __init__(self, duplicate_key_count: int, sample_keys: list[str]) -> None:
        self.duplicate_key_count = duplicate_key_count
        self.sample_keys = sample_keys
        super().__init__(f"merge_duplicate_keys: {duplicate_key_count} duplicated key value(s)")


class MergeCastError(Exception):
    """A kept committed value failed the cast into the incoming schema —
    a drifted NON-key column dtype whose old values can't convert. Loud,
    never a silent NULL (no TRY_CAST by design)."""


def _q(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


def _q_path(p: Path) -> str:
    return "'" + str(p).replace("'", "''") + "'"


def merge_parquets(
    committed: Path,
    incoming: Path,
    merged_out: Path,
    *,
    key: list[str],
    incoming_cols: list[dict[str, str]],
) -> dict[str, int]:
    """Write keep-latest-per-key(committed, incoming) to ``merged_out``.

    Returns the merge report ``{"updated", "inserted", "kept"}`` — updated =
    incoming rows whose key superseded committed row(s), inserted = incoming
    rows with a new key, kept = committed rows untouched by the incoming
    file; their sum is the merged row count. Raises MergeDuplicateKeysError
    (before any write) and MergeCastError.
    """
    with duckdb.connect(":memory:") as con:
        # Paths come from dataset_dir()/temp staging (id-pattern segments);
        # literal-quoting mirrors parquet_writer's COPY defense.
        con.execute(f"CREATE VIEW inc AS SELECT * FROM read_parquet({_q_path(incoming)})")
        con.execute(f"CREATE VIEW cur AS SELECT * FROM read_parquet({_q_path(committed)})")

        key_list = ", ".join(_q(k) for k in key)
        # D2 — duplicate incoming keys are a loud stop. GROUP BY treats
        # NULLs as equal, so an all-NULL duplicated key also trips.
        dup_rows = con.execute(
            f"SELECT {key_list}, count(*) AS n FROM inc "  # noqa: S608 — idents quoted via _q
            f"GROUP BY {key_list} HAVING count(*) > 1 ORDER BY n DESC, {key_list}"
        ).fetchall()
        if dup_rows:
            samples = [
                " · ".join("NULL" if v is None else str(v) for v in r[:-1])
                for r in dup_rows[:_SAMPLE_KEYS_MAX]
            ]
            raise MergeDuplicateKeysError(len(dup_rows), samples)

        cur_names = {name for (name, *_rest) in con.execute("DESCRIBE cur").fetchall()}
        match = " AND ".join(f"inc.{_q(k)} IS NOT DISTINCT FROM cur.{_q(k)}" for k in key)

        inc_select = ", ".join(f"inc.{_q(c['name'])}" for c in incoming_cols)
        cur_select = ", ".join(
            f"CAST(cur.{_q(c['name'])} AS {_DTYPE_TO_DUCK[c['dtype']]}) AS {_q(c['name'])}"
            if c["name"] in cur_names
            else f"CAST(NULL AS {_DTYPE_TO_DUCK[c['dtype']]}) AS {_q(c['name'])}"
            for c in incoming_cols
        )

        updated = con.execute(
            f"SELECT count(*) FROM inc WHERE EXISTS (SELECT 1 FROM cur WHERE {match})"  # noqa: S608
        ).fetchone()[0]
        incoming_total = con.execute("SELECT count(*) FROM inc").fetchone()[0]
        kept = con.execute(
            f"SELECT count(*) FROM cur WHERE NOT EXISTS (SELECT 1 FROM inc WHERE {match})"  # noqa: S608
        ).fetchone()[0]

        try:
            con.execute(
                f"COPY (SELECT {inc_select} FROM inc "  # noqa: S608
                f"UNION ALL "
                f"SELECT {cur_select} FROM cur "
                f"WHERE NOT EXISTS (SELECT 1 FROM inc WHERE {match})) "
                f"TO {_q_path(merged_out)} (FORMAT 'parquet')"
            )
        except duckdb.Error as err:
            raise MergeCastError(str(err)) from err
        return {"updated": int(updated), "inserted": int(incoming_total - updated), "kept": int(kept)}
