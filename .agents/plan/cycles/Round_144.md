# Round 144: Date-typed ingest + date-bucket step — THE report's time axis (② / F11)

**Status**: Doing (D signed off — C/B/F/I in progress)
**Date started**: 2026-07-03
**Date completed**:
**Flow**: **DCFBI** — set at the Design gate via flow-selector (0 of 5 fired); recorded in the Do log.

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

- [x] **D**: two design-corpus touches, signed off before code:
      [upload.md §Commit dtype semantics](../../design/data-management/datasets/upload.md#commit-dtype-semantics-r143)
      — `date`/`datetime` join the coerced set: the supported `format`-token subset (Java-style
      → pandas/DuckDB translation — name the tokens, e.g. `dd`/`MM`/`yyyy`/`HH`/`mm`/`ss`, and
      the rejection behavior for tokens outside it), failure = the existing `coercion_failed`
      422 envelope, F2 invariant (parquet dtype == `columns_json`) extends to dates.
      [queries.md §Transform steps](../../design/data-management/queries/queries.md#transform-steps-workflows-r120r141)
      — new step kind: name, body (`col` + granularity), granularity vocabulary, output column
      name + dtype, week convention (ISO vs week-start — **domain decision, ask the human**),
      position in the evolving column space.
- [x] **Flow selector** at D exit (per
      [hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md)); record
      the table in Do. → **DCFBI** (0/5 fired).
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

**2026-07-03 — D drafted (pending human sign-off).** Grounded in code first: the R143 seam
(`_coerce_dataframe` + `COERCIBLE_DTYPES` in `ingest/parquet_writer.py`; the commit-side
filter at `routers/datasets.py:231`), the step engine (`_plan_one_step` /`_step_plan` in
`query_engine.py`, `_apply_step` in `ingest/rows_reader.py` — `derive` is the appending-step
template), and the wire (`ColumnOverride.format` already exists; only commit-time meaning
changes). Three domain decisions put to the human (HIxAI):

| Q                            | Decision                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Week convention              | **ISO-8601 Monday-start** (DuckDB-native `date_trunc('week')`; matches VN business convention)    |
| Granularity vocabulary       | **day · week · month · quarter · year** (one `date_trunc` mapping; zero marginal cost)            |
| Bucket output                | **Append a new named column, dtype `date`, value = period start** (derive-like; source col stays) |

Two design-corpus sections written (both stamped DRAFT pending sign-off):

- [upload.md § Date and datetime coercion (R144)](../../design/data-management/datasets/upload.md#date-and-datetime-coercion-r144)
  — six-token subset (`yyyy MM dd HH mm ss` → `%Y %m %d %H %M %S`), `format_unsupported`
  422 before any write for tokens outside it; `date` target = date tokens only (no silent
  time-part truncation — day-level truncation is the bucket step's job); string cells parse
  whole-cell strict; native cells pass through; failures reuse the R143 `coercion_failed`
  422; F2 invariant extends to DATE/TIMESTAMP; timezone out of scope (naive only).
- [queries.md § Transform steps — `date_bucket`](../../design/data-management/queries/queries.md#transform-steps-workflows-r120r141)
  — body `{col, granularity, name}`; col must be date/datetime at this step; appends a
  `date` column (period start); compiles to `CAST(date_trunc(g, col) AS DATE)`; folds like
  `derive` in the column space.

Link check: clean (`markdown-check-link` over both docs).

**Cold review at lock (2026-07-03).** Six-anchor pass before sign-off; three surfaced items,
all resolved: (a) doc claimed "fixed-width / zero-padded" but pandas `%d`/`%m` are lenient on
cell padding — reworded as a deliberate leniency (format vocabulary constrained, not cell
padding); (b) forward-only coercion means the FM1 Check requires a **re-upload** — noted in
Check; (c) week convention had zero real-report evidence — human accepted **ISO Monday-start
as the product's convention** at sign-off. Grounding added: 5,047/5,047 real `Ngày gọi` cells
match padded `dd-MM-yyyy HH:mm:ss`; DuckDB `date_trunc('week')` verified Monday-start live.

**D signed off (human, 2026-07-03).** Both DRAFT stamps flipped.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                       |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1. >3 independent states/branches    | no     | No new state model: the wizard's states are untouched (only commit-time meaning changes); the steps editor gains one kind in an existing editor. |
| 2. New interaction pattern           | no     | Both surfaces are established patterns — the R120–R141 steps-editor kind list and the R143 Confirm-step 422 alert (verify-only this round).      |
| 3. High user-error risk              | no     | Failure paths are typed 422s rendered by the existing alert; no new destructive or multi-step interaction is introduced.               |
| 4. Contract depends on unresolved UI | no     | The step body `{col, granularity, name}` and the token subset were fully decided at D; no new error envelope.                          |
| 5. UX confidence below threshold     | no     | D closed with zero open UI-shape questions — the only open decisions were domain (week rule) and resolved by the human at sign-off.    |

Result: **Flow: DCFBI** (0 of 5 fired — default chain; F1/F2 gates do not apply, single F
lands after B per the hybrid-flow decision).

## Check

- [ ] D signed off before C/B/F.
- [ ] Real FM1 file: `Ngày gọi` commits as datetime (override + format), parquet == metadata;
      leading F2-invariant regression stays green. **Note (cold-review):** coercion is
      forward-only — this requires **re-uploading** FM1; the existing `ds_2d436084` keeps its
      string column.
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
