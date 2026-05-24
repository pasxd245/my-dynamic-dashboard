# Round 20: Backend — CSV parse-options (B-step)

**Status**: Review
**Date started**: 2026-05-25
**Date completed**: —

## Goal

**Inherits from ← [Round_19](Round_19.md)** — R19 (D-step) locked the
parse-options chain at **D + B + F** after probing exposed a real
shape-vs-behavior gap: R16's BE accepts `parse_options` on CSV commit
items but `parse_csv()` ignores all options
([csv_parser.py:63](../../../workspace/apps/backend/app/ingest/csv_parser.py)),
and the commit handler's CSV branch at
[routers/datasets.py:170-171](../../../workspace/apps/backend/app/routers/datasets.py)
calls it with no options. The contract is honest; the BE is not.

R20 makes the BE behave the way R15's contract advertises and R19's
Q1=C decision requires (no CSV re-parse, so all CSV parse-options
must take effect at commit time or never at all).

_Track: 1 (product — closes the R16 shape-vs-behavior gap that R19's
HIxAI Q&A surfaced). Pulled by: [Round 19](Round_19.md) Feeds-into §
"R20 (B) scope preview". Per
[contract-driven-feature.md](../../context/contract-driven-feature.md)
the B-step implements the BE side against an already-locked contract;
no contract changes this round._

## What is IN scope

- **Extend `parse_csv()`** with `skip_rows: int = 0` and
  `has_header: bool = True` kwargs. Pass through to DuckDB's
  `read_csv_auto` via `skip` and `header`. Mirror Excel's
  `parse_sheet()` signature shape (keyword-only, sensible
  defaults) so the two parsers stay symmetric.
- **Thread `parse_options` through the commit handler's CSV
  branch** at
  [routers/datasets.py:170](../../../workspace/apps/backend/app/routers/datasets.py).
  Read `opts.skip_rows` (default 0) and `opts.has_header`
  (default True) and pass to `parse_csv()`.
- **Auto-header naming on `has_header=False`** must produce
  `column1, column2, …` to match Excel's convention (locked by
  R14 HIxAI Q14c per the
  [parse-options.yaml](../../../workspace/packages/contracts/_shared/parse-options.yaml)
  description). DuckDB's default with `header=False` is
  `column0, column1, …` (zero-indexed) — normalize after parse.
- **Behavior-conformance tests** alongside R16's existing
  shape-conformance net:
  - A CSV commit with `parse_options: { skip_rows: N }` asserts
    the resulting dataset's `rowCount` and `columns` reflect the
    skip (header line moves; row count drops by N if header is
    inside the skipped band, else by N − 1 — pick a fixture that
    makes the expected values unambiguous).
  - A CSV commit with `parse_options: { has_header: false }`
    asserts `columns[*].name` are the auto-generated
    `column1, column2, …` names.
  - At least one combined `{ skip_rows: 2, has_header: false }`
    test to lock the interaction (skip first, then auto-name).
- **Run the conformance pattern verbatim** (per the
  [BE-round conformance memo](../../memory/2026-05-24-be-round-conformance-pattern.md)):
  every new test pairs an HTTP-level assertion with a
  `validate_response(...)` call against
  `datasets/batch-post.contract.yaml`.

## What is OUT of scope (explicit deferrals)

- **No contract changes** — R19 confirmed the contract surface is
  complete. `ParseOptions` already covers `range`, `skip_rows`,
  `has_header`.
- **No CSV re-parse endpoint** — R19 Q1=C. The `/parse` endpoint
  stays Excel-only.
- **No Excel parser changes** — R16 already threads `parse_options`
  through `parse_sheet()` on the Excel branch; this round only
  touches CSV.
- **No FE work** — R21 (F-step).
- **No methodology updates to
  [context/contract-driven-feature.md](../../context/contract-driven-feature.md)
  or
  [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)**.
  R19 deferred both to post-R21. R20's job is to provide the
  evidence (a successful B-step that closes a shape-vs-behavior
  gap caught by D-step probing), not to write the methodology
  update.
- **No CSV encoding / delimiter / quote override.** R14 locked
  the parse-options surface to `skip_rows` + `has_header` for
  CSV. Any wider parse-options surface is R∞.
