# Round 115: ECharts gauge (value vs target)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (chartType `gauge` + literal `target`). Charts→data-layer probe arc, step 7.

## Goal

**Inherits ← [Round_114](Round_114.md).** Add a **gauge** — a scalar aggregate shown against a literal
`target`/max — as a **second ECharts chart** (a different chart family; recharts has no gauge). Hardens the
lib-agnostic seam + probes the "value + literal config param" shape. Part of the
[charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R114 Feeds-into + the probe strategy (memory `charts-probe-data-layer`)._

## Plan

1. `chartType: 'gauge'` + optional literal `target: number` (contract / backend / FE + wire).
2. Reuse the scalar path (`aggregateScalar`, like stat); new lazy `GaugeView` (ECharts, shares the echarts
   chunk).
3. Builder: gauge option, no dimension, a `target` `InputNumber`.

## Do

### Built (2026-06-30, autopilot)

`gauge` wired end to end (enum across contract/backend/FE; new `target: float | None` on the backend
`Widget`, `number` in the contract). `GaugeView` (ECharts) is **lazy-loaded** alongside `HeatmapView`
(shared echarts chunk). Gauge reuses the stat scalar path; the builder adds a gauge option (no dimension) +
a `target` `InputNumber`; `draftToConfig` carries `target` only for a gauge. i18n
`chartGauge`/`target`/`targetHelp`/`ariaGauge` (en/vi).

**Data-layer demands captured** ([ledger R115](../brainstorms/2026-06-29-charts-probe-data-layer.md#r115--gauge-second-echarts-chart-)):
the ECharts seam holds for a **second chart family** (no model restructuring); and `target` is the **first
non-column config field** — widget config now mixes data-bindings with literal params, reinforcing the
declarative-field-schema meta-finding (and hinting a future "goals" dataset).

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **234** (232 + 2
gauge `draftToConfig` tests).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 234 passed |
| ECharts seam (2nd family) | ✅ no model restructuring |
| Data-layer demands captured | ✅ ledger R115 |

## Act

**Complete (2026-06-30, autopilot).** Gauge shipped (2nd ECharts chart). The chart palette now spans 9 kinds
across two libs behind one lib-agnostic seam. The config model has outgrown "all fields are column refs" —
`target` is the first literal — sharpening the declarative-config finding for R116.

## Feeds into → Round_116

R116 — **widget display options** (number format, axis/value labels): presentation-only config that is the
**`advancedOptions` seed** — exercises the "config beyond column-refs" direction the gauge `target` opened,
and tests whether structured props or a JSON overlay is the right home.
