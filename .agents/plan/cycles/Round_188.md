# Round 188: refresh with several files at once — stack, then apply the mode

**Status**: Review — D, C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W4) and sign-off
**Flow**: DCFBI — one request field + one wizard block, contract-first; verified through the real wizard against a dataset that a workflow reads.
**Date started**: 2026-10-17
**Date completed**: —

## ⟢ At a glance

**Shipped** — a refresh accepts several uploads as **one** refresh: `POST
/workspaces/{id}/datasets/batch` takes `extra_temp_ids` (1–19, beside `temp_id`). The files are
parsed with the item's settings, must have the first file's columns (any order), are coerced to the
first file's committed dtypes, and are stacked in the order given; replace / merge / append then
applies to the stack. One `dataVersion` bump, one coverage profile, one swap; each row's
`Source.Name` names its own file. A bad file fails the whole refresh with the file named (422 for
other columns, `coercion_failed` with a new optional `file` for a value that does not fit) and
nothing committed; a key repeated across files under merge is the merge's duplicate-key stop. The
refresh wizard's Confirm step gets a "More files in this refresh" block (add / remove, uploaded on
add). A single-file refresh takes the unchanged path. Backend 575 · builder 452 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** the hard part was the stacking SQL.
**Saw** that it is the order: a list of parquets read together has no promised row order, so the
stack sorts explicitly on file index and in-file row number; and that dtypes are where files really
differ (one month all-integer, the next with a decimal) — which the first file's coercion targets
turn into a named, all-or-nothing 422 instead of a silent widening. **Now believe (high)** that
"one refresh, many files" belongs in the refresh, not in a new step: every guard the single file
had (staging, coercion, merge key, swap, version) applies unchanged to the stack.

**Watch** — the Metadata / Preview / Drift steps look at the first file only; the other files are
checked at commit. The Confirm table's row count is the first file's (a note says so). Twenty
files is a guess at "a year of months plus slack"; raise it only with a logged case. The upload
dialog's MSW mock had a `temp_id` that broke its own contract (8 hex instead of 16) — fixed; nothing
had exercised it before.

## Goal

**Inherits from ← [Round_187](Round_187.md)** — rc.3 batch 1 closed (compute, data versions,
workflow guards and run stamps). The weekly export of one dataset often comes as several files; today
each must be refreshed in turn (one version bump each, and a replace would keep only the last file).

Let one refresh take all the files of a period.

_Track: 1 (product). Pulled by: the release program's item 3.4 (label R178, `Round_175` § Feeds into:
"refresh: multi-file merge"), placed before publish by the 2026-10-17 decision — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: two files replace a dataset with their stacked rows in order and one version
bump; append adds both; merge works over a stack and refuses a key repeated across files; columns in
another order are accepted; other columns or a value that does not fit fail with the file named and
nothing committed; extras without a refresh, repeated, unknown or of another format are refused; one
file behaves exactly as before.
**Falsified if**: a failed file leaves part of the stack committed, or the version moves more than
once per refresh.

- [x] **D** — `datasets/upload.md` § Refresh with several files (concept, surface, rules table,
      mechanism, wire); surface table gains `UploadDriftStep`, `RefreshExtraFiles`, `stack_parquets`.
- [x] **C** — `datasets/batch-post.contract.yaml` request `extra_temp_ids`;
      `_shared/api-error.yaml` `ApiErrorCoercionFailed.file`.
- [x] **B** — `routers/datasets.py`: `_BatchRequest.extra_temp_ids` (distinct, ≤ 19),
      `_extra_uploads`, per-file column check, staged parts + `ingest/merge.stack_parquets`, row
      count over all files, extra originals + `source.json.extraFiles`, `_coercion_response` with
      `file`; create with extras → 422. `tests/test_refresh_multi_file.py` +8.
- [x] **F** — wizard state `extraFiles` + `ADD_EXTRA_FILE` / `REMOVE_EXTRA_FILE`; Confirm-step
      `RefreshExtraFiles` (upload on add, list, remove, row-count note); commit sends
      `extra_temp_ids`; the coercion error names the file first; EN/VI; MSW `temp_id` fixed to the
      contract; `tests/refresh-multi-file-r188.test.tsx` +6.
- [x] **I / visual gate** — through the real wizard on the cloud runner: refresh the 7-row R184
      dataset with itself plus two more files → the Confirm block lists all three; commit → 201,
      10 rows in file order with each file's name in `Source.Name`, version 4 → 5, and the R186
      workflow over it now reads `data_refreshed` for both sources.

## Risks / unknowns

- **Per-file dtype drift** — handled by coercing to the first file's targets; a file that cannot fit
  fails loudly. A file whose column is _better_ typed than the first (decimal where the first was
  integer) also fails — correct for the committed schema, and the error says which file and column.
- **Memory / time** — each file is written once to a staged part, then one DuckDB COPY stacks them;
  no pandas round-trip beyond the existing coercion detour.
- **Started before the rc.2 tag** — as R184–R187 (decision 12).

## Do

- 2026-10-17 — owner accepted the close-out proposals ("ok với đề xuất, go ahead"): G-wf passes on
  the agent's recommendation, to be confirmed by walk session B before item 3.6 opens.
- 2026-10-17 — D + C + B: section in `upload.md`, request field, error field, router, stack helper.
  The test helper first expected `201` from `POST /uploads` (it answers `200`). 8 tests. Backend 575.
- 2026-10-17 — F: state, Confirm block, commit wiring, error text, i18n, 6 tests. The upload test
  failed on the MSW mock's own contract (`tmp_aaaaaaaa`, 8 hex) — fixed to 16 hex. Builder 452.
- 2026-10-17 — visual gate: the first commit answered 422 "extra inputs not permitted" — the runner's
  backend was the pre-round process; restarted, re-ran: 201 as above. Nothing written under
  `workspace/apps/backend/data/`.

## Check

- [x] backend 575 · builder 452 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, `design:lint`, `design:tokens`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser through the wizard, screenshot kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — on Confirm, under the refresh mode it
      feeds; Usability — add several at once, remove one, order shown; Accessibility — labelled
      remove buttons, upload errors as alerts; Credibility — the note says the row count is the
      first file's, each row keeps its file name; Utility — a period's files in one refresh;
      Desirability — no new step.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 4`:
  - ⬜ W1 — refresh a dataset (Replace) with two monthly files: the dataset holds both files' rows,
    the data version moved by one, and the hidden `Source.Name` column names each row's file.
  - ⬜ W2 — the same with Add rows (append): the committed rows stay and both files are added.
  - ⬜ W3 — add a file with a different column: the refresh is refused naming that file; the dataset
    is unchanged.
  - ⬜ W4 — refresh with one file only: nothing looks or behaves differently from before.

## Act

_(at close)_

## Feeds into → Round_189 (TBD)

Item 3.5 — `replace_period` refresh mode: the period is the incoming file(s)' `[min, max]` of a
date column (over the whole stack when several files arrive), committed rows inside it are replaced,
older rows kept.
