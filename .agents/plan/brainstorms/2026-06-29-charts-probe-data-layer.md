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
| **Multiple measures** over one grouping | R112 combo | yes (`sumTwoMeasures`) | `GROUP BY dim → SUM(m1), SUM(m2)` — a multi-aggregate wide result; reinforces the aggregate-endpoint pull |
| **Raw row-level data** (no group-by) | R113 scatter | yes (`toScatterPoints`) | a THIRD consumed shape — raw rows; cap = a *biased sample*, pulling server-side **sampling** (`TABLESAMPLE`) or a higher row budget for row-level widgets |
| **Declarative widget-config** (meta) | R109–R113 builder | n/a | the hand-branched builder doesn't scale with chart variety → a per-chart field-schema and/or the `advancedOptions` JSON escape hatch (the config MODEL wants a declarative shape) |
| **Dense 2-D crosstab** (full x × y grid) | R114 heatmap | yes (`aggregateMatrix`) | strongest `GROUP BY (x, y)` / server-pivot pull — a full matrix over capped rows is both wrong and wasteful. Also PROVED the lib-agnostic seam (ECharts ⇄ recharts, no model change) |
| **Literal config (target/threshold)** | R115 gauge | n/a (not data) | first NON-column config field; widget config mixes data-bindings + params → typed field-schema (declarative); a future "goals" dataset could source targets |

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

### R112 — combo (bar + line, two measures) ✅

**Built:** `chartType: 'combo'` + optional `measureCol2`. Two measures summed per dimension
(`sumTwoMeasures`) → recharts `ComposedChart` (bar = measure 1, line = measure 2, dual Y-axis). Combo forces
sum (the agg select is hidden); the builder shows "Bar measure" + "Line measure".

**What it demanded of the data:**

1. **Multiple MEASURES over one grouping** (vs R111's multiple *series* of one measure). **Signal:** a query
   emitting `GROUP BY dim → SUM(m1), SUM(m2)` — a multi-aggregate wide result.
2. **Heterogeneous scales coexist** (a count vs a revenue total) → the chart needs two axes; the *data* just
   needs both aggregates, but it confirms the consumed shape is "one dimension key + N numeric aggregates",
   the same wide row a server GROUP-BY would yield. Reinforces (not adds to) the R110/R111 aggregate-endpoint
   pull.

### R113 — scatter (raw row-level points) ✅

**Built:** `chartType: 'scatter'` — `measureCol` (X) × `measureCol2` (Y), one point per row, **NO
aggregation** (`toScatterPoints`). recharts `ScatterChart`. First widget that does not roll up.

**What it demanded of the data:**

1. **Row-level data, not a group-by.** Every prior widget aggregated; scatter wants the raw rows. **Signal:**
   the data contract has a THIRD shape — *raw rows* (alongside *grouped rows* and *scalar*). A query that
   returns selected raw columns already serves this; no aggregate needed.
2. **The cap means a SAMPLE, not a partial aggregate.** Plotting the first N rows is a *biased sample*, not a
   truncated total. **Signal:** row-level widgets pull either a higher row budget or server-side **sampling**
   (`TABLESAMPLE` / `ORDER BY random() LIMIT n`) so the scatter is representative — a distinct data-layer
   need from the aggregate-endpoint one.

### META-finding (R109–R113) — the builder is the canary

As chart types grew (bar→line→stat→multi-series→combo→scatter), the **structured-props builder's branching
exploded** (cognitive complexity 21 at its peak; conditional dimension/series/measure/measure2/agg fields per
chart kind). **Signal:** a hand-branched form does not scale with chart variety. Two pulls converge:
(a) a **declarative field-schema per chart type** (data-driven form), and/or (b) the **`advancedOptions`
escape hatch** for the long tail (the R108 inspector's eventual editor) — exactly the ECharts-`option`
direction. The *config model*, not just the data, wants a more declarative shape.

### R114 — heatmap (FIRST ECharts chart, lazy-loaded) ✅

**Built:** `chartType: 'heatmap'` — a 2-D matrix (`dimensionCol` × `seriesCol` → sum/count via
`aggregateMatrix`) rendered by **ECharts** in a new `HeatmapView`, **lazy-loaded** (`React.lazy` +
`Suspense`) so the echarts bundle stays out of the base chunk. `echarts ^6.1.0` added.

**What it proved / demanded:**

1. **The R101 lib-agnostic seam HOLDS.** ECharts and recharts renderers now coexist behind `WidgetView`,
   chosen by `chartType`, with **no change to the widget model or the persisted shape** — exactly the seam
   R101 predicted. No plugin layer was needed; a `lazy()` renderer + the existing `chartType` discriminator
   sufficed. The data contract is unchanged by the lib swap → the model really is presentation-agnostic.
2. **The densest crosstab demand.** A heatmap fills an entire x × y grid; the FE builds the whole matrix
   client-side from capped rows. **Signal:** the strongest case yet for a **server `GROUP BY (x, y)` /
   pivot** — a full matrix over a capped fetch is both wrong (missing cells beyond the cap) and wasteful.
3. **Bundle cost is real.** echarts is ~1 MB; lazy-loading is mandatory, confirming R101's "ECharts added
   additively + lazy-loaded". A dashboard with no heatmap pays nothing.

### R115 — gauge (second ECharts chart) ✅

**Built:** `chartType: 'gauge'` — a scalar aggregate (reuses `aggregateScalar`, like stat) shown against a
literal `target`/max, rendered by a lazy `GaugeView` (ECharts, shares the echarts chunk with HeatmapView).

**What it demanded / proved:**

1. **The ECharts seam holds for a SECOND chart family** (recharts has no gauge) — added with no model
   restructuring, just a new lazy renderer + the `chartType` discriminator + reusing the scalar path.
   Confirms ECharts is the right home for "can't-do-in-recharts" charts.
2. **First NON-DATA config field.** `target` is a *literal number*, not a column reference — the widget
   config now mixes data-bindings (`*Col`) with presentation/params (`target`). **Signal:** reinforces the
   declarative-config meta-finding (the builder needs a typed field-schema, not just column pickers); and a
   minor data-layer hint — targets/goals may eventually want their own **"goals" dataset** rather than a
   hardcoded literal.
