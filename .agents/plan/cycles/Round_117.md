# Round 117: table widget (raw rows, paged)

**Status**: **Complete** (2026-06-30, autopilot) — all gates green
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: DCFBI-with-Contract (chartType `table`). Charts→data-layer probe arc, step 9 (final build).

## Goal

**Inherits ← [Round_116](Round_116.md).** Add a **table** widget — the raw query rows in a paged table, no
chart, no aggregation — the last distinct consumed shape on the presentation side. Closes the probe before
the synthesis. Part of the [charts→data-layer arc](../brainstorms/2026-06-29-charts-probe-data-layer.md).

_Track: 1. Pulled by ← R116 Feeds-into + the probe strategy (memory `charts-probe-data-layer`)._

## Plan

1. `chartType: 'table'` (contract / backend / FE).
2. `TableView` (AntD `Table`, client-paged) over the filtered rows + columns; no new aggregate.
3. Builder: table option; hide dimension/series/measure/agg (table needs only query + title).

## Do

### Built (2026-06-30, autopilot)

`table` wired end to end (enum across contract/backend/FE). `TableView` renders the filtered rows + the
query's columns in an AntD `Table` (client-paged, horizontal scroll). The hook exposes `tableData`
(`{columns, rows}`); the builder hides all data-shaping fields for a table (`isTable` → no
dimension/series/measure/agg, `measureOk = true`), and `draftToConfig` omits dimension/measure so a stale
value isn't saved. i18n `chartTable`/`ariaTable` (en/vi).

**Data-layer demands captured** ([ledger R117](../brainstorms/2026-06-29-charts-probe-data-layer.md#r117--table-raw-rows-paged-no-chart-)):
confirms the raw-rows shape (all columns); and surfaces a **fetch-strategy tension with R107** — a table
wants server **pagination + sort + filter**, not the `unpaged=true` capped fetch that suits aggregates.
Different widgets want different fetch modes. The builder's cognitive complexity peaked at **23** (10 chart
kinds) — the strongest evidence for the declarative field-schema refactor.

**Verification:** contract 29 · backend 225 · ruff clean · FE typecheck clean · FE suite **236** (235 + 1
table `draftToConfig` test).

## Check

| Item | Result |
| --- | --- |
| Contract | 29 passed |
| Backend | 225 passed · ruff clean |
| FE typecheck | clean |
| FE suite | 236 passed |
| Data-layer demands captured | ✅ ledger R117 |

## Act

**Complete (2026-06-30, autopilot).** Table shipped — the probe's build phase is done: **10 widget kinds**
(bar, line, pie, stat, combo, scatter, heatmap, gauge, table) across recharts + ECharts behind one
lib-agnostic seam, each logged against its data-layer demand. Ready for synthesis.

## Feeds into → Round_118

R118 — **synthesis**: distill the ledger into a prioritized data-layer (datasets / queries / workflows)
requirements brief — the real deliverable of the arc — and recommend the next theme.
