# Round 189: replace_period — replace the period a new export covers, keep older rows

**Status**: Review — D, C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W4) and sign-off
**Flow**: DCFBI — one refresh mode end to end, contract-first; verified through the real wizard.
**Date started**: 2026-10-17
**Date completed**: —

## ⟢ At a glance

**Shipped** — a fourth refresh mode, `replace_period`: the item names a date / datetime
`period_column`; the period is `[min, max]` of it over the incoming rows (the whole stack when several
files arrive, R188), inclusive; committed rows inside it are removed, incoming rows added, committed
rows outside it — or with no value in it — kept. One version bump, one swap. The 201 is a fourth
shape, `{datasets, period: {column, from, to, removed, inserted, kept}}`; the mode and column are
remembered in the refresh settings. Guards: column on both sides and a date, no merge key, every
incoming row dated (else 422, nothing dropped). The Confirm step gets "Replace a period" with a
date-column picker (only columns that are a date on both sides; commit disabled until one is
picked), and append's overlap warning offers "Replace this period instead". Backend 580 · builder
461 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** the window SQL was the work. **Saw**
that it is one predicate on top of what merge and append already do (reconcile the committed rows to
the incoming schema, then union) — the real decisions were the edges: a committed row with no date
(kept: it is in no period), an incoming row with no date (refuse: dropping it or widening the window
would both be silent), and a window row the new export no longer has (removed — the point of the
mode, said in the Confirm note). **Now believe (high)** that the refresh modes are one reconcile-then-
select pipeline with four selections; a fifth should be a predicate, not a new path.

**Watch** — the plan sketched the response as `{replacedFrom, replacedTo, removedRows,
insertedRows}` and the field as `periodColumn`; built as the `period` wrapper (plus `kept`, so it
sums to the row count like merge's report) and `period_column` (snake case like `merge_key` and
`overlap_check_field` on the same item). The window is the incoming file's own span: an export that
should cover a week but has no rows for its last day replaces one day less — nothing infers the
intended period. Pre-existing, seen in the gate: the Confirm footer reads "Creating 1 dataset in …"
in refresh mode (rolling log).

## Goal

**Inherits from ← [Round_188](Round_188.md)** — a refresh can stack several files. A weekly export
that re-covers the last N days still has no good mode: append doubles the window, replace drops
everything older, merge needs a clean key the export may not have.

Replace exactly the period the new export covers.

_Track: 1 (product). Pulled by: the release program's item 3.5 (label R179, `Round_175` § Feeds into),
placed before publish by the 2026-10-17 decision — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a refresh whose file re-covers 3–6 Sept removes the committed 3–5 Sept rows
(including one the export no longer has), adds the new rows, keeps 1–2 Sept; the period spans a stack
of files; an undated incoming row refuses the refresh with nothing changed; undated committed rows are
kept; a column that is missing or not a date on either side, a missing column, the column without the
mode, or a merge key with it → 422; the choice is remembered.
**Falsified if**: a committed row outside the window is lost, an incoming row is silently dropped, or
the version moves more than once.

- [x] **D** — `datasets/upload.md` § Refresh replace_period mode (concept, surface, rules table,
      mechanism, wire); surface table gains `PeriodColumnPicker` and `replace_period_parquets`;
      the batch endpoint's 201 description lists shape 4.
- [x] **C** — `datasets/batch-post.contract.yaml`: `refresh_mode` enum `+ replace_period`,
      `period_column`, 201 `oneOf` shape 4 (`required: [datasets, period]`);
      `datasets/refresh-settings-get.contract.yaml`: `period_column`, enum.
- [x] **B** — `ingest/merge.py` `replace_period_parquets` + `PeriodNullError`; `routers/datasets.py`
      mode guards, `_run_replace_period`, `period` wrapper, `commitSettings.period_column`.
      `tests/test_refresh_replace_period.py` +5.
