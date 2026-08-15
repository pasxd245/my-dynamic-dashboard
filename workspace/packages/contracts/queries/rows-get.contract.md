# GET /queries/{id}/rows — rationale

**Round**: R69 — Saved Query MVP. **Design**:
[saved-query.md](../../../../.agents/design/data-management/queries/queries.md)
§ Execution model.

## What it is

**Runs** a saved query: re-executes its stored definition against its
source dataset's _current_ Parquet and returns a paged row slice
(live re-run, no materialization).

## Shape decisions

- **No predicate params** — unlike the dataset rows-GET (`f<N>_*`,
  `aq`, `q`), this endpoint takes only `page` / `page_size` (plus the
  R107 `unpaged` flag). The saved `definition` IS the predicate source
  of truth; the FE cannot override it here (query mode is read-only on
  predicates this round).
- **`unpaged=true` — single-request fetch (R107)** — the dashboard
  widget's load path. When set, paging is bypassed and the endpoint
  returns the result in ONE response, capped server-side at
  `dashboard_max_rows`. The name describes the mechanism (no paging),
  not completeness — an oversized result is still capped (we deliberately
  did NOT call it `all`, which would overpromise). Replaces the FE's
  paged-at-100 fetch-all loop (cross-widget dedup was already handled by
  React Query; this kills the per-query _request count_). The cap moved
  server-side so the unpaged path can't bypass R104's bound; `total`
  still carries the full matched count, so a partial (capped) result is
  detectable via `total > rows.length`.
- **`RowsPage` shape is identical** to `GET /datasets/{id}/rows` — the
  BE delegates to the shipped `query_dataset_rows` after hydrating the
  definition, so the FE reuses the dataset detail page's row table
  verbatim. (Shape duplicated inline rather than `$ref`-extracted: the
  dataset rows-GET already inlines it; one extraction when a third
  consumer appears.)
- **Live** — mutating the source dataset between two runs changes the
  result; that freshness is the product value ("always-fresh").

## Row order + the paging guarantee (R172)

Full mechanism + per-path table:
[`_paging-and-order.md`](../../../../.agents/design/data-management/_paging-and-order.md).

**Intended guarantee** — walking every page returns every row exactly once; the paged walk equals
the unpaged read; the same page twice returns the same rows. The order is **what the query asked
for**: a `sort`/`top_n` step leads, with the remaining columns as tiebreaks (`_page_order_sql`,
R165 W-7); with no ordering step the order is arbitrary as a presentation but **reproducible**,
which is the only property paging needs. A **joined** query reads in driving-dataset order.

> **KNOWN GAP — a joined query above ~120k rows does NOT satisfy this.** `query_joined_rows` pages
> a hash join with no `ORDER BY`; `preserve_insertion_order` protects a scan but not a parallel
> join. Measured: 200k rows → 21 344 returned twice and 21 344 never returned, while `total` and
> the page sizes all look correct. Recorded as a strict `xfail` in `test_paging_partitions.py` and
> open in [Round_172](../../../../.agents/plan/cycles/Round_172.md). **Do not build a consumer
> that assumes a stable page over a large joined query until this closes.**

## Errors

- `409 query_stale` — a saved atom no longer validates against the
  dataset's current columns (column removed / retyped). Returned
  _instead of_ executing; the FE renders the "needs attention" state.
  Distinct from `422` (a malformed _request_) — the request is fine,
  the _stored definition_ drifted.
- `404 not_found` — no such query.
- `422` — `page < 1`, bad `page_size`, or malformed `id`. (With
  `unpaged=true`, `page` / `page_size` are ignored, so a bad `page_size`
  alongside it does not 422 — the unpaged path skips that check.)
