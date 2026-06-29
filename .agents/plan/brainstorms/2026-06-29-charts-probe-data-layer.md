# Charts as a probe for the data layer — running ledger

> **Strategy (human, 2026-06-29):** for the next ~10 rounds, deliberately zoom in on widgets & charts
> (recharts AND echarts) as a **demand-pull probe**: build the consumer hard to discover the producer's
> contract. What each chart *demands* tells us what the **data layer** (datasets / queries / workflows) must
> *produce*. This doc is the real deliverable — the charts are the vehicle. See memory
> `charts-probe-data-layer`. Synthesized in the closing round.

## How to read this

Each round appends an entry: **the widget built → the data shape it needed → what that implies for
datasets / queries / workflows.** "Client-side" = we computed it in JS over the unpaged row fetch (R107);
a recurring client-side computation is a candidate to **push down** into a query/workflow later.

## Standing facts (the seam we're probing against)

- Widgets render in **one React app**; presentation = recharts/echarts; data arrives as a query's **rows**
  (`GET /queries/{id}/rows?unpaged=true`, capped) + the query's **columns** (with `dtype`).
- All aggregation today is **client-side** over those rows (`aggregate.ts`: `sumByGroup` / `countByGroup`,
  single dim × single measure). **No aggregation/pivot endpoint exists.**
- The widget model is **lib-agnostic + formula-free** (`chartType`, `dimensionCol`, `measureCol`, `agg`,
  `span`). Keep it that way; the model is what teaches the data contract.

## Open data-layer hypotheses (filled in as rounds land)

| Demand surfaced | By which chart/round | Client-side today? | Implies for data layer |
| --- | --- | --- | --- |
| Sortable **typed temporal** column on the x-axis | R109 line | yes (`Date.parse` per render) | queries/datasets must expose a real date/datetime dtype (not just string); ordering should be stable |
| **Time-bucketing** ("by month/week") | R109 line | not done (user must pre-shape) | a **workflow/query `date_trunc` + GROUP BY**; the FE can't bucket a raw timestamp into months without a transform |

---

## Round log

### R109 — line / time-series ✅

**Built:** `chartType: 'line'` (recharts `LineChart`), ordered by the dimension via `sortByDimension`
(date/datetime → chronological `Date.parse`, else lexical) instead of `sortDesc`-by-value.

**What it demanded of the data:**

1. **A typed, sortable temporal column.** The chart can only order a time axis if it can recognise dates.
   Today rows arrive as *stringified* cells; we lean on the column's `dtype` (`date`/`datetime`) to decide
   to parse. **Signal:** the data layer should preserve/expose real temporal dtypes through queries (a join
   or workflow must not flatten a date to an opaque string), and ideally emit ISO-sortable values.
2. **Time-bucketing is a data-layer job, not a chart job.** "Revenue by month" over a raw timestamp needs
   the timestamp grouped into months *before* it reaches the widget. The FE can fake low-cardinality cases
   (string-prefix `YYYY-MM`) but that's brittle. **Signal → first concrete workflow/query feature:** a
   `date_trunc(col, month|week|day) + GROUP BY` transform. This is the strongest data-layer pull so far.
3. **Aggregation is still single dim × single measure.** A line is one series; multi-series (a line per
   category) needs a second grouping → deferred to R111 (`seriesCol`). Noted, not built.
