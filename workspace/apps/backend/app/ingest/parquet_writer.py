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

R143 — `dtype_targets` (upload.md §Commit dtype semantics): the
formatless `column_overrides` (string / integer / float / boolean)
are APPLIED here, at the write, so the parquet's physical dtype
equals the committed `columns_json` dtype. A non-NULL cell that
cannot cast raises `CoercionError` (→ the router's typed 422)
instead of the pre-R143 unhandled `ArrowInvalid` 500. `→string`
never fails by construction.

R144 — date/datetime join the coerced set (upload.md §Date and
datetime coercion): a `date`/`datetime` override's Java-style
`format` is translated to strptime (`translate_format`) and string
cells are PARSED at the write, landing as physical DATE/TIMESTAMP.
Tokens outside the six-token subset raise `FormatUnsupportedError`
(→ the router's 422, before any write).
"""

from __future__ import annotations

import math
import re
from datetime import date as dt_date
from datetime import datetime as dt_datetime
from datetime import time as dt_time
from pathlib import Path

import duckdb
import pandas as pd
import pyarrow as pa


_RANGE_RE = re.compile(r"^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$")

# The dtypes the commit path casts for real: the formatless four (R143)
# + date/datetime via format-token translation (R144).
COERCIBLE_DTYPES = frozenset({"string", "integer", "float", "boolean", "date", "datetime"})

# R144 — the supported Java-`DateTimeFormatter` token subset → strptime.
# The scope brake (upload.md §Date and datetime coercion): anything
# alphabetic outside this map is rejected loudly, never silently kept.
_FORMAT_TOKENS = {
    "yyyy": "%Y",
    "MM": "%m",
    "dd": "%d",
    "HH": "%H",
    "mm": "%M",
    "ss": "%S",
}
_TIME_TOKENS = frozenset({"HH", "mm", "ss"})
_ALPHA_RUN_RE = re.compile(r"[A-Za-z]+")


class FormatUnsupportedError(ValueError):
    """R144 — a date/datetime override `format` uses a token outside the
    subset (or a time token under a `date` target). Raised at commit
    VALIDATION, before any write."""

    def __init__(self, fmt: str, token: str) -> None:
        super().__init__(f"format_unsupported: token {token!r} in {fmt!r}")
        self.fmt = fmt
        self.token = token


def translate_format(fmt: str, *, dtype: str) -> str:
    """Translate a Java-style date format to strptime (`dd-MM-yyyy` → `%d-%m-%Y`).

    Only the six-token subset translates; any other alphabetic run raises
    `FormatUnsupportedError`, as does a time token when `dtype` is `date`
    (day-level truncation of a timestamp is the bucket step's job — ingest
    never silently drops a time part). Non-alphabetic separators pass
    through as literals (`%` escaped — it has no meaning in Java formats
    but would leak as a strptime directive).
    """
    out: list[str] = []
    pos = 0
    for m in _ALPHA_RUN_RE.finditer(fmt):
        token = m.group(0)
        directive = _FORMAT_TOKENS.get(token)
        if directive is None or (dtype == "date" and token in _TIME_TOKENS):
            raise FormatUnsupportedError(fmt, token)
        out.append(fmt[pos : m.start()].replace("%", "%%"))
        out.append(directive)
        pos = m.end()
    out.append(fmt[pos:].replace("%", "%%"))
    return "".join(out)


# How many offending cells a CoercionError carries (contract: first 5).
_CELL_LIMIT = 5


class CoercionError(Exception):
    """R143 — a dtype cast hit non-NULL cells that cannot convert.

    Carries what the `coercion_failed` envelope needs: the column, the
    target dtype, the first `_CELL_LIMIT` offending cells as
    `(row, value)` with 1-indexed SOURCE-FILE rows (header/skipped rows
    included — the number the user sees in Excel; R144), and the total count.
    """

    def __init__(self, column: str, dtype: str, cells: list[tuple[int, str]], total_failed: int) -> None:
        super().__init__(f"coercion_failed: {column} → {dtype} ({total_failed} cell(s))")
        self.column = column
        self.dtype = dtype
        self.cells = cells
        self.total_failed = total_failed


_BOOL_LEXICON = {
    "true": True,
    "false": False,
    "1": True,
    "0": False,
    "yes": True,
    "no": False,
}


def _cell_to_string(v: object) -> str:
    """Lossless-ish display cast (matches how the wizard previews cells):
    integral floats drop the `.0` (Excel numerics arrive as floats),
    booleans lowercase to match DuckDB's VARCHAR cast."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and not math.isnan(v) and v.is_integer():
        return str(int(v))
    return str(v)


def _is_null_cell(v: object) -> bool:
    return v is None or v is pd.NaT or (isinstance(v, float) and math.isnan(v))


def _cast_integer(v: object) -> int:
    if isinstance(v, bool):
        return int(v)
    f = float(str(v).strip())  # raises ValueError on non-numeric text
    if not f.is_integer():
        raise ValueError(v)
    return int(f)


def _cast_float(v: object) -> float:
    if isinstance(v, bool):
        raise ValueError(v)
    return float(str(v).strip())


def _cast_boolean(v: object) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)) and v in (0, 1):
        return bool(v)
    s = str(v).strip().lower()
    if s in _BOOL_LEXICON:
        return _BOOL_LEXICON[s]
    raise ValueError(v)


