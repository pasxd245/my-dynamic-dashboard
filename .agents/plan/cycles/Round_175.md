# Round 175: the weekly-report dogfood — can MDD replace the CRM-funnel Excel?

**Status**: Review — agent pass done on the real 30/09 export; the human's review of the branch is OPEN.
**Flow**: probe + fix — walk the real report, rank what blocks it, close the blockers in-round.
**Date started**: 2026-10-04
**Date completed**: —

## Goal

**Pulled by ←** the product's own purpose (README: _"Replaces a broken CRM → Excel reporting
workflow"_) and a concrete pull: the Digiin weekly report (`bao_cao_tuan/`), whose four Excel
workbooks were reverse-engineered on 2026-10-03 (`ai_analysis/01_bao_cao_tuan_patterns_workflow.md`,
verified against the hand-made `phân tích` sheet for 01–06/2026).

**Question**: can the CRM **lead funnel** — Excel's 8 helper columns + the pivot filter + the KPI
ratios + "this month vs the same period last month" — be built as MDD saved queries and one
dashboard, matching the hand-made numbers, with no logic outside MDD?

_Track: 1 (product). Pulled by: a named product gap (the weekly report) — per the Evolution Rule._

## Plan

**Expected outcome**: every lead-funnel KPI from the report reproduced by saved queries on the raw
CRM export + the policy workbook, number-for-number; every blocker either fixed here or recorded.

**Falsified if**: the funnel can be expressed with the existing steps. Then MDD already serves the
report and the round collapses into a pack of saved queries.

### Explicitly NOT in this round

- ~~Policy / Renewal / YTD flows~~ — pulled into this round after the funnel closed (owner:
  "làm tương tự cho các loại còn lại"); see _Do — part 2_.
- An `in`-list operator — the funnel uses one `case` branch per value instead (see Act).
- Workflow output as a dashboard source (R174 W-1 stays open).

## Do

The walk, on the real 30/09 export (31,584 leads) + `Report-Policy.xlsx` (5,048 contracts):

