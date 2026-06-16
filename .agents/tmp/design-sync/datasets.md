# Detect — datasets (CODE-TRUTH + drift)

Date: 2026-06-17
Domain: `.agents/design/data-management/datasets/` (+ the dataset CRUD claims in `_shared/crud-hygiene.md`)
Rule: THE CODE IS THE SOURCE OF TRUTH. Every divergence below is doc-says-X / code-does-Y.

---

## 1. CODE-TRUTH map

### 1.1 Routes

Backend files read: `app/routers/datasets.py`, `app/routers/uploads.py`.

| Method | Path | Request body / params (exact field names) | Success | Error statuses + codes/details |
| --- | --- | --- | --- | --- |
| POST | `/uploads` | multipart: `file` (UploadFile), `sourceFormat` (Form, `Literal["csv","excel"]`) | 200 `TempUploadCsv` or `TempUploadExcel` (NOT 201) | 413 `"file too large"`; 415 `"sourceFormat/extension mismatch"` / `"excel read failed: …"` / `"excel workbook has no sheets"`; 422 `"unknown sourceFormat"`; 422 CSV parse failure (str(exc)) |
| POST | `/uploads/{temp_id}/parse` | JSON `_ParseRequest`: `items: [{ sheet?: str, parse_options?: ParseOptions }]` (min_length 1) | 200 `{ "results": [ … ] }` (per-item `status` ok/failed) | 404 `"temp_id unknown"` / `"temp file missing"` / `"temp_id has unknown sourceFormat"`; 422 missing/unknown sheet (excel), `"CSV uploads accept exactly one item"`, `"CSV items must not carry sheet"` |
| POST | `/workspaces/{id}/datasets/batch` | JSON `_BatchRequest`: `temp_id` (`^tmp_[0-9a-f]{16}$`), `items: [_BatchItem]` (min 1). `_BatchItem`: `sheet?`, `name` (1–120), `parse_options?`, `column_overrides?: dict[str,ColumnOverride]`, `excluded_columns?: list[str]`, `target_dataset_id?` (`^ds_[0-9a-f]{8}$`) | 201 `list[Dataset]` (`response_model_exclude_none`) | 404 `"workspace or temp_id not found"`; 422 `target_dataset_id` reserved, excel-needs-sheet, override date/datetime needs `format`, excluded leaves zero cols; 409 `unknown_column` (overrides/exclusions ref missing col), 409 `name_taken` (unique index) |
| PATCH | `/datasets/{id}` (`id` ~ `ID_PATTERNS["dataset"]`) | JSON `RenameDatasetBody`: `name` (1–`NAME_LENGTHS["dataset_max"]`) | 200 `Dataset` (exclude_none) | 404 `not_found`; 409 `name_taken` |
| DELETE | `/datasets/{id}` | — | 204 (no body) | 404 `not_found`. **App-level cascade: deletes `queries WHERE source_id = <ds>` then the dataset, then rmtree the dir** (R79) |
| GET | `/datasets/{id}` | — | 200 `Dataset` (exclude_none) | 404 `not_found` |
| GET | `/datasets/{id}/rows` | query: `page` (≥1, def 1), `page_size` (def 50; validated against `PAGE_SIZES`), `q` (1–200), per-column `f<N>_op/_val/_min/_max`, `aq` (DNF JSON) | 200 `RowsPage` = `{ rows: (str\|null)[][], page, pageSize, total }` | 404 `not_found`; 422 off-enum page_size, `filter_*` codes, `advanced_query_malformed`. Out-of-range page → 200 empty rows |
| GET | `/datasets` | query: `workspace_id?` (`ID_PATTERNS["workspace"]`) | 200 `list[Dataset]` ordered `created_at DESC, id DESC` | — |

### 1.2 Model / columns / persistence

