# Datasets — feature design

**Concept**: a Dataset is a tabular artifact in the product — the
result of an upload, the thing queries and dashboards read from. It
belongs to a Workspace (the container) but is the primary noun a
user thinks about ("I want to query the leads dataset"). The
Datasets page at `/data-management/datasets` shows all datasets
across all workspaces as a sortable / filterable **table list**; a
workspace card click navigates here with the workspace filter
applied.
**Status**: Accepted.
**Sibling docs**:
[workspaces.md](../workspaces/workspaces.md) (the container datasets live inside),
[upload.md](upload.md) (the action that creates a dataset — verb to
this doc's noun),
[crud-hygiene.md](../_shared/crud-hygiene.md) (rename + delete affordances on
the Dataset row),
[dataset-detail.md](dataset-detail.md) (the per-dataset inspector
page reached by clicking a row),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome
the Datasets page renders inside).

---

## Why this exists separately from upload.md

Upload is an **action**; the **dataset** is what the user actually
thinks about, queries, and reasons about going forward. So the two
are split into separate docs:

- `datasets.md` (this file) — the **noun**: what a Dataset is, how
  the table list works, where it lives in the IA, how it relates
  to Workspaces.
- [upload.md](upload.md) — the **verb**: how a Dataset comes into
  being. The full-page upload wizard, multipart POST, parse pipeline,
  and commit/error handling.

Both docs reference each other. Failed parses **never become
Datasets** — the upload wizard validates the parse before
committing (see [upload.md](upload.md)). The Datasets table only
shows committed-and-ready datasets; there is no separate "upload
event" entity and no `status` field on Dataset.

---

## Surfaces — layer / reuse / purity declaration

| Surface                            | Layer                                                         | Reusability  | Purity             | Allowed peer deps                  |
| ---------------------------------- | ------------------------------------------------------------- | ------------ | ------------------ | ---------------------------------- |
| `DatasetsPage` route component (contains the table, workspace `<Select>` filter, `<Empty>` state with an upload CTA, source icon, and relative-time formatter inline) | `apps/builder/src/features/data-management/datasets`          | feature      | feature            | react, antd, @tanstack/react-query |
| `useDatasetsQuery` hook            | `apps/builder/src/features/data-management/datasets`          | feature      | glue (server-data) | @tanstack/react-query              |
| `datasetsApi` client               | `apps/builder/src/api/`                                       | builder-only | glue               | (fetch — no extra peer dep)        |
| `GET /datasets` backend route      | `apps/backend/`                                               | backend      | feature            | (FastAPI — backend native)         |
| `Dataset` Pydantic model (backend) | `apps/backend/app/routers/datasets.py`                        | backend      | data type          | pydantic                           |
| `Dataset` type (frontend)          | `apps/builder/src/features/data-management/datasets/types.ts` | feature      | data type          | none                               |

**Boundary check**: no dataset surface lives in `@mdd/ui`. The
table list, the workspace `<Select>` filter, and the `<Empty>`
state are all **inline within `DatasetsPage.tsx`** — there
are no standalone `DatasetTable` / `WorkspaceFilter` component
files. They stay feature-local; if a second table list arrives
(e.g. a "Saved Queries table"), the extraction question gets
re-opened with two concrete consumers in hand. Per the build-first
lesson: feature-local until two consumers exist.

The workspace filter reads from the existing `useWorkspacesQuery`
hook — no new backend surface for the workspace list.

---

## Layout — ASCII intent

The Datasets page renders inside the master-layout chrome
([workspace-shell.target.md](../../_platform/workspace-shell.target.md)) — sidebar
shows "Data Management" expanded with "Datasets" sub-item active;
PageHeader shows breadcrumb + title + `[+ Upload]` action; PageCard
wraps the table.

### Populated state (≥1 dataset)

