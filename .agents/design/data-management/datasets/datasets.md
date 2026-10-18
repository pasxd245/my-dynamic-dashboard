# Datasets — feature design

**Concept**: a Dataset is a tabular artifact in the product — the
result of an upload, the thing queries, workflows and dashboards read
from. It belongs to a Workspace (the container) but is the primary noun
a user thinks about ("I want to query the leads dataset"). The
Datasets page at `/data-management/datasets` shows all datasets
across all workspaces as a sortable / filterable **table list**; a
workspace card click navigates here with the workspace filter
applied.
**Status**: Accepted.
**Sibling docs**:
[workspaces.md](../workspaces/workspaces.md) (the container datasets live inside),
[upload.md](upload.md) (the action that creates and refreshes a dataset — verb to
this doc's noun),
[crud-hygiene.md](../_shared/crud-hygiene.md) (rename + delete affordances on
the Dataset row),
[dataset-detail.md](dataset-detail.md) (the per-dataset inspector
page reached by clicking a row),
[metadata.md](../_shared/metadata.md) (read-only namespaced entries written on a
dataset and its columns),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome
the Datasets page renders inside).

---

## Why this exists separately from upload.md

Upload is an **action**; the **dataset** is what the user actually
thinks about, queries, and reasons about going forward. So the two
are split into separate docs:

- `datasets.md` (this file) — the **noun**: what a Dataset is (its
  model and persistence), how the table list works, where it lives in
  the IA, how it relates to Workspaces.
- [upload.md](upload.md) — the **verb**: how a Dataset comes into
  being and how a new export is brought into it. The full-page upload
  wizard, multipart POST, parse pipeline, commit/refresh and error
  handling.

Both docs reference each other. Failed parses **never become
Datasets** — the upload wizard validates the parse before
committing (see [upload.md](upload.md)). The Datasets table only
shows committed-and-ready datasets; there is no separate "upload
event" entity and no `status` field on Dataset.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                                                         | Layer                                                         | Reusability  | Purity             | Allowed peer deps                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `DatasetsPage` route component (contains `DatasetTable`, `DatasetsEmpty`, `SourceIcon` and the `relativeTime` formatter inline) | `apps/builder/src/features/data-management/datasets`          | feature      | feature            | react, antd, @ant-design/icons, react-router-dom, react-i18next, @tanstack/react-query, @mdd/ui |
| `useDatasetsQuery(workspaceId?)` hook                                                                                           | `apps/builder/src/features/data-management/datasets`          | feature      | glue (server-data) | @tanstack/react-query                                                                           |
| `datasetsApi` client                                                                                                            | `apps/builder/src/api/`                                       | builder-only | glue               | (fetch — no extra peer dep)                                                                     |
| `GET /datasets` backend route                                                                                                   | `apps/backend/app/routers/datasets.py`                        | backend      | feature            | (FastAPI — backend native)                                                                      |
| `Dataset` / `Column` / `ColumnCoverage` Pydantic models (wire)                                                                  | `apps/backend/app/models/common.py`                           | backend      | data type          | pydantic                                                                                        |
| `Dataset` SQLModel table (DDL)                                                                                                  | `apps/backend/app/db_models.py`                               | backend      | data type          | sqlmodel                                                                                        |
| `profile_date_coverage()` helper                                                                                                | `apps/backend/app/ingest/profile.py`                          | backend      | pure (data)        | duckdb                                                                                          |
| `Dataset` / `Column` / `ColumnCoverage` types (FE)                                                                              | `apps/builder/src/features/data-management/datasets/types.ts` | feature      | data type          | none                                                                                            |

**Boundary check**: no dataset surface lives in `@mdd/ui` — the page
only _consumes_ `PageContainer` / `PageHeader` / `PageCard` from it.
The table, the workspace `<Select>` filter, the empty state and the
source icon are all **inline within `DatasetsPage.tsx`**; there are no
standalone `DatasetTable` / `WorkspaceFilter` component files. They stay
feature-local; if a second table list needs the same shape, the
extraction question gets re-opened with two concrete consumers in hand
(build-first: feature-local until two consumers exist).

The workspace filter reads from the existing `useWorkspacesQuery`
hook — no new backend surface for the workspace list.

---

## Layout — ASCII intent

The Datasets page renders inside the master-layout chrome
([workspace-shell.target.md](../../_platform/workspace-shell.target.md)) — sidebar
shows "Data Management" expanded with "Datasets" active;
PageHeader shows breadcrumb + title + subtitle + `[+ Upload]` action;
PageCard wraps the filter bar and the table. The page is a
`<PageContainer width="data">` (capped + centered on wide screens).

### Populated state (≥1 dataset)

