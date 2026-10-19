# Round 199: shared filters for a group of widgets (item 4.3)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## ⟢ At a glance

_(authored at the Review → Complete flip)_

## Goal

**Inherits from ← [Round_198](Round_198.md)** (and [Round_195](Round_195.md)) — a dashboard
has a controls bar: `param` and `date_range` controls set the parameters the targeted queries
use; a viewer's values live in the URL (`p.*`), the server applies the saved ones (D3 level 2),
the card badge says which controls reached a widget. The only categorical filter is still the
per-widget drawer: one widget at a time, options from a capped row fetch, forgotten on reload,
invisible in the URL.

Give a dashboard **one filter for several widgets**: a `values` control binds one result
column; the editor picks which widgets it reaches and may save a selection; a viewer picks
values in the bar and every targeted widget whose result has the column re-reads, ANDed with
its own drawer; the URL holds the selection (`?f.<controlId>=North,South`, `~blank` for
`(blank)`) so a link reopens the view. The selection travels in the existing runtime `filters`
list (no second engine); a targeted widget whose result lacks the column is skipped and badged,
never an error (D5); the export's Filters sheet tells a dashboard filter from a widget filter
(D7). The options come from a new `GET /queries/{id}/values?column=` (distinct, capped at
1 000, flagged partial) — not from a capped row fetch.

_Track: 1 (product). Pulled by: release program item 4.3
([rc4.md § 4.3](../programs/release-rc2-rc5/rc4.md)) and the accepted design
`dashboards/dashboard-filters.md` D4, D5, D7 — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- **Contract** (additive, inside rc.4): `_shared/dashboard.yaml` — `DashboardControl` gains
  `ValuesControl` `{id, kind: values, label, column, targets, saved?: FilterValues}`
  (`FilterValues` = 1–200 unique `string | null`); one `values` control per column
  (`duplicate_column`). `_shared/query.yaml` — the runtime filter item becomes the named
  `RuntimeFilter` `{column, values, control?}`: an item with `control` is a SHARED filter (the
  viewer's selection for that `values` control), overriding the control's `saved`; a targeted
  `values` control with no item reads its `saved` — applied by the SERVER (D3 level 2, as R195
  did for parameters). `GET /rows` takes `f.<controlId>=v1,v2` (the dashboard URL spelling;
  `~blank`; an empty value = cleared) and applies the saved selections with `dashboard` +
  `widget`, before paging and the cap. New `GET /queries/{id}/values?column=` →
  `{column, values, partial}` (blank first, ascending, ≤ 1 000 non-blank), 422
  `unknown_column`. Export (D7): the Filters sheet's filter rows gain `scope`
  (`widget filter` / `dashboard filter <label>`) and `source` (`viewer` / `dashboard`).
- **Server**: `dashboards.py` validates the new control (shape, `duplicate_column`, the shared
  target / id checks); `params.py` (or a sibling) resolves the shared filters of a read: the
  request's `control` items (checked: `dashboard` present, a `values` control of that
  dashboard, same column; a non-targeting control ignored) + the `saved` of the targeted
  `values` controls not overridden; `queries.py` merges them into the existing name-based
  one-of (`_name_in_sql`) on `/rows` (`f.*`), `/aggregate`, `/totals`, `/export`; the export
  labels each row; the new `/values` route reads `SELECT DISTINCT` over the final relation.
