# GET /queries/{id}/values — rationale

**Round**: R199 — item 4.3, shared filters for a group of widgets.
**Plan/design**: [Round_199.md](../../../../.agents/plan/cycles/Round_199.md),
[dashboard-filters.md](../../../../.agents/design/dashboards/dashboard-filters.md) D4, D5.

## What it is

The option list of a dashboard **`values` control** (a shared filter): the
distinct values of one column of a saved query's **final** result, blank first
then ascending, capped at 1 000 non-blank values and flagged `partial` when
capped. One DuckDB `SELECT DISTINCT` over the whole relation.

## Why it exists

The per-widget drawer builds its options from the rows a widget fetched — a
capped fetch (`dashboard_max_rows`), so on a large query the list misses values
that exist. A shared filter is set once for several widgets; its options must
come from the data, not from one widget's partial fetch (D4: "not from a capped
row fetch"). The cap is explicit and honest: `partial: true` says "first 1 000
values" rather than pretending the list is complete.

## Shape decisions

- **One column per call.** The control binds one column; the bar asks for it
  when the control is shown. A multi-column form would be a second endpoint
  shape for no caller.
- **The final relation.** The column a widget filters on is a column the
  widget _sees_: post-step when the query has transform steps (the same
  relation `/totals` and `/export` read), the effective columns otherwise.
- **Parameters, no filters.** The read resolves parameters like `/rows` (the
  options follow the period the widget reads) and applies no runtime filter —
  the list must show the alternatives to the current selection, and cascading
  controls are OUT (design § Scope boundary).
- **Blank as `null`, once, first.** A NULL and an empty string are one option,
  `(blank)`, mirroring `RuntimeFilter` (`null` matches a NULL/empty cell) and
  the client `labelOf`.
- **Sorted in the column's own order** (BA-C3). A numeric column lists 2
  before 10, a date column lists chronologically, text lists lexically; the
  cap takes the first 1 000 in that order, so a capped numeric list is "the
  1 000 smallest", not a lexical accident.
- **Cap in the contract, not a tunable.** 1 000 is the design's number; a
  column past it needs a cascading or typed-search control (OUT, named
  trigger), not a bigger list.
- **Errors mirror the read path.** 404 absent; 409 `query_stale` /
  `relationship_stale` / `step_invalid`; 422 `unknown_column` (reusing the R152
  shape — the request is well-formed, the name is unknown), the `DashboardRef`
  envelope cases, `param_unbound` / `param_invalid`.

## Cross-links

- `_shared/dashboard.yaml#/ValuesControl` — the control whose options this
  serves; `_shared/query.yaml#/RuntimeFilter` — how the selection travels.
- [rows-get.contract.md](rows-get.contract.md) — the `p.` / `dashboard` /
  `widget` conventions this endpoint shares.
