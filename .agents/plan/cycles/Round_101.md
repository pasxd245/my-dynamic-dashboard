# Round 101: Dashboard as a persisted noun — create / name / list dashboards (headline-value round)

**Status**: **COMPLETE** — signed off by the human 2026-06-28 (DFCFBI 1,2,4,5; all gates Design · F1 ·
Contract · F2 · Backend · Integration CLOSED). The dashboard is now a **persisted, user-created noun**
(define once → re-runs live → survives reload). Settled decisions: workspace = **project** → widgets
constrained to the dashboard's workspace; `name` **and** `slug` unique **per-workspace**; route
**`/dashboards/<ws_id>/<slug>`**; nav **`Dashboards › [Workspace] › [Dashboard]`**. Contract = **5
endpoints** + shared schema + `slug_taken`. Backend = SQLModel `Dashboard` + additive `0002_dashboards`
migration + the 5 endpoints. Frontend = real-API persistence + wire↔FE adapter + formula-free builder
(workspace-at-create · query picker inherits) + 3-level nav (extended shared `WorkspaceShell`). **Final
green: backend 215 · contracts 29 · builder 210 (+ type-check + build) · ui 27.**
**Date started**: 2026-06-26
**Date completed**: 2026-06-28
**Flow**: **DFCFBI (triggers 1, 2, 4, 5)** — set at the Design gate via `flow-selector`; recorded in the
Do log. The widget-builder UX is discovered at **F1 before the Widget contract shape freezes**
(condition 4). Per [[dfcfbi-two-round-split]] this may split [D+F1+design-sync] then [C+F2+B+Integration]
— here the round is **not** FE-only (backend + migration + contract), so the split is the full chain.

## Goal