```text
                                                                ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Datasets                                            [+ Upload] │
Datasets                                                                                │
All tables across your workspaces. Click a row to inspect, sort by any column. ─────────┘

┌───────────────────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                              │
│                                                                                        │
│   Workspace: [All workspaces ▾]   [🔍 Search datasets…        ×]                       │
│                                                                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐   │
│   │ Uploaded ▾  │ Name                         │ Workspace │  Rows  │ Cols │  Size  │ ⋯ │
│   ├──────────────────────────────────────────────────────────────────────────────┤   │
│   │ 14:02       │ ▣ q1_pipeline_Deals · Deals  │ Marketing │  2,481 │  12  │  84 KB │ ⋯ │
│   │ Yesterday   │ ▤ contacts_2026              │ Marketing │ 14,902 │   7  │ 612 KB │ ⋯ │
│   │ 3 days ago  │ ▤ leads_2025                 │ Marketing │    431 │   9  │  22 KB │ ⋯ │
│   │ 1 week ago  │ ▣ deals_q4_Pipeline · Q4     │ Sales Ops │  1,204 │  18  │ 142 KB │ ⋯ │
│   └──────────────────────────────────────────────────────────────────────────────┘   │
│                                       (pager only when > 20 rows)                      │
└───────────────────────────────────────────────────────────────────────────────────────┘
        ▣ = FileExcelOutlined (green) · ▤ = FileTextOutlined (blue) · ⋯ = row actions menu
```

- **Columns** (in order): **Uploaded** (`createdAt`, relative time,
  sortable, default sort descending), **Name** (sortable; prefixed by a
  source-format icon — `FileExcelOutlined` in green for Excel,
  `FileTextOutlined` in blue for CSV, with a `title` tooltip — and, for
  Excel, a muted `· <sheet>` suffix), **Workspace** (a link that applies
  the workspace filter in place; not sortable), **Rows** (right-aligned,
  sortable), **Cols** (right-aligned), **Size** (right-aligned,
  sortable), and an unlabeled **actions** column (`⋯` menu:
  `Refresh` · `Rename` · `Delete`). No status column — every Dataset in
  the table is committed-and-ready because the [upload wizard](upload.md)
  validates the parse before commit.
- **Uploaded is the create time**, not the last refresh: a refresh does
  not move a dataset in this list. The rows' version and last-change
  time are shown on [dataset-detail](dataset-detail.md).
- **Relative time**: `Just now` → `Nm ago` → clock time (today) →
  `Yesterday` → `N days ago` → `N weeks ago` (under five weeks) → the
  ISO date.
- **Workspace filter**: an AntD `<Select>` labelled `Workspace:` with
  "All workspaces" + each workspace (in the workspaces list order,
  newest first). Selecting one writes `?workspace=<id>`; "All
  workspaces" strips the param. The breadcrumb does not change.
- **Search**: client-side, case-insensitive substring match against
  Name; the input has a search-icon prefix and a clear `×`.
- **Pagination**: `pageSize: 20` with `hideOnSinglePage: true`.
- **Row click**: navigates to the per-dataset inspector at
  `/data-management/datasets/:id` (see
  [dataset-detail.md](dataset-detail.md)). The workspace link and the
  `⋯` menu stop propagation so they don't open the row.

### Empty state (zero datasets in scope)

```text
Home ▸ Data Management ▸ Datasets                                            [+ Upload]
Datasets
All tables across your workspaces. Click a row to inspect, sort by any column.

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│   Workspace: [All workspaces ▾]   [🔍 Search datasets…   ]                │
│                                                                           │
│                              (InboxOutlined)                              │
│                   Upload your first file to get started                   │
│                      Excel or CSV · up to 100 MB                          │
│                                                                           │
│                       [ + Upload your first dataset ]                     │
└──────────────────────────────────────────────────────────────────────────┘
```

The empty state is a standard AntD `<Empty>` (icon + title + hint) with
a large primary CTA that navigates to the full-page upload wizard at
`/data-management/datasets/new` — the same pattern as the Workspaces and
dashboard-catalog empty states. The hint's size limit comes from the
configured upload maximum (`appConfig.uploadMaxBytes()`). There is no
drag-and-drop and no upload modal here: the real drag-drop lives in the
wizard's Source step; this page only launches it.

**Filtered empty** (a workspace is selected and holds no datasets): the
icon swaps to `TableOutlined` and the title reads "No datasets in this
workspace"; the CTA is the same, and it opens the wizard with
`?workspace=<id>` so the target workspace is pre-selected. The header's
`[+ Upload]` carries the same `?workspace=` when a filter is active.

### Other states

- **Loading** (datasets or workspaces still loading): an 8-row
  `<Skeleton>` that pre-allocates roughly a loaded table's height.
- **Error**: an error `<Alert>` "Couldn't load datasets" with the error
  message.
