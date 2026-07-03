# Round 144: Date-typed ingest + date-bucket step — THE report's time axis (② / F11)

**Status**: Review (C/B/F/I built + gates green — human eyeball pending)
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
- [x] **C**: contract — the new step kind joins the `steps` discriminated union
      (`_shared/query.yaml` + the `workflow.yaml` mirror — no step enumeration lives in
      `values.yaml`/templates, verified); no new error envelope (dates reuse
      `coercion_failed` from R143; bad step body reuses the existing 422 step-validation
      family). `column-override.yaml` + `api-error.yaml` description notes updated.
- [x] **B**: `_coerce_dataframe` gains date/datetime targets with format-token translation
      (`translate_format`, `FormatUnsupportedError`); step engine gains the bucket step
      (`_apply_step` + `_plan_date_bucket` column-space fold); rollback/atomicity unchanged.
- [x] **F**: builder steps editor gains the bucket step kind (existing steps-editor pattern:
      types/steps/StepsEditor/MSW mirror); wizard Confirm step already renders
      `coercion_failed` (R143) — dates inherit it (dtype interpolates generically), verified
      by reading; `format_unsupported` renders via the existing string-detail fallback.
- [x] **I**: i18n en/vi (`queries.builder.steps.kindDateBucket` + granularity labels);
      design-doc sync (workflows.md step vocabulary, queries.md status line).
- [x] Tests: FM1-SHAPED fixture (text dd-MM-yyyy HH:mm:ss + override) → datetime in parquet
      == metadata · unparseable cell → typed 422 naming column/cells · bucket step over
      week/month → THE report's grouping (calls-per-agent-per-week) incl. the flagship
      Excel-override→bucket→aggregate end-to-end · unsupported format token → loud 422
      pre-write · bucket on a non-date column → 422. (The REAL FM1 file re-upload is the
      human Check item — forward-only coercion.)

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

**2026-07-03 — C/B/F/I built + verified.**

- **C** (`36c907a`): `DateBucketStep` joined the union in `query.yaml` + the `workflow.yaml`
  mirror; contract-marked pytest green. Round-plan deviation (flagged): the plan named
  "`values.yaml` + both templates" — verified no step enumeration lives there; the real
  union homes are the two `_shared` YAMLs.
- **B** (`8f44723`): `translate_format` (six tokens → strptime; `FormatUnsupportedError`;
  date targets reject time tokens), date/datetime casters (native pass-through,
  non-midnight-under-`date` fails, whole-cell-strict string parse, arrow `date32` output),
  and `_DUCK_CONFORMS`/`_CONFORMS` temporal extensions; router validates tokens at commit
  validation (422 `format_unsupported` BEFORE any write) and stages translated formats;
  `_plan_date_bucket` (granularity re-validated every plan — it inlines into SQL) +
  `date_trunc` SQL. **326 pytest + ruff green**; new tests include the flagship FM1-shaped
  end-to-end (override ingest → `date_bucket(week)` → aggregate → THE report's grouping,
  incl. the honest NULL-bucket group).
- **F+I**: FE `DateBucketStep` type + `steps.ts` threading (`isTemporalCol`, blank default:
  first temporal col · week) + `StepsEditor` body (temporal-only col options, 5
  granularities) + MSW `dateBucketStepMock` (ISO-Monday mirror) + en/vi keys + design-doc
  sync (workflows.md vocabulary line, queries.md status). **tsc + 261 vitest green.**
  Confirm-step `coercion_failed` rendering verified dtype-agnostic (dates inherit R143).

Remaining: the human Check items — re-upload the REAL FM1 file (forward-only coercion),
eyeball the new step in the builder + preview/widget rendering.

