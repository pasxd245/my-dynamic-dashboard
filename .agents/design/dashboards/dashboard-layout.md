# Dashboard layout — catalog, detail page and the widget grid

**Concept**: a **Dashboard** is a named, workspace-scoped noun that persists an ordered set of
formula-free widgets, each bound to a saved Query and re-run **live** against the latest upload
every time the dashboard opens. This doc covers the two pages (the catalog at
`/settings/dashboard` and the detail view at `/dashboards/:workspaceId/:slug`), the CSS-grid
layout (`Widget.span` × `Widget.rows`), the per-widget card shell and its states, drag-reorder,
the per-widget filter drawer, the read-only metadata surfaces, and the dashboard CRUD contract.
The widget kinds, the builder, notes, table totals, export and number formats live in the
sibling [widgets.md](widgets.md).
**Status**: Accepted.
**Domain folder**: `dashboards/` — code in
[`apps/builder/src/features/dashboard/`](../../../workspace/apps/builder/src/features/dashboard/)
(singular), backend
[`app/routers/dashboards.py`](../../../workspace/apps/backend/app/routers/dashboards.py).
**Sibling docs**: [widgets.md](widgets.md) (what goes in a grid cell),
[queries.md](../data-management/queries/queries.md) (the saved Query every data widget binds to,
and the `/aggregate` route), [metadata.md](../data-management/_shared/metadata.md) (the
metadata entries this page shows read-only),
[workspace-shell.md](../_platform/workspace-shell.md) (the chrome and the nav these pages sit in).

---

## Why the dashboard is a persisted noun

The product exists to end the weekly report-maintenance treadmill: a dashboard is built once and
re-runs itself against each new upload. So the dashboard stores **which** widgets it shows and
how they are configured, never their numbers. Its widgets are embedded JSON in the dashboard row
(`definition_json`, mirroring `queries.definition_json`) — there is no widgets table, because a
widget has no life outside its dashboard and nothing references a widget by id.

