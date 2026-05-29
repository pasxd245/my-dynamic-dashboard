# Round 39: Backend — `GET /datasets/{id}/rows` filter handler

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_38](Round_38.md)** — R38 landed the
encoded-params filter contract (`f<N>_op` / `f<N>_val` /
`f<N>_min` / `f<N>_max`) on
[`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
with per-dtype operator vocabulary in prose, four 422 error
codes, and AND-compose semantics with `?q=`. 13/13 contract
tests green. R39 implements the BE side: parse the `f<N>_*`
params, validate per-column dtype, push the predicates into
the DuckDB WHERE clause before pagination, AND-compose with the
existing `?q=` substring path, and surface the four 422 codes
with the `detail[].msg` shapes the contract names.

R39 is **BE-only**. No FE changes (R40 lands the client + UI),
no contract changes (R38 owns the YAML). The new code is a
single self-contained module
[`apps/backend/app/ingest/filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)
plus a small extension to
[`rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
plus a small extension to
[`routers/datasets.py`](../../../workspace/apps/backend/app/routers/datasets.py).

_Track: 1 (product — server-side filter handler is the
BE half of the R37-designed feature). Pulled by: R38
`Feeds into` naming this round + the rows-GET handler as the
target; R37 design's read/write boundary explicitly listing
"BE rows handler … evaluate per-column predicates against
DuckDB" as R39 scope. Per [Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **New module `app/ingest/filters.py`** carries the parser +
   SQL builder. Keeping it out of `rows_reader.py` matches the
   existing module split (parquet writer, csv parser, excel
   parser — each is a single-responsibility module). Tests
   exercise the parser + builder at the module level.
2. **Predicate model = frozen dataclass.** `FilterPredicate`
   holds `col_index`, `col_name`, `dtype`, `op`, and the
   per-operand-shape optional fields (`val`, `min_val`,
   `max_val`). Pydantic would buy validation we don't need —
   the parser already validated; the dataclass is just a
   typed record for downstream consumption. Field name
   `min_val` / `max_val` instead of `min` / `max` to avoid
   the Python builtin clash.
3. **Per-dtype value parsing in the BE.** The wire format is
   `string` (per R38 contract); the BE parses to native types
   (`int` for integer, `float` for float, ISO `YYYY-MM-DD`
   for date, ISO `YYYY-MM-DDTHH:MM:SS` for datetime).
   Boolean operators are operand-less so no parse needed.
   String operators take the value verbatim. Parse failure
   raises `HTTPException(422)` with `filter_value_unparseable`
   detail.
4. **DuckDB WHERE-clause construction uses parametrized `?`
   placeholders for values + `CAST(? AS <type>)` for dtype
   coercion.** Identifier quoting is in-Python via
   `_quote_ident` (same helper R35 already uses in
   `rows_reader.py`). Values flow through DuckDB's parameter
   substitution — no string interpolation of user-supplied
   values, no SQL injection risk. Per-dtype SQL fragments:

   | Operator                              | SQL fragment (per-dtype hints in parens)                                               |
   | ------------------------------------- | -------------------------------------------------------------------------------------- |
   | `string.contains`                     | `lower(<col>) LIKE lower(?)` with `%v%` wrapping in the param                          |
   | `string.equals`                       | `lower(<col>) = lower(?)`                                                              |
   | `string.starts_with`                  | `lower(<col>) LIKE lower(?)` (`v%`)                                                    |
   | `string.ends_with`                    | `lower(<col>) LIKE lower(?)` (`%v`)                                                    |
   | `string.is_empty`                     | `(<col> IS NULL OR <col> = '')`                                                        |
   | `string.is_not_empty`                 | `(<col> IS NOT NULL AND <col> != '')`                                                  |
   | `int.equals` / `float.equals`         | `<col> = CAST(? AS <DOUBLE \| BIGINT>)`                                                |
   | `int.ne` / `float.ne`                 | `<col> != CAST(? AS …)`                                                                |
   | `int.gt/lt/gte/lte`                   | `<col> {>,<,>=,<=} CAST(? AS …)`                                                       |
   | `int.between` / `float.between`       | `<col> BETWEEN CAST(? AS …) AND CAST(? AS …)`                                          |
   | `date.equals`                         | `<col> = CAST(? AS DATE)`                                                              |
   | `date.ne` / `before` / `after`        | `<col> {!=,<,>} CAST(? AS DATE)`                                                       |
   | `date.between`                        | `<col> BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`                                    |
   | `datetime.*`                          | same as `date.*` with `CAST(? AS TIMESTAMP)`; ISO-T normalized to space before binding |
   | `bool.is_true` / `is_false`           | `<col> = TRUE` / `<col> = FALSE` (no parameter)                                        |
   | All dtypes: `is_null` / `is_not_null` | `<col> IS NULL` / `<col> IS NOT NULL` (no parameter)                                   |

5. **`is_empty` / `is_not_empty` apply to string only** (R37
   vocabulary table). For other dtypes the empty-string
   concept doesn't apply; use `is_null` / `is_not_null`
   instead.
6. **`between` is inclusive on both ends** (DuckDB's native
   `BETWEEN` semantics). `min_val > max_val` raises 422 with
   `filter_operand_shape`.
7. **AND-composition order in SQL**: filters first, then
   `?q=` substring. The reader builds the combined WHERE
   clause as `WHERE (filter1 AND filter2 AND …) AND (q
substring across all cols)`. This is observationally
   equivalent to AND-composing in either order — DuckDB's
   query planner picks the actual evaluation order. The
   filter-first ordering in the SQL string matches the
   conceptual model: filters select rows, then `?q=`
   narrows further.
8. **422 detail envelope**. Each error uses the FastAPI-
   shape `detail: [{"loc": [...], "msg": "...", "type":
"value_error"}]` (list of dicts), matching the R38
   contract's example. The four `msg` prefixes follow R38:
   - `filter_op_dtype_mismatch: op '<op>' is not valid for
dtype '<dtype>'`
   - `filter_value_unparseable: column <N> (<dtype>) cannot
parse '<val>'`
   - `filter_col_out_of_range: column <N> does not exist
(columnCount = <C>)`
   - `filter_operand_shape: column <N> op '<op>' expects
<expected-fields>`
     The existing `page_size` 422 stays as a string-detail
     (no R39 retrofit; that's a separate small consistency
     round if pulled later).
9. **Parser entry point**: the router calls
   `parse_filters_from_query(request.query_params, columns) -> list[FilterPredicate]`
   after fetching the dataset's `columns_json`. Empty-result
   `[]` is returned for the no-filter case (router passes
   it straight through to the reader, same path as
   `?q=None`).
10. **Reader signature**: `query_dataset_rows(parquet_path,
column_names, *, page, page_size, q, filters)` where
    `filters: list[FilterPredicate] | None = None` keeps the
    R35 default behavior backward-compatible.

## What is IN scope

### 1. New module `apps/backend/app/ingest/filters.py`

- File:
  [`apps/backend/app/ingest/filters.py`](../../../workspace/apps/backend/app/ingest/filters.py).
- Exports:
  - `Operator` = `Literal[<all operator keys>]` covering
    the full R37 vocabulary.
  - `OPS_BY_DTYPE: dict[str, frozenset[str]]` — per-dtype
    allowed operator sets (mirrors the R37 predicate-
    vocabulary table).
  - `FilterPredicate` — frozen dataclass.
  - `parse_filters_from_query(query_params, columns) -> list[FilterPredicate]`
    — main entry. Raises `HTTPException(422)` on any error.
  - `build_filter_sql(filters, column_names) -> tuple[str, list[object]]`
    — returns `(where_fragment, params)` where the fragment
    is "" if `filters` is empty, else `"(... predicates AND-composed ...)"`.
- Internal helpers:
  - `_parse_value(raw, dtype, col_index, col_name, field_name) -> int | float | str` — handles per-dtype parse + 422 on failure.
  - `_normalize_datetime(raw) -> str` — `T` → space for DuckDB.
  - `_validate_operand_shape(op, val, min_v, max_v, col_index) -> None` — checks the required-fields match per operator.
  - `_validate_op_for_dtype(op, dtype, col_index) -> None` — looks up `OPS_BY_DTYPE` and raises 422 on mismatch.

### 2. Extend `rows_reader.py::query_dataset_rows`

- New keyword arg
  `filters: list[FilterPredicate] | None = None` (R35 default
  preserves backward compat — current callers don't pass it).
- The SQL builder composes filter fragments first, then the
  `?q=` substring fragment, AND-ing them:
  - If both → `WHERE (filter_clause) AND (q_clause)`.
  - If only filter → `WHERE filter_clause`.
  - If only `?q=` → `WHERE q_clause` (unchanged from R35).
  - If neither → no WHERE (unchanged).
- Parameter order: filter params first, then `q` params.
- Both `rows_sql` and `count_sql` use the same combined
  WHERE so `total` reflects the AND-composed matched count.

### 3. Wire `routers/datasets.py::get_dataset_rows`

- Add `request: Request` to the signature so we can read raw
  query params.
- After fetching `row` and parsing `columns_json` into the
  full `[{"name": ..., "dtype": ...}, ...]` list, call
  `parse_filters_from_query(request.query_params, columns)`
  and pass the result to `query_dataset_rows(..., filters=…)`.
- Existing 404 / 422 paths unchanged.

### 4. Tests — `tests/test_datasets_rows_get.py`

Extend the existing R35 test file (don't fork). New tests cover:

- **Per-dtype happy paths** against `sample.csv` (id int,
  name string, amount float, signed_up date):
  - `?f0_op=equals&f0_val=2` — int equals → 1 row (Bob).
  - `?f1_op=contains&f1_val=ali` — string contains
    case-insensitive → 1 row (Alice).
  - `?f1_op=starts_with&f1_val=B` — 1 row (Bob).
  - `?f1_op=ends_with&f1_val=ol` — 1 row (Carol).
  - `?f1_op=equals&f1_val=alice` — case-insensitive
    string equals → 1 row.
  - `?f2_op=between&f2_min=20&f2_max=60` — float between
    → 1 row (Alice 42.5).
  - `?f2_op=gt&f2_val=50` — 1 row (Carol 99.9).
  - `?f3_op=after&f3_val=2024-02-01` — date after → 2
    rows (Bob, Carol).
  - `?f3_op=between&f3_min=2024-02-01&f3_max=2024-03-01`
    → 1 row (Bob).
  - `?f1_op=is_not_empty` — 3 rows.
  - `?f1_op=is_not_null` — 3 rows.
- **`?q=` AND filter compose**:
  - `?q=ali&f0_op=gt&f0_val=0` → 1 row (Alice).
  - `?q=ZZZ&f0_op=gt&f0_val=0` → 0 rows, `total=0`.
- **422 paths**:
  - `?f1_op=gt&f1_val=5` — `gt` on string column →
    `filter_op_dtype_mismatch`.
  - `?f0_op=equals&f0_val=foo` — non-int value on int
    column → `filter_value_unparseable`.
  - `?f9_op=equals&f9_val=anything` — column 9 doesn't
    exist (sample.csv has 4 columns) → `filter_col_out_of_range`.
  - `?f0_op=between&f0_val=5` — `val` with `between` op →
    `filter_operand_shape`.
  - `?f0_op=between&f0_min=10&f0_max=5` — min > max →
    `filter_operand_shape`.
  - `?f0_op=equals` — `equals` without `val` →
    `filter_operand_shape`.
- **Contract conformance**: 200 happy-path responses still
  validate against `rows-get.contract.yaml` via the
  `validate_response` helper.

### 5. Pipeline

- `pnpm --filter @mdd/contracts test` — 13/13 stays green
  (contract unchanged; conformance still holds).
- BE tests: `uv run --project workspace/apps/backend pytest`
  (or whatever the existing `pytest` runner is). All
  existing tests stay green; new tests pass.
- `npx markdownlint-cli2` — 0 errors repo-wide.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No FE changes.** R40 lands the FE client + UI (popover,
  chip row, URL serialization, useFiltersState hook,
  vitest cases).
- **No contract changes.** R38 owns the YAML.
- **No `_shared/filter-error.yaml` envelope.** Per R38, the
  four error codes ride in `detail[].msg` strings. Promotion
  to a typed envelope happens only when a future surface
  needs to _consume_ the codes programmatically.
- **No retrofit of the existing `page_size` / `id` 422
  detail shape.** Those stay as string `detail` (current
  R35 impl). The new filter-related 422s use the list-of-
  dict shape per the R38 contract example. A future
  consistency round can unify if pulled.
- **No DuckDB FTS index, no parquet metadata-level row-
  group filter pushdown tuning.** DuckDB's default
  predicate pushdown is sufficient at POC scale. Performance
  optimization is deferred until a benchmarked bottleneck
  appears.
- **No multi-predicate per column.** R38 contract has
  one predicate per column; the parser enforces this
  (duplicate `f<N>_op` keys would surface via Python's
  query-params multi-dict — we take the first or raise; see
  Risks).
- **No sort (`?order_by=&direction=`).** Sort is its own
  DCBF chain after R40 lands filters (user confirmed split).
- **No AND/OR/grouping syntax.** AND-only across columns;
  advanced query is its own concept.

## Plan

- [x] Confirm scope at planning review (decisions 1-10 above;
      user redirects any via end-of-round Q&A).
- [x] Author `apps/backend/app/ingest/filters.py` with the
      Operator literal, OPS_BY_DTYPE map, FilterPredicate
      dataclass, parser, and SQL builder.
- [x] Extend `apps/backend/app/ingest/rows_reader.py`
      `query_dataset_rows` signature + WHERE-clause assembly
      (filter fragment AND-composes with the `?q=` fragment).
- [x] Wire `apps/backend/app/routers/datasets.py`
      `get_dataset_rows` to call the parser + pass filters
      to the reader (added `request: Request` parameter).
- [x] Add 25 new test cases to
      `apps/backend/tests/test_datasets_rows_get.py`
      (per-dtype operators, AND-compose with q, four 422
      paths, vocabulary-integrity, SQL-builder bool +
      datetime unit tests).
- [x] Run `pytest` — **119/119** green (94 existing + 25 new).
- [x] Run `pnpm --filter @mdd/contracts test` — 13/13.
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      to Review.

## Risks / unknowns

- **Duplicate `f<N>_op` keys** (e.g. someone passes
  `?f0_op=equals&f0_op=ne`). Starlette / FastAPI's
  `QueryParams.get(key)` returns the first; `.getlist(key)`
  returns all. R39 uses `.get()` so duplicates silently take
  the first value. Mitigation: documented; if a real client
  ever does this it's a client bug, not a server one.
- **`Date` / `Timestamp` parsing strictness.** Python's
  `date.fromisoformat()` / `datetime.fromisoformat()` are
  strict about the format. R37 spec'd ISO `YYYY-MM-DD` /
  `YYYY-MM-DDTHH:MM:SS`. Mitigation: parse fails → 422 with
  `filter_value_unparseable` naming the column and the bad
  value. R40 enforces the format client-side via AntD
  `<DatePicker>`.
- **`int` parsing with leading zeros / scientific notation.**
  Python's `int("007")` is 7 (good); `int("1e3")` raises
  (good — we don't accept scientific). Mitigation: stick
  with strict `int()` / `float()`; document that scientific
  notation is rejected. Realistic numeric filter values
  don't need it.
- **`bool` operators are operand-less but
  `f<N>_val=anything` could still be sent**. The parser
  ignores unused operand fields silently (a `val` present
  with `is_true` op is _not_ an error — it's just unused).
  Mitigation: documented; the R37/R38 design called for
  per-operator strict shape, but enforcing strictness here
  would surprise FE bugs more than it would help. Compromise:
  R39 ignores; R40 doesn't send the unused field. If a real
  bug surfaces, tighten in a follow-up.
- **Concurrent dataset delete during request.** The handler
  reads `columns_json` from SQLite, then opens DuckDB on
  the parquet file. A concurrent delete between those two
  steps would 500 on the parquet read. Mitigation:
  inherited from R35 — same exposure exists for the
  unfiltered path; not made worse by R39. Documented as
  a known race, not a regression.
- **`HTTPException(422, detail=[…dicts…])` vs the existing
  string-detail 422s.** FastAPI's JSON encoder happily
  serializes either shape; the contract example shows the
  list-of-dict form, so new filter 422s land that way.
  Existing string-detail 422s stay (they aren't in the
  contract's examples directly; the YAML's 422 schema
  just says `detail: array[object]` so the test verifies
  that array-of-dict is acceptable but doesn't reject
  array-of-string today).
- **`OPS_BY_DTYPE` drift vs the R38 contract YAML.** The
  authoritative list lives in `dataset-filters.md` §
  Predicate vocabulary table; the YAML mirrors it in prose;
  the BE mirrors it in code. Three sources. Mitigation:
  R39 includes a unit test that asserts every operator
  named in the R37 vocabulary table is present in
  `OPS_BY_DTYPE`. A future round can promote the vocabulary
  to a generated constant if drift becomes a recurring
  issue.

## Do

**`filters.py` module.**

- New file
  [`apps/backend/app/ingest/filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)
  (~330 LOC). Exports `Operator` literal type, `OPS_BY_DTYPE`
  mapping (mirrors the R37 vocabulary table), `FilterPredicate`
  frozen dataclass, `parse_filters_from_query`, and
  `build_filter_sql`.
