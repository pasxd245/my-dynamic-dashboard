# POST /workspaces/{id}/queries — rationale

**Round**: R69 — Saved Query MVP. **Design**:
[saved-query.md](../../../../.agents/design/data-management/queries/saved-query.md).

## What it is

Saves the predicate state a user built on the dataset detail page (chip
filters + advanced-query DNF + `?q=` search) as a named **Query** scoped
to a workspace. The verb behind the detail page's "Save as Query" action.

## Shape decisions

- **Body** = `{ name, sourceId, definition }`. `definition` reuses the
  shared `QueryDefinition` (`_shared/query.yaml`) whose atoms are the
  exact `aq` predicate shape the rows-GET already transports — no new
  vocabulary, maximal reuse (anti-drift).
- **Single polymorphic `sourceId`** (R79 — completed the `datasetId →
  sourceId` rename) — one Query is driven by one source: a `ds_` dataset
  (D-4) or a `qr_` query it composes on.
- **Validate-on-save**: every atom is re-checked against the dataset's
  *current* columns (same per-atom checks as the rows-GET `aq` path). A
  broken definition is rejected `422` — you cannot persist a query that
  can't run. Drift *after* save surfaces as `409 query_stale` on run
  (see `rows-get.contract.md`), not here.

## Errors

- `409 name_taken` — per-workspace name collision (mirrors datasets).
- `422` — bad `name` / `sourceId` / unknown source (dataset or query) /
  any atom fails validation. FastAPI validation envelope.
