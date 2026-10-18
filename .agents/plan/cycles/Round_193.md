# Round 193: saved copies — frozen, read-only copies in a `<workspace>-saved` workspace (item 3.6b)

**Status**: In Progress
**Flow**: **DFCFBI (triggers 1, 2, 3)** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

_(at close)_

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
- [ ] **B** — migration `0009_saved_copies`; the guard on every write route; the save route; metadata
      copy + never-stale; tests
- [ ] **F** — types; Save a copy… modal; the band; read-only dataset page; main-only pickers;
      workspaces card tag; EN/VI; MSW
- [ ] **I** — visual gate in a real browser
- [ ] Reviews: code review, QA (BA twice) — rc3.md § Execution

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

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] migration `0009` up → down → up
- [ ] Visual gate (UI-bearing round)
- [ ] BA · code review · QA — no open P0/P1

## Act

_(at close)_

## Feeds into → Round_194 (TBD)

Item 3.7a — the parameter engine (contract + backend + MSW), per `dashboard-filters.md` D1–D7.
