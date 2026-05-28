# CRUD hygiene — feature design

**Concept**: basic resource management on top of the existing
workspaces + datasets surfaces. Rename and delete affordances on
both resources, plus the cascade rule for what happens to a
workspace's datasets when the workspace itself is deleted. The
demo needs this before users can do anything beyond
create-via-upload — without rename/delete, the workspace grid and
the datasets table become write-once garbage.
**Status**: Draft (Round 23 design-only).
**Round introduced**: [Round_23](../../plan/cycles/Round_23.md);
implementation chain begins R24 (Contract phase) per the chain
declaration at the end of R23.
**Contract**: [Round_24](../../plan/cycles/Round_24.md) — four
`*.contract.{yaml,md}` pairs (PATCH/DELETE on workspaces and
datasets) plus the new shared
[`_shared/api-error.yaml`](../../../workspace/packages/contracts/_shared/api-error.yaml)
envelope. All 11 contracts in the package validate.
**Backend**: [Round_25](../../plan/cycles/Round_25.md) — four
route handlers, four `ApiError*` Pydantic models, schema
migration (two unique indexes) with a startup-time duplicate-
name back-fill, plus the `POST /workspaces` and batch-commit
tightening to 409 on `name_taken`. 54/54 backend tests pass.
**Frontend**: [Round_26](../../plan/cycles/Round_26.md) — four
mutation hooks, three shared modals
(`features/data-management/_shared/`), overflow-menu wiring on
the WorkspaceCard and the DatasetTable, the
`ApiErrorThrown` / `BatchApiErrorThrown` typed error path, and
inline 409 handling on the existing `CreateWorkspaceModal` and
the upload wizard's Confirm step. 24/24 vitest tests still pass;
type-check + build green.
**Sibling docs**:
[workspaces.md](workspaces.md) (the noun this verb-set operates
on — defines the Workspace data model),
[datasets.md](datasets.md) (the other noun — defines the Dataset
data model and table list),
[upload.md](upload.md) (the existing verb against datasets;
CRUD hygiene rounds out the set),
[crud-hygiene.preview.html](_archive/crud-hygiene.preview.html) (visual
preview of both affordance surfaces + the four modal states the
HIxAI loop revolved around).

---

## Why this is one feature, not two

Workspace CRUD and dataset CRUD look like two features at first
glance (two resources, two pages, two sets of endpoints). But the
operations are identical (rename + delete), the UX patterns are
identical (confirmation modal, pessimistic update with loading
state, 409 conflict surfacing), and the load-bearing design
question (cascade on workspace delete) is inherently about the
relationship between the two resources, not about either one in
isolation.

User framing at R23 kickoff: **"enhancement feature (DCBF)."**
Structurally parallel to the parse-options chain (R19→R21),
which was one feature (`ParseOptions` shape) across two
consumers (CSV + Excel source formats). CRUD hygiene is one
feature (rename + delete + 409-on-conflict) across two consumers
(workspaces + datasets).

---

## Surfaces — layer / reuse / purity declaration