# dtype → (cell caster, pandas nullable dtype). `→string` never raises.
_CASTERS: dict[str, tuple] = {
    "string": (_cell_to_string, "string"),
    "integer": (_cast_integer, "Int64"),
    "float": (_cast_float, "Float64"),
    "boolean": (_cast_boolean, "boolean"),
}

# R144 — arrow-backed date dtype so an all-NULL/date column still lands as
# physical DATE (a plain object series of `datetime.date` would too, but
# degrades to a null-typed column when every cell is NULL).
_DATE_PANDAS_DTYPE = pd.ArrowDtype(pa.date32())


def _make_datetime_caster(fmt: str):
    """R144 — datetime cells: native pass-through, strings parse via the
    TRANSLATED format (whole-cell strict; `strptime` rejects any residue)."""

    def cast(v: object) -> dt_datetime:
        if isinstance(v, dt_datetime):  # includes pd.Timestamp (native Excel cells)
            return v
        if isinstance(v, dt_date):
            return dt_datetime(v.year, v.month, v.day)
        if isinstance(v, str):
            return dt_datetime.strptime(v.strip(), fmt)  # noqa: DTZ007 — naive by design (upload.md: timezone out of scope)
        raise ValueError(v)

    return cast


def _make_date_caster(fmt: str):
    """R144 — date cells: a NATIVE datetime with a non-midnight time part
    FAILS (the user should pick `datetime`; ingest never silently truncates);
    strings parse via the translated date-only format."""

    def cast(v: object) -> dt_date:
        if isinstance(v, dt_datetime):
            if v.time() != dt_time(0, 0):
                raise ValueError(v)
            return v.date()
        if isinstance(v, dt_date):
            return v
        if isinstance(v, str):
            # fmt carries date tokens only (translate_format guards) → the
            # parsed time part is midnight by construction.
            return dt_datetime.strptime(v.strip(), fmt).date()  # noqa: DTZ007 — naive by design
        raise ValueError(v)

    return cast


def _resolve_caster(dtype: str, fmt: str | None) -> tuple:
    """The (cell caster, pandas dtype) pair for a target dtype. date/datetime
    casters are built per column from the translated `format` (R144); an
    absent format still passes native temporal cells through — only string
    cells then fail (honest: nothing guesses a format)."""
    if dtype == "datetime":
        return _make_datetime_caster(fmt or ""), "datetime64[ns]"
    if dtype == "date":
        return _make_date_caster(fmt or ""), _DATE_PANDAS_DTYPE
    return _CASTERS[dtype]


