# DELETE /dashboards/{id} — rationale

**Round**: R101 — dashboard-as-a-persisted-noun. **Design**:
[Round_101.md](../../../../.agents/plan/cycles/Round_101.md).

## What it is

Deletes a dashboard by id (the `Settings › Dashboard` card ⋯ menu, behind a
confirm modal — like queries).

## Shape decisions

- **No 409 path.** A dashboard owns its embedded widgets and nothing references
  it, so there are no dependents to block on. Deleting it removes the dashboard
  and its widget definitions; the **referenced queries are untouched** (a widget
  points *at* a query, the query doesn't depend on the widget).
- **Id-keyed** (stable), `204` on success.

## Errors

- `404 not_found` — already deleted / never existed (lets the FE tell "you did
  this" from "someone else did").