Lifecycle and viewing are split on purpose: **create / rename / delete** live on the catalog
(`Settings › Dashboard`); the detail view is for **viewing and building widgets**. Every widget
edit on the detail view persists by re-sending the whole dashboard (`PUT /dashboards/{id}`, a
full-representation replace) — one idempotent endpoint instead of widget sub-resources.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                                                                                      | Layer                                                         | Reusability  | Purity                           | Allowed peer deps                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DashboardListPage` route (`/settings/dashboard`) — catalog grid + create / rename / delete                                                                  | `apps/builder/src/features/dashboard/`                        | feature      | feature                          | react, antd, @mdd/ui, react-router-dom, react-i18next, @tanstack/react-query (via hooks)                    |
| `DashboardCard` (file-private in `DashboardListPage.tsx`)                                                                                                    | `apps/builder/src/features/dashboard/`                        | feature      | plain-UI                         | react, antd, @ant-design/icons, react-i18next                                                               |
| `NameModal` — create (workspace + name + slug) / rename (name only)                                                                                          | `apps/builder/src/features/dashboard/`                        | feature      | plain-UI                         | react, antd, react-i18next                                                                                  |
| `slugify` (`slug.ts`)                                                                                                                                        | `apps/builder/src/features/dashboard/`                        | feature      | pure                             | none                                                                                                        |
| `DashboardDetailPage` route (`/dashboards/:workspaceId/:slug`)                                                                                               | `apps/builder/src/features/dashboard/`                        | feature      | feature                          | react, antd, @mdd/ui, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, react-router-dom, react-i18next |
| `SortableWidget` (file-private) — grid cell + header actions                                                                                                 | `apps/builder/src/features/dashboard/`                        | feature      | glue (dnd-kit + export download) | react, antd, @dnd-kit/sortable, @dnd-kit/utilities, react-i18next                                           |
| `gridColumns` / `gridCell`                                                                                                                                   | `apps/builder/src/features/dashboard/DashboardDetailPage.tsx` | feature      | pure                             | none                                                                                                        |
| `ChartCard` — the per-widget card shell + states; `bodyHeight`, `ROW_HEIGHT`, `ROW_GAP`                                                                      | `apps/builder/src/features/dashboard/`                        | feature      | plain-UI                         | react, antd, @ant-design/icons, react-i18next                                                               |
| `WidgetFilterDrawer`                                                                                                                                         | `apps/builder/src/features/dashboard/`                        | feature      | glue (server-data)               | react, antd, @ant-design/icons, react-i18next                                                               |
| `MetadataPanel` / `MetadataEntriesList` (consumed, owned by [metadata.md](../data-management/_shared/metadata.md))                                           | `apps/builder/src/features/metadata/`                         | feature      | glue (server-data)               | react, antd, @ant-design/icons, react-i18next, @tanstack/react-query                                        |
| `useDashboardsQuery`, `useAllDashboards`, `useCreateDashboardMutation`, `useUpdateDashboardMutation`, `useDeleteDashboardMutation`, `useWidgetFilterOptions` | `apps/builder/src/features/dashboard/hooks.ts`                | feature      | glue (server-data)               | @tanstack/react-query                                                                                       |
| `dashboardsApi` (`list` / `get` / `create` / `update` / `delete`)                                                                                            | `apps/builder/src/api/`                                       | builder-only | glue                             | (fetch — no extra peer dep)                                                                                 |
| `wireToDashboard` / `widgetsToDefinition` (`wire.ts`)                                                                                                        | `apps/builder/src/features/dashboard/`                        | feature      | pure                             | none                                                                                                        |
| `Dashboard`, `Widget` (FE state, `types.ts`) + `DashboardWire`, `WidgetWire` (`wire.ts`)                                                                     | `apps/builder/src/features/dashboard/`                        | data type    | data type                        | none                                                                                                        |
| `Dashboards` nav group (`AppLayout`) — Dashboards › ‹Workspace› › ‹Dashboard›                                                                                | `apps/builder/src/components/`                                | builder-only | glue                             | react, antd, react-router-dom                                                                               |
| `POST` / `GET /workspaces/{id}/dashboards`, `GET` / `PUT` / `DELETE /dashboards/{id}`                                                                        | `apps/backend/app/routers/dashboards.py`                      | backend      | feature                          | (FastAPI — backend native; raw `sqlite3`)                                                                   |
| `Dashboard`, `DashboardDefinition`, `CreateDashboardBody`, `UpdateDashboardBody`, `ApiErrorSlugTaken`                                                        | `apps/backend/app/models/common.py`                           | backend      | data type                        | (Pydantic)                                                                                                  |

**Boundary check**: nothing here lives in `@mdd/ui`. The pages reuse the existing `@mdd/ui`
shells (`PageContainer`, `PageHeader`, `PageCard`) unchanged; every dashboard surface is
feature-local because it has exactly one consumer. `SafeMarkdown` is the one cross-feature
import in the other direction — `features/metadata/` imports it from `features/dashboard/`
(see [widgets.md](widgets.md)). The per-UI rule is the one in
[memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md).

---

## Token map

All values are AntD tokens derived from the seeds in
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts) (the source of truth),
read through `theme.useToken()` or AntD component defaults. Values are informational.

| Surface                                         | AntD token                                        | Value (informational) |
| ----------------------------------------------- | ------------------------------------------------- | --------------------- |
| Page background (shell)                         | `colorBgLayout`                                   | derived               |
| Page content cap (both pages)                   | `contentWidthData` (layoutTokens, themeTokens.ts) | `1600`                |
| Catalog card + widget card background           | `colorBgContainer`                                | derived               |
| Card border                                     | `colorBorderSecondary`                            | derived               |
| Catalog card initial badge background           | `colorPrimaryBg`                                  | derived               |
| Catalog card initial badge text                 | `colorPrimary`                                    | `#1677ff`             |
| Catalog card badge radius                       | `borderRadius`                                    | `6`                   |
| Catalog card workspace + widget count           | `colorTextSecondary`                              | derived               |
| Primary actions (`New dashboard`, `Add widget`) | `colorPrimary`                                    | `#1677ff`             |
| Active filter icon (filled)                     | `colorPrimary`                                    | `#1677ff`             |
| Over-cap warning icon (card title)              | `colorWarning`                                    | derived               |
| Widget error-state icon                         | `colorWarning`                                    | derived               |
| Drag handle / header icons                      | `colorText` (AntD text button)                    | derived               |
| Metadata AI badge / stale badge                 | AntD `Tag` presets `purple` / `warning`           | preset                |

