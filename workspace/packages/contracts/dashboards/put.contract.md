# PUT /dashboards/{id} — rationale

**Round**: R101 — dashboard-as-a-persisted-noun. **Design**:
[Round_101.md](../../../../.agents/plan/cycles/Round_101.md).

## What it is

Updates a dashboard via a **full-representation replace** of `{ name, slug,
definition }`. Every FE mutation — rename, edit slug, add / edit / remove a
widget, change a widget's `span` — persists by sending the dashboard's full
current state here.

## Shape decisions

- **One idempotent PUT, not granular widget verbs.** The F1 store mutates
  granularly in memory (`addWidget`, `updateWidget`, `removeWidget`,
  `renameDashboard`); the Backend swap maps each to a PUT of the whole
  dashboard. Simpler contract, and widget edits are just `definition` edits.
- **Id-keyed**, not slug-keyed — the slug is editable; changing it here just
  re-points the URL (the FE redirects), but the resource key stays the stable
  id.
- **Same guards as create** — `name_taken` + `slug_taken` (both per-workspace),
  and the widget validation (`422`). A field never collides with the
  dashboard's own current value.

## Errors

- `404 not_found` · `409 name_taken` / `slug_taken` · `422` (malformed name /
  slug / widget). See `post.contract.md`.
