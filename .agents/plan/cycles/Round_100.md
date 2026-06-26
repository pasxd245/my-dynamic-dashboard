# Round 100: Dashboard theme-opener — a static multi-widget Sales dashboard (FE-only, live)

**Status**: **Complete** — the static Sales dashboard render-proof shipped (FE-only). Design + F1
gates closed (human-reviewed app-run; X-axis label overlap fixed); Contract/F2/Backend N/A; Integration
confirmed against the real seeded backend. The headline value (persisted, dynamic, multi-dashboard) is
the **next theme** (see Feeds into). Do not mistake this proof for "treadmill solved"
([[dont-mvp-rush-a-roadmap-home-surface]]).
**Date started**: 2026-06-26
**Date completed**: 2026-06-26
**Flow**: **DFCFBI (triggers 2, 5)** — set at the Design gate via `flow-selector`; recorded in the Do
log. Per [[dfcfbi-two-round-split]] a DFCFBI round may split [D+F1+design-sync] then
[C+B+F2+Integration]; here R100 is **FE-only**, so the split is lighter.

## Goal

Open the **dashboard theme** (#2 headline-value surface, [[post-mvp-roadmap-migration-first]]) with a
thin, FE-only first slice: a **static multi-widget Sales dashboard** — a fixed 2–3 chart layout over the
**R99 seeded Sales scenario** (orders 2000 · telesale 2000 · customers 50), each widget bound to a
**saved Query** and executed **live**. No new backend, no migration, no persisted dashboard entity.

This proves the **Query → aggregate → visualize** path end-to-end against the real seed, and establishes
the dashboard surface (nav + route + layout skeleton) for later slices to grow into.

**The stuck this theme targets ([[product-value-framing]]):** a *leader* trapped on the
**report-maintenance treadmill** — build an Excel report once, then every period re-feed the new CRM
export by hand, and when the export structure drifts the formulas/pivots break and they debug a
spreadsheet instead of reading numbers. Our way out: **define the analysis once as a living thing**
(saved Query + dashboard) that **re-runs** on new data, and **absorb CRM drift** instead of breaking
([[purpose.md]] #4/#5). That is *why* live re-query is right — it's the **reuse engine**, not a BI
feature.

**Hard constraint — the user is a *basic*-Excel user ([[product-value-framing]]).** The hurt
isn't just lost time: a basic user can't *build* the report (pivots/VLOOKUP) and can't *fix* it when it
breaks (`#REF!`/`#N/A`) — powerlessness + dependence + never trusting the numbers they sign off. **∴ the
bar for every screen: if it ever makes the user "write a formula" or "configure a pivot," we've rebuilt
their pain.** R100's *static* dashboard fits this (nothing to configure — just look); the constraint
binds hardest on later "edit/configure widgets" rounds, which must stay formula-free.

**Honest sequencing note:** the headline value (a reusable report that survives new data + drift) only
**fully lands when the dashboard definition persists + re-runs against the latest upload** — a later
round. **R100 (static, FE-only) proves the render path only; it does not yet solve the treadmill.** Do
not mistake the static slice for "pain solved" ([[dont-mvp-rush-a-roadmap-home-surface]]).

_Track: 1 (product — the value-out surface the seed enables). Pulled by ← R99 ("Feeds into → the simple
Sales dashboard") + the human's dashboard plan + the canvas/dashboard #1/#2 priority ranking in
[[post-mvp-roadmap-migration-first]]. Per the [Evolution Rule](../../AGENTS.md)._

## Decisions settled at kickoff (human, 2026-06-26)

1. **First slice = static multi-widget layout** — a fixed 2–3 chart grid over the seed data (not a single
   chart, not model-first). Bigger eyeball-value slice; layout/feel reviewed at F1.
2. **FE-only first** — no dashboard table, no alembic migration, no contract change in R100. Dashboard
   config lives in FE state. Persistence is its own later round once the model is proven (mirrors the
   canvas Phase-A FE-only slice).
3. **Chart library — recommendation: `recharts` v3** (researched 2026-06-26; ratify at Design). The app
   is **React 19 + AntD v6**. **`@ant-design/charts` is disqualified**: unresolved React 19 breakage
   (its `@antv/*` peer-dep chain declares React 16/17 → graphs error on React 19;
   [issue #2809](https://github.com/ant-design/ant-design-charts/issues/2809)) — so its only edge
   (AntD-native theming) is moot. **recharts** = React-19-compatible, React-idiomatic (a bar/pie is a
   few lines → ease-of-use), light + tree-shakeable (~136 KB gz, SVG); AntD consistency via feeding
   theme tokens as colors (we control it). ECharts = more power than simple DA needs (off-framing). No
   product CSP exists (checked) — the earlier offline/CSP worry was an Artifact-tool concern, not the
   product's.

## Data-model recommendation — live re-query, snapshot is a separate later noun

> **Framing (human, 2026-06-26 — [[product-value-framing]]):** we are **not competing** with
> BI platforms. The user is someone whose current tool can't answer their question *right now*; they
> bring their own data and try this to close *their own gap* **quickly**. The decision driver is
> **ease-of-use for simple DA** — *not* performance, *not* feature parity. The prior-art research below
> is used only as evidence that *snapshot is a separable concern*, **not** as a standard to match.

The human raised a real product-model question: *should a widget re-run its query live, or snapshot the
query result?* ("whenever we need a report/analysis → take a snapshot?"). Researched against Attio,
Metabase, Salesforce, Tableau, Power BI (2026-06-26) **for evidence of separability only**:

**Finding — dashboards are live by default everywhere; a "snapshot" is a *separate artifact* for a
different job, not a replacement for the dashboard.**

+ **Attio** (closest peer): real-time live dashboards; freshness is the selling point.
+ **Metabase**: live re-query on view; caching is opt-in *performance*; *subscriptions* email an exported
  result.
+ **Salesforce**: native reports are live; **Reporting Snapshots** are an *explicit, scheduled*
  point-in-time feature for historical-trend reporting — a different noun.
+ **Tableau / Power BI**: Extract/Import = snapshot for *performance/offline*; live (DirectQuery) when
  real-time matters.

The three jobs a snapshot does — (1) performance cache, (2) point-in-time/trend, (3) reproducible/
shareable export — are **all distinct from "be the dashboard."** The human's "snapshot for a report"
intuition is correct **for a Report/Export noun**, not for the dashboard widget.

**Why it maps to *our* product:** our source is a saved Query over an **uploaded CRM export** in DuckDB —
already a periodic import, so re-running a query is cheap + deterministic until the next upload. Live-on-
view is the natural, cheapest default. A snapshot becomes meaningful at a **new upload / schema drift**
("the Q2 report as run against the May export"), which pairs with the platform's **schema-versioning** and
the **consumer-save / Excel-export** value-out path (an export *is* a frozen artifact).

**Recommendation (for Design-gate ratification) — judged on ease-of-use, not parity:**

+ **R100 + the dashboard surface: live re-query, Query-only source** (per [[query-is-virtual-dataset]]).
  Reason: it's the **simplest mental model** — "see your data," zero new concepts to learn. (Performance
  is irrelevant to us; the live justification is *simplicity*, not best-practice.)
+ **Snapshot = complex-later-maybe**, and if ever built it's its own noun ("Report" / saved export) on
  the export/consumer-save path — **not** a property of the dashboard. Its only job that could matter to
  our user is "freeze a report artifact" (the performance-cache job is irrelevant to us). Park it.

## Proposed requirements table (ratify at Design — [[requirements-table-before-building-ui]])

| Aspect | Proposed for R100 | Why |
| --- | --- | --- |
| Surface / noun | **new top-level surface** "Dashboard" (new nav group + route `/dashboard`) | new noun, not a mode on Queries ([[design-gate-noun-vs-mode]]) |
| Data source | each widget binds to a **saved Query**, executed **live** | query-is-virtual-dataset; live per research |
| Widgets | **fixed set of 2–3 charts** over seed Sales data (e.g. orders by region · revenue by product · telesale outcomes) | static layout; no add/remove/config in R100 |
| Layout | fixed responsive grid (AntD `Row`/`Col` or Grid); content-width cap + fill per [[layout-is-the-architecture]] | layout is the architecture; widget impl swappable |
| Config / edit | **none** (static) | thinnest slice; add/configure widgets is a later round |
| Persistence | **none** (FE-only) | settled decision #2 |
| Aggregation | **RESOLVED → client-side in the widget**, over a paged fetch-all of the live query rows | no aggregation endpoint exists; FE-only holds (see decision #1) |
| Chart lib | **recharts v3** (recommended) | React-19-safe (`@ant-design/charts` breaks on R19); simple + light (decision #3) |

**Concrete widget proposal (confirm the 2–3):** ① orders **revenue by region** (bar) · ② orders
**count/revenue by product** (bar, surfaces the "Legacy Tool never ordered" edge) · ③ **telesale outcomes**
breakdown (pie/bar over `outcome` ∈ connected/no_answer/callback/converted/declined). All three are
single-Query aggregations over the seed.

## Open decisions for the Design gate

1. **Aggregation home. RESOLVED (contract inspected 2026-06-26).** `GET /queries/{id}/rows` returns a
   paged `RowsPage { rows: (string|null)[][], page, pageSize, total }` — **raw rows, no aggregation
   endpoint/group-by exists** anywhere. page_size is a fixed allow-list **(10/25/50/100)**, max 100.
   → R100 aggregates **client-side in the widget** over a **paged fetch-all** (loop `getRows` to `total`).
   Column names come from the Query's `resolvedColumns` (QueryDetailPage already maps these — reusable).
   **FE-only holds; no contract/backend change.** Two de-prioritized wrinkles: ~20 requests per 2k-row
   query (a *performance* concern — out of scope per [[product-value-framing]]) and string→
   numeric parsing in the widget. *Optional sweetener:* add a larger page_size to `config/values.yaml`
   (one line → regenerates `n`) to collapse the loop to one request — a **tiny contract touch**; take
   only if desired, default is pure FE-only.
2. **Confirm the 2–3 widgets** (the concrete proposal above) and chart types.
3. **Chart library pick — RECOMMENDED `recharts` v3** (decision #3; `@ant-design/charts` disqualified by
   React 19 breakage). Ratify or override.
4. **Data-model ratification** — accept "live now, snapshot = later separate noun" (recommendation above)?
5. **Flow** — confirm DFCFBI (run `flow-selector` at Design exit) and the split shape (FE-only → lighter).

## Plan (by gate — provisional, finalize at Design)

1. **Design gate** — ratify requirements table + the 5 open decisions; run `flow-selector`; run
   `ux-design --design-spec` on the declared affordances. **Human ratify.**
2. **F1 (DFCFBI)** — FE state + layout skeleton + the charts rendering off live query data (MSW + seed);
   **human runs the app** — layout/feel/affordance review ([[dfcfbi-f1-needs-human-review]]). Keep F1
   contract-safe (FE/request-only) ([[dfcfbi-f1-precedes-contract]]) — though R100 expects **no new wire
   fields** (reads existing query execution).
3. **Contract / Backend** — expected **none** (reuses existing query-execution endpoints); confirm at
   Design once aggregation home is settled.
4. **Integration** — run against the real seeded backend; the 2–3 widgets render correct aggregates over
   the live Sales data; responsive layout holds. **Human confirm + Complete.**

## Acceptance criteria (finalized at Design — 2026-06-26)

+ [x] A new "Dashboard" surface (nav + route) renders a fixed 2–3 widget Sales dashboard.
+ [x] Each widget reads a saved Query **live** and shows a correct aggregate over the R99 seed.
+ [x] Responsive layout (content-width cap + fill); no horizontal page scroll. (human-confirmed at F1)
+ [x] FE-only — no migration, no contract change, no persisted dashboard entity (seed dev-data only).
+ [x] Snapshot model recorded as a parked later-noun decision (not built).

**Affordance criteria (added at Design from `ux-design --design-spec` — close the 3 gaps so F1 builds
them, not discovers them):**

+ [x] **Credibility — per-widget states.** `ChartCard` renders **loading / error+retry / empty**, plus
  a page-level **seed-setup** state.
+ [x] **Findability — chart labeling.** Visible card title + Y-axis title + legend; category axis
  labelled by its (angled) ticks. The redundant X-axis *title* was dropped at F1 (the card title +
  ticks already name the dimension — human-flagged label overlap, fixed).
+ [x] **Accessibility — non-color-only + accessible names.** Pie shows name+percent labels + legend;
  each chart wrapped `role="img"` + `aria-label`; colours from AntD theme tokens (`useToken`).

## Risks / unknowns

+ ~~**Aggregation home (decision #1)**~~ — **RESOLVED**: client-side over paged fetch-all; FE-only holds,
  no contract/backend gate (see decision #1). Residual: the paged fetch-all helper + string→numeric
  parsing are the only real build tasks beyond charting.
+ **Chart lib React-19 fit** — `@ant-design/charts` breaks on React 19 (decision #3) → recommend
  `recharts` v3; confirm its React-19 peer range at install. (No product CSP exists — checked.)
+ **Scope creep on a roadmap-home surface** — static multi-widget is already a bigger first slice than the
  canvas Phase-A precedent; hold the line at *static* (no add/configure/persist) so R100 stays thin
  ([[dont-mvp-rush-a-roadmap-home-surface]] cuts both ways — do it right, but one slice at a time).

## Do

### Plan-gate draft — opened from R99's feeds-into (2026-06-26)

R99 (seed) complete + signed off. Human chose the first slice (static multi-widget · FE-only · chart-lib
at Design) and raised the snapshot-vs-live data-model question. Researched prior art (Attio/Metabase/
Salesforce/Tableau/Power BI) → recommendation above (live now; snapshot = separate later noun). Drafted
this requirements table + open Design decisions.

### Framing sharpened + scope confirmed (human, 2026-06-26)

Human reframed the product lens ([[product-value-framing]]): **not competing** with BI
platforms — help a user close *their own* data gap quickly; driver is **ease-of-use for simple DA**, not
performance/parity. Named the concrete stuck — the **report-maintenance treadmill** (re-feed + CRM-drift
breakage every period; a leader stuck on admin-grade spreadsheet repair). Recommendation re-anchored on
ease-of-use (live = simplest mental model / reuse engine; snapshot = complex-later). **Scope confirmed:
R100 stays the static render slice** (persist + re-run-on-upload = later rounds where the value lands).

### Aggregation-home unknown — RESOLVED (contract inspected 2026-06-26)

Inspected `queriesApi` + backend routers/constants: `GET /queries/{id}/rows` → paged `RowsPage` of raw
string rows; **no aggregation endpoint**; page_size ∈ (10/25/50/100). → **client-side aggregation over a
paged fetch-all; FE-only holds, no contract/backend change** (decision #1). **Design gate is now
decision-ready** pending human ratification (data-model + the 2–3 widgets) and the chart-lib
recommendation.

### Human ratification at the Design gate (2026-06-26)

Human ratified the recommended slate: **recharts v3** · the **3 proposed widgets** (revenue by region ·
count/revenue by product · telesale outcomes) · **live re-query now, snapshot = parked later separate
noun** · **DFCFBI**. Aggregation path: **pure FE-only, zero contract touch** — declined the optional
larger-page_size sweetener to keep the "no contract change" acceptance criterion intact (client-side
aggregation loops `getRows` to `total`; ~20 requests/2k-row query is a performance concern, out of scope
per [[product-value-framing]]). All 5 open Design decisions now resolved.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                              |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | Dashboard is static/read-only; per-widget async states (loading/error/loaded) are not user-driven interactive branches.    |
| 2. New interaction pattern           | yes    | First data-visualization/charting surface in the product (none in Datasets/Queries/canvas); recharts integration unproven. |
| 3. High user-error risk              | no     | Read-only static dashboard — nothing destructive or irreversible to mis-step.                                              |
| 4. Contract depends on unresolved UI | no     | Pure FE-only; reuses existing `GET /queries/{id}/rows` — no contract shape to write.                                       |
| 5. UX confidence below threshold     | yes    | First charting surface; layout/feel + chart-lib React-19 fit need human eyeball at F1 (round flags this explicitly).       |

Result: **Flow: DFCFBI (triggers 2, 5)**

### F1 scope discovery — widgets had no backing saved queries (human: extend the seed, 2026-06-26)

On opening F1, found the Design-gate assumption ("all three widgets are single-Query aggregations over
the seed") **did not hold**: the R99 seed created 6 saved queries (Gold-tier customers · Active customers
· Big or pending orders · All regions · Customers with orders · All customers) — **none** back the 3
ratified widgets (no telesale query at all; no clean orders-by-product or revenue-by-region-name query).
Flagged + stopped per the scope brake. **Human chose: extend the seed** (Path A) — add named saved
queries the dashboard binds to. **Touches dev seed data only — no contract/backend/migration change, so
R100 stays FE-only in product terms** (the natural completion of R99's "feeds into the dashboard").
Seed additions (LEFT joins so the seed's edge cases surface as zero): **"Orders by product"**
(products ⋈ orders → product names + the Legacy-Tool-never-ordered edge), **"Telesale calls"** (telesale
plain → outcomes), **"Revenue by region"** (regions ⋈ customers ⋈ orders → region names + Africa-no-sales
edge).

### F1 build (2026-06-26) — awaiting human app-run

Built the static Sales dashboard, FE-only. Verification: `pnpm --filter builder type-check` clean,
**204/204 tests** pass (incl. new `aggregate.test.ts`), `pnpm --filter builder build` green.

+ **Seed** (`scripts/dev/seed.py`): +3 saved queries (Path A) — `Revenue by region` (regions⋈customers⋈
  orders, LEFT), `Orders by product` (products⋈orders, LEFT), `Telesale calls` (plain). LEFT joins so the
  seed's edge cases surface as a zero bar/slice (Africa = no sales; Legacy Tool = never ordered).
+ **chart lib**: `recharts@3.9.0` installed; peer range declares `react ^19.0.0` → **React-19 risk
  cleared** (decision #3).
+ **Surface**: new `Dashboard › Sales` nav group + `/dashboard` route + breadcrumb (`AppLayout`,
  `main.tsx`, `routeMeta.ts`); i18n keys (en + vi).
+ **Feature** (`src/features/dashboard/`): `aggregate.ts` (pure roll-ups, unit-tested), `hooks.ts`
  (seed-workspace + by-name query resolution + paged fetch-all + theme-token palette), `ChartCard.tsx`
  (loading/error/empty/missing states), `widgets.tsx` (bar + pie, axis/legend labels, `role="img"`
  accessible names, non-colour-only pie labels), `DashboardPage.tsx` (responsive 3-col grid + seed-setup
  state).
+ **Affordance criteria** (folded at Design): Credibility (per-widget loading/error/empty + page-level
  seed-setup) ✓ built; Findability (titles + axis/legend labels) ✓ built; Accessibility (non-colour-only
  pie labels + `aria-label` per chart + theme-token colours) ✓ built — **human verifies fidelity at the
  app-run** (`ux-design --fidelity` backstop can run after).
+ **To review** (run `pnpm dev` + `pnpm dev:seed:full`, open `/dashboard`): layout/feel, chart
  readability (long region/product labels on the X axis), the pie at 5 outcomes, responsiveness, and the
  edge-case zeros (Africa, Legacy Tool). Note: bundle grew (~669 KB gz) — dashboard-route code-split is a
  later option, not an F1 blocker.

## Check

**Verified (2026-06-26).** All acceptance criteria met (checklist above). Machine: `type-check` clean ·
**204/204 tests** (incl. `aggregate.test.ts`) · prod build green. Human: ran the app against the real
`pnpm dev:seed:full` backend — the 3 widgets render correct live aggregates (revenue by region · revenue
by product with Legacy Tool = 0 · telesale outcomes pie), responsive layout holds, **"looks nice."** One
F1 defect found + fixed: **X-axis label overlap** → angled category ticks + dropped the redundant X-axis
title. **F1 gate CLOSED** (human review done). DFCFBI back half: **Contract / F2 / Backend = N/A** (FE-
only; reuses existing query-execution endpoints; the only backend-adjacent change was dev seed data).
**Integration = the human app-run above** (real seeded backend).

## Act

Reusable lessons (candidates for `memory/`):

+ **recharts@3.9.0 is React-19-safe** — peer range declares `react ^19`; `@ant-design/charts`
  disqualified (decision #3 confirmed at install).
+ **Client-side aggregation over a paged fetch-all works at seed volume** — loop `getRows` to `total`
  (~20 req/2k rows); column resolution must mirror QueryDetailPage (joined → `resolvedColumns`;
  single-source → dataset columns). Pure roll-ups (`aggregate.ts`) kept unit-testable.
+ **A "single-Query aggregation" Design assumption can be false** — the ratified widgets had no backing
  saved queries; caught at F1, resolved by extending the seed (Path A). Lesson: at the Design gate,
  **verify the backing data/queries exist**, don't assume.
+ **Compute vs presentation layering + the Polars/Dash decoupling** — recorded in
  [[product-value-framing]] (the doctrine reframe this round triggered).
+ **The static slice is a proof, not the product** — F1 feedback (dynamic widgets · multiple named
  dashboards · settings) confirms the headline value needs the persisted-noun theme (below).

## Feeds into

**Feeds into →** the **"Dashboard as a persisted noun" theme** (human-chosen next, 2026-06-26), seeded by
R100's F1 feedback. Sequence = value-first ([[post-mvp-roadmap-migration-first]]):

+ **① Persist the noun (next round — headline value).** A **Dashboard** entity (SQLModel + alembic
  migration + contract); create / name / list dashboards (`Dashboard › Weekly report`); **dynamic nav**
  from the saved list (replaces R100's hardcoded `Sales` leaf). This is where "define once → re-runs on
  new data + absorbs drift" lands.
+ **② Dynamic / interactive widgets (Tableau-like).** Per-widget filters · date-range · drill-down ·
  swap dimension/measure **via UI controls** — must stay **formula-free** ([[product-value-framing]] #1).
+ **③ Dashboard settings (minimal).** Per-dashboard config (name · layout · default range); keep small.
+ **Snapshot / Report noun** — parked later-noun (freeze a report artifact) on the consumer-save /
  Excel-export path, **not** a dashboard property.
+ **Heavy-DA #3 surface (Dash) + Polars compute** — parked; see [[product-value-framing]] (Polars may
  arrive earlier as core workflow compute — not gated by #3).