- ORM reality: **mixed**. Schema-of-record is **SQLModel** (`app/db_models.py`) + **Alembic** migrations (`0001_baseline`, `0002_query_source_id`). But every router handler uses **raw `sqlite3`** via `get_conn()` (`con.execute(...)`), NOT the ORM session. R78 (persistence foundation) + R79 (source_id cleanup) landed AFTER all five design docs were last written.
- `datasets` table columns (snake_case, all `TEXT`/`INTEGER`): `id` PK, `workspace_id` (FK→workspaces, ON DELETE CASCADE), `name`, `size_bytes`, `row_count`, `column_count`, `columns_json`, `source_format`, `sheet_name?`, `created_at`. CHECKs: name 1–120, size_bytes≥0, row_count≥0, column_count≥1, source_format IN (csv,excel). Indexes: `idx_datasets_workspace_id`, `idx_datasets_name_unique` (workspace_id,name UNIQUE).
- Wire (camelCase) vs DB (snake_case): `workspaceId`↔`workspace_id`, `sizeBytes`↔`size_bytes`, `rowCount`↔`row_count`, `columnCount`↔`column_count`, `columns`↔`columns_json` (JSON), `sourceFormat`↔`source_format`, `sheetName`↔`sheet_name`, `createdAt`↔`created_at`.
- Row storage: **DuckDB over Parquet**, not pyarrow. FS layout (`app/storage.py`): committed = `data/datasets/<ws>/<ds>/{original.<ext>, parsed.parquet, source.json}`; temp = `data/uploads_tmp/<temp_id>/{original.<ext>, meta.json}`. **`meta.json`** (not `metadata.json`). No per-sheet `parsed.<sheetkey>.parquet` / `preview.<sheetkey>.json` files — the temp dir holds only the single `original.<ext>` + `meta.json`; sheet parse is re-read on demand, never persisted to per-sheet files.
- Rows reader (`app/ingest/rows_reader.py`): ephemeral `duckdb.connect(":memory:")` per call over `read_parquet(?)`; cells stringified via `CAST(col AS VARCHAR)`. Also contains the R71+ join execution path (`build_joined_select`, `query_joined_rows`, `build_effective_columns`) — out of datasets-doc scope but lives in this domain's code.

### 1.3 FE components + homes (per surface)

All under `apps/builder/src/features/data-management/datasets/`. **No dataset surface in `@mdd/ui`** EXCEPT `<PagedRowsView>` (lives in `@mdd/ui`, imported from `../_shared/PagedRowsView`).

- List: `DatasetsPage.tsx` (contains `DatasetTable`, `EmptyDropZone`, `SourceIcon`, `relativeTime` inline — `DatasetTable`/`WorkspaceFilter` are NOT separate files).
- Detail: `DatasetDetailPage.tsx` (contains `MetadataStrip`, `SourceIcon` inline; no separate `DatasetMetadataStrip` / `RowSearchBar` files). Uses `<PagedRowsView>` from `@mdd/ui`.
- Hooks: `hooks.ts` — `useDatasetsQuery`, `useDatasetQuery`, `useDatasetRowsQuery`, `useUploadInitMutation`, `useUploadParseMutation`, `useDatasetsCommitMutation`, `useRenameDatasetMutation`, `useDeleteDatasetMutation`.
- Types: `types.ts`.
- Upload wizard (`upload/`): `DatasetNewPage.tsx`, `UploadSourceStep.tsx`, `UploadSheetStep.tsx`, `UploadMetadataStep.tsx`, `UploadPreviewStep.tsx`, `UploadConfirmStep.tsx`, `state.ts`. **No `UploadStepper.tsx`** — the stepper is an inline AntD `<Steps>` in `DatasetNewPage`.
- Filters (`filters/`): `types.ts`, `serialize.ts`, `useFiltersState.ts`, `FilterPopover.tsx`, `ActiveFilterChips.tsx`. (No separate `FilterTrigger` / per-dtype `*FilterEditor` files / `_filter-editors/` dir — the trigger + editors are inside `FilterPopover.tsx`.)
- Advanced query (`advanced-query/`): `parser.ts`, `serialize.ts`, `types.ts`, `reference.ts`, `AdvancedQueryInput.tsx`, `AdvancedQueryHelp.tsx`, `useAdvancedQueryState.ts`.

### 1.4 Hooks / query keys / invalidations

- `DATASETS_QUERY_KEY = ['datasets']`; list key `['datasets', { workspaceId }]` or `['datasets']`.
- Detail key `['datasets', { id }]`.
- Rows key `['datasets', { id }, 'rows', { page, pageSize, q, filters, aq }]` (filters = `cacheKeyForFilters`, aq = `groupsToParam`). `placeholderData: (prev)=>prev`.
- Commit mutation invalidates `['datasets']`. Rename invalidates `['datasets']` + `['workspaces']`. Delete invalidates `['datasets']`.

### 1.5 Advanced-query grammar actually accepted (`advanced-query/parser.ts`)