- **Parser** walks `request.query_params`, matches `f<N>_*`
  keys via regex, groups by `<N>`, then for each column:
  validates index < `columnCount`, validates op for dtype
  (via `OPS_BY_DTYPE` lookup), validates operand-field shape
  (single-operand vs range vs no-operand), parses the operand
  value(s) per dtype with strict native parsers
  (`int()`, `float()`, `date.fromisoformat()`,
  `datetime.fromisoformat()`). Each violation raises
  `HTTPException(422)` with the FastAPI-shape
  `detail: [{loc, msg, type: "value_error"}]` envelope per
  the R38 contract, with one of the four `msg` prefixes
  (`filter_op_dtype_mismatch`, `filter_value_unparseable`,
  `filter_col_out_of_range`, `filter_operand_shape`).
- **SQL builder** produces `(where_fragment, params)` with
  parameterized `?` placeholders. Per-dtype CAST coercion
  (`CAST(? AS BIGINT)` for integer, `DOUBLE` for float,
  `DATE` for date, `TIMESTAMP` for datetime). String
  operators use `lower(col) LIKE lower(?)` (case-insensitive,
  matches R36 `?q=` semantics). Boolean ops emit
  `col = TRUE` / `col = FALSE` with no parameter. Null /
  empty ops emit `col IS NULL` / `(col IS NULL OR col = '')`
  variants. Identifier quoting via `_quote_ident` (safe —
  comes from validated columns_json).
