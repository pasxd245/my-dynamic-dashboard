# Round 190: design — typed parameters, the view-time date range and shared filters

**Status**: Review — design doc written, `ux-design` design-spec run; awaiting the owner's decisions (D1–D7) and sign-off
**Flow**: Design gate only (item 2.7) — no contract, backend or builder change.
**Date started**: 2026-10-17
**Date completed**: —

## ⟢ At a glance

**Shipped** — [`dashboards/dashboard-filters.md`](../../design/dashboards/dashboard-filters.md)
(Draft): one model for parameters, dashboard controls and the date range, consumed by items 3.7,
3.8, 4.2, 4.3. Seven decisions for the owner:

- **D1** — a query declares `params [{name, type: date | number | string, label?, default?}]`
  (≤ 8, scalar). A date default may be `{"kind": "today", "offsetDays": n}`, resolved by the
  server in a new `backend.time_zone` setting. Values are never written into the definition, so
  two reads share one `definitionVersion`.
- **D2** — `{"param": name}` is allowed only in filter operands: atoms, one item of an `in` list,
  filter steps and `case` WHEN. It is never a column (`refCol`), never an output constant, and
  never in a workflow step.
- **D3** — precedence: viewer (URL / request) → dashboard saved value → query default →
  `422 param_unbound`. A value of the wrong type → `422 param_invalid`. Every read echoes
  `resolvedParams` with the source of each value.
- **D4** — `DashboardDefinition.controls` (`param` · `date_range` · `values`) with editor-picked
  `targets` and a saved value. Viewer values live only in the URL (`p.*`, `f.*`); saving a value
  needs edit mode. A new `GET /queries/{id}/values` supplies the options.
- **D5** — a control that cannot apply to a widget is skipped and badged on the card, never
  turned into an error.
- **D6** — a workflow source query runs with its defaults only. The run stamp records
  `sources[].params`.
- **D7** — totals, export (a Parameters block in the Filters sheet), metadata (3.8) and an
  "incomplete window" note (coverage `max`, input to 4.5) carry what was applied.

**Studied** _(predicted → saw → now believe)_ — **predicted** the hard part was precedence. **Saw**
that precedence collapses to three levels once the default is understood to _be_ the value saved in
the query (the program listed them as two), and that the real constraints come from what already
exists: filters are name-based and skip a missing column, there is no "today" or time zone
anywhere, and runtime filters already reach `/aggregate`, `/totals` and `/export` but not
`GET /rows`. **Now believe (medium)** that parameters belong only where a filter operand goes; every
wider placement (outputs, list parameters, run inputs) waits for a report that needs it.

**Watch** — the per-widget drawer stays beside the new controls, so there are two kinds of filter
on one card; the badge has to make that legible. `GET /rows` will take parameters as `p.<name>`
query keys (a GET body is not an option), which makes the URL spelling and the API spelling the
same on purpose. The `X-MDD-Params` header on CSV export is the one place a value leaves the app
outside a body.

## Goal

**Inherits from ← [Round_189](Round_189.md)** — the rc.3 refresh items are built. Item 3.6 waits
for walk session B (G-wf). Item 2.7 is design only, does not depend on 3.6, and blocks 3.7 and
3.8, so it was pulled forward by the owner (2026-10-17).

Settle how a dashboard is re-read for another period or slice without editing queries.

_Track: 1 (product). Pulled by: the release program's item 2.7 (moved from rc.2), consumed by 3.7,
3.8, 4.2 and 4.3 — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a design doc that passes the design gate. It names the model, the placement
rules, precedence, URL state, skip behaviour and recording, and it maps every journey to testable
criteria owned by a later round.
**Falsified if**: a 3.7 builder cannot start from the doc without an open model question, or a
criterion cannot be tested as written.

- [x] **D** — `dashboards/dashboard-filters.md` (Draft): Why, Today (facts with file pointers),
      Surfaces (planned), Token map, Layout, Decisions D1–D7, Behaviour (states), journeys J1–J3,
      criteria 1–10 (each tagged with its building round), Scope boundary with named triggers.
- [x] Sibling docs — `dashboard-layout.md` OUT-of-scope "shared filters" now points here;
      `widgets.md` drops the "table with `agg: sum`" known gap (fixed in `ff9647a`) and states the
      table-saves-as-count rule.
- [x] `ux-design` design-spec mode (below).

## Risks / unknowns

- **Owner decisions** — D1–D7 are proposals until accepted. The likeliest to change are the
  default time zone (`UTC`) and whether the date range is two parameters or one range type.
- **Workflows** share the `Step` union with queries (`common.py`), so D2's "never in a workflow
  step" needs an explicit check at workflow save. It is easy to forget in 3.7.
- **Values endpoint cost** — distinct values over a query result are one DuckDB pass. They are
  capped at 1 000 and not measured on a large result yet.

## Do

- 2026-10-17 — owner: "2.7 thiết kế" (with the rc.2 release note and the plan update) while the
  walks are pending.
- 2026-10-17 — surveyed the current code: literal operands, runtime filters, the dashboard model,
  time zone, the workflow run stamp, design-lint rules. Wrote the doc, then ran `ux-design`. It
  found one gap: the doc did not say how an analyst puts a parameter into a query. Added the
  query-page authoring affordance (a Parameters panel and a "Use parameter" switch) to D1 and
  the Surfaces table.

## Check

- [x] `design:lint` 0 (18 docs), `design:tokens` 0, markdownlint 0, `plan:lint` 0
- [x] **`ux-design` design-spec** — `dashboards/dashboard-filters.md`:
  - Findability **pass**: labelled controls in a bar above the grid; the reach badge per card;
    authoring via the Parameters panel and the "Use parameter" switch (gap found and closed
    in-round).
  - Usability **pass**: Reset to saved, Copy link, clearable values, saving only in edit mode.
  - Accessibility **pass**: AntD labelled controls; the badge carries text reasons, not colour
    only.
  - Credibility **pass**: the Behaviour table covers invalid, unbound, skipped, capped and
    beyond-coverage states.
  - Utility **pass**: J1–J3 map to criteria 1–10.
  - Desirability **pass**: the token map adds no new token.
- [ ] **Design gate** (owner): D1–D7 accepted or amended; the doc's Status flips to Accepted.

## Act

_(at close)_

## Feeds into → Round_191 (TBD)

Item 3.6 — publish a workflow output as a derived dataset with lineage; saved copies in
`<workspace>-saved` (label R180). **Opens only after walk session B confirms G-wf.** Then 3.7
(typed parameters, from this doc's D1–D3, D6).
