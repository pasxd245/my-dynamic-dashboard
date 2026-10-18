# Round 191: fix round — the rolling log's small findings after the walks

**Status**: Review — built, reviewed (BA, code review, QA: no open P0/P1); awaiting the human acceptance walk (W1–W8) and sign-off
**Flow**: DCFBI — no new capability; each fix pinned by a test, contracts brought in line with what the code emits.
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — the rolling log's fifteen small findings, each fixed with a test that fails before the
fix (or, for copy / comments / contract text, checked by reading): a text measure that still reads as
numbers rolls up on the client, a deleted query reads "query unavailable", a count draft switched to
combo / scatter saves; exports label the totals row without ever overwriting a total; `step_invalid`
is in the run / rows / preview contracts; the join warning names both datasets in the saved query's
direction; the declare refusal says why; the dataset page has an advanced-query no-match state; the
refresh Confirm footer names the dataset; the workflow steps editor offers `Source.Query`.

**Studied** — _predicted_ fifteen mechanical fixes; _saw_ the BA review turn one of them (F2) into a
P0: the "fallback the comments promised" summed `"1,200"` and `n/a` as 0 — a wrong number where the
card used to be empty; _now believe_ (high) a fallback that coerces is a number the server refused
to produce, so it may run only when every cell is a number. The reviewers paid for themselves on
round one: one P0, one rule change (file labels), six stale design docs.

**Watch** — aggregate, totals and export still answer `query_stale` where rows / preview / run answer
`step_invalid` (rolling log); a text measure with non-number cells shows the plain empty state, not
why.

## Goal

**Inherits from ← [Round_190](Round_190.md)** and the walks of R177–R189 (2026-10-18, 45 of 45
passed, no findings). The release program held one fix round until after the walks so walk findings
would land with the design-sync findings; the walks added none, so the round is the rolling log's
open "small findings" rows plus the 2026-10-18 plan check's contract gap.

_Track: 1 (product). Pulled by: [release program](../programs/release-rc2-rc5/release-rc2-rc5.plan.md)
§ Rolling log ("one fix round after the walks") — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: every listed finding is either fixed with a test that fails before the fix, or
shown not to reproduce; no saved query's numbers change; no contract shape changes beyond documenting
what the backend already emits.
**Falsified if**: a fix changes a number on an unchanged definition, or a contract gains a field.

Findings (from the rolling log; located 2026-10-18):

- [x] F1 `ChartCard` "query unavailable" never reached — `WidgetView` passes `false`
- [x] F2 single-series chart reads "empty" when the server aggregate is skipped (string measure)
- [x] F3 export's "Total" label can overwrite a total / differ from the page
- [x] F4 `run-post.contract.yaml` omits 409 `step_invalid` (also query rows / preview)
- [x] F5 two strings offer "saved query" as a query base (EN + VI)
- [x] F6 workflow steps editor cannot offer `Source.Query`
- [x] F7 join-multiplication warning direction assumes the modal's dataset is the base
- [x] F8 relationship declare 422 shows a generic message
- [x] F9 dataset page: advanced-query-only no-match shows "empty dataset"
- [x] F10 `MetadataEntry` docstring claims a sweep on noun delete (none exists — 3.8 builds it)
- [x] F11 stale comments (`wire.ts`, `TableView` footer, filter drawer, `relationships.py`)
- [x] F12 a `count` draft switched to scatter / combo saves a measure the backend forbids
- [x] F13 refresh wizard Confirm footer reads "Creating 1 dataset in …"
- [x] F14 contracts cite moved design-doc paths (`query.yaml`, `dataset.yaml`, `rows-get`)
- [x] F15 `ComputeStep` contract does not name its 422 codes
- [x] Reviews: BA, code review, QA (rc3.md § Execution)

## Risks / unknowns

- **Declared change (F2):** a widget whose measure is typed text but holds only numbers (digits
  stored as text) used to show the empty state; it now shows the sum. A measure with any cell that
  is not a number keeps the empty state (no silent zeros — BA P0, fixed in-round).
- **Declared change (F3):** files put `Total` in the first column with no totals spec, never into a
  total; every column totalled → no label. Against rc.2 the label moves only in the two bug cases
  (a totalled column 0, or an empty ratio before the first untotalled column).

## Do

- 2026-10-18 — located all 15 findings (sub-agent survey, file:line each); all reproduced.
- Fixed with a test that fails before the fix where behaviour changed: F1 + F2
  (`widget-aggregate.test.tsx` +3), F3 (`test_query_export.py` +2; `widgets.md` § Export updated to
  the page's rule), F4 (`run-post` / `rows-get` / `preview` 409 `oneOf` + `step_invalid`; run and rows
  responses now contract-validated in tests), F6 (`withProvenanceColumn` +3), F7
  (`relationship-check.test.tsx` +1), F8 (`RelationshipDeclareError`, reasons EN/VI,
  `relationships.test.tsx` +1), F9 (`advanced-query.test.tsx` +1), F12 (`widget-config.test.ts` +2),
  F13 (`refresh-replace-period-r189.test.tsx` +1). Copy, comments and contract text only: F5, F10,
  F11, F14, F15.
