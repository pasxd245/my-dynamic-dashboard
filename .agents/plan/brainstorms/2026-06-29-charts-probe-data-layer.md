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
| **Presentation options** (number format) | R116 | n/a (client-only) | a useful NEGATIVE: pure-display config has no data-layer pull and should stay client-side. For #1 it's a typed select; free-form JSON options belong to #2/#3 |
| **All raw columns + server paging** | R117 table | yes (client-paged over unpaged fetch) | confirms the raw-rows shape; TENSION with R107 — tables want server **pagination + sort + filter**, not the unpaged-capped fetch that suits aggregates. Different widgets → different fetch modes |

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

### R116 — per-widget number format (display-options seed) ✅

**Built:** `numberFormat: 'plain' | 'compact'` — a presentation-only option, applied to the headline-number
widgets (stat, gauge). Optional field across contract/backend/FE; builder gets a "Number format" select.

**What it demanded / showed:**

1. **Presentation config is its own axis.** `numberFormat` binds to no data — like `target` (R115) it's a
   display param. Two flat presentation fields now exist (`target`, `numberFormat`) → the **declarative
   display-options bag** the meta-finding predicted is materialising. **Decision implied:** for #1, this is a
   **typed select** (no raw JSON on the #1 path); a free-form `advancedOptions` JSON belongs to #2 (AI-
   authored) / #3 (power) — exactly the R108-inspector trajectory.
2. **No data-layer pull.** Formatting is purely client-side and *should* stay there — a useful negative
   result: not every widget option implies a data-layer change. Helps bound the synthesis.

### R117 — table (raw rows, paged; no chart) ✅

**Built:** `chartType: 'table'` — renders the raw (filtered) query rows in an AntD `Table`, client-paged. No
dimension/measure/agg (builder hides them). The rawest consumer: all columns, no transform.

**What it demanded of the data:**

1. **Confirms the raw-rows shape** (with R113 scatter) but for *all* columns — the table wants the query's
   columns + rows verbatim.
2. **Fetch-strategy TENSION with R107.** A table naturally wants **server-side paging** (page through the
   whole result, sorted/filtered server-side), whereas R107's `unpaged=true` (capped) fits *aggregates*.
   **Signal:** different widgets want different fetch modes — aggregates → a server aggregate (small result);
   tables → server **pagination + sort + filter** (the existing paged endpoint, extended). The one-size
   `unpaged` fetch is not right for every widget.
3. **Builder complexity peaked at 23** here (10 chart kinds) — the strongest evidence for the declarative
   field-schema refactor (the meta-finding).

---

## SYNTHESIS (R118) — what the data layer must produce

Nine widget kinds (bar, line, pie, stat, combo, scatter, heatmap, gauge, table) across recharts + ECharts,
each built against the **client-side-over-unpaged-rows** model (R107). The probe's verdict:

### Finding 1 — the dominant pull is a SERVER-SIDE AGGREGATE / GROUP-BY (the workflow feature)

Recurred in R110 (scalar totals), R111 (2-D pivot), R112 (multi-measure), R114 (dense crosstab). The
client-side roll-up is **correct only at small scale and WRONG for totals once the fetch is capped** (R110).
This is the #1 data-layer requirement and it maps exactly to the long-anticipated **workflow (YAML + Polars)
aggregate** feature ([[2026-06-26-product-value-framing]]): a query/transform that returns
**`GROUP BY (dims…) → aggregates`** server-side. Sub-capabilities the charts proved we need:

- **Time-bucketing** — `date_trunc(col, month|week|day)` before grouping (R109; the first concrete workflow op).
- **Multi-dimension group-by** — `GROUP BY (dim, series)` (R111) and the full `(x, y)` matrix (R114).
- **Multi-aggregate** — `SUM(m1), SUM(m2), COUNT(*)` in one result (R112).
- **TOP-N + "other"** bucketing for cardinality (R111).
- **Typed columns preserved** — real `date`/`datetime` dtypes survive joins/transforms, ISO-sortable (R109).

### Finding 2 — three consumed data SHAPES; fetch mode differs by widget

| Shape | Widgets | Right fetch |
| --- | --- | --- |
| Aggregated result (grouped rows / matrix) | bar, line, pie, combo, multi-bar, heatmap | a **server aggregate** (small result; no cap problem) |
| Scalar | stat, gauge | a server **single-value aggregate** |
| Raw rows | scatter, table | scatter → **sampling**; table → **server pagination + sort + filter** |

R107's one-size `unpaged=true` (capped) fetch is right for *none* of these at scale — it's a small-data
stopgap. The data layer should let a widget **bind to the fetch its shape needs**.

### Finding 3 — config model & presentation (NOT data-layer)

The widget model grew cleanly (the R101 lib-agnostic seam held — ECharts dropped in beside recharts with
**zero contract change**, R114). But the **builder's hand-branching hit cognitive-complexity 23** across 10
kinds, and config gained **non-data params** (`target` R115, `numberFormat` R116). Pulls (presentation, not
data): a **declarative per-chart field-schema**, a **typed display-options bag** for #1, and a free-form
`advancedOptions` JSON reserved for **#2 (AI-authored) / #3 (power)** — the R108-inspector trajectory.
Presentation config has **no** data-layer pull (R116) → keep it client-side.

### Recommended next theme

**Build the workflow (YAML + Polars) aggregate feature** — it is the demand-proven, dominant pull, and the
charts are now ready consumers (a widget would bind to an aggregate workflow instead of rolling up rows
client-side). Sequence: aggregate-query/workflow first → then per-widget fetch-mode binding → then the
(separate, presentation-only) widget-config refactor. Datasets need no change beyond preserving typed
columns; **queries/workflows are where the work is.**
