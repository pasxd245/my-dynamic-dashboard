"""Full-table parquet writers — R35.

R34 → R35 boundary: until R34, the batch-commit handler wrote
`parsed.parquet` from `ParseResult.sample_rows` (capped at 10).
R35 fixes that — every committed dataset's parquet now holds the
**full** parsed table so the new rows-GET endpoint can serve
real data.

Two paths:

- CSV → DuckDB `read_csv_auto` → `COPY … TO ? (FORMAT 'parquet')`.
  Uniform with the wizard's `parse_csv` (same duckdb engine, same
  `read_csv_auto` invocation shape); the dtypes the wizard
  inferred are the dtypes the parquet preserves.
- Excel → pandas `read_excel(..., engine='openpyxl')` (full, not
  sampled) → `DataFrame.to_parquet(...)`. DuckDB does not natively
  read xlsx; pandas + openpyxl is the proven path used by
  `parse_sheet`.

The kept-columns list (post-`excluded_columns`) is applied at
write time, so the parquet schema matches the dataset's
committed `columns_json` exactly.
"""

from __future__ import annotations

import re
from pathlib import Path

import duckdb
import pandas as pd


_RANGE_RE = re.compile(r"^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$")


def _quote_ident(name: str) -> str:
    """DuckDB SQL identifier quoting — double any embedded `"`."""
    return '"' + name.replace('"', '""') + '"'


def _quote_string_literal(s: str) -> str:
    """DuckDB string literal quoting — wrap in `'` and double embedded `'`.

    Used for `COPY … TO '<path>'` where DuckDB requires a literal,
    not a `?` bind. The `dst` paths we pass are server-controlled
    (built from `dataset_dir(...)`), so the only realistic embedded
    quote would come from a pathological workspace_id/dataset_id —
    both of which match `^(ws|ds)_[0-9a-f]{8}$` and contain no quotes.
    Defending anyway is cheap.
    """
    return "'" + s.replace("'", "''") + "'"


def write_csv_to_parquet(
    src: Path,
    dst: Path,
    *,
    skip_rows: int,
    has_header: bool,
    kept_columns: list[str],
) -> None:
    """Read a CSV via DuckDB and write the full table to parquet.

    `skip_rows` + `has_header` mirror `parse_csv`'s contract so the
    parquet schema lines up with the committed `columns_json`.
    `kept_columns` is the post-exclusion list of column names (in
    canonical order); the parquet only contains those columns.
    """
    with duckdb.connect(":memory:") as con:
        con.execute(
            "CREATE TABLE tmp AS SELECT * FROM read_csv_auto(?, skip = ?, header = ?)",
            [str(src), int(skip_rows), bool(has_header)],
        )
        schema_rows = con.execute("DESCRIBE tmp").fetchall()
        raw_names = [name for (name, *_rest) in schema_rows]
        if has_header:
            # Source column name → committed column name is identity.
            name_map = {n: n for n in raw_names}
        else:
            # parse_csv renames headerless DuckDB defaults to `column1`,
            # `column2`, … (1-indexed). Mirror that mapping when building
            # the SELECT alias list. ALTER TABLE RENAME doesn't work here
            # because DuckDB's `header=false` defaults like `column0` /
            # `column1` collide with our 1-indexed targets.
            name_map = {raw: f"column{i + 1}" for i, raw in enumerate(raw_names)}
        # Build SELECT "raw_name" AS "committed_name" projection, in the
        # canonical kept_columns order, so the parquet schema matches
        # the dataset's committed columns_json one-for-one.
        reverse = {v: k for k, v in name_map.items()}
        select_items = [f"{_quote_ident(reverse[c])} AS {_quote_ident(c)}" for c in kept_columns]
        select_list = ", ".join(select_items)
        dst_literal = _quote_string_literal(str(dst))
        con.execute(f"COPY (SELECT {select_list} FROM tmp) TO {dst_literal} (FORMAT 'parquet')")


def write_excel_to_parquet(
    src: Path,
    dst: Path,
    *,
    sheet: str,
    range_: str | None,
    has_header: bool,
    kept_columns: list[str],
) -> None:
    """Read an Excel sheet (full table) and write to parquet.

    Mirrors `parse_sheet`'s read shape exactly — same engine,
    same `usecols` / `skiprows` / `nrows` derivation from
    `range_`, same header handling. Only difference: no
    `SAMPLE_LIMIT` truncation.
    """
    kwargs: dict[str, object] = {
        "sheet_name": sheet,
        "header": 0 if has_header else None,
        "engine": "openpyxl",
    }
    if range_ is not None:
        m = _RANGE_RE.match(range_)
        if m is None:
            raise ValueError(f"range_invalid: {range_}")
        col_first, row_first, col_last, row_last = (
            m.group(1),
            int(m.group(2)),
            m.group(3),
            int(m.group(4)),
        )
        kwargs["usecols"] = f"{col_first}:{col_last}"
        kwargs["skiprows"] = max(0, row_first - 1)
        kwargs["nrows"] = max(0, row_last - row_first + (0 if has_header else 1))
    df = pd.read_excel(src, **kwargs)
    if not has_header:
        df.columns = [f"column{i + 1}" for i in range(len(df.columns))]
    else:
        df.columns = [str(c).strip() for c in df.columns]
    keep = [c for c in kept_columns if c in df.columns]
    df = df[keep]
    df.to_parquet(dst, index=False)
