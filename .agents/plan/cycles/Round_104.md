# Round 104: Widget row-cap + over-cap warning — bound the fetch-all

**Status**: Complete
**Date started**: 2026-06-28
**Date completed**: 2026-06-28
**Flow**: **DCFBI** — set at the Design gate via `flow-selector`; recorded in the Do log. Contract-free
(FE + a `values.yaml` constant) → Contract + Backend are no-ops; the warning feel is checked at the Check
visual gate.

## Goal

**Inherits from ← [Round_103](Round_103.md)** — dashboard widgets fetch their data with a paged
**fetch-all** (`fetchAllRows` loops `GET /queries/{id}/rows` to `total`). Correct for seed/demo data, but
**unbounded**: a very large query pulls every row into the browser (hundreds/thousands of sequential
requests) — slow, memory-heavy, no guard. The human flagged this at R103 close.

Add a **max-rows cap**: under it, nothing changes; over it, **fetch up to the cap and WARN** the user (an
icon on the widget) that the view is **partial** — so a big query degrades gracefully instead of hanging,
and the user is never silently misled by a truncated aggregate.

_Track: 1 (product). Pulled by ← R103 Feeds-into (row-cap + warning) + the human's R103-close proposal.
Per the [Evolution Rule](../../AGENTS.md)._

## Design decisions (ratified — human, 2026-06-28)

1. **Cap home = `values.yaml`** (a constant sibling of `page_sizes`), exposed via the generated constants
   (BE + FE). Accepted the build-time-constant caveat (centralized, not a runtime dial).
2. **Cap default = 10,000 rows.** Perf basis: client-side JS roll-up over ≤10k is trivial (ms); the real
   bound is fetch **requests/payload** (~100 paged requests worst case at `page_size` 100). Tunable;
   perf can refine. A **gentle warning if the user raises it above the default** is deferred to the
   per-dashboard-override round.
3. **Over-cap = render the PARTIAL chart + a gentle warning signpost** (not block) — a labelled warning
   affordance: "Showing the first 10,000 rows — this dataset is large for a live dashboard; totals are
   partial." Informational + light signpost; does **not** route to a placeholder heavier surface yet.
4. **Partial filter lists** — when `cap < total`, a widget's filter-drawer value lists are also partial;
   surface a consistent note in the drawer.
5. **Scope = global cap + warning, FE-only, contract-free.** Deferred (evidence-gated): per-dashboard
   override (persisted → contract), and the **server-side pushdown**.
