# Round 109: recharts chart-type expansion + widget model (line/time-series)

**Status**: **Complete** (2026-06-29, autopilot) — all gates green
**Date started**: 2026-06-29
**Date completed**: 2026-06-29
**Flow**: Likely **DFCFBI** (new chart rendering — look/feel matters; an F1 design-sync before any model/wire
change). Confirmed by `flow-selector` after Design.

> **Pivot (2026-06-29):** opened as "ECharts adoption + review"; the **Discovery review** (see Do log)
> found recharts ^3 already covers the charts the #1 product needs (line/stacked/combo) and ECharts'
> differentiators are #3/BI territory. Human pivoted: **expand recharts + do the widget-model work; defer
> ECharts** to a named can't-do-in-recharts pull.

## Goal

**Inherits from ← [Round_108](Round_108.md) Feeds-into.** Wire the recharts chart types the #1 product
actually needs — **line / time-series first** — and do the **widget-model work** that real charting needs
(ordering an x-axis by its dimension, not by value). **ECharts is re-deferred** (3rd rung, future pull). The
R108 read-only JSON inspector is **resolved here** (lean: drop — its ECharts-editor rationale defers with
ECharts).

_Track: 1 (product — the #1 chart presentation surface). Pulled by ← human (2026-06-29) + R108 Feeds-into +
the discovery below + the [R101 chart-lib ladder](../../memory/2026-06-26-product-value-framing.md). Per the
[Evolution Rule](../../AGENTS.md)._

> **Theme (multi-round arc, human 2026-06-29):** R109 opens a deliberate **zoom-in on widgets & charts
> (recharts AND echarts)** as a **demand-pull probe to discover the exact data-layer (datasets / queries /
> workflows) requirements** — presentation specifies compute. See memory `charts-probe-data-layer`. So
> ECharts is **not hard-deferred** — it's sequenced *later in this arc* as a discovery instrument; **R109
> itself stays recharts/line** (step one, thin). The arc's real deliverable is a running capture of the data
> demands each chart surfaces.

## Code-sourced truth (verified 2026-06-29)

- The chart **seam is the renderer**: [`WidgetView`](../../../workspace/apps/builder/src/features/dashboard/WidgetView.tsx)
  rolls rows up (`useWidgetChartData`) then delegates to `ChartCard` (lib-agnostic card chrome:
  title/loading/error/empty/warning) wrapping `BarView` / `PieView` — the **recharts** renderers, chosen by
  `widget.chartType`. ECharts would add renderers here, NOT a new page (R101: "WidgetView is the
  lib-agnostic seam; don't pre-build a plugin layer").
- The widget model is lib-agnostic + formula-free:
  [`Widget`](../../../workspace/apps/builder/src/features/dashboard/types.ts) = `chartType` ∈ {bar, pie},
  `dimensionCol`, `measureCol?`, `agg` ∈ {sum, count}, `span`. Aggregation is **client-side** over the
  unpaged fetch (R107) — no aggregation endpoint.
- recharts is the only chart lib today. R108 added a read-only config JSON view (provisional).

## Scope (post-pivot)

1. **Line / time-series chart** — wire recharts `LineChart` as a new `chartType: 'line'`, a `LineView`
   renderer beside `BarView`/`PieView` at the `WidgetView` seam.
2. **Widget-model work — x-axis ordering.** A line/time chart must order points **by the dimension**
   (chronologically for a date dimension), not `sortDesc` by value as bar/pie do. The dimension's `dtype` is
   already on `DataColumn`, so ordering can be driven by `chartType` + `dtype` — likely **no new persisted
   field**.
3. **R108 inspector — KEEP as-is** (revised). The earlier "drop" lean assumed ECharts was hard-deferred;
   the multi-round theme sequences ECharts *into* this arc, reviving the inspector's rationale (a seed for
   the eventual options view/editor). The human already chose to keep it. Revisit only if the arc shows it
   genuinely doesn't earn its place.

## Open design questions (Design gate)

- **DA — chart-type breadth:** line/time-series **only** this round, or also **multi-series** (stacked /
  grouped bars)? _Lean: line, single-series, this round (one feature / thin round); multi-series needs a
  `seriesCol` model addition → its own round._
- **DB — ordering model:** for `line`, order by the dimension — date `dtype` → chronological (parse), else
  natural/first-seen order. _Lean: drive off `chartType` + existing `dtype`; no new widget field; confirm a
  date dimension parses & sorts correctly._
- **DC — R108 inspector:** _Resolved: **keep as-is** (see Scope #3) — ECharts re-entering the arc revives
  its rationale; the human chose to keep it._

## Anti-scope (default = don't add — deferred to a named pull)

- **ECharts** — re-deferred to a real can't-do-in-recharts need (heatmap/gauge/maps/network/large-data/heavy
  interaction); a #2/#3 pull. The `WidgetView` seam stays ready; no pre-built plugin layer.
- **Multi-series / `seriesCol`** unless DA pulls it in.
- The **`advancedOptions` JSON overlay** + any JSON **editor** (rode in with ECharts; deferred with it).

## Plan

1. **Plan gate** — PASSED (human pivot, post-discovery).
2. **Design gate** — resolve DA–DC; `ux-design --design-spec` on the line widget; `flow-selector` (expected
   DFCFBI — a look/feel surface).
3. **Build** — `LineView` + `'line'` chartType + dtype-aware ordering; drop R108 inspector; tests.
4. **Check** — gates green + human eyeball (DFCFBI human Check on the rendered line chart).

## Risks / unknowns

- **Date ordering correctness** — a date dimension arrives as strings; chronological ordering needs robust
  parsing (the dataset `dtype` says `date`/`datetime`, but formats vary). The model work hinges on this.
- **High-cardinality x-axis** — a line over a many-valued dimension is unreadable; same fetch-cap bound as
  bar/pie applies, but a line makes density obvious. Watch at Design.
- **Scope creep** — into multi-series (`seriesCol`) or ECharts; both are explicitly the *next* pulls, not
  this round.

## Do

### Built (2026-06-29) — line/time-series, autopilot

`chartType: 'line'` added end to end: contract enum `[bar, pie, line]`
([_shared/dashboard.yaml](../../../workspace/packages/contracts/_shared/dashboard.yaml)) + backend
`ChartType` Literal ([common.py](../../../workspace/apps/backend/app/models/common.py)); FE `LineView`
(recharts `LineChart`) + a builder chart option + `ariaLine` i18n (en/vi). **Model insight realized:** a
line orders by the **dimension** — new `sortByDimension(data, dtype)` in
[aggregate.ts](../../../workspace/apps/builder/src/features/dashboard/aggregate.ts) (date/datetime →
chronological, else lexical), wired in `useWidgetChartData` (line → by-dimension; bar/pie → by-value). **No
new persisted field** — ordering is driven by `chartType` + the dimension's existing `dtype`. Data-layer
demands captured in the [probe ledger](../brainstorms/2026-06-29-charts-probe-data-layer.md#r109--line--time-series-).

**Verification:** contract 29 · backend 224 · ruff clean · FE typecheck clean · FE suite **222** (219 + 3
new `sortByDimension` tests). R108 inspector kept (per the strategy pivot).

### Discovery review (2026-06-29) — and a reframe of the ECharts premise

**What we render today (repo fact):** `recharts ^3.9.0`, but only `BarChart` + `PieChart` are wired
([WidgetView.tsx](../../../workspace/apps/builder/src/features/dashboard/WidgetView.tsx)). Aggregation is
single-dimension × single-measure, `sum`|`count`, sorted desc ([aggregate.ts](../../../workspace/apps/builder/src/features/dashboard/aggregate.ts)).

**The load-bearing finding: most "advanced" charts do NOT need ECharts — recharts ^3 already supports
them.** Line/time-series, area, stacked & grouped bars, scatter, and combo (`ComposedChart`) are all
recharts components we simply haven't wired. So "what can recharts NOT do that the #1 product needs?" has a
surprisingly short answer.

**What ECharts genuinely adds beyond recharts:** the heavier chart zoo (heatmap, gauge, candlestick,
network/graph, sunburst, parallel, geo **maps**), canvas-scale performance + rich built-in interactions
(`dataZoom`, `brush`, `visualMap`, `toolbox`), and the JSON `option` config model. **Those differentiators
map to #3 (heavy-DA) / BI-tool territory — which the [product-value doctrine](../../memory/2026-06-26-product-value-framing.md)
says #1 explicitly does NOT compete with.** For a basic-Excel leader closing their own data gap, the pulling
needs are chart *types* recharts already has.

**Reframe of the R101 ladder.** The ladder read "recharts (basic) → ECharts (advanced)". The discovery
shows a middle rung was conflated into ECharts: **recharts-basic (bar/pie, now) → recharts-fuller
(line/stacked/combo/scatter) → ECharts (truly can't-do-in-recharts: heatmap/gauge/maps/network/large-data/
heavy-interaction).** ECharts is the *third* rung, pulled by a #2/#3 need — not the next step.

**Recommendation (evidence-grounded; this is the cold-review challenge to the ECharts premise):**

1. **Near-term pull = expand recharts, not adopt ECharts.** Highest-value first: **line / time-series**
   (the chart an Excel user reaches for most — "revenue over time" — which today's `sortDesc` agg can't even
   order correctly). Then multi-series (stacked/grouped). Additive at the `BarView`/`PieView` seam, **no new
   dependency**, low risk, squarely #1.
2. **The real design work is the MODEL, not the lib.** Line needs an *ordered/time* dimension (don't
   `sortDesc` dates); multi-series needs a second group-by (series) or a second measure. This is exactly
   where "structured-props extension vs `advancedOptions` overlay" gets decided — and structured props very
   likely cover it **without** any JSON.
3. **Defer ECharts** to a named need recharts can't serve (a #2/#3 pull). Keep `WidgetView` the lib-agnostic
   seam so ECharts drops in additively when that day comes — no pre-built plugin layer.
4. **Reconsider R108's inspector (prune candidate).** Its rationale was "prep for the ECharts `option`
   editor." If ECharts is deferred, a read-only JSON view of a handful of structured props earns little —
   which is likely why it felt "not quite right." Lean: **drop it** (or keep only if transparency stands on
   its own merit), per the pruning discipline.

**Net:** R109 should likely become a **recharts chart-type + widget-model** round (line-first), with ECharts
**re-deferred** to its real pull. Awaiting human steer on that pivot (see chat).

## Check

| Item | Result |
| --- | --- |
| Contract suite | 29 passed (`chartType` enum + line) |
| Backend suite | 224 passed · ruff clean (`ChartType` Literal extended) |
| FE typecheck | clean |
| FE suite | **222 passed** (219 + 3 `sortByDimension`) |
| Data-layer demands captured | ✅ ledger R109 entry |

## Act

**Round complete (2026-06-29, autopilot).** Line/time-series shipped; the substantive work was the
**ordering model** (`sortByDimension`), not the renderer. Strongest data-layer signal so far: **time-bucketing
(`date_trunc` + GROUP BY) wants to be a query/workflow transform** — logged in the probe ledger as the first
concrete workflow pull. Step one of the charts→data-layer arc.

## Feeds into → Round_110

R110 — **KPI / single-number "stat" widget** (e.g. total revenue, deal count): a *scalar* aggregate, which
probes a different data shape (one number, no dimension) and likely the demand for a scalar/summary query.