| Surface                                  | Layer                                                  | Reusability  | Purity             | Allowed peer deps              |
| ---------------------------------------- | ------------------------------------------------------ | ------------ | ------------------ | ------------------------------ |
| `WorkspaceCard` (extended)               | `@mdd/ui`                                              | shared       | plain-UI           | react, antd, @ant-design/icons |
| Card overflow `<Dropdown>` menu          | `apps/builder/src/features/data-management/workspaces` | feature      | feature            | react, antd                    |
| `DatasetActionsCell` (new table column)  | `apps/builder/src/features/data-management/datasets`   | feature      | feature            | react, antd                    |
| `RenameModal` (shared by both resources) | `apps/builder/src/features/data-management/_shared`    | feature      | feature            | react, antd                    |
| `DeleteConfirmModal` (shared by both)    | `apps/builder/src/features/data-management/_shared`    | feature      | feature            | react, antd                    |
| `useRenameWorkspaceMutation`             | `apps/builder/src/features/data-management/workspaces` | feature      | glue (server-data) | @tanstack/react-query          |
| `useDeleteWorkspaceMutation`             | `apps/builder/src/features/data-management/workspaces` | feature      | glue (server-data) | @tanstack/react-query          |
| `useRenameDatasetMutation`               | `apps/builder/src/features/data-management/datasets`   | feature      | glue (server-data) | @tanstack/react-query          |
| `useDeleteDatasetMutation`               | `apps/builder/src/features/data-management/datasets`   | feature      | glue (server-data) | @tanstack/react-query          |
| `workspacesApi.patch` / `.delete`        | `apps/builder/src/api/`                                | builder-only | glue               | (fetch)                        |
| `datasetsApi.patch` / `.delete`          | `apps/builder/src/api/`                                | builder-only | glue               | (fetch)                        |
| `PATCH /workspaces/{id}` backend route   | `apps/backend/`                                        | backend      | feature            | (FastAPI — backend native)     |
| `DELETE /workspaces/{id}` backend route  | `apps/backend/`                                        | backend      | feature            | (FastAPI)                      |
| `PATCH /datasets/{id}` backend route     | `apps/backend/`                                        | backend      | feature            | (FastAPI)                      |
| `DELETE /datasets/{id}` backend route    | `apps/backend/`                                        | backend      | feature            | (FastAPI)                      |

**Boundary check**: `RenameModal` and `DeleteConfirmModal` live
in a new `_shared/` folder inside `data-management/` because they
are shared across the workspaces and datasets features but are
not generic enough for `@mdd/ui` — they encode domain-specific
copy ("delete this workspace?", "this workspace has N datasets")
and the 409 error-code branching. Per the build-first lesson:
feature-local until a third consumer proves the generic shape.
`WorkspaceCard` gains an `extra` slot for the overflow dropdown,
but the dropdown content itself is feature-local.

---

## Layout — ASCII intent

Two surfaces gain affordances; six modal states absorb the
mutations.

### Surface 1: Workspaces page — card with overflow menu

```text
                                                  ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Workspaces                              [+ Create] │
Workspaces                                                                  │
Manage logical containers for your data and reports.            ────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│                                                                           │
│  ┌────────────────  ⋮ ┐  ┌────────────────  ⋮ ┐  ┌────────────────  ⋮ ┐  │
│  │ ▣  Marketing     │ │  ▣  Sales Ops     │ │  ▣  Finance      │       │ │
│  │                    │  │                    │  │                    │   │
│  │ Created            │  │ Created            │  │ Created            │   │
│  │ 2026-05-21         │  │ 2026-05-18         │  │ 2026-05-10         │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

- Each `WorkspaceCard` gains a `⋮` (`<MoreOutlined />`) icon
  button in the top-right `extra` slot. Always-visible (not
  hover-only) so the affordance is discoverable.
- Click opens an AntD `<Dropdown>` with two items: `Rename` and
  `Delete` (the latter styled `danger`, red text).
- Item click stops propagation (otherwise the card's
  navigate-to-datasets-filter click would fire). The dropdown
  trigger button has `onClick={(e) => e.stopPropagation()}`
  applied on the card-level handler boundary.

### Surface 2: Datasets page — Actions column

```text
                                                                ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Datasets                                            [+ Upload] │
Datasets                                                                                │
All tables across your workspaces.                              ─────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────  │
│   [Workspace: All ▾]   [Search datasets…           ]                              │
│                                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │ Name             │ Workspace   │ Rows  │ Cols │ Size  │ Uploaded     │ ⋮ │  │
│   ├─────────────────────────────────────────────────────────────────────────┤  │
│   │ 📊 q1_pipeline   │ Marketing   │ 2,481 │  12  │  84KB │ 14:02 today  │ ⋮ │  │
│   │ 📊 contacts_2026 │ Marketing   │14,902 │   7  │ 612KB │ Yesterday    │ ⋮ │  │
│   │ 📄 leads_2025    │ Marketing   │   431 │   9  │  22KB │ 3 days ago   │ ⋮ │  │
│   │ 📊 deals_q4      │ Sales Ops   │ 1,204 │  18  │ 142KB │ 5 days ago   │ ⋮ │  │
│   │ 📄 commission    │ Finance     │    58 │   6  │   4KB │ 1 week ago   │ ⋮ │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Final column added to the table: header is empty (just `⋮`-ish
  visual marker), width fixed (`48px`), `align: 'right'`.