6. **Doctrine note (recorded so it isn't re-litigated):** server-side **DuckDB GROUP BY** is a **COMPUTE
   pull** that keeps the SAME #1 presentation (recharts in the one app) — it is **not** #3. **Dash /
   heavy-DA (#3)** is a separate *surface* pull; **#2** is the AI-workflow pull. The **cap is #1's
   boundary**: hitting it is the *signal* a query has outgrown the simple client-side view — the
   evidence-driven moment to pull the compute tier (still #1) or tier up to #2/#3. ([[product-value-framing]])

## Declared affordances + states (for `ux-design --design-spec`)

- **Cap warning** — a **visible, labelled** affordance on a capped widget (icon + accessible tooltip /
  text stating "first N of M — partial"); **not colour-only**; keyboard-reachable.
- **Graceful degrade** — the chart still renders the partial data (the capped state is specced, not a
  dead end); **uncapped widgets show no warning** (no false alarm).
- **Filter drawer** — when the widget is capped, a small note that the value lists are partial.
- **Desirability** — AntD components + theme tokens; the warning uses the theme's warning token, no ad-hoc colour.

## Open Design questions (resolved above)

1. **Home of the global default cap** — `values.yaml` (a centralized product knob, as the human first
   suggested) vs a **FE constant** (per the config-home heuristic: a fetch cap is FE-only / single-consumer
   today). _Caveat to weigh: `values.yaml` is rendered at **build time**, so it's a centralized constant,
   **not** a runtime/ops knob — no "tune without redeploy" benefit. Lean: decide by whether a 2nd consumer
   (a future server-side limit) is near._
2. **The cap value** — what's a sensible browser-safe default (e.g. 10k rows)? Ground it in a quick perf
   sanity-check, not a guess.
3. **Over-cap behavior** — render the **partial** chart + warn (lean: yes — partial data is still useful),
   or block the widget? And the warning surface: an icon in the card header (next to the filter/move
   affordances) + a tooltip ("Showing first 10,000 of 45,231 rows — totals are partial").
4. **Filter-drawer partial-ness** — when capped, the per-widget filter value lists are also partial
   (built from the capped rows). Note it / warn in the drawer too?
5. **Scope line** — this round = **global cap + warning, FE-only (contract-free)**. The **per-dashboard /
   -widget override** (the human's "change it from the properties panel") is a **persisted setting →
   contract change** → a later round. The **server-side pushdown** (DuckDB GROUP BY / filter, the real fix
   for huge data) is the parallel compute-pull, also later.
6. **Flow** — `flow-selector` at Design exit (likely DCFBI again if FE-only / contract-free).

## Plan (provisional — finalize at Design)

1. **Design gate** — ratify the questions above; `flow-selector` + `ux-design --design-spec` (the warning
   affordance). **Human ratify.**
2. **Build (FE)** — `fetchAllRows` stops at the cap (fetch `ceil(cap / pageSize)` pages, not all);
   `fetchWidgetData` reports `{ total, capped }`; `WidgetView` / `ChartCard` show a warning affordance +
   tooltip when `capped`. Aggregates + filters then run over the capped subset (the partial-ness the
   warning communicates).
3. **Verify** — under cap: unchanged (no warning, full data); over cap: bounded fetch + clear warning;
   type-check + tests + build green; human app-run.

## Acceptance criteria

- [x] A query **under** the cap behaves exactly as today (full fetch, no warning). _(`capped = total > cap`.)_
- [x] A query **over** the cap fetches **at most** the cap (`fetchAllRows` pages only to `min(cap, total)`)
  and shows a **clear warning** affordance (icon + tooltip: "first N of M — partial"). _Human-verified at
  cap 1000 on seed data, 2026-06-28._
- [x] The chart still renders on the **partial** data (graceful degrade), not a dead end.
- [x] The cap default lives in **one named home** — `values.yaml` `dashboard_max_rows` (ships at **10,000**).
- [x] **No contract / backend change** this round (global cap only; per-dashboard override deferred).
  Type-check + 216 tests + build green; human app-run confirmed.

## Risks / unknowns

- **Partial aggregates are inherently approximate** — a capped "sum by region" misses rows beyond the cap.
  The warning must make this unmistakable (not a subtle dot); else it's worse than no cap (silently wrong).
- **Cap value tradeoff** — too low truncates real dashboards; too high doesn't protect. Needs a grounded
  default, not a guess.
- **Shared fetch** — `fetchWidgetData` is shared by the widget render + the filter drawer (one cache key);
  the cap + `capped` flag must flow to both so the drawer's value lists are consistently partial.
- **Not the full fix** — the cap is a graceful-degrade guard, not scaling. The real lift is the deferred
  server-side pushdown; don't let the cap masquerade as "large data solved."

## Do

### Plan-gate draft — opened from R103 (2026-06-28)

R103 (per-widget runtime filter) Complete + signed off. At close, the human flagged the unbounded
fetch-all and proposed a max-rows cap + over-cap warning (global default + future per-dashboard override).
Opened R104 on that; drafted the goal, the FE-only v1 scope (global cap + warning; override + server-side
pushdown deferred), and the open Design questions (cap home, value, over-cap behavior, partial filter
lists). **Next: human Design-gate kickoff** (ratify → `flow-selector` → `ux-design --design-spec`).

### Design gate — decisions ratified (human, 2026-06-28)

Human ratified: cap in `values.yaml` (sibling of `page_sizes`), default **10k**; over-cap renders the
partial chart with a gentle warning signpost; partial filter lists noted; FE-only / contract-free; and the
server-side aggregate clarified as a **compute pull (still #1)**, distinct from #3 (Dash surface) and #2
(AI workflow) — deferred, evidence-gated. **Parked (human exploring in parallel):** a **"fetch-once"**
strategy to avoid the paged-at-100 request count — relates to the deferred page-size/server-side question;
not in R104.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                              |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| 1. >3 independent states/branches    | no     | Two states — capped / uncapped; the warning is one affordance.                             |
| 2. New interaction pattern           | no     | A warning icon + tooltip is a standard, existing affordance pattern.                       |
| 3. High user-error risk              | no     | Informational only; nothing destructive or committed.                                      |
| 4. Contract depends on unresolved UI | no     | Contract-free — a `values.yaml` constant + FE; no wire shape.                              |
| 5. UX confidence below threshold     | no     | Small, well-understood affordance; the only nuance (warning loudness) is resolved (gentle).|

Result: **Flow: DCFBI** (0 triggers → default). Contract-free FE round; warning feel verified at the
Check visual gate.

### Build done (2026-06-28) — awaiting human Check (warning feel)

Built the v1 (commits held for the human review):

- **`values.yaml`** — `dashboard_max_rows: 10000` (sibling of `page_sizes`); FE-only, so rendered to the
  **FE** generated constants (`DASHBOARD_MAX_ROWS`) only — the BE constants/test are untouched.
- **`hooks.ts`** — `fetchAllRows(id, cap)` now stops at the cap (pages only to `min(cap, total)`) and
  returns `{ rows, total }`; `fetchWidgetData` reports `{ total, capped }` (`capped = total > cap`);
  `WidgetData` gains `total` + `capped`; `useWidgetFilterOptions` returns `{ options, capped }`.
- **`ChartCard`** — a `warning` slot rendered next to the title (doesn't shrink the chart body).
- **`WidgetView`** — when `capped`, a theme-warning `WarningOutlined` + tooltip ("Showing the first 10,000
  of N rows … totals are partial"), with an `aria-label`; the chart still renders the partial data.
- **`WidgetFilterDrawer`** — when the widget is capped, an `info` Alert notes the value lists are partial;
  also swapped the deprecated `Space direction="vertical"`/`Alert message` for `Flex vertical`/`Alert title`.
- en + vi strings (`dashboard.cap.*`, `dashboard.filter.partialNote`).

Verification (automated): builder **type-check clean · 216/216 tests · prod build green**.

**Check note (testability):** the seed data (~2k rows) is **under** the 10k cap, so no widget trips the
warning by default. To exercise it, temporarily set `dashboard_max_rows` low (e.g. `50`) in
`workspace/config/values.yaml` and restart `pnpm dev` (predev re-renders the constant) — a seeded widget
then caps → confirm the warning icon/tooltip + the chart still renders + the drawer's partial note; then
restore `10000`.

## Check

Verification (2026-06-28):

| Item | Result |
| --- | --- |
| Builder type-check | clean |
| Builder tests (vitest) | **216** (unchanged; cap logic is integration — pure helpers already covered) |
| Prod build | green |
| **Check visual gate (human)** | **PASS** — tested at a temporary cap of 1000 (seed ~2k trips it): warning icon + tooltip, chart still renders partial, drawer partial-note; restored default to 10,000 for ship. |

Backend / contracts / `@mdd/ui` untouched (FE + a FE-only generated constant; BE constants/test unchanged).

## Act

**Learnings**:

- The row-cap is a **graceful-degrade guard, not a speed fix** — at `page_size` 100 it still pages, just
  bounded. The real request-count fix is the deferred server-side pushdown; the cap's job is "don't hang +
  warn it's partial." Kept that honest in the warning copy.
- **Default sizing is a cry-wolf decision**: 1000 (good for *testing* the warning on seed data) would warn
  on normal CRM dashboards; **10,000** keeps the "large" signal meaningful. Shipped 10k.
- Reaffirmed the **compute-pull vs surface-pull** distinction (DuckDB GROUP BY = still #1; Dash = #3) so a
  future scale round doesn't mislabel the fix. The **cap = #1's boundary**.
- Swept two AntD v6 deprecations encountered in the touched files (`Space direction` → `Flex vertical`,
  `Alert message` → `title`) rather than add new ones.

**Promotions**: none — no reusable rule/skill; the cap pattern lives in the code.

**Follow-ups (not promotions, just notes):** see Feeds-into — per-widget/-dashboard cap override (the
in-app "increase" control + over-default warning), server-side pushdown, date-range/drill, saved filters.

The human is **exploring a "fetch-once" strategy** in parallel (avoid the paged-at-100 request count) —
relates to the deferred page-size / server-side question.

## Feeds into → Round_105 (TBD)

**Feeds into →** the rest of the scale + interactivity work:

- **Per-dashboard / -widget cap override** — set the cap from the widget properties panel (persisted →
  contract change).
- **Server-side pushdown** — DuckDB GROUP BY / filter so the browser receives small aggregates, not all
  rows (the real large-data fix; retires the cap's partial-ness for pushed queries).
- **Date-range + drill filters**, **saved / URL-encoded filters** — carried from R103.
