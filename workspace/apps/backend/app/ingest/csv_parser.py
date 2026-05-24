"""CSV parse via DuckDB `read_csv_auto`.

Returns columns (name + contract-aligned dtype), row count, and the
first 10 sample rows. DuckDB's auto-inference covers integer / float
/ boolean / date / timestamp; everything else lands as `VARCHAR`
(mapped to `string`).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import duckdb


SAMPLE_LIMIT = 10


Dtype = Literal["string", "integer", "float", "boolean", "date", "datetime"]


_DUCKDB_TO_DTYPE: dict[str, Dtype] = {
    "BIGINT": "integer",
    "INTEGER": "integer",
    "SMALLINT": "integer",
    "TINYINT": "integer",
    "HUGEINT": "integer",
    "UBIGINT": "integer",
    "UINTEGER": "integer",
    "USMALLINT": "integer",
    "UTINYINT": "integer",
    "DOUBLE": "float",
    "FLOAT": "float",
    "REAL": "float",
    "DECIMAL": "float",
    "BOOLEAN": "boolean",
    "DATE": "date",
    "TIMESTAMP": "datetime",
    "TIMESTAMP_S": "datetime",
    "TIMESTAMP_MS": "datetime",
    "TIMESTAMP_NS": "datetime",
}


def _to_dtype(duckdb_type: str) -> Dtype:
    base = duckdb_type.upper().split("(", 1)[0].strip()
    return _DUCKDB_TO_DTYPE.get(base, "string")


@dataclass
class ParseResult:
    columns: list[dict[str, str]]
    row_count: int
    sample_rows: list[list[str | None]]


class CsvParseError(Exception):
    pass


def parse_csv(path: Path) -> ParseResult:
    """Parse a CSV file. Raises `CsvParseError` on unparseable input."""

    if path.stat().st_size == 0:
        raise CsvParseError("empty file")

    try:
        with duckdb.connect(":memory:") as con:
            con.execute(
                "CREATE TABLE tmp AS SELECT * FROM read_csv_auto(?, header = TRUE)",
                [str(path)],
            )
            schema_rows = con.execute("DESCRIBE tmp").fetchall()
            columns = [
                {"name": name, "dtype": _to_dtype(dtype)}
                for (name, dtype, *_rest) in schema_rows
            ]
            (row_count,) = con.execute("SELECT COUNT(*) FROM tmp").fetchone()
            sample = con.execute(
                f"SELECT * FROM tmp LIMIT {SAMPLE_LIMIT}"
            ).fetchall()
    except duckdb.Error as exc:
        raise CsvParseError(str(exc)) from exc

    sample_rows = [
        [None if cell is None else str(cell) for cell in row] for row in sample
    ]
    return ParseResult(columns=columns, row_count=int(row_count), sample_rows=sample_rows)
