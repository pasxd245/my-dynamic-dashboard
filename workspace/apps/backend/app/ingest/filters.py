"""Per-column typed filters — R39 (R37 design, R38 contract).

Parses `f<N>_op` / `f<N>_val` / `f<N>_min` / `f<N>_max` query
params into typed predicates, validates per-column dtype, and
builds a parameterized DuckDB WHERE fragment that the rows
reader composes with the existing `?q=` substring search.

Authoritative cross-stack spec for the operator vocabulary:
`.agents/design/data-management/dataset-filters.md` §
Predicate vocabulary table.

Wire contract:
`workspace/packages/contracts/datasets/rows-get.contract.yaml`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable, Literal

from fastapi import HTTPException
from starlette.datastructures import QueryParams


# ─── Operator vocabulary ────────────────────────────────────────────

Operator = Literal[
    "contains",
    "equals",
    "ne",
    "gt",
    "lt",
    "gte",
    "lte",
    "between",
    "starts_with",
    "ends_with",
    "before",
    "after",
    "is_empty",
    "is_not_empty",
    "is_null",
    "is_not_null",
    "is_true",
    "is_false",
]


OPS_BY_DTYPE: dict[str, frozenset[str]] = {
    "string": frozenset(
        {
            "contains",
            "equals",
            "starts_with",
            "ends_with",
            "is_empty",
            "is_not_empty",
            "is_null",
            "is_not_null",
        }
    ),
    "integer": frozenset(
        {"equals", "ne", "gt", "lt", "gte", "lte", "between", "is_null", "is_not_null"}
    ),
    "float": frozenset(
        {"equals", "ne", "gt", "lt", "gte", "lte", "between", "is_null", "is_not_null"}
    ),
    "date": frozenset(
        {"equals", "ne", "before", "after", "between", "is_null", "is_not_null"}
    ),
    "datetime": frozenset(
        {"equals", "ne", "before", "after", "between", "is_null", "is_not_null"}
    ),
    "boolean": frozenset({"is_true", "is_false", "is_null", "is_not_null"}),
}


# Operators that take exactly one operand (`f<N>_val`).
_SINGLE_VALUE_OPS: frozenset[str] = frozenset(
    {
        "contains",
        "equals",
        "ne",
        "gt",
        "lt",
        "gte",
        "lte",
        "starts_with",
        "ends_with",
        "before",
        "after",
    }
)

# Operators that take two operands (`f<N>_min` and `f<N>_max`).
_RANGE_OPS: frozenset[str] = frozenset({"between"})

# Operators that take zero operands.
_NO_VALUE_OPS: frozenset[str] = frozenset(
    {"is_empty", "is_not_empty", "is_null", "is_not_null", "is_true", "is_false"}
)


# ─── Predicate model ────────────────────────────────────────────────


@dataclass(frozen=True)
class FilterPredicate:
    """One per-column predicate. Parsed values are stored in their
    native Python type so the SQL builder can bind them directly via
    DuckDB's `?` placeholders + a CAST."""

    col_index: int
    col_name: str
    dtype: str
    op: str
    val: Any = None
    min_val: Any = None
    max_val: Any = None


# ─── Parsing ────────────────────────────────────────────────────────


_KEY_RE = re.compile(r"^f(\d+)_(op|val|min|max)$")


def _http_422(loc: list[str], msg: str) -> HTTPException:
    """Build the FastAPI-shape 422 envelope the R38 contract spec'd."""
    return HTTPException(
        status_code=422,
        detail=[{"loc": loc, "msg": msg, "type": "value_error"}],
    )


def _normalize_datetime(raw: str) -> str:
    """ISO-T → ISO-space so `datetime.fromisoformat` accepts both shapes."""
    return raw.replace("T", " ", 1) if "T" in raw else raw


def _parse_value(
    raw: str, dtype: str, col_index: int, field_name: str
) -> int | float | str:
    """Parse a raw query-string value into the native type for `dtype`.

    Raises 422 with `filter_value_unparseable` on failure.
    """
    try:
        if dtype == "integer":
            return int(raw)
        if dtype == "float":
            return float(raw)
        if dtype == "date":
            # date.fromisoformat is strict YYYY-MM-DD on 3.10+.
            date.fromisoformat(raw)
            return raw
        if dtype == "datetime":
            normalized = _normalize_datetime(raw)
            datetime.fromisoformat(normalized)
            # DuckDB accepts 'YYYY-MM-DD HH:MM:SS' via CAST ? AS TIMESTAMP.
            return normalized
        # string → utf-8 verbatim (no parse).
        return raw
    except (ValueError, TypeError) as exc:
        raise _http_422(
            loc=["query", f"f{col_index}_{field_name}"],
            msg=(
                f"filter_value_unparseable: column {col_index} ({dtype}) "
                f"cannot parse {raw!r}"
            ),
        ) from exc


