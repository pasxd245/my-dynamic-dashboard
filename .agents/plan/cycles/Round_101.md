# Round 101: Dashboard as a persisted noun — create / name / list dashboards (headline-value round)

**Status**: **In Progress** — Design gate CLOSED (DFCFBI 1,2,4,5). **F1 build + review iteration DONE**
(FE-state widget builder + list/detail + dynamic nav + the human's review changes; type-check + 210
tests + prod build green). **F1 gate OPEN** — exits on the human's final F1 sign-off
([[dfcfbi-f1-needs-human-review]]); the Widget shape (now incl. `slug`, per-widget `span`, the
cross-workspace question) then freezes at Contract. **Awaiting human F1 sign-off.**
**Date started**: 2026-06-26
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

+ [ ] A user can **create + name** a dashboard and it **persists** (survives reload / re-run).
+ [ ] The `Dashboard` nav lists saved dashboards **dynamically**; `New dashboard` works; empty state.
+ [ ] A dashboard's widgets bind to saved Queries by id and render **live** aggregates (reusing R100's
  widget components); a dangling `queryId` shows a per-widget "unavailable" state.
+ [ ] A widget can be **added, edited, and removed** via the formula-free builder (pick query →
  dimension/measure/agg/chart, defaulted + adjustable). _(Reorder deferred.)_
+ [ ] Backend `Dashboard` entity + **additive alembic migration**; contract + conformance tests pass.
+ [ ] Creating/configuring stays **formula-free** (pick query + columns + chart via UI).

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

## Check

_Pending — populated at Integration._

## Act

_Pending — round in planning._

## Feeds into

**Feeds into →** the rest of the dashboard theme, after the noun persists:

+ **Dynamic / interactive widgets** (feedback ①) — filters · date-range · drill-down · swap
  dimension/measure via UI; **formula-free**.
+ **Dashboard settings** (feedback ③) — beyond name: layout, default range; minimal-first.
+ **Snapshot / Report noun** + **heavy-DA #3 (Dash) / Polars compute** — parked
  ([[product-value-framing]]; Polars may arrive earlier as core workflow compute, not gated by #3).