```text
                                                                ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Datasets                                            [+ Upload] │
Datasets                                                                                │
All tables across your workspaces. Click a row to inspect, sort by any column. ─────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                   │
│   [Workspace: All ▾]   [Search datasets…           ]                              │
│                                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │ Name                  │ Workspace    │  Rows  │ Cols │  Size   │ Uploaded    │  │
│   ├─────────────────────────────────────────────────────────────────────────┤  │
│   │ 📊 q1_pipeline_Deals  │ Marketing    │  2,481 │  12  │  84 KB  │ 14:02 today │  │
│   │ 📊 contacts_2026      │ Marketing    │ 14,902 │   7  │ 612 KB  │ Yesterday   │  │
│   │ 📄 leads_2025         │ Marketing    │    431 │   9  │  22 KB  │ 3 days ago  │  │
│   │ 📊 deals_q4_Pipeline  │ Sales Ops    │  1,204 │  18  │ 142 KB  │ 5 days ago  │  │
│   │ 📄 commission_calc    │ Finance      │     58 │   6  │   4 KB  │ 1 week ago  │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Columns**: Name (sortable, primary; prefixed by a source-
  format icon — `📊` for Excel, `📄` for CSV — so the user can
  tell at a glance how each dataset was ingested), Workspace
  (sortable, links to filtered Datasets view), Rows / Cols / Size
  (numeric, right-aligned), Uploaded (relative date, sortable).
  No status column — every Dataset in the table is committed-and-
  ready because the [upload wizard](upload.md) validates the
  parse before commit.
- **Default sort**: Uploaded desc (most recent first).
- **Workspace filter**: dropdown with "All" + each workspace.
  When set, URL becomes `/data-management/datasets?workspace=<id>`
  and breadcrumb shows `Home ▸ Data Management ▸ Datasets ▸
Marketing` (workspace name appears as the filter trail).
- **Search**: client-side substring match against Name (can be
  promoted to server-side if a real user has >1000 datasets).
- **Row click**: navigates to the per-dataset inspector at
  `/data-management/datasets/:id` (see
  [dataset-detail.md](dataset-detail.md)).

### Empty state (zero datasets across all workspaces)

```text
Home ▸ Data Management ▸ Datasets                                            [+ Upload]
Datasets
All tables across your workspaces.

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│                                                                           │
│                                                                           │
│                              📥  (InboxOutlined)                          │
│                                                                           │
│                   Upload your first dataset to get started               │
│                        Up to 100 MB · CSV or Excel                       │
│                                                                           │
│                            [ + Upload ]                                   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

The empty state is a standard AntD `<Empty>` (icon + title + hint)
with a primary **`[+ Upload]`** CTA that navigates to the full-page
upload wizard at `/data-management/datasets/new` — the same pattern as
the Workspaces and dashboard-catalog empty states. There is no
drag-and-drop here and no upload modal: the real drag-drop lives in the
wizard's Source step; this page only launches it.

### Filtered empty state (workspace selected, no datasets in it)

```text
                                                                  [+ Upload to Marketing]
Datasets
[Workspace: Marketing ▾]   [Search…]

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│                          ▦  (TableOutlined)                               │
│                    No datasets in Marketing yet                           │
│                       [ + Upload to Marketing ]                           │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

When the workspace filter is active and the resulting list is empty, the
`<Empty>` swaps to a table icon, the title incorporates the workspace
name, and the CTA reads `[+ Upload to <workspace>]` — launching the same
wizard.

---

## Token map

The Datasets page is AntD primitives (`<Table>`, `<Select>`,
`<Input>`, `<Empty>`, `<Button>`) styled by the AntD `<ConfigProvider>`
tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts)
(the source of truth — R66). The source-format prefix (`📊` / `📄`) is
an emoji glyph, not a themed token. No new token is introduced; values
are informational (resolved via `theme.getDesignToken()`, antd 6.x).

| Surface                                  | AntD token                       | Value (informational) |
| ---------------------------------------- | -------------------------------- | --------------------- |
| Page background                          | `colorBgLayout`                  | `#f5f5f5`             |
| Page card background                     | `colorBgBase`                    | derived               |
| Table header background                  | `colorFillQuaternary`            | derived               |
| Table header text                        | `colorTextSecondary`             | derived               |
| Table row border                         | `colorBorderSecondary`           | `#f0f0f0`             |
| Table row hover                          | `colorPrimaryBg`                 | `#e6f4ff`             |
| Cell text                                | `colorText`                      | derived               |
| Workspace filter / search input border   | `colorBorder` → `colorPrimary`   | `#d9d9d9` / `#1677ff` |
| "Clear filter" `×` link                  | `colorPrimary`                   | `#1677ff`             |
| `+ Upload` primary action button         | `colorPrimary`                   | `#1677ff`             |
| Empty-state icon (Inbox / Table)         | `colorTextTertiary` (0.4 opacity)| derived               |
| Border radius (card, table, button)      | `borderRadius`                   | `6`                   |
| Font family                              | `fontFamily`                     | system stack          |

