# GET /workspaces/{id}/queries — rationale

**Round**: R69 — Saved Query MVP. **Design**:
[saved-query.md](../../../../.agents/design/data-management/queries/queries.md).

## What it is

Lists a workspace's saved queries, most-recent first. Powers the
Queries table-list page at `/data-management/queries`.

## Shape decisions

- **Workspace-scoped path** (`/workspaces/{id}/queries`) — a Query
  belongs to a workspace (the IA scope, J-2), so the list is scoped the
  same way datasets are filterable by workspace. The FE's "All" view
  fans out across workspaces client-side / via the workspace filter.
- **`createdAt` desc** — newest first, matching the datasets list
  default sort.
- Returns the full `Query` (incl. `definition`) so the list can render
  the predicate-count summary without a second fetch.