- **No match** (datasets exist but none match the search): a centered
  "No datasets match “<q>”" with a "Try a shorter query, or clear the
  search." hint whose link clears the search.

---

## Token map

The Datasets page is AntD primitives (`<Table>`, `<Select>`, `<Input>`,
`<Empty>`, `<Button>`, `<Dropdown>`, `<Skeleton>`, `<Alert>`) styled by
the AntD `<ConfigProvider>` tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts)
(the source of truth). The source-format icon colours (Excel green
`#117a3a`, CSV blue) are inline icon colours, not themed tokens. No new
token is introduced; values are informational (resolved via
`theme.getDesignToken()`, antd 6.x).

| Surface                                | AntD token                     | Value (informational) |
| -------------------------------------- | ------------------------------ | --------------------- |
| Page background                        | `colorBgLayout`                | `#f5f5f5`             |
| Page card background                   | `colorBgBase`                  | derived               |
| Table header background                | `colorFillQuaternary`          | derived               |
| Table header text                      | `colorTextSecondary`           | derived               |
| Table row border                       | `colorBorderSecondary`         | `#f0f0f0`             |
| Table row hover                        | `colorPrimaryBg`               | `#e6f4ff`             |
| Cell text                              | `colorText`                    | derived               |
| Sheet-name suffix                      | `colorTextSecondary`           | derived               |
| Workspace link                         | `colorLink`                    | `#1677ff`             |
| Workspace filter / search input border | `colorBorder` → `colorPrimary` | `#d9d9d9` / `#1677ff` |
| `+ Upload` primary action button       | `colorPrimary`                 | `#1677ff`             |
| Empty-state icon (Inbox / Table)       | `colorTextTertiary`            | derived               |
| Border radius (card, table, button)    | `borderRadius`                 | `6`                   |
| Font family                            | `fontFamily`                   | system stack          |

Identifier parity against the live AntD registry is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## Dataset data model

The wire shape is the shared contract
[`_shared/dataset.yaml`](../../../../workspace/packages/contracts/_shared/dataset.yaml)
(+ [`_shared/column.yaml`](../../../../workspace/packages/contracts/_shared/column.yaml)),
mirrored by the Pydantic models in `app/models/common.py` and the FE
types in `features/data-management/datasets/types.ts`.

```ts
type Dataset = {
  id: string; // server-generated, `ds_<8 hex>`
  workspaceId: string; // FK to Workspace.id (`ws_<8 hex>`)
  name: string; // 1–120 chars, unique per workspace; user-supplied in the wizard
  sizeBytes: number; // size of the uploaded file (the latest one after a refresh)
  rowCount: number; // ≥ 0, never null
  columnCount: number; // ≥ 1, never null
  columns: Column[]; // ≥ 1
  sourceFormat: 'excel' | 'csv' | 'workflow'; // the wizard path that created it — or `workflow` (published, R192)
  sheetName?: string; // present iff sourceFormat === 'excel'
  createdAt: string; // ISO-8601 UTC `Z`; commit time, never changes
  refreshedAt: string; // read-only; when the rows last changed (commit, then each refresh)
  dataVersion: number; // read-only; 1 at commit, +1 per successful refresh (or re-publish)
  lineage?: DatasetLineage; // read-only; only on a published dataset (sourceFormat `workflow`)
};

type DatasetLineage = {
  // written by the server at publish time, copied from the workflow's run stamp (R187)
  workflowId: string;
  workflowName: string; // at publish time
  runId: string; // `run_<8 hex>`
  runNumber: number;
  runAt: string; // when that run materialized
  definitionHash: string; // the workflow definition's version at that run
  sources: WorkflowRun['sources']; // what that run read
  publishedAt: string;
};

type Column = {
  name: string; // header cell, trimmed (or `column1…` when parsed without a header)
  dtype: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';
  hidden?: boolean; // presentation-only view-hint; absent = visible. Never touches the parquet.
  coverage?: ColumnCoverage; // read-only; only on committed date/datetime columns
};

type ColumnCoverage = {
  min?: string; // earliest non-blank value (ISO); absent when every row is blank
  max?: string; // latest non-blank value (ISO); absent when every row is blank
  blankShare: number; // share of blank rows, 0..1
};
```

**No status field**: the [upload wizard](upload.md) validates the
parse before committing the Dataset row — when a row appears in
this table, it is always ready. Failed parses live entirely
inside the wizard (Preview step) and never become persisted
Datasets. Adding `status` "for future processing pipelines" is
exactly the speculative scaffolding the
[Evolution Rule](../../../AGENTS.md) warns against; defer until a
concrete pull arrives.

**`name` is user-supplied**: defaults to the filename stem (for an
Excel multi-sheet upload, `<stem>_<sheet>`) in the wizard's Confirm
step, editable before commit; the Dataset row's rename affordance
([crud-hygiene.md](../_shared/crud-hygiene.md)) edits it after commit.

