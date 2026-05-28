# Datasets — feature design

**Concept**: a Dataset is a tabular artifact in the product — the
result of an upload, the thing queries and dashboards read from. It
belongs to a Workspace (the container) but is the primary noun a
user thinks about ("I want to query the leads dataset"). The
Datasets page at `/data-management/datasets` shows all datasets
across all workspaces as a sortable / filterable **table list**; a
workspace card click navigates here with the workspace filter
applied.
**Status**: Draft (Round 14 design-only).
**Round introduced**: [Round_14](../../plan/cycles/Round_14.md);
implementation chain begins R15. Datasets is the **first
implementation** of R11's sample "Datasets" sub-menu item — it
promotes from sample to real scope in R14.
**Backend**: [Round_16](../../plan/cycles/Round_16.md) — SQLite-
backed `datasets` table; `POST /workspaces/{id}/datasets/batch` and
`GET /datasets` land against the locked R15 contracts.
**Frontend**: [Round_17](../../plan/cycles/Round_17.md) — Datasets
table page with workspace filter; workspace-card click handoff.
**Sibling docs**:
[workspaces.md](workspaces.md) (the container datasets live inside),
[upload.md](upload.md) (the action that creates a dataset — verb to
this doc's noun),
[crud-hygiene.md](crud-hygiene.md) (rename + delete affordances on
the Dataset row — R23 closes the R∞-deferred CRUD gap below),
[dataset-detail.md](dataset-detail.md) (R33 design for the
per-dataset inspector page; resolves this doc's R∞-deferred row-
click affordance below),
[workspace-shell.target.md](workspace-shell.target.md) (the chrome
the Datasets page renders inside), and
[datasets.preview.html](_archive/datasets.preview.html) (visual preview of
the Datasets table list — `+ Upload` navigates to the wizard
preview at [upload.preview.html](_archive/upload.preview.html)).

---

## Why this exists separately from upload.md

Until R14's mid-round HIxAI review, the upload feature was framed
with Upload as both noun and verb — "an upload" was the thing the
user manipulated. Walking the preview surfaced the framing error:
upload is an **action**; the **dataset** is what the user actually
thinks about, queries, and reasons about going forward.

This split:

- `datasets.md` (this file) — the **noun**: what a Dataset is, how
  the table list works, where it lives in the IA, how it relates
  to Workspaces.
- [upload.md](upload.md) — the **verb**: how a Dataset comes into
  being. Drop zone, modal, multipart POST, parse pipeline, status
  state machine, error handling.

Both docs reference each other. Failed parses **never become
Datasets** — the upload wizard validates the parse before
committing (see [upload.md](upload.md)). The Datasets table only
shows committed-and-ready datasets; there is no separate "upload
event" entity and no `status` field on Dataset.

---

## Surfaces — layer / reuse / purity declaration

| Surface                            | Layer                                                         | Reusability  | Purity             | Allowed peer deps                  |
| ---------------------------------- | ------------------------------------------------------------- | ------------ | ------------------ | ---------------------------------- |
| `DatasetsPage` route component     | `apps/builder/src/features/data-management/datasets`          | feature      | feature            | react, antd, @tanstack/react-query |
| `DatasetTable` component           | `apps/builder/src/features/data-management/datasets`          | feature      | feature            | react, antd                        |
| `WorkspaceFilter` component        | `apps/builder/src/features/data-management/datasets`          | feature      | feature            | react, antd, @tanstack/react-query |
| `useDatasetsQuery` hook            | `apps/builder/src/features/data-management/datasets`          | feature      | glue (server-data) | @tanstack/react-query              |
| `datasetsApi` client               | `apps/builder/src/api/`                                       | builder-only | glue               | (fetch — no extra peer dep)        |
| `GET /datasets` backend route      | `apps/backend/`                                               | backend      | feature            | (FastAPI — backend native)         |
| `Dataset` Pydantic model (backend) | `apps/backend/app/routers/datasets.py`                        | backend      | data type          | pydantic                           |
| `Dataset` type (frontend)          | `apps/builder/src/features/data-management/datasets/types.ts` | feature      | data type          | none                               |

**Boundary check**: no dataset surface lives in `@mdd/ui`. The
table list and its sub-components stay feature-local; if a second
table list arrives in a future round (e.g., "Saved Queries
table"), the extraction question gets re-opened with two concrete
consumers in hand. Per the build-first lesson: feature-local until
two consumers exist.

The `WorkspaceFilter` reads from the existing `useWorkspacesQuery`
introduced in R13 — no new backend surface for the workspace list.

---

## Layout — ASCII intent

The Datasets page renders inside the master-layout chrome
([workspace-shell.target.md](workspace-shell.target.md)) — sidebar
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
- **Search**: client-side substring match against Name (R15+ can
  promote to server-side if a real user has >1000 datasets).
- **Row click**: R∞ (dataset detail view). R15 ships row click as
  a no-op or a tooltip — the row already shows the headline
  metadata.

### Empty state (zero datasets across all workspaces)

```text
Home ▸ Data Management ▸ Datasets                                            [+ Upload]
Datasets
All tables across your workspaces.

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│                                                                           │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                                                                  │    │
│   │                              📥                                  │    │
│   │                                                                  │    │
│   │             Upload your first CSV to get started                 │    │
│   │             Drag and drop here, or click to browse               │    │
│   │             Up to 100 MB · CSV only                              │    │
│   │                                                                  │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

The drop zone IS the empty state (same principle as the workspace
detail page in the previous framing). Dropping a file here opens
the upload modal with the file pre-selected and the workspace
picker required (no workspace context).

### Filtered empty state (workspace selected, no datasets in it)

```text
                                                                  [+ Upload to Marketing]
Datasets
[Workspace: Marketing ▾]   [Search…]

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │   📥  No datasets in Marketing yet                              │    │
│   │       Drag and drop here, or click to browse                    │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

When the workspace filter is active and the resulting list is
empty, the drop zone copy and the `[+ Upload]` button both
incorporate the workspace name. Submitting from this state
pre-fills the workspace picker in the modal.

---

## Dataset data model

R15+ ships:

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

**Decision rationale** (HIxAI Q12, locked R14 mid-round): no
status field. The [upload wizard](upload.md) validates the parse
before committing the Dataset row — when a row appears in this
table, it is always `ready`. Failed parses live entirely inside
the wizard (Step 2 — Preview) and never become persisted
Datasets. Adding `status` "for future processing pipelines" is
exactly the speculative scaffolding the
[Evolution Rule](../../AGENTS.md) warns against; defer until a
concrete pull arrives.

**`name` is user-supplied**: defaults to the filename stem in the
wizard's Confirm step, editable before commit. R∞ adds rename UI
on the Dataset row.

**Counts and columns are never null**: they are set at commit
time by the wizard, populated from the parsed Parquet schema.
The two-phase upload flow (see [upload.md](upload.md)) means the
Dataset only exists once parsing succeeded.

**Deferred fields**: `updatedAt`, `parsedAt`, `parseDurationMs`,
`tags`, `description`, `sourcePath`. Each lands when a UI surface
or operational concern needs it.

---

## Workspace filter behavior

- Dropdown sourced from `useWorkspacesQuery()` (R13's hook).
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

## Read/write boundary (R15+ scope)

**R15+ implements**:

- `DatasetTable` component with default-sort, workspace filter,
  client-side search.
- `DatasetsPage` route at `/data-management/datasets`.
- Workspace filter via URL query param.
- `useDatasetsQuery(workspaceId?: string)` returning datasets for
  the given workspace (or all if omitted).
- `GET /datasets?workspace_id=<id>` backend route.
- Workspace card click navigates to the filtered view (R13's
  Workspaces page gets a one-line behavioral update).
- `+ Upload` button navigates to the wizard route
  `/data-management/datasets/new` (see [upload.md](upload.md)).

**Deferred** (not in R15+'s implementation chain):

- ~~**Dataset detail view** (clicking a row). R∞ until a downstream
  surface (query, dashboard) needs a per-dataset URL.~~ **Resolved
  by R33** ([dataset-detail.md](dataset-detail.md)) — per-dataset
  inspector page at `/datasets/:id` with paged row table. R34
  (contract), R35 (BE), R36 (FE) implement against R33's design.
- **Rename dataset / delete dataset**. R∞ until a user has a
  mis-named or stale dataset blocking work.
- **Re-parse** (re-run parser without re-uploading). R∞.
- **Column-level affordances** (rename column, override dtype). R∞
  per [upload.md](upload.md)'s deferral list.
- **Saved-filter / pinned-search**. R∞.
- **Bulk operations** (multi-select, bulk delete). R∞.
- **Pagination / virtualization**. The table is single-page until
  a real user has 100+ datasets; AntD `<Table>`'s default
  pagination kicks in at 10 rows per page as a stopgap. Virtual
  scroll lands when 1000+ rows is a real number.

---

## Backend endpoint shape

R15+ ships:

```python
# apps/backend/app/routers/datasets.py
@router.get("/datasets", response_model=list[Dataset])
def list_datasets(workspace_id: str | None = None) -> list[Dataset]:
    # Returns datasets ordered createdAt desc. When workspace_id is
    # provided, scopes to that workspace; otherwise returns all
    # datasets across all workspaces. All returned datasets are
    # committed-ready by definition (no transient or failed rows).
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

R11's `NAV_GROUPS` had `Datasets (sample)` as a placeholder; R14
promotes it to real. R15+ ships:

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

The `Schemas (sample)` item from R11's sidebar remains sample for
now — no real surface pulls it in yet. R∞ promotes if schema
editing becomes a real feature.

**Active state**: when route is `/data-management/datasets`
(with or without `?workspace=...`), Datasets is highlighted.
Workspace filter does not change which sidebar item is active.

---

## Lifecycle

This doc:

- **Amended in place** during R15+ if implementation surfaces a
  decision not pre-baked here (table column widths, exact filter
  UI, etc.).
- **Superseded** by `datasets-v2.md` if dataset semantics grow
  beyond "the result of a CSV upload" (e.g., virtual datasets
  defined by a saved query, or imported tables from a connector).
- **Folded back** into a `data-management/` overview doc if the
  data-management spine (workspaces + datasets + queries +
  dashboards) cohere as one cross-feature design.

R15+'s Act section confirms which lifecycle event applies.

---

## Open questions answered in R14 (mid-round reframe)

| Q                                                        | Decision                                                                           | Source                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| Should upload be its own sub-menu (vs Workspaces child)? | Datasets is the noun and the sub-menu item; upload is a verb against datasets.     | R14 HIxAI Q9 (user-directed)  |
| Card grid or table list for the dataset index?           | Table list — sortable columns, workspace filter (no status column)                 | R14 HIxAI Q10 (user-directed) |
| Workspace detail page route?                             | No dedicated route — workspace cards link to `/datasets?workspace=<id>`            | R14 HIxAI Q11 (user-directed) |
| `datasets.md` vs single `upload.md`?                     | Two docs — noun (datasets.md) + verb (upload.md), cross-referencing                | R14 mid-round design decision |
| Empty state for filtered view?                           | Drop zone with workspace name; submit takes user into the wizard pre-filled        | R14 mid-round design decision |
| Keep `status` field on Dataset?                          | No — wizard validates pre-commit, every persisted Dataset is ready                 | R14 HIxAI Q12 (lean accepted) |
| Wizard column-dtype override in step 2?                  | No — trust inferred types; override is R∞ until a real user is blocked             | R14 HIxAI Q14 (lean accepted) |
| Primary data source for R15?                             | Excel (CRM-export dominant), CSV secondary. Dataset gains sourceFormat + sheetName | R14 HIxAI Q15 (user-directed) |