- Each row's Actions cell renders the same `⋮` overflow trigger
  with the same `Rename` / `Delete` `<Dropdown>` items.
- Row click is not used by R23 (the existing row-click no-op
  stays; click on the action cell stops propagation regardless,
  in case row-click is wired later).
- Consistent affordance shape across both surfaces — same icon,
  same menu items, same modal dispatched on click.

### Modal state 1: Rename (used for both resources)

```text
┌────────────────────────────────────────────────┐
│  Rename workspace                              │
│  ─────────────────────────────────────────── │
│                                                │
│  Name                                          │
│  ┌──────────────────────────────────────────┐ │
│  │ Marketing                                │ │
│  └──────────────────────────────────────────┘ │
│  1-80 characters. Must be unique.              │
│                                                │
│                            [Cancel]   [Save]   │
└────────────────────────────────────────────────┘
```

- Title: `"Rename workspace"` or `"Rename dataset"` based on
  resource type. Same component, different title prop.
- Body: single AntD `<Input>` pre-filled with the current name,
  auto-selected on open. Helper text under the input states the
  length range and uniqueness requirement.
- Submit button shows `loading` while the PATCH is in flight
  (pessimistic UX, per R23 design resolution Q4).
- 409 `name_taken` from the server → inline error below the
  input: _"A workspace named 'Marketing' already exists."_ Modal
  stays open; user edits and re-submits.
- ESC closes; clicking outside closes only when not loading.

### Modal state 2: Delete dataset confirmation

```text
┌────────────────────────────────────────────────┐
│  Delete dataset                                │
│  ─────────────────────────────────────────── │
│                                                │
│  Delete dataset 'q1_pipeline_Deals'?           │
│  This action cannot be undone.                 │
│                                                │
│                          [Cancel]   [Delete]   │
└────────────────────────────────────────────────┘
```

- AntD `<Modal>` (not `Popconfirm` — too small for the cascade
  message to fit on the workspace path). `Modal.confirm` is the
  call site; the props above are the rendered result.
- Primary button styled `danger` (red), label `"Delete"`.
- On success: modal closes, toast `"Dataset deleted."`,
  `invalidateQueries({ queryKey: ['datasets'] })`.
- On 404 (race condition — already deleted): treat as success
  (idempotent UX), show toast, refresh the list.

### Modal state 3: Delete workspace confirmation (empty)

```text
┌────────────────────────────────────────────────┐
│  Delete workspace                              │
│  ─────────────────────────────────────────── │
│                                                │
│  Delete workspace 'R&D'?                       │
│  This action cannot be undone.                 │
│                                                │
│                          [Cancel]   [Delete]   │
└────────────────────────────────────────────────┘
```

- Same component as the dataset-delete modal; props differ
  (resource label, name, action handler).
- Reached only when the workspace has zero datasets.

### Modal state 4: Delete workspace blocked (409 — non-empty)

```text
┌────────────────────────────────────────────────────┐
│  Workspace not empty                                │
│  ─────────────────────────────────────────────── │
│                                                     │
│  ⚠  Marketing has 4 datasets.                       │
│     Delete or move them to another workspace        │
│     first.                                          │
│                                                     │
│                                          [Got it]   │
└────────────────────────────────────────────────────┘
```

- Distinct modal shape (informational, not destructive):
  warning icon, count, instruction, single dismissive button.
