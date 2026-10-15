# Round 184: `compute` step — a closed function catalog, first function `trim`

**Status**: Review — C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W3) and sign-off
**Flow**: DCFBI — one new step kind, contract-first, verified on a fixture where the same person is typed five ways.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — a `compute` step: `{kind: compute, name, fn, col}` appends a new column computed by
one function from a **closed** catalog; the source column is never changed. The catalog is
`trim` only: edge whitespace including the non-breaking space (U+00A0) is stripped, a cell of
only spaces becomes blank (NULL), the input must be a text column and the output is text. It runs
in queries and in workflows (the shared `Step` union), in DuckDB as one `regexp_replace`. The
builder gets a **Clean text** card (new column name · function · source column, text columns
only) with a one-line explanation of what trim does, in the "Add a column" group of the step
menu; MSW mirrors the semantics. Opened ahead of the rc.2 tag at the owner's call (code on
`release/v0.0.1-rc.3`, branched from the rc.2 head). Backend 542 · builder 436 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** ingest already trimmed cells, so a
trim step would only matter for pasted data. **Saw** on the fixture that ingest keeps edge
whitespace as written: grouping the raw column splits one person into four or more groups, and a
plain `trim()` misses the NBSP an export carries. **Now believe (high confidence — the control
test pins it)** that cleaning belongs in a step the reader can see, next to the raw column, not
silently in ingest — the raw value stays the evidence.

**Watch** — the catalog is append-only by contract (`fn` is an enum): every new function is a
contract change and a round. Inner whitespace is kept (`Minh  Anh` with two spaces is still a
different value from `Minh Anh`); collapsing it would be a separate function. Case is untouched.

## Goal

**Inherits from ← [Round_183](Round_183.md)** — rc.2's last round; this opens rc.3 (T-a). The
weekly report counts calls per CS agent, and the export types the same name with a trailing or
non-breaking space, so one person shows up as several rows and every per-agent total is split.

Give the query (and workflow) author a visible, reversible way to clean a text column before
grouping — without a formula language.

_Track: 1 (product). Pulled by: fork (B) locked 2026-10-04 ("a `compute` step with a closed
function catalog; first example `trim`") + the rc.3 plan's T-a, re-sequenced from R176 — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: trim → aggregate groups the four whitespace variants of one name as one
row with the summed value; the source column is still there and unchanged; a non-text column, a
missing column, a name that collides and an unknown function each answer 422.
**Falsified if**: the source column is altered, or a function outside the catalog is accepted.

- [x] **D** — closed catalog (an enum, append-only), new column only, text in / text out, blank →
      NULL so a cleaned blank groups with real blanks.
- [x] **C** — `_shared/query.yaml`: `ComputeStep` (`kind`, `name`, `fn: [trim]`, `col`) in the
      steps `oneOf` + discriminator mapping; `_shared/workflow.yaml` mirrors it.
- [x] **B** — `models.common.ComputeStep` in the `Step` union; `query_engine._plan_compute`
      (422 `column_exists` / `unknown_function` / `unknown_column` / `wrong_dtype`);
      `rows_reader._compute_expr` (NBSP-aware `regexp_replace`, `NULLIF(…, '')`);
      `tests/test_compute_step.py` +8 (incl. the raw-grouping control and a workflow run).
- [x] **F** — `types.ComputeStep`; `steps.stepOutput` / `blankStep` (first text column →
      `<col>_clean`) / `STEP_MENU`; `StepsEditor` `ComputeBody`; EN/VI i18n; MSW
      `computeStepMock` + `stepRefs`; `tests/steps-r184.test.tsx` +4.
- [x] **I / visual gate** — a dataset with `Ly`, `Ly␠`, `␠Ly`, `NBSP Ly NBSP`, `TAB Ly`, an
      all-space cell and `Minh Anh`; query trim → sum by `agent_clean`: the builder shows the
      Clean text card and the preview `Ly 15 · Minh Anh 7 · (blank) 6`.

## Risks / unknowns

- **Regex dialect** — DuckDB's RE2 needs `\x{00A0}` for the NBSP; verified directly in DuckDB
  (edge spaces, tabs, newlines, NBSP stripped; inner double space kept; all-space → NULL).
- **Steps enumerated in many places** — contracts (2), backend union, planner dispatch, SQL
  builder, builder type / output / defaults / menu / card / labels, MSW apply / refs. Type-check
  caught nothing missing; the exhaustive `switch` in `stepRefs` would have.
- **Started before G-start3** — the rc.2 tag is still the owner's step; anything the rc.2 walks
  turn up is merged forward onto this branch.

## Do

- 2026-10-15 — C + B: contract, model, planner, SQL; the first test read `resolvedColumns` from
  the create response, which does not carry them — read from GET detail. 8 tests. Backend 542.
- 2026-10-15 — F: type, threading, default, menu entry, card, i18n, MSW, 4 tests. Builder 436,
  type-check clean; contracts 46.
- 2026-10-15 — visual gate on the cloud runner against scratch data (fixture above): card,
  explanation line and preview as expected; the step menu lists **Clean text** under "Add a
  column". Nothing written under `workspace/apps/backend/data/`.

## Check

- [x] backend 542 · builder 436 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, screenshot kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — in "Add a column" beside the
      other append-a-column steps; Usability — three fields, one sentence of explanation;
      Accessibility — labelled fields; Credibility — the raw column stays beside the clean one;
      Utility — one person, one row; Desirability — no formula to write.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 3`:
  - ⬜ W1 — on a dataset where a name appears with a trailing space, add **Clean text** on that
    column, then group by the new column. The variants are one row and the sum is their total.
  - ⬜ W2 — the original column is still in the result, unchanged, beside the new one.
  - ⬜ W3 — the card offers only text columns; a cell of only spaces shows as blank in the new
    column.

## Act

_(at close)_

## Feeds into → Round_185 (TBD)

R185 — dataset `refreshedAt` + `dataVersion`, server-stamped on every commit and refresh
(W-4, migration 0006): the version a later run stamp (R187) and a frozen copy (T-c) refer to.
