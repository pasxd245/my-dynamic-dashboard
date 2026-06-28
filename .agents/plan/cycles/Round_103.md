# Round 103: Interactive widgets — runtime dashboard filter (client-side slice)

**Status**: Complete
**Date started**: 2026-06-28
**Date completed**: 2026-06-28
**Flow**: **DCFBI** — set at the Design gate via `flow-selector`; recorded in the Do log. Contract-free
(FE-only) round → Contract + Backend are no-ops; the filter feel is checked at the Check visual gate.

## Goal

**Inherits from ← [Round_102](Round_102.md)** — R100–102 made the dashboard a thing you *define*, *persist*,
and *arrange*. It's still **static**: each widget shows one fixed aggregate of its saved query, and the
only way to see a different slice (just this quarter, just the West region) is to build another
query/widget — back toward the report-maintenance treadmill.

Add a **runtime dashboard filter** so a user can **slice all the widgets live** — pick a value / range and
every widget that has that column re-aggregates — **without rebuilding anything** and **formula-free**.
This is the "operate" half of the dashboard and the highest **#1-ease** value: one dashboard answers many
questions ([[product-value-framing]]; R101 feedback ①).

_Track: 1 (product). Pulled by ← R101 feedback ① (interactive widgets) + R102 Feeds-into. Per the
[Evolution Rule](../../AGENTS.md)._

## Design decisions (ratified — human, 2026-06-28)

1. **Runtime-only, NOT saved.** The filter selection lives in **FE state** (URL-encodable so a filtered
   view is shareable); it **resets each visit**. **No `Dashboard` contract change.** A *saved default
   filter* (open pre-filtered) is a later pull (the contract change).
2. **Client-side, NOT a server re-run.** The filter is applied to the rows each widget **already fetches**
   (`useWidgetData` → `fetchAllRows` already pulls the full query result), **before** the JS aggregate
   (`aggregate.ts`). **No backend / endpoint change.** Pushing the filter to DuckDB server-side is a future
   **compute pull** — justified only when fetch-all-to-the-browser starts to hurt (large data), per the
   compute through-line ([[product-value-framing]]); don't pre-build it.
3. **Formula-free.** Filter via UI controls (pick column → value / range), never a typed expression.
4. **Scope = this round ships the runtime client-side slice;** saved-defaults + server-re-run are named
   future pulls (Feeds-into), not built here.

## Open Design questions (resolve at the Design gate)

1. **Dashboard-level filter bar vs per-widget filters?** A dashboard has many widgets over *different*
   queries, so a `Region = West` filter only applies to widgets whose query **has** a `Region` column.
   Provisional: a **dashboard-level filter bar**; a filter applies to widgets that have the column,
   widgets without it are **unaffected** (not blanked).
2. **Which columns are filterable, and how discovered?** Auto-offer the categorical/date columns found
   across the dashboard's widgets' queries? Or let the user add a filter by picking a column? Provisional:
   user adds a filter → pick from the union of the widgets' columns.
3. **Which filter kinds in v1?** Provisional: **categorical value** (equals / one-of on a string column)
   first; **date-range** as the fast-follow (it's the most-asked but needs date-column detection + a
   range control); drill-on-click deferred.
4. **URL-encode the filter state?** (shareable filtered link, still ephemeral) — provisional: yes, cheap.
5. **Flow** — `flow-selector` at Design exit (likely DCFBI again — contract-free FE round).

## Plan (provisional — finalize at Design)

1. **Design gate** — ratify the open questions, run `flow-selector` + `ux-design --design-spec`.
   **Human ratify.**
2. **Build (FE-only)** — a dashboard filter bar on `DashboardDetailPage`; thread the active filters into
   `useWidgetData` / the aggregate path so each widget filters its fetched rows by matching column name
   before rolling up; filter state in URL/FE-state. Reuse dtype-aware predicate logic where it helps.
3. **Verify** — slice updates all matching widgets live; widgets without the column are unaffected; clear
   resets; type-check + tests + build green; human app-run (the Check visual gate).

## Acceptance criteria

_(Revised at Check — the dashboard-level bar pivoted to a **per-widget filter drawer**.)_

- [x] A user can open a widget's **filter drawer** (per-card icon), **add a filter** (pick a column → one-of
  values), and **only that widget** re-aggregates live; its filter icon shows **active**; other widgets are
  independent. _Human-tested 2026-06-28._
- [x] The filter is **formula-free** (UI selects only) and **runtime-only** (no contract change; resets per
  visit). _(URL-encode deferred.)_
- [x] **Clear / remove** a filter restores the unfiltered view.
- [x] Filtering is **client-side** on already-fetched rows (no new backend call per filter change); the
  widget fetches **all** rows (paged fetch-all), so aggregates + filter options are over the full set.
- [x] Accessible (labelled controls, `aria-pressed` icon, keyboard-reachable) + AntD/theme tokens.
  Type-check + 216 tests + build green; human app-run confirmed the feel.

## Risks / unknowns

- **Heterogeneous widget queries** — the column-match-by-name approach: a `Region` in query A and query B
  must mean the same thing (it's the user's data; we match by name, like the rest of the app).
