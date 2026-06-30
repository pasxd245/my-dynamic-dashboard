# Round 114: ECharts heatmap (first ECharts chart, lazy-loaded)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract + a new dependency (`echarts`). Charts→data-layer probe arc, step 6 — the
ECharts spike.

## Goal

**Inherits ← [Round_113](Round_113.md).** Add a **heatmap** — a 2-D matrix (`dimensionCol` × `seriesCol` →
agg) — rendered with **ECharts** (the first non-recharts renderer), **lazy-loaded**. Validates the R101
lib-agnostic seam + probes the densest crosstab data shape. Part of the
[charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R113 Feeds-into + the probe strategy (memory `charts-probe-data-layer`) — ECharts
enters the arc as a discovery instrument, not as speculative capability._

## Plan

1. Add `echarts` dep. `chartType: 'heatmap'` (contract / backend / FE).
2. `aggregateMatrix` (x × y → `{xs, ys, cells}`); new `HeatmapView` (ECharts) **lazy-loaded** via
   `React.lazy` + `Suspense` so echarts stays out of the base bundle.
3. Builder: heatmap option; `seriesCol` now used by bar (optional) AND heatmap (required Y) via a
   `usesSeries` helper; `canSubmit` requires the series for heatmap.

## Do

### Built (2026-06-30, autopilot)

`echarts ^6.1.0` added. `heatmap` wired end to end (enum across contract/backend/FE). `aggregateMatrix`
builds the x × y matrix (NUL-joined cell keys, x/y kept on the value — no key parsing). New
[`HeatmapView`](../../../workspace/apps/builder/src/features/dashboard/HeatmapView.tsx) renders it with
ECharts (init/setOption/ResizeObserver/dispose), **lazy-loaded** (`const HeatmapView = lazy(() =>
import('./HeatmapView'))` + `Suspense`) so the ~1 MB echarts chunk loads only when a heatmap renders.
Builder: heatmap option, series picker generalized to bar (optional) + heatmap (required) via `usesSeries`.
i18n `chartHeatmap`/`ariaHeatmap` (en/vi).

**Data-layer demands captured** ([ledger R114](../brainstorms/2026-06-29-charts-probe-data-layer.md#r114--heatmap-first-echarts-chart-lazy-loaded-)):
the **R101 lib-agnostic seam HELD** — ECharts and recharts coexist behind `WidgetView`, chosen by
`chartType`, with **zero model/contract change**; and the heatmap is the **strongest server-pivot pull**
(a full x × y grid over capped rows is wrong + wasteful). Bundle cost confirms lazy-load is mandatory.

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **232** (230 + 2
`aggregateMatrix`).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 232 passed |
| Lib-agnostic seam (R101) | ✅ ECharts added with no model/contract change |
| Data-layer demands captured | ✅ ledger R114 |

## Act

**Complete (2026-06-30, autopilot).** First ECharts chart shipped, lazy-loaded; the lib-agnostic seam is
validated in practice (not just in theory). The probe's dominant finding is now unmistakable: a
**server-side aggregate/pivot** is the data layer's biggest pull.

## Feeds into → Round_115

R115 — a **second ECharts chart** (gauge — a KPI vs target): hardens the ECharts seam with a different
chart family and probes the "value + target/threshold" config shape.
