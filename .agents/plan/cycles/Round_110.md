# Round 110: KPI / stat (single-number) widget

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (chartType enum + optional `dimensionCol` are wire changes). Charts→data-layer
probe arc, step 2. F1/F2 skipped (no new feel surface beyond a number).

## Goal

**Inherits ← [Round_109](Round_109.md).** Add a **single-number KPI widget** (`chartType: 'stat'`) — total
revenue, deal count — as the next probe in the [charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).
A scalar is a *different data shape* (one number, no grouping) and surfaces a different data-layer demand.

_Track: 1 (product — chart/widget surface). Pulled by ← R109 Feeds-into + the probe strategy (memory
`charts-probe-data-layer`). Per the [Evolution Rule](../../AGENTS.md)._

## Plan

1. `chartType: 'stat'` — a `StatView` (AntD `Statistic`) showing one aggregate (sum of a measure / row
   count) over the whole result.
2. **`dimensionCol` → optional** (contract `required`, backend model, FE `Widget`/`WidgetWire` types) — a
   KPI has no grouping. Breakdown charts (bar/pie/line) still carry it.
3. New pure `aggregateScalar(rows, measureIdx, agg)`; builder hides the dimension picker for `stat`.

## Do

### Built (2026-06-30, autopilot)

`stat` wired end to end — contract enum `[bar,pie,line,stat]` + `dimensionCol` dropped from `required`
([_shared/dashboard.yaml](../../../workspace/packages/contracts/_shared/dashboard.yaml)); backend
`ChartType` Literal + `dimensionCol: ... | None`
([common.py](../../../workspace/apps/backend/app/models/common.py)); FE `StatView`, `aggregateScalar`,
optional `dimensionCol` in `Widget`/`WidgetWire`, builder `stat` option + conditional dimension picker +
`draftToConfig` omitting the dimension for stat; `ariaStat`/`chartStat` i18n (en/vi). A `dimIdx` guard
(`dimensionCol ? findColIndex : -1`) also prevents a latent crash on a dimensionless widget.

**Data-layer demands captured** ([ledger R110](../brainstorms/2026-06-29-charts-probe-data-layer.md#r110--kpi--stat-single-number-)):
(1) widgets aren't all *breakdowns* — a KPI is *measure-only*, so the consumed contract has ≥2 shapes;
(2) **the sharpest server-side-aggregate pull yet** — a total over a capped fetch is *incorrect*, not just
partial, so KPIs genuinely want a server `SUM`/`COUNT` (an aggregate endpoint) the FE cannot fake.

**Verification:** contract 29 · backend 225 (16 dashboard, +1 stat) · ruff clean · FE typecheck clean ·
FE suite **226** (222 + 3 `aggregateScalar` + 1 stat-config).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed (enum + optional dimensionCol valid) |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 226 passed |
| Data-layer demands captured | ✅ ledger R110 |

## Act

**Complete (2026-06-30, autopilot).** KPI widget shipped; the model learned that not every widget is a
breakdown (`dimensionCol` now optional) and that **correct totals can't come from a capped client-side
fetch** — the first hard pull for a server-side aggregate. Logged.

## Feeds into → Round_111

R111 — **multi-series** (grouped / stacked bar): a *second* categorical grouping (`seriesCol`), which probes
the long-vs-wide data-shape question and a two-dimensional GROUP BY demand.
