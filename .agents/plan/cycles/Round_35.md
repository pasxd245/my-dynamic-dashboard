# Round 35: BE — GET /datasets/{id} + GET /datasets/{id}/rows + full-parquet commit

**Status**: Complete
**Date started**: 2026-05-26
**Date completed**: 2026-05-26

## Goal

**Inherits from ← [Round_34](Round_34.md)** — R34 landed two
OpenAPI 3.1 contracts and the contract-validity tests passed.
R35 implements the FastAPI handlers + paged-Parquet reader the
[dataset detail page](../../design/data-management/dataset-detail.md)
needs.

R35 is **a B-round with a discovered scope expansion**: while
mapping the implementation against today's
[batch-commit handler](../../../workspace/apps/backend/app/routers/datasets.py),
I found that `parsed.parquet` is written from `parsed.sample_rows`
([datasets.py:222-239](../../../workspace/apps/backend/app/routers/datasets.py#L222-L239))
— which is capped at 10 rows by
[`SAMPLE_LIMIT`](../../../workspace/apps/backend/app/ingest/csv_parser.py#L19).
The dataset's metadata reports the real `rowCount`, but the
on-disk parquet only holds the wizard preview. R33's design
assumed parquet holds the full data; R35 has to make that true
before the new rows-GET can serve real data.

**User decisions locked at R35 planning (auto-mode picks):**

1. **Storage = parquet on disk; query engine = DuckDB.** Each
   committed dataset's `parsed.parquet` becomes the canonical
   full-data file. Reads use `duckdb.connect(":memory:")` +
   `SELECT … FROM read_parquet(?)` per request — leverages
   DuckDB's pushdown for `WHERE` + `LIMIT`/`OFFSET` without
   shipping a `data.duckdb` file format. Parquet stays portable
   (pandas / external tools can still open it).
2. **Write full data at commit time via DuckDB `COPY` (CSV) or
   pandas → parquet (Excel).** CSV files take the DuckDB path
   end-to-end (`read_csv_auto` → `COPY … TO 'parsed.parquet'
(FORMAT 'parquet')`). Excel takes pandas (`read_excel(full)`
   → `df.to_parquet(...)`) because openpyxl is the proven Excel
   reader and DuckDB doesn't natively read xlsx.
3. **Cell stringification = SQL `CAST("col" AS VARCHAR)` per
   column.** DuckDB's VARCHAR cast produces `'true'`/`'false'`
   for booleans, ISO-ish date/datetime strings, integers/floats
   as their decimal form. Null preservation is automatic
   (SQL NULL → Python `None` → JSON `null`). FE re-applies
   dtype-aware display formatting using
   `Dataset.columns[].dtype`.
4. **Substring filter = SQL `WHERE lower(CAST(col AS VARCHAR))
LIKE '%q%'` OR-joined across all columns.** Naive
   O(rows × cols) scan is fine at POC scale (max 100 MB per
   dataset); promote to a DuckDB FTS index once 100k+ rows ×
   high q-frequency makes it visible.
5. **Total via separate `SELECT COUNT(*)` query**, same
   `WHERE` clause when `q` is set. Two queries per request;
   simpler than `COUNT(*) OVER ()` window which breaks at
   zero-match.

## What is IN scope

### 1. Full-parquet write at commit time

- New helpers in
  [`app/ingest/parquet_writer.py`](../../../workspace/apps/backend/app/ingest/parquet_writer.py)
  (new file):
  - `write_csv_to_parquet(src, dst, skip_rows, has_header,
kept_columns)` — uses DuckDB `COPY (SELECT … FROM
read_csv_auto(…)) TO ? (FORMAT 'parquet')`.
  - `write_excel_to_parquet(src, dst, sheet, range_,
has_header, kept_columns)` — uses pandas `read_excel`
    (full, not sample) + `df.to_parquet(...)`.
- Replace the sample-based write in
  [`datasets.py` § commit_datasets_batch](../../../workspace/apps/backend/app/routers/datasets.py#L222-L239)
  with a call to the appropriate helper. Column exclusions and
  overrides still apply (kept_columns reflects post-exclusion
  list; overrides modify the dtype metadata that
  `Dataset.columns[]` carries, not the parquet column dtype —
  the parquet keeps whatever the parser inferred and FE renders
  per the metadata dtype).

### 2. `GET /datasets/{id}` handler

- New route in
  [`datasets.py`](../../../workspace/apps/backend/app/routers/datasets.py):
  `@router.get("/datasets/{id}", response_model=Dataset,
response_model_exclude_none=True)`.
- Reads from SQLite via the same shape `list_datasets()`
  hydrates per row. 404 returns `ApiErrorNotFound()` envelope.

### 3. `GET /datasets/{id}/rows` handler

- New route in `datasets.py`. Path: `/datasets/{id}/rows`.
- Query params:
  - `page`: `Query(default=1, ge=1)`.
  - `page_size`: `Query(default=50)` with Pydantic-side enum
    enforcement (`Literal[25, 50, 100]`). FastAPI generates
    422 on enum miss.
  - `q`: `Query(default=None, min_length=1, max_length=200)`.
    Empty string from the FE is stripped by the FE before send;
    BE treats `None` and missing the same way.
- Loads the dataset's row metadata (columns list) + parquet
  path. 404 if no DB row.
- Calls `_query_dataset_rows(parquet_path, column_names,
page, page_size, q)` → returns `(rows, total)`.
- Returns a Pydantic `RowsPage` (new model in
  [`models/common.py`](../../../workspace/apps/backend/app/models/common.py)
  or a route-local class). `additionalProperties: false` enforced
  via `ConfigDict(extra="forbid")`.

### 4. `_query_dataset_rows` helper

- Located in a new module
  [`app/ingest/rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
  (sibling to the existing `csv_parser.py` / `excel_parser.py`).
- Signature:
  `query_dataset_rows(parquet_path: Path, columns: list[str],
page: int, page_size: int, q: str | None) -> tuple[list[list[str | None]], int]`.
- Opens an ephemeral `duckdb.connect(":memory:")`. Builds the
  SELECT list with `CAST("col" AS VARCHAR)` per column (column
  names quoted to handle spaces / special chars). Builds the
  WHERE clause from `q` (OR-joined `lower(CAST(...)) LIKE ?`
  predicates with `lower(q)`-bound param). Runs:
  - `SELECT … LIMIT ? OFFSET ?` for the page rows.
  - `SELECT COUNT(*) FROM read_parquet(?)` (with WHERE if `q`
    set) for the total.
- Converts the row tuples to `list[list[str | None]]`. Nulls
  stay as `None`.

### 5. Pytest

- New tests in
  [`workspace/apps/backend/tests/test_datasets_detail_get.py`](../../../workspace/apps/backend/tests/test_datasets_detail_get.py):
  - happy: commit dataset → GET `/datasets/{id}` → 200 with
    matching shape; conformance-validate via the contract.
  - 404: unknown id → `{ code: "not_found" }` 404.
- New tests in
  [`workspace/apps/backend/tests/test_datasets_rows_get.py`](../../../workspace/apps/backend/tests/test_datasets_rows_get.py):
  - happy default: commit + GET `/datasets/{id}/rows` → 200,
    rows = full sample (3 rows from `sample.csv`), page=1,
    pageSize=50, total=3.
  - page_size override: `?page_size=25` → same payload.
  - out-of-range page: `?page=99` → 200 with empty rows + page=99.
  - 404: unknown id.
  - 422 invalid page_size (`?page_size=37`).
  - 422 invalid id (`/datasets/garbage/rows`).
  - 422 q too long (`?q=<201 chars>`).
  - q match: `?q=Alice` → 1 row, total=1.
  - q case-insensitive: `?q=alice` → same 1 row.
  - q matches numeric/date cell: `?q=42.5` or `?q=2024-01-15`.
  - q zero-match: `?q=ZZZZZ` → empty rows + total=0.
- Each happy 200 conformance-validates via the existing
  [`tests/_conformance.py`](../../../workspace/apps/backend/tests/_conformance.py)
  helper.

### 6. Backwards compatibility of `parsed.parquet`

- Existing tests in `test_datasets_batch.py` /
  `test_datasets_list.py` write + read parquet via the OLD
  sample-only path. After R35 the path always writes the full
  table. Tests should continue to pass because:
  - The sample dataset (3 rows) fits trivially in the full-table
    write.
  - The list-GET reads SQLite metadata, not parquet. No
    behavior change there.
- No data migration needed — each test starts with an empty
  tmp directory per `_isolated_backend_data` fixture.

### 7. Round file + checks

- This Round_35.md.
- `pytest workspace/apps/backend/tests/` — all existing tests
  stay green; new tests pass.
- `pnpm --filter @mdd/contracts test` — still green (no
  contract changes this round).
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No FE code.** R36 wires `datasetsApi.get()` /
  `.getRows()` + builds the page.
- **No contract changes.** R34 locked the contracts; R35 only
  implements against them.
- **No DuckDB-file-per-dataset.** Parquet stays canonical on
  disk; DuckDB is the in-memory query engine, not a storage
  format.
- **No row caching.** Each request re-reads parquet via
  DuckDB; AntD's pagination + R31's TanStack cache cover the
  client-side hit rate.
- **No FTS index.** Substring scan is naive O(rows × cols).
  Promote when 100k+ rows × frequent `?q=` makes it visible.
- **No column-projection optimization.** The handler reads all
  columns even though only `kept_names` from the dataset's
  metadata matter — DuckDB does column pushdown when reading
  parquet, so this is automatic.
- **No streaming.** Pages are bounded at 100 rows; the full
  response body is small enough to materialize in one
  `JSONResponse`.
- **No SQL injection hardening beyond parameterized binds.**
  DuckDB query strings interpolate `column_names` directly
  (quoted via `"`); these names come from the dataset's
  committed `columns_json` which was set at commit time from
  parser output. They are not user-controlled at query time.
  The `q` value is a bound parameter.

## Plan

- [x] Confirm scope at planning review (decisions 1-5 above;
      auto-mode picks; user redirected during planning to
      lock DuckDB-as-query-engine).
- [x] Author
      `workspace/apps/backend/app/ingest/parquet_writer.py`
      with `write_csv_to_parquet()` (DuckDB COPY) +
      `write_excel_to_parquet()` (pandas read_excel + to_parquet).
- [x] Author
      `workspace/apps/backend/app/ingest/rows_reader.py` with
      `query_dataset_rows(parquet_path, columns, page,
page_size, q)`.
- [x] Update `datasets.py` `commit_datasets_batch` to call the
      new parquet writer instead of the sample-based path.
- [x] Add `GET /datasets/{id}` handler in `datasets.py`,
      grouped with the existing list/patch/delete handlers via
      a shared `_dataset_from_row()` helper.
- [x] Add `GET /datasets/{id}/rows` handler in `datasets.py`
      with a `RowsPage` Pydantic model
      (`additionalProperties: false`).
- [x] Author `tests/test_datasets_detail_get.py` (3 cases — 200 + 404 + 422-malformed-id).
- [x] Author `tests/test_datasets_rows_get.py` (13 cases —
      default page, page_size override, out-of-range, 404,
      page_size 422, id 422, q-too-long 422, q-substring,
      q-case-insensitive, q-numeric-cell, q-date-cell,
      q-zero-match, q-empty-string).
- [x] Run `pytest workspace/apps/backend/tests/` — 94/94 green
      (was 78; +16 from R35).
- [x] Run `pnpm --filter @mdd/contracts test` — 13/13 green
      (no contract changes; sanity).
- [x] Run `npx markdownlint-cli2` — 0 errors over 87 files.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **DuckDB `read_csv_auto` parameter drift between parse +
  commit.** The wizard's `parse_csv` calls `read_csv_auto` to
  build the column dtype list; commit will call it again to
  write the parquet. If the two invocations infer different
  dtypes (e.g. one with `skip_rows`, one without), the parquet
  schema diverges from the committed `columns_json`. Mitigation:
  pass identical options into both calls; document the option
  contract in the new helper's docstring.
- **Excel range / has_header logic duplication.** The Excel
  parser already handles `range_` + `has_header` + column-name
  cleanup. The new `write_excel_to_parquet()` repeats some of
  it. Mitigation: factor the read-only piece out of
  `parse_sheet()` into a shared `_read_excel_df(...)` helper if
  the duplication exceeds ~10 lines; otherwise inline (one-time
  cost beats premature abstraction).
- **DuckDB DATE/TIMESTAMP CAST format.** `CAST(DATE
'2024-01-15' AS VARCHAR)` → `'2024-01-15'`. `CAST(TIMESTAMP
'2024-01-15 14:02:00' AS VARCHAR)` → `'2024-01-15 14:02:00'`.
  The FE's `Intl.DateTimeFormat` accepts both via `new Date()`.
  If the wire format causes ambiguity (e.g. timezone interpretation
  drift), R36 will surface it in verification; document the format
  in the contract.md.
- **Column quoting edge case.** Column names with `"` in them
  break naive `"col"` quoting. Parser cleans column names with
  `.strip()` only — embedded quotes are theoretically possible.
  Mitigation: SQL-escape via `"` doubling
  (`name.replace('"', '""')`); document the rule. Unlikely in
  practice but cheap to defend.
- **Window function over zero matches.** Rejected — `COUNT(*)
OVER ()` returns zero rows when LIMIT 0, leaving the FE
  unable to read `total`. Two-query approach (rows + COUNT)
  works in all cases.
- **Parser sample-row format vs parquet dtype.** Today's
  parquet stores everything-as-string (sample_rows is
  list[str|None]). New parquet preserves the parser's inferred
  dtypes. R36's display layer must handle both shapes (during
  the cutover) OR the test suite must verify only new-format
  datasets work. Mitigation: this round writes only new-format
  parquet; tests start from a clean tmp dir per fixture, so no
  legacy data crosses the boundary.

## Do

**Full-parquet write at commit.**

- New module
  [`app/ingest/parquet_writer.py`](../../../workspace/apps/backend/app/ingest/parquet_writer.py)
  with two helpers:
  - `write_csv_to_parquet(src, dst, *, skip_rows, has_header,
kept_columns)` — DuckDB `read_csv_auto(...)` into a temp
    table, then `COPY (SELECT ... ) TO '<dst>' (FORMAT
'parquet')`. The SELECT uses aliases (`"raw" AS
"committed"`) instead of `ALTER TABLE RENAME COLUMN` —
    needed because DuckDB's `header=false` defaults
    (`column0`, `column1`, …) collide with our 1-indexed
    `column1`, `column2`, … targets.
  - `write_excel_to_parquet(src, dst, *, sheet, range_,
has_header, kept_columns)` — mirrors `parse_sheet`'s read
    shape (engine, range parsing, header normalization)
    without `SAMPLE_LIMIT`, then `df.to_parquet(...)`.
- Two SQL-grammar gotchas:
  - DuckDB rejects `?` placeholders in `COPY ... TO ?` — the
    target must be a string literal. Added a
    `_quote_string_literal()` helper that single-quotes with
    `''` escaping; the dst path is server-controlled
    (`dataset_dir(workspace_id, dataset_id)`) with safe
    components but defending is cheap.
  - `read_csv_auto(?, header=False)` returns columns named
    `column0..N-1`; renaming each to `column1..N` would
    collide because target names already exist in the table.
    Switched to SELECT aliasing, which is also cleaner
    (no schema mutation, single statement).
- Batch commit handler updated: staged tuples carry
  `(Dataset, ParseOptions, kept_names)` instead of
  `(Dataset, DataFrame)`. The write loop dispatches by
  `source_format` and calls the right parquet writer. Pandas
  import removed from `datasets.py` — DuckDB owns the CSV
  path, openpyxl owns the Excel path via pandas-internally.

**Paged rows reader.**

- New module
  [`app/ingest/rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
  with
  `query_dataset_rows(parquet_path, columns, *, page,
page_size, q) → (rows, total)`.
- Two SQL queries per request: one `SELECT CAST(...) FROM
read_parquet(?) WHERE ... LIMIT ? OFFSET ?` for page rows,
  one `SELECT COUNT(*) FROM read_parquet(?) WHERE ...` for
  total. Two queries beat `COUNT(*) OVER ()` window which
  breaks when LIMIT 0 returns zero rows (FE can't read
  `total`).
- Substring filter built dynamically: when `q` is set, the
  WHERE clause OR-joins
  `lower(CAST("<col>" AS VARCHAR)) LIKE ?` over every column.
  The lowercased `%q%` parameter is bound N times (once per
  column predicate). DuckDB pushes the predicate down into
  the parquet reader automatically.
- DuckDB's `CAST(... AS VARCHAR)` produces the wire shapes
  the contract expects: booleans → `'true'` / `'false'`,
  dates → `'YYYY-MM-DD'`, timestamps →
  `'YYYY-MM-DD HH:MM:SS'`, integers/floats in decimal form,
  NULL → Python `None` → JSON `null`. The FE's
  dtype-aware display layer re-formats from
  `Dataset.columns[].dtype` (no round-trip risk).

**New route handlers.**

- `_dataset_from_row(row) → Dataset` extracted as a shared
  hydrator — used by both `list_datasets` and the new
  `get_dataset`. (Behavior of `list_datasets` unchanged; the
  helper just centralizes the column-projection logic. R36
  can reuse it if it wants a route-level cache prefill.)
- `GET /datasets/{id}` — SQLite SELECT by id; 404 with
  `ApiErrorNotFound` envelope on miss; 200 with full
  `Dataset` shape on hit.
- `GET /datasets/{id}/rows` — load dataset metadata (404 on
  miss), call `query_dataset_rows()` with the canonical
  column list from `columns_json`, return a `RowsPage`
  Pydantic model (`extra="forbid"` to match the contract's
  `additionalProperties: false`).

**Discovered constraint: FastAPI doesn't coerce query strings
to `Literal[int,...]`.**

- Tried `Annotated[Literal[25, 50, 100], Query()]` first; got
  422 on a valid `?page_size=25` request because Pydantic
  matched the raw string `"25"` against int literals and
  rejected it.
- Fix: declared `page_size: Annotated[int, Query()] = 50` and
  enforce the enum manually inside the handler
  (`raise HTTPException(422, ...)` if not in
  `_PAGE_SIZE_ALLOWED`). The 422 detail differs in shape from
  FastAPI's auto-generated envelope, but the contract just
  documents the FastAPI-default shape for 422; tests only
  assert `status_code == 422`.
- The route's response model still types `pageSize:
Literal[25, 50, 100]` because the value is server-set and
  validated; Pydantic is happy with the int.

**Test pipeline.**

- New file
  [`tests/test_datasets_detail_get.py`](../../../workspace/apps/backend/tests/test_datasets_detail_get.py)
  with 3 cases — 200 happy + 404 + 422 malformed id.
- New file
  [`tests/test_datasets_rows_get.py`](../../../workspace/apps/backend/tests/test_datasets_rows_get.py)
  with 13 cases — default page, page_size override (proves
  the `Literal` workaround), out-of-range page returns 200
  empty, 404 unknown id, 422 invalid page_size,
  422 malformed id, 422 q-too-long, q substring match,
  q case-insensitive, q matches numeric cell (`?q=42.5`),
  q matches date cell (`?q=2024-01-15`), q zero-match,
  q empty-string → 422.
- Conformance: happy-200 and 404 responses validated against
  the R34 YAMLs via the existing `validate_response()`
  helper (`tests/_conformance.py`).

**Check pipeline.**

- BE pytest: **94/94 green** (was 78 pre-R35; +16 from R35's
  new tests). All previous tests stayed green (R35's
  full-parquet write doesn't disrupt existing dataset
  read/write flows — the sample csv's 3 rows fit trivially in
  the full-table write).
- `pnpm --filter @mdd/contracts test`: **13/13 green** (no
  contract changes this round; sanity check passed).
- `npx markdownlint-cli2`: 0 errors over 87 files.
- `git diff --stat`: only `workspace/apps/backend/` files
  touched (1 modified + 2 new in `app/ingest/`, 2 new in
  `tests/`) plus this round file. Zero FE, zero contracts,
  zero shared schemas.

## Check

- [x] `parquet_writer.py` exists with `write_csv_to_parquet()` + `write_excel_to_parquet()`; commit handler uses them
      in place of the sample-based path.
- [x] `rows_reader.py` exists with `query_dataset_rows()`.
- [x] `GET /datasets/{id}` returns the Dataset shape; 404 on
      unknown id with `{code: "not_found"}`.
- [x] `GET /datasets/{id}/rows` returns paged `RowsPage`;
      `?page` / `?page_size` / `?q` all honored;
      `additionalProperties: false` enforced; cell
      stringification uses DuckDB CAST.
- [x] Pytest: existing suite stays green (78 → 94);
      `test_datasets_detail_get.py` (3) +
      `test_datasets_rows_get.py` (13) all pass.
- [x] Conformance-validate happy 200 + 404 responses against
      the R34 contracts via `validate_response()`.
- [x] `pnpm --filter @mdd/contracts test` still 13/13.
- [x] `npx markdownlint-cli2` 0 errors.
- [x] No FE / contract files changed (verified via
      `git diff --stat`).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
      passes.
- [x] All Plan + Check checkboxes flipped before Status flips
      to Review.

## Act

**Learnings**:

- **DuckDB query engine + parquet storage is a strict upgrade
  over pandas-in-handler.** The substring filter would have
  been ~20 lines of pandas with manual case-folding +
  cell-stringification + null-guard. In SQL it's
  `WHERE lower(CAST(c AS VARCHAR)) LIKE ?` OR-joined. DuckDB
  pushes the predicate into the parquet reader; no full-load
  required. Worth keeping the pattern in mind for future
  per-dataset queries (e.g. when the query/dashboard feature
  lands — same DuckDB-on-parquet pattern scales).
- **DuckDB SQL gotchas worth a docstring**: (a) `COPY ... TO`
  requires a literal path, not a `?` bind; (b) `header=false`
  yields `column0..N-1` which collides with our 1-indexed
  `column1..N` targets if you `ALTER TABLE RENAME` — SELECT
  aliasing sidesteps both issues and is cleaner anyway.
- **FastAPI `Annotated[Literal[int, int, int], Query()]`
  doesn't coerce query strings.** This is a real ergonomic
  miss in FastAPI/Pydantic. The workaround (declare `int`,
  enforce enum manually) is fine but should be a known
  pattern; documented in this round's Do log. If we see this
  pattern a second time, promote a helper.
- **Hidden 10-row cap was real.** The wizard's
  `SAMPLE_LIMIT = 10` produced a `parsed.parquet` that was
  10 rows even when `rowCount` reported 2,481. R33's design
  exposed it (the rows-GET endpoint forced a real test); R35
  fixed it. **Lesson**: building the first read-the-full-data
  surface is the right time to discover storage assumptions
  the wizard never had to honor.
- **Server-controlled SQL interpolation is safe.** I
  interpolated dst paths, column names, and the column-count-
  derived OR clause directly into SQL strings. All three come
  from server-controlled sources (path = `dataset_dir()`,
  column names = committed `columns_json`, column count =
  derived). The only user-controlled bind is `q`, which
  remains a parameter. Documented the boundary in
  `rows_reader.py`'s docstring.

**Promotions** _(none — implementation round; the
DuckDB-on-parquet query pattern lives in
[rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)
and is self-evident from the code going forward)_:

**Follow-ups (not promotions, just notes):**

- **FTS promotion trigger**: when 100k+ rows × frequent `?q=`
  makes the linear OR-scan visible. DuckDB has FTS
  extensions; promote when a real user complains. Today's
  POC scale never hits this.
- **Sorting**: would extend `query_dataset_rows()` to accept
  an `order_by: str | None`. Trivial SQL addition; defer
  until a R∞ round pulls it in (deferred in R33 design).
- **Column projection in rows-GET**: today the handler reads
  every committed column. The contract doesn't expose a
  `?fields=` param. If a real user has wide datasets (50+
  cols) and wants to inspect only a subset, that's a future
  contract extension.
- **`?q=` matched-substring highlighting**: deferred per R33
  design. If/when implementation lands, the BE could return
  match-position metadata (e.g.
  `match_indices: number[][]`) so the FE doesn't re-scan
  client-side. Cheaper for the FE but adds wire weight.
- **`_dataset_from_row()` helper**: extracted in this round
  for `get_dataset` to share with `list_datasets`. If it
  grows a third caller (R∞ — query feature?), consider
  moving to `models/common.py` so it's reachable from any
  router.
- **422 detail-shape consistency**: my handler's manual
  page_size 422 has shape `{detail: "page_size must be ..."}`
  (FastAPI default for `HTTPException(detail=str)`). The
  contract documents the array-of-entries shape FastAPI uses
  for request-validation. The difference is harmless in
  practice (FE branches on status_code, not body shape for 422) but worth flagging if a future round tightens 422
  shape conformance.

## Feeds into → Round_36 (FE: DatasetDetailPage)

R35 hands forward:

- **Two live BE routes** returning shapes that match R34's
  contracts (validated by `validate_response()` in tests).
- **Parquet stores full data**, so the rows endpoint at
  `?page_size=50` returns up to 50 rows even on a 2,481-row
  dataset. The dataset-detail page won't be misleading.
- **DuckDB query engine** scales the substring filter to
  whatever fits in the upload limit; FTS promotion remains a
  future trigger.
- **`RowsPage` Pydantic model** lives in the backend; R36's
  FE type mirror lives in
  `apps/builder/src/features/data-management/datasets/types.ts`.

R36 picks up the **FE round** (F in DCBF):

- `datasetsApi.get(id)` + `.getRows(id, page, pageSize, q?)`
  in `apps/builder/src/api/datasetsApi.ts`.
- `useDatasetQuery` + `useDatasetRowsQuery` hooks.
- `DatasetDetailPage` route at `/data-management/datasets/:id`
  with breadcrumb, header actions, metadata strip,
  debounced `<Input.Search>`, paged `<Table>`, AntD
  `<Pagination>`, loading skeleton, 404 state, zero-rows state,
  no-match state.
- List-page row-click handoff: `<Table>` `onRow` → navigate.
- i18n keys under `datasets.detail.*`.