- **No design-doc edits** — R19 already appended the open-questions
  rows.

## Plan

- [x] Author Round_20.md (this file) and flip to `In Progress`.
- [x] Read existing tests
      ([test_datasets_batch.py](../../../workspace/apps/backend/tests/test_datasets_batch.py))
      and fixtures to know the test patterns + available CSV.
- [x] Build a fixture CSV with leading non-data rows so
      `skip_rows` has measurable effect.
- [x] Extend `parse_csv()` with kwargs + DuckDB `skip` / `header`
      params; normalize `column0,…` → `column1,…` on
      `has_header=False`.
- [x] Thread `opts.skip_rows` and `opts.has_header` through the
      commit handler's CSV branch.
- [x] Add behavior-conformance tests (3 new tests) +
      `validate_response` calls per the conformance memo.
- [x] Run the BE test suite (`pytest`) and confirm 0 failures +
      all 3 new tests pass — 31/31 green.
- [x] Run `pnpm md:lint` after Round_20.md author.
- [x] Run `pnpm format:check` for R20-authored MDs.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **DuckDB's `read_csv_auto` `header=False` column-naming.**
  Default is zero-indexed (`column0`) per DuckDB docs. Need to
  rename in Python after parse to match Excel's `column1` convention.
  Verify with a quick repl probe before writing the test
  expectations.
- **`skip_rows` semantics with `has_header=True`.** DuckDB's `skip`
  drops N rows _before_ header detection — confirm against a
  fixture where rows 1–2 are noise and row 3 is the real header.
  This is the user-pulled semantic per R14's "leading rows to
  drop before reading."
- **Row-count assertion fragility.** With `SAMPLE_LIMIT = 10` and
  small fixtures, picking a fixture that makes the expected
  `rowCount` unambiguous matters. Use a 6-row fixture (2 noise +
  header + 3 data) so `skip_rows=2` → 3 data rows; without skip
  → 5 rows of "data" with the wrong column names.
- **Existing tests breaking.** The new kwargs are defaults, so
  `parse_csv(path)` call sites stay valid. The commit handler's
  CSV branch changes; existing CSV tests don't send `parse_options`,
  so they should pass unchanged. Verify with full suite, not just
  new tests.

## Do

### Implementation

- **`parse_csv()` signature** (`workspace/apps/backend/app/ingest/csv_parser.py`):
  added keyword-only `skip_rows: int = 0` and `has_header: bool = True`.
  Threaded into DuckDB's `read_csv_auto(?, skip=?, header=?)`.
- **`column1, column2, …` normalization**: DuckDB with `header=FALSE`
  produces zero-indexed `column0, column1, …`. Renamed in Python to
  one-indexed to match Excel's `parse_sheet()` convention (locked by
  R14 HIxAI Q14c per the
  [parse-options.yaml](../../../workspace/packages/contracts/_shared/parse-options.yaml)
  doc).
- **Commit handler CSV branch**
  (`workspace/apps/backend/app/routers/datasets.py`): replaced the
  bare `parse_csv(original_path)` with the same `None → default`
  pattern the Excel branch uses for `has_header` (`opts.skip_rows or
0` is unsafe because `0` is a legitimate explicit value; used the
  ternary `0 if opts.skip_rows is None else opts.skip_rows`).
- **Excel branch unchanged.** R16 already threaded `range_` and
  `has_header`; no regression risk.

### Test fixture

Added [sample_with_noise.csv](../../../workspace/apps/backend/tests/fixtures/sample_with_noise.csv) —
6 rows: 2 noise (export metadata, comma-aligned), 1 header, 3 data.
First-pass fixture used `##` comment-prefixed noise lines, which
tripped DuckDB's comment-character sniffer on the upload-time parse
(422). Reshaped to comma-aligned noise so the upload sniffer parses
the file as 5 rows of data (treating row 1 as header), then
`skip_rows=2` at commit-time produces the real shape (3 data rows).

This is the **realistic shape of the bug R20 fixes**: the upload
must sniff cleanly with defaults; `skip_rows` reshapes the parse at
commit. A user-facing CSV with leading metadata that breaks the
sniffer can't be uploaded at all — that's R∞ "Pre-upload parse
options" territory (R19 deferred it as the multi-table case).

### Tests added (behavior-conformance)