- [x] **F** — types (`RefreshMode`, `period_column`, `PeriodReport`, 201 union); wizard state
      `periodColumn` + `SET_PERIOD_COLUMN`, seeded from the remembered settings (falls back to
      replace if the column is gone or no longer a date); `periodColumnOptions` / `periodBlocked`;
      the commit item moved into `refreshCommitItem(state)` (testable wire shape); Confirm radio,
      picker, blocked alert, confirm note, append-overlap switch; success toast; commit label;
      EN/VI; MSW shape 4. `tests/refresh-replace-period-r189.test.tsx` +9.
- [x] **I / visual gate** — through the real wizard on the cloud runner: a 5-row dataset (1–5 Sept)
      refreshed with a 3-row export (3, 4, 6 Sept). Choosing "Replace a period" disables the commit
      until `day (date)` is picked; the request carries `refresh_mode: replace_period`,
      `period_column: day`; 201 with `period {from 2026-09-03, to 2026-09-06, removed 3, inserted 3,
  kept 2}`; toast "Replaced 2026-09-03 – 2026-09-06: 3 removed · 3 added · 2 kept."; rows now
      ids 1, 2, 30, 40, 60; version 1 → 2; refresh settings remember the mode and column.

## Risks / unknowns

- **Window = the file's own span** — see Watch. A declared period (a "from / to" the user types)
  would answer it; not built without a logged case.
- **Datetime windows** — compared on the incoming dtype after reconciliation; a committed date column
  now read as a datetime casts through the same D5 path as merge (a failure is the merge's cast 422).
- **Started before the rc.2 tag** — as R184–R188 (decision 12).

## Do

- 2026-10-17 — D + C + B: section in `upload.md`, contracts, router, `replace_period_parquets`. The
  fourth `oneOf` entry first landed inside the `404` block (a duplicated mapping key) — moved before
  `'404':`; contracts 46. 5 tests. Backend 580.
- 2026-10-17 — F: state, guards, Confirm block, append switch, toast, i18n, MSW, 9 tests; the inline
  commit-item code in `DatasetNewPage` moved to `state.ts` so its wire shape is unit-tested. Builder 461.
- 2026-10-17 — visual gate: the first backend start failed (port held by the pre-round process);
  stopped it and restarted on the current code; run as above. Nothing written under
  `workspace/apps/backend/data/`.

## Check

- [x] backend 580 · builder 461 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, `design:lint`, `design:tokens`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser through the wizard, screenshots kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — the fourth refresh choice, and offered
      from append's overlap warning where the need shows up; Usability — one picker, only qualifying
      columns, the commit waits for it; Accessibility — the block reuses labelled AntD controls, the
      stop is an alert; Credibility — the note says the window rule, including the removal of rows the
      export no longer has, and the toast reports the window and counts; Utility — weekly re-covering
      exports without doubles or loss; Desirability — no new step.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 4`:
  - ⬜ W1 — refresh a dataset with a file that re-covers its last days using "Replace a period" on
    its date column: the older rows stay, the window holds exactly the new file's rows, the toast
    shows the window and counts, the data version moved by one.
  - ⬜ W2 — open the refresh again: "Replace a period" and the same column are pre-selected.
  - ⬜ W3 — refresh with a file that has a row with an empty date: refused with the count of such
    rows; the dataset is unchanged.
  - ⬜ W4 — choose "Add rows" with a date column that overlaps: the warning offers "Replace this
    period instead", which switches the mode with that column picked.

## Act

_(at close)_

## Feeds into → [Round_190](Round_190.md)

Item 3.6 — publish a workflow output as a derived dataset with lineage; saved copies in
`<workspace>-saved` (label R180) — **opens only after walk session B confirms G-wf** (owner-accepted
2026-10-17 on the agent's recommendation), so the owner pulled item **2.7** (design only:
parameters, view-time date range, shared filters) forward into Round_190; 3.6 moves to Round_191.
