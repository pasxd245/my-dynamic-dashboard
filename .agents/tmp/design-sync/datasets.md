# Design-sync — datasets (CODE-TRUTH + drift)

Date: 2026-10-17
Mode: sync (full) — branch `release/v0.0.1-rc.3`
Domain: `.agents/design/data-management/datasets/`
Rule: THE CODE IS THE SOURCE OF TRUTH. Every item is doc-says-X / code-does-Y.
Docs last synced before R177; this pass covers R177–R187 plus pre-existing drift found
while reading the code.

Code read: `apps/backend/app/routers/datasets.py`, `app/models/common.py`, `app/db_models.py`,
`app/ingest/profile.py`, `alembic/versions/0006_dataset_data_version.py`,
`app/workflow_runs.py` (consumer), `packages/contracts/_shared/{dataset,column}.yaml`,
`packages/contracts/datasets/*`, `apps/builder/src/features/data-management/datasets/{DatasetsPage,DatasetDetailPage,DateCoverage,PropertiesDrawer}.tsx`,
`hooks.ts`, `types.ts`, `_shared/PagedRowsView.tsx`, `lib/formatCell.ts`,
`features/metadata/MetadataPanel.tsx`, `components/AppLayout.tsx`, `main.tsx`, `i18n/locales/en.json`.

---

## 1. CODE-TRUTH highlights (new since last sync)

- **`Column.coverage {min?, max?, blankShare}`** (R178) — `profile_date_coverage(parquet, cols)`
  in `ingest/profile.py`; one DuckDB query (`min`, `max`, NULL count per date/datetime column +
  `count(*)`). Called at commit (per item, over the written parquet, before INSERT) and in
  `_handle_refresh` over the staged parquet before the swap (replace / merge / append). Non-temporal
  columns get `coverage` popped. All-blank → `{blankShare: 1.0}`; empty table → `{blankShare: 0.0}`;
  `blankShare` rounded to 6 places. Stored in `columns_json`; wire omits `min`/`max`/`coverage` when
  None (`model_serializer`). Contract `_shared/column.yaml` `ColumnCoverage`.
- **`Dataset.refreshedAt` + `Dataset.dataVersion`** (R185) — `0006_dataset_data_version`
  (`refreshed_at TEXT NULL` backfilled from `created_at`; `data_version INTEGER NOT NULL DEFAULT 1`).
  Commit: `refreshedAt = createdAt = now`, `dataVersion = 1`. Refresh: `UPDATE … refreshed_at=?,
  data_version=data_version+1` in the same statement as the row swap. Rename / PATCH columns do not
  touch them. `_dataset_from_row` falls back `refreshed_at or created_at`. Read-only in
  `_shared/dataset.yaml`. Consumer: `workflow_runs.py` records leaf `dataVersions`, stale reason
  `data_refreshed`.
- **FE**: `DatasetDetailPage.datasetMetaItems` adds `Data version` → `v{{version}} · {{when}}`
  (`relativeTime(refreshedAt)`); `DateCoverageStrip` under `MetadataStrip`; `MetadataPanel
  kind="dataset"` under that (R180); `PropertiesDrawer` shows `formatCoverage` under each column name.
- `_dataset_from_row` now hydrates list / detail / rename / columns-patch / refresh responses.

## 2. Drift — `datasets.md` (DRIFTED; 23 claims) → rewritten