- `query := group (OR group)*`, `group := atom (AND atom)*`, `atom := key ':' op-prefix? operand`. AND binds tighter than OR → emits DNF `FilterPredicate[][]`.
- Keys: quoted (`"customer number":…`) or bare; case-insensitive column match.
- Prefixes accepted: `>=`, `<=`, `!=`, `>`, `<`, `~` (+ unicode aliases `≠`→`!=`, `≥`→`>=`, `≤`→`<=`). Empty prefix = equals.
- Per-dtype maps: numeric `''→equals, !=→ne, >→gt, <→lt, >=→gte, <=→lte`; string `''→equals, ~→contains, !=→ne` (others error); date `''→equals, !=→ne, >→after, <→before, >=→gte, <=→lte`; boolean: operand `true`/`false`→`is_true`/`is_false` (no prefix allowed).
- Error codes: `missing_colon, missing_column_name, unknown_column, empty_value, unsupported_operator, unparseable_value, invalid_boolean, expected_predicate, expected_operator, dangling_operator, unterminated_quote`.
- Operand-less ops (`is_null`/`is_empty`/…) and `between` have NO grammar surface (matches doc).

### 1.6 Filter operators actually serialized (`filters/types.ts`, `serialize.ts`, BE `ingest/filters.py`)

`OPS_BY_DTYPE` (FE and BE identical):
- string: `contains, equals, ne, starts_with, ends_with, is_empty, is_not_empty, is_null, is_not_null`
- integer/float: `equals, ne, gt, lt, gte, lte, between, is_null, is_not_null`
- date/datetime: `equals, ne, before, after, gte, lte, between, is_null, is_not_null`
- boolean: `is_true, is_false, is_null, is_not_null`

URL params `f<N>_op/_val/_min/_max`. BE 422 codes: `filter_col_out_of_range`, `filter_op_dtype_mismatch`, `filter_operand_shape`, `filter_value_unparseable`, `advanced_query_malformed`.

### 1.7 Upload wizard steps actually wired (`upload/state.ts`, `DatasetNewPage.tsx`)

- CSV path: `source → metadata → preview → confirm` (4 steps).
- Excel path: `source → sheet → metadata → preview → confirm` (5 steps).
- `POST /uploads` on leaving source; Excel `POST /uploads/{temp_id}/parse` (batch over selected sheets) on leaving sheet; CSV re-parse also goes through `/uploads/{temp_id}/parse` (R26 — CSV re-parse IS implemented, `reparseSheet` works for both). Commit = `POST /workspaces/{id}/datasets/batch` with top-level `temp_id` + per-item `{ name, sheet?, parse_options?, column_overrides?, excluded_columns? }`.

### 1.8 Field inventory (Dataset wire shape)

`id, workspaceId, name, sizeBytes, rowCount, columnCount, columns[{name,dtype}], sourceFormat, sheetName?, createdAt`. `Dtype = string|integer|float|boolean|date|datetime`. Matches FE `types.ts` and BE `models/common.py` exactly.

---

## 2. Drift report (per doc)

### 2.1 `datasets.md` — DRIFTED (low; 4 claims)

1. **stale/behaviour** — § Read/write boundary "Pagination / virtualization … AntD `<Table>`'s default pagination kicks in at **10 rows per page**". CODE: `DatasetsPage` `DatasetTable` sets `pagination={{ pageSize: 20, hideOnSinglePage: true }}` — list page size is **20**, not 10. (stale field)
2. **surface moved (minor)** — Surfaces table lists `DatasetTable` and `WorkspaceFilter` as standalone component surfaces. CODE: both are inline within `DatasetsPage.tsx` (no separate files / `data-component="WorkspaceFilter"` is a `<Select>` inside the page). (surface moved)
3. **resolved-but-restated deferral** — § Read/write boundary still carries "Row click: R∞ … R15 ships row click as a no-op or a tooltip" in the layout prose, even though the same doc's C9 + the strikethrough resolve it to R33. CODE: row click navigates to `/data-management/datasets/:id` (`onRowClick`). The layout-prose bullet is stale relative to the resolved state. (deferred-since-shipped)
4. **stale model framing** — § Dataset data model "Deferred fields: `updatedAt`, `parsedAt`, `parseDurationMs` …". `source.json` on disk does NOT carry `parsedAt` (it carries `temp_id, sourceFormat, sheet, originalName`); not wire-facing, minor. (stale field)

### 2.2 `upload.md` — DRIFTED (high; 9 claims)

