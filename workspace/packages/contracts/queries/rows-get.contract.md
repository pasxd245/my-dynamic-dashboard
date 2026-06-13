# GET /queries/{id}/rows — rationale

**Round**: R69 — Saved Query MVP. **Design**:
[saved-query.md](../../../../.agents/design/data-management/datasets/saved-query.md)
§ Execution model.

## What it is

**Runs** a saved query: re-executes its stored definition against its
source dataset's *current* Parquet and returns a paged row slice
(live re-run, no materialization).

## Shape decisions

- **No predicate params** — unlike the dataset rows-GET (`f<N>_*`,
  `aq`, `q`), this endpoint takes only `page` / `page_size`. The saved
  `definition` IS the predicate source of truth; the FE cannot override
  it here (query mode is read-only on predicates this round).
- **`RowsPage` shape is identical** to `GET /datasets/{id}/rows` — the
  BE delegates to the shipped `query_dataset_rows` after hydrating the
  definition, so the FE reuses the dataset detail page's row table
  verbatim. (Shape duplicated inline rather than `$ref`-extracted: the
  dataset rows-GET already inlines it; one extraction when a third
  consumer appears.)
- **Live** — mutating the source dataset between two runs changes the
  result; that freshness is the product value ("always-fresh").

## Errors

- `409 query_stale` — a saved atom no longer validates against the
  dataset's current columns (column removed / retyped). Returned
  *instead of* executing; the FE renders the "needs attention" state.
  Distinct from `422` (a malformed *request*) — the request is fine,
  the *stored definition* drifted.
- `404 not_found` — no such query.
- `422` — `page < 1`, bad `page_size`, or malformed `id`.
