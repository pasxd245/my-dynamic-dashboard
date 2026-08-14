# CRUD hygiene — feature design

**Concept**: basic resource management on top of the existing
workspaces + datasets surfaces. Rename and delete affordances on
both resources, plus the cascade rule for what happens to a
workspace's datasets when the workspace itself is deleted. The
demo needs this before users can do anything beyond
create-via-upload — without rename/delete, the workspace grid and
the datasets table become write-once garbage.
**Status**: Accepted, shipped. Rename + delete affordances on both
resources, four route handlers, four `ApiError*` Pydantic models, the
shared
[`_shared/api-error.yaml`](../../../../workspace/packages/contracts/_shared/api-error.yaml)
envelope, four mutation hooks, and three shared modals
(`features/data-management/_shared/`).
**Sibling docs**:
[workspaces.md](../workspaces/workspaces.md) (the noun this verb-set operates
on — defines the Workspace data model),
[datasets.md](../datasets/datasets.md) (the other noun — defines the Dataset
data model and table list),
[upload.md](../datasets/upload.md) (the existing verb against datasets;
CRUD hygiene rounds out the set).

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

It is structurally parallel to the parse-options chain, which was one
feature (the `ParseOptions` shape) across two consumers (CSV + Excel
source formats). CRUD hygiene is one feature (rename + delete +
409-on-conflict) across two consumers (workspaces + datasets).

---

## Surfaces — layer / reuse / purity declaration

| Surface                                  | Layer                                                  | Reusability  | Purity             | Allowed peer deps              |
| ---------------------------------------- | ------------------------------------------------------ | ------------ | ------------------ | ------------------------------ |
| `WorkspaceCard`                          | `apps/builder/src/features/data-management/workspaces` | feature      | feature            | react, antd, @ant-design/icons |
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
`WorkspaceCard` is itself feature-local (it lives in
`features/data-management/workspaces/WorkspacesPage.tsx`, not `@mdd/ui`) and
carries the overflow dropdown directly.

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
- Click opens an AntD `<Dropdown>` with three items:
  `Relationships` (`ShareAltOutlined`, navigates to the workspace's
  relationships sub-route), `Rename`, and `Delete` (the latter styled
  `danger`, red text).
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
- Row click is not used (the existing row-click no-op stays; click
  on the action cell stops propagation regardless, in case row-click
  is wired later).
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
  (pessimistic UX).
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
double-submitting. Pessimistic UX.

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

## Token map

The CRUD affordances are AntD primitives (`<Dropdown>`, `<Modal>`,
`<Input>`, `<Alert>`, `<Button>`) styled by the AntD `<ConfigProvider>`
tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts)
(the source of truth). No new token is introduced; values are
informational (resolved via `theme.getDesignToken()`, antd 6.x).

| Surface                                  | AntD token                                 | Value (informational) |
| ---------------------------------------- | ------------------------------------------ | --------------------- |
| Overflow `⋮` trigger icon / hover        | `colorTextTertiary` → `colorTextSecondary` | derived               |
| Dropdown menu background                 | `colorBgBase`                              | derived               |
| `Delete` (danger) menu item text         | `colorError`                               | `#ff4d4f`             |
| Modal title text                         | `colorText`                                | derived               |
| Modal body text                          | `colorTextSecondary`                       | derived               |
| Rename input border (idle / focus)       | `colorBorder` → `colorPrimary`             | `#d9d9d9` / `#1677ff` |
| 409 inline error `<Alert>`               | `colorError`                               | `#ff4d4f`             |
| Blocked-modal warning icon               | `colorWarning`                             | `#faad14`             |
| Primary "Save" button                    | `colorPrimary`                             | `#1677ff`             |
| Danger "Delete" button                   | `colorError`                               | `#ff4d4f`             |
| Border radius (modal, buttons, dropdown) | `borderRadius`                             | `6`                   |
| Font family                              | `fontFamily`                               | system stack          |

No new token is introduced; AntD's danger / warning button and alert
chrome derive from `colorError` / `colorWarning`. Identifier parity is
enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## Acceptance criteria (Design gate exit)

Testable criteria, each mapping to at least one automated test across
F / B / I. Numbered `C1`–`C11` for suite reference; they describe the
**shipped** rename + delete + cascade-guard behaviour.

**User journey** — as a user I rename or delete a workspace or a
dataset from its overflow menu, and I am protected from deleting a
workspace that still holds datasets.

1. **Affordance** _(FE component)_ — each `WorkspaceCard` and each
   datasets-table row renders an always-visible `⋮` overflow trigger
   that opens a `Rename` / `Delete` (danger-styled) dropdown (the
   `WorkspaceCard` menu also leads with a `Relationships` item); the
   trigger click stops propagation so it never fires the card / row
   click.
