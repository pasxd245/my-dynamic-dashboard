# Round 116: per-widget number format (display-options seed)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (optional `numberFormat`). Charts→data-layer probe arc, step 8.

## Goal

**Inherits ← [Round_115](Round_115.md).** Add the first **presentation-only** widget option — a per-widget
**number format** (`plain`/`compact`) — as the `advancedOptions` seed: exercise "config beyond column refs"
and test whether structured props or a JSON overlay is the right home. Part of the
[charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R115 Feeds-into (the `target` literal opened non-data config) + the probe strategy._

## Plan

1. `numberFormat: 'plain' | 'compact'` (optional) across contract / backend / FE + wire.
2. Apply to the headline-number widgets (stat, gauge); builder gets a "Number format" select.
3. Capture whether this implies any data-layer change (hypothesis: no — pure presentation).

## Do

### Built (2026-06-30, autopilot)

`numberFormat` wired end to end (enum across contract/backend/FE). Applied to `StatView` (Statistic
formatter) and `GaugeView` (a `compact` prop). Builder gains a "Number format" select; `draftToConfig`
carries it only when non-default. i18n `numberFormat`/`fmtPlain`/`fmtCompact` (en/vi).

**Data-layer demands captured** ([ledger R116](../brainstorms/2026-06-29-charts-probe-data-layer.md#r116--per-widget-number-format-display-options-seed-)):
a useful **negative** — pure presentation config has **no** data-layer pull and should stay client-side
(bounds the synthesis). And it confirms the config direction: `target` (R115) + `numberFormat` (R116) are
two presentation fields → a **typed display-options bag** for #1 (no raw JSON on the #1 path; free-form
`advancedOptions` JSON is a #2/#3 affordance — the R108-inspector trajectory).

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **235** (234 + 1
`numberFormat` `draftToConfig` test).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 235 passed |
| Data-layer demands captured | ✅ ledger R116 (a negative) |

## Act

**Complete (2026-06-30, autopilot).** First display-only option shipped (scoped to the headline-number
widgets; the same `fmt` threading would extend to chart tooltips/axes). Confirms presentation config is its
own axis with no data-layer pull — a clean boundary for the synthesis.

## Feeds into → Round_117

R117 — a **table** widget: render the raw rows as a paged table (no chart). The last distinct consumed
shape on the presentation side; closes the probe before the synthesis.
