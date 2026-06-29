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
| **Scalar aggregate** (one number, no dimension) | R110 stat | yes (`aggregateScalar`) | the widget model isn't always a *breakdown*; made `dimensionCol` optional. A KPI is "measure-only" — a query that returns a single value would serve it directly |
| **Correct totals require the WHOLE result** | R110 stat | yes — but **wrong when capped** | sharpest server-side-aggregate pull: a `SUM` over the first N rows is *incorrect*, not merely partial. Strongly pulls a query/workflow `SUM()`/`COUNT()` (an **aggregate endpoint**) so totals don't depend on the fetch cap |
| **2-D grouping** (dimension × series) | R111 multi-bar | yes (`aggregateByGroupSeries` — a client PIVOT) | `GROUP BY (dim, series)` server-side / a **pivot/crosstab workflow**; wide-result query shape; eventual TOP-N + "other" bucketing for cardinality |

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

### R110 — KPI / stat (single number) ✅

**Built:** `chartType: 'stat'` — a single aggregate over the whole result (sum of a measure, or row count),
rendered with AntD `Statistic`. No dimension: `dimensionCol` made **optional** across contract / backend
model / FE types / wire.

**What it demanded of the data:**

1. **Not every widget is a breakdown.** Bar/pie/line are "dimension × measure"; a KPI is "measure only".
   The model carried a *required* `dimensionCol`, which the KPI exposed as an over-assumption →
   `dimensionCol` is now optional. **Signal:** the data contract a widget consumes has (at least) two
   shapes — *grouped rows* and *a scalar*.
2. **The cap bites hardest here.** A line/bar over capped rows is a partial *picture*; a KPI total over
   capped rows is an *incorrect number*. The FE genuinely cannot compute "total revenue" from a truncated
   fetch. **Signal (strongest server-side pull so far):** KPIs want a real **aggregate query/endpoint**
   (`SUM`/`COUNT` server-side) so the value is correct regardless of the row cap. This is the first demand
   the client-side-over-unpaged-rows model *cannot* satisfy correctly.

### R111 — multi-series grouped bar ✅

**Built:** optional `seriesCol` (a "split by" second grouping). On a `bar` widget it triggers a 2-D roll-up
(`aggregateByGroupSeries`) → grouped bars (one bar per series value per dimension group). New optional field
across contract / backend / FE types.

**What it demanded of the data:**

1. **A second GROUP BY dimension.** Single dim × measure was the model's spine; a real chart need (revenue by
   quarter, split by region) is **2-D**. **Signal:** the aggregate the data layer should expose is
   `GROUP BY (dimension, series)`, not just one key.
2. **The client is doing a PIVOT** (long rows → wide series columns) every render — `aggregateByGroupSeries`
   is a crosstab. **Signal:** this is the same shape a **pivot/crosstab workflow** or a wide-result query
   would produce server-side; re-pivoting the full (capped) row set in the browser is the brittle stopgap.
3. **Cardinality risk compounds.** dim × series can explode the distinct-key count and the legend; a
   server-side TOP-N / "other" bucket is a likely future data-layer need.