def _validate_op_for_dtype(op: str, dtype: str, col_index: int) -> None:
    allowed = OPS_BY_DTYPE.get(dtype, frozenset())
    if op not in allowed:
        raise _http_422(
            loc=["query", f"f{col_index}_op"],
            msg=f"filter_op_dtype_mismatch: op {op!r} is not valid for dtype {dtype!r}",
        )


def _validate_operand_shape(
    op: str,
    raw_val: str | None,
    raw_min: str | None,
    raw_max: str | None,
    col_index: int,
) -> None:
    """Each operator implies a fixed operand-field shape."""
    has_val = raw_val is not None
    has_min = raw_min is not None
    has_max = raw_max is not None

    if op in _NO_VALUE_OPS:
        # No-operand operators: any present val/min/max is ignored
        # silently (R39 design risk-3 — strict rejection would surprise
        # FE bugs more than it would help).
        return
    if op in _SINGLE_VALUE_OPS:
        if not has_val:
            raise _http_422(
                loc=["query", f"f{col_index}_val"],
                msg=(
                    f"filter_operand_shape: column {col_index} op {op!r} "
                    f"expects f{col_index}_val"
                ),
            )
        if has_min or has_max:
            raise _http_422(
                loc=["query", f"f{col_index}_op"],
                msg=(
                    f"filter_operand_shape: column {col_index} op {op!r} "
                    f"expects f{col_index}_val (not f{col_index}_min/max)"
                ),
            )
        return
    if op in _RANGE_OPS:
        if not has_min or not has_max:
            raise _http_422(
                loc=["query", f"f{col_index}_op"],
                msg=(
                    f"filter_operand_shape: column {col_index} op {op!r} "
                    f"expects f{col_index}_min and f{col_index}_max"
                ),
            )
        if has_val:
            raise _http_422(
                loc=["query", f"f{col_index}_op"],
                msg=(
                    f"filter_operand_shape: column {col_index} op {op!r} "
                    f"expects f{col_index}_min/max (not f{col_index}_val)"
                ),
            )
        return
    # Unknown operator: dtype-mismatch would have caught it; defense-in-depth.
    raise _http_422(
        loc=["query", f"f{col_index}_op"],
        msg=f"filter_op_dtype_mismatch: op {op!r} is not recognized",
    )


def parse_filters_from_query(
    query_params: QueryParams, columns: list[dict[str, str]]
) -> list[FilterPredicate]:
    """Extract `f<N>_*` predicates from query params.

    `columns` is the dataset's committed `columns_json` —
    each entry has `name` and `dtype`.

    Returns predicates sorted by `col_index` for stable equality
    (matches the FE serialization rule from R37 design).

    Raises `HTTPException(422)` on any error per the R38 contract.
    """
    # Group params by column index.
    by_index: dict[int, dict[str, str]] = {}
    for key in query_params.keys():
        m = _KEY_RE.match(key)
        if not m:
            continue
        n = int(m.group(1))
        field = m.group(2)
        by_index.setdefault(n, {})[field] = query_params.get(key) or ""

    if not by_index:
        return []

    column_count = len(columns)
    out: list[FilterPredicate] = []
    for n in sorted(by_index.keys()):
        fields = by_index[n]

        if n >= column_count:
            raise _http_422(
                loc=["query", f"f{n}_op"],
                msg=(
                    f"filter_col_out_of_range: column {n} does not exist "
                    f"(columnCount = {column_count})"
                ),
            )

        op = fields.get("op")
        if op is None:
            # A `f<N>_val` / `_min` / `_max` without `f<N>_op` is malformed.
            raise _http_422(
                loc=["query", f"f{n}_op"],
                msg=(
                    f"filter_operand_shape: column {n} has operand field(s) "
                    f"without f{n}_op"
                ),
            )

        col = columns[n]
        dtype = col["dtype"]
        col_name = col["name"]

        _validate_op_for_dtype(op, dtype, n)
        _validate_operand_shape(
            op, fields.get("val"), fields.get("min"), fields.get("max"), n
        )

        # Parse operand values per dtype.
        val_native: Any = None
        min_native: Any = None
        max_native: Any = None
        if op in _SINGLE_VALUE_OPS:
            val_native = _parse_value(fields["val"], dtype, n, "val")
        elif op in _RANGE_OPS:
            min_native = _parse_value(fields["min"], dtype, n, "min")
            max_native = _parse_value(fields["max"], dtype, n, "max")
            # Inclusive range — min > max is an empty interval; surface
            # 422 rather than silently returning zero rows.
            if min_native > max_native:  # type: ignore[operator]
                raise _http_422(
                    loc=["query", f"f{n}_min"],
                    msg=(
                        f"filter_operand_shape: column {n} op 'between' "
                        f"requires f{n}_min <= f{n}_max"
                    ),
                )

        out.append(
            FilterPredicate(
                col_index=n,
                col_name=col_name,
                dtype=dtype,
                op=op,
                val=val_native,
                min_val=min_native,
                max_val=max_native,
            )
        )

    return out