# Conformance fast-path: a column whose physical dtype already satisfies its
# committed dtype skips the per-cell pass entirely (the common case — only
# mixed/object columns and real overrides pay the loop). `date` never
# fast-paths: pandas reads temporal cells as datetime64, and a datetime64
# column under a `date` target must still be checked cell-by-cell for
# non-midnight time parts (R144).
_CONFORMS = {
    "string": lambda s: isinstance(s.dtype, pd.StringDtype),
    "integer": pd.api.types.is_integer_dtype,
    "float": pd.api.types.is_float_dtype,
    "boolean": pd.api.types.is_bool_dtype,
    "datetime": pd.api.types.is_datetime64_any_dtype,
    "date": lambda _s: False,
}


def _coerce_column(
    series: pd.Series, column: str, dtype: str, fmt: str | None = None, row_offset: int = 0
) -> pd.Series:
    """Cast one column; single pass. Raise CoercionError on any failure.

    NULL cells pass through as NULL (nullable pandas dtypes). Reported rows
    are SOURCE-FILE rows (R144, dogfood: a data-row number sent the user to
    the wrong Excel line): `row_offset` carries the header + skipped/range
    rows the caller consumed, so `position + 1 + offset` is the row number
    the user sees in Excel / a CSV editor.
    `fmt` is the TRANSLATED strptime format (date/datetime targets, R144).
    """
    caster, pandas_dtype = _resolve_caster(dtype, fmt)
    casted: list[object] = []
    failed: list[tuple[int, str]] = []
    total_failed = 0
    for pos, v in enumerate(series.tolist()):
        if _is_null_cell(v):
            casted.append(None)
            continue
        try:
            casted.append(caster(v))
        except (ValueError, TypeError):
            total_failed += 1
            if len(failed) < _CELL_LIMIT:
                failed.append((pos + 1 + row_offset, _cell_to_string(v)))
            casted.append(None)
    if failed:
        raise CoercionError(column, dtype, failed, total_failed)
    return pd.Series(casted, index=series.index, dtype=pandas_dtype)


def _coerce_dataframe(
    df: pd.DataFrame,
    dtype_targets: dict[str, str],
    dtype_formats: dict[str, str] | None = None,
    row_offset: int = 0,
) -> pd.DataFrame:
    """Apply R143/R144 dtype targets to `df`; raise CoercionError on failure.

    Columns already conforming to their committed dtype are skipped
    without a scan; only non-conforming (mixed/object or genuinely
    overridden) columns pay the per-cell pass. `dtype_formats` carries the
    TRANSLATED strptime format per date/datetime column (R144); `row_offset`
    maps reported rows to SOURCE-FILE rows (see `_coerce_column`).
    """
    for col, dtype in dtype_targets.items():
        if col not in df.columns:  # unknown columns are 409-guarded upstream
            continue
        if _CONFORMS[dtype](df[col]):
            continue
        df[col] = _coerce_column(df[col], col, dtype, (dtype_formats or {}).get(col), row_offset)
    return df


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


# DuckDB physical type → the committed dtype it already satisfies. A DECIMAL
# is float-conforming; every integer width is integer-conforming; VARCHAR is
# string-conforming (str→str is the identity under `_cell_to_string`).
_DUCK_CONFORMS: dict[str, str] = {
    "TINYINT": "integer",
    "SMALLINT": "integer",
    "INTEGER": "integer",
    "BIGINT": "integer",
    "HUGEINT": "integer",
    "UTINYINT": "integer",
    "USMALLINT": "integer",
    "UINTEGER": "integer",
    "UBIGINT": "integer",
    "FLOAT": "float",
    "REAL": "float",
    "DOUBLE": "float",
    "BOOLEAN": "boolean",
    "VARCHAR": "string",
    # R144 — DuckDB-inferred temporal columns already satisfy their committed
    # dtype (the same mapping parse_csv uses), so no-override commits keep
    # the pure-DuckDB COPY path.
    "DATE": "date",
    "TIMESTAMP": "datetime",
    "TIMESTAMP_S": "datetime",
    "TIMESTAMP_MS": "datetime",
    "TIMESTAMP_NS": "datetime",
}