1. **vanished helpers** — Surfaces/endpoint-shape name `parse_excel()`, `read_excel_sheets()`, `cast_columns()` ingestion helpers. CODE: none exist. Real helpers are `parse_csv` (`ingest/csv_parser.py`), `parse_sheet` + `enumerate_sheets` (`ingest/excel_parser.py`), `write_csv_to_parquet` + `write_excel_to_parquet` (`ingest/parquet_writer.py`). There is **no `cast_columns` re-cast step** — overrides are applied as a dtype relabel on `columns_json` (`_apply_overrides`), the parquet is written with the parsed dtypes, not re-cast. (vanished code)
2. **vanished component** — `UploadStepper` listed as a surface. CODE: no such file; inline `<Steps>` in `DatasetNewPage`. (surface moved)
3. **stale FS layout** — § File storage: temp tree shows `metadata.json`, `parsed.<sheetkey>.parquet`, `preview.<sheetkey>.json`; CSV `<sheetkey>` = `default`, Excel = sanitized sheet name. CODE: temp dir holds only `original.<ext>` + **`meta.json`**; NO per-sheet parsed/preview files are persisted at all. Committed `source.json` keys are `{temp_id, sourceFormat, sheet, originalName}`, not `{sourceFormat, sheetName?, parsedAt}`. (stale field / vanished code)
4. **stale endpoint status** — § Backend endpoint shape + HTTP semantics: `POST /uploads` → **201**. CODE: handler returns **200** (no `status_code=201`; default 200). (behaviour frozen / stale)
5. **stale commit-body shape** — Confirm step shows commit payload `{ items: [{ temp_id, sheet, name, column_overrides? }] }` (per-item `temp_id`). CODE: `temp_id` is a **top-level** field of `_BatchRequest`, NOT per item; items carry `sheet?/name/parse_options?/column_overrides?/excluded_columns?`. (stale field)
6. **vanished 409 semantics** — Endpoint-shape comment + C9: "a commit whose `parse_options` differ from the last `/parse` returns **409**"; "ensure parsed.<sheetkey>.parquet exists; 409 otherwise". CODE: the batch handler **re-parses from `original.<ext>` at commit time** (parse_options are applied fresh in `commit_datasets_batch`); there is NO parsed-parquet-existence check and NO parse_options-mismatch 409. The only 409s are `unknown_column` and `name_taken`. (behaviour frozen — design describes the R15 "move pre-parsed parquet" model that R35 replaced with re-parse-at-commit)
7. **stale commit FS verb** — § File storage "copies … `parsed.<sheetkey>.parquet` → … parsed.parquet … deletes the temp directory". CODE: commit `shutil.copy2`s `original.<ext>` and **writes a fresh `parsed.parquet`** via the parquet writer; it does **not** delete the temp dir (TTL sweep handles it). (behaviour frozen)
8. **stale name validation** — C8 / Confirm "validation is **1–80 chars** (same as Workspace name)". CODE: `_BatchItem.name` is **1–120**; rename path uses `NAME_LENGTHS["dataset_max"]` (=120). The doc's own C8 flags this as a known inconsistency, but the BE batch bound is 120, not 80. (stale field — partially self-flagged)
9. **stale parse-init return shapes** — § Parse-time: CSV init returns `{ …, schema, sampleRows, rowCount, sizeBytes }`; Excel `{ …, sheets:[{name,rowCount,columnCount}], sizeBytes }`. CODE: CSV returns `TempUploadCsv{temp_id, sourceFormat, sizeBytes, csvPreview:{columns, rowCount, sampleRows}}` (field is `csvPreview.columns`, not `schema`); Excel `TempUploadExcel{… sheets:[SheetSummary{sheet, rowCount, columnCount, usedRange?}]}` (key is `sheet`, not `name`; adds `usedRange`). (stale field)

### 2.3 `dataset-detail.md` — DRIFTED (low; 3 claims)

1. **stale page_size enum (URL state)** — § URL state: "page_size ∈ {10, 25, 50, 100}". This matches `PAGE_SIZES = [10,25,50,100]` ✓. NO drift there. (Earlier suspicion cleared.)
2. **surface moved** — Surfaces table names `DatasetMetadataStrip` and `RowSearchBar` as standalone components. CODE: `MetadataStrip` is inline in `DatasetDetailPage.tsx`; there is no `RowSearchBar` component — the search is an inline `<Input.Search>` in the page. (surface moved)
3. **stale BE dep note** — Surfaces table: rows route "FastAPI native, **pyarrow** for paged Parquet read". CODE: paged read uses **DuckDB** (`duckdb.connect(":memory:")` + `read_parquet`), not pyarrow. (stale field)
4. **resolved-open-question not folded** — header actions: doc describes `[+ Save as Query]` left of `[Rename]` and (R72 amend prose) "Join with related dataset moved into Actions ▾". CODE matches the R72 state (Save-as-Query button + Actions ▾ dropdown with Join/Rename/Delete), BUT the ASCII "Loading/404/zero-rows" mini-headers still draw `[Rename] [Delete]` as separate buttons (pre-R72 two-button header). Illustrative-only, minor. (mermaid/ascii branch stale)

