# `PATCH /datasets/{id}` — contract rationale

> **Authoritative shape**: [patch.contract.yaml](patch.contract.yaml).

## Purpose

Renames an already-committed dataset. Introduced by R23's CRUD
hygiene chain. Note that dataset names were always user-editable
**during** the upload wizard's Confirm step — this PATCH adds
the post-commit affordance that
[datasets.md](../../../.agents/design/data-management/datasets.md)
deferred to R∞ in R14. The upload wizard's pre-commit name flow
is unchanged.

## Behavior

- **Partial update via PATCH.** Only `name` mutable. Other
  fields (`workspaceId`, `sourceFormat`, `sheetName`, schema
  inference) are immutable from the API surface in R23.
  Moving a dataset between workspaces is a deferred verb (see
  [crud-hygiene.md § Out of scope](../../../.agents/design/data-management/crud-hygiene.md)).
- **Returns the updated `Dataset`** so the FE can replace
  cached state for both `['datasets']` and any workspace-
  filtered variants without a follow-up `GET`.
- **Pessimistic UX on the FE side** — same shape as workspace
  rename. Modal stays in loading state; no optimistic update.
- **Per-workspace uniqueness on `name`.** Two datasets in
  different workspaces may share a name (matches the upload
  wizard's pre-commit behavior: same filename → same default
  dataset name across workspaces is currently fine). Within a
  single workspace, names are unique — R25 (BE) enforces this
  as a unique index on `(workspace_id, name)`.

## Error semantics

- **`404 not_found`**: id resolves to nothing.
- **`409 name_taken`**: another dataset in the same parent
  workspace owns this name. The error response does NOT carry
  the colliding workspace's id — the FE already knows it
  (it's reading the dataset's `workspaceId` from cached
  state). Modal copy interpolates the workspace name from
  cached workspace data.
- **`422`**: FastAPI validation envelope (missing, empty,
  > 120 chars, wrong type, extra keys).

## Length-bound rationale

`maxLength: 120` mirrors the existing `Dataset.name` spec in
[\_shared/dataset.yaml](../_shared/dataset.yaml). The workspace
`name` field uses 80 chars (per `_shared/workspace.yaml`).
Tightening dataset names to 80 retroactively would invalidate
already-committed datasets with names in the 81-120 range
(possible for Excel multi-sheet uploads where the default name
is `<filename_stem>_<sheet_name>`). R24 keeps the existing
schemas; R23's design said "1-80 chars" but the C-round catches
the inconsistency and aligns to the existing data.

## Examples

Happy path:

```http
PATCH /datasets/ds_71a4e2f0 HTTP/1.1
Content-Type: application/json

{ "name": "commission_calc_2026" }
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "ds_71a4e2f0",
  "workspaceId": "ws_a31002bb",
  "name": "commission_calc_2026",
  "sizeBytes": 4096,
  "rowCount": 58,
  "columnCount": 6,
  "columns": [/* ... */],
  "sourceFormat": "csv",
  "createdAt": "2026-05-18T14:22:00Z"
}
```

Name collision (within the same workspace):

```http
PATCH /datasets/ds_71a4e2f0 HTTP/1.1
Content-Type: application/json

{ "name": "leads_2025" }
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "code": "name_taken" }
```

## Cross-links

- [delete.contract.yaml](delete.contract.yaml) — sibling dataset CRUD verb.
- [workspaces/patch.contract.yaml](../workspaces/patch.contract.yaml)
  — parallel rename on the workspace resource.
- [batch-post.contract.yaml](batch-post.contract.yaml) — the
  creation path (upload wizard's commit step).
- [crud-hygiene.md](../../../.agents/design/data-management/crud-hygiene.md)
  — feature design.
- [Round_23](../../../.agents/plan/cycles/Round_23.md) — D-round.
- [Round_24](../../../.agents/plan/cycles/Round_24.md) — C-round.