def _nonconforming_targets(
    schema_rows: list[tuple],
    name_map: dict[str, str],
    dtype_targets: dict[str, str] | None,
) -> dict[str, str]:
    """Filter `dtype_targets` (keyed by committed name) down to columns whose
    DuckDB-inferred type does not already satisfy the target dtype."""
    if not dtype_targets:
        return {}
    duck_type_by_committed = {name_map[raw]: dtype.upper() for (raw, dtype, *_rest) in schema_rows}
    out: dict[str, str] = {}
    for committed, target in dtype_targets.items():
        duck = duck_type_by_committed.get(committed, "")
        base = duck.split("(", 1)[0]  # DECIMAL(18,3) → DECIMAL
        conforms = _DUCK_CONFORMS.get(base) == target or (base == "DECIMAL" and target == "float")
        if not conforms:
            out[committed] = target
    return out


def write_csv_to_parquet(
    src: Path,
    dst: Path,
    *,
    skip_rows: int,
    has_header: bool,
    kept_columns: list[str],
    dtype_targets: dict[str, str] | None = None,
    dtype_formats: dict[str, str] | None = None,
) -> None:
    """Read a CSV via DuckDB and write the full table to parquet.

    `skip_rows` + `has_header` mirror `parse_csv`'s contract so the
    parquet schema lines up with the committed `columns_json`.
    `kept_columns` is the post-exclusion list of column names (in
    canonical order); the parquet only contains those columns.
    R143 — `dtype_targets` columns whose DuckDB-inferred type does NOT
    already conform detour through the SHARED pandas coercion
    (`_coerce_dataframe`, same cell lexicon as the Excel path) before
    the parquet write; when every target conforms (the common
    no-override case — DuckDB columns are single-typed), the original
    pure-DuckDB COPY path runs unchanged.
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
        pending = _nonconforming_targets(schema_rows, name_map, dtype_targets)
        if pending:
            # R143 — detour through the shared pandas coercion so CSV and
            # Excel apply the SAME cell lexicon, then parquet via pandas.
            df = con.execute(f"SELECT {select_list} FROM tmp").fetch_df()  # noqa: S608 — idents quoted above
            # Reported rows = SOURCE-FILE line numbers: skipped lines + header.
            row_offset = int(skip_rows) + (1 if has_header else 0)
            df = _coerce_dataframe(df, pending, dtype_formats, row_offset)
            df.to_parquet(dst, index=False)
            return
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
    dtype_targets: dict[str, str] | None = None,
    dtype_formats: dict[str, str] | None = None,
) -> None:
    """Read an Excel sheet (full table) and write to parquet.

    Mirrors `parse_sheet`'s read shape exactly — same engine,
    same `usecols` / `skiprows` / `nrows` derivation from
    `range_`, same header handling. Only difference: no
    `SAMPLE_LIMIT` truncation.
    R143 — `dtype_targets` applies the formatless overrides on the
    DataFrame before the parquet write (`_coerce_dataframe`); a
    mixed-type column overridden `→string` now commits instead of
    dying as an `ArrowInvalid` 500 inside `to_parquet`.
    """
    kwargs: dict[str, object] = {
        "sheet_name": sheet,
        "header": 0 if has_header else None,
        "engine": "openpyxl",
    }
    row_first = 1  # the sheet row the read starts at (range override below)
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
    if dtype_targets:
        # Reported rows = SHEET rows: rows above the range start + the header.
        row_offset = (row_first - 1) + (1 if has_header else 0)
        df = _coerce_dataframe(df, dtype_targets, dtype_formats, row_offset)
    df.to_parquet(dst, index=False)
