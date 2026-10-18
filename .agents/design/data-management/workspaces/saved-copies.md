# Saved copies — frozen, read-only copies of datasets (item 3.6b)

**Concept**: a **saved copy** is a dataset frozen at the moment someone needed to say "these are the
numbers the decision was based on". The copy lives in a dedicated **saved workspace** — one per main
workspace, named `<workspace>-saved` (settled decision 8) — where **nothing can be changed**: no
refresh, no re-publish, no edit, no run. The original keeps moving (refreshes, re-publishes); the
copy does not, and every surface that shows it says so: _"Frozen copy — not the current numbers."_

**Status**: Draft — design gate of `Round_193` (item 3.6b); BA review at Contract exit folded in
(2026-10-18).

**Domain folder**: `data-management/workspaces/` — the saved workspace is a kind of
[workspace](workspaces.md); the copies are [datasets](../datasets/datasets.md). Sibling:
[workflows.md § Publish](../workflows/workflows.md) (the published dataset a copy often freezes).

---

## Why

A published dataset (3.6a) and an uploaded one both **move**: a refresh or a re-publish replaces
their rows and the dashboards follow. That is right for "the current numbers" and wrong for "the
numbers we decided on last Monday". Before this, the only way to keep last week's numbers was to
export them to Excel — out of the app, out of reach of its definitions and versions. A saved copy
keeps them **in** the app, read-only, with the version and time they were frozen at.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                     | Layer                                                  | Reusability  | Purity             | Allowed peer deps           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------ | ------------------ | --------------------------- |
| `SaveCopyModal` (label input, default today's date)                                         | `apps/builder/src/features/data-management/datasets`   | feature      | feature            | react, antd, react-i18next  |
| `FrozenCopyBand` (the band on a saved copy's page)                                          | `apps/builder/src/features/data-management/datasets`   | feature      | plain-UI (glue)    | react, antd, react-i18next  |
| `useSaveCopiesMutation` hook                                                                | `apps/builder/src/features/data-management/datasets`   | feature      | glue (server-data) | @tanstack/react-query       |
| `useWritableWorkspaces` (main workspaces only — the pickers of create flows)                | `apps/builder/src/features/data-management/workspaces` | feature      | glue (server-data) | @tanstack/react-query       |
| `workspacesApi.saveCopies` client                                                           | `apps/builder/src/api`                                 | builder-only | glue               | (fetch — no extra peer dep) |
| `POST /workspaces/{id}/saved-copies` + the read-only guard on every write route             | `apps/backend/app/routers/`                            | backend      | feature            | (FastAPI — backend native)  |
| `assert_writable` (the guard) + `saved_workspace_for` (create-on-first-use)                 | `apps/backend/app/saved_copies.py`                     | backend      | feature            | (sqlite3 — backend native)  |
| `workspaces.kind` / `parent_workspace_id`, `datasets.saved_from_json` (`0009_saved_copies`) | `apps/backend/app/db_models.py`                        | backend      | data type          | (SQLModel/Alembic)          |

**Boundary check**: no new `@mdd/ui` primitive — the band is an AntD `<Alert>`, the modal an AntD
`<Modal>` with one `<Input>`, as the rest of the dataset page.

---

## Token map

| Surface                      | Source                                        | Value (informational) |
| ---------------------------- | --------------------------------------------- | --------------------- |
| Frozen-copy band             | AntD `<Alert type="info">` (seed `colorInfo`) | derived               |
| "Saved copies" workspace tag | AntD `Tag color="default"`                    | derived               |
| Primary action (Save)        | AntD seed `colorPrimary` (themeTokens.ts)     | `#1677ff`             |

Values come from [`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts); no new
token.

---

## Layout — ASCII intent

```text
DATASET (an original)  ▸ Actions ▾  … · Save a copy… · Rename · Delete
  ┌ Save a copy ─────────────────────────────────────────┐
  │ The copy is frozen: refreshes and re-publishes of     │
  │ "calls" will not change it.                           │
  │ Label  [ 2026-10-18            ]                      │
  │                                   [Cancel] [Save copy] │
  └──────────────────────────────────────────────────────┘

DATASET (a saved copy)  calls @2026-10-18   [CSV]          Actions ▾ (Delete only)
  ⓘ Frozen copy of "calls" — data version 3, saved 18 Oct 2026 09:12 (label 2026-10-18).
     Not the current numbers. [Open the current dataset]
  ── rows (read-only) ──
```

---

## Decisions

### S1 — The saved workspace

- One per main workspace, created **on first save**: `kind: saved`, `parentWorkspaceId` = the main
  workspace (UNIQUE — at most one). Main workspaces are `kind: main` (every existing workspace after
  the migration).
- Named `<main name>-saved` (the main name cut to fit the 80-character limit); if a workspace of that
  name already exists, `-saved-2`, `-saved-3`… The saved workspace is **found by its parent**, never
  by its name, so renaming the main workspace (or a user's own `X-saved` workspace) changes nothing.
- It is listed with the other workspaces, tagged **"Saved copies"** with _"of <main>"_.

### S2 — Saving

- **`POST /workspaces/{id}/saved-copies`**, body `{label, datasetIds}` — `label` 1–40 characters
  (trimmed first; no control characters); `datasetIds` 1–20 datasets **of that (main) workspace**. `201` →
  `{workspace, datasets}` (the saved workspace and the new copies, in request order).
- Refusals: the workspace is itself a saved one → `409 read_only_workspace`; a dataset not in that
  workspace → `422` naming its index (the validation envelope, `unknown_dataset`); a blank label →
  `422`. Nothing is written on any refusal (all copies or none).
- **Each copy**: name `<name> @<label>` — a second save under the same label gives
  `<name> @<label> v2`, then `v3`… (cut to 120 characters, keeping the suffix). Its rows are a copy
  of the original's parquet at that moment; its columns (with `hidden` and coverage) and its
  `sourceFormat` (and `sheetName`, and a published dataset's `lineage` — for display only: a copy is
  never a publish target, its internal `published_workflow_id` stays empty) are the original's. It
  **keeps the original's `dataVersion` and `refreshedAt`** as they were at the save, and they never
  move: the copy's page, its rows and (3.2c) its exports carry the same version as the original
  had — one version number for one set of rows.
- **`savedFrom`** (read-only, server-written) on every copy: `{datasetId, datasetName, workspaceId,
dataVersion, refreshedAt, label, savedAt}` — which dataset, at which version (and when that
  version's rows arrived), saved when, under which label.
- **Metadata goes with it.** The entries on the original dataset and on its columns are copied onto
  the copy **as they are** (same namespace, text, author, time, `definitionVersion`), and the normal
  staleness check runs: an entry already out of date on the original at save time stays flagged on
  the copy; since the copy can never change, no entry can go out of date on it later. (3.8 computes
  its anchor states against `savedFrom`'s version for a copy.)
- **One snapshot.** The save reads the original's version, copies the rows, and checks the version
  again; a copy counts only if the version did not move, the rows file is the one the copy began
  with, and no refresh / re-publish swap was in progress before or after it (a swap keeps the old
  rows as a `<id>.bak*` backup until its new version commits) — otherwise it waits and copies again.
  So `savedFrom` always names the version of the rows the copy holds. A dataset with no stored rows
  (and no swap coming) is refused as `unknown_dataset`. _(R193 code review F1.)_

### S3 — Read-only

Every write on anything inside a saved workspace answers **`409 read_only_workspace`** and changes
nothing — the guard checks the workspace of **every object a write touches** (the path's workspace,
and e.g. a refresh's target dataset, which can be named through another workspace's path): refresh (upload), rename, column visibility, creating or editing a query, workflow,
dashboard or relationship, running or publishing, writing or deleting metadata, renaming the
workspace, and saving copies **from** it. Two exceptions, so a saved workspace can be cleaned up:
**deleting a copy** (`DELETE /datasets/{id}`) and **deleting the empty workspace**; deleting a
saved workspace that still holds copies stays `409 non_empty` (as for any workspace).

Reading works as everywhere: the copy's page, its rows, filters, search, advanced query; the routes
that only compute (preview, aggregate, totals, export, append-overlap) stay open. The guard lives in
the write layer, so any future writer — scheduled refresh (4.1) included — can never touch a saved
workspace. **Deleting a main workspace whose saved workspace holds copies** answers `409 non_empty`
(`datasetCount` = its own datasets plus the copies) — delete the copies first; an **empty** saved
workspace is deleted together with its main one (nothing is lost). So no saved workspace is ever
left without its main one. _(R193 QA Q-1 / BA P2-1 — settles the empty case; a 409 with no dataset
to count would tell the user nothing.)_

### S4 — Surfaces

- **Original dataset** — Actions ▾ gains **Save frozen copy…** (VI _"Lưu bản sao cố định…"_): a
  modal with the label (default today's date, `YYYY-MM-DD`) and one line saying what "frozen" means;
  on success a toast with **Open the copy**.
- **Saved copy's page** — the band (`<Alert type="info">`):
  - an upload: _"Frozen copy of “calls” — data version 3, rows from <refreshedAt>; saved <savedAt>
    (label 2026-10-18). Not the current numbers."_;
  - a published dataset: _"Frozen copy of “Calls by team” — run #7, data version 2, rows from <…>;
    saved <…> (label …). Not the current numbers."_;
  - plus **Open the current dataset** while the original exists, _"(the original no longer
    exists)"_ once it does not.
    The page offers no write action (no Refresh, Rename, Properties visibility, Save as query, Join,
    Save a copy) — Actions ▾ holds **Delete** only.
- **Create flows** (upload, new query, new workflow, new dashboard) list **main** workspaces only.
  Browsing lists (Datasets, Workspaces) show saved workspaces and copies too, without write actions:
  a copy's row menu offers Delete only; the saved workspace's card offers no Rename and no
  Relationships; its relationships page declares nothing. The Workspaces card is tagged
  **"Saved copies"** / _"Bản sao đã lưu"_, _"of <main>"_ / _"của <main>"_.
- **Metadata on a copy is read-only** — the external writer (decision 9) gets `409
read_only_workspace` there; a note about a decision belongs on the original (it is copied at the
  next save) — confirm with the owner if a writer needs otherwise.

---

## Behaviour

| Situation                                                | Result                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| First save in a workspace                                | the saved workspace is created; copies `<name> @<label>`    |
| Same label again                                         | `<name> @<label> v2`                                        |
| The original is refreshed / re-published after a save    | the copy's rows, version and band are unchanged             |
| The original is deleted                                  | the copy stays; the band says the original no longer exists |
| Any write inside the saved workspace (S3)                | `409 read_only_workspace`, nothing changed                  |
| Delete a copy                                            | `204`                                                       |
| Delete the saved workspace with copies / empty           | `409 non_empty` / `204`                                     |
| Delete a main workspace whose saved workspace has copies | `409 non_empty` (own datasets + copies counted)             |
| Delete a main workspace whose saved workspace is empty   | `204` — both go                                             |
| Refresh a copy through its main workspace's path         | `409 read_only_workspace`                                   |
| Save from inside the saved workspace                     | `409 read_only_workspace`                                   |

---

## Acceptance criteria

**User journey** — as a manager I freeze this week's data under a label before the meeting; next
week, after the data has been refreshed, I can still open exactly the rows and the data version
behind what we decided, clearly marked as not current. (Re-computing a widget's number over a copy
needs a query or a frozen dashboard — OUT below; exporting a copy's rows to Excel lands with 3.2c,
`Round_196`.)

1. _(pytest)_ save → `201`; the saved workspace exists once per main workspace (`kind: saved`,
   `parentWorkspaceId`); a second save reuses it; a name collision gets `-saved-2`.
2. _(pytest)_ copies are named `<name> @<label>`, then `v2`; rows, columns, `hidden`, coverage,
   `sourceFormat`, lineage, `dataVersion` and `refreshedAt` equal the original's; `savedFrom` names
   the original and its version; a published dataset can be saved twice (no publisher link on the
   copies).
3. _(pytest)_ a later refresh / re-publish of the original leaves the copy's rows and version as
   they were.
4. _(pytest)_ every write route in S3 answers `409 read_only_workspace` on a saved workspace and
   changes nothing — including a refresh of a copy sent through its main workspace's path; deleting
   a copy works; deleting the saved workspace with copies → `409 non_empty`; deleting a main
   workspace whose saved workspace holds copies → `409 non_empty`; with an empty saved workspace →
   `204`, both gone.
5. _(pytest)_ the original's metadata entries are on the copy; each entry's state on the copy
   equals its state on the original at save time and never changes after.
6. _(pytest)_ refusals write nothing (a dataset from another workspace, a blank label, saving from a
   saved workspace).
7. _(FE)_ Save a copy… on a dataset page → toast → the copy's page shows the band and offers Delete
   only; create-flow pickers do not offer the saved workspace.

---

## Scope boundary

### IN scope

- The saved workspace (kind, parent, naming), the save route, copies with `savedFrom` and copied
  metadata, the read-only guard on every write route, the band, the Save a copy… action, main-only
  pickers in create flows.

### OUT of scope (deferred with named triggers)

- **Saving a whole dashboard** (its queries and widgets frozen over the copies) — _Trigger_: a user
  asks to reopen last week's **dashboard**, not last week's table. Queries cannot be created in a
  saved workspace today, so a copy is read on its own page.
- **Comparing a copy with the current dataset** (a diff view) — _Trigger_: a logged need.
- **Saving several datasets from the Datasets list at once** — the API takes up to 20; the UI saves
  one at a time. _Trigger_: a user saving more than one per week.
- **Moving or un-freezing a copy** — a copy is frozen by definition; delete it instead.

### This concept explicitly does NOT cover

- Dataset storage and refresh — [datasets.md](../datasets/datasets.md).
- Publishing a workflow's output — [workflows.md § Publish](../workflows/workflows.md).
- Metadata entries themselves — [metadata.md](../_shared/metadata.md).

---

## Reference materials (read-only)

- Release program decision 8 (`.agents/plan/programs/release-rc2-rc5/release-rc2-rc5.plan.md`).
- Item spec: `rc3.md` § 3.6 (saved copies part).