No new token is introduced. Identifier parity against the live AntD
registry is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## Dataset data model

```ts
type Dataset = {
  id: string; // backend-generated (matches Workspace.id format)
  workspaceId: string; // foreign key to Workspace.id
  name: string; // user-supplied in the upload wizard (default = filename stem + optional sheet)
  sizeBytes: number; // raw uploaded file size
  rowCount: number; // populated at commit time (never null)
  columnCount: number; // populated at commit time
  columns: Column[]; // populated at commit time
  sourceFormat: 'excel' | 'csv'; // which wizard path created this Dataset
  sheetName?: string; // present iff sourceFormat === 'excel'
  createdAt: string; // ISO-8601 UTC timestamp from backend (commit time)
};

type Column = {
  name: string; // header cell, trimmed
  dtype: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';
};
```

**No status field**: the [upload wizard](upload.md) validates the
parse before committing the Dataset row — when a row appears in
this table, it is always `ready`. Failed parses live entirely
inside the wizard (Preview step) and never become persisted
Datasets. Adding `status` "for future processing pipelines" is
exactly the speculative scaffolding the
[Evolution Rule](../../../AGENTS.md) warns against; defer until a
concrete pull arrives.

**`name` is user-supplied**: defaults to the filename stem in the
wizard's Confirm step, editable before commit; the Dataset row's
rename affordance ([crud-hygiene.md](../_shared/crud-hygiene.md))
edits it after commit.

**Counts and columns are never null**: they are set at commit
time by the wizard, populated from the parsed Parquet schema.
The two-phase upload flow (see [upload.md](upload.md)) means the
Dataset only exists once parsing succeeded.

**Deferred fields**: `updatedAt`, `parseDurationMs`, `tags`,
`description`. Each lands when a UI surface or operational concern
needs it.

### Persistence

The schema-of-record is **SQLModel** (`app/db_models.py`) with
**Alembic** migrations (`0001_baseline`, `0002_dashboards`,
`0003_workflows`); the Dataset table is defined in `0001_baseline`.
The wire shape (camelCase) is mapped from the DB columns
(snake_case): `workspaceId`↔`workspace_id`, `sizeBytes`↔`size_bytes`,
`rowCount`↔`row_count`, `columnCount`↔`column_count`,
`columns`↔`columns_json` (JSON), `sourceFormat`↔`source_format`,
`sheetName`↔`sheet_name`, `createdAt`↔`created_at`. Every router
handler reads/writes through raw `sqlite3` (`get_conn()`), not the
ORM session — SQLModel + Alembic own the DDL; the handlers own the
queries. The `datasets` table CHECKs name 1–120, `size_bytes ≥ 0`,
`row_count ≥ 0`, `column_count ≥ 1`, `source_format IN (csv, excel)`;
`(workspace_id, name)` is UNIQUE and `workspace_id` is an
`ON DELETE CASCADE` FK to `workspaces`.

A dataset is **not terminal**: a Query can be rooted on a dataset
via the Query's `source_id`. `DELETE /datasets/{id}` therefore runs
an **app-level cascade** — it first deletes `queries WHERE source_id
= <ds>`, then the dataset row, then `rmtree`s the dataset's storage
directory. The delete still returns 204 (no 409 path), so the
FE-facing contract is unchanged.

---

## Refresh affordance (R145)