**2026-07-03 — Review finding #1 (human dogfood): stepped query's detail table hid the new
column.** Saving a query with a `date_bucket` step succeeded, but the query DETAIL page
didn't show the appended column. Root cause:
[QueryDetailPage.tsx](../../../workspace/apps/builder/src/features/data-management/queries/QueryDetailPage.tsx)
took its table headers from the SOURCE dataset's (pre-step) columns for any single-source
query — the `isJoined || isComposed` gate predates steps — while the rows GET returns the
SHAPED (post-step) rows, so the appended cell had no header. **Latent since R120** (any
single-source stepped query misrendered its detail table; dashboards were unaffected —
`dashboard/hooks.ts` already keys off "resolvedColumns present"). Fix: prefer the
server-computed `resolvedColumns` whenever present (joined / composed / STEPPED), else fall
back to the dataset's columns. Regression test added (stepped single-source detail renders
the post-step header + locale-formatted date cell). tsc + 262 vitest green.

**2026-07-03 — Review finding #2 (human dogfood): stepped query returned ALL rows, pager
lying.** The rows GET + preview stepped branches returned the ENTIRE shaped result with
`pageSize=len(rows)` — an explicit R120 assumption in the code ("the result is small by
construction — one row per group") that held only while `aggregate` was the sole step kind;
the row-preserving steps (derive R122 · filter R123 · sort R141 · date_bucket R144) keep
the source cardinality, so a bucketed FM1 query shipped 5,015 rows in one response while
the pager showed a page size. **Latent since R122**, visible now at real-data scale.
Notably the MSW mocks already paged shaped rows — the FE mirror was ahead of the real
backend. Fix: `run_steps` returns `(rows, total)` and pages the shaped relation via
LIMIT/OFFSET (COUNT for total); both branches mirror the stepless path's `eff_page` /
`unpaged` semantics (widgets keep one capped response, `total > len(rows)` over-cap signal
intact); stepped responses now also echo a contract-valid `pageSize` (the old
`pageSize=len(rows)` violated the PageSize enum). Regression tests: 12-row bucket → page
1/2 slicing + totals, unpaged echo, stepped preview paging with `resolvedColumns` +
`baseColumns` intact. **328 pytest + ruff green.**

**2026-07-03 — Review finding #3 (human dogfood, real FM2.25 re-upload): the real export
carries a REPEATED HEADER ROW mid-data.** The datetime override 422'd exactly as designed:
`coercion_failed · Worksheet · Ngày gọi · row 2899 · "Ngày gọi"`. Grounded on the actual
uploaded file (`uploads_tmp`): data row 2899 (Excel row 2900) is a **full 13-column header
repeat** — the seam where a newer export block was appended to an older one (the
report-maintenance treadmill in the wild; the old 5,047-row commit predates the append).
Scan of all 6,692 rows: exactly ONE unparseable cell. **No code change** — the error
surface did its job (named the exact row; the manual fix is one deleted row). Captured
requirement for a FUTURE round: real exports contain repeated-header/junk rows → candidate
mechanism = a "skip rows that exactly repeat the header" parse option (deterministic, zero
information loss). Deliberately NOT built now: it would soften the just-signed-off
"loud reject, no inference" D-decision mid-round — that reversal needs its own gate
(⑥ refresh / ingest-hygiene family).

**2026-07-03 — Finding #3 follow-up (human ask): proper error catch for end-user AND
backend.log.** Three pieces:

- **FE guidance now separates WRONG DATA from WRONG FORMAT** — the old copy's only CTA
  ("adjust the dtype override") was wrong advice for the junk-row case. The coercion alert
  keeps the column/dtype/cells/count naming and appends a hint: a failing cell **equal to
  the column name** → the targeted "repeated header row — delete that row in the source
  file" hint; anything else → the two-branch hint (real-looking values → fix type/format on
  Metadata; junk rows → fix the source file). i18n en/vi; FE tests cover both branches.
- **Backend WARNING logs** for `coercion_failed` (sheet · column · dtype · count · first
  cell) and `format_unsupported` (column · format · token) — the wizard alert is transient;
  backend.log is the durable trace.