- Gates (first pass): backend 583 · builder 473 · contracts 46; `tsc --noEmit` clean; `ruff check` clean.
- 2026-10-18 — reviews (rc3.md § Execution). **Code review: PASS** (P2: a weak F3 test; 404 retried
  three times before "query unavailable"; aggregate / totals / export still say `query_stale` for a
  step error). **QA: PASS** — clean re-run matched the counts; every builder test failed on the
  pre-round source, one backend test did not (weak); 10 adversarial tests kept; visual gate in a
  headless browser on F8, F9, F13 (`/tmp/claude-0/qa-shots/`); the app has no dark theme, so the
  dark check does not apply. **BA: CHANGES** — **P0-1** F2 counted `"1,200"` / `n/a` as 0; P2s on
  copy (join warning "other side", English inside VI reasons, self-join wording, missing-query hint,
  advanced hint), the CSV totals row with no label, and six design docs that now lied.
- Fixed in-round: P0-1 (`allCellsNumeric`; test with `"1,200"` and `n/a`); 404 not retried; the join
  warning names both datasets; declare reasons show `left ↔ right`; copy; file label → first
  untotalled column (tests replaced, the weak one removed); six design docs updated. BA re-review:
  **PASS**, all items closed.
- Gates (final): backend 585 · builder 487 · contracts 46; `tsc --noEmit`, `ruff check`, lints 0.

## Check

- [x] backend 585 · builder 487 · contracts 46 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Visual gate (UI-bearing round): QA, headless Chromium, F8 / F9 / F13 (light; no dark theme exists)
- [x] BA · code review · QA — no open P0/P1 (BA P0-1 fixed and re-reviewed)
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 8` (fake data; the
      walk-pack worktree; workspace **Walk191** with `walk_calls.csv` as **calls**, `walk_teams.csv`
      as **teams** and **teams2**, `calls.team` → `teams.team` many:1, queries **calls all** and
      **calls East** (`team = East`), a dashboard **Walk191**; and `walk_calls_text.csv`:
      `agent,team,called_at,calls` / `Ly,North,2026-10-01,5` / `Minh Anh,East,2026-10-03,"1,200"` /
      `Ly,East,2026-10-04,n/a`):
  - ⬜ W1 (F3) — Table widget over _calls all_, Totals Sum on `calls`; download CSV and Excel. Then a
    query **calls first** whose step keeps `calls`, `team` in that order, a Table over it with Sum
    on `calls`, download both. Expect: first — footer and files end `Total | | | 23`; second — the
    page footer shows `23` with no label, the files end `23,Total`; 23 is never replaced.
  - ⬜ W2 (F9) — dataset **calls**, advanced query `calls:>100`; then switch to VI. Expect "No rows
    match the advanced query" + **Clear advanced query** (VI "Không có dòng nào khớp với truy vấn
    nâng cao"); the button brings the 6 rows back.
  - ⬜ W3 (F7) — from **teams**: Join with related, the `team ↔ team` edge, read the warning, Cancel;
    the same from **calls**, save as **calls+teams**. Expect both: "Joining from calls to teams can
    multiply rows: a key has up to 2 rows on teams…"; the saved query starts from **calls**.
  - ⬜ W4 (F8) — Relationships › Declare `calls.team` → `teams2.team`, don't submit; delete
    **teams2** in a second tab; submit. Expect "Couldn't declare the relationship — One of the
    datasets is not in this workspace any more. Reload and pick again." — never "Request failed".
  - ⬜ W5 (F6, F5) — a workflow with sources _calls all_ and _calls East_; group by `Source.Query`,
    Sum `calls`; save, run; remove _calls East_ and reopen the step's column list; read the query
    builder's canvas help. Expect `Source.Query` offered with two sources only; _calls all_ 23,
    _calls East_ 14; builder copy offers only a dataset as the base.
  - ⬜ W6 (F12) — a Bar widget over _calls all_, agg **Count**, dimension `team`; switch to
    **Combo**, measures `calls` / `calls`; Save; View as JSON. Expect the save works, `"agg":
"sum"`.
  - ⬜ W7 (F13, F2) — a Stat, Sum of `calls` over _calls+teams_ (note the value); refresh **calls**
    with `walk_calls_text.csv` (Replace, acknowledge the type change); read the Confirm footer;
    commit; reopen the dashboard. Expect "Refreshing **calls** in **Walk191**." and the stat card in
    its empty state — never 10.
  - ⬜ W8 (F1) — delete _calls first_; reload the dashboard. Expect its card at once: "Saved query
    unavailable — The query this widget used was deleted. Edit the widget to pick another query.";
    other cards unchanged.

## Act

- Rolling log: the R191 rows close; two new P2 rows (step-error code on aggregate / totals / export;
  a "measure isn't a number" message on the card).
- Promotion: none this round.
- Prune check: none — the four-role loop's first round produced one P0 the tests could not see; it
  earns its place (rc3.md § Execution's own prune rule: two rounds with no reviewer finding).

## Feeds into → Round_192 (TBD)

Item 3.6 — publish a workflow output as a derived dataset with lineage; saved copies (DFCFBI,
migration `0008`).
