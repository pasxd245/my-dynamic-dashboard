# Round 112: combo chart (bar + line, two measures)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (chartType `combo` + optional `measureCol2`). Charts→data-layer probe arc, step 4.

## Goal

**Inherits ← [Round_111](Round_111.md).** Add a **combo** chart (bar + line, two summed measures on one
dimension) — probes the multiple-MEASURES data shape (vs R111's multiple-series). Part of the
[charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R111 Feeds-into + the probe strategy (memory `charts-probe-data-layer`)._

## Plan

1. `chartType: 'combo'` + optional `measureCol2` (contract / backend / FE types + wire).
2. `sumTwoMeasures` (two summed measures per dimension); `ComboView` (recharts `ComposedChart`, dual Y-axis,
   bar = measure 1, line = measure 2).
3. Builder: combo option, "Bar measure" + "Line measure" pickers, agg hidden for combo (forces sum);
   `canSubmit` needs both measures.

## Do

### Built (2026-06-30, autopilot)

`combo` wired end to end — enum + `measureCol2` optional across contract/backend/FE; the hook computes
`comboData` (via `sumTwoMeasures`) for a combo with both measures, and `WidgetView` renders `ComboView`.
Builder: combo chart option, two measure pickers (Bar/Line), agg select hidden for combo (it forces sum),
`measureOk` requires both. i18n `chartCombo`/`measureBar`/`measureLine`/`ariaCombo` (en/vi).

**Data-layer demands captured** ([ledger R112](../brainstorms/2026-06-29-charts-probe-data-layer.md#r112--combo-bar--line-two-measures-)):
the consumed shape is "one dimension key + N numeric aggregates" — `GROUP BY dim → SUM(m1), SUM(m2)`, a
multi-aggregate wide result. Reinforces the R110/R111 server-aggregate pull.

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **229** (228 + 1
`sumTwoMeasures`).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 229 passed |
| Data-layer demands captured | ✅ ledger R112 |

## Act

**Complete (2026-06-30, autopilot).** Combo shipped; confirms the "dimension + N aggregates" wide-result
shape the server GROUP-BY would emit. The recharts side of the arc now covers bar / line / pie / stat /
combo / multi-series — a solid base before the ECharts spike.

## Feeds into → Round_113

R113 — **scatter** (two numeric measures, row-level, NO aggregation): probes the *raw-rows* data shape —
the first widget that does **not** roll up, demanding row-level access (and exposing the cap differently).
