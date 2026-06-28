# GET /workspaces/{id}/dashboards — rationale

**Round**: R101 — dashboard-as-a-persisted-noun. **Design**:
[Round_101.md](../../../../.agents/plan/cycles/Round_101.md).

## What it is

Lists a workspace's dashboards, most-recent first. Powers the
`Settings › Dashboard` catalog list and the dynamic `Dashboards` nav group.

## Shape decisions

- **Workspace-scoped** (the IA scope — Design #1), mirroring the datasets /
  queries list. Items are the full shared `Dashboard` shape, so the FE hydrates
  list + detail from one read without reshaping.
- **Empty array** when the workspace has none — drives the list page's "no
  dashboards yet → create one" empty state.
- This list is also how the **detail route** (`/dashboards/<ws_id>/<slug>`)
  resolves a slug → dashboard: the route carries the `ws_id`, so the FE reads
  this workspace list and matches the slug client-side — no dedicated global
  by-slug endpoint.

## Errors

None beyond the standard path-shape `422` (malformed workspace id). An unknown
but well-formed workspace id returns `[]`.
