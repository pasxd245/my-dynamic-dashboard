# Round 113: scatter (raw row-level points)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (chartType `scatter`; reuses `measureCol`/`measureCol2`). Probe arc, step 5.

## Goal

**Inherits ← [Round_112](Round_112.md).** Add a **scatter** chart — `measureCol` (X) × `measureCol2` (Y),
one point per row, **no aggregation**. The first widget that doesn't roll up; probes the *raw-rows* data
shape. Part of the [charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R112 Feeds-into + the probe strategy (memory `charts-probe-data-layer`)._

## Plan

1. `chartType: 'scatter'` (contract / backend / FE); reuse `measureCol`(X) + `measureCol2`(Y).
2. `toScatterPoints` (row → `{x,y}`, no roll-up); `ScatterView` (recharts `ScatterChart`).
3. Builder: scatter option, X/Y measure pickers, no dimension/agg/series; `draftToConfig` + `canSubmit`
   handle the two-measure shape (shared with combo via `twoMeasures`).

## Do

### Built (2026-06-30, autopilot)

`scatter` wired end to end (enum across contract/backend/FE). `toScatterPoints` maps raw rows to `{x,y}`;
the hook exposes `scatterData`; `WidgetView` renders `ScatterView`. Builder gains a scatter option + X/Y
pickers; the two-measure logic (combo + scatter) is shared via a module-level `twoMeasures(draft)` helper.
i18n `chartScatter`/`measureX`/`measureY`/`ariaScatter` (en/vi).

**Data-layer demands captured** ([ledger R113](../brainstorms/2026-06-29-charts-probe-data-layer.md#r113--scatter-raw-row-level-points-)):
a THIRD consumed shape — **raw rows** (no group-by); the cap here is a *biased sample*, pulling server-side
**sampling**. Plus a **META-finding** logged: the hand-branched builder's complexity exploded across the six
chart types (peak cognitive-complexity 21) → the config MODEL wants a declarative per-chart field-schema
and/or the `advancedOptions` escape hatch.

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **230** (229 + 1
`toScatterPoints`).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 230 passed |
| Data-layer demands captured | ✅ ledger R113 + meta-finding |

## Act

**Complete (2026-06-30, autopilot).** Scatter shipped — completes the recharts exploration (bar / line /
pie / stat / combo / multi-series / scatter). The probe has now surfaced THREE consumed data shapes (grouped
rows, scalar, raw rows) and a clear server-aggregate + sampling pull, plus the builder-complexity
meta-finding. Natural phase boundary before the ECharts spike.

## Feeds into → Round_114

R114 — **ECharts spike** (heatmap, lazy-loaded): the first non-recharts renderer. Validates the
`WidgetView` lib-agnostic seam (R101) + lazy-load (bundle), and probes the **2-D matrix / crosstab** data
shape (day × hour → count) most sharply.
