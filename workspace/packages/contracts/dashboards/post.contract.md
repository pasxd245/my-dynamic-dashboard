# POST /workspaces/{id}/dashboards — rationale

**Round**: R101 — dashboard-as-a-persisted-noun. **Design**: ratified in
[Round_101.md](../../../../.agents/plan/cycles/Round_101.md) (Design decisions
1–7; F1 sign-off 2026-06-27).

## What it is

Creates a **Dashboard** — a named, workspace-scoped noun that persists *which
widgets it shows*. The verb behind `Settings › Dashboard › New dashboard`. This
is where the headline value lands: a dashboard **defined once** that **re-runs
live on the latest upload** and **absorbs CRM drift** — the way out of the
report-maintenance treadmill. (R100 only proved the render path; persistence is
what makes the analysis a durable, reusable thing.)

## Shape decisions

- **Body** = `{ name, slug, definition }`. `definition` is the shared
  `DashboardDefinition` (`_shared/dashboard.yaml`): `{ widgets: [] }`, embedded
  JSON like `queries.definition` (no `dashboard_widgets` table — Design #1).
  Empty `widgets` is valid (create-then-add-widgets).
- **Formula-free widgets** (hard constraint, product-value-framing #1): a
  widget is a saved `queryId` + `dimensionCol` / `measureCol` / `agg` /
  `chartType` / `span` — columns by logical **name** (F1 resolved name-vs-index
  → name), never a formula.
- **Both `name` and `slug` unique per workspace** (Contract decision, human
  2026-06-27): the route nests the workspace (`/dashboards/<ws_id>/<slug>`), so
  a slug only disambiguates within its project — two projects may each have a
  `weekly-report`. Mirrors the query/dataset per-workspace rule.
- **Cross-workspace widgets constrained out** (Contract decision): every
  widget's `queryId` must reference a query in **this** workspace at save time
  → `422` otherwise. A *later* delete of that query is tolerated (renders the
  per-widget "unavailable" state, not a save block).

## Errors

- `409 name_taken` — per-workspace name collision.
- `409 slug_taken` — per-workspace slug collision (new R101 code).
- `422` — bad `name` / `slug`, or a malformed widget (out-of-workspace
  `queryId`, `sum` without `measureCol`, bad enum / span). FastAPI envelope.
