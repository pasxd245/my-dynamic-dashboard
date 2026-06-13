# DELETE /relationships/{id} — rationale

**Round**: R70 — relationship governance. **Design**:
[relationships.md](../../../../.agents/design/data-management/workspaces/relationships.md).

## What it is

Deletes a governed relationship — the explicit user-initiated delete from the
relationships view.

## Shape decisions

- **No dependents this round** (no 409 path) — join execution that would depend
  on an edge is R71; a dependency check before delete lands with it.
- Deleting either source **dataset** or the **workspace** cascades its
  relationships away server-side (FK `ON DELETE CASCADE`), so a subsequent fetch
  surfaces `404` — letting the FE distinguish "you did this" from "a cascade did".