- **Review finding #4 (latent, uncovered by the above): ALL app logs were silently
  disabled.** The startup migration's `alembic/env.py` `fileConfig()` used the stdlib
  default `disable_existing_loggers=True`, disabling every logger created before it
  (`app.routers.*`, `app.main` — including the existing tmp-sweep crash logging). Proven
  live (old default → `logger.disabled=True`; fix → alive). Fixed with
  `disable_existing_loggers=False`. Note: `fileConfig` also RESETS root handlers — the
  pytest caplog assertion attaches to the router logger directly.

328 pytest + ruff green; FE tsc + datasets tests green.

**2026-07-03 — Review finding #5 (human dogfood): the reported row number didn't locate the
cell.** The envelope's `row` was the 1-indexed DATA row (header excluded, the R143
convention) — "row 2899" sent the user to Excel row 2899, one off from the actual junk row
at 2900; with skip-rows/range parse options the gap widens further. **Semantic correction:**
`row` is now the 1-indexed **source-file row** (header + skipped/range rows included — the
number the user sees in Excel / a CSV editor and can jump straight to). Writers compute the
offset from their own parse options (CSV: `skip_rows` + header; Excel: range start +
header); the FE copy reads "file row N" (en/vi); contract description + model docstring +
upload.md §Failure semantics amended. Tests updated to sheet/file rows + a new test proving
the offset composes with `skip_rows`. The backend WARNING log inherits the corrected
number. **329 pytest + ruff green; FE tsc + tests green.**

**2026-07-04 — Review finding #6 (human dogfood, FM02.2025): a wrong TYPE choice read as a
"which row?" problem.** The user overrode `Ngày gọi` → **`date`** twice (`dd-MM-yyyy` →
all 6,692 cells failed, the values carry a time part; `dd-MM-yyyy HH:mm:ss` →
`format_unsupported token='HH'`) and asked which row to fix — but no row was at fault, the
TYPE was. Two message defects fixed:

- `format_unsupported` for a time token under a `date` target was self-contradictory (it
  rejected `HH` while listing `HH mm ss` as "supported"). `FormatUnsupportedError` gains a
  `reason` (`time_token_in_date` | `unknown_token`); the date-case detail now says: dtype
  `date` accepts date tokens only — values with a time part **need dtype `datetime`**;
  day/week grouping = the Date bucket step.
- The coercion alert gains a third targeted hint: dtype `date` + failing values matching a
  time pattern → "choose datetime instead (e.g. dd-MM-yyyy HH:mm:ss); group by day/week
  with a Date bucket step afterwards" (en/vi).

The log/UI DID carry the file row (first_cell=(row 2, …)) — the finding is that a
total-failure of a `date` target needs type guidance, not row guidance. 330 pytest + ruff
green; FE tsc + tests green (both new messages covered).

**Finding #6, second half (same dogfood session): the improved `format_unsupported`
message never reached the UI.** The BE logged it correctly, but the wizard showed the
generic "Request failed: 422" — `throwBatchApiError` only wrapped coded envelopes and the
legacy `{error, detail}` shape; a FastAPI `HTTPException` body (`{"detail": <string>}`, or
pydantic's `detail: [{msg}, …]`) fell through to the generic throw, discarding the
guidance. This silently ate EVERY string-detail 422 of the batch endpoint
(format-required, sheet-required, zero-columns, format_unsupported). Fix: fold both
FastAPI detail shapes into the legacy body (`error: 'unprocessable_request'`, detail =
the message / joined msgs); the Confirm alert's existing fallback renders `detail`. FE
test: the format_unsupported guidance renders, no generic "Request failed". 266 vitest +
tsc green.

**Cold-review anchor 4 CLOSED (bonus):** the re-uploaded workbook IS the report
(`PvtReport` sheet): "Thống kê cuộc gọi theo Tuần" pivots agents × DAYS with the first
column 2025-02-03 — **a Monday**. The operation's week framing is Monday-start; the ISO
decision is confirmed against the real report, and `date_bucket(day)` reproduces the
pivot's actual day-column shape (`week` = the rollup).

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
