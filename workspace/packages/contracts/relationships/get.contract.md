# GET /workspaces/{id}/relationships — rationale

**Round**: R70 — relationship governance. **Design**:
[relationships.md](../../../../.agents/design/data-management/workspaces/relationships.md).

## What it is

Lists a workspace's governed relationships, most-recent first. Powers the
workspace-scoped Relationships view at
`/data-management/workspaces/:id/relationships`.

## Shape decisions

- **Workspace-scoped** (J-1) — an edge belongs to the workspace whose datasets
  it connects; joins stay within a workspace.
- **`status` computed on read** — each item is re-validated against the current
  dataset schemas and annotated `valid` / `stale`. Never stored; the
  always-fresh discipline (mirrors `query_stale` being computed on run). A stale
  edge is listed, not hidden or errored (purpose.md #5: flag, don't reject).
- Sorted by `createdAt` descending (mirrors the datasets / queries lists).