Three new tests in
[test_datasets_batch.py](../../../workspace/apps/backend/tests/test_datasets_batch.py),
each paired with `validate_response()` against the
`datasets/batch-post.contract.yaml`:

1. `test_csv_commit_with_skip_rows_drops_leading_lines` — sends
   `skip_rows: 2`, asserts `rowCount == 3` (down from sniffer's 5)
   and `columns` are the real `id, name, amount, signed_up`.
2. `test_csv_commit_with_has_header_false_auto_names_columns` —
   sends `has_header: false`, asserts `rowCount == 4` (all rows
   become data) and `columns == [column1, column2, column3, column4]`.
3. `test_csv_commit_with_skip_rows_and_has_header_false_combine` —
   sends both `skip_rows: 2, has_header: false` and asserts the
   skip happens first, then auto-name. Locks the interaction.

R16's existing 7 batch tests pass unchanged — defaulted kwargs
keep `parse_csv(path)` and the bare commit-handler call backward-
compatible.

### Verification

- `.venv/bin/python -m pytest tests/ -q` — **31 passed in 2.08s**.
- `pnpm md:lint` — clean across 62 files (Round_20.md added).
- `pnpm format:check` — clean for R20-authored MDs (R04 + R18
  prettier carry-overs persist; not R20's job).
- IDE flagged `commit_datasets_batch` cognitive complexity at 34/15
  — pre-existing R16 territory, not caused by R20's single-line
  signature widening. Logged as a follow-up below; not R20's scope
  per "one feature per round."

### Methodology evidence captured

This round is the **first promotion-ready instance** of R19's
"shape-conformance is not behavior-conformance" refinement
candidate:

- R16's batch tests verified the response **shape** (`Dataset`
  schema, `column.dtype` enum, `rowCount: int >= 0`). They did
  **not** verify that an accepted request field produced an
  observable response change. That's how the
  `parse_csv(original_path)` (no-options) regression slipped past
  R16's net.
- R20's three new tests close that gap **for the parse-options
  fields**. The pattern: build a fixture whose default-parse and
  options-applied-parse produce **distinguishable** `rowCount` and
  `columns` values, then assert the options-applied call hits the
  options-applied values.
- This is the empirical case for the
  [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
  amendment R19 proposed. R21 (F) closes the chain; whichever
  round-after-R21 evaluates the methodology can promote both
  refinements with two concrete instances in hand (R16 = the
  anti-example; R20 = the worked example).

## Check

- [x] `parse_csv()` accepts `skip_rows` + `has_header` kwargs
      with R14-locked defaults.
- [x] Commit handler's CSV branch threads both options.
- [x] 3 new behavior-conformance tests pass.
- [x] Existing R16 conformance tests still pass (CSV +
      Excel branches) — 31/31 green.
- [x] `pnpm md:lint` clean.
- [x] `pnpm format:check` clean for R20-authored MDs.
- [x] No contract changes (C still genuinely collapsed).
- [x] No FE changes (R21 holds those).

## Act

**Status**: Review (awaiting human approval).

**Learnings**:

- **The shape-vs-behavior conformance gap is real and small to
  close.** R20 took ~30 minutes including the fixture reshape.
  The cost of catching it earlier (in R16) would have been
  comparable — a single 3-test addition. The
  [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
  amendment is empirically supported now: "every accepted
  request field gets one behavior test." Cheap insurance.
- **DuckDB's sniffer is conservative about leading noise.** A
  `##`-prefixed noise line triggers the comment-character
  candidate, then the sniff fails because no candidate dialect
  works across the mixed structure. The realistic
  `skip_rows` use case requires comma-aligned noise — a metadata
  row whose **shape** matches the data even though its
  **content** is summary/header-decoration. The fixture
  reshape recorded this distinction.
- **DuckDB column naming with `header=FALSE` is zero-indexed.**
  R14's lock (`column1, column2, …`, per HIxAI Q14c) had to be
  enforced in Python, not delegated to DuckDB. Worth noting in
  the
  [parse-options.yaml](../../../workspace/packages/contracts/_shared/parse-options.yaml)
  doc only if R∞ adds CSV-specific BE notes; for now, the
  Excel-parity comment in `parse_csv()`'s docstring is enough.
- **R19's D-step paid for itself.** Without R19's probing the
  CSV-options gap would have shipped a third time (R15 contract
  honest → R16 BE silent → R17 FE missing → R∞ user friction).
  The methodology survives the "second instance" stress test:
  D-step catches design+contract+BE drift before F-step
  consumers depend on it.

**Promotions** _(none this round)_: B-step rounds typically don't
promote. The behavior-conformance pattern is R20's evidence
contribution to the [conformance memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
amendment, but the amendment itself holds until R21 (F) closes —
per R19's plan to evaluate post-chain with two instances in hand
(R16 anti-example + R20 worked example).

**Follow-ups (not promotions, just notes):**

- **`commit_datasets_batch` cognitive complexity is 34/15.** IDE
  flagged this during R20's signature widening; the warning is
  pre-existing R16 territory (the function packs validate +
  parse + dataframe-build + filesystem-write + DB-write in one
  body). Not R20's scope. A future BE-quality round can split
  it into staged helpers. **Not a methodology candidate** —
  just a code-health backlog item.
- **CSV `has_header=false` column-naming is enforced
  Python-side.** If R∞ adds CSV-specific encoding / delimiter
  options that interact with header detection, revisit whether
  the rename loop in `parse_csv()` should be generalized.
- **Loading-mask + toast** (R19 carry-over): still deferred per
  user. R21 (F) closes the parse-options chain; then re-pull.
- **Methodology evaluation gate**: after R21 closes, two
  instances of the DCBF chain exist (upload R14→R17;
  parse-options R19→R21). Re-evaluate the `skills/` promotion
  bar in
  [contract-driven-feature.md](../../context/contract-driven-feature.md)
  and consider promoting the "D-step picks the chain" framing +
  the shape-vs-behavior conformance amendment in the same
  evaluation round.

## Feeds into → Round_21 (F-step — parse-options FE)

What R20 hands forward:

- **A BE that honors `parse_options` on CSV commits** —
  `skip_rows` + `has_header` both take effect end-to-end and
  are covered by behavior-conformance tests. R21's FE can
  confidently surface the controls knowing the wire side is
  honest.
- **Excel-parity column naming** (`column1, column2, …`) on
  `has_header=false` — the FE preview / column-overrides UI can
  use a single naming-rule assumption across CSV + Excel.
- **A reproducible noisy-CSV fixture**
  ([sample_with_noise.csv](../../../workspace/apps/backend/tests/fixtures/sample_with_noise.csv))
  if R21 wants to add FE Storybook fixtures or BE-driven
  Playwright tests for the parse-options disclosure on a CSV
  that actually benefits from `skip_rows`.
- **A worked example of the behavior-conformance pattern** for
  R21's reducer/integration tests to mirror: when the FE
  reducer accepts a `parseOptions` field, the integration test
  should assert the field measurably affects the next render
  (column-list update, row-count update), not just that the
  reducer accepted the action.

**R21 (F) scope preview** (subject to R20's locks):

- Add a `parseOptions` field to `SheetState` in the wizard
  reducer; default `{}`.
- Add a `SET_PARSE_OPTIONS` action that updates the field +
  resets the sheet's `columnOverrides` and `excludedColumns`
  (Q4 from R19).
- Build the parse-options disclosure UI inside the Metadata
  step (collapsed by default; Excel form has `range` and
  `has_header`, CSV form has `skip_rows` and `has_header`).
- For Excel: add the `[Re-parse this sheet]` button that fires
  the existing `useUploadParseMutation` with the new options
  and resets overrides on success (per R19 Q2).
- For CSV: no Re-parse button. Edits to parse-options reset
  overrides + ride to commit via `CommitBatchItem.parse_options`
  — now properly honored by R20's BE.
- Add the three preview-failed action buttons (R19 Q3)
  including the `[Adjust parse options]` link that opens the
  Metadata-step disclosure for that sheet.
- Update reducer + integration tests; aim for one new test per
  substantive flow change, each pairing an action dispatch with
  an observable render change (behavior-conformance, FE
  edition).
- No design-doc edits beyond a possible `**Frontend**: R21`
  stamp on upload.md.

User picks at end-of-round Q&A whether to run R21 next or pause
for methodology evaluation first.