2. **Rename** _(FE + BE)_ — Rename opens `<RenameModal>` pre-filled
   with the current name; submit calls `PATCH /workspaces/{id}` or
   `PATCH /datasets/{id}` with `{ name }`, shows the pessimistic
   loading state, and on success invalidates the affected list query.
3. **Rename conflict** _(FE + BE)_ — a duplicate name returns
   `409 name_taken`; the modal stays open with an inline error and the
   user can edit and re-submit.
4. **Delete dataset** _(FE + BE)_ — Delete opens `<DeleteConfirmModal>`;
   confirm calls `DELETE /datasets/{id}` (row + parquet in one
   transaction), toasts, and invalidates `['datasets']`. A 404 race is
   treated as effective success for the UI.
5. **Delete empty workspace** _(FE + BE)_ — `DELETE /workspaces/{id}`
   with zero datasets returns 204 and invalidates both `['workspaces']`
   and `['datasets']`.
6. **Delete non-empty workspace blocked** _(FE + BE)_ — the DELETE
   returns `409 non_empty` with `datasetCount`; the FE shows the
   informational blocked modal (state 4), reached either by pre-flight
   or by the authoritative 409. The BE 409 is the source of truth — the
   FE never trusts its cached count.
7. **Uniqueness scope** _(pytest)_ — workspace `name` is unique
   globally; dataset `name` is unique within its workspace (same name
   in two workspaces is allowed).
8. **Name length** _(pytest / contract)_ — `RenameWorkspaceBody`
   enforces max 80, `RenameDatasetBody` max 120, both sourced from the
   cross-language `NAME_LENGTHS` constant.
9. **Error-code branching** _(FE)_ — `not_found` / `name_taken` /
   `non_empty` each map to exactly one FE branch (toast + invalidate /
   inline error / swap-to-blocked-modal).
10. **Detail-page placement** _(FE)_ — the same rename + delete
    affordances render in the `/datasets/:id` page-header actions slot,
    reusing the shared modals + hooks unchanged; delete-success navigates
    back to the Datasets list with `replace=true`. As the dataset header
    grew past three verbs they collapsed into a single `Actions ▾`
    dropdown; see § Header actions below for the rule that governs which
    form a header takes.
11. **Integration** — renaming a workspace refreshes the Workspace
    column on the Datasets table (both `['workspaces']` and
    `['datasets']` invalidated).

---

## Header actions — the cross-surface rule (R171)

R166 settled `[Edit] [Duplicate] [Delete]` for the **query** detail header and left open
whether that ordering generalises. It does — and the rule below was **read off the three
shipped headers rather than imposed on them**, so this section records a convention the
build already keeps. No surface changed to adopt it.

| Surface         | Header actions                                                               | Form     |
| --------------- | ---------------------------------------------------------------------------- | -------- |
| Query detail    | `[Edit] [Duplicate] [Delete]` — primary Edit, danger Delete                  | inline   |
| Workflow detail | `[Run] [Edit] [Delete]` — primary Run, danger Delete                         | inline   |
| Dataset detail  | `Actions ▾` → Join with related · ─ · Properties · Refresh · Rename · Delete | dropdown |

**The rule.** Verbs are ordered **most-reached-for first**, and the **destructive verb is
always last**. A header with **≤3 actions renders them inline**; past three they collapse
into a single `Actions ▾` dropdown, keeping the same order inside it.

Both halves are load-bearing:

- **Frequency-first** is why `Edit` leads a query and `Run` leads a workflow. It is not one
  fixed verb order across surfaces — it is one fixed _principle_, which resolves to a
  different order wherever the primary action differs.
- **Destructive-last** is a **distance** guarantee, not an aesthetic one: the gap between the
  action a user reaches for constantly and the one they must not hit by accident is what
  protects against the mis-click.

**Still open — catalog row actions.** Whether a list row follows the same rule is _not_
settled here. A row is not a header: it is one of many, it has far less space, and it already
uses the `⋮` overflow pattern above. Nothing in the evidence this rule was drawn from speaks
to rows, so extending it to them would be exactly the imposition this section avoided.

---

## Resource scope of "rename"

PATCH body is **`{ name: string }`** for both resources — this
verb renames, and nothing else. Specifically out of scope:

- Workspace `description`, `metadata`, `ownerId`. Each lands as
  a separate verb when concrete need surfaces.
- Dataset `name` editing during upload remains a wizard-step
  affordance (existing behavior, unchanged). Renaming an
  already-committed dataset is this verb's affordance.
