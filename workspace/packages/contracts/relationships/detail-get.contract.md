# GET /relationships/{id} — rationale

**Round**: R70 — relationship governance. **Design**:
[relationships.md](../../../../.agents/design/data-management/workspaces/relationships.md).

## What it is

Gets a single governed relationship by id, with its computed `status`. The
top-level `/relationships/{id}` path (not nested under the workspace) lets R71
resolve an edge by id when joining.

## Shape decisions

- **`status` computed, not stored** — re-validated against the current dataset
  schemas at read; a `stale` edge returns `200` annotated, never an error
  (governance reads flag, don't reject). The `409 relationship_stale` envelope
  is **deferred to R71**, where join *execution* must block on a stale edge —
  its first real consumer.
- `404` when the id resolves to nothing (deleted, or a source dataset / the
  workspace was deleted and cascaded it away).
