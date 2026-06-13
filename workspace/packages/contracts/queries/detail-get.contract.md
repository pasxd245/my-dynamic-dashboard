# GET /queries/{id} — rationale

**Round**: R69 — Saved Query MVP. **Design**:
[saved-query.md](../../../../.agents/design/data-management/queries/saved-query.md).

## What it is

Returns one saved query — its `definition` + metadata. Powers the
query-mode detail page header + read-only predicate summary; the run
endpoint (`GET /queries/{id}/rows`) supplies the rows.

## Shape decisions

- **Flat `/queries/{id}` path** (not nested under the workspace) — a
  Query has its own stable identity and URL (J-4), the deliberate setup
  for future Query-as-join-input composition (R71). The workspace scope
  is carried *in* the returned `Query.workspaceId`, not in the path.
- Same `Query` shape as the list items — the FE hydrates its cache
  without reshaping.
- `404 not_found` when the query is gone (deleted, or its source
  dataset was deleted and cascaded it away).
