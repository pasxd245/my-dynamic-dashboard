# Round 181: table totals — `Widget.totals`, summed by the server over the whole result

**Status**: Review — C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W3) and sign-off
**Flow**: DCFBI — one widget field + one read endpoint, contract-first, verified on a stepped query in a real browser.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — `Widget.totals` (`table` only): per result column `sum` (Σ) or `ratio` (Σ`num` / Σ`den`).
`POST /queries/{id}/totals` sums numeric columns in DuckDB over the query's **whole** result —
the post-step relation when the query has transform steps, which `/aggregate` cannot see — under
the active dashboard filters, with no row cap; the client derives ratios from the sums. The table
widget shows a bold footer row; the builder gets a per-column Totals editor (None / Sum / Ratio
with numerator / denominator). In passing: editing a table (or stat / gauge / scatter / note)
widget no longer resets it to a bar chart when the query's columns load. Backend 526 · builder
425 · contracts 44.

**Studied** _(predicted → saw → now believe)_ — **predicted** the existing `/aggregate` endpoint
(no dimensions, one `sum` per column) would do. **Saw** that it aggregates the _base_ relation, so a
table over a stepped query — the common dogfood shape — would total the wrong rows or 422 on a
post-step column. **Now believe (high confidence — tested on an aggregate step)** that "the
result the table shows" is the post-step relation, and any later per-result computation (R182's
export) must build on the same `build_steps_relation` path, not on `/aggregate`.

**Watch** — a ratio total formats as a percent only under the widget's `percent` number format
(same rule as the cells); a `ratio` whose denominator sums to 0 shows blank. The footer's
numbers come from a second request per table widget (one per distinct column set + filter
state); fine at dashboard scale, worth a look if a dashboard carries dozens of totalled tables.
The totals row is not yet in any export — that is R182.

## Goal

**Inherits from ← [Round_180](Round_180.md)** — the first "đợt 2" round of rc.2. A table widget
shows 8–24 rows of a result that may have hundreds, and a reader wants the sum under the column
and the conversion rate across all rows, not the page — computed where the rows are, not from what
happens to be visible.

Add per-column totals computed by the server over the whole filtered result.

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-d (external feedback item F15 — "a total row
under the table"), and purpose.md's key design decision #3 (Excel output first: a report table has
a total row) — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a `sum` is correct when the result exceeds the page / the fetch cap; a
`ratio` equals Σnum / Σden and differs from the mean of per-row rates; a dashboard filter changes
the totals; a stepped query totals its shaped rows.
**Falsified if**: the footer has to be derived from the fetched rows, or a stepped query cannot be
totalled.

- [x] **D** — totals are a presentation spec on the widget (which columns, how), computed by the
      server on read; nothing is stored but the spec. `ratio` is a rate re-derived from its
      parts, by definition.
- [x] **C** — `_shared/dashboard.yaml`: `Widget.totals`, a map of column name to
      `TotalSpec` (`agg` sum | ratio, `num?`, `den?`; ≤ 64 entries);
      `queries/totals.contract.yaml` (`totalsQuery`: columns + filters → sums + rowCount).
- [x] **B** — `models.TotalSpec` (+ validator) and `Widget.totals` (table-only rule);
      `models.TotalsBody`; `routers/queries.totals_query`: plan → predicates → `_step_plan` →
      `build_steps_relation` when stepped → `_validate_aggregate` against the FINAL columns →
      `query_aggregate_rows` with no dimensions + a `count`; `tests/test_query_totals.py` +5.
- [x] **F** — `types.TotalSpec` / `Widget.totals` / wire; `queriesApi.totals`;
      `hooks.useWidgetTotals`; `totals.ts` (`totalsColumns`, `computeTotals`); `TableView`
      summary row + `formatTotal`; `WidgetView` wiring with the active filters;
      `WidgetBuilder` Totals editor + `draftToConfig`; EN/VI i18n; MSW `totalsQuery`;
      `tests/widget-totals.test.tsx` +7 (incl. the edit-reset regression).
- [x] **I / visual gate** — a stepped query (aggregate by region: Σ amount, count) as a table
      with `sum` totals on both columns: footer `Total 193,534 40` equals the whole-table figures;
      the builder shows the Totals editor on edit, and the widget stays a table.

## Risks / unknowns

- **Two sources of "the result".** `/aggregate` reads the base relation; `/totals` reads the
  shaped one. The route comment says so; R182 must reuse `/totals`'s path.
- **Edit-reset regression** (found at the gate): `pickWidgetDefaults` ran for any widget without a
  valid `dimensionCol`, so editing a table re-picked bar + a dimension. Fixed by skipping the
  kinds that have no grouping; pinned by a test. Pre-existing at `5334c81`, surfaced by this
  round's editor needing the table kind to survive.
- **Cost**: one extra request per totalled table; cached by column set + filters.

## Do

- 2026-10-15 — C + B: `TotalSpec`, `TotalsBody`, the route; the first draft used `/aggregate`'s
  relation and failed the stepped-query test (`calls` is not a post-step column → 422 was right,
  `quotes` summed the base rows → wrong); switched to `build_steps_relation`. Backend 526,
  contracts 44.
- 2026-10-15 — F: types, API, hook, helpers, footer, editor, i18n, MSW, 6 tests. Two test
  expectations corrected to the table's own formatters (`ratioFmt` 2 decimals, `percentFmt` ≤ 1).
  Builder 424.
- 2026-10-15 — visual gate: footer right on the stepped table; the editor did NOT appear on edit
  because the builder had turned the widget into a bar chart (auto-defaults). Fixed in
  `WidgetBuilder` (skip dimensionless kinds), +1 test. Builder 425. Nothing written under
  `workspace/apps/backend/data/`.

## Check

- [x] backend 526 · builder 425 · contracts 44 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, real stepped query, screenshots kept with
      the review
- [x] Affordance check (`ux-design`, structural): Findability — Totals sits under Height in the
      same form, only for a table; Usability — one select per numeric column, ratio adds two;
      Accessibility — a real `<tfoot>` summary row, bold text, right-aligned numbers;
      Credibility — the footer comes from the server, never the page; Utility — the number a
      report needs; Desirability — reads like a spreadsheet total row.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 3`:
  - ⬜ W1 — on a table widget over a query with more rows than one page, set Sum on a numeric
    column. The footer equals the column's total over all rows (check against the query's
    rows / an aggregate).
  - ⬜ W2 — set Ratio with numerator / denominator on two columns. The footer equals Σnum / Σden
    (not the average of the rows' ratios); with `percent` format it reads as a percent.
  - ⬜ W3 — apply a dashboard filter on the widget. The footer changes with the filter.

## Act

_(at close)_

## Feeds into → Round_182 (TBD)

R182 — export a table widget's numbers (CSV / XLSX): all rows, the totals row from this round's
path, a "Filters" sheet with the active filters, typed cells. It must build the file over the same
post-step, filtered relation `totals_query` uses.