1. Model lacked `refreshedAt`, `dataVersion` / code has both (server-stamped, read-only).
2. `Column` lacked `coverage` / code has `ColumnCoverage` on committed temporal columns.
3. Persistence listed migrations 0001–0004 / code has 0001–0007; 0006 adds the two columns.
4. Wire↔DB map missing `refreshed_at`, `data_version` / present.
5. Surface table: `Dataset` Pydantic model in `routers/datasets.py` / it lives in `app/models/common.py`.
6. Surface table missing `profile_date_coverage`, `Dataset` SQLModel table, `ColumnCoverage`.
7. Table column order Name…Uploaded / actual: Uploaded, Name, Workspace, Rows, Cols, Size, actions.
8. Source icon is emoji `📊`/`📄` / actual `FileExcelOutlined` (green) / `FileTextOutlined` (blue) + `· <sheet>` suffix.
9. Workspace column "sortable, links to filtered view" / not sortable; link applies filter in place.
10. Breadcrumb shows workspace name when filtered / breadcrumb static `Home ▸ Data Management ▸ Datasets`.
11. "Clear filter ×" next to the dropdown / no such affordance; "All workspaces" option resets.
12. Empty-state copy "Upload your first dataset to get started · Up to 100 MB" / title "Upload your first file to get started", hint "Excel or CSV · up to {maxSize}" from `appConfig.uploadMaxBytes()`, CTA "Upload your first dataset".
13. Filtered empty "No datasets in Marketing yet" + `[+ Upload to Marketing]` / "No datasets in this workspace"; same CTA, which opens the wizard with `?workspace=<id>`.
14. Loading / error / search no-match states undocumented / exist (8-row skeleton, `Alert`, "No datasets match “q”" + clear link).
15. Row Actions menu undocumented in layout / `⋯` menu Refresh · Rename · Delete.
16. Query key `['datasets', { workspaceId }]` always / unfiltered list key is `['datasets']`.
17. Nav snippet `NAV_GROUPS` with 2 items / `dataManagementGroup` built in `AppLayout` with 4 items (workspaces, datasets, queries, workflows), i18n labels.
18. Column-visibility FE hook "invalidating `['datasets', {id}]`" / invalidates the `['datasets']` prefix.
19. Column-visibility 422 list incomplete / also FastAPI `detail[]` 422 for duplicate names (`uniqueItems`) / extra fields.
20. Refresh affordance: replace|merge only / replace, merge, append; refresh now also writes `refreshedAt`, `dataVersion`, re-profiles coverage.
21. Deferred list: `updatedAt`, "column-level affordances" / `refreshedAt` covers row-change time; visibility is the one post-commit column edit; profiling beyond date coverage still not built.
22. Relative-time formatter undocumented (falls back to ISO date after 5 weeks).
23. Refresh affordance: drift review "names the dependent queries + relationships" and "previews that blast radius" / `UploadDriftStep` only diffs columns client-side; no dependents read exists.

## 3. Drift — `dataset-detail.md` (DRIFTED; 24 claims) → rewritten

1. Metadata strip lacks Data version / has `Data version · v<N> · <relative refreshedAt>`.
2. No coverage strip / `DateCoverageStrip` (renders nothing when no column has coverage).
3. No MetadataPanel / `MetadataPanel kind="dataset"` rendered (cross-linked to `_shared/metadata.md`).
4. Properties drawer table: "Profiling NOT BUILT" row / date coverage line now shown per column; broader profile still not built.
5. Properties drawer Dataset section lacks data version / includes it (shared `datasetMetaItems`).
6. Header title emoji + subtitle "Excel · Sheet1 — rows…" / icon + name + format `<Tag>`; subtitle `rows · columns · size · Uploaded <rel>` (no format).
7. 404 state: `history.back()` fallback + "Dataset deleted" toast / button always `navigate('/data-management/datasets')`; no toast.
8. Loading: table-header skeleton + AntD `<Table loading>` overlay on page change / page-level 10-row skeleton, then `PagedRowsView` skeleton; previous rows kept via `placeholderData`, no overlay (native `<table>`, not AntD `<Table>`).
9. Search clear: `[Clear]` text link beside counter / in-field clear icon + Escape; Clear buttons live in the empty states.
10. No-match states: one / four variants (q+filters, filters, q, none); advanced-query-only zero match falls through to "No rows in this dataset" (code quirk — flagged, documented as deferred).
11. Rows-error state undocumented / `Alert` "Couldn't load rows".
12. Header actions `Actions ▾ = Join · Refresh · Rename · Delete` / Join · divider · Properties · Refresh · Rename · Delete; Save button has `PlusOutlined`.
13. Cells: floats "no rounding"; date "ISO-ish `2026-03-01`" / floats max 6 fraction digits; dates via `Intl.DateTimeFormat` 2-digit (locale order, not ISO).
14. Token map: metadata strip label `colorTextTertiary` / `Typography` secondary (`colorTextSecondary`); table header bg `colorFillQuaternary` / solid `#fafafa` literal.
15. Inline YAML copies of three contracts (drift magnet) / replaced by a route table pointing at the authoritative YAML.
16. `DatasetDetail = Dataset` type / no such type; page uses `Dataset`.
17. Rows query key `{ page, pageSize, q }` / `{ page, pageSize, q, filters, aq }`.
18. "Rows are not invalidated" by the visibility mutation / the `['datasets']` prefix invalidation reaches rows too.
19. `useDatasetRowsQuery(id, page, pageSize, q?)` / adds `filters?, advanced?`.
20. Surface table missing `DateCoverageStrip`, `formatCoverage`/`temporalColumns`; peer deps missing `@phosphor-icons/react`, `@ant-design/icons`, `i18next`, `@mdd/ui`.
21. Deferred "Append / re-upload from this page" / Refresh (replace/merge/append) is in `Actions ▾`.
22. Deferred "Row-level CRUD — datasets immutable post-commit" / rows change via refresh.
23. Acceptance C1 lacked data version / coverage; C6 lacked Properties / Refresh.
24. Mermaid diagram lacked RowsError, Empty-by-predicate, Properties, Refresh edges / synced.

