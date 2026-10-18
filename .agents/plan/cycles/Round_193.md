# Round 193: saved copies — frozen, read-only copies in a `<workspace>-saved` workspace (item 3.6b)

**Status**: Review — built and reviewed (BA twice, code review, QA + visual gate: no open P0/P1); awaiting the human acceptance walk (W1–W8) and sign-off
**Flow**: **DFCFBI (triggers 1, 2, 3)** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — `POST /workspaces/{id}/saved-copies` freezes 1–20 datasets of a main workspace into
its saved workspace (`kind: saved`, created on first save, found by its parent, `<name>-saved`):
copies `<name> @<label>` (`v2`…) keep the original's rows, columns, format, lineage, `dataVersion`
and `refreshedAt`, carry a server-written `savedFrom`, and take the original's metadata as it is.
Every write inside a saved workspace — 19 routes, checking every object touched — answers `409
read_only_workspace`; deleting a copy or the empty workspace works. Builder: **Save frozen copy…**,
the frozen band ("Not the current numbers — …"), a copy page with Properties + Delete only, the
tagged saved workspace, create flows offering main workspaces only. Migration `0009` is additive.

**Studied** — the reviewers' best catch was the snapshot: a version re-check alone could freeze
the new rows under the old version during a refresh swap; the fix waits for the swap's backup to
clear and checks the rows file itself (QA: 60 saves against 38 live refreshes, 0 mismatches).

## Goal

**Inherits from ← [Round_192](Round_192.md)** — a workflow's output can be published as a dataset,
and a re-publish (like a refresh) replaces its rows under every dashboard reading it.

Keep "the numbers we decided on" inside the app: freeze chosen datasets as labelled, read-only
copies in a dedicated saved workspace (settled decision 8), each saying what it froze and when.

_Track: 1 (product). Pulled by: release program item 3.6 (saved-copies half, split from 3.6a on
2026-10-18) — "what numbers was a decision based on" needs a frozen copy — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: `POST /workspaces/{id}/saved-copies` freezes 1–20 datasets of a main workspace
into its saved workspace (created once, `kind: saved`, `parentWorkspaceId`), copies named
`<name> @<label>` (`v2` on a repeat) with the original's rows / columns / format / lineage and a
server-written `savedFrom`, the original's metadata copied and never stale; every write inside a
saved workspace answers `409 read_only_workspace` except deleting a copy and the empty workspace;
a refresh of the original never reaches the copy; the copy's page carries the band; create flows
offer main workspaces only. Migration `0009` adds the columns both ways.
**Falsified if**: any write route changes something in a saved workspace, a copy moves when its
original is refreshed, a refused save writes anything, or a saved workspace is offered as a
create target.

- [x] **D** — `workspaces/saved-copies.md` (new, Draft); `flow-selector`
- [x] **C** — `workspaces/saved-copies-post.contract.yaml` (+ `.md`); `_shared/workspace.yaml`
      (`kind`, `parentWorkspaceId`); `_shared/dataset.yaml` (`DatasetSavedFrom`);
      `_shared/api-error.yaml` (`read_only_workspace`); `409 read_only_workspace` on the 19 write
      routes' contracts; BA review at Contract exit
- [x] **B** — migration `0009_saved_copies`; the guard on every write route; the save route; metadata
      copy + never-stale; tests
- [x] **F** — types; Save a copy… modal; the band; read-only dataset page; main-only pickers;
      workspaces card tag; EN/VI; MSW
- [x] **I** — visual gate in a real browser
- [x] Reviews: code review, QA (BA twice) — rc3.md § Execution

## Risks / unknowns

- **A missed write route** is a hole in "frozen". The guard is one helper called by every write
  handler; a test walks every write route against a saved workspace.
- **Workspace names are unique globally** — `<name>-saved` can clash or overflow 80 characters;
  the saved workspace is found by its parent, so its name is cosmetic.
- **Reading a copy** is the dataset page only (queries cannot be created there) — declared OUT with
  a trigger (a frozen dashboard).

## Do

- 2026-10-18 — D: `workspaces/saved-copies.md` (new; S1–S4, behaviour, criteria 1–7, scope).
- C: `workspaces/saved-copies-post.contract.yaml` (+ `.md`, `operationId: saveCopies`);
  `_shared/workspace.yaml` `kind` (`main | saved`, read-only) + `parentWorkspaceId`;
  `_shared/dataset.yaml` `DatasetSavedFrom`; `_shared/api-error.yaml` `ApiErrorReadOnlyWorkspace`;
  `409 read_only_workspace` added (scripted, then checked by loading each file) to the 19 write
  routes: datasets batch / patch / columns-patch, workspaces patch, queries post / put / delete,
  workflows post / put / delete / run / publish, dashboards post / put / delete, relationships
  post / delete, metadata put / delete. `workspaces/delete` documents the main-with-saved block.
