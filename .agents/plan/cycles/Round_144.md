# Round 144: Date-typed ingest + date-bucket step — THE report's time axis (② / F11)

**Status**: Planning
**Date started**: 2026-07-03
**Date completed**:
**Flow**: _TBD — run flow-selector at the Design gate exit._

## Goal

**Inherits from ← [Round_143](Round_143.md) "Feeds into" (signed off 2026-07-03)** — per the
signed-off R142 order, ② date-bucketing (F11): the loop closes for month 1 **except the time
axis** — THE named report ("Weekly - Report Call") needs calls-per-agent-per-WEEK, and both
available moves fail (aggregate on `Ngày gọi` → 5,015 timestamp-string groups; `derive` is
numeric-only). Two-layer gap, one round:

- **Date-typed ingest** — extend R143's coercion machinery so `date`/`datetime` overrides join
  the coerced set (today relabel-only): translate the override's Java-style `format` tokens to
  a real parse at parquet write, failure → the same typed `coercion_failed` 422. `Ngày gọi`
  (dd-mm-yyyy hh:mm:ss) must land as a real datetime, not a string.
- **A date-bucket step kind** — `date_trunc`-style granularity (day / week / month / …) over a
  date/datetime column, compiling to DuckDB SQL like every other step, so an `aggregate` can
  group by the bucket.

After this round: the weekly report's time axis is expressible end-to-end on real FM1 data —
the month-1 loop closes.

_Track: 1. Pulled by ← [Round_143](Round_143.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
(rank 2: "F11 (②) … month-1 blocker"). D-gate first per the
d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: two design-corpus touches, signed off before code:
      [upload.md §Commit dtype semantics](../../design/data-management/datasets/upload.md#commit-dtype-semantics-r143)
      — `date`/`datetime` join the coerced set: the supported `format`-token subset (Java-style
      → pandas/DuckDB translation — name the tokens, e.g. `dd`/`MM`/`yyyy`/`HH`/`mm`/`ss`, and
      the rejection behavior for tokens outside it), failure = the existing `coercion_failed`
      422 envelope, F2 invariant (parquet dtype == `columns_json`) extends to dates.
      [queries.md §Transform steps](../../design/data-management/queries/queries.md#transform-steps-workflows-r120r141)
      — new step kind: name, body (`col` + granularity), granularity vocabulary, output column
      name + dtype, week convention (ISO vs week-start — **domain decision, ask the human**),
      position in the evolving column space.
- [ ] **Flow selector** at D exit (per
      [hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md)); record
      the table in Do.
- [ ] **C**: contract — the new step kind joins the `steps` discriminated union
      (`values.yaml`/`_shared` schemas + both templates); no new error envelope (dates reuse
      `coercion_failed` from R143; bad step body reuses the existing 422 step-validation
      family).
- [ ] **B**: `_coerce_dataframe` gains date/datetime targets with format-token translation;
      step engine gains the bucket step (`_apply_step` + `_step_plan` column-space fold);
      rollback/atomicity unchanged.
- [ ] **F**: builder steps editor gains the bucket step kind (existing steps-editor pattern);
      wizard Confirm step already renders `coercion_failed` (R143) — dates inherit it, verify
      only.
- [ ] **I**: i18n en/vi; design-doc sync.
- [ ] Tests: real FM1 `Ngày gọi` (dd-mm-yyyy hh:mm:ss + override) → datetime in parquet ==
      metadata · unparseable cell → typed 422 naming column/cells · bucket step over
      week/month on the FM1-shaped fixture → THE report's grouping (calls-per-agent-per-week)
      · unsupported format token → loud reject (not silent relabel) · step validation: bucket
      on a non-date column → 422.

## Risks / unknowns

- **Format-token scope creep** — a full SimpleDateFormat engine tempts; D names a minimal
  token subset covering the real files (FM1's `dd-MM-yyyy HH:mm:ss` family) and loudly rejects
  the rest. Scope brake.
- **Week convention is a domain decision** — ISO-8601 week vs Monday-start vs the operation's
  actual reporting convention; decide at D with the human, don't guess (the `TRÙNG` lesson:
  domain semantics are the wall).
- **Two surfaces in one round** (ingest coercion + step vocabulary) — the revert seam is the
  per-gate commit; if D reveals either half is fat, split per the round-bundling lesson
  (ingest stays R144, bucket → R145).
- **Timezone** — out of scope; naive datetimes only (the CRM exports carry none). Say so in D.
- **date vs datetime** — the bucket must accept both dtypes; output dtype (date vs the
  bucket's own kind) is a D decision that touches chart axes later.

## Do

_(pending — opens at D)_

## Check

- [ ] D signed off before C/B/F.
- [ ] Real FM1 file: `Ngày gọi` commits as datetime (override + format), parquet == metadata;
      leading F2-invariant regression stays green.
- [ ] A saved query on FM1 data: bucket(week) + aggregate(count per agent per bucket) returns
      THE weekly report's shape; preview + dashboard widget render it.
- [ ] Unparseable date cell → typed 422 `coercion_failed` naming sheet · column · cells.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; human eyeball of the new step +
      ingest surface (gate per selected flow).

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_145 (TBD)

Per the signed-off R142 order: **⑥ refresh theme** (F9/F10 → F5/F6 — settings carry-forward +
schema-drift gate, then merge-on-key/precedence; multi-round, split by revert seam) → F8
multi-range wizard → UI-batch (F7/F3/F4/F12/F13 + carried R140 list). Re-rank allowed at open
per evidence.
