# Round 203: conversion within N days — cohorts that cannot be read yet (item 5.3, pulls 4.5)

**Status**: In progress
**Flow**: **DCFBI** — one new step kind widens both step unions (`_shared/query.yaml`,
`_shared/workflow.yaml`); no route, no migration, no response shape outside the step union.
**Date started**: 2026-10-28
**Date completed**: —

## Goal

**Inherits from ← [Round_202](Round_202.md)** — rc.5 is open on `release/v0.0.1-rc.5` (R202 in
Review). R202's `Feeds into →` names the typed metadata entry, which waits for a machine-read case;
this round takes the next pulled item instead.

A rate **by start period** — "of the leads created in September, how many converted?" — always
reads low for the newest periods: their rows have not yet had the full window to convert. A reader
sees "the rate fell" when nothing fell. The program parked this as conditional item **4.5**
("cohort ratios flag cohorts not yet observable for the full window"). Its second entry condition
is now in the rolling log: the first user still needs a workaround after rc.3 — the external
dogfood's weekly page read "conversion fell" while contracts rose, and the dogfood now computes a
same-age rate outside MDD, because **no step can compare a start date with the data's cut-off**
(`date_diff` takes two columns; there is no as-of value in the relation).

The owner added it to rc.5 (2026-10-28) as a general, adaptive feature — not shaped for one user:
any funnel has the same arithmetic (trial → paid within 30 days, ticket → resolved within 7 days,
invoice → paid within 45 days).

_Track: 1 (product). Pulled by: rolling log 2026-10-28 (4.5 entry, second condition) + owner,
2026-10-28._

## Plan

**Expected outcome**:

- **Step `conversion_window`** — body `{kind, start, end, days, observedName, convertedName}`;
  `start`/`end` date or datetime (`diff_col_not_date`), `days` an integer 1–3660
  (`window_days_out_of_range`), two new names that collide with nothing and not with each other
  (`column_exists`, `duplicate_name`). Appends two `integer` columns:
  - **as-of** = the latest value of `start` or `end` over the rows **reaching the step** — the data's
    own cut-off, recomputed on every run, never a hard-coded date;
  - `observed` = 1 when `start + days ≤ as-of`, 0 when not, NULL when `start` is NULL;
  - `converted` = 1 when observed **and** `start ≤ end ≤ start + days`, else 0; NULL when `start`
    is NULL. The numerator is a subset of the denominator by construction.
- A rate per period is `sum(converted) ÷ sum(observed)` (Group & aggregate, then Computed column);
  a period whose `sum(observed)` is below its row count is still filling up — the flag 4.5 asks
  for, carried as data rather than as a chart decoration.
- **Builder** — one card in **Add a column**, after _Time between dates_: _Converted within N days_
  / VN _Chuyển đổi trong N ngày_. Labels above controls: Start date · Event date · Within (days) ·
  Observed column · Converted column. Date/datetime columns only; `days` an `InputNumber` 1–3660;
  defaults `observed_<N>d` / `converted_<N>d` (the default follows `days` until the user edits a
  name). A secondary line reads how to use it. Disabled with a reason when fewer than two temporal
  columns exist at that position (the `date_diff` rule).
- **Mock** (MSW) computes the same two columns so builder tests preview real values.
- **Tests** — backend: validation (each 422), the arithmetic on a fixed table (boundary day N
  exactly, end before start, end after the window, NULL start, NULL end, datetime with time of
  day), the as-of after an earlier `filter` step, the rate recipe end to end through
  aggregate + derive, workflow parity (same step in a workflow), contract conformance. Builder:
  the menu entry and its disabled reason, the card defaults and name-follow, column threading
  (two integer columns appear for later steps), EN/VI labels.

**Falsified if** any of these happens:

- a row whose `start` is fewer than `days` days before the as-of reads `observed = 1`;
- a row reads `converted = 1` while `observed = 0`, or with `end` before `start` or after
  `start + days`;
- adding the step changes any other column's value or the row count;
- any existing query or workflow result changes a cell (the real-volume install re-read);
- the menu offers the step where fewer than two date columns exist, without a reason.

## Risks / unknowns

- **As-of after a narrowing filter** — a `filter` step before this one lowers the as-of to that
  subset's latest date, so a quiet segment reads younger than the export. Safe direction (it never
  reads a young row as observed); documented on the card and in `queries.md`. Counter: the line on
  the card says "the latest date in these two columns".
- **Two outputs from one step** — every append step so far adds one column. Kept: the pair is one
  idea (denominator + numerator from one rule) and splitting it lets the two drift apart.
- **Datetime vs date** — compared as timestamps, so a datetime start at 15:00 becomes observable at
  15:00 on day N. A date column compares at midnight; the as-of keeps the column's own kind.

## Do

- [x] **D** — rc5.md item 5.3; program row + rolling-log entry (4.5 entry met); this round file;
      design: `queries.md` § step semantics, `query-construction.md` (menu, card, acceptance
      criterion)
- [x] **C** — `ConversionWindowStep` in `_shared/query.yaml`; both unions widened (query + workflow)
- [ ] **B** — model, planner, SQL; tests
- [ ] **F** — types, `steps.ts` (menu, defaults, threading), `StepsEditor` card, i18n EN/VI, mock;
      tests
- [ ] **I** — real-volume install: the dogfood's same-age rate rebuilt as a query matches its
      outside computation; every other query unchanged
- [ ] Check — gates; code review; BA (second-user test); QA

## Check

—

## Act

—

## Feeds into → Round_204

—