- **BA review at Contract exit: CHANGES** (P0 ×1, P1 ×6, P2 ×10). Folded in before code: **P0-1** the
  scripted edit broke `datasets/batch-post`'s 409 `oneOf` (the legacy item lost its body) — restored,
  the new reference a separate item, and every 409 `oneOf` in the corpus re-checked; **P1-1** a copy
  keeps the original's `dataVersion` and `refreshedAt` (one version number for one set of rows — a
  copy at "v1" beside a band saying "v3" would be two numbers for the same rows); **P1-2** metadata
  copied as is, normal staleness (no forced "current"); **P1-3** the guard checks every object a write
  touches (a copy refreshed through its main workspace's path); **P1-4** a copy never carries the
  publisher link (saving a published dataset twice); **P1-5** a main workspace with a saved workspace
  cannot be deleted; **P1-6** the journey reworded to rows + version (a widget's number over a copy
  needs a frozen dashboard — OUT; exporting a copy lands with 3.2c). P2 folded: one snapshot
  (re-check the version after the copy), read-only routes stay open + the 4.1 note, write actions
  hidden on copies / the saved workspace, the band shows when the rows arrived, "Save frozen copy…"
  wording, metadata on copies read-only (owner to confirm). Logged: duplicate-label hint, delete
  confirm wording.

- F1 (`7e6e281`): `SaveCopyModal` + toast, `FrozenCopyBand`, copy page (Properties read-only +
  Delete), copy rows Delete-only, saved workspace card (tag, "of <main>", Delete only), relationships
  page declares nothing, `useWritableWorkspaces` in the create flows; `read_only_workspace` in the
  generated codes and the client union; MSW `saveCopies`; 7 vitest.
- B (`23f0e76`): `0009_saved_copies` (ADD COLUMN only — no parent-table rebuild; no FK on the parent
  link so downgrade can drop it); `app/saved_copies.py` (`read_only_refusal`, `saved_workspace_for`,
  `save_copies`); the save route; the guard on the 19 routes; delete rules; 12 pytest including one
  walking every write route against a saved workspace with a whole-database before/after compare.
- **Reviews after build** — code review **CHANGES** (P1 ×2: the snapshot race F1; Upload still
  reachable in a saved workspace F2; P2 ×5), QA **CHANGES** (P1: an empty saved workspace deleted
  with its main one, against the design text; P2 ×4), BA **CHANGES** (P1: the same Upload path; P2 ×6
  — the empty-saved-workspace deviation judged acceptable, docs to follow).
- Fix (`7544b4c` + close-out): snapshot waits out a swap and checks the rows file; a dataset with no
  stored rows → 422; `BEGIN IMMEDIATE`; a refused first save removes its empty saved workspace (row
  and folder); label trimmed before its length, control characters refused; no Upload in a saved
  workspace and the wizard ignores a saved `?workspace`; a copy's refresh URL returns to its page;
  "Saved" on a copy, the band leads with "Not the current numbers", "rows as of", toast 6 s; design
  S2/S3/behaviour/AC4 and `workspaces/delete` updated for the empty case. QA re-check **PASS**
  (6 parallel saves all 201; 60 saves vs 38 live refreshes, 0 mismatches) + visual gate 9/9.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                               |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | save (first / reuse / collision), copy page, read-only refusals across 19 routes, deletes allowed / blocked |
| 2. New interaction pattern           | yes    | the first read-only workspace: a container where every write affordance must disappear                      |
| 3. High user-error risk              | yes    | deleting a copy destroys "the numbers we decided on"; a missed write route breaks the promise silently      |
| 4. Contract depends on unresolved UI | no     | the request / response shapes follow from the journey                                                       |
| 5. UX confidence below threshold     | no     | the band and the modal follow established page patterns                                                     |

Result: **Flow: DFCFBI (triggers 1, 2, 3)** — the builder (F1) against MSW before the backend.

## Check

- [x] backend 626 · builder 513 · contracts 48 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] migration `0009` up → down → up (`test_saved_copies.py` + QA on an alembic-built database with
      relationships: no row lost, `foreign_key_check` clean)
- [x] Visual gate (UI-bearing round): QA, real backend + headless Chromium, 9 screens, EN + VI band
- [x] BA · code review · QA — no open P0/P1
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 8`. Setup: a new
      workspace **Freeze**; `walk_calls.csv` uploaded as **calls**; a note on it is optional.
  - ⬜ W1 — open **calls** › Actions: **Save frozen copy…**; the modal's label is today's date and the
    preview reads "calls @<today>"; Save → toast "Saved “calls @<today>”." with **Open the copy**.
  - ⬜ W2 — open the copy: the band "Not the current numbers — frozen copy of “calls”: data version
    1, rows as of …; saved … (label <today>)" and **Open the current dataset**; subtitle "Saved …";
    Actions = Properties (no toggles) + Delete; no Save as query.
  - ⬜ W3 — Workspaces: a **Freeze-saved** card tagged "Saved copies" · "of Freeze", menu Delete
    only; open it: no Upload; its Relationships page has no Declare.
  - ⬜ W4 — refresh **calls** with `walk_calls_more.csv` (Add rows): **calls** is v2 with more rows;
    the copy still v1, same rows. Save again with the same label → "calls @<today> v2", v2's rows.
  - ⬜ W5 — Upload, new query, new workflow, new dashboard: the workspace pickers list **Freeze**,
    not **Freeze-saved**.
  - ⬜ W6 — Workspaces › delete **Freeze** → refused ("has N datasets…", N counting the copies).
  - ⬜ W7 — delete **calls** (the original): the copy's band now says "The original dataset no longer
    exists"; its rows still open.
  - ⬜ W8 — VI: the band reads "Không phải số liệu hiện tại — bản sao cố định của “calls”: …"; the
    card tag "Bản sao đã lưu" · "của Freeze".

## Act

- Rolling log: five rows (copy metadata orphaned on delete → 3.8; a stale `.bak` makes a save 500
  after ~10 s → with the per-dataset lock; the workspace-delete message counting copies; saved-copies
  polish; the owner's call on metadata writers over copies).
- Promotion: none. Candidate lesson (memory, if it recurs): a "re-check the version" consistency
  guard must also cover the window between a file swap and its version bump — check the file, not
  only the counter.
- Prune check: the BA's two passes each found a P1 the coder missed (Contract exit: five; after
  build: the Upload path) — the loop earns its place.

## Feeds into → Round_194

Item 3.7a — the parameter engine (contract + backend + MSW), per `dashboard-filters.md` D1–D7.