No new token is introduced. The grid gap (16) and the card body height (300) are layout
constants in code, not tokens. Identifier parity is enforced by
[`design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs).

---

## Layout — ASCII intent

### Catalog — `/settings/dashboard`

```text
Home ▸ Settings ▸ Dashboard                                         [+ New dashboard]
Dashboards
Live dashboards over your data — each widget re-runs a saved query.
┌─ PageCard ──────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ [W]       ⋯  │ │ [L]       ⋯  │ │ …            │ │ …            │             │
│ │ Weekly report│ │ Lead funnel  │ │              │ │              │             │
│ │ Sales demo   │ │ Marketing    │ │              │ │              │             │
│ │ Widgets: 6   │ │ Widgets: 3   │ │              │ │              │             │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                ⋯ = Rename · Delete
```

- One card per dashboard across **every** workspace (`useAllDashboards` fans out one
  `GET /workspaces/{id}/dashboards` per workspace; there is no global list endpoint). Grid
  `xs=24 md=12 xl=8 xxl=6`. Card: initial-letter badge, name, owning workspace name, widget
  count. Click → the detail route; the `⋯` menu (click does not open the card) has Rename and
  Delete.
- **States**: loading spinner; **no workspace yet** (`dashboard.setupTitle` / `setupHint`, and
  the `New dashboard` button is disabled); **empty** (`dashboard.emptyTitle` + a large
  `New dashboard` button).
- **Create** (`NameModal withSlug` + `workspaces`): pick the workspace (preselected when there is
  exactly one), type the name; the slug auto-fills with `slugify(name)` (NFKD, diacritics
  stripped, so `Báo cáo tuần` → `bao-cao-tuan`) until the user edits it by hand. Success
  navigates to the new dashboard. Errors: `name_taken` / `slug_taken` → toast
  (`dashboard.error.nameTaken` / `slugTaken`), anything else → `common.error`.
- **Rename** (`NameModal`, name only): sends `PUT` with the new name and the **unchanged** slug
  and widgets; `name_taken` → toast.
- **Delete**: confirm modal (`dashboard.deleteTitle` + `deleteHint` — "the underlying queries are
  not affected").

### Detail — `/dashboards/:workspaceId/:slug`

```text
Home ▸ Dashboards ▸ Sales demo ▸ Weekly report                          [+ Add widget]
Weekly report
Notes & insights  3 notes · 1 by AI   [Warn 1]   View all ›   (only when something is written; R206)
     column 1                    column 2                    column 3
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│ ① Calls by agent ⋮⋮ ⓘ ⏷ ⋯│ │ ② CR2 trend      ⋮⋮ ⏷ ⋯ │ │ ③ This week (note) ⋮⋮ ⋯ │
│   span 1 · rows 2       │ │   span 1 · rows 1       │ │   span 1 · rows 1       │
│                         │ └─────────────────────────┘ └─────────────────────────┘
│                         │ ┌───────────────────────────────────────────────────────┐
│                         │ │ ④ Leads by source  span 2 · rows 1          ⋮⋮ ⏷ ⋯    │
│                         │ │                                                       │
└─────────────────────────┘ └───────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ⑤ Lead funnel (table)  span 3 · rows 1                              ⋮⋮  ⤓  ⏷  ⋯    │
│   paged rows … footer: Total · 1,284 · 5.5%                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
   ⋮⋮ drag handle · ⓘ metadata · ⤓ export (table only) · ⏷ filter (not on notes) · ⋯ Edit / Delete
   ① is two rows tall; ② ③ fill row 1 beside it and ④ fills row 2 beside it (sparse
   auto-placement in `definition.widgets` order).
```

- **Breadcrumb** mirrors the nav: `Home › Dashboards › ‹Workspace› › ‹name›`; only Home links
  (Dashboards and the workspace are nav groupings with no page).
- **Header action**: `Add widget` opens the builder ([widgets.md](widgets.md)).
- **Notes & insights block** (R202 → R206; replaced R180's inline panel): the bar line, the most
  serious current notes as rows, and the reading pane — beside the grid from 1200 px (the grid gives
  up a column), over it below. Read-only. Shape, badges, placement and the write API are owned by
  [metadata.md](../data-management/_shared/metadata.md) § Reading by layer.
- **Empty dashboard**: a card with `dashboard.noWidgets` and an `Add your first widget` button.
- **Unknown slug** (deleted, stale or mistyped link): the global `NotFoundPage`, not a
  dashboard-flavoured page.

---

## The grid

The widget area is a **CSS grid**, not a flex-wrap row. A flex row is only as tall as its
tallest card, so a two-row widget used to leave dead space under its one-row neighbours; in a
2-D grid the next widgets flow into that space, so `Widget.rows` is a layout, not just a bigger
box.

- **Columns** — `gridTemplateColumns: repeat(N, minmax(0, 1fr))`, gap 16. `gridColumns(screens)`
  maps AntD `Grid.useBreakpoint()` to N: **3** at `xl`, **2** at `md`, else **1**; nothing known
  yet (first render, no `matchMedia`) → 3.
- **Cell** — `gridCell(widget, cols)` = `{ cols: min(span, N), rows: rows ?? 1 }`, applied as
  `gridColumn: span <cols>` + `gridRow: span <rows>` (`data-span` / `data-rows` on the cell).
  A widget wider than the grid is clipped to a full row (a `span: 2` widget on a 2-column grid
  is a full row).
- **Auto-placement is sparse** (no `grid-auto-flow: dense`): widgets keep `definition.widgets`
  order, and a dashboard whose widgets are all one row tall lands exactly where the old flex grid
  put it. A tall widget sits beside short ones stacked in the next column(s), because the
  following widgets fill the free cells to its right before starting a new grid row.
- **Height** — every card body is a fixed box so the grid never reflows while widgets resolve:
  `bodyHeight(rows) = ROW_HEIGHT × n + ROW_GAP × (n − 1)` with `ROW_HEIGHT = 300` and
  `ROW_GAP = 16 + (56 + 12 + 24 + 1)` (the grid gap plus one card's chrome: header, body
  padding top/bottom, border). So a `rows: 2` card is exactly as tall as two stacked `rows: 1`
  cards (393 + 16 + 393 = 802). All card states use the same height.
- `span` and `rows` are both 1–3 and are presentation only — neither changes a widget's data.

---

## Behaviour

### Card shell and per-widget states

`ChartCard` is the shell every widget renders in (title, header-right `extra` slot, optional
inline `warning` next to the title). Its body is one of independent render states, each at the
widget's full body height:

- **Loading** — AntD `Skeleton` (6 rows).
- **Error** — warning icon, `dashboard.state.error` + `errorHint`, and a Retry button when the
  widget supplies `onRetry`.
- **Missing query** — `dashboard.state.missingQuery` ("Saved query unavailable") +
  `missingQueryHint`; shown when the bound query returns `404` (R191).
- **Empty** — `dashboard.state.empty` ("No data to chart"); a note with blank text is also empty.
- **Ready** — the chart, table or note.

A widget whose saved query was deleted after save does not crash the page: the bound-query fetch
returns `404 not_found`, which is not retried, and the card shows the **missing query** state
(`WidgetView` `isMissingQuery`), not the generic error (R191).
A data widget whose raw-row fetch hit the dashboard row cap shows a **⚠ partial data** icon next
to the title (tooltip: first `DASHBOARD_MAX_ROWS` = 10 000 of N rows); see
[widgets.md § Data paths](widgets.md#data-paths).

### Header actions (left to right)

1. **Drag handle** (`HolderOutlined`, `cursor: move`) — only when the dashboard has ≥ 2 widgets.
   The handle is the only drag activator, so the chart and menus keep their clicks.
2. **Notes** — only when the widget has ≥ 1 entry: severity chips (`+N`) or the ⓘ button
   (`WidgetMetadataButton`); a click opens the reading pane on the widget (R202; was a popover). The
   entries come from the dashboard's single metadata read (`children[widget.id]`).
3. **Export** (`DownloadOutlined`) — `table` widgets only; a menu with
   `Download as Excel (.xlsx)` and `Download as CSV` ([widgets.md § Export](widgets.md#export)).
4. **Filter** — every kind except `note`; outline `FilterOutlined` when inactive, filled
   `FilterFilled` in `colorPrimary` with `aria-pressed` when any filter on the widget has values.
5. **`⋯`** — Edit (opens the builder seeded with the widget) / Delete (danger confirm).

### Reorder

`@dnd-kit` (`DndContext` + `SortableContext`, `rectSortingStrategy`, `closestCenter`), with a
pointer sensor (4 px activation distance) and a keyboard sensor (`sortableKeyboardCoordinates`),
plus screen-reader announcements (`dashboard.reorder.picked` / `moved` / `cancelled`). The order
is the `definition.widgets[]` order. On drop the new order shows immediately and is persisted
with the same full `PUT`; a failed save reverts it and toasts `common.error`. A local order is
kept and resynced whenever the server's widget-id list changes.

### Persisting widget edits

Add, edit and delete each build the next widget list and `PUT` the dashboard with its unchanged
`name` and `slug`. Widget ids are **client-generated** (`wdg_` + 8 hex from
`crypto.randomUUID()`) because the builder manipulates the widget before any save. The builder
closes on submit; a failed save toasts `common.error`.

### Filter drawer

`WidgetFilterDrawer` is a right-side AntD `Drawer` (width 360) that filters **one** widget at
runtime on its **own** categorical columns, so there is never cross-widget column matching.

- Progressive disclosure: `Add filter` (searchable) → pick a column → pick values in a
  multi-select. Only added filters are shown; each has a remove button; `Clear` (drawer extra)
  drops them all.
- Options come from `useWidgetFilterOptions(queryId)`: every non-numeric column with its distinct
  values, read from the widget's raw-row fetch (shared cache with the widget). When that fetch
  was capped, an info alert says the values come from the first 10 000 rows.
- Semantics: one-of within a column, AND across columns; a filter with no values is inactive; a
  NULL / empty cell is the `(blank)` option (sent to the server as `null`).
- Where it runs: the aggregating kinds, table totals and export send the filters to the server;
  the raw-row kinds (and the table's own rows) apply them client-side. Details in
  [widgets.md § Data paths](widgets.md#data-paths).
- State is **FE-only**: a `widgetId → filters` map that resets on every visit; nothing is saved
  on the dashboard.

### Cache keys (TanStack)

- `['dashboards', { workspaceId }]` — one workspace's list. The catalog, the nav and the detail
  page share it (the detail page resolves `slug` → dashboard from this list; there is no slug
  endpoint).
- `['dashboard', id]` — single-dashboard key, invalidated on update and removed on delete.
- Create / update / delete invalidate the `['dashboards']` prefix.

---

## Data contract

> The OpenAPI 3.1 YAML is authoritative:
> [`_shared/dashboard.yaml`](../../../workspace/packages/contracts/_shared/dashboard.yaml) and
> [`dashboards/*.contract.yaml`](../../../workspace/packages/contracts/dashboards/). The
> `Widget` fields are specified in [widgets.md § Widget model](widgets.md#widget-model).

### Model

`Dashboard` has `id` (`dsh_<8 hex>`), `workspaceId` (`ws_…`), `name` (1–120), `slug`,
`definition` (`{ widgets: Widget[] }`) and `createdAt` (ISO-8601 UTC, `Z`). There is no
`updatedAt`. `slug` matches
`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 120. Empty `widgets` is valid.

Table `dashboards` (SQLModel schema of record; handlers use raw `sqlite3`): `id` PK,
`workspace_id` FK → `workspaces` **ON DELETE CASCADE**, `name`, `slug`, `definition_json`,
`created_at`; `CHECK length(name|slug) BETWEEN 1 AND 120`; unique indexes
`idx_dashboards_name_unique` on `(workspace_id, name)` and `idx_dashboards_slug_unique` on
`(workspace_id, slug)` — **both name and slug are unique per workspace** (the URL nests the
workspace, so two projects may each have `weekly-report`).

The FE adapts at one boundary: `wireToDashboard` flattens `definition.widgets` onto the FE
`Dashboard` (and drops `createdAt`); `widgetsToDefinition` nests them back for a write.

### Routes

| Method   | Path                          | Body                                        | Success                                                    | Errors                                                      |
| -------- | ----------------------------- | ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `POST`   | `/workspaces/{id}/dashboards` | `{ name, slug, definition }`                | `201` → `Dashboard`                                        | `409 name_taken` / `409 slug_taken`; `422` FastAPI envelope |
| `GET`    | `/workspaces/{id}/dashboards` | —                                           | `200` → `Dashboard[]`, `ORDER BY created_at DESC, id DESC` | —                                                           |
| `GET`    | `/dashboards/{id}`            | —                                           | `200` → `Dashboard`                                        | `404 not_found`                                             |
| `PUT`    | `/dashboards/{id}`            | `{ name, slug, definition }` (full replace) | `200` → `Dashboard`                                        | `404 not_found`; `409 name_taken` / `slug_taken`; `422`     |
| `DELETE` | `/dashboards/{id}`            | —                                           | `204`                                                      | `404 not_found` (no `409`: nothing references a dashboard)  |

- **Save-time widget validation** (`422`): the Pydantic `Widget` rules (see
  [widgets.md § Widget model](widgets.md#widget-model)) plus `_validate_widget_queries` — every
  non-note widget's `queryId` must be a query in **this** dashboard's workspace, else
  `detail[].msg = "unknown_query: …"`. A query deleted **after** save is tolerated and only
  breaks that widget's render.
- `409` is mapped from the SQLite unique-index violation (`dashboards.slug` → `slug_taken`,
  `dashboards.name` → `name_taken`), code-first envelope.
- Responses are `model_dump(exclude_none=True)`: optional widget fields that were never set
  (e.g. `rows`) are absent, so a dashboard saved before a field existed re-fetches unchanged.
- Deleting a dashboard removes its widgets with it; the referenced queries are untouched.
  Deleting the workspace cascades to its dashboards.

---

## Acceptance criteria

**User journey** — as an analyst I create a dashboard in a workspace, add widgets over my saved
queries, size and arrange them on a grid, slice a widget with a filter, and reopen it next week
to see the same widgets re-run on the new upload.

1. **Catalog** _(FE)_ — `/settings/dashboard` lists every workspace's dashboards as cards (name,
   workspace, widget count); loading, no-workspace (create disabled) and empty states render.
2. **Create** _(FE + BE)_ — the modal requires workspace + name; the slug auto-derives via
   `slugify` until edited; success navigates to `/dashboards/<ws_id>/<slug>`; `name_taken` /
   `slug_taken` show their own message.
3. **Rename / delete** _(FE + BE)_ — rename keeps the slug and widgets; delete confirms and
   returns `204`; a second delete is `404`.
4. **Uniqueness** _(BE)_ — name and slug are unique per workspace; the same slug in two
   workspaces is allowed.
5. **Detail resolution** _(FE)_ — the route resolves `(workspaceId, slug)` from the workspace
   list; an unknown slug renders `NotFoundPage`.
6. **Grid** _(FE)_ — 3 / 2 / 1 columns at `xl` / `md` / smaller; each cell spans
   `min(span, columns)` columns and `rows ?? 1` rows; a `rows: 2` card is as tall as two stacked
   `rows: 1` cards (`bodyHeight`).
7. **Card states** _(FE)_ — loading, error (with retry where offered), missing query, empty and
   ready render at the same height; a deleted bound query shows the missing-query state, not a
   crash (R191).
8. **Reorder** _(FE)_ — dragging by the handle (pointer or keyboard) persists the new order via
   `PUT`; a failed save reverts; the handle is hidden with fewer than two widgets.
9. **Filter drawer** _(FE)_ — offers the widget's non-numeric columns and their distinct values;
   the filter icon is filled while a filter has values; filters reset on reload; notes have no
   filter button.
10. **Metadata** _(FE)_ — the Notes & insights block and the widget's chips / ⓘ appear only when
    entries exist and offer nothing to edit (R206; was the page panel and a popover).
11. **Contract** _(pytest)_ — create `201`, list newest-first, get / put `404` on an unknown id,
    a widget bound to another workspace's query is `422`, and an absent optional widget field is
    not backfilled on read.

---

## Scope boundary

### IN scope

- The catalog and detail pages, the CSS-grid layout and its sizing math, the card shell states,
  drag-reorder, the per-widget filter drawer, the read-only metadata placements, and the
  dashboard CRUD contract.

### OUT of scope (deferred with named triggers)

- **Saved / shared filters** (persisting a widget's filter, or one filter driving several
  widgets) — filters are deliberately per-visit FE state here. Pulled: designed in
  [dashboard-filters.md](dashboard-filters.md) (dashboard controls, URL-held viewer values),
  built by items 3.7 / 4.2 / 4.3 of the release program; the per-widget drawer stays.
- **Dense packing / free-form placement** (`grid-auto-flow: dense`, x/y coordinates) — order is
  the only placement; pull when sparse auto-placement leaves holes users complain about.
- **`updatedAt` / audit fields on the dashboard** — not modelled; metadata entries carry their
  own author and time.

### This concept explicitly does NOT cover

- Widget kinds, the builder, note markdown, table totals, export and number formats — see
  [widgets.md](widgets.md).
- The metadata entry model, write API and staleness rule — see
  [metadata.md](../data-management/_shared/metadata.md).
- The saved Query, its steps and the `/aggregate` route — see
  [queries.md](../data-management/queries/queries.md).
- The app shell and nav chrome — see [workspace-shell.md](../_platform/workspace-shell.md).

---

## Reference materials (read-only)

- [crud-hygiene.md](../data-management/_shared/crud-hygiene.md) — the card + `⋯` overflow
  pattern the catalog follows (the dashboard uses its own `NameModal` and AntD confirm rather
  than the shared rename / delete modals, because create also picks a workspace and a slug).
- [`dashboards/*.contract.md`](../../../workspace/packages/contracts/dashboards/) — per-route
  rationale.