- Dataset `columns[].name` and `dtype`. Both live in the future
  "schema editing" round ([upload.md](../datasets/upload.md)'s
  deferral list). Per-column **visibility** is a separate, shipped
  verb — `PATCH /datasets/{id}/columns` writes the `hidden` set as a
  presentation-only view hint, never the parquet or the dtypes.

Uniqueness constraints (the source of 409 `name_taken`):

- Workspace `name` is **unique globally** (across all
  workspaces).
- Dataset `name` is **unique within its workspace** (the same
  name in two different workspaces is allowed).

The BE enforces these constraints; the FE surfaces the 409 as an
inline error in the rename modal.

---

## Wire shape — four endpoints

The shipped `*.contract.{yaml,md}` pairs formalize these.

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
- All four use **pessimistic UX**: no `onMutate`
  optimistic update, no `onError` rollback. Mutation pending →
  button loading state; success → invalidate; error → surface
  via the consumer's catch.

---

## Backend endpoint shape

The routers implement:

```python
# apps/backend/app/routers/workspaces.py  (router prefix="/workspaces")
@router.patch("/{id}", response_model=Workspace)
def rename_workspace(id: str, body: RenameWorkspaceBody) -> Workspace:
    # 404 if not found
    # 409 { code: "name_taken" } if another workspace has body.name
    # Updates and returns the Workspace row.

@router.delete("/{id}", status_code=204)
def delete_workspace(id: str) -> None:
    # 404 if not found
    # 409 { code: "non_empty", datasetCount: N } if N > 0 datasets reference this workspace
    # Otherwise deletes the row (block-not-cascade; FK cascade is the DB backstop).
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
    # Deletes the row AND the underlying parquet file in one transaction,
    # and app-cascades to dependent queries (DELETE ... WHERE source_id = <ds>).
    # Still 204 (no 409) — the dependents are removed, not blocked on.
```

Rename body — **per-resource max length** via dedicated body classes.
Workspace names allow 80; dataset names allow 120
([`_shared/dataset.yaml`](../../../../workspace/packages/contracts/_shared/dataset.yaml)
`Dataset.name` — filename stems + sheet names run long). The cross-language
`NAME_LENGTHS` constant
([`_generated/constants.ts`](../../../../workspace/apps/builder/src/_generated/constants.ts))
is the single source of truth — `WORKSPACE_MAX = 80`,
`DATASET_MAX = 120` — cited identically by the contracts, FE Form
rules, and BE bodies:

```python
# Dedicated body class per resource (both extra='forbid'):
#   RenameWorkspaceBody — max_length = NAME_LENGTHS["workspace_max"] (80)
#   RenameDatasetBody   — max_length = NAME_LENGTHS["dataset_max"]   (120)
class RenameWorkspaceBody(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=80)  # NAME_LENGTHS["workspace_max"]
```

**Atomicity** (delete dataset): the same atomic-commit pattern
the upload wizard uses, in reverse (the
[BE-round conformance pattern](../../../memory/2026-05-24-be-round-conformance-pattern.md)):
validate everything first, delete the row, cascade the dependent
queries, and unlink the parquet — or unlink first, then delete the
row. Either order is fine; what's not fine is a half-deleted state.
Tests cover both success and the rollback path.

**Atomicity** (delete workspace): block-not-cascade — the handler
pre-counts datasets and returns `409 non_empty` if any remain, so a
successful DELETE is just a row removal. The DB-level FK cascade is the
backstop only.

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

## Runtime hardening

- **Top-level error boundary.** The router is wrapped in
  [`AppErrorBoundary`](../../../../workspace/apps/builder/src/components/AppErrorBoundary.tsx)
  inside the AntD providers, so a render-phase error in any CRUD page
  shows a themed `<Result>` page with a Reload button instead of
  unmounting the whole app to a blank screen. Event-handler errors
  continue to surface through the AntD `<App>` message channel. No
  change to the CRUD wire shape — purely a defensive runtime wrapper.
- **i18n keying.** All CRUD user-facing strings (modal titles, button
  labels, toast messages, error alerts, breadcrumb labels) are keyed
  under the `workspaces.*`, `datasets.*`, `rename.*`, `deleteConfirm.*`,
  and `common.*` namespaces in
  [`src/i18n/locales/{en,vi}.json`](../../../../workspace/apps/builder/src/i18n/locales/).
  The resource label (`"workspace"` / `"dataset"`) lives in
  `resources.{workspace,dataset}` so "Rename workspace" / "Delete
  dataset" inflect correctly per locale. Modal copy uses
  `<Trans components={{ strong: <strong /> }}>` for inline emphasis;
  AntD's built-in Modal OK/Cancel + Empty "No data" strings localize via
  `<ConfigProvider locale={...}>`.