- The datetime parser normalizes ISO-T to ISO-space form
  before binding (DuckDB's `CAST(? AS TIMESTAMP)` accepts
  `'YYYY-MM-DD HH:MM:SS'` form natively).

**`rows_reader.py` extension.**

- [`query_dataset_rows`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
  signature gains
  `filters: list[FilterPredicate] | None = None` (default
  preserves R35 backward compat).
- WHERE-clause assembly: build the filter fragment via
  `build_filter_sql(filters or [])`, build the `?q=` fragment
  (now wrapped in parens for safe outer-AND composition),
  then AND-join them as `WHERE filter_clause AND q_clause`.
  Both fragments are optional; absent fragments fall through
  to the unfiltered path.
- Both `rows_sql` and `count_sql` use the same combined
  WHERE so `total` reflects the AND-composed matched count.

**Router wiring.**

- [`get_dataset_rows`](../../../workspace/apps/backend/app/routers/datasets.py)
  signature gains `request: Request` as the first
  parameter (FastAPI injects). After fetching the dataset's
  `columns_json`, the handler calls
  `parse_filters_from_query(request.query_params, columns_meta)`
  where `columns_meta` is the full `[{name, dtype}, ...]`
  list (not just names — needed for per-dtype validation).
  Result passes through to `query_dataset_rows(...,
filters=...)`. 422 raised by the parser propagates as the
  FastAPI request-validation envelope per the R38 contract.

**Tests.**

- 25 new cases appended to
  [`test_datasets_rows_get.py`](../../../workspace/apps/backend/tests/test_datasets_rows_get.py):
  - Per-dtype happy paths: int equals (1 row), string
    contains case-insensitive, string equals
    case-insensitive, string starts_with, string ends_with,
    float between (inclusive bounds verified), float gt,
    date after, date between, string is_not_null,
    string is_not_empty.
  - AND-compose with `?q=`: `q=ali AND id>0` (Alice only),
    `q=ZZZ AND id>0` (zero match, 200 + total=0).
  - Filter-only zero match: 200 + total=0.
  - Four 422 paths: op-dtype-mismatch, value-unparseable
    (int + date variants), col-out-of-range, operand-shape
    (between+val, min>max, equals-without-val,
    val-without-op).
  - Vocabulary-integrity unit test that asserts
    `OPS_BY_DTYPE` matches the R37 table verbatim — if R37
    is amended, this test breaks loudly so the BE catches
    drift.
  - Synthetic SQL-builder unit tests for boolean
    (`is_true` / `is_false`) and datetime (CAST AS
    TIMESTAMP) — sample.csv has no bool/datetime so these
    exercise the builder against constructed predicates.

**Pipeline.**

- `uv run pytest` — **119/119 green** (94 existing + 25 new
  rows-filter cases; ~8.6s).
- `pnpm --filter @mdd/contracts test` — **13/13 green**
  (R38 contract unchanged; conformance still holds).
- `npx markdownlint-cli2` — **0 errors over 96 files**. Two
  MD049 emphasis-style nits caught mid-round (`*consume*` /
  `*not*` → `_consume_` / `_not_`); fixed in place.

## Check

- [x] `filters.py` module exports the contract surface
      (`Operator`, `OPS_BY_DTYPE`, `FilterPredicate`,
      `parse_filters_from_query`, `build_filter_sql`).
- [x] Parser surfaces all four 422 codes with the
      contract-named `detail[].msg` prefixes.
- [x] SQL builder uses parameterized `?` placeholders +
      `CAST` coercion; no string interpolation of
      user-supplied values.
- [x] Identifier quoting via `_quote_ident` (consistent
      with R35's existing helper).
- [x] `query_dataset_rows` AND-composes filter + `?q=`
      fragments; `total` reflects the combined matched
      count.
- [x] Router parses filters before invoking the reader;
      404 path still short-circuits cleanly when the
      dataset is missing.
- [x] All 25 new test cases pass; all 94 existing tests
      still pass.
- [x] Contract tests 13/13; markdownlint 0/96.
- [x] `OPS_BY_DTYPE` vocabulary integrity test passes
      (defends against R37↔BE drift).
- [x] Post-round audit passes; all Plan + Check checkboxes
      flipped.

## Act

**Learnings**:

- **Frozen dataclass beat Pydantic for the predicate
  model.** The parser is the validation layer; the
  dataclass is just a typed record passed downstream.
  Pydantic would have duplicated the validation logic
  (which is inherently per-dtype and not expressible as a
  single schema) and added overhead. The dataclass is ~10
  lines; matches the rest of `ingest/` which uses plain
  Python where possible.
- **Parameterized DuckDB queries + per-dtype CAST is the
  clean injection-safe pattern.** Identifier quoting stays
  Python-side (safe, comes from validated columns_json);
  values flow through DuckDB's `?` placeholders with
  `CAST(? AS DATE)` / `CAST(? AS BIGINT)` / etc. doing the
  type coercion. No string formatting of user input
  anywhere in the SQL fragments.
- **`OR`-chain `?q=` needed parens.** The R35
  `?q=` substring fragment was emitted as a flat
  `lower(c1) LIKE ? OR lower(c2) LIKE ? OR …` (no outer
  parens). That's fine alone but composes incorrectly under
  outer AND (`filter AND OR-chain` would associate wrong).
  Wrapped in parens during R39's WHERE-clause assembly;
  pre-existing R35 tests stayed green so no behavioral
  change to the q-only path.
- **`request.query_params` is the right ingest point for
  parameterized-key params.** FastAPI's standard
  `Query(...)` declarations can't express "any
  `f<N>_*` for arbitrary N." Reading
  `request.query_params` directly (Starlette's
  `QueryParams` multi-dict) and parsing in Python is the
  honest path. The cost is the loss of OpenAPI-generated
  request-validation for these params, but the BE-side
  parser surfaces 422s with the same envelope shape so the
  observable behavior is consistent.
- **Vocabulary-integrity test catches R37↔BE drift.** If
  someone amends the R37 vocabulary table without updating
  `OPS_BY_DTYPE`, the test breaks at the first run of the
  BE suite. Cheap insurance against the "three-source
  drift" risk R38 named.
- **Strict `int()` / `date.fromisoformat()` parses are
  honest 422 paths.** Python 3.10+ `date.fromisoformat`
  accepts only strict `YYYY-MM-DD`; `datetime.fromisoformat`
  accepts `YYYY-MM-DDTHH:MM:SS` and (3.11+) `YYYY-MM-DD HH:MM:SS`.
  No need for a custom parse step beyond the `T`→space
  normalization. Errors raise `ValueError`, caught by the
  parser's try/except, surfaced as 422 with
  `filter_value_unparseable`.

**Promotions** _(none — BE round; the filter parser + SQL
builder stay feature-local to the rows endpoint until a
second filter-accepting endpoint creates a real pull for
extraction)_:

**Follow-ups (not promotions, just notes):**

- **422 envelope consistency across the dataset endpoints.**
  R35's existing `page_size` 422 still uses
  `detail: "<string>"` (Pydantic-default for
  `HTTPException` with string detail). R39's filter 422s
  use `detail: [{loc, msg, type}]` (FastAPI request-
  validation envelope, list-of-dict). Both pass the
  contract YAML's loose schema (`detail: array[object]`
  is the declared shape; `string` is technically a contract
  violation but no test asserts the per-422-case shape
  today). A future small consistency round could unify on
  the list-of-dict shape; not pulled yet.
- **Per-column index keys + future schema mutation.** R14
  Read/write boundary keeps datasets immutable post-commit,
  so column order is stable. If a future round ever
  introduces column reorder / hide / rename, the URL
  param keys would need to follow column _id_ not index.
  Not a regression today; documented in R37 follow-ups.
- **Multi-predicate per column.** R38 contract has one
  predicate per column. The parser's `by_index` dict
  silently takes the last `f<N>_op` if duplicates arrive
  (FastAPI's `QueryParams.get` returns the first; we use
  `.get`, so we take first). For OR-composition across the
  same column (e.g. `stage = won OR stage = committed`),
  the advanced-query feature is the right surface, not
  per-column filter widgets.
- **Performance at scale.** Each query opens a fresh
  `duckdb.connect(":memory:")` per R35; DuckDB's predicate
  pushdown into Parquet row-groups is automatic. Benchmarks
  haven't been run at 100k+ rows × multi-filter. If the
  filter+pagination round-trip ever exceeds ~500ms at
  realistic scale, the lever is either a persistent
  DuckDB connection or a row-group statistics index. Not
  pulled yet.
- **`is_empty` semantics include both NULL and `''`.**
  This is the user-friendly definition ("the cell looks
  empty"). The strict variant (`= ''` only, NULLs
  excluded) wasn't pulled by R37; if a user asks for the
  difference, promote a second operator like `is_blank`
  for the inclusive variant and tighten `is_empty` to the
  strict one. Documented in `filters.py` source.

## Feeds into → Round_40 (F — filter UI)

R39 closes the BE phase of the filter DCBF chain. R40
finishes it on the FE:

- **R40** (F): extend
  [`datasetsApi.getRows`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
  with a `filters?` argument; new
  `useFiltersState` hook (URL ↔ predicate-set); new
  `FilterTrigger` / `FilterPopover` / per-dtype editors
  (`StringFilterEditor`, `NumericFilterEditor`,
  `DateFilterEditor`, `BooleanFilterEditor`) /
  `ActiveFilterChips`; integration into
  `DatasetDetailPage.tsx` with the chip row above the table
  and the `▾` trigger on each column header; TanStack
  cache-key extended to include filters; i18n keys under
  `datasets.filters.*`; vitest cases per dtype + combined
  `q + filters` + no-match.

Verification-stack queue (MSW, item #1) stays parked at
"next available Track-2 slot"; with R39 done and R40 next,
the next opportunity is R41 (or wherever the sort DCBF
chain is sequenced — sort vs MSW is the open question at
end-of-R40 Q&A).
