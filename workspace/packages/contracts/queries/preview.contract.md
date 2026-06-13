# POST /workspaces/{id}/queries/preview — rationale

**Round**: R72 — the interactive construction surface (editable builder).
**Design**:
[query-construction.md](../../../../.agents/design/data-management/queries/query-construction.md).

## What it is

A **stateless** preview of an **unsaved** query `definition`. The builder
runs it on every edit (debounced via the FE query key) and renders the
result before the user saves. Nothing is persisted.

## Shape decisions

- **Stateless, not save-then-run** (J-3, resolved at F1). The saved-run
  route needs a persisted Query; previewing an unsaved working copy would
  otherwise force a draft Save first (orphan drafts, no preview-before-
  commit). So preview takes `{ datasetId, definition }` directly and runs
  them — reusing `query_dataset_rows` / `query_joined_rows` — without
  writing a row.
- **Same `RowsPage` shape as the saved run**, plus `resolvedColumns` when
  the definition joins (the builder can't derive combined headers from one
  source dataset). `resolvedColumns` reuses the `Query.resolvedColumns`
  shape verbatim.
- **Errors mirror the saved run** — `409 query_stale` / `409
  relationship_stale` for drift; `422` for a structurally unrunnable
  definition (unknown / cross-workspace dataset or edge, out-of-range
  atom). No new error codes; the builder branches exactly as the read-only
  detail does.
- **Workspace-scoped path** — the edge must be in the workspace, so the
  preview is scoped the same way create is.
