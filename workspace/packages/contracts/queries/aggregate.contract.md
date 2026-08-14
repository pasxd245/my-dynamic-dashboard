# POST /queries/{id}/aggregate — rationale

**Round**: R119 — the data-layer server-side aggregate (GROUP BY).
**Plan/design**: [Round_119.md](../../../../.agents/plan/cycles/Round_119.md).

## What it is

A **stateless** server-side `GROUP BY (dimensions) → measures` over a
**saved** query's resolved rows, computed in DuckDB. A dashboard widget that
aggregates (bar / pie / line / scalar KPI) calls it instead of fetching capped
raw rows and rolling them up in the browser. The result is one row per group —
small — so the dashboard row cap is irrelevant and the totals are correct.

## Why it exists

The R109–R118 charts probe found the dominant data-layer pull is a server-side
aggregate: a `SUM` / `COUNT` over the first N (capped) rows is **wrong**, not
merely partial — a KPI computed client-side over a truncated fetch is incorrect.
The engine already compiles a query to a typed DuckDB SELECT, so the aggregate
is a GROUP BY projection over the existing relation — DuckDB, not a new engine.

## Shape decisions

- **Stateless, like preview.** The grouping spec lives on the WIDGET (ad-hoc
  per render), not in the saved query. So the request carries the
  `{ dimensions, measures, filters }` directly; nothing is persisted. Mirrors
  `POST /workspaces/{id}/queries/preview`.
- **Columns by NAME, not index.** The consumer (a widget) thinks in effective
  column names (`dimensionCol` / `measureCol`), so `dimensions[]` and
  `measures[].col` are names — unlike a `FilterAtom`'s 0-based `col` index.
- **Errors mirror the saved run** verbatim — `404` absent query; `409`
  `query_stale` / `relationship_stale` for drift; `422`
  for a bad aggregate spec (unknown column, `sum` without a numeric `col`, a
  `count` carrying one). It resolves the plan with the SAME engine as
  `GET /queries/{id}/rows`, so drift is detected identically.
- **Output dtypes.** A dimension keeps its source dtype; a `sum` keeps the
  measure column's numeric dtype; a `count` is `integer` (named `count`). So a
  chart treats the measure as numeric with no client re-typing.
- **Dashboard filters pushed server-side.** `filters` is the R103 runtime
  filter set (categorical one-of by effective-column NAME), AND-composed before
  the GROUP BY so an aggregated widget honours an active filter. `(blank)` is a
  wire `null` (matches a NULL/empty cell), mirroring the client `applyFilters`.
- **Scope (R119).** 0-or-1 `dimensions` (scalar KPI = 0; bar/pie/line = 1) and
  1 `measures`. Multi-dimension (series / crosstab), multi-measure (combo),
  time-bucketing (`date_trunc`) and TOP-N are deferred to follow-up rounds.