### 2.4 `dataset-filters.md` — NOT DRIFTED (0 material; 1 nit)

- Predicate vocabulary, URL param shapes, per-dtype operator sets, `ne`/`gte`/`lte` (R55), no-match copy, cache key, `replace:true` policy, popover lifecycle — all match `filters/*` + `ingest/filters.py` exactly.
- Nit (surface naming, not behaviour): Surfaces table lists `FilterTrigger`, `StringFilterEditor`/`NumericFilterEditor`/`DateFilterEditor`/`BooleanFilterEditor` in a `_filter-editors/` dir. CODE: these are all inside `filters/FilterPopover.tsx`; no `_filter-editors/` dir. Counts as surface-moved but immaterial to contract/behaviour. (1 surface-moved nit)

### 2.5 `advanced-query.md` — NOT DRIFTED (0)

- Grammar, prefix→op maps (incl. R55 `gte`/`lte`/`ne` and unicode aliases), DNF emission, error codes, `aq` JSON transport, 300ms debounce + Enter, apply-on-valid / no-apply-on-error, URL canonical re-serialization, malformed-drop-to-`[]`, `?` help popover (C18–C22), in-field × + Esc, cache key — all verified against `parser.ts` / `serialize.ts` / `reference.ts` / `useAdvancedQueryState.ts` / `ingest/filters.py`. This doc is the cleanest in the domain.

### 2.6 `_shared/crud-hygiene.md` (dataset CRUD claims only) — DRIFTED (1 claim)

- Match: `PATCH /datasets/{id}` body `{name}` → 200 / 404 `not_found` / 409 `name_taken`; `DELETE /datasets/{id}` → 204 (parquet deleted) / 404 `not_found`; error-code union `not_found|name_taken|non_empty`; per-workspace name uniqueness. All ✓.
1. **behaviour frozen** — "`DELETE /datasets/{id}` … R23 design has **no 409 path because datasets have no dependents**" / cascade section frames datasets as terminal. CODE (R79): `delete_dataset` now runs an **app-level cascade** — `DELETE FROM queries WHERE source_id = <ds>` before deleting the dataset (a dataset-rooted Query is a dependent). Delete still returns 204 (no 409), so the FE-facing contract is unchanged, but the "no dependents" rationale is now false. (deferred-since-shipped / behaviour frozen)

---

## 3. Per-doc verdict table

| Doc | DRIFTED? | Claim count | One-line summary |
| --- | --- | --- | --- |
| datasets.md | yes (low) | 4 | List page size is 20 not 10; row-click resolved; inline components |
| upload.md | yes (high) | 9 | Vanished helpers (cast_columns/parse_excel), wrong FS layout (meta.json, no per-sheet files), 201→200, top-level temp_id, no parse_options-409, re-parse-at-commit not move-parquet, 1–120 not 1–80 |
| dataset-detail.md | yes (low) | 3 | pyarrow→DuckDB; inline MetadataStrip/no RowSearchBar; stale 2-button ASCII |
| dataset-filters.md | no (1 nit) | 1 | Only surface-file naming nit (editors inside FilterPopover) |
| advanced-query.md | no | 0 | Fully in sync incl. R55 + R54 help affordances |
| crud-hygiene.md (dataset claims) | yes | 1 | "datasets have no dependents" false post-R79 (query cascade in app) |

### De-fragmentation note

The dataset **rows-GET predicate stack** (the `f<N>_*` vocabulary, the `aq` DNF, the `?q=` substring, their AND/OR composition, the `total` semantics, the PAGE_SIZES enum) is split across **≥3 docs**: `dataset-detail.md` (`?q=`, paging, RowsPage), `dataset-filters.md` (per-column predicate vocabulary — declared authoritative), and `advanced-query.md` (grammar + `aq` transport), all pointing at the single `rows-get.contract.yaml` + `ingest/filters.py` + `ingest/rows_reader.py`. One implementation surface, three design homes that constantly cross-reference each other → **de-fragmentation candidate** (a single "dataset rows query" doc, or making `dataset-filters.md` the lone predicate-vocabulary home with the other two linking in). The biggest systemic drift driver is the **R78/R79 persistence rewrite** (SQLModel+Alembic schema-of-record, raw-sqlite handlers, `dataset_id→source_id`, app-level delete cascade) landing after every doc here was last touched — none of the five datasets docs mention SQLModel/Alembic or the dataset→query delete cascade.
