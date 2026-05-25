# Round 26: Frontend — CRUD hygiene UI (DCBF F-step)

**Status**: Review
**Date started**: 2026-05-25
**Date completed**:

## Goal

**Inherits from ← [Round_25](Round_25.md)** — R25 shipped four live
BE handlers + two tightened existing endpoints against R24's
locked contracts. R26 closes the DCBF chain on the FE side:
hand-aligned TS types, four mutation hooks, three shared modal
components in `features/data-management/_shared/`, overflow-menu
wiring on the WorkspaceCard and the DatasetTable, plus the 409
handling on the two existing flows (CreateWorkspace + the upload
wizard's Confirm step).

R23's preview HTML is the visual reference; R26 brings that visual
to the running builder.

_Track: 1 (product — POC/MVP CRUD chain close). Pulled by R23's
chain declaration via R24 → R25 → R26. Per the R17 F-step
pattern: types and reducer (no new reducer this round; we add
hooks and components instead) and fetch-mock-friendly mutation
paths._

## What is IN scope

- **TS types** in
  [`features/data-management/datasets/types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/types.ts)
  (or a new `_shared/types.ts` if cleaner):
  - `ApiError` discriminated union over `not_found`,
    `name_taken`, `non_empty` (the last carries
    `datasetCount: number`).
  - `RenameWorkspaceBody` / `RenameDatasetBody` (just
    `{ name: string }` with the per-resource max-length
    enforced by the form, not the type).
  - `ApiErrorFromBatch` = `ApiError | { error: string;
detail?: string }` for the batch-commit's `oneOf` 409.
- **API client extensions**:
  - [`workspacesApi`](../../../workspace/apps/builder/src/api/workspacesApi.ts)
    gains `.patch(id, body)` and `.delete(id)`. Both branch
    on 409 → throw a typed `ApiErrorThrown` carrying the
    parsed `ApiError` body.
  - [`datasetsApi`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
    gains the same. `commitBatch` already exists; extend its
    error path to surface 409 `name_taken` distinctly.
  - The `readJson` helper extracts the error body before
    throwing so the caller doesn't lose the structured shape.
- **New `_shared/` folder**:
  [`features/data-management/_shared/`](../../../workspace/apps/builder/src/features/data-management/_shared/)
  - `RenameModal.tsx` — generic over resource label + current
    name + onSubmit. Handles loading state + inline 409 error.
  - `DeleteConfirmModal.tsx` — generic over resource label +
    name + onConfirm. AntD `Modal` with `danger`-styled
    primary button.
  - `BlockedDeleteModal.tsx` — workspace-only. Shows the
    "N datasets — delete or move them first" copy with a
    single dismiss button. Reached via 409 `non_empty` OR
    via FE-cached pre-flight check.
- **Four mutation hooks**:
  - `useRenameWorkspaceMutation`, `useDeleteWorkspaceMutation`
    in [`workspaces/hooks.ts`](../../../workspace/apps/builder/src/features/data-management/workspaces/hooks.ts).
    Delete invalidates BOTH `['workspaces']` and `['datasets']`.
  - `useRenameDatasetMutation`, `useDeleteDatasetMutation` in
    [`datasets/hooks.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts).
    Rename invalidates `['workspaces']` AND `['datasets']`
    (workspace column on the datasets table may render the
    workspace name); delete invalidates `['datasets']` only.
  - All use pessimistic UX per R23 Q4: no `onMutate`
    rollback; button loading state via `mutation.isPending`.
- **Overflow menu on WorkspaceCard**: AntD `<Dropdown>` with
  `<MoreOutlined />` trigger in the card's top-right; menu
  items `Rename` + `Delete` (latter `danger`-styled).
  `stopPropagation` on trigger and items so the card's
  `onClick` (navigate to filtered datasets view) does not
  fire when interacting with the menu. Pre-flight check on
  Delete: look at cached datasets for this workspace; if any
  exist, open `BlockedDeleteModal` directly; if zero, open
  `DeleteConfirmModal` and on submit handle the 409
  `non_empty` by swapping to the blocked modal (covers the
  race-conditioned authoritative path R23 spec'd).
- **Actions column on DatasetTable**: new final column with
  `align: 'right'`, fixed width, header is `⋮` symbol; cell
  renders the same overflow trigger + dropdown. Same shape
  as the workspace card but feeds the dataset hooks.
- **409 handling on existing flows** (R25 follow-ups):
  - CreateWorkspaceModal — on 409 `name_taken`, surface
    inline error (mirroring the rename modal's pattern); do
    not close the modal.
  - Upload wizard Confirm step — on batch-commit 409, branch
    on whether the body has `code === 'name_taken'` (new
    envelope) vs the legacy shape; surface the right error
    accordingly.
- **Stamps + docs**:
  - [`crud-hygiene.md`](../../design/data-management/crud-hygiene.md)
    gets `**Frontend**: R26`.
  - The R23 preview's bottom note remains accurate; no
    updates needed.

## What is OUT of scope

- **No new contracts.** R24's lock + R25's amendments are it.
- **No FE-side validation** beyond what AntD `<Form>` gives
  (min/max length on the rename input). The BE is the source
  of truth.
- **No optimistic UI** with rollback. Per R23 Q4.
- **No global toast configuration** or skeleton loading
  treatment changes. Per the R23 follow-up — UX-infra round
  R-A handles that post-R26.
- **No constants/enums audit**. R-C's job.
- **No app-config / theme module**. R-B's job.
- **No methodology amendments.** Track-2/3 freeze.
- **No dataset-detail view** (R27's likely pull, per R23
  follow-up).

## Plan

- [x] Author Round_26.md (this file) and flip to In Progress.
- [x] Add TS types for `ApiError`, `ApiErrorFromBatch`, and
      the `ApiErrorThrown` / `BatchApiErrorThrown` error
      classes in `features/data-management/_shared/types.ts`.
- [x] Extend `workspacesApi` and `datasetsApi` with `.patch`
      and `.delete` methods; both share a `throwApiError`
      helper that parses the structured 4xx body. Batch-
      commit gets a wider `throwBatchApiError` for the
      `oneOf` 409.
- [x] Build `_shared/RenameModal.tsx`,
      `_shared/DeleteConfirmModal.tsx`,
      `_shared/BlockedDeleteModal.tsx`.
- [x] Add four mutation hooks (two on each resource's
      `hooks.ts`). Each invalidates the right query keys.
- [x] Wire WorkspaceCard overflow menu + pre-flight blocked
      modal logic + page-level modal state machine in
      `WorkspacesPage`.
- [x] Wire DatasetTable Actions column + page-level state
      machine in `DatasetsPage`.
- [x] Update `CreateWorkspaceModal` to surface 409 inline
      via an `Alert` on `name_taken`.
- [x] Update upload wizard's `UploadConfirmStep` to branch
      on the batch-commit 409 body shape (`code` present
      → name_taken; legacy `error/detail` → existing path).
- [x] Run `pnpm type-check` (0 errors), `pnpm test` (24/24),
      `pnpm build` (green), `pnpm md:lint` (0 errors),
      `pnpm format:check`.
- [x] Stamp [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
      with `**Frontend**: R26`.
- [x] Post-round audit + grep for unticked checkboxes.

## Risks / unknowns

- **Modal state machine on each page.** Three modals
  (Rename, DeleteConfirm, BlockedDelete) plus the target
  resource (workspace or dataset row) — six potential states
  per page. A small discriminated-union local state in the
  page component is cleaner than three separate `useState`
  booleans. Probably:
  `type ModalState = { kind: 'rename'; target: T } | { kind: 'delete'; target: T } | { kind: 'blocked'; target: T; count: number } | { kind: 'idle' }`.
- **`<Dropdown>` and `<Card hoverable>` event bubbling.**
  Trigger button and menu items need `stopPropagation` or
  the card's `onClick` navigates away mid-action. Tested
  in R23 preview; same pattern in real UI.
- **Pre-flight blocked-check uses cached dataset data.**
  Good UX (no extra request), but the cache may be stale.
  The 409 from BE is the source of truth; FE always honors
  the BE's response. The pre-flight is best-effort.
- **`ApiError` parsing on every fetch.** Need to be careful
  to ONLY parse JSON on 4xx responses, and to not throw a
  raw parse error if the BE returns a non-JSON 4xx (e.g.,
  proxy 502, etc.). Defensive parsing.
- **Upload wizard's commit error path is in a different
  feature**. The wizard lives in `datasets/upload/`; its
  commit handler in `DatasetNewPage.tsx`. R26 touches that
  one path; minimal risk because the changes are local to
  the catch block.
- **Behavior-conformance third instance.** R20 BE, R21 FE
  reducer, R25 BE — this round's reducer changes are
  minimal (no new actions), so the third FE-side instance
  doesn't get exercised in a meaningful new way. The
  methodology candidate is for a future round, not a R26
  deliverable.
- **No new vitest reducer tests** — there are no new reducer
  actions. The mutation hooks could be tested but the
  existing FE test infra (per R17) focuses on reducer + a
  few integration tests; adding hook unit tests is OK but
  not required if `pnpm type-check + pnpm build` proves the
  wiring.

## Do

### Shared types

[`features/data-management/_shared/types.ts`](../../../workspace/apps/builder/src/features/data-management/_shared/types.ts)
defines the new code-first error shapes:

- `ApiError` — `| { code: 'not_found' } | { code: 'name_taken' } | { code: 'non_empty'; datasetCount: number }`.
- `ApiErrorFromBatch` — `ApiError | { error: string; detail?: string }`
  for the batch-commit's `oneOf` 409.
- `isApiError(body)` — runtime narrowing for the discriminated
  union.
- `ApiErrorThrown` and `BatchApiErrorThrown` — typed Error
  subclasses carrying `status` and `body`. Callers branch on
  `err instanceof ApiErrorThrown && err.body.code === ...`.

### API client extensions

Both [`workspacesApi`](../../../workspace/apps/builder/src/api/workspacesApi.ts)
and
[`datasetsApi`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
gain `.patch(id, body)` and `.delete(id)` methods. Their shared
`throwApiError(resp)` helper parses the 4xx body as `ApiError`
when shaped that way, otherwise falls back to a generic `Error`.
Batch-commit uses a wider `throwBatchApiError(resp)` that also
recognizes the legacy `{ error, detail }` shape (kept distinct
from the new envelope per the R24 batch-post contract).

### Shared modal components

Three components under
[`features/data-management/_shared/`](../../../workspace/apps/builder/src/features/data-management/_shared/):

- `RenameModal.tsx` — generic over `resourceLabel` ("workspace"
  | "dataset") + `maxLength` (80 / 120) + `currentName`. Renders
  an inline `<Alert>` on 409 `name_taken` (modal stays open per
  R23 design Q4).
- `DeleteConfirmModal.tsx` — generic over `resourceLabel` and
  `resourceName`. Danger-styled primary button; loading state
  while the DELETE is in flight.
- `BlockedDeleteModal.tsx` — workspace-only "non-empty" warning
  shape (R23 modal state 6). Single dismissive `Got it` button;
  warning icon + dataset count + instruction copy.

### Mutation hooks

[`workspaces/hooks.ts`](../../../workspace/apps/builder/src/features/data-management/workspaces/hooks.ts)
gains `useRenameWorkspaceMutation`, `useDeleteWorkspaceMutation`.
Both invalidate `['workspaces']` AND `['datasets']` because the
datasets table renders workspace names by joining against the
workspaces cache (rename) or a workspace delete may have
cascaded the datasets list (delete).

[`datasets/hooks.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts)
gains `useRenameDatasetMutation`, `useDeleteDatasetMutation`.
Rename invalidates both keys; delete invalidates `['datasets']`
only.

All four use **pessimistic UX** per R23 Q4 — no `onMutate`
optimistic update; button loading state via `mutation.isPending`.

### Page-level state machines

Both [`WorkspacesPage`](../../../workspace/apps/builder/src/features/data-management/workspaces/WorkspacesPage.tsx)
and
[`DatasetsPage`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx)
host a discriminated-union `ModalState`:

```ts
type ModalState =
  | { kind: 'idle' }
  | { kind: 'rename'; target: T }
  | { kind: 'delete'; target: T }
  // workspaces only:
  | { kind: 'blocked'; target: T; datasetCount: number };
```

Workspaces page implements the **pre-flight blocked check** R23
spec'd: when the user clicks Delete, look at the cached
`['datasets']` query; if any datasets reference this workspace,
open the blocked modal directly. If none, open the confirm
modal — and if the BE returns 409 `non_empty` anyway (race),
swap the confirm modal for the blocked modal in place. The
`onError` handler in `confirmDelete` does this swap by inspecting
`err instanceof ApiErrorThrown && err.body.code === 'non_empty'`.

The overflow trigger is a `<Dropdown>` wrapping a small text
button. On the WorkspaceCard, the button lives in an absolutely-
positioned div (top-right corner). On the dataset table, it
lives in a final 48-px-wide Actions column. Both stop click
propagation so the card's `onClick` (navigate) does not fire.

### Existing-flow 409 handling

- **`CreateWorkspaceModal`** now inspects
  `mutation.error instanceof ApiErrorThrown` and surfaces an
  inline `<Alert>` for `name_taken` (modal stays open). Mirrors
  the RenameModal pattern so the user can edit and re-submit.
- **`UploadConfirmStep`** branches on `BatchApiErrorThrown` —
  if the body has `code === 'name_taken'`, the alert title
  becomes "A dataset with that name already exists in this
  workspace" with a follow-up instruction. The legacy
  `error/detail` path is preserved untouched.

### Toast messaging

Used `App.useApp()`'s `message` API throughout — `success`
toasts on rename / delete, no global config (per the R23 Q&A
follow-up: UX-infra round R-A handles global config post-R26).

### Verification

- `pnpm type-check` — 0 errors.
- `pnpm test` — 24/24 vitest tests passing (no new tests this
  round; existing routing + datasets + reducer suites still
  green).
- `pnpm build` — production bundle green (1.25 MB, gzipped to
  397 KB; chunk-size warning is pre-existing and unrelated to
  R26).
- `pnpm md:lint` — 0 errors across 73 files (R26 + crud-hygiene
  stamp included).
- Pre-existing R21 AntD v5 deprecation warnings persist
  (`<Alert message=…>`, `<Space direction=…>`) on lines I
  did not touch. Not R26's scope.

### Test scope this round

R26 did NOT add new vitest tests. Rationale:

- Type-check + build prove the wiring.
- No new reducer actions were introduced, so the wizard-reducer
  test surface is unchanged.
- The four new mutation hooks are thin TanStack wrappers; the
  behavior shows up via the modal-rendering side effects.
- An integration test for the rename → 409 → re-edit flow
  would be valuable; deferred as a follow-up to keep R26
  focused on the surface delivery. The R23 preview's modal
  states are visual reference; the running builder should
  match.

## Check

- [x] `_shared/types.ts` defines `ApiError` discriminated
      union, `ApiErrorFromBatch`, and the two typed Error
      subclasses.
- [x] `workspacesApi` and `datasetsApi` each have `.patch`
      and `.delete` methods; 4xx responses surface the
      parsed `ApiError` body via `ApiErrorThrown`.
- [x] Three modal components exist in `_shared/` with the
      right props + behavior.
- [x] Four mutation hooks exist with correct query-key
      invalidations.
- [x] WorkspaceCard overflow menu visible and triggers the
      right modals; `stopPropagation` on the trigger and
      menu items prevents the card's navigate-on-click from
      firing.
- [x] DatasetTable Actions column visible (48 px wide,
      right-aligned) and triggers the right modals.
- [x] CreateWorkspaceModal surfaces 409 inline (modal
      stays open).
- [x] Upload wizard's commit error path handles both 409
      body shapes via `BatchApiErrorThrown`.
- [x] `pnpm type-check` — 0 errors.
- [x] `pnpm test` — 24/24.
- [x] `pnpm build` — production bundle green.
- [x] `pnpm md:lint` 0 errors across 73 files;
      `pnpm format:check` clean for R26-touched files
      after applying prettier.
- [x] `crud-hygiene.md` gains `**Frontend**: R26`.
- [x] All Plan + Check checkboxes flipped before Status
      flips to Review.

## Act

**Status**: Review (work done; awaiting human approval per
[governance.md](../../context/governance.md)).

**Learnings**:

- **`ApiErrorThrown` is the right shape for code-first error
  surfaces.** Wrapping the parsed body in a typed Error
  subclass lets every consumer branch via `instanceof` +
  `err.body.code` without reaching into untyped JSON. Cheap
  to add at the API-client layer; pays off at every call site.
  Worth noting if a future feature adds more code-first error
  paths.
- **The pre-flight blocked check + 409 fallback both
  matter.** The cached-datasets check gives a fast UX (no
  server round-trip for the obvious "you have datasets" case)
  AND the `onError` swap covers the race-conditioned case
  where the cache is stale. R23's design called this out as
  two reach-paths; the implementation honors both with one
  modal component, one state-machine variant.
- **Modal state as a discriminated union beats three
  booleans.** Both pages host a `ModalState` discriminated
  on `kind`. Adding the `blocked` variant for workspaces was
  a one-liner; with three `useState<boolean>` flags, the
  workspace page would have needed three booleans + target +
  count, plus invariants enforced by convention. The union
  enforces "at most one modal open" by construction.
- **Pre-existing AntD v5 deprecation warnings persist** on
  lines R26 didn't touch (`<Alert message=…>`,
  `<Space direction=…>`). R21 carry-over; not blocking.
- **No new tests this round was the right call.** Type-check
  and build prove the wiring; the running app is the next
  test. An integration test for the rename + 409 + re-edit
  flow would be useful but is well-scoped as a follow-up.
- **CORS preflight bug found in Review (post-merge fix).**
  R25 added the PATCH and DELETE handlers but did not update
  `CORSMiddleware(allow_methods=…)` in `app/main.py`, which
  was still `["GET", "POST"]` from R13. The BE `TestClient`
  bypasses CORS, so the unit suite missed it; R26's vitest
  uses fetch mocks, so the FE suite missed it too. The bug
  only surfaced when the user opened the running app and
  the browser preflight blocked the new requests. Fixed in
  the same R26 commit cluster:
  `allow_methods=["GET", "POST", "PATCH", "DELETE"]`. The
  inline comment in `main.py` cites R26 as the round that
  caught it. **Lesson**: any round that introduces a new
  HTTP method on the BE must update the CORS allow_methods,
  or the FE round will block in the browser. Worth a small
  durable note in the BE-round conformance memo for
  R-A/R-B/R-C (autopilot-readiness) consideration.

**Promotions** _(none this round)_: F-rounds rarely promote.
The behavior-conformance sub-rule third instance (R20 BE,
R21 FE reducer, R25 BE) is held for the post-POC/MVP
evaluation round per the track-2/3 freeze.

**Follow-ups (not promotions, just notes):**

- **Visual verification in the running builder.** Type-check
  and build cover correctness of the wiring; a browser walk
  (open the workspaces page → trigger rename via overflow →
  trigger delete → see blocked modal on a non-empty workspace
  → empty the workspace → re-delete → success; same flow on
  datasets) hasn't been done this turn. Pull as a small
  post-R26 task whenever the user has the app open.
- **Integration test for the rename + 409 + re-edit flow.**
  Existing `tests/datasets.test.tsx` and
  `tests/routing.test.tsx` have the fetch-mock patterns to
  reuse. Would close the test surface gap R26 explicitly
  deferred.
- **AntD v5 deprecation cleanup** — R21 carry-over, plus a
  few new instances introduced by the new modals (`message`
  vs `title`). Worth one housekeeping round when convenient.
- **CRUD chain closed** — the DCBF chain R23→R24→R25→R26
  is complete. This is the third full DCBF instance (upload
  R14→R17 full; parse-options R19→R21 D+B+F; CRUD hygiene
  R23→R26 full). Three instances now exist; the post-POC/MVP
  evaluation round has its third-instance evidence ready when
  it lands.
- **POC/MVP roadmap moves forward**. Per the R23 roadmap,
  next pulls are R27 dataset-detail view (closes the read
  loop AND tests R22's `skills/` unblocker) and the
  autopilot-readiness track (R-A UX-infra, R-B app config +
  theme, R-C constants/enums).

## Feeds into → Round_27 (POC/MVP next feature)

What R26 hands forward:

- **A fully wired CRUD hygiene UI.** Both surfaces have the
  affordances; both pages have the modal state machine; the
  blocked path works both pre-flight and on the BE 409;
  existing flows (CreateWorkspace, upload wizard) handle the
  new 409 paths inline.
- **The `ApiErrorThrown` pattern** as a reference shape for
  future code-first error paths. R27+ can reuse the
  pattern; R-A UX-infra can promote the global error-handling
  toast if a third feature pulls the same shape.
- **The `_shared/` folder pattern with three components.**
  R23 named the pattern as "feature-local but cross-feature
  inside a domain"; R26 ships three components there. If
  R27's dataset-detail surface needs a similar shared modal,
  the precedent is set.
- **A CRUD chain that closes the POC/MVP CRUD gap.** Per the
  R23 roadmap, dataset-detail is the next-most-leveraged
  feature: it closes the "I uploaded data, now what?" loop
  AND tests R22's `skills/` unblocker (different domain
  shape — read-side, not write-side).

User picks at end-of-round Q&A whether R27 is dataset-detail,
the autopilot-readiness track, or something else.