- **Builder**: `types.ts` (`ValuesControl`, `FilterValues`); the bar shows a `values` control as
  a multi-select (`SharedFilterControl`) with options from `/values` (an info line "first 1 000
  values" when partial), a viewer selection outlined with "Reset to saved"; `f.*` ⇄ URL
  (`useDashboardViewState`: raw `location.search` split before decoding); each widget's reads
  carry the shared filters that target it as `control` items (POST) / `f.*` (rows) — the drawer
  stays client-side on rows (R103); the reach badge treats a `values` control as reached when
  the widget's result has the column, skipped "no column <column>" otherwise; the controls
  editor adds "Values (a shared filter)" — column (from the targeted queries' columns), targets,
  saved selection (from `/values`); Copy link pins the selection; MSW handlers + fixtures;
  EN/VI copy.
- **Tests**: design criterion 6 (a `values` control reaches exactly its targets; a target
  lacking the column is skipped with a badge and renders; `(blank)` survives the URL as
  `~blank`) and criterion 7's filters part (the XLSX Filters sheet separates dashboard from
  widget filters); scope respected (a non-targeted widget is untouched; a `control` item for a
  non-targeting control is ignored); URL round trip (`f.<id>` set → reload → same selection;
  cleared `f.<id>=` → no filter and the saved not applied; Reset drops the key); the values
  endpoint cap (1 001 distinct → 1 000 + `partial: true`; blank first; post-step column);
  save checks; a dashboard saved before this round reads byte-identically.

**Falsified if** any of these happens:

- a shared filter needs a second filter engine or a second SQL path (it must ride
  `_name_in_sql`);
- a viewer's selection is saved, or the client asserts a "dashboard" selection the server
  should have read;
- a targeted widget whose result lacks the column errors instead of rendering + badging;
- a dashboard with only `param` / `date_range` controls reads differently (byte-identical GET,
  identical read bodies);
- the options list comes from a capped row fetch, or a capped list is not flagged.

- [x] **D** — no new design doc (`dashboard-filters.md` Accepted); `flow-selector`; `ux-design`
      facet check on the bar control + editor row
- [x] **C** — `ValuesControl` / `FilterValues`, `RuntimeFilter.control`, `f.*` on `/rows`,
      `GET /queries/{id}/values`, the Filters sheet split. **BA pass 1 at Contract exit.**
- [ ] **B** — control validation; shared-filter resolution (viewer item → saved); `f.*` parsing;
      the `/values` route; the export rows; tests
- [ ] **F** — types, bar control, URL state, per-widget routing, reach badge, editor, share link,
      MSW, EN/VI; tests
- [ ] **I** — visual gate (light EN + VI; dark N/A — no theme)
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

- **Who applies the saved selection.** The design calls `saved` "D3 level 2" without saying
  who reads it. R195 settled the parameter case on the server (a client never asserts a
  "dashboard" value — BA F1), so this round does the same for `values` and gives `GET /rows`
  an `f.<controlId>` viewer key beside `p.<name>`: every read path owns level 2 the same way,
  an API caller naming the widget gets the dashboard's numbers, and the table widget's cap
  applies after the filter. The alternative — the builder resolves viewer → saved and sends
  one tagged item — needs no server change on `/rows` but splits level 2 between client and
  server and leaves the capped table filtered client-side. **BA pass 1 may dispute** the
  choice; the contract is written for the server side.
- **The URL spelling.** `?f.ctl=North,South` is the accepted D4 form, so a comma inside a value
  must be `%2C` and both sides split BEFORE decoding (`URLSearchParams` would decode first).
  The builder reads the raw `location.search` for `f.` keys and writes them by hand; the server
  reads `request.url.query`. A value that is literally `~blank` is written `%7Eblank`.
- **One control per column.** Mirrors `duplicate_param`: two `values` controls on one column
  with different targets would AND on a widget both reach; refused at save rather than
  explained in a badge. Owner may want it allowed (logged).
- **The options' relation.** `/values` reads the FINAL relation (post-step), the one `/totals`
  and `/export` filter. `/aggregate` filters the pre-step relation — but the builder only
  aggregates server-side for un-stepped queries (R127), where the two are the same.
- **Which query feeds the options.** D4 says the first targeted widget's query. A control
  targeting `all` on a dashboard whose first widget is a note or lacks the column → the bar
  takes the first targeted non-note widget whose bound query's columns include the column;
  none → an empty select with a hint. Tested, not left to chance.

## Do

- 2026-10-19 — D: none new; `dashboard-filters.md` D4, D5, D7 (Accepted 2026-10-18).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | saved only / viewer selection / cleared / skipped (no column) / capped options / drawer AND  |
| 2. New interaction pattern           | no     | a multi-select in the R195 bar; the drawer's select, one level up; URL state as `f.*`        |
| 3. High user-error risk              | no     | a viewer selection is never saved; Reset to saved restores; a missing column skips, no error |
| 4. Contract depends on unresolved UI | no     | the control shape and the URL form are fixed by D4; options endpoint named in the design     |
| 5. UX confidence below threshold     | no     | layout in the accepted design ("Team [North, South ▾]", "[Team skipped: no column]")         |

Result: **Flow: DCFBI** — one condition fired (below the 2-of-5 threshold).

**`ux-design` (design-spec, the bar's shared filter)** — Findability: the control sits in the
R195 bar under its label, the same place as a period; Usability: a multi-select with the
column's values, `(blank)` as an option, clear-all = "no filter" (the URL says so, the saved
selection does not creep back); Accessibility: the select is labelled by the control label,
the partial-list note is text, the skipped badge carries the reason in its `aria-label`;
Credibility: options come from the data (distinct over the whole result, flagged when capped),
the badge names every control that reached a widget; Utility: one gesture filters every
targeted widget, the export says which filter was a dashboard one; Desirability: AntD `Select`
`mode="multiple"`, no new token. No gap.

### C

- **C** — `_shared/dashboard.yaml`: `DashboardControl` = `ParamControl | DateRangeControl |
ValuesControl` (discriminator `kind`), `FilterValues`; `_shared/query.yaml`: `RuntimeFilter`
  (`control?`), `AggregateRequest.filters` and the totals / export bodies `$ref` it,
  `DashboardRef` names the third control kind; `queries/rows-get`: `f.<controlId>` keys and the
  server-applied saved selections; `queries/values-get.contract.{yaml,md}` (new);
  `queries/export`: the Filters sheet's `scope` / `source` columns (D7); `queries/aggregate`:
  the 422 text also stops claiming an unknown `filters[].column` is refused (it is skipped —
  R103, D5); `dashboards/post|put`: `duplicate_column`; `api-error.yaml`:
  `ApiErrorUnknownColumn` reused by `/values`. Contracts 50 green.
  **BA pass 1 (contract exit): run by the orchestrator** (no sub-agent spawning in the coder
  session, as in R198); its findings fold before any code.

## Check

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] Visual gate: light (EN + VI); dark N/A (no dark theme — owner)
- [ ] BA (contract exit + after build) · code review · QA — no open P0/P1
- [ ] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of N`; script from the BA
      (pass 2)

## Act

_(at close-out: rolling-log rows, promotion check, prune check)_

## Feeds into → Round_200

Item 4.4 — definition history (migration, `GET /{kind}/{id}/history`), after 4.3 is in Review.
