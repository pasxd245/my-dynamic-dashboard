# Round 111: multi-series grouped bar (`seriesCol`)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (new optional `seriesCol` wire field). Charts→data-layer probe arc, step 3.

## Goal

**Inherits ← [Round_110](Round_110.md).** Add a **second grouping** ("split by", `seriesCol`) so a bar
widget can render grouped multi-series bars — the next probe in the
[charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md). Probes the 2-D GROUP BY /
pivot data shape.

_Track: 1. Pulled by ← R110 Feeds-into + the probe strategy (memory `charts-probe-data-layer`)._

## Plan

1. Optional `seriesCol` across contract / backend `Widget` / FE `Widget` + `WidgetWire`.
2. `aggregateByGroupSeries` (2-D roll-up → wide rows + series keys); `MultiBarView` renders one bar per
   series value (grouped). Only for `bar` with a `seriesCol`; absent → single-series, unchanged.
3. Builder "Split by" picker (bar only, clearable); `draftToConfig` carries `seriesCol` only for a bar.

## Do

### Built (2026-06-30, autopilot)

`seriesCol` wired end to end — contract property + backend `Widget.seriesCol` optional + FE types/wire; the
hook computes `multiSeries` (via `aggregateByGroupSeries`) for a bar with a series, and `WidgetView` renders
`MultiBarView` (grouped bars) vs the single-series `BarView`. Builder gains a clearable "Split by" select
(bar only); `draftToConfig` adds `seriesCol` only on a bar. Single-series roll-up extracted to
`singleSeriesData` (keeps the hook under the cognitive-complexity bar); `previewWidget` now reuses
`draftToConfig` (preview == saved shape). i18n `series*` (en/vi).

**Data-layer demands captured** ([ledger R111](../brainstorms/2026-06-29-charts-probe-data-layer.md#r111--multi-series-grouped-bar-)):
a real chart need is **2-D** (`GROUP BY dim, series`); the FE is doing a **client-side pivot** every render
(`aggregateByGroupSeries` is a crosstab) → pulls a server `GROUP BY (dim, series)` / pivot workflow + wide
result shape, with eventual TOP-N/"other" bucketing for cardinality.

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **228** (226 + 2
`aggregateByGroupSeries`).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 228 passed |
| Data-layer demands captured | ✅ ledger R111 |

## Act

**Complete (2026-06-30, autopilot).** Multi-series bar shipped; the model gained a second grouping and the
ledger gained the clearest **pivot / 2-D GROUP BY** signal — the FE is now demonstrably re-pivoting the row
set client-side, which a server crosstab/workflow should own.

## Feeds into → Round_112

R112 — **combo chart** (two measures on one dimension via recharts `ComposedChart`): probes the
multiple-measures (not multiple-series) data shape — a query emitting two aggregated columns.