## 4. Drift — `upload.md` (DRIFTED) → targeted sync only

Fixed:

1. Commit block: body shown as `items: [{ temp_id, … }]` / `{ temp_id, items: [...] }`; refresh item fields listed.
2. Commit block: no coverage profiling or data-identity stamps / both documented.
3. 201 oneOf listed list|merge / list|merge|append.
4. Refresh UPDATE set lacked `refreshed_at`, `data_version`; "stage under temp names in the dataset dir, write source.json last" / whole staging dir (incl. `source.json`) swapped via `.bak`; coverage re-profiled + `hidden` carried before the swap.
5. Merge / append wire 201 "lands at C" ledger / actual wrapper shapes.
6. "Dataset model implications" (emoji icons, "gains two fields") / rewritten to what create/refresh write.
7. TanStack snippet (`uploadsApi.init`, `parseSheet`, per-item `temp_id`, `useDatasetsCommitMutation(workspaceId)`) / real hook signatures.
8. Lifecycle section / deleted (ledger per skill).

Residual pre-existing drift NOT addressed (needs a dedicated upload.md pass; outside the
R177–R187 change set): surface table omits `UploadDriftStep` and the `upload/` subfolder; round
attribution in body text (`slice 1`, `slice 1b`, "this round", "before R157's fix", "Before R171");
stamped headings kept for inbound anchors (`(R143)`, `(R144)`, `(R145)`, `(R147)`, `(R155)`,
`(R156)`). (upload.md's "named-dependents blast radius — not built" is correct per
`UploadDriftStep.tsx`; `datasets.md` was aligned to it.)

## 5. Drift — `dataset-filters.md` (DRIFTED; 2 claims) → targeted fix

1. Page-chrome ASCII header `[Rename] [Delete]`, emoji title, old subtitle / Save-as-Query + `Actions ▾`, icon + format tag.
2. Metadata-strip ASCII without Data version / replaced with a pointer to dataset-detail's strips.

No filter code (`filters/*`, `ingest/filters.py`) changed since the R176 sync.

## 6. `advanced-query.md` — NOT DRIFTED for R177–R187

No `advanced-query/*` or `aq` parsing change since R176. Not rewritten.

## 7. Notes

- Stamped headings kept on purpose (anchor stability for locked round files / contract `.md`):
  `datasets.md` "Refresh affordance (R145)", "Column visibility (R152)", "Refresh interaction — …";
  `dataset-detail.md` "Column visibility (R152)", "Properties panel (R153)"; plus `datasets.md`
  gained a `## Read/write boundary` section so `Round_82`'s anchor keeps resolving.
- Code finding (not a doc issue): advanced-query-only zero match shows the zero-rows copy
  ("No rows in this dataset · Re-upload the file") — `DatasetDetailPage.rowsEmptyState` has no
  `hasAdvanced` branch.
- No OUT-OF-SYNC markers present in the domain.
