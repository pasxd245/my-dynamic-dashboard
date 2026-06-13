# POST /workspaces/{id}/relationships — rationale

**Round**: R70 — relationship governance. **Design**:
[relationships.md](../../../../.agents/design/data-management/workspaces/relationships.md).

## What it is

Declares a governed **edge** between two datasets in a workspace — the ordered
column pair `left.col ↔ right.col` plus a declared `cardinality`. The Query
Builder (R71) consumes governed edges to join; this round only declares +
validates them.

## Shape decisions

- **Body** = `{ leftDatasetId, leftColumn, rightDatasetId, rightColumn, cardinality }`.
  Columns are referenced by **name** (not index) — an edge outlives column
  reordering, and the FE/BE already key column metadata by name.
- **No user-supplied name** — the edge is self-labelling (`left.col ↔ right.col`);
  uniqueness is on the ordered column-pair within the workspace.
- **Validate-on-declare**: both datasets must be in the workspace, both columns
  must exist, and their dtypes must be **join-compatible** (equal, with
  `integer`/`float` cross-compatible). A failing declaration is rejected `422` —
  you cannot govern an edge that can't join.

## Errors

- `409 relationship_exists` — the ordered column-pair is already governed in
  this workspace (the unique-pair index). No name, so this — not `name_taken` —
  is the collision code.
- `422` — malformed / unknown dataset, unknown column, incompatible dtypes, or a
  degenerate self-pair (same dataset + same column). FastAPI validation envelope.
