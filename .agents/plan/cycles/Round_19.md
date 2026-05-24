# Round 19: Design — parse-options DCBF chain (D-step)

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_18](Round_18.md)** — DCBF methodology
promoted to
[`context/contract-driven-feature.md`](../../context/contract-driven-feature.md);
R18's Feeds-into named "parse-options + re-parse — DCBF chain" as
candidate #1; user explicitly pulled it after R18 Complete with
the framing _"let try 1 more time the DCBF to have more evidence
for later."_

R19 is the **D-step** of the second feature DCBF chain. The chain
will run R19 (D) → R20 (C) → R21 (B) → R22 (F). R19's purpose is
focused: most parse-options design is already locked in R14's
[upload.md](../../design/data-management/upload.md). R19 picks up
the open thread R18's cross-check surfaced — the **CSV re-parse
endpoint asymmetry** — plus a small set of design decisions the
implementation chain needs to consume.

Methodology stake: this is the **second instance** of the full
DCBF chain. After R22 closes, the methodology will have two
concrete feature-shape examples (upload + parse-options); that's
when [the `skills/` promotion bar](../../context/contract-driven-feature.md)
becomes evaluable (R17's Act deferred this pending "a non-toy
second feature").

_Track: 2 (agent-method — methodology evidence) + 1 (product —
closing the parse-options gap R18 surfaced). Pulled by:
[Round 18](Round_18.md) Feeds-into § "R19 candidates" #1 + user
explicit pick after R18 Complete. Per
[contract-driven-feature.md](../../context/contract-driven-feature.md)
the D-step output is the locked design + open-questions table; no
code changes._

## What is IN scope

- **Lock CSV re-parse endpoint shape.** R14 says "POST
  /uploads/<temp*id>/parse" handles re-parse; R15 contract
  scoped that endpoint to Excel
  ([parse.contract.yaml](../../../workspace/packages/contracts/uploads/parse.contract.yaml):
  *"Phase 2 (Excel-only) of the two-phase upload flow"\_). The
  asymmetry needs a deliberate resolution before R20 writes the
  contract. Three candidates to choose between via HIxAI Q&A
  (see Do § "Open questions").
- **Reconfirm or revise R14's parse-options decisions** that the
  implementation will consume:
  - Override-reset on re-parse (R14 says "any dtype overrides …
    are reset" with a warning; reconfirm).
  - Per-sheet parse-options state in the wizard reducer (R14
    implicit; confirm explicit).
  - Range validation UX feedback (R14 implicit; lock the rule).
  - `usedRange` → Metadata `range` default pre-fill (R14
    locked; reconfirm).
- **Preview-failed actions scope decision.** R14 shows three
  buttons on parse-failed sheets:
  `[Re-pick file] [Deselect this sheet] [Adjust parse options]`
  ([upload.md:392](../../design/data-management/upload.md)).
  R18 deferred these as item **W2**. R19 decides whether they're
  part of this chain's R22 scope or a separate R∞ round.
- **Append a "Round 19 locks" block** to upload.md's open-
  questions table (the same shape R14 used) so R20+ readers see
  the chain's resolved decisions at a glance.
- **Cross-link**: `Inherits from ← Round_18` (above);
  `Feeds into → Round_20 (Contract — parse-options endpoint
shape + ParseOptions schema tighten)`.

## What is OUT of scope (explicit deferrals)

- **No contract writes** — R20.
- **No BE handler changes** — R21.
- **No FE component edits** — R22.
- **No design-doc rewrites.** Append locked decisions to the
  existing open-questions table; do not restructure R14's body.
- **No methodology updates to `.agents/context/contract-driven-feature.md`.**
  Per R17/R18 carry-over: re-evaluate at end of R22 with two
  instances in hand.
- **No new upload features** outside R14's design (no CSV
  encoding override, no delimiter override, no "import mode"
  toggle, no per-cell type override).
- **No preview-HTML edits.** The R14 preview already shows the
  parse-options disclosure and the preview-failed buttons.
- **No second-feature design beyond parse-options.** Analytics
  queries (the third feature in R18's R19-candidate list) stay
  parked.

## Plan

- [x] Author Round_19.md (this file) and flip to `In Progress`.
- [x] Re-read the parse-options sections in
      [upload.md](../../design/data-management/upload.md) and
      [upload.preview.html](../../design/data-management/upload.preview.html).
- [x] Re-read the locked parse-related contract surface
      ([\_shared/parse-options.yaml](../../../workspace/packages/contracts/_shared/parse-options.yaml),
      [parse.contract.yaml](../../../workspace/packages/contracts/uploads/parse.contract.yaml))
      to know what's already wire-locked.
- [x] Re-read the BE handler
      ([routers/uploads.py](../../../workspace/apps/backend/app/routers/uploads.py))
      and the commit handler
      ([routers/datasets.py](../../../workspace/apps/backend/app/routers/datasets.py))
      to know what's already implemented.
- [x] HIxAI Q&A: 4 questions raised; user-locked 3 with a
      mid-round Q4 follow-up.
- [x] Author "Round 19 locks" rows in upload.md's open-questions
      table with date + decisions + source-question references —
      5 rows total including the chain-compression finding.
- [x] Recognize that Q1=C compressed the chain to D+F; updated
      Feeds-into accordingly.
- [x] Run `pnpm md:lint` after design-doc edits.
- [x] Run `pnpm format:check` for any R19-touched MDs.
- [x] Cross-link `Feeds into → Round_20 (F-step — parse-options
FE)` instead of the originally-planned Contract scope.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **R14 design under-specifies the CSV side.** The biggest
  unknown — R19 must lock the endpoint shape or R20 stalls. The
  three candidates (extend `/parse`, new endpoint, or no-CSV-
  re-parse) each have different ripple costs into R20/R21/R22.
  Mitigation: HIxAI Q&A locks the choice with the user before
  the round ends.
- **Override-reset is conservative.** R14 chose "reset all
  overrides on re-parse" because column names may shift. A
  smarter "preserve-by-name where the column survives" merge
  could feel better but adds R21 work. Lean (default): keep
  R14's conservative reset and revisit when a user reports
  friction.
- **Pre-upload parse options.** R14 puts parse-options on
  Metadata (after the first parse runs with sniffer defaults).
  A user with a complex multi-table CSV might want to set
  options before the first parse runs. Adds Source-step UI
  surface. Lean: defer — R14's flow handles the common case;
  the multi-table case is R∞.
- **Preview-failed actions scope.** All three buttons (Re-pick
  file, Deselect this sheet, Adjust parse options) need BE
  cooperation only for the third (re-parse). The first two are
  pure FE state actions. R19 can split scope cleanly: first two
  in R22, third bundled with the parse-options re-parse work in
  R22.
- **Markdownlint `+`-prefix gotcha.** Same R07–R18 pattern.
  Lint after every edit (per R18's gotcha-memo rule).
- **Round_04.md prettier carry-over** persists. Not R19's job.

## Do

### Findings from re-reading the existing design + contracts + BE

- **R14 design**
  ([upload.md § Parse-options disclosure](../../design/data-management/upload.md)):
  - Excel parse-options: `range`, `has_header`.
  - CSV parse-options: `skip_rows`, `has_header`.
  - "Re-parse" triggers `POST /uploads/<temp_id>/parse` — the
    design names the Excel endpoint; CSV asymmetry is not
    addressed.
  - Override-reset on re-parse, with inline warning.
  - Defaults at commit if disclosure never opened.
- **R15 contracts**:
  - `ParseOptions` schema is shared between `/parse` (Excel
    only) and `/datasets/batch` (commit, both formats). It
    already accepts `range`, `skip_rows`, `has_header`.
  - `/parse` endpoint contract is explicitly Excel-only.
  - `/datasets/batch` accepts `items[].parse_options` so CSV's
    parse-options ride to commit but **not** to a preview-time
    re-parse.
- **R16 BE**: wires `parse_options` through to `parse_sheet()`
  for Excel re-parse; commit-side honors `parse_options` for
  both CSV and Excel.
- **R17 FE**: no parse-options UI yet (R18 design-fidelity sweep
  deferred this as item M1; carried into this chain).

### HIxAI Q&A — locked decisions

Four questions raised; user answers locked the design:

- **Q1 — CSV re-parse endpoint shape?** Three candidates: (A)
  extend `/parse` (my lean), (B) new `/re-parse` endpoint, (C) no
  CSV re-parse. **User picked C.** CSV's parse-options collected
  on Metadata, applied at commit. `/parse` stays Excel-only.
- **Q2 — Override-reset on re-parse?** **Reconfirmed R14**: reset
  all column overrides + excluded-columns for the re-parsed sheet
  on success. Conservative, predictable, no name-shift hazards.
- **Q3 — Preview-failed action buttons scope?** **All three**
  (`Re-pick file`, `Deselect this sheet`, `Adjust parse options`)
  ship in the F-step of this chain. Closes R18's W2 deferral.
- **Q4 — CSV parse-options edit vs existing overrides?** Q1=C
  creates a wrinkle: editing CSV parse-options changes the
  columns at commit, so existing overrides may not match. User
  picked **"Reset overrides when parse-options change"** —
  symmetric with Q2's Excel rule. Warning before the edit.

### Methodology finding — the chain compressed to D + B + F (corrected)

**First-pass finding (wrong)**: I initially recorded the chain as
compressed to **D + F**, claiming both C and B were already in
place from R15/R16. Mid-Review, the user probed: _"Do we need C
and B?"_ — and the re-check exposed a real **B-step gap**.

**Verified state**:

- The Excel `/parse` endpoint stays as R15 wrote it (Excel-only,
  with `parse_options`). No new endpoint. **No C needed.**
- The shared `ParseOptions` schema covers all three parse-option
  fields (`range`, `skip_rows`, `has_header`) already. **No C
  needed.**
- The BE Excel re-parse handler at
  [routers/uploads.py:184](../../../workspace/apps/backend/app/routers/uploads.py)
  already threads `parse_options` through to `parse_sheet()`.
  ✓ Already in.
- The BE commit handler at
  [routers/datasets.py:169-178](../../../workspace/apps/backend/app/routers/datasets.py)
  applies `parse_options` for the **Excel branch**:
  `range_=opts.range`, `has_header=…`. ✓ Already in.
- The BE commit handler's **CSV branch** at
  [routers/datasets.py:170-171](../../../workspace/apps/backend/app/routers/datasets.py)
  calls `parse_csv(original_path)` with no options. **The
  contract accepts `parse_options` on CSV commit items; the BE
  silently ignores them.** ✗ Real gap.
- The CSV parser itself at
  [csv_parser.py:63](../../../workspace/apps/backend/app/ingest/csv_parser.py)
  accepts no options and hardcodes `header = TRUE`. ✗ Same gap.
- R16's BE conformance tests verified response **shape** against
  the YAML; no test sent `parse_options: { skip_rows: N }` on a
  CSV commit and asserted the resulting dataset reflected the
  skip. Behavior drift escaped the shape-conformance net.

So the DCBF chain the user pulled **compresses to D + B + F**
(not D + F as I first claimed):

- **R19 (D)**: this round — design refresh + locked decisions.
- ~~R20 (C)~~: still genuinely collapsed — contract surface is
  complete (`ParseOptions` already covers `skip_rows` +
  `has_header`).
- **R20 (B)**: real round — extend `parse_csv()` to accept
  `skip_rows` + `has_header`; thread `parse_options` through
  the CSV branch of the commit handler; add a behavior-
  conformance test that catches the kind of drift R16's
  shape-only test missed (issue a CSV commit with `skip_rows`,
  assert the parsed `rowCount` and `columns` reflect the skip).
- **R21 (F)**: FE round — Metadata-step parse-options
  disclosure, Excel `Re-parse this sheet` button, CSV
  override-reset on edit (Q4), three preview-failed buttons
  (Q3), and the Excel re-parse pipe to `useUploadParseMutation`.

**Why this matters for the methodology** (now strengthened by
the correction):

1. **D-step output can include "chain not needed" findings** —
   confirmed for C. R19 deliberately produced this as an
   output (not a side-effect of "we skipped that round").
2. **D-step output can _also_ surface contract-vs-behavior
   drift** that prior conformance tests missed. R19 caught a
   real B-step gap that the R16 BE round didn't notice because
   its conformance net checked shape, not behavior. This is a
   new finding the original methodology promotion didn't
   anticipate.
3. **The methodology survived the user's probing**, but barely
   — I needed the user's question to catch my own first-pass
   error. The HIxAI Q&A loop did its job. Round of self-
   correction recorded in this Act so the next D-step author
   doesn't repeat the same shortcut ("contract+BE looks done,
   so the chain compresses").

R∞ candidate refinements of
[`context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
(hold the edit until R21 (F) closes — that's when two
instances exist):

- **Reframe "the four phases" as a maximum, not a mandate.** The
  D-step is the round that **picks** which subsequent phases are
  needed. Chain shapes observed so far: full D+C+B+F (upload,
  R14→R17); D+B+F (this chain); plausibly D+F (truly single-
  layer); plausibly just B (BE-only behavior fix). The
  "When _not_ to use DCBF" section already touches this, but
  the affirmative framing ("the D-step picks the chain") is the
  stronger rule and deserves promotion. **User-endorsed
  mid-R19-Review**: _"even DCBF, depends on actual context, we
  can pick them properly."_
- Add a sentence noting **D-step output can include a "no C
  needed" finding** with R19 as the worked example.
- Strengthen Principle 5 ("Fail loudly, pain first") with a
  sub-rule: **shape-conformance is not behavior-conformance.**
  When the BE accepts a request field, the conformance net
  should include at least one test asserting the field
  measurably affects the response, not just that the field is
  accepted. R16's gap is the worked anti-example.
- Strengthen the
  [be-round-conformance-pattern memo](../../memory/2026-05-24-be-round-conformance-pattern.md)
  with a "request-fields-must-have-behavior-tests" rule (and
  update its Status from `Promoted` if the rule lands in
  `context/` from this round's evidence).

### Design-doc updates

Added a five-row table to
[upload.md § "Open questions answered in R19 (parse-options chain
D-step)"](../../design/data-management/upload.md), matching the
R14 table format. The last row records the chain-compression
finding so R20 (F) and any later methodology-promotion round
can find it without reading this Round file.

## Check

- [x] Open-questions table in upload.md updated with R19's
      locked decisions — 5 rows including the chain-compression
      finding.
- [x] CSV re-parse endpoint shape decision recorded (Q1 = C,
      no CSV re-parse).
- [x] Override-reset behavior reconfirmed (Q2 = R14 reset all).
- [x] Preview-failed action scope decision recorded (Q3 = all
      three buttons).
- [x] CSV-parse-options edit conflict resolved (Q4 = reset
      overrides on edit; symmetric with Q2).
- [x] Per-sheet parse-options state location in wizard reducer
      confirmed for the F-step (per-sheet via `SheetState.parseOptions`;
      CSV uses the `CSV_SHEET_KEY` sentinel).
- [x] `usedRange` → Metadata `range` default pre-fill
      reconfirmed for the F-step (R14 carries through).
- [x] `pnpm md:lint` clean across 61 files (Round_19.md added).
- [x] `pnpm format:check` clean for R19-authored MDs (R04 and
      R18 prettier-vs-markdownlint carry-overs persist).
- [x] Zero code changes this round (D-step is design only).
- [x] Cross-links present: `Inherits from ← Round_18` above;
      `Feeds into → Round_20 (F-step — parse-options FE)` named
      below.

## Act

**Status**: Complete.

**Learnings**:

- **The D-step is the round that pays the most for the
  methodology.** R19 took ~25 minutes, produced zero code, and
  saved R20+R21 from being authored as empty rounds. The
  "single-feature one round per phase" rule held — by
  discovering, not bypassing, the "no chain needed" outcome.
- **Q1 went against my lean (A) and the user picked C.** That's
  exactly the kind of design move HIxAI Q&A exists to catch.
  Had R19 not run the questions and just defaulted to A, R20
  would have spent a round adding a CSV `/parse` extension that
  the product doesn't need. The Q&A pulse paid for itself.
- **The "Default = don't add" guard pulled forward through R19.**
  C is the leanest of the three Q1 candidates: no new endpoint,
  no new BE handler, the contract surface is unchanged. The
  Evolution-Rule discipline informed the HIxAI Q&A framing of
  options, and the user reached for the leanest option.
- **Symmetric design rules are easier to lock.** Q4 (CSV
  override-reset on parse-options edit) fell out of Q2 (Excel
  override-reset on re-parse) by symmetry. The user picked the
  symmetric answer without hesitation. Lesson for future
  D-step rounds: name symmetries explicitly when they exist.
- **A D-step round can lock methodology evidence even when it
  doesn't pull the chain.** R19 produces both (a) the parse-
  options decisions and (b) the "chain compressed to D+F"
  finding. The second is more valuable for the eventual
  `skills/` promotion of the methodology than 4 separate rounds
  would have been.

**Promotions** _(none this round)_: D-step rounds typically
don't promote. The methodology refinement candidate (D-step can
produce "chain not needed" output) is logged in upload.md's
"Methodology note" callout; the actual `context/` edit holds
until R20 (F) confirms the finding stays true through
implementation. Promotion to `skills/` of the whole methodology
waits for R20 (F) close + a re-evaluation.

**Follow-ups (not promotions, just notes):**

- **Loading-mask + toast / notification patterns (deferred,
  user-pulled mid-R19).** User raised these as cross-cutting
  UX needs while R19 was in Review: _"I wanna add loading-mask
  (while waiting), toast message to notify/message."_ The
  reasonable scoping was a dedicated UX-infrastructure round
  (option A from the in-conversation question); user chose
  **defer**: _"Later. Let focus to complete UI now."_ Recorded
  here so the next round-planning pass picks it up after R20
  (parse-options F-step) closes. Likely shape: a small
  track-2 design + implementation round adding
  `@mdd/ui` affordances (loading-mask wrapper + `useMessage`
  hook) and retrofitting the existing wizard + datasets-list
  async surfaces. **Not a methodology promotion candidate** —
  just a product UX backlog item.
- After R20 (F) ships, re-read
  [`context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
  and consider adding a one-liner under "When _not_ to use
  DCBF" pointing at R19 as the worked example of "D-step
  discovers no chain needed."
- The `skills/` promotion evaluation per R17/R18 carry-over is
  now closer: R19+R20 = the second feature pass; with R15-R17
  as the first, two instances exist. R20 closes the bar.
- Range validation UX (typed validation in the `range` input on
  Metadata) was a minor Q5 candidate; lean default applied:
  validate at Re-parse-click time only, surface BE errors
  inline. Not pulled to a Q&A question.

## Feeds into → Round_20 (B-step — CSV parse-options BE)

What R19 hands forward:

- **Locked design decisions**:
  - Q1 = no CSV re-parse; Excel `/parse` unchanged.
  - Q2 = Excel re-parse resets all overrides for that sheet.
  - Q3 = three preview-failed action buttons in scope.
  - Q4 = CSV parse-options edit resets overrides for that file.
- **The chain compressed to D + B + F.** R20 is a real B-step
  (not C, not collapsed). R21 is F.
- **An updated open-questions table** in upload.md serving as
  the chain's decisions reference (5 new rows including the
  corrected chain-shape entry).
- **Two methodology evidence findings** for the eventual
  `skills/` promotion: (a) D-step can produce "no C needed"
  output, and (b) D-step can catch shape-vs-behavior
  conformance drift from prior B-rounds.

**R20 (B) scope preview** (subject to R19's locks):

- Extend `parse_csv()` in
  [csv_parser.py](../../../workspace/apps/backend/app/ingest/csv_parser.py)
  to accept `skip_rows: int = 0` and `has_header: bool = True`
  kwargs. Pass through to DuckDB's `read_csv_auto` via the
  `skip` and `header` options.
- Update the commit handler's CSV branch at
  [routers/datasets.py:170](../../../workspace/apps/backend/app/routers/datasets.py)
  to thread `opts.skip_rows` and `opts.has_header` to
  `parse_csv()`.
- Add behavior-conformance tests: one CSV commit with
  `skip_rows: N` and assert the resulting dataset has
  `rowCount` and `columns` reflecting the skip; one with
  `has_header: false` and assert auto-generated column names.
- The existing R16 shape-conformance tests stay; the new
  behavior tests sit alongside.
- No contract changes (C still genuinely collapsed).
- No FE work in this round (R21).

**R21 (F) scope preview** (after R20 closes):

- Add a `parseOptions` field to `SheetState` in the wizard
  reducer; default `{}`.
- Add a `SET_PARSE_OPTIONS` action that updates the field +
  resets the sheet's `columnOverrides` and `excludedColumns`.
- Build the parse-options disclosure UI inside the Metadata
  step (collapsed by default; one shape for Excel with `range`,
  one for CSV with `skip_rows`; `has_header` on both).
- For Excel: add the `[Re-parse this sheet]` button that fires
  the existing `useUploadParseMutation` with the new options
  and resets overrides on success (via `PARSE_SHEET_SUCCESS`
  already handling that path via Q2's reset, with a small
  reducer adjustment).
- For CSV: no Re-parse button. Edits to parse-options reset
  overrides + ride to commit via `CommitBatchItem.parse_options`
  — now properly honored by the R20-extended BE.
- Add the three preview-failed action buttons (Q3) including
  the `[Adjust parse options]` link that opens the Metadata-
  step disclosure for that sheet.
- Update reducer + integration tests; aim for one new test
  per substantive flow change.
- No design-doc edits beyond a possible `**Frontend**: R21`
  stamp on upload.md.

User picks at end-of-round Q&A whether to run R20 next or
defer to evaluate the methodology evidence first.

**Out of R20 + R21's scope** (recorded in Act § Follow-ups):
**loading-mask + toast / notification patterns.** User-pulled
mid-R19 but explicitly deferred (_"Later. Let focus to
complete UI now."_) — picked up as a track-2 UX-infrastructure
round after R21 closes.