- Reached two ways:
  1. **Pre-flight friendly path**: FE knows the workspace has
     datasets from the existing `datasets` query and shows this
     modal instead of the confirmation modal.
  2. **Race-conditioned authoritative path**: FE saw zero
     datasets, opened the confirmation modal, user clicked
     Delete, BE returned 409 with `{ datasetCount: 4 }` because
     a dataset was created in between. The confirmation modal
     swaps to the blocked modal in place.
- The FE prefers (1) when it can (cheap, immediate), but never
  trusts its own cached count — the 409 from BE is the source
  of truth.

### Modal state 5: Rename in flight (loading)

Same as modal state 1, with the `Save` button replaced by a
spinner and disabled state, and the input + Cancel button
disabled. Helps the user trust that the click registered without
double-submitting. Pessimistic UX per R23 Q4.

### Modal state 6: Rename failure (409 name_taken)

Same as modal state 1, with an inline `<Alert type="error">`
below the input field:

```text
  ✕ A dataset named 'commission_calc' already exists in
    workspace 'Finance'.
```

- Submit button is enabled (so user can re-submit after editing).
- Error clears on input change.

---

## Resource scope of "rename"

PATCH body is **`{ name: string }`** for both resources.
**No other fields are mutable in R23.** Specifically out of
scope:

- Workspace `description`, `metadata`, `ownerId`. Each lands as
  a separate verb when concrete need surfaces.
- Dataset `name` editing during upload remains a wizard-step
  affordance (existing behavior, unchanged). Renaming an
  already-committed dataset is the new R23 affordance.