> **Status: SIGNED OFF (human, 2026-07-04) — R145 D-gate.** The Refresh *verb* — carry-forward,
> the drift gate, and atomic replace — is specified in
> [upload.md § Refresh](upload.md#refresh-re-upload-into-an-existing-dataset-r145); this
> section covers only its **placement** on the Datasets surfaces + the dependent-artifact
> consequence.

A Dataset row (and the [dataset-detail](dataset-detail.md) header) gains a **Refresh**
action beside rename/delete. It re-uploads a *new export of the same source* into the
existing dataset — forward-only, **replace** or (R147) **merge-on-key** — rather than
creating a sibling. The real CRM cadence: month-2's export updates `monthly_calls` in place.

- **Placement**: an item in the row's Actions menu (`Refresh` · `Rename` · `Delete`) and a
  `[Refresh]` button on the dataset-detail header. Both `navigate('/data-management/datasets/:id/refresh')`
  — the [upload wizard](upload.md) in refresh mode (a mode, not a new page; noun-vs-mode per
  [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)).
- **What the user sees**: the wizard opens pre-filled from the dataset's committed settings
  (sheet · parse options · dtype overrides + formats · exclusions — see
  [upload.md § F9](upload.md#refresh-re-upload-into-an-existing-dataset-r145)); they re-pick
  only the file. A **Drift review** step surfaces any added / removed / dtype-changed columns
  and (for removed / changed) the dependent queries + relationships they'll affect; the user
  acknowledges and proceeds — **drift never blocks** (R145 D decision).
- **Dependent artifacts on drift**: staleness is **not stored** — the runtime
  `query_stale` / `relationship_stale` machinery re-computes dependent validity on read
  ([dataset-detail.md](dataset-detail.md), the query/relationship surfaces), so a refresh that
  drops or retypes a column auto-flips its dependents to stale on their next open. The Drift
  review step **previews** that blast radius before commit; it does not rebuild the runtime
  net. No new persisted status field is added.
- **Merge mode (R147, signed off 2026-07-04)**: row merge-on-key / precedence for overlapping non-cumulative
  re-exports — specified in
  [upload.md § Refresh merge mode](upload.md#refresh-merge-mode-merge-on-key-and-precedence-r147).
  **No new placement**: the replace|merge choice + key picker live inside the wizard's Confirm
  step; the Datasets/detail surfaces are unchanged (the remembered key does NOT surface on the
  detail header in slice 1 — the wizard shows it where it's acted on).

---

## Workspace filter behavior

- Dropdown sourced from `useWorkspacesQuery()`.
- Options: `All` (default) + one option per workspace, ordered by
  workspace `createdAt` desc (matches the Workspaces grid order).
- Selecting a workspace updates the URL query param:
  `/data-management/datasets?workspace=<id>`.
- Workspace card click on the Workspaces page navigates directly to
  the filtered view: `<WorkspaceCard onClick>` → `navigate(\`/data-management/datasets?workspace=${ws.id}\`)`.
- Breadcrumb: when filter is active, `Datasets ▸ <workspace name>`.
- "Clear filter" affordance: a small `×` next to the dropdown when
  filter is set; clicking resets to "All" and strips the URL param.

---

## Read/write boundary

**In scope**:

- The dataset table (inline in `DatasetsPage`) with default-sort,
  workspace filter, client-side search.
- `DatasetsPage` route at `/data-management/datasets`.
- Workspace filter via URL query param.
- `useDatasetsQuery(workspaceId?: string)` returning datasets for
  the given workspace (or all if omitted).
- `GET /datasets?workspace_id=<id>` backend route.
- Workspace card click navigates to the filtered view.
- `+ Upload` button navigates to the wizard route
  `/data-management/datasets/new` (see [upload.md](upload.md)).
- Row click navigates to the per-dataset inspector
  ([dataset-detail.md](dataset-detail.md)).
- Rename / delete affordances on the row
  ([crud-hygiene.md](../_shared/crud-hygiene.md)).
- **List pagination**: the table sets `pageSize: 20` with
  `hideOnSinglePage: true` — at most 20 rows per page, no
  pagination control until a second page exists.

**Deferred**:

- **Re-parse** (re-run parser without re-uploading).
- **Column-level affordances** (rename column, override dtype) —
  see [upload.md](upload.md)'s deferral list.
- **Saved-filter / pinned-search**.
- **Bulk operations** (multi-select, bulk delete).
- **Virtualized scroll**. Lands when 1000+ datasets is a real
  number.

---

## Backend endpoint shape

```python
# apps/backend/app/routers/datasets.py
@router.get("/datasets", response_model=list[Dataset])
def list_datasets(workspace_id: str | None = None) -> list[Dataset]:
    # Returns datasets ordered created_at DESC, id DESC. When
    # workspace_id is provided, scopes to that workspace; otherwise
    # returns all datasets across all workspaces. All returned
    # datasets are committed-ready by definition (no transient or
    # failed rows).
```

The matching **create** endpoint lives in [upload.md](upload.md) —
`POST /workspaces/<id>/datasets/batch` — and is the **atomic
batch commit** half of the upload wizard. One wizard run creates
**one or more** Datasets in a single transaction: CSV produces a
batch of length 1; Excel produces a batch of length N where N is
the number of sheets the user selected in the wizard's Sheet
step. All N datasets succeed together or none do. There is no
DB-only create path; a Dataset comes into existence only via the
wizard's batch commit.

**Query key** (TanStack Query):
`['datasets', { workspaceId }]` — a single object key with the
filter inside. Invalidation in the upload mutation pattern:
`invalidateQueries({ queryKey: ['datasets'] })` matches all
filter variants.

---

## Sub-menu and navigation

Datasets is a real `NAV_GROUPS` sub-item under Data Management:

```ts
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'data-management',
    label: 'Data Management',
    icon: <DatabaseOutlined />,
    defaultExpanded: true,
    items: [
      { key: 'workspaces', label: 'Workspaces', route: '/data-management/workspaces' },
      { key: 'datasets', label: 'Datasets', route: '/data-management/datasets' },
    ],
  },
];
```

**Active state**: when route is `/data-management/datasets`
(with or without `?workspace=...`), Datasets is highlighted.
Workspace filter does not change which sidebar item is active.

---

## Acceptance criteria

Testable criteria, each mapping to at least one automated test
across F / B / I. They describe the current catalog behaviour.

**User journey** — as a user I open Datasets to see every table across
my workspaces in one sortable list, filter to a workspace, and find a
dataset by name.

1. **List** _(FE component)_ — the populated state renders the
   `DatasetTable` from `useDatasetsQuery(workspaceId?)`, one row per
   committed dataset with Name / Workspace / Rows / Cols / Size /
   Uploaded columns; default sort is Uploaded desc. There is **no**
   status column.
2. **Source-format icon** _(FE)_ — each Name cell is prefixed `📊` for
   Excel and `📄` for CSV, driven by `Dataset.sourceFormat`.
3. **Workspace filter** _(FE)_ — selecting a workspace writes
   `?workspace=<id>`, scopes the list, and surfaces the workspace name
   in the breadcrumb; a `×` next to the dropdown clears back to "All"
   and strips the param.
4. **Search** _(FE)_ — the search box does a client-side substring
   match against Name.
5. **Workspace-card handoff** _(integration)_ — navigating from a
   Workspaces card lands on this page with that workspace pre-filtered.
6. **Empty states** _(FE)_ — zero datasets renders an `<Empty>` with an
   Inbox icon + a `[+ Upload]` CTA that launches the wizard; a filtered
   view with no datasets swaps to a Table icon and incorporates the
   workspace name into the title and the `[+ Upload to <workspace>]` CTA.
7. **Backend list** _(pytest)_ — `GET /datasets?workspace_id=<id>`
   returns datasets ordered `createdAt` desc, scoped when `workspace_id`
   is given and across all workspaces otherwise; every returned dataset
   is committed-ready (no transient / failed rows).
8. **Data model** _(contract)_ — each `Dataset` carries `id`,
   `workspaceId`, `name`, `sizeBytes`, `rowCount`, `columnCount`,
   `columns[]`, `sourceFormat`, `sheetName?` (iff Excel), `createdAt`;
   `rowCount` / `columnCount` / `columns` are never null.
9. **Row-click handoff** _(FE)_ — clicking a row navigates to
   `/data-management/datasets/:id` per
   [dataset-detail.md](dataset-detail.md).

---

## Scope boundary

This concept covers:

- The Datasets **table-list** page at `/data-management/datasets` — the
  noun's catalog: the columns + default sort, the workspace filter
  (URL `?workspace=`), client-side name search, the empty and
  filtered-empty `<Empty>` states, the source-format icon, and the
  workspace-card handoff into the filtered view.

This concept defers:

- All of the "Deferred" bullets in § Read/write boundary above
  (re-parse, column-level affordances, saved filters, bulk ops,
  and virtualized scroll).

This concept explicitly does NOT cover:

- The upload wizard that **creates** datasets — the verb to this noun,
  in [upload.md](upload.md).
- The per-dataset inspector page (lives in
  [dataset-detail.md](dataset-detail.md)).
- Rename / delete affordances and their modals (live in
  [crud-hygiene.md](../_shared/crud-hygiene.md); the table's Actions column is a
  _placement_ of them).
- The Workspace container model (lives in
  [workspaces.md](../workspaces/workspaces.md)).