**Counts and columns are never null**: they are set at commit
time from the written Parquet and rewritten by every refresh. The
two-phase upload flow (see [upload.md](upload.md)) means the Dataset
only exists once parsing succeeded.

**Optional fields are omitted, never `null`**: every dataset response
is serialized with `exclude_none`, so an absent `sheetName`, `hidden`,
`coverage`, `coverage.min` / `coverage.max` is simply not in the body.

### Data identity — `refreshedAt` + `dataVersion`

A dataset's rows change in place (refresh replaces, merges or appends
into the same `ds_id`), so two reads of "the same dataset" can see
different rows. `dataVersion` + `refreshedAt` give every read a stamp
for **which rows** it saw:

- **Server-stamped, read-only.** No request body can set either field.
  The commit sets `refreshedAt = createdAt` and `dataVersion = 1`.
- **Every successful refresh** (replace, merge or append) sets
  `refreshedAt` to now and bumps `dataVersion` by 1 **in the same
  `UPDATE` that swaps the new rows in** — a reader never sees new rows
  under the old version. A failed refresh leaves both untouched.
- **Only row changes count.** A rename or a column-visibility change
  does not touch either field (they change presentation, not data).
- **Never reused.** Versions only go up; two reads with the same
  `dataVersion` saw the same rows.
- **Consumers**: the [dataset-detail](dataset-detail.md) metadata strip
  shows `Data version · v<N> · <relative time>`; a workflow run records
  the `dataVersion` of every leaf dataset it read, so a later read can
  flag the run as out of date when the data moved
  ([workflows.md](../workflows/workflows.md)).
- A dataset that existed before these fields were added reads
  `dataVersion: 1` with `refreshedAt` backfilled from `createdAt` (the
  database knows of no earlier refresh).

