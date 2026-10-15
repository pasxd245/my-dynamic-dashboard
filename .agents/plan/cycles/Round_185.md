# Round 185: dataset data identity — `refreshedAt` + `dataVersion`, stamped by the server

**Status**: Review — C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W3) and sign-off
**Flow**: DCFBI — two read-only fields + one migration, contract-first, verified by migrating a database that already held datasets.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — every dataset now carries `refreshedAt` (when its rows last changed) and
`dataVersion` (1 at commit, +1 on every successful refresh — replace, merge or append). Both are
written by the server only, in the same UPDATE that swaps the refreshed rows in; no request body
can set them (422), and a rename, a column-visibility change or a failed refresh leaves them
alone. Migration `0006_dataset_data_version` appends the two columns, backfills `refreshed_at`
from `created_at` and starts every existing dataset at version 1; downgrade drops them. The
dataset page's metadata strip (and the Properties drawer, which shares it) shows **Data version ·
v3 · 2h ago**. This is the version a workflow run (R187) and a frozen copy (T-c) will record.
Backend 548 · builder 438 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** a timestamp alone would do ("data as
of the last refresh"). **Saw** that two refreshes inside the same second are indistinguishable by
time, and that a reader comparing "the data I wrote this note against" with "now" needs equality,
not ordering. **Now believe (high confidence)** that the counter is the identity and the time is
for people: anything that records "which data" stores `dataVersion`; `refreshedAt` is what the UI
says.

**Watch** — `refreshed_at` is nullable in SQLite (ADD COLUMN cannot add NOT NULL without a
default); every write path sets it and hydration falls back to `created_at`. The version counts
refreshes of _this_ dataset id; deleting and re-creating a dataset with the same name starts over
at 1 under a new id, which is correct (different identity) but worth saying in the docs that
cite it. Refreshes made before 0006 left no stamp: existing datasets read v1 at their created
time.

## Goal

**Inherits from ← [Round_184](Round_184.md)** — rc.3 T-b begins. A workflow output, a note
and (next) a frozen copy all want to say "computed from _these_ rows". Today a dataset's rows can
be replaced in place by a refresh with no trace on the dataset itself, so nothing downstream can
tell that its input moved.

Give the dataset a data identity the server owns.

_Track: 1 (product). Pulled by: the rc.3 plan's T-b / W-4 ("dataset has `refreshed_at` +
`data_version` written by the server on load / refresh, stamped into the R145 refresh path") and
gate G-wf ("`data_version` / `run_id` written by the server, not writable by a client") — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: commit → v1 at created time; replace, merge, append → v2, v3, v4 with a
later `refreshedAt`; rename and column visibility → unchanged; a refresh that 422s → unchanged; a
body carrying `dataVersion` / `refreshedAt` → 422; a pre-0006 database migrates with every
dataset at v1, `refreshedAt = createdAt`, and downgrades cleanly.
**Falsified if**: a client can move either field, or the version changes without the rows
changing.

- [x] **D** — a counter (identity) + a time (for people); server-only; bumped in the swap's own
      UPDATE so no reader sees new rows under an old version.
- [x] **C** — `_shared/dataset.yaml`: `refreshedAt`, `dataVersion` (required, `readOnly`);
      list / detail examples carry them.
- [x] **B** — `db_models.Dataset` (`refreshed_at`, `data_version` DEFAULT 1);
      `alembic/versions/0006_dataset_data_version.py`; `models.common.Dataset`; commit INSERT,
      refresh UPDATE (`data_version = data_version + 1`); the three hydration sites folded into
      `_dataset_from_row`; `test_schema_parity.py` legacy shape + head pin;
      `tests/test_dataset_data_version.py` +6.
- [x] **F** — `types.Dataset` fields; metadata strip / drawer item; EN/VI i18n; MSW commit (v1)
      and refresh (+1, including replace now answering with the target dataset); fixtures;
      `tests/dataset-data-version-r185.test.tsx` +2; the drawer's fact count 6 → 7.
- [x] **I / visual gate** — restarted the cloud runner on the existing scratch database: 0006 ran
      (`0005 → 0006` in the log), the four existing datasets read v1; two refreshes of the R184
      dataset → v2, v3; the page shows `DATA VERSION · v3 · Just now`.

## Risks / unknowns

- **Parity test pins column order and defaults** — the columns are appended (ADD COLUMN) in the
  migration, the model and the frozen legacy schema alike; `DEFAULT 1` matches as `'1'` in all
  three.
- **A refresh path that forgets the stamp** — there is one UPDATE that swaps rows in; the test
  drives all three modes through it.
- **Started before G-start3** — as R184.

## Do

- 2026-10-15 — C + B: migration, model, contract, stamps; the first test sent `merge_key` as a
  string (it is a list). 6 tests + parity. Backend 548.
- 2026-10-15 — F: type, strip item, i18n, MSW, fixtures, 2 tests; the R153 drawer test counted
  six dataset facts — now seven. The first label read `refreshed Just now` (relative time is
  capitalised); dropped the verb. Builder 438.
- 2026-10-15 — visual gate on the cloud runner against scratch data (above). Nothing written
  under `workspace/apps/backend/data/`.

## Check

- [x] backend 548 · builder 438 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Migration up on a database with data; up + down in a test
- [x] Visual gate (UI-bearing round): real browser, screenshot kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — in the metadata strip beside
      Uploaded; Usability — read-only, nothing to do; Accessibility — plain text; Credibility —
      the server's own counter; Utility — "did these rows change since?"; Desirability — one
      short line.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 3`:
  - ⬜ W1 — open a dataset: the strip reads `Data version · v1 · <when uploaded>`. Refresh it
    (any mode): it reads v2 and a fresh time.
  - ⬜ W2 — rename the dataset and hide a column: the version does not move.
  - ⬜ W3 — start the app on a copy of an existing database: it starts, every dataset reads v1,
    and every number on every dashboard is unchanged.

## Act

_(at close)_

## Feeds into → Round_186 (TBD)

R186 — consolidate workflows: sources of different shape → 422 (W-2), the provenance column
names each row's source so a union is not double-counted (W-3), and sources are validated when the
workflow is saved, not first at run (W-5).
