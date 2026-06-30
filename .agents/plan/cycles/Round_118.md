# Round 118: synthesis — what the charts probe revealed about the data layer

**Status**: **Complete** (2026-06-30, autopilot) — synthesis round (no code)
**Date started**: 2026-06-30
**Date completed**: 2026-06-30
**Flow**: Synthesis / docs (not a feature round) — distills the [probe ledger](../brainstorms/2026-06-29-charts-probe-data-layer.md).

## Goal

**Inherits ← [Round_117](Round_117.md).** Close the charts→data-layer arc (R109–R117) by distilling the
running ledger into a **prioritized data-layer (datasets / queries / workflows) requirements brief** and a
recommended next theme — the real deliverable of the strategy (memory `charts-probe-data-layer`).

_Track: 1. Pulled by ← the probe strategy's closing step (human, 2026-06-29)._

## Plan

1. Distil the 11 ledger findings into the few that matter.
2. Write the synthesis into the ledger (the durable artifact).
3. Update the `charts-probe-data-layer` memory with the conclusion. Recommend the next theme.

## Do

### Synthesis written (2026-06-30) — see ledger §SYNTHESIS

Built **10 widget kinds** across recharts + ECharts as a demand-pull probe. The
[ledger §SYNTHESIS](../brainstorms/2026-06-29-charts-probe-data-layer.md#synthesis-r118--what-the-data-layer-must-produce)
distils three findings:

1. **Dominant pull = a server-side AGGREGATE / GROUP-BY** (the workflow feature). Client-side roll-up over a
   capped fetch is correct only at small scale and **wrong for totals** (R110). Maps to the long-anticipated
   **workflow (YAML + Polars)** feature: `GROUP BY (dims) → aggregates`, with time-bucketing (`date_trunc`,
   R109), multi-dimension (R111/R114), multi-aggregate (R112), TOP-N (R111), typed columns preserved (R109).
2. **Three consumed shapes, different fetch modes** — aggregated result / scalar / raw rows. R107's
   one-size `unpaged` fetch suits none at scale; a widget should bind to the fetch its shape needs
   (aggregate · single-value · sampling · server pagination+sort+filter).
3. **Config/presentation (not data-layer)** — the R101 lib-agnostic seam held (ECharts added with zero
   contract change); but the builder hit cognitive-complexity 23 and config gained non-data params → a
   declarative field-schema + a typed display-options bag for #1, free-form JSON for #2/#3. Presentation has
   no data-layer pull.

**Recommended next theme:** build the **workflow (YAML + Polars) aggregate** feature — the demand-proven,
dominant pull; the charts are now ready consumers. Then per-widget fetch-mode binding; then the
(presentation-only) widget-config refactor.

## Check

| Item | Result |
| --- | --- |
| Ledger synthesis written | ✅ §SYNTHESIS |
| Memory updated with conclusion | ✅ `charts-probe-data-layer` |
| Arc gates (R109–R117) | all green (contract 29 · backend 225 · FE 236) |
| Next theme recommended | ✅ workflow (YAML + Polars) aggregate |

## Act

**Arc complete (R109–R118).** The "charts as a probe" strategy delivered its real output: a clear,
evidence-backed data-layer requirements brief. The headline — **a server-side aggregate/pivot (the workflow
feature) is the dominant, demand-proven pull** — and the charts are built consumers waiting for it. Awaiting
the human's review of the synthesis + decision on the next theme.

## Feeds into → Round_119

_(pending human decision — recommended: the workflow (YAML + Polars) aggregate feature.)_