This is a counter, not history: the previous parquet is still replaced,
not archived (see [upload.md § Refresh](upload.md#refresh-re-upload-into-an-existing-dataset-r145)).

### Date coverage — `Column.coverage`

Before trusting a number built on a dataset, a reader needs to know
**what period it covers**. For every `date` / `datetime` column the
server profiles the committed parquet and stores the result on the
column:

- **When**: at commit, and again at **every refresh** (replace, merge or
  append) over the final staged parquet, before the swap — a profiling
  failure leaves the dataset untouched.
- **What**: `min` / `max` = the earliest and latest non-blank value as
  ISO strings (`YYYY-MM-DD` for `date`, `YYYY-MM-DDTHH:MM:SS` for
  `datetime`); `blankShare` = blank rows ÷ all rows, rounded to six
  places. An all-blank column carries `{ blankShare: 1 }` with no
  `min` / `max`; an empty table carries `blankShare: 0` with no
  `min` / `max`.
- **Where**: inside `columns_json`, next to the column — one DuckDB
  query per dataset (`min`, `max`, NULL count per temporal column plus
  the row count). It reads the parquet; it never changes the data.
- **Only on committed temporal columns**: never on another dtype (a
  column whose dtype changes away from date/datetime on refresh drops
  its coverage), never on an upload-parse preview. A dataset committed
  before profiling existed carries no coverage until its next refresh.
- **Read-only**: there is no write path for it.
- **Shown** on [dataset-detail](dataset-detail.md) as a coverage strip
  under the metadata strip and as a secondary line per column in the
  Properties drawer.

### Published datasets — `sourceFormat: workflow` (R192)

A dataset can also come from **publishing a workflow's output** (`POST /workflows/{id}/publish`,
[workflows.md § Publish](../workflows/workflows.md)). It is a dataset in every reading sense —
queries, widgets, relationships and workflows read its `parsed.parquet` — with three differences:
`sourceFormat` is `workflow`; it carries a server-written `lineage` (which workflow, which run,
what that run read); and it is **not refreshed by upload** (the source-format check refuses it,
`422`; `refresh-settings` answers `available: false`) — re-publishing is its refresh, moving
`dataVersion` by one. Its storage directory holds `parsed.parquet` and `source.json`
(`{"sourceFormat": "workflow"}`) — no original file; `sizeBytes` is the parquet's size. The
detail page shows the lineage line where an upload shows its file; neither the detail page nor the
list row menu offers Refresh; the list marks it "Workflow". One published dataset per workflow and
workspace — the internal `published_workflow_id` column, `UNIQUE (workspace_id,
published_workflow_id)` (not on the wire).

### Persistence

The schema-of-record is **SQLModel** (`app/db_models.py`) with
**Alembic** migrations; the `datasets` table is created in
`0001_baseline`, and `0006_dataset_data_version` adds `refreshed_at` +
`data_version`. The wire shape (camelCase) is mapped from the DB
columns (snake_case): `workspaceId`↔`workspace_id`,
`sizeBytes`↔`size_bytes`, `rowCount`↔`row_count`,
`columnCount`↔`column_count`, `columns`↔`columns_json` (JSON text — it
also carries each column's `hidden` and `coverage`),
`sourceFormat`↔`source_format`, `sheetName`↔`sheet_name`,
`createdAt`↔`created_at`, `refreshedAt`↔`refreshed_at`,
`dataVersion`↔`data_version`, `lineage`↔`lineage_json` (NULL except on a published dataset;
added by `0008_dataset_lineage`, R192, with the internal `published_workflow_id`). Every router handler reads/writes through
raw `sqlite3` (`get_conn()`), not the ORM session — SQLModel + Alembic
own the DDL; the handlers own the queries (one `_dataset_from_row`
hydrates every row read back from the table).

Constraints: CHECKs name length 1–120, `size_bytes ≥ 0`,
`row_count ≥ 0`, `column_count ≥ 1`, `source_format IN ('csv','excel','workflow')` (`workflow`
from `0008`, a table rebuild);
`(workspace_id, name)` is UNIQUE (`idx_datasets_name_unique`);
`workspace_id` is an `ON DELETE CASCADE` FK to `workspaces`.
`data_version` is `INTEGER NOT NULL DEFAULT 1`; `refreshed_at` is a
nullable `TEXT` only because SQLite's `ADD COLUMN` cannot add `NOT NULL`
without a constant default — every write path sets it.

The rows themselves live on disk, not in SQLite:
`data/datasets/<workspace_id>/<dataset_id>/{original.<ext>, parsed.parquet, source.json}`
(`source.json` holds the commit settings a refresh carries forward).

A dataset is **not terminal**: a Query can be rooted on a dataset via
the Query's `source_id`. `DELETE /datasets/{id}` therefore runs an
**app-level cascade** — it first deletes `queries WHERE source_id =
<ds>`, then the dataset row, then `rmtree`s the dataset's storage
directory (exactly one level: a query built on a now-deleted
dataset-rooted query is left to the resolver's missing-source handling).
The delete returns `204` or `404 not_found` — there is no `409` path.

---

## Refresh affordance (R145)

> The Refresh _verb_ — carry-forward, the drift gate, and the replace /
> merge / append semantics — is specified in
> [upload.md § Refresh](upload.md#refresh-re-upload-into-an-existing-dataset-r145);
> this section covers only its **placement** on the Datasets surfaces +
> the dependent-artifact consequence.

A Dataset row (and the [dataset-detail](dataset-detail.md) header) carries
a **Refresh** action beside rename/delete. It brings a _new export of the
same source_ into the existing dataset — **replace**, **merge-on-key** or
**append** — rather than creating a sibling. The real CRM cadence:
month-2's export updates `monthly_calls` in place.

- **Placement**: the first item in the row's `⋯` menu
  (`Refresh` · `Rename` · `Delete`) and an item in the dataset-detail
  header's `Actions ▾` menu. Both
  `navigate('/data-management/datasets/:id/refresh')` — the
  [upload wizard](upload.md) in refresh mode (a mode, not a new page;
  noun-vs-mode per
  [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)).
- **What the user sees**: the wizard opens pre-filled from the dataset's
  committed settings (`GET /datasets/{id}/refresh-settings`: sheet ·
  parse options · dtype overrides + formats · exclusions · remembered
  merge key / overlap field / refresh mode); they re-pick only the file.
  A drift review step surfaces added / removed / dtype-changed columns
  (diffed client-side against the committed columns); the user
  acknowledges and proceeds — **drift never blocks**.
- **What changes on the dataset**: the rows, counts, `columns_json`
  (with `hidden` carried forward and `coverage` re-profiled),
  `sizeBytes`, `sheetName`, `refreshedAt`, and `dataVersion` (+1). The
  `id`, `name`, `workspaceId` and `createdAt` do not change.
- **Dependent artifacts on drift**: staleness is **not stored** — the
  runtime `query_stale` / `relationship_stale` machinery re-computes
  dependent validity on read, so a refresh that drops or retypes a
  column flips its dependents to stale on their next open. The drift
  review does **not** name the dependents a drifted column will break
  (a dependents read is the named next step, see
  [upload.md](upload.md)). A workflow run that read the dataset is
  flagged by the `dataVersion` move instead (see § Data identity).
- **Merge / append**: the mode choice, key picker and overlap check live
  inside the wizard's Confirm step
  ([upload.md § Refresh merge mode](upload.md#refresh-merge-mode-merge-on-key-and-precedence-r147));
  the Datasets/detail surfaces show nothing extra for them.

---

## Column visibility (R152)

> The editing surface (the Properties drawer) + the row-preview default
> are specified in
> [dataset-detail.md § Column visibility](dataset-detail.md#column-visibility-r152);
> this section owns the **model field + the contract + the honor/ignore
> surface split**.

Wide tables are unreadable — real CRM exports carry many columns and the
row-preview renders **all** of them in one horizontal scroll. A
per-column **`hidden`** view-hint lets the user focus the preview on
what matters.

**Doctrine — presentation-only, never a projection.** Unlike a dtype
override (which rightly stops at the parse), a visibility hint **must**
stay metadata-only: the `PATCH` writes `columns_json` and **never
re-reads or rewrites the parquet**. It is the **presentation-level
default**, complementary to — not a substitute for — the compute-level
`select` step that actually narrows a query's output. A hidden column is
still fully present in storage and in every compute path.

### Honor / ignore split

`hidden` is an **overridable row-preview default, NOT a hard
projection.** Because the row-preview and every picker read one shared
column list, the split is deliberate:

| Surface                                                               | Behaviour on `hidden`                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [dataset-detail](dataset-detail.md) **row-preview** (`PagedRowsView`) | **Honors** — default-hides `hidden` columns, with a session-local **"Show all columns"** escape |
| dataset-detail **coverage strip**                                     | **Ignores** — every profiled column is listed                                                   |
| Row filter / advanced-query pickers (dataset-detail)                  | **Ignores** — lists all columns                                                                 |
| Relationship key picker · query-builder · join · workflows            | **Ignores** — a hidden column stays fully joinable / selectable / filterable                    |

The query-detail row-preview is **out of scope** (the hint lives on
dataset columns; mapping it onto a query's `resolvedColumns` is deferred
until pulled).

### Contract — `PATCH /datasets/{id}/columns`

The one post-commit column mutation (rename is name-only; overrides are
upload-time). It sets the **full visibility set** in one atomic,
idempotent, order-independent call
([`columns-patch.contract.yaml`](../../../../workspace/packages/contracts/datasets/columns-patch.contract.yaml)):

- **Request body**: `{ hidden: string[] }` — the complete list of column
  names to mark hidden (each non-empty, `uniqueItems`). Replace
  semantics: names not in the list become visible; `[]` clears all
  hints. The client already holds the column list, so a single toggle or
  a bulk edit is one call.
- **Success**: `200 Dataset` (the updated dataset; `columns[].hidden`
  reflects the new set — stored as `hidden: true`, the key dropped when
  visible).
- **Writes `columns_json` only** — never the parquet, `column_count`,
  `row_count`, `refreshed_at`, `data_version`, or the storage directory.
- **Errors**:
  - `404 not_found` — no such dataset.
  - `422 { code: "unknown_column", column }` — a name in `hidden` is not
    a column of this dataset.
  - `422 { code: "no_visible_columns" }` — the set would hide **every**
    column (at-least-one-visible guard; an empty preview is not a valid
    state).
  - `422 { detail: [...] }` (FastAPI validation shape, no `code`) — a
    malformed body, e.g. a duplicate name or an extra field.
- **FE**: `datasetsApi.setColumnVisibility(id, hidden)` +
  `useSetColumnVisibilityMutation`, which invalidates the `['datasets']`
  prefix on success.

### Refresh interaction — `hidden` survives, mismatched columns drop

A refresh (replace, merge or append) re-parses the source and **rewrites
`columns_json`** from freshly-parsed `{name, dtype}` — so the `hidden`
set would be silently wiped unless carried forward. It **must** survive:
a hint that dies on the next data update is the exact papercut it
removes.

**Rule — reconcile the previous hidden set against the re-parsed columns
by name** (`_carry_forward_hidden`):

| Case                                  | Outcome                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Column still present (name match)     | **keep** its `hidden`                                                                                                                          |
| Column gone / renamed (name mismatch) | **drop** the hint — the column no longer exists; a stale hint is meaningless                                                                   |
| New column                            | **visible** by default (the computed provenance column is the exception: hidden by default when first introduced — see [upload.md](upload.md)) |

Formally `new_hidden = previous_hidden ∩ {re-parsed column names}`. A
dtype change is **not** a mismatch — a column is still the same column
to hide. The refresh handler applies the intersection to the column list
before the atomic swap — no parquet re-read, still presentation-only.

---

## Workspace filter behavior

- Dropdown sourced from `useWorkspacesQuery()`.
- Options: "All workspaces" (default, internal value `__all__`) + one
  option per workspace, in the order the workspaces list returns them
  (`created_at` desc — matches the Workspaces grid order).
- Selecting a workspace replaces the URL search with
  `?workspace=<id>`; "All workspaces" clears it. `useDatasetsQuery`
  reads the param and fetches `GET /datasets?workspace_id=<id>`.
- The Workspace link in a table row applies the same filter in place.
- Workspace card click on the Workspaces page navigates directly to the
  filtered view:
  `navigate(\`/data-management/datasets?workspace=${encodeURIComponent(id)}\`)`.
- The breadcrumb stays `Home ▸ Data Management ▸ Datasets`; there is no
  separate clear-filter `×` — choosing "All workspaces" is the reset.
- An unknown or deleted workspace id in the URL simply yields an empty
  list (the list route does not 404 on it).

---

## Read/write boundary

**Reads**: the list page reads `GET /datasets[?workspace_id=]` (via
`useDatasetsQuery`) and the workspaces list (via `useWorkspacesQuery`,
for the filter options and the Workspace column's names).

**Writes** reachable from the list page, all through a row's `⋯` menu:

- **Refresh** → the wizard in refresh mode (writes rows, counts,
  `columns_json`, `refreshedAt`, `dataVersion` — see
  [§ Refresh affordance](#refresh-affordance-r145)).
- **Rename** → `PATCH /datasets/{id}` (name only).
- **Delete** → `DELETE /datasets/{id}` (with the query cascade in
  § Persistence).

`[+ Upload]` and the empty-state CTA only navigate to the wizard; the
create itself is the wizard's batch commit. Column visibility is written
from [dataset-detail](dataset-detail.md), not from the list.

---

## Backend endpoint shape

```python
# apps/backend/app/routers/datasets.py
@router.get("/datasets", response_model=list[Dataset], response_model_exclude_none=True)
def list_datasets(
    workspace_id: Annotated[str | None, Query(pattern=ID_PATTERNS["workspace"])] = None,
) -> list[Dataset]:
    # ORDER BY created_at DESC, id DESC; scoped to workspace_id when given,
    # across all workspaces otherwise. A malformed workspace_id → 422
    # (FastAPI validation); an unknown one → []. Every returned dataset is
    # committed-ready by definition (no transient or failed rows).
```

Contract:
[`get.contract.yaml`](../../../../workspace/packages/contracts/datasets/get.contract.yaml).
The other dataset routes are owned by the docs that use them:

| Route                                                                       | Owner                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /workspaces/{id}/datasets/batch` (create + refresh commit)            | [upload.md](upload.md)                                                                                                                 |
| `GET /datasets/{id}/refresh-settings`, `POST /datasets/{id}/append-overlap` | [upload.md](upload.md)                                                                                                                 |
| `GET /datasets/{id}`, `GET /datasets/{id}/rows`                             | [dataset-detail.md](dataset-detail.md) (row filters: [dataset-filters.md](dataset-filters.md), [advanced-query.md](advanced-query.md)) |
| `PATCH /datasets/{id}/columns`                                              | this doc, [§ Column visibility](#column-visibility-r152)                                                                               |
| `PATCH /datasets/{id}` (rename), `DELETE /datasets/{id}`                    | [crud-hygiene.md](../_shared/crud-hygiene.md) (+ the delete cascade in § Persistence)                                                  |

There is no DB-only create path; a Dataset comes into existence only via
the wizard's atomic batch commit (CSV → a batch of one; Excel → one
dataset per selected sheet or range, all-or-nothing).

**Query keys** (TanStack Query): `['datasets']` for the unfiltered list,
`['datasets', { workspaceId }]` for a filtered one, and
`['datasets', { id }, …]` for the per-dataset reads. Every dataset
mutation (commit, rename, column visibility, delete) invalidates the
`['datasets']` prefix, which reaches all of them; rename also
invalidates `['workspaces']`.

---

## Sub-menu and navigation

Datasets is a `Data Management` sub-item in the sidebar
(`AppLayout.tsx`, built inside the component so labels are i18n'd):

```tsx
const dataManagementGroup: NavGroup = {
  key: 'data-management',
  label: t('nav.dataManagement'),
  icon: <DatabaseOutlined />,
  defaultExpanded: true,
  items: [
    { key: 'workspaces', label: t('nav.workspaces'), icon: <AppstoreOutlined /> },
    { key: 'datasets', label: t('nav.datasets'), icon: <TableOutlined /> },
    { key: 'queries', label: t('nav.queries'), icon: <FilterOutlined /> },
    { key: 'workflows', label: t('nav.workflows'), icon: <PartitionOutlined /> },
  ],
};
```

**Active state**: Datasets is highlighted for `/data-management/datasets`
and every sub-route (`/new`, `/:id`, `/:id/refresh`), with or without
`?workspace=...`. The workspace filter does not change which sidebar
item is active.

---

## Acceptance criteria

Testable criteria, each mapping to at least one automated test across
F / B / I. They describe the current catalog behaviour.

**User journey** — as a user I open Datasets to see every table across
my workspaces in one sortable list, filter to a workspace, and find a
dataset by name.

1. **List** _(FE component)_ — the populated state renders one row per
   committed dataset from `useDatasetsQuery(workspaceId?)` with
   Uploaded / Name / Workspace / Rows / Cols / Size + an actions column;
   default sort is Uploaded desc. There is **no** status column.
2. **Source-format icon** _(FE)_ — each Name cell is prefixed by
   `FileExcelOutlined` for Excel (with a `· <sheet>` suffix) and
   `FileTextOutlined` for CSV, driven by `Dataset.sourceFormat`.
3. **Workspace filter** _(FE)_ — selecting a workspace writes
   `?workspace=<id>` and scopes the list; "All workspaces" strips the
   param; a row's Workspace link applies the same filter.
4. **Search** _(FE)_ — the search box does a client-side
   case-insensitive substring match against Name; zero matches shows the
   no-match state with a clear-search link.
5. **Workspace-card handoff** _(integration)_ — navigating from a
   Workspaces card lands on this page with that workspace pre-filtered.
6. **Empty states** _(FE)_ — zero datasets renders an `<Empty>` with an
   Inbox icon + an upload CTA that launches the wizard; a filtered view
   with no datasets swaps to a Table icon and the "No datasets in this
   workspace" title, and the CTA carries `?workspace=<id>`.
7. **Row actions** _(FE)_ — the `⋯` menu offers Refresh (navigates to
   `/data-management/datasets/:id/refresh`), Rename and Delete (the
   [crud-hygiene.md](../_shared/crud-hygiene.md) modals).
8. **Backend list** _(pytest)_ — `GET /datasets?workspace_id=<id>`
   returns datasets ordered `created_at` desc, scoped when
   `workspace_id` is given and across all workspaces otherwise.
9. **Data model** _(contract)_ — each `Dataset` carries `id`,
   `workspaceId`, `name`, `sizeBytes`, `rowCount`, `columnCount`,
   `columns[]`, `sourceFormat`, `sheetName?` (iff Excel), `createdAt`,
   `refreshedAt`, `dataVersion`; counts and columns are never null.
10. **Data identity** _(pytest)_ — a commit stamps `dataVersion: 1` and
    `refreshedAt == createdAt`; each successful replace / merge / append
    refresh bumps `dataVersion` by exactly 1 and moves `refreshedAt`; a
    rename, a column-visibility change and a failed refresh change
    neither.
11. **Date coverage** _(pytest)_ — after a commit and after every
    refresh mode, each `date` / `datetime` column carries
    `coverage { min?, max?, blankShare }` matching the parquet; other
    dtypes carry none; an all-blank column has `blankShare: 1` and no
    `min` / `max`.
12. **Column visibility** _(pytest / contract)_ —
    `PATCH /datasets/{id}/columns` replaces the hidden set and writes
    `columns_json` only; `unknown_column` / `no_visible_columns` → 422
    with that `code`; a refresh keeps the hint on name-matched columns
    and drops it on vanished ones.
13. **Row-click handoff** _(FE)_ — clicking a row navigates to
    `/data-management/datasets/:id` per
    [dataset-detail.md](dataset-detail.md).

---

## Scope boundary

This concept covers:

- The Dataset **noun**: its model (incl. the server-stamped data
  identity and date coverage), persistence, the column-visibility
  contract, and the delete cascade.
- The Datasets **table-list** page at `/data-management/datasets` — the
  columns + default sort, the workspace filter (URL `?workspace=`),
  client-side name search, the loading / error / empty / filtered-empty
  / no-match states, the source-format icon, the row actions menu, and
  the workspace-card handoff into the filtered view.

This concept defers (each lands when a real pull arrives):

- **Re-parse** (re-run the parser on the stored original without a new
  file).
- **Column-level edits** (rename a column, change a dtype after commit)
  — overrides are upload-time; only visibility is editable post-commit.
- **Version history** — `dataVersion` counts row changes, it does not
  keep the previous rows.
- **More per-column profiling** than date coverage (null % · distinct ·
  min–max on every dtype) — not wanted when last tried; do not
  re-propose without a fresh pull.
- **Saved-filter / pinned-search** on the list.
- **Bulk operations** (multi-select, bulk delete).
- **Server-side search / virtualized scroll** — when 1000+ datasets is a
  real number.

This concept explicitly does NOT cover:

- The upload wizard that **creates** and **refreshes** datasets — the
  verb to this noun, in [upload.md](upload.md).
- The per-dataset inspector page (lives in
  [dataset-detail.md](dataset-detail.md)).
- Rename / delete affordances and their modals (live in
  [crud-hygiene.md](../_shared/crud-hygiene.md); the table's actions
  column is a _placement_ of them).
- Metadata entries written on a dataset or its columns (live in
  [metadata.md](../_shared/metadata.md)).
- The Workspace container model (lives in
  [workspaces.md](../workspaces/workspaces.md)).
