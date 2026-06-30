# Round 127: workflows — widgets render a pre-shaped query directly

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — FE; resolves the "two aggregate paths" R120 flagged.

## Goal

**Inherits from ← [Round_126](Round_126.md)** — a chart widget (bar/pie/line/stat) bound to a
**pre-shaped** query (one that already aggregates via transform steps) must NOT re-aggregate it.
This round makes such a widget **render the query's shaped rows directly** (the consolidation of the
R119 `/aggregate` path with the R120–123 saved shaping).

_Track: 1. Pulled by ← the usability arc. Closes the R120 "two aggregate paths" note: a `count`
re-aggregated over already-grouped rows would be WRONG; a `sum` redundant. Now neither happens._

## Plan

- [ ] Detect pre-shaped from the bound query's `definition.steps` (cheap cached `useQueryQuery`).
- [ ] When pre-shaped + an aggregating kind: gate OFF `/aggregate`, fetch the shaped `/rows`
      (`useWidgetData`), and map `dimensionCol`/`measureCol` columns to chart data DIRECTLY (no
      grouping); stat → the shaped scalar.
- [ ] renderHook test: a bar over a pre-shaped query → chart data from the shaped rows, not re-agg.

## Risks / unknowns

- **Detection circularity** — preShaped needs the query's definition, but the aggregating path skips
  the rows fetch (R119). Resolved by the cheap, cached `useQueryQuery` (metadata, no rows) +
  `boundQuery.isLoading` gating the widget's loading so there's no empty flash.
- **Transient double-fetch** — until `useQueryQuery` resolves, a pre-shaped widget briefly treats
  itself as non-shaped (`/aggregate`), then switches to `/rows`. Correct (idempotent for sum); the
  loading gate hides it. A later optimization can dedupe the query fetch.

## Do

**Built:** `useWidgetChartData` — `useQueryQuery(widget.queryId)` → `preShaped`; `aggregateEnabled`
now `&& !preShaped`; a new `directShaped` branch maps the shaped rows to chart data (measure = the
named `measureCol`, else the shaped `count` column, else the last column); `boundQuery.isLoading`
ORed into the widget's loading. **Opt-in: a stepless query (every existing one) is unchanged**
(`preShaped` false → the R119 path verbatim).

**Verification:** FE `tsc` clean · `vitest` **249 pass** (1 new in `widget-preshaped.test.tsx`: a bar
over a pre-shaped query renders the shaped rows directly, ordered desc) · the R119 aggregate-widget
tests still green (non-shaped path unchanged) · no regression · `prettier` clean.

## Check

- [x] FE `tsc` + `vitest` green (249; 1 new); no regression.
- [x] A pre-shaped query's widget renders shaped rows directly (no `/aggregate`); stepless unchanged.

## Act

**Learnings:**

- **The "two aggregate paths" resolved cleanly** because R126 made the mock steps-aware (testable) and
  the cached `useQueryQuery` gave a cheap pre-shaped signal without undoing R119's fetch-skip.
- **The shaping now lives in ONE place per query** — a widget either asks the server to aggregate
  (raw query) OR renders a query that already shaped itself. No double aggregation.

**Promotions:** none.

**Prune check:** nothing pruned (both paths still earn their place: `/aggregate` for raw queries,
direct-render for pre-shaped).

## Feeds into → Round_128 (TBD)

A pre-shaped query renders correctly on a dashboard → R128 seeds a demo (a stepped query + a widget
over it) so the end-to-end workflow value is visible without hand-building.
