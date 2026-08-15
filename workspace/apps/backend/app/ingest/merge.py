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

from app import duck

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


def _q_lit(s: str) -> str:
    """DuckDB string-literal quoting for a VALUE (vs `_q_path` for a path)."""
    return "'" + s.replace("'", "''") + "'"


def _cur_select_sql(
    incoming_cols: list[dict[str, str]],
    cur_names: set[str],
    provenance_backfill: tuple[str, str] | None,
    provenance_rename: tuple[str, str] | None = None,
) -> str:
    """The committed-side (`cur`) projection reconciling kept rows to the incoming
    schema (D5 incoming-wins): CAST an existing committed column into the incoming
    dtype; NULL-fill a column the committed side lacks.

    R156 exception — the provenance column, when absent from committed (a pre-R156
    dataset's first provenance-bearing refresh), is BACKFILLED with the committed
    dataset's own source filename literal instead of NULL, so no kept row is left
    origin-null.

    R158 exception — ``provenance_rename = (old, new)`` handles a refresh collision
    where the incoming file carries a source column named like the committed
    provenance column: the output ``new`` column reads committed ``old`` (the real
    filenames are preserved under the suffixed name), and the output ``old`` column
    (now the incoming file's user data) is NULL for committed rows, which never had
    it. Checked BEFORE the name-match branch because ``old`` IS in ``cur_names``."""
    rename_old, rename_new = provenance_rename if provenance_rename is not None else (None, None)
    parts: list[str] = []
    for c in incoming_cols:
        name = c["name"]
        duck = _DTYPE_TO_DUCK[c["dtype"]]
        if provenance_rename is not None and name == rename_new:
            parts.append(f"CAST(cur.{_q(rename_old)} AS {duck}) AS {_q(rename_new)}")
        elif provenance_rename is not None and name == rename_old:
            parts.append(f"CAST(NULL AS {duck}) AS {_q(name)}")
        elif name in cur_names:
            parts.append(f"CAST(cur.{_q(name)} AS {duck}) AS {_q(name)}")
        elif provenance_backfill is not None and name == provenance_backfill[0]:
            parts.append(f"CAST({_q_lit(provenance_backfill[1])} AS VARCHAR) AS {_q(name)}")
        else:
            parts.append(f"CAST(NULL AS {duck}) AS {_q(name)}")
    return ", ".join(parts)


def merge_parquets(
    committed: Path,
    incoming: Path,
    merged_out: Path,
    *,
    key: list[str],
    incoming_cols: list[dict[str, str]],
    provenance_backfill: tuple[str, str] | None = None,
    provenance_rename: tuple[str, str] | None = None,
) -> dict[str, int]:
    """Write keep-latest-per-key(committed, incoming) to ``merged_out``.

    Returns the merge report ``{"updated", "inserted", "kept"}`` — updated =
    incoming rows whose key superseded committed row(s), inserted = incoming
    rows with a new key, kept = committed rows untouched by the incoming
    file; their sum is the merged row count. Raises MergeDuplicateKeysError
    (before any write) and MergeCastError. ``provenance_backfill`` (R156) =
    ``(column, value)`` filling that column for kept committed rows when it is
    absent from the committed schema; ``provenance_rename`` (R158) = ``(old, new)``
    remapping committed provenance on a refresh collision (see ``_cur_select_sql``).
    """
    with duck.connect() as con:
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
        cur_select = _cur_select_sql(incoming_cols, cur_names, provenance_backfill, provenance_rename)

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


def append_parquets(
    committed: Path,
    incoming: Path,
    appended_out: Path,
    *,
    incoming_cols: list[dict[str, str]],
    provenance_backfill: tuple[str, str] | None = None,
    provenance_rename: tuple[str, str] | None = None,
) -> dict[str, int]:
    """R155 — keyless UNION ALL(committed, incoming) into ``appended_out``.

    Every committed row is KEPT and every incoming row is APPENDED — no key,
    no dedup, duplicates preserved by design (append never picks a winner —
    that is merge's job). Committed rows are reconciled to the incoming schema
    with the SAME D5 rule as merge (CAST into the incoming dtype, NULL-fill an
    added column, drop a removed one), so the result schema = the incoming
    table's. Returns ``{"appended", "total"}``: appended = incoming row count,
    total = committed + incoming (the new row count). Raises MergeCastError if
    a kept committed value can't cast into the incoming schema (loud, never a
    silent TRY_CAST NULL) — the one shared failure mode with merge.
    """
    with duck.connect() as con:
        con.execute(f"CREATE VIEW inc AS SELECT * FROM read_parquet({_q_path(incoming)})")
        con.execute(f"CREATE VIEW cur AS SELECT * FROM read_parquet({_q_path(committed)})")

        cur_names = {name for (name, *_rest) in con.execute("DESCRIBE cur").fetchall()}
        inc_select = ", ".join(f"inc.{_q(c['name'])}" for c in incoming_cols)
        cur_select = _cur_select_sql(incoming_cols, cur_names, provenance_backfill, provenance_rename)

        incoming_total = con.execute("SELECT count(*) FROM inc").fetchone()[0]
        committed_total = con.execute("SELECT count(*) FROM cur").fetchone()[0]

        try:
            con.execute(
                f"COPY (SELECT {cur_select} FROM cur "  # noqa: S608 — idents quoted via _q
                f"UNION ALL "
                f"SELECT {inc_select} FROM inc) "
                f"TO {_q_path(appended_out)} (FORMAT 'parquet')"
            )
        except duckdb.Error as err:
            raise MergeCastError(str(err)) from err
        return {"appended": int(incoming_total), "total": int(committed_total + incoming_total)}


def column_min_max(parquet: Path, field: str) -> tuple | None:
    """R155 — ``(min, max)`` of ``field`` in ``parquet`` (typed date/datetime
    objects), or ``None`` when the table is empty / the column is all-NULL. The
    range primitive behind the append-overlap advisory."""
    with duck.connect() as con:
        lo, hi = con.execute(
            f"SELECT min({_q(field)}), max({_q(field)}) FROM read_parquet({_q_path(parquet)})"  # noqa: S608 — idents quoted
        ).fetchone()
    return None if lo is None or hi is None else (lo, hi)