- **Filter-kind dtype awareness** — string (equals/in) vs date (range) vs number; v1 may do categorical
  only and defer range. Reuse the dataset/query filter vocabulary if it transfers.
- **Discoverability** — how the user knows which columns are filterable; a bad picker buries the feature.
  A `ux-design` Findability check at Design.
- **Fetch-all already pulls everything** — client-side filtering is free, but this round does **not** fix
  the pre-existing large-data fetch-all cost (that's the deferred server-re-run compute pull).

## Do

### Plan-gate draft — opened from R102 (2026-06-28)

R102 (widget reorder) Complete + signed off. Human picked **interactive widgets** for R103 and, after
weighing the axes, ratified **runtime-only + client-side** scope ("let's try it and see"). Drafted the goal,
the ratified scope (no contract/backend change), and the open Design questions (filter-bar vs per-widget;
filterable-column discovery; v1 filter kinds; URL-encode). **Next: human Design-gate kickoff** (ratify the
open questions → `flow-selector` → `ux-design --design-spec`).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                  |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | Small filter state model (filters present / absent); add/remove/clear are operations on one list, not independent branches. |
| 2. New interaction pattern           | no     | Filtering UI already exists in the product (dataset chip-filters / advanced query); this reuses it at the dashboard scope. |
| 3. High user-error risk              | no     | Filtering is non-destructive + reversible (clear); nothing committed/destroyed.                               |
| 4. Contract depends on unresolved UI | no     | Contract-free by decision — runtime + client-side; no wire shape to freeze.                                   |
| 5. UX confidence below threshold     | yes    | "Let's try it and see" + the open discoverability question (how a user finds filterable columns across heterogeneous widgets). |

Result: **Flow: DCFBI** (1 trigger — condition 5). Contract-free FE round → C + B no-ops; the filter feel
is verified at the Check visual gate.

### Design gate — v1 build target (proposed, 2026-06-28)

Resolved the open questions into the v1 to build (DCFBI, so the design is decided here; Check confirms):

1. **Dashboard-level filter bar** (not per-widget) — one bar above the grid; a filter applies to widgets
   whose query **has** that column; widgets without it are **unaffected** (not blanked).
2. **Column discovery** — "Add filter" offers the **categorical (string) columns** found across the
   widgets' fetched data; picking one offers its **distinct values** (one-of). Date-range + numeric
   deferred (fast-follow).
3. **v1 kind = categorical one-of** (string equals / in). Multiple filters AND together.
4. **State = FE state** this round (runtime, resets per visit); **URL-encode deferred** to a fast-follow
   (keeps v1 tractable; noted in Feeds-into).
5. **Data architecture** — a dashboard-level hook reads each widget's data via the **same React-Query keys**
   `useWidgetData` already uses (shared cache → no double fetch) to build the column/value picker;
   `WidgetView` gains a `filters` prop and applies the matching filters to its rows **before** the JS
   aggregate (`aggregate.ts`). Widgets skip filters whose column they don't have.

### Build done (2026-06-28) — awaiting human Check (filter feel)

Built the v1 (commits held until the human review of the whole dashboard-interactivity arc):

- **`aggregate.ts`** — pure `DashboardFilter` type + `applyFilters` (one-of, AND across filters, skips a
  filter whose column the widget lacks, `(blank)` for nulls) + `distinctValues`. 6 new unit tests.
- **`hooks.ts`** — consolidated `useWidgetData` onto a single cache key (`dashboard-widget-data/<queryId>`,
  query meta + dataset columns + all rows in one fetch); new **`useDashboardFilterOptions`** reads the
  **same key** (shared fetch, no extra round-trip) to union the categorical columns + distinct values
  across the dashboard's widgets.
- **`WidgetView`** — `filters` prop; `useWidgetChartData` applies them to the rows **before** the JS
  roll-up.
- **`DashboardFilterBar`** — add-filter (pick column → one-of values), per-filter value multi-select +
  remove, Clear; hidden when nothing is filterable; AntD + theme tokens; labelled/keyboard-reachable.
- **`DashboardDetailPage`** — FE filter state (runtime, resets per visit) above the grid; threads
  `filters` into every widget. en + vi strings.

Verification (automated): builder **type-check clean · 216/216 tests · prod build green**. **Pending: the
Check visual gate — human adds a filter, confirms all matching widgets re-slice live + widgets without the
column are unaffected + Clear resets.**

**Known v1 rough edges to watch at Check** (candidates for a follow-up, not bugs): the picker offers
*every* categorical column, including high-cardinality ones (ids/names) that make poor filters; no
date-range/numeric yet; filter state is not URL-encoded.

### Check iteration — pivot to PER-WIDGET filter drawer (human, 2026-06-28)

At Check, the dashboard-level bar surfaced the heterogeneous-query confusion ("filter only applies to the
first widget" — i.e. only widgets whose query HAS the column responded). Human proposed (and ratified) a
cleaner model: **each widget gets its own filter** via a per-card icon → a right-side Drawer. This
**dissolves the cross-widget ambiguity** (a widget filters on its OWN columns only) and **simplifies the
architecture** (drop the union hook). Decisions: (1) drop the dashboard-level bar entirely — per-widget
only; (2) the panel is a **"Filters"** drawer for v1 (distinct from the ⋯ Edit builder, which edits the
*persisted* definition; the drawer is *runtime* slicing).

Built: `useDashboardFilterOptions` (union) → **`useWidgetFilterOptions(queryId)`** (one widget's own
categorical columns + values); **`WidgetFilterDrawer`** (right Drawer: per-column one-of multi-selects +
Clear; "no filterable columns" empty state); `DashboardFilterBar` **deleted**. Each card gains a **filter
icon** next to the move handle — **filled + primary-coloured when active**, outline when not
(`aria-pressed`). Per-widget runtime filter state (`Record<widgetId, filter[]>`); `WidgetView` fed its own
widget's filters. en + vi strings updated.

Verification (automated): builder **type-check clean · 216/216 tests · prod build green**. **Pending: human
Check** — open a widget's filter drawer, pick value(s), confirm only THAT widget re-slices + the icon shows
active; another widget's drawer is independent; Clear resets; reorder + ⋯ menu still work.

### Check iteration — drawer "add a field" pattern (human, 2026-06-28)

Folded the deferred refinement in now (cheap, and lets the human review the final feel): the drawer no
longer eagerly lists every categorical column (a wall of fields for wide queries). **Progressive
disclosure** — an **"Add filter"** searchable Select → pick a column → pick values; only added filters
show, each removable (✕); Clear resets. Reused the deleted `DashboardFilterBar`'s add/remove logic inside
the per-widget drawer (reconstructed from session context — the file was never committed). The active-icon
check now counts only filters with **non-empty** values (a half-added empty filter doesn't light it). Also
tames the high-cardinality **column-list** noise (a single searchable picker vs N expanded selects).
Still per-widget · runtime · contract-free. Type-check · 216 tests · build green.

## Check

Verification (2026-06-28):

| Item | Result |
| --- | --- |
| Builder type-check | clean |
| Builder tests (vitest) | **216** (16 in `aggregate.test`, incl. 6 new `applyFilters`/`distinctValues` cases) |
| Prod build | green |
| **Check visual gate (human)** | **PASS** — "current round looks good, can close": per-widget filter drawer (add-field), only the target widget re-slices, active icon, Clear/remove, coexists with reorder + ⋯ menu. |

Backend / contracts / `@mdd/ui` untouched (FE-only round on the R101 contract).

**Data-completeness check (human question at close):** confirmed the widget fetch is a **paged fetch-all**
(`fetchAllRows` loops `GET /queries/{id}/rows` to `total`), so aggregates + filter options are over the
**full** result set — no first-page-only undercount. Known ceiling: unbounded for very large queries →
the **row-cap + warning** + server-side pushdown follow-ups (Feeds-into).

## Act

**Learnings**:

- The dashboard-level filter bar's **heterogeneous-query confusion** ("only the first widget responds")
  was best fixed by **changing the model**, not patching it: a **per-widget** filter drawer removes the
  cross-widget column-matching ambiguity *and* deletes code (the union hook). Pivoting at Check was cheap
  because the round is contract-free — the "try it and see" framing paid off.
- **Progressive disclosure** ("Add filter" → pick column → values) beats eager-list-every-column for wide
  queries; the deleted bar's add/remove logic was reusable inside the drawer.
- The **fetch-all** path is correct but unbounded — a real scale ceiling surfaced by the human, now a
  named follow-up (row-cap + server-side pushdown), not a silent risk.
- Re-applied the **config-home heuristic**: the drawer width stayed a local `const` (single consumer, and
  `layoutTokens` is a layer below this feature) — not a shared token, not `values.yaml`.

**Promotions**: none — no reusable rule/skill emerged; the per-widget-filter pattern lives in the code.

**Follow-ups (not promotions, just notes):** see Feeds-into — row-cap+warning, server-side filter/aggregate
pushdown, date-range/drill, saved + URL-encoded filters.

## Feeds into → Round_104 (TBD)

**Feeds into →** the rest of the dashboard-interactivity theme:

- **Saved default filter** — persist a filter on the dashboard (the contract change), so it opens pre-filtered.
- **Server-side re-run** — push filters to DuckDB (a compute pull) when fetch-all-to-browser stops scaling.
- **Row-cap + over-cap warning** (human, 2026-06-28) — the widget fetch is a paged **fetch-all** (loops
  `GET /queries/{id}/rows` to `total`); correct, but unbounded for huge queries. Proposal: a **max-rows**
  setting — under it, no change; over it, **fetch up to the cap + warn the user** (an icon on the widget)
  that the view is partial, and let them adjust the cap from the widget **properties / filter panel**.
  _Home (decide at that round's Design per the config-home heuristic): a **global default** is a tunable
  product knob (config); a **per-dashboard/-widget override** is a **persisted setting → contract change**.
  Likely the real fix pairs this with the server-side GROUP BY/filter pushdown (compute pull) above._