# ─── SQL builder ────────────────────────────────────────────────────


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _duckdb_cast(dtype: str) -> str:
    """Map dataset dtype → DuckDB CAST target type."""
    return {
        "integer": "BIGINT",
        "float": "DOUBLE",
        "date": "DATE",
        "datetime": "TIMESTAMP",
    }.get(dtype, "VARCHAR")  # string falls through (no CAST needed in practice)


def _predicate_sql(p: FilterPredicate) -> tuple[str, list[Any]]:
    """Return `(sql_fragment, params)` for one predicate.

    Identifier is quoted in-Python (safe — comes from validated
    columns_json). Values flow through DuckDB's `?` placeholders.
    """
    col = _quote_ident(p.col_name)
    op = p.op
    dtype = p.dtype

    # No-operand ops.
    if op == "is_null":
        return f"{col} IS NULL", []
    if op == "is_not_null":
        return f"{col} IS NOT NULL", []
    if op == "is_empty":
        return f"({col} IS NULL OR {col} = '')", []
    if op == "is_not_empty":
        return f"({col} IS NOT NULL AND {col} != '')", []
    if op == "is_true":
        return f"{col} = TRUE", []
    if op == "is_false":
        return f"{col} = FALSE", []

    # String ops (case-insensitive — matches R36 `?q=` semantics).
    if dtype == "string":
        if op == "contains":
            return f"lower({col}) LIKE lower(?)", [f"%{p.val}%"]
        if op == "equals":
            return f"lower({col}) = lower(?)", [p.val]
        if op == "starts_with":
            return f"lower({col}) LIKE lower(?)", [f"{p.val}%"]
        if op == "ends_with":
            return f"lower({col}) LIKE lower(?)", [f"%{p.val}"]
        # Defense-in-depth: dtype-mismatch was already caught at parse.
        raise RuntimeError(f"unhandled string op: {op}")

    # Numeric / date / datetime ops with CAST coercion.
    cast = _duckdb_cast(dtype)
    if op == "equals":
        return f"{col} = CAST(? AS {cast})", [p.val]
    if op == "ne":
        return f"{col} != CAST(? AS {cast})", [p.val]
    if op == "gt":
        return f"{col} > CAST(? AS {cast})", [p.val]
    if op == "lt":
        return f"{col} < CAST(? AS {cast})", [p.val]
    if op == "gte":
        return f"{col} >= CAST(? AS {cast})", [p.val]
    if op == "lte":
        return f"{col} <= CAST(? AS {cast})", [p.val]
    if op == "before":
        return f"{col} < CAST(? AS {cast})", [p.val]
    if op == "after":
        return f"{col} > CAST(? AS {cast})", [p.val]
    if op == "between":
        return (
            f"{col} BETWEEN CAST(? AS {cast}) AND CAST(? AS {cast})",
            [p.min_val, p.max_val],
        )

    raise RuntimeError(f"unhandled op/dtype combination: {op}/{dtype}")


def build_filter_sql(
    filters: Iterable[FilterPredicate],
) -> tuple[str, list[Any]]:
    """Build the AND-composed WHERE fragment + parameter list.

    Returns `("", [])` for an empty filter set; otherwise
    `("(p1 AND p2 AND …)", [p1_params..., p2_params..., ...])`.

    Caller composes this with the `?q=` fragment via outer AND.
    """
    fragments: list[str] = []
    params: list[Any] = []
    for p in filters:
        sql, p_params = _predicate_sql(p)
        fragments.append(sql)
        params.extend(p_params)

    if not fragments:
        return "", []
    if len(fragments) == 1:
        return fragments[0], params
    return "(" + " AND ".join(fragments) + ")", params