Turn the dashboard from R100's single hardcoded `Sales` leaf into a **persisted, user-created noun**: a
user can **create + name + list** dashboards (e.g. `Dashboard › Weekly report`), the nav lists them
**dynamically** from the saved set, and each dashboard persists **which widgets it shows** (each widget =
a saved Query + chart type + group/value mapping — R100's three become a default/seed).

**This is the round where the headline value lands** ([[product-value-framing]] · [[post-mvp-roadmap-migration-first]]):
a dashboard **defined once** that **re-runs live on the latest upload** and **absorbs CRM drift** — the
way out of the report-maintenance treadmill. R100 only proved the render path; persistence is what makes
the analysis a durable, reusable thing.

**Hard constraint:** creating/configuring a dashboard must stay **formula-free** — pick a saved Query +
choose a chart from UI controls; never write/read a formula ([[product-value-framing]] #1).

_Track: 1 (product). Pulled by ← R100 Feeds-into + the human's F1 feedback (dynamic widgets · multiple
named dashboards · settings) + "persist-noun next" choice. Per the [Evolution Rule](../../AGENTS.md)._

## Design decisions (ratified — human, 2026-06-26)

1. **Data model.** `Dashboard { id, workspaceId, name, definition, createdAt }` where
   `definition = { widgets: Widget[] }` and
   `Widget = { id, queryId, title, chartType, dimensionCol, measureCol?, agg }`. **Embedded-JSON
   `definition`** (mirrors `queries.definition`; no separate `dashboard_widgets` table),
   **workspace-scoped** (consistent with Datasets/Queries IA). `chartType ∈ {bar, pie}`;
   `agg ∈ {sum, count}` (`measureCol` required for `sum`, omitted for `count`).
2. **Widget → query binding = `queryId` (FK).** A deleted query → the widget renders a per-widget
   **"query unavailable"** state (reuse R100's `ChartCard` missing/error state), never a crash. A rename
   is fine (id stable).
3. **Scope = FULL widget builder (ratified).** R101 ships persist + CRUD + dynamic nav **and** a
   **formula-free widget builder**: add a widget by picking a saved Query → `dimensionCol` / `measureCol`
   / `agg` / `chartType` **defaulted from the query's column dtypes** (first categorical = dimension,
   first numeric = measure, `sum`, `bar`) and **adjustable via dropdowns**. No formulas, ever. Runtime
   interactivity (filters/date-range/drill — feedback ①) stays the **next** round.
4. **Migration = additive** alembic revision adding a `dashboards` table (mirrors `queries`; clean-slate
   `0001` is the current baseline).
5. **Nav = dynamic** list under the `Dashboard` group from `GET …/dashboards` (replaces R100's hardcoded
   `sales-dashboard` leaf); empty state when none; a `New dashboard` affordance.
6. **Settings = name only** this round; layout / default-range deferred to a follow-on.
7. **Flow** — set at Design exit via `flow-selector` (below).

## Declared affordances + states (for `ux-design --design-spec`)

The build must carry these (declared now so they aren't discovered late, per R100's lesson):

+ **Dashboard list** — labelled `New dashboard` action; **empty state** ("no dashboards yet → create
  one"); loading + error states.
+ **Create / rename** — a labelled name field (1–120 chars, required, unique-per-workspace echoing the
  query/dataset rule); primary **Create** / **Save**; **Cancel**; inline validation error.
+ **Dashboard detail** — the widget grid (reuses R100 widgets); **no-widgets empty state** ("add your
  first widget"); a labelled **Add widget** action; **per-widget edit + remove** (edit re-opens the
  builder on that widget; remove via a labelled `×`, confirm if it's the only widget); **Delete
  dashboard** (confirm modal, like queries). _Reorder / drag-arrange is **deferred** to the
  dynamic-widgets round (feedback ①) — not silently dropped._
+ **Widget builder** — labelled controls: **Query** (select), **Dimension** (select), **Measure**
  (select, hidden when `agg=count`), **Aggregation** (sum/count), **Chart** (bar/pie), **Title** (text);
  a **live preview** of the widget; primary **Add/Save widget** + **Cancel**; the **per-widget
  "query unavailable"** state for a dangling `queryId`.
+ **Accessibility** — every select/field has a visible label + accessible name; keyboard-reachable;
  errors not colour-only. **Desirability** — AntD components + theme tokens (no ad-hoc styling).

## Plan (provisional — finalize at Design)

1. **Design gate** — ratify the data model + the 7 questions; run `flow-selector` + `ux-design
   --design-spec`. **Human ratify.**
2. **Contract** — `Dashboard` schemas + CRUD endpoints (create / list / get / update / delete), MSW
   aligned, YAML committed.
3. **Backend** — SQLModel `Dashboard` + alembic migration; per-endpoint behavior + conformance tests.
4. **Frontend** — list/create/detail surface; dynamic nav; the detail reuses R100's widget components,
   now bound by `queryId` from the persisted definition.
5. **Integration** — create a `Weekly report` dashboard against the real seeded backend; it persists,
   re-runs live, and survives a reload. **Human confirm + Complete.**

## Acceptance criteria (finalize at Design)

+ [x] A user can **create + name** a dashboard and it **persists** (survives reload / re-run) — `dashboards`
  table + create/PUT; human created `test 1 2 3` against the real backend and it survived reload.
+ [x] The `Dashboards` nav lists saved dashboards **dynamically** (now grouped by project — `Dashboards ›
  ‹Workspace› › ‹Dashboard›`); `New dashboard` works; empty state.
+ [x] A dashboard's widgets bind to saved Queries by id and render **live** aggregates (reusing R100's
  widget components); a dangling `queryId` shows a per-widget "unavailable" state (`ChartCard` missingQuery).
+ [x] A widget can be **added, edited, and removed** via the formula-free builder (pick query →
  dimension/measure/agg/chart, defaulted + adjustable). _(Reorder deferred.)_
+ [x] Backend `Dashboard` entity + **additive alembic migration** (`0002_dashboards`); contract +
  conformance tests pass (215 backend · 29 contract · schema-parity).
+ [x] Creating/configuring stays **formula-free** (pick query + columns + chart via UI; no formula path).

## Do

### Plan-gate draft — opened from R100 (2026-06-26)

R100 (static render-proof) Complete + signed off. Human's F1 feedback (widgets should be dynamic ·
nav should host created dashboards like `Dashboard › Weekly report` · do we need settings?) maps to this
theme; human chose **persist-noun first** (value-first sequence: persist → dynamic widgets → settings).
Drafted the goal, data-model proposal, and the 7 open Design questions. **Next: human Design-gate
kickoff.**

### Design decisions ratified (human, 2026-06-26)

Human ratified the proposed data model + the clear decisions, and chose **scope = full widget builder**
(persist + CRUD + dynamic nav + a formula-free pick-query→dimension/measure/chart builder). All 7
questions resolved (see Design decisions above). Declared the affordances/states. **Next: run
`flow-selector` + `ux-design --design-spec`, then human signs the Design gate.**

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                  |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | list · create/rename · detail (widget grid) · widget-builder (query→dim/measure/agg/chart + preview) · delete-confirm · per-widget unavailable. |
| 2. New interaction pattern           | yes    | A formula-free **widget-definition builder** with a live chart preview — not previously in the product (R100's charts were not configurable). |
| 3. High user-error risk              | no     | Misconfiguring a widget is low-stakes (re-pick); the one destructive action (delete dashboard) is guarded by a confirm modal. |
| 4. Contract depends on unresolved UI | yes    | The `Widget` definition shape (sort? limit? store dimension by name/index? color?) is best validated by an **F1 builder pass before freezing the contract**. |
| 5. UX confidence below threshold     | yes    | The widget builder is a new, non-trivial compose-and-configure UX; low confidence it's right first-try.                        |

Result: **Flow: DFCFBI (triggers 1, 2, 4, 5)** — F1 discovers the widget-builder + Widget shape before
Contract freezes.

### F1 build (2026-06-26) — awaiting human app-run

Built the widget builder + dashboard list/detail on **FE state** (in-memory `DashboardStoreProvider`),
contract-safe (no wire/contract change; reuses the existing query-execution endpoints). Verification:
`type-check` clean · **206/206 tests** (incl. new `pickWidgetDefaults` cases) · prod build green.

+ **Store** (`store.tsx`) — in-memory dashboards (CRUD on dashboards + widgets); swapped for the real
  API at Contract/Backend without touching the component tree. `useDashboardsForNav` is a tolerant
  read so the shell renders without a provider (keeps the layout-only test harnesses green).
+ **WidgetView** (`WidgetView.tsx`) — generalised R100's two hardcoded widgets into one config-driven
  renderer (bar/pie) keyed off a `Widget`; reuses `aggregate.ts` + `ChartCard`. R100's `DashboardPage`
  + `widgets.tsx` removed (superseded).
+ **WidgetBuilder** (`WidgetBuilder.tsx`) — formula-free: pick Query → dimension/measure/agg/chart
  (defaulted from column dtypes via `pickWidgetDefaults`, adjustable) with a **live preview**.
+ **Pages** — `DashboardListPage` (`/dashboard`: list + New + delete + empty/seed-setup states),
  `DashboardDetailPage` (`/dashboard/:id`: widget grid + add/edit/remove widget + rename + delete).
+ **Dynamic nav** — the `Dashboard` group now lists saved dashboards from the store (feedback ②:
  `Dashboard › <name>`), with `All dashboards` → the list. Routes + breadcrumbs + i18n (en/vi).
+ **To review** (`pnpm dev` + `pnpm dev:seed:full` + `pnpm dev:builder`, open `/dashboard`): create a
  "Weekly report" dashboard → Add widget → pick a seeded query, watch the defaults + live preview, adjust
  dimension/measure/chart → add; edit/remove; the dynamic nav. **Caveat (F1 only):** dashboards live in
  FE state → they **do not survive reload** (persistence lands at Contract/Backend). Validate the
  **builder feel + the Widget shape** (sort? limit? store column by name vs index?) — that's what F1
  de-risks before the contract freezes.

### F1 iteration — human feedback (2026-06-26)

Human reviewed F1 and gave three changes; all built (type-check · 210 tests · build green):

1. **Nav IA** — dashboard **config/creation** moved under a **`System › Dashboard`** menu
   (`/systems/dashboard`); a created dashboard is **viewed at `/dashboard/<slug>`**. The `Dashboard`
   nav group lists created dashboards by slug (shown once ≥1 exists). Replaces the earlier
   `Dashboard › All dashboards` placement.
2. **Slug** — `Dashboard` gains a **`slug`** (dash-case, auto-derived from the name, editable;
   diacritics-stripped for vi). Routing is now slug-based. **Slug uniqueness → enforce at Contract.**
3. **Widget builder = workspace-first** — pick **Workspace → Query** (query list scoped to the chosen
   workspace).

**New open question surfaced by (3) → resolve at Contract:** a widget can now bind a query from a
**different workspace** than the dashboard's, so "dashboard is workspace-scoped" (decision #1) is in
tension with **cross-workspace widgets**. F1 default = allowed; decide at Contract whether to constrain
to the dashboard's workspace or formally allow cross-workspace widgets (affects the `Dashboard`/`Widget`
contract + the workspace-scope of the list).

### F1 review iteration — human feedback (2026-06-26 → 27)

Iterated on F1 from the human's hands-on review (all built; type-check · 210 tests · build green each step):

+ **Nav IA** — config/create under **`Settings › Dashboard`** (`/settings/dashboard`); view a dashboard
  at **`/dashboards/<slug>`** (slug-based). The `Dashboards` group lists instances by slug (only when
  ≥1). Menu label **"Settings"** (route renamed `/systems`→`/settings` to match).
+ **Slug** — dashboards gain an auto-derived, editable dash-case `slug` (diacritics stripped); routing
  is slug-based. Uniqueness → Contract.
+ **Widget builder = workspace-first** (Workspace → Query). Surfaced for Contract: cross-workspace
  widgets (a widget may bind a query from another workspace) — decide scope at Contract.
+ **Not-found** — bare `/dashboard(s)` + unknown dashboard slug → a **global 404** (`NotFoundPage`,
  new catch-all `*` route; fixed the pre-existing blank-screen gap). Detail breadcrumb corrected to
  mirror the nav (Home › Settings › Dashboard › name) — and confirmed `routeMeta.breadcrumb` was dead.
+ **Catalog layout** — `/settings/dashboard` now matches the workspaces catalog (`PageCard` + grid +
  ⋯ menu). Detail keeps the frame + grid breakpoints (no card-in-card wrapper).
+ **Actions split** — dashboard rename/delete live only in the `Settings › Dashboard` list (card ⋯);
  the detail view has only **Add widget**. Per-widget **Edit/Delete via a ⋯ menu**.
+ **Widget width** — a **per-widget** `span` (1–3 cols, Tableau-style; small = ⅓ → 3-up, big = full
  row), set as a **persisted option in the Create/Edit builder** (default 1).
+ **Empty-state actions cross-fixed** — Workspaces/Datasets/Dashboards all show the primary action
  **always** (one convention). **Datasets empty state standardised** to the shared `Empty` + primary
  CTA (removed the fake dashed "dropzone" that advertised drag-drop but never handled a drop — a
  pre-existing bug; real drag-drop stays in the upload wizard).
+ **`routeMeta` pruned** (decision: A) — dead `breadcrumb` + `subtitle` removed; `routeMeta` is now a
  clean `path → title` map (per-page `PageHeader` is the breadcrumb SoT — it needs dynamic/per-state
  data a pathname map can't give). Centralized breadcrumbs (loader-data mechanism) parked as a future
  enhancement.

### F1 gate CLOSED (human sign-off, 2026-06-27)

Human ran the app across an extended hands-on review and signed off F1 ("F1 done"). Interaction
decisions are frozen for this round; open UX questions resolved or explicitly deferred (reorder →
dynamic-widgets round). The two shape questions carried into **Contract**: (a) cross-workspace widgets
(a widget may bind a query from another workspace — allow, or constrain to the dashboard's workspace?);
(b) slug-uniqueness scope (per-workspace, matching query/dataset names?). **Next: Contract gate.**

### Contract drafted (2026-06-27) — awaiting human ratification

The two open shape questions resolved by the human (2026-06-27):

1. **Cross-workspace widgets → CONSTRAINED to the dashboard's workspace.** A widget's `queryId` must
   reference a query in the dashboard's own workspace at save time (else `422`); keeps decision #1
   (dashboard is workspace-scoped) clean and simplifies the F1 builder (the query picker is scoped to
   the dashboard's WS — that FE trim lands at Frontend, not now).
2. **Slug uniqueness → GLOBAL** (per deployment), not per-workspace. The slug is the URL routing key
   (`/dashboards/<slug>`), so it must resolve without a workspace in context. `name` stays unique
   per-workspace (mirrors query/dataset). The two scopes get **distinct error codes**: `name_taken`
   (per-WS) · new `slug_taken` (global).

**Frozen wire shapes** (`workspace/packages/contracts/`):

+ **`_shared/dashboard.yaml`** — `Widget { id(wdg_), queryId(qr_), title, chartType(bar|pie),
  dimensionCol, measureCol?, agg(sum|count), span(1–3) }` (columns by NAME — F1 resolved name-vs-index);
  `DashboardDefinition { widgets[] }` (embedded JSON, mirrors `queries.definition`);
  `Dashboard { id(dsh_), workspaceId, name, slug, definition, createdAt }`.
+ **`_shared/api-error.yaml`** — added `slug_taken` (code enum + variant + oneOf + discriminator).
+ **6 endpoints** (`dashboards/*.contract.{yaml,md}`): `createDashboard` (POST …/dashboards),
  `listDashboards` (GET …/dashboards, WS-scoped), `getDashboard` (GET /dashboards/{id}),
  `getDashboardBySlug` (GET /dashboards/by-slug/{slug}), `updateDashboard` (PUT /dashboards/{id},
  full-representation replace of name+slug+definition), `deleteDashboard` (DELETE /dashboards/{id}).
  **The 6th (`by-slug`) is an addition beyond the plan's 5** — pulled by the global-slug decision: the
  detail route carries no workspace, so a global slug resolver is the leanest way to load it; mutations
  stay id-keyed (slug is editable).
+ **MSW aligned** — `dashboard/wire.ts` (contract-faithful types, distinct from the F1 FE-state
  `types.ts`), `MOCK_DASHBOARD(S)` fixtures, 6 handlers (stateless, contract-validated shapes). The FE
  still uses the F1 in-memory store; the store→fetch swap + wire↔FE-state adapter is the Frontend gate.

Verification: `@mdd/contracts` 30/30 (6 new endpoints validate as OpenAPI 3.1 + dereference) ·
builder type-check clean · 210/210 builder tests · prod build green.

**Open for the human at the gate:** ratify the wire shapes (esp. the PUT = full-representation-replace
choice, the global-slug `by-slug` 6th endpoint, and the `count`-without-`measureCol` rule expressed as a
description + BE check rather than a JSON-Schema if/then). Optional `cold-reviewer` pre-lock pass before
freezing. **Next gate: Backend** (SQLModel `Dashboard` + additive alembic migration + conformance tests).

### Contract revised after cold-review (2026-06-27) — workspace = project

A `cold-reviewer` pass (fair mode) on the dashboard↔workspace binding surfaced one load-bearing
unknown: the binding is only safe if a **workspace is coarse-grained**. The human confirmed **workspace
= project**, which resolves it — a dashboard showing only its project's widgets is the right model
(cross-workspace executive rollups are a non-need; and the constraint is a relaxable backend rule, not a
wire field, so it's a low-regret lock).

That clarification (project + **many dashboards per project**) overturned the earlier **global-slug**
pick: a flat `/dashboards/<slug>` forces global slug uniqueness, so two projects couldn't each have a
`weekly-report` — and the second user would hit a confusing "slug taken" that leaks another project.
**Revised decisions (human):**

+ **Route nests the project — `/dashboards/<ws_id>/<slug>`**; both `name` and `slug` unique
  **per-workspace** (one rule, matching datasets/queries and the rest of the IA). `slug_taken` rescoped
  per-workspace. The `ws_id` in the path is URL-safe, so workspaces need no slug.
+ **Dropped `GET /dashboards/by-slug/{slug}`** (the 6th endpoint): the detail route carries the `ws_id`,
  so the FE resolves slug → dashboard from the per-workspace list it already loads for the nav. Back to
  the planned **5 endpoints**.
+ **Sidebar IA = `Dashboards › [Workspace] › [Dashboard]`** (two-level, group by project). Both levels
  are already unambiguous — **workspace `name` is globally unique** (verified: DB index
  `idx_workspaces_name_unique`, R25; corrected a stale "Not unique" comment in
  `_shared/workspace.yaml`), dashboard `name` unique per-workspace. **Pure FE/IA — no contract impact**;
  lands at the **Frontend gate**. Caveat: grows as projects × dashboards (collapse/lazy-load later).
+ **No new name "uniformity" needed** — names are **display labels** (free human text, length-bounded,
  already unique at both levels); the **URL** uses the dash-case `slug` + `ws_id` and is already safe.
  Forcing dash-case onto names would be the Excel-with-extra-steps friction #1 forbids ([[product-value-framing]]).

### Frontend-gate notes (carried — workspace-at-create + builder inherit)

Folded from the workspace-scope decision (not implemented this gate — F1 stays closed):

+ **Create-dashboard gains a Workspace (project) picker** — replaces the F1 hardwire to the seed
  workspace; the workspace is chosen ONCE at create (preselect/hide when only one exists).
+ **Widget builder DROPS its Workspace picker** — inherit the dashboard's workspace; the query list is
  scoped to it. (The per-widget WS picker is now meaningless under the constraint.)

Verification after the revision: `@mdd/contracts` 29/29 · builder type-check clean · 210/210 tests ·
prod build green.

### Contract gate CLOSED (human ratified, 2026-06-27)

Human ratified the revised contract ("go ahead"). Wire shapes frozen: 5 endpoints
(`createDashboard` · `listDashboards` · `getDashboard` · `updateDashboard` · `deleteDashboard`),
`_shared/dashboard.yaml` (Widget / DashboardDefinition / Dashboard), `slug_taken` per-workspace code.
Both `name` + `slug` unique per-workspace; widgets constrained to the dashboard's workspace; route
`/dashboards/<ws_id>/<slug>`. **Next: Backend gate** — SQLModel `Dashboard`, an additive alembic
migration, per-endpoint behavior, and conformance tests.

### Backend gate built (2026-06-27) — schema + migration + 5 endpoints

Implemented the backend per the frozen contract (raw-SQLite + Pydantic router; SQLModel + alembic as the
schema of record — the established split):

+ **Schema of record** — `db_models.Dashboard` (5th table): `workspace_id` FK → workspaces `ON DELETE
  CASCADE`; widgets in an embedded `definition_json` blob (mirrors `queries`); per-workspace unique
  indexes on **both** `(workspace_id, name)` and `(workspace_id, slug)`; name/slug length CHECKs.
+ **Migration** — additive `0002_dashboards` on top of the collapsed `0001_baseline` (creates the table
  + 3 indexes). `test_schema_parity` extended (legacy schema + table list + head → `0002_dashboards`):
  legacy == models == migrated all hold.
+ **Constants** — added `dashboard`/`widget` id patterns, `slug_taken`, `dashboard_max` to the js-tmpl
  **templates** (BE `.py.hbs` + FE `.ts.hbs`) and re-rendered (the generated modules are gitignored);
  `values.yaml` already carried the values (slug comments corrected global→per-workspace).
+ **Pydantic** (`models/common.py`, `extra='forbid'`) — `Widget` (with a `sum`⇒`measureCol` /
  `count`⇒no-measure model-validator), `DashboardDefinition`, `Dashboard`, `Create`/`UpdateDashboardBody`,
  `ApiErrorSlugTaken`; dash-case `SlugStr`.
+ **Router** (`routers/dashboards.py`, registered in `main.py`) — the 5 endpoints. Widget `queryId`
  validated in-workspace at save (422 cross-workspace); per-workspace name/slug collisions disambiguated
  to `name_taken` / `slug_taken` (409) from the SQLite index-violation message; `count` widgets drop
  `measureCol` via `exclude_none`.

Verification: **215/215 backend pytest** (16 new `test_dashboards` + parity/constants updates) ·
`ruff check` clean · the migration is exercised end-to-end by the parity test's real `upgrade head`.
**Next: F2 / Frontend** — swap the F1 in-memory store for the real API (wire↔FE-state adapter), plus the
two carried builder trims (workspace picker at create · drop the per-widget WS picker); then Integration.

### F2 / Frontend built (2026-06-28) — store → real API, awaiting human app-run

Swapped the F1 in-memory store for the real `dashboards` API and folded the two carried builder trims:

+ **API + hooks** — `api/dashboardsApi.ts` (5 routes) + `dashboard/hooks.ts` TanStack hooks
  (`useDashboardsQuery` per-workspace · `useAllDashboards` fan-out across workspaces for the nav/catalog ·
  `useCreate/Update/DeleteDashboardMutation`). The **wire↔FE-state adapter** lives in `wire.ts`
  (`wireToDashboard` flattens `definition.widgets`; `widgetsToDefinition` nests them back); components stay
  wire-free. `DashboardStoreProvider`/`store.tsx` **deleted**.
+ **Routing** — `/dashboards/:slug` → **`/dashboards/:workspaceId/:slug`** (project nested). The detail page
  resolves (workspace, slug) from the workspace's list (no global slug lookup — slug is per-workspace).
  Each widget add/edit/remove persists the WHOLE dashboard via the full-representation PUT.
+ **Builder trims** (the carried Frontend-gate items) — **create** now picks the **Workspace (project)**
  once (`NameModal` gained a workspace select, preselected when only one exists); the **WidgetBuilder
  dropped its per-widget workspace picker** (the query list is scoped to the dashboard's workspace).
+ **Catalog** — `Settings › Dashboard` lists **every workspace's** dashboards (fan-out), each card showing
  its owning project; create/rename/delete via the mutations; `name_taken`/`slug_taken` surfaced inline.
+ **i18n** — `dashboard.workspaceLabel/placeholder`, `dashboard.error.{nameTaken,slugTaken}`, `common.error`
  (en + vi); removed the now-unused `dashboard.builder.workspace*`.

**Flagged for the human (open):** the **nav grouping**. `WorkspaceShell` supports only **two levels**
(group → items), so the discussed **`Dashboards › [Workspace] › [Dashboard]`** (three-level) isn't
renderable without extending that shared component — **deferred** (not silently built). F2 keeps a single
**`Dashboards`** group listing all dashboards across workspaces, routing correctly by `<ws_id>/<slug>`;
same-named dashboards in different projects show identical nav labels (rare; the route disambiguates).
Decide later: extend `WorkspaceShell` for true nesting, or make each project its own nav group. Also: the
nav fans out one list query per workspace (`useQueries`) — fine at demo scale, lazy-load if it grows.

Verification: builder **type-check clean · 210/210 tests · prod build green** (one transient React-Flow
timeout under full-parallel load passed in isolation + on re-run). `enable_mock: false`, so the human
review runs against the **real seeded backend** (real persistence). **Next: human runs the app (F2 feel
review)**; then Integration.

### F2 review iteration — human findings (2026-06-28)

Human ran the app and gave two findings; both fixed (resolves the deferred nav-grouping decision —
human chose **`Dashboards › [Workspace] › [Dashboard]`**):

+ **Nav grouping (3-level).** Extended the shared **`WorkspaceShell`** additively — `NavItem` gains an
  optional `children`, `toMenuItems` recurses, nested SubMenus open by default (+ a nested-variant test;
  UI suite 27 green). `AppLayout` now groups dashboards under the `Dashboards` group **by workspace**
  (`Dashboards › ‹Project› › ‹Dashboard›`); the workspace SubMenu key (`dashws:<ws_id>`) only toggles,
  leaves keep `<ws_id>/<slug>` routing. Fixes "Sidebar: no [Workspace name]".
+ **Breadcrumb.** The dashboard VIEW breadcrumb no longer routes through Settings: was
  `Home / Settings / Dashboard / ‹name›` → now **`Home / Dashboards / ‹Workspace› / ‹name›`** (mirrors the
  nav; the Dashboards + Workspace segments are inert groupings, only Home links). Manage/create still
  lives at `Settings › Dashboard`, reachable from the sidebar — just not from this view's breadcrumb.

+ **Sidebar width** (follow-up — the 3-level nav felt cramped). No shared standard existed (a local
  `EXPANDED_WIDTH = 220` in `WorkspaceShell`; AntD's Sider default is 200). Bumped to **240** + tightened
  the inline menu's per-level indent **24 → 16** (`inlineIndent`) so nesting reclaims label room. Then
  **relocated the sider sizing to `layoutTokens` (themeTokens.ts)** — the R95 "one tunable home for layout
  numbers" object (`siderWidth`/`siderCollapsedWidth`/`siderInlineIndent`). NOT `values.yaml` (cross-language
  contract pipeline — no second consumer / drift risk) and NOT the AntD `ThemeConfig` (these are
  Sider/Menu **props**, not theme tokens); `layoutTokens` is the right, lowest-mechanism home.

Verification: UI **27/27** · builder **type-check clean · 210/210 · build green**. **Next: human re-runs
the app**; then Integration.

### F2 + Integration CLOSED — human sign-off (2026-06-28)

Human ran the app hands-on (real seeded backend, `enable_mock: false`) — created `test 1 2 3` in a
workspace, navigated to `/dashboards/<ws_id>/<slug>`, exercised the sidebar/breadcrumb — gave the
nav-grouping + breadcrumb + sidebar-width feedback (all folded), then signed off ("I'm ok"). That
hands-on run **is** the Integration scenario (create → persist → navigate against the real backend); the
acceptance criteria are met. **Round Complete.**

## Check

Final verification (2026-06-28), all green:

| Suite | Result |
| --- | --- |
| Backend pytest | **215** (incl. `test_dashboards` + schema-parity + generated-constants) |
| Contracts (OpenAPI 3.1 validity) | **29** |
| Builder (vitest) | **210** · type-check clean · prod build green |
| `@mdd/ui` (vitest) | **27** (incl. nested-nav `WorkspaceShell` test) |

Human Integration run (real backend): create + name + persist + reload-survival + dynamic nav + slug-route
all confirmed. DFCFBI gates Design · F1 · Contract · F2 · Backend · Integration all CLOSED.

## Act

**Shipped:** the dashboard becomes a **persisted, user-created noun** — defined once, re-runs live on the
latest upload, survives reload (the headline value: out of the report-maintenance treadmill).
`@mdd/contracts` 5 endpoints + `Dashboard`/`Widget` shapes; `dashboards` table + `0002` migration;
formula-free widget builder bound by `queryId`; `Dashboards › ‹Workspace› › ‹Dashboard›` nav.

**Decisions worth remembering** (the in-round forks): workspace = **project** → widgets constrained to the
dashboard's workspace + `name`/`slug` unique **per-workspace** + route `/dashboards/<ws_id>/<slug>`;
config-home heuristic — `values.yaml` is for **cross-language contract** constants, `layoutTokens`/theme for
**FE design/layout**, a local `const` for a **single consumer** (sidebar sizing landed in `layoutTokens`,
not `values.yaml` / not AntD `ThemeConfig`).

**Feeds into** (unchanged from below): dynamic/interactive widgets (filters · date-range · drill · reorder),
dashboard settings (layout / default-range), snapshot/report noun + heavy-DA. **One deferred seam noted:**
same-named dashboards in different projects show identical nav leaf labels (route disambiguates) — revisit
only if it bites.

## Feeds into

**Feeds into →** the rest of the dashboard theme, after the noun persists:

+ **Dynamic / interactive widgets** (feedback ①) — filters · date-range · drill-down · swap
  dimension/measure via UI; **formula-free**.
+ **Dashboard settings** (feedback ③) — beyond name: layout, default range; minimal-first.
+ **Snapshot / Report noun** + **heavy-DA #3 (Dash) / Polars compute** — parked
  ([[product-value-framing]]; Polars may arrive earlier as core workflow compute, not gated by #3).