- Dataset `columns[].name`, `dtype`, or other per-column
  metadata. Lives entirely in the future "schema editing" round
  ([upload.md](upload.md)'s deferral list).

Uniqueness constraints (the source of 409 `name_taken`):

- Workspace `name` is **unique globally** (across all
  workspaces).
- Dataset `name` is **unique within its workspace** (the same
  name in two different workspaces is allowed).

These constraints exist in R23 — the BE enforces them; the FE
surfaces the 409 as an inline error in the rename modal.

---

## Wire shape — four endpoints

The C-round formalizes these into `*.contract.{yaml,md}` pairs;
R23 locks the shape so the C-round is mechanical.

```text
PATCH  /workspaces/{id}      body: { name: string }
                             200: Workspace
                             404: { code: "not_found" }
                             409: { code: "name_taken" }

DELETE /workspaces/{id}      204: (success)
                             404: { code: "not_found" }
                             409: { code: "non_empty",
                                    datasetCount: integer }

PATCH  /datasets/{id}        body: { name: string }
                             200: Dataset
                             404: { code: "not_found" }
                             409: { code: "name_taken" }

DELETE /datasets/{id}        204: (success — parquet deleted
                                   in same DB transaction)
                             404: { code: "not_found" }
```

**Error body shape** is deliberately code-first so the FE can
branch on `code` without parsing free-text messages:

```ts
type ApiError = { code: 'not_found' } | { code: 'name_taken' } | { code: 'non_empty'; datasetCount: number };
```

Each error code maps to one FE branch:

- `not_found` — toast `"This resource no longer exists."`,
  invalidate the list, close any open modal.
- `name_taken` — inline error in the rename modal (modal stays
  open).
- `non_empty` — swap the confirmation modal for the blocked
  modal (state 4 above), passing through `datasetCount`.

**Idempotency**: DELETE on a non-existent id returns 404, not
204 — this gives the FE a clear signal to refresh and show the
not-found toast (e.g., another tab deleted the resource first).
The FE treats 404 on a delete attempt as effective success for
its own UI purposes (the resource is gone), but the response
code distinguishes "you did this" from "someone else did this."

---

## State management — TanStack Query mutations

Four mutation hooks, each with the same shape:

```ts
const useRenameWorkspaceMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => workspacesApi.patch(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
};

const useDeleteWorkspaceMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
};
```

- Workspace delete invalidates **both** `['workspaces']` and
  `['datasets']` because the dataset list may have shown
  workspace names in the Workspace column (and even if the
  workspace had zero datasets, the dataset list's workspace
  filter dropdown needs to refresh).
- Dataset rename / delete invalidates only `['datasets']`.
- Workspace rename invalidates `['workspaces']` AND
  `['datasets']` (the Workspace column on the datasets table
  may now show the new name; safer to refresh than to do
  surgery on cached entries).
- All four use **pessimistic UX** (R23 Q4): no `onMutate`
  optimistic update, no `onError` rollback. Mutation pending →
  button loading state; success → invalidate; error → surface
  via the consumer's catch.

---

## Backend endpoint shape

R24+ implements:

```python
# apps/backend/app/routers/workspaces.py
@router.patch("/workspaces/{workspace_id}", response_model=Workspace)
def rename_workspace(workspace_id: str, body: RenameBody) -> Workspace:
    # 404 if not found
    # 409 { code: "name_taken" } if another workspace has body.name
    # Updates and returns the Workspace row.

@router.delete("/workspaces/{workspace_id}", status_code=204)
def delete_workspace(workspace_id: str) -> None:
    # 404 if not found
    # 409 { code: "non_empty", datasetCount: N } if N > 0 datasets reference this workspace
    # Otherwise deletes the row (no datasets to cascade — that's the cascade rule).
```

```python
# apps/backend/app/routers/datasets.py
@router.patch("/datasets/{dataset_id}", response_model=Dataset)
def rename_dataset(dataset_id: str, body: RenameBody) -> Dataset:
    # 404 if not found
    # 409 { code: "name_taken" } if another dataset in the SAME workspace has body.name
    # Updates and returns.

@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str) -> None:
    # 404 if not found
    # Deletes the row AND the underlying parquet file in one transaction.
    # No 409 path — dataset has no dependent resources in R23.
```

Shared `RenameBody` Pydantic model:

```python
class RenameBody(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=80)
```

**Atomicity** (delete dataset): the same atomic-commit pattern
the upload wizard uses, in reverse. R16's BE-round conformance
memo (the
[2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md))
already articulates the discipline: validate everything first,
delete the row, then unlink the parquet — or unlink first, then
delete the row. Either order is fine; what's not fine is a
half-deleted state. Tests cover both success and the rollback
path.

**Atomicity** (delete workspace): no cascade in R23, so the
DELETE is just a row removal. The 409 path is the safety net.

---

## Lifecycle

This doc:

- **Amended in place** during the R23 chain's downstream rounds
  if implementation surfaces a decision not pre-baked here
  (e.g., the precise overflow-menu z-index against the table
  sticky header).
- **Superseded** by `crud-hygiene-v2.md` if a future round adds
  cascade-opt-in (`?cascade=true`), bulk delete, or
  soft-delete + trash bin — those are R∞ pulls, named below.
- **Folded back** into a `data-management/` overview doc if the
  data-management spine grows enough to warrant one.

---

## Out of scope (deferred with named triggers)

- **Cascade-opt-in on workspace delete** (`?cascade=true`).
  Trigger: user friction with the 409 blocked path; they want
  to nuke a workspace with its datasets in one click. Future
  round wires the query param + a "delete all together" branch
  in the FE confirmation modal.
- **Soft-delete + trash bin** for either resource. Trigger:
  user reports of accidental deletes. Adds substantial
  infrastructure (scheduled hard-delete job, restore endpoints,
  trash UI).
- **Bulk delete / multi-select** on the datasets table.
  Trigger: a user with 10+ datasets to clean up. Datasets
  table currently has no row selection; this round doesn't add
  it.
- **Rename workspace + dataset description / metadata**.
  Trigger: a UI affordance pulls the field into view (e.g., a
  workspace detail page surfaces description; a dataset card
  surfaces tags). Until then, name-only is enough.
- **Audit log** of CRUD operations. Trigger: compliance
  requirement or a second user (sharing model).
- **Per-resource permissions** (who can rename / delete what).
  Trigger: real multi-user. Current product is single-user.
- **Workspace move** (re-assigning a dataset to another
  workspace). Distinct verb from rename / delete; sits between
  CRUD hygiene and a future "datasets organization" surface.
  R∞.
- **Restore deleted resource**. Tied to soft-delete; same
  trigger as above.

---

## Open questions answered in R23 (HIxAI Q&A)

| Q                                                 | Decision                                                                               | Source                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| What happens when deleting a non-empty workspace? | Block (409 `non_empty` with `datasetCount`) — no cascade in R23                        | R23 HIxAI Q1 (user-recommended)                      |
| Confirmation UX shape?                            | Simple AntD modal with `danger`-styled Delete button — no type-the-name, no toast-undo | R23 HIxAI Q2 (user-recommended)                      |
| Rename scope?                                     | `name` only on both resources                                                          | R23 HIxAI Q3 (user-recommended)                      |
| Optimistic or pessimistic mutation UI?            | Pessimistic for both, with loading state on the affected control                       | R23 HIxAI Q4 (user-recommended)                      |
| Workspace name uniqueness scope?                  | Global (across all workspaces)                                                         | R23 design — implicit from POC scope                 |
| Dataset name uniqueness scope?                    | Per-workspace (same name in different workspaces is allowed)                           | R23 design — matches upload-wizard behavior          |
| Affordance shape on cards/rows?                   | Overflow `⋮` dropdown menu, always visible (not hover-only)                            | R23 design — discoverability over visual cleanliness |
| Error code surface shape?                         | `{ code: string, ... }` body with FE branching on `code`                               | R23 design — single-branch FE handler                |
| Same modal component for both resources?          | Yes — `RenameModal` and `DeleteConfirmModal` parameterized by resource label           | R23 design — one feature, two consumers              |
| Delete dataset cleanup of parquet file?           | Same DB transaction (atomic), reuses R16 atomic-commit pattern in reverse              | R23 design — leans on R16/R20 pattern                |

---

## R30 stamp — top-level error boundary

R26 visual verification surfaced cases where an uncaught render error
in any CRUD page would unmount the whole app and leave a blank white
screen. R30 wrapped the router in [`AppErrorBoundary`](../../../workspace/apps/builder/src/components/AppErrorBoundary.tsx)
inside the AntD providers, so render-phase errors now show a themed
`<Result>` page with a Reload button instead. Event-handler errors
continue to surface through the existing AntD `<App>` message
channel. No change to the CRUD wire shape — purely a defensive
runtime wrapper.

---

## R32 stamp — i18n keying

All CRUD user-facing strings (modal titles, button labels,
toast messages, error alerts, breadcrumb labels) are now keyed
under `workspaces.*`, `datasets.*`, `rename.*`, `deleteConfirm.*`,
and `common.*` namespaces in [`src/i18n/locales/{en,vi}.json`](../../../workspace/apps/builder/src/i18n/locales/).
Resource label (`"workspace"` / `"dataset"`) lives in
`resources.{workspace,dataset}` so messages like "Rename
workspace" and "Delete dataset" inflect correctly per locale.
Modal copy uses `<Trans components={{ strong: <strong /> }}>`
for inline emphasis. AntD's built-in Modal OK/Cancel + Empty
"No data" strings localize via `<ConfigProvider locale={...}>`.

---

## R33 stamp — extended to dataset detail page

R33 ([dataset-detail.md](dataset-detail.md)) extends the dataset
rename + delete affordances to a third placement: the
`/datasets/:id` page header's `actions` slot. No behavior change
— same `<RenameModal>` + `<DeleteConfirmModal>` and the same
`useRenameDatasetMutation()` + `useDeleteDatasetMutation()` hooks
from R26 are reused unchanged. Delete-success navigates back to
the Datasets list (`replace=true` so the deleted detail page is
not in browser history). The workspace surfaces are unaffected;
workspace CRUD remains on the Workspaces grid only.