| # | Blocker met on the walk | Severity | Fix in this round |
|---|---|---|---|
| G1 | One whitespace-only cell (`" "`) in 31k rows aborted the datetime override with `coercion_failed` | blocker | Whitespace-only text reads as NULL for typed targets; `string` keeps it verbatim |
| G2 | No formula-free IF/IFS: buckets (`Cỡ xe`), 0/1 flags for conditional counts, a date fallback | blocker | New `case` step (first matching branch wins; filter vocabulary in `when`; unified dtype) |
| G3 | "This month / last month" needed a hard-coded date; vehicle age needed the year | blocker | New `date_part` and `date_diff` steps + `group_column` with `by: []` (the export's cut-off on every row) |
| G4 | The funnel needs ~20 steps in ONE query; cap was 8, and a query cannot read a query (R167) | blocker | `_MAX_STEPS` 8 → 24 |
| G5 | `starts_with "web_"` matched `webXtra` — `_` was a LIKE wildcard | correctness bug | LIKE operands are escaped (literal match) |
| G6 | The builder edited only `measures[0]` / `predicates[0]` — opening an API-saved query and touching it dropped the rest | data loss in UI | Aggregate and filter cards edit every measure / predicate |
| G7 | Ratios showed as `0.07945736434108527` | presentation | Dashboard `numberFormat: percent`; table cells format by dtype |
| G8 | A combo over months was ordered by bar height | presentation | Combo orders a date dimension chronologically |
| G9 | Widgets on stepped queries fired a server aggregate (422) before the bound query loaded | console noise | Wait for the bound query before choosing the path |

### Do — part 2: Cấp đơn (Policy + TNDS), Tái tục (Renewal + BGTT), Lead YTD

Same walk on `Report-Policy.xlsx` (Data + TNDS), `Renewal_ Tổng hợp Final.xlsx` (3,319 rows +
BGTT 1,544) and `YTD 2025 to 2026 - Data Count.xlsx` (84,644 leads):

| # | Blocker met on the walk | Severity | Fix in this round |
|---|---|---|---|
| G10 | Phone numbers stored as text (`0982…`) were inferred as integers, losing the leading zero — the TNDS cross-sell join matched 2 rows instead of 484 | correctness bug | Digit text with a leading zero stays `string` at inference and under a `string` override |
| G11 | `numberFormat: percent` on a table formatted every float — averages and fees too | presentation | A percent table formats only ratio columns (all values in [-1, 1]) |
| G12 | Series of 6 call statuses / 15 failure reasons repeated colours: the palette had four distinct hues (`colorInfo` = `colorPrimary`) | presentation | Palette extended with the AntD preset hues to twelve, de-duplicated |

## Check

- **Numbers**: the saved query _Lead funnel – theo tháng_ matches `ai_analysis/tools/weekly_funnel.py`
  for every month 01–09/2026 (UL, Đã gọi, QL, Thành công, Digiin, Organic, CR1, CR2); 01–06 are the
  hand-made `phân tích` values. _Lũy kế vs cùng kỳ_ matches the KPI sheet (3,926 / 1,548 / 123 / 79
  vs 3,379 / 1,702 / 157 / 93). Months 07–09 differ from the stale Excel by design: MDD joins the
  current policy file, the workbook still carries a pasted-value `new hay ko` (148 renewals unflagged).
- **Tests**: backend 463 passed (+18 in `test_case_and_date_steps.py`, +1 whitespace, group_column
  whole-table); builder 384 passed + `tests/steps-r175.test.tsx` (9); contracts 40 passed; builder
  production build OK. The one failing builder test (`datasets.test.tsx` R171 reset-all) fails
  identically on the untouched branch — a timeout in a slow sandbox, not this round.
- **Numbers, part 2**: _Cấp đơn – theo tháng × luồng_ matches sheet `Total pv` (e.g. 09/2026:
  189 + 55 = 244 HĐ, 1,473,887,799đ, 53.5% of the 456 target); New / Có / Không, insurer of the month,
  `Gói Cơ bản` share and the TNDS cross-sell (68/48/62/52/43/50/59/53) match. _Tái tục – theo tháng
  hết hạn_ matches `ReportN` PRP/RP for 01–09/2026 except one contract counted in 09 instead of 04:
  the workbook holds a real date 2026-09-04 where the text column says `04/2026` (a dd/mm swap made
  by Excel) — surfaced by the pack's data-quality query, not hidden. Failure reasons match sheet
  `fail` for 01–08 (09 and later: the pivot cache is stale). _Lead YTD_ month totals and the
  service × month split match the data; the last-two-months service table matches sheet `Pivot`
  (981 / 867 / 757 / 609 / 268 …). Working days come from a calendar dataset joined by date.
- **Acceptance walk** — `coverage: agent pass only`. The dashboard was rendered in the builder
  against the real data and screenshot-checked; the human pass is the review of this branch.

## Act

- **Lesson**: the report did not need a new noun — it needed IF, a calendar difference and a higher
  ceiling. Every Excel helper column in the funnel maps to one formula-free step.
- **Lesson, part 2**: the other three flows needed no new step — only three ingest/presentation
  fixes. Hand-maintained helpers (`Tháng hết hạn`, working days, `Renew`) become either a
  cross-check query or a small reference dataset joined by key.
- **Recorded, not fixed**: no text `trim` step — CS names `Ly` / `Ly` count as two people in the
  renewal table (fix belongs in the source, or a `trim` step in a later round). A `case` over a
  date-typed `when` cannot compare two columns, so "same day last year" goes through `date_part` +
  `derive`; a column-vs-column predicate would shorten it.
- **Recorded, not fixed**: an `in` / `not in` list operator would turn 7-branch `case` steps into one
  predicate (the pivot filter is literally a checklist) — it touches the source-filter URL grammar,
  so it is its own round. A chart widget draws a stepped query's rows as-is (R127), so chart queries
  must be shaped to the chart's grain.

## Feeds into → Round_176 (TBD)

The `in`-list operator and a `trim` step, or workflow output as a dashboard source (R174 W-1) —
the human's call at review.

## Governance

Contract-first: `_shared/query.yaml` (CaseStep, DatePartStep, DateDiffStep, GroupColumnStep `by`,
step ceiling), `_shared/workflow.yaml` (union widened), `_shared/dashboard.yaml` (`percent`).
