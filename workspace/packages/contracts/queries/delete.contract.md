# DELETE /queries/{id} — rationale

**Round**: R69 — Saved Query MVP (acceptance C9). **Design**:
[saved-query.md](../../../../.agents/design/data-management/queries/queries.md)
§ Behaviour (query-mode Delete).

## What it is

Deletes a saved query. The explicit user-initiated delete from the
query-mode detail page (reuses the shared `DeleteConfirmModal`).

## Shape decisions

- **204, no body** — mirrors the dataset/workspace delete precedent
  (crud-hygiene.md). No envelope on success.
- **No 409 path** — a query has no dependents this round (joins /
  composition that would reference it are R70+). Deleting the *source
  dataset* cascades its queries away server-side (FK
  `ON DELETE CASCADE`); this endpoint is the direct query delete.
- **404 on already-absent** — lets the FE tell "you deleted it" from
  "it was gone" (the 404-race discipline shared with dataset detail).
