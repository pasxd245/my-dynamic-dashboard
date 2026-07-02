# Round 140: Aggregate functions — avg · min · max · count_distinct

**Status**: Review
**Date started**: 2026-07-02
**Date completed**:
**Flow**: **DCFBI — full thin slice** (D: queries design doc updated first · C: enum ×3 · B: engine ·
F: StepsEditor options + MSW mirror · I: i18n). UI delta = four dropdown options; no F1 discovery.

## Goal

**Inherits from ← the [step-model brainstorm](../brainstorms/2026-07-01-step-model-extensibility.md)
roadmap ①** — the cheapest high-value step extension: widen the aggregate measure vocabulary from
`sum | count` to **`sum · count · avg · min · max · count_distinct`**. A closed-vocabulary enum
extension end-to-end; no new step kind, no fork decision needed (that's roadmap ②).

_Track: 1. Pulled by ← the human's R139 ask ("add more steps … popular aggregate functions") +
the brainstorm's value/cost table (everyday rollups). D-gate first per
[[d-gate-artifact-in-design-corpus]] — the queries design doc's step section specs the vocabulary
before code._

## Plan

- [x] **D**: [queries.md](../../design/data-management/queries/queries.md) §Transform steps — the
      R140 measure vocabulary, per-agg col rules, output dtypes/naming, NULL semantics.
- [x] **C**: `query.yaml` agg enum ×2 (AggregateStep + AggregateRequest) + col-rule descriptions;
      `aggregate.contract.yaml` 200-response dtype prose. (Workflow steps `$ref` the union — free.)
- [x] **B**: `AggregateMeasure.agg` Literal · `_validate_measure` per-agg rules (`sum`/`avg` numeric;
      `min`/`max` orderable = numeric|date|datetime; `count_distinct` any; `count` col-free) ·
      `_aggregate_output_columns` dtypes (`avg`→float, `count_distinct`→integer, `min`/`max` keep) ·
      `build_aggregate_select` SQL (AVG/MIN/MAX/COUNT DISTINCT).
- [x] **F**: FE `AggregateMeasure` union · `steps.ts` output mirror + `isOrderableCol` ·
      `AggregateBody` six-option select with per-agg column pools (keep col when still valid) ·
      MSW `computeAggregate` mirror (values + dtypes).
- [x] **I**: i18n en/vi labels (avgOf/minOf/maxOf/countDistinct).
- [x] Tests: endpoint avg/min/max/count_distinct + min-on-date + three new 422s; one saved-step avg
      run (resolvedColumns float).

## Risks / unknowns

- **NULL semantics diverge by agg, deliberately** — `sum`/`avg` coalesce an all-NULL group to `0`
  (existing client `toNum` parity); `min`/`max` return honest `NULL` (a date can't default to 0);
  `count_distinct` is never NULL. Specced in the design doc.
- **Output naming unchanged** — `count` → `count`; every other measure keeps its col's name (so
  `count_distinct(product)` outputs an integer column named `product`; rename lands with the
  select/rename step, roadmap ③).
- **Dashboard widgets untouched** (scope brake) — the widget `Agg` union stays `sum|count`; the
  contract is now wider, widgets can adopt later on their own pull.

## Do

**Built:** the measure vocabulary, one seam per layer: contract enums, the model Literal, per-agg
validation (`_NUMERIC_AGGS` / `_ORDERABLE_DTYPES`), output-column dtypes, the SQL expr map, the FE
type/threading/editor (per-agg column pools), the MSW mock mirror, en/vi labels. Both the R119
`/aggregate` endpoint and the R120 saved-step path gain all four functions (shared validators), and
workflows inherit them via the same `Step` union — zero workflow-side changes.

**Verification:** backend `pytest` **295 pass** (8 new: avg-by-group float · min/max keep dtype ·
count_distinct integer · min-on-date · 3 new 422 specs · avg saved-step run) · `ruff` clean · FE
`tsc` clean · FE vitest **253 pass** (contract enums dereference; mock mirror consistent).

## Check

- [x] Backend 295 (8 new); ruff clean; no regression.
- [x] All four functions work at the endpoint AND the saved-step path; dtype/naming per spec.
- [x] FE editor offers six measures with correct per-agg column pools; tsc + vitest green.
- [ ] Optional human eyeball (UI delta = a dropdown; DCFBI F confirms, no hard F2 gate).

## Act

**Learnings:**

- **The closed-vocabulary claim held under its first test** — extending the enum touched exactly the
  predicted seams (contract → Literal → validate → output-cols → SQL → FE mirror), no structural
  change anywhere. Evidence for the brainstorm's "already extensible by construction."
- **The orderable/numeric split earns its two error codes** — `measure_not_numeric` vs
  `measure_not_orderable` keeps the 422 message aligned with what the user actually did wrong.

**Promotions:** none — executes brainstorm roadmap ①.

**Prune check:** nothing pruned.

## Feeds into → Round_141

Roadmap ② next when pulled: **lock fork (B)** — the `compute` step + closed function catalog
(namespaced ids · self-describing registry · executor slot · trust tier) — then `date_trunc` as its
first entry. Alternatively ③ (sort + select/rename) or the value-out deliverable.
