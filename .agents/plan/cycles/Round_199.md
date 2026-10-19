# Round 199: shared filters for a group of widgets (item 4.3)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## ⟢ At a glance

**Shipped** — one filter for several widgets.

- A `values` control binds one result column; the editor picks the widgets it reaches and may
  save a selection, which the **server** applies to every read of a targeted widget. A viewer
  picks values in the bar; every targeted widget whose result has the column re-reads, ANDed
  with its own drawer; a widget without the column is badged "Team skipped" and renders (D5).
- The selection lives in the URL (`?f.<id>=North,South`, `~blank` for `(blank)`, `f.<id>=` =
  cleared) and travels in the existing `filters` list — one engine. Copy link pins it, Reset to
  saved drops it, an old link to a removed control still opens and loses its key.
- Options come from the new `GET /queries/{id}/values` (distinct over the whole result, blank
  first, in the column's own order, "First 1 000 values" when capped). The export's Filters sheet
  says which filter was the dashboard's (`dashboard filter Team · viewer | dashboard`) and which
  the widget's.
- Backend 705 · builder 581 · contracts 50; BA (both passes) PASS, QA PASS, code review CHANGES →
  one P1 fixed; the owner's walk W1–W17 is open.

**Studied** _(predicted → saw → now believe)_ — predicted the hard part was the URL: a comma
list split before decoding, with a raw `~blank`, surviving every write on a page that wrote
through `URLSearchParams`. BA pass 1 caught exactly that before code (BA-C2) and the one raw
writer held through the reviews. Saw: the P1 was in the **SQL**, not the URL — a two-value or
blank filter made DuckDB drop file order on the single-source scan, so pages overlapped past
~130k rows. My own test sorted its rows to pass and I logged the symptom as an "order quirk";
the code reviewer's 400k-row probe made it a defect. R171 had named this reliance as a risk. Now
believe (high confidence — third incident on a third read path): an order the engine happens to
keep is not an order; page and list with an explicit `ORDER BY`, and treat "the test needed
`sorted()`" as a finding. Promoted this round.

**Watch** — the two owner questions (two values controls on one column; list a skipped shared
filter in the export); the stepped / joined exports list without an `ORDER BY`; `/aggregate`
filters a stepped query pre-step (API-only); the widget-builder preview ignores an all-targeting
values control; the reach badge on a widget whose join / steps no longer resolve; VI "(blank)"
outside the bar; the MSW `/rows` ignores `f.*`.

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
- [x] **B** — control validation; shared-filter resolution (viewer item → saved); `f.*` parsing;
      the `/values` route; the export rows; tests
- [x] **F** — types, bar control, URL state, per-widget routing, reach badge, editor, share link,
      MSW, EN/VI; tests
- [x] **I** — visual gate (light EN + VI; dark N/A — no theme)
- [x] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed (CR re-check of
      CR-1..CR-5 at `588104b` pending)

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

- **C (`899a93c`)** — `_shared/dashboard.yaml`: `DashboardControl` = `ParamControl |
DateRangeControl | ValuesControl` (discriminator `kind`), `FilterValues`;
  `_shared/query.yaml`: `RuntimeFilter` (`control?`), `AggregateRequest.filters` and the totals
  / export bodies `$ref` it, `DashboardRef` names the third control kind; `queries/rows-get`:
  `f.<controlId>` keys and the server-applied saved selections;
  `queries/values-get.contract.{yaml,md}` (new); `queries/export`: the Filters sheet's `scope`
  / `source` columns (D7); `queries/aggregate`: the 422 text also stops claiming an unknown
  `filters[].column` is refused (it is skipped — R103, D5); `dashboards/post|put`:
  `duplicate_column`; `api-error.yaml`: `ApiErrorUnknownColumn` reused by `/values`. Contracts
  50 green.
- **BA pass 1 (contract exit, `468befe..899a93c`, run by the orchestrator — no sub-agent
  spawning in the coder session, as in R198): CHANGES** — 0 P0, 2 P1, 3 P2; the four design
  calls in § Risks accepted (call 3 conditional on BA-C2; call 2 with an owner question).
  - **BA-C1 (P1)** — a stale `f.<id>` / `control` item (its control removed, or dropped with its
    last target) was a 422 `unknown_control` while an unused `p.<name>` is ignored. Folded:
    the server **ignores** an `f.` key / `control` item naming no `values` control of the named
    dashboard (a stale link keeps opening — D5 spirit); the builder drops such keys from the
    URL on load and never re-pins them. 422 stays only for `control_without_dashboard` and
    `control_column` (real caller errors). Test: deleted control + old link → 200, filter not
    applied, key gone after load.
  - **BA-C2 (P1)** — split-before-decode with a raw `~blank` breaks the moment R195's
    `withParams` re-serialises the URL through `URLSearchParams` (`,` → `%2C`, `~` → `%7E`):
    `f.ctl=North,South,~blank` becomes ONE literal value → zero rows, no error. Folded: **one
    raw URL writer** for the page — every write (a `p.*` change, Reset, Copy link, an `f.*`
    change) preserves the `f.*` bytes; the contract says "percent-decoding only, `+` is a
    literal plus" and fixes the parsing edges (BA-C5): repeated `f.<id>` → last wins; an empty
    token between commas → ignored; `f.<id>=` → cleared; the raw `~blank` token is blank,
    `%7Eblank` is the literal string "~blank". Tests: change `p.` while `f.` is set → `f.`
    byte-identical; `%7Eblank` ≠ `~blank`.
  - **BA-C3 (P2, folded)** — `/values` orders in the column's own type (numeric, chronological,
    text), not text order; the cap takes the first 1 000 in that order.
  - **BA-C4 (P2, logged)** — export: a cleared shared item writes no row (folded into the
    contract text); whether a _skipped_ shared filter should be listed as "skipped: no column"
    is an **owner question** (§ Act).
  - **BA-C5 (P2)** — folded via BA-C2.
  - One more test asked for design call 4: a post-step (derived) column lists values and filters
    identically on `/rows` and `/export`.
- **Contract fold (`e475f5d`)** — contracts 50 green, md / plan / design lints 0.
- **B** — `models/common.py`: `ValuesControl` (unique `saved`), `AggregateFilter.control`;
  `dashboards.py`: `duplicate_column`, the column unchecked against the queries (D5);
  `params.py`: `dashboard_definition` split out of `dashboard_values` (one load serves the
  parameter level and the shared filters); new `app/shared_filters.py`: `parse_f_keys` (raw
  query string, split before decode, `~blank`, edges BA-C2/C5), `resolve` (viewer items →
  saved; stale / non-targeting control ignored — BA-C1; `control_without_dashboard`,
  `control_column`), `pairs` (skip a missing column), `applied` (the export rows);
  `rows_reader.py`: `_name_in_terms` composes the shared filters into the dataset, joined and
  stepped readers' own WHERE (one SQL for the drawer and the shared filter; stepped: over the
  FINAL relation); `queries.py`: `/rows` reads `f.*`, `/aggregate` · `/totals` · `/export`
  resolve through `_final_relation`, new `GET /queries/{id}/values` (`SELECT DISTINCT` over the
  final relation, typed `ORDER BY`, `VALUES_MAX + 1` probe for `partial`, blank first, 422
  `unknown_column`); `export.py`: `column | values | scope | source`. `tests/test_shared_filters.py`
  (13): save checks, criterion 6 (targets, skip, `~blank`, cleared, before the cap), the URL
  parsing edges, an encoded comma, a stale control (GET + POST), the refusals, aggregate /
  totals / the drawer AND, criterion 7 (sheet rows: saved · viewer · cleared · skipped · no
  dashboard), `/values` (blank first, numeric order, `unknown_column`, a post-step column that
  filters identically on `/rows` and `/export`, the 1 000 cap, parameters). Backend 700 green,
  ruff clean. Seen: under an OR predicate (`North` ∪ blank) the parquet scan does not keep file
  order — the R171 `preserve_insertion_order` reliance; the test sorts; rolling-log row.
- **B (`ebb2cde`)** — re-verified after a session cut: backend 700, ruff clean.
- **F** — `types.ts` (`ValuesControl`, `controlParams` → none for it), `queries/types.ts`
  (`AggregateFilter.control`, `ColumnValues`); new `sharedFilters.ts` — the URL side: the parser
  (the server's rules, BA-C2/C5), `encodeSelection` (`~` → `%7E`, `null` → `~blank`), **the one
  raw writer** `writeSearch` and its uses (`withParamsRaw`, `withSelectionRaw`,
  `withoutViewerRaw`, `withoutStaleRaw`), `sharedItemsFor` (a viewer selection only to the
  targeted widgets), `rowsFilterSuffix`; `queriesApi` (`f.*` appended raw to the `/rows` read;
  `values()`); `hooks.ts` (`useWidgetData` / `useWidgetFilterOptions` carry the shared items;
  `useColumnsOfQueries`, `useColumnValues`); `DashboardParams.tsx` (`paramContextFor`,
  `useWidgetSharedFilters`, `controlReach(…, columns)` — reached when the result has the column,
  skipped "no column <column>", unknown → neither; `ValuesSelect` (options from `/values`,
  `(blank)` option, "First 1 000 values"); the bar's `SharedFilterControl` (outlined viewer
  selection, Reset, Copy link pins every values control raw and drops a stale key); the editor's
  values row (label, column — one per column, targets, saved selection) and "Values (a shared
  filter)" in Add); `DashboardDetailPage.tsx` (every URL write — `p.*` change, Reset, `f.*`
  change — through `navigate({search})` with the raw writer instead of `setSearchParams`;
  `f.*` read from the raw `location.search`; stale `f.` keys replaced away on load; widget
  columns for reach; the options source = the first targeted widget whose result has the column,
  with that widget's parameter context); `WidgetView.tsx` / `WidgetFilterDrawer.tsx` /
  `exportWidget.ts` (the shared items on aggregate, totals, rows, the drawer's options and the
  export, after the widget's own filters); MSW `GET /queries/:id/values` (contract-validated) and
  an empty (cleared) list restricting nothing in the mock aggregate (server parity); EN/VI
  (`dashboard.params.values.*`, `skippedNoColumn`, the editor hint names a shared filter).
  `tests/shared-filters-r199.test.tsx` (16): the parser edges, round-trip encoding,
  **a `p.` change leaves `f.` byte-identical** and Reset drops both, `%7Eblank` ≠ `~blank`, a
  stale key dropped (pure + page: the old link opens, reads, loses the key), reach and routing,
  the share link, the export body, MSW parity (PUT echo, `/values`), the bar (raw `f.` on the
  targeted read only, skipped badge text, options over the first widget with the column,
  partial note, selected options), picking / clearing writes (`~blank`, `f.<id>=`), the editor
  (add → first text column, save). Builder 580 green (detached full run), `tsc` clean.
- **Visual gate (light, EN + VI; dark N/A — no theme):** real backend on an isolated data dir
  (`scratchpad/r199/data`), fake `calls_demo` (Acme agents, 56 rows, teams incl. blank), a
  **Weekly** dashboard: Team values control saved ["North"] targeting a bar, a table and a stat
  over a query without `team`; a fourth stat untargeted. Screenshots (`scratchpad/r199/shots/`):
  saved selection (North only, no Reset), a link `?f.<id>=South,~blank&f.ctl_0000dead=x` (the
  stale key gone from the URL after load, the control outlined, "(blank)" / "(trống)" tags,
  Reset), the options list (blank first, the selection checked), the skipped badge tooltip, the
  editor's values row (EN + VI). Network: only the three targeted widgets' reads carried
  `f.ctl_0000c199=South,~blank`, byte-for-byte; the skipped widget read 56 of 56 rows.
- **Reviews after F** (run by the orchestrator on `468befe..42abfd2`):
  - **Code review: CHANGES** — **CR-1 (P1)**: on the single-source read
    (`query_dataset_rows`) a shared filter of two values (`IN (?, ?)`) or with blank
    (`… OR col IS NULL`) made DuckDB emit the scan out of file order despite
    `preserve_insertion_order`; the read pages with `LIMIT/OFFSET` and no `ORDER BY`, so pages
    overlapped and missed rows (CR, 400k rows: 19 671 / 19 123 distinct of 19 900); the unpaged
    widget read and the single-source export were out of order too. The round's own test hid it
    with `sorted()` — the coder's "Seen" note above called it an order quirk; it was the R171
    reliance failing. P2: CR-2 (a malformed escape decoded differently by the two parsers), CR-3
    (MSW `/rows` ignores `f.*`), CR-4 (no joined-query `/rows` shared-filter test), CR-5 (unused
    `values.noSaved` copy).
  - **QA: PASS** — gates re-run clean (backend 700 · builder 580 · contracts 50), new tests red
    at base, 11 base-vs-HEAD shapes (9 byte-identical, 2 differing only by the intended `scope |
source` columns), visual gate light EN 6/6 · VI 6/6; 37 adversarial tests handed over
    (`scratchpad/r199/qa-tests/`). P2: QA-1 (= CR-1, rows grouped by value in the table), QA-2
    (`/aggregate` applies a shared filter over the pre-step relation of a stepped query —
    API-only, already in § Risks), QA-3 ("First 1 000 values" is covered by the open list).
  - **BA pass 2:** pending (forwarded by the orchestrator).
- **Fix** — **CR-1**: a FILTERED single-source read now reads
  `read_parquet(?, file_row_number=true)` and pages `ORDER BY file_row_number`, an explicit
  order rather than an engine default (the unfiltered scan keeps the R172 behaviour, so page 1 of
  a large dataset still stops early; a filtered read already scans the whole file for its
  count). The single-source export lists its relation `ORDER BY file_row_number`
  (`_final_relation` carries the order column, the export selects the result columns by name so
  it never leaks). Measured at base: out of file order from 50k rows, overlapping pages from
  ~130k. **The definition `in` atom** (`filters.py`) builds the same shape on the same read
  path and failed the same way (130k: 30 343 distinct of 30 389) — the same fix covers it, so
  it is folded here, not logged. `tests/test_shared_filter_paging.py` (4, ~2.5 s, 130k rows):
  pages partition in file order for two values, value + blank and a definition `in` atom; the
  unpaged widget read and the export over HTTP in file order with no order column in the file —
  **all four fail on the unfixed reader** (and the `~blank` assertion in `test_shared_filters`
  with them); the `sorted()` is gone. **CR-2**: the server keeps a malformed token raw (a `%`
  without two hex digits, or escapes that are not UTF-8) — the builder's `decodeURIComponent`
  rule; same cases tested on both sides. **CR-4**: a joined query's `/rows` filters by the
  effective (qualified) column, in driving order, and skips an unqualified name it lacks.
  **CR-5**: `values.noSaved` dropped (EN/VI). **QA-3**: the open list's footer says "First 1 000
  values" (`popupRender`); the note under the select stays for the closed state. **Logged**
  (rolling log): CR-3, QA-2; the stepped and joined **exports** list their relation without an
  `ORDER BY` (the stepped `/rows` path orders by `_page_order_sql`, the joined by `_ORD`; the
  export of either does not) — outside this item's defect, a P2 candidate.

- **BA pass 2 (`468befe..42abfd2`): PASS, conditional on CR-1** (fixed in `588104b`) — criteria 6
  and 7 (filters), scope, URL round trip, `/values` cap, save checks, byte-identical old
  dashboards and the falsifiers verified; BA-C1..C5 and the derived-column test closed in code.
  P2 ×6: BA-F1 the design doc untrue (§ As built (4.2) still said "values control not built", D4
  named the first targeted widget's query, no § As built (4.3)); BA-F2 VI "(blank)" on the chart
  axis / drawer / XLSX while the bar says "(trống)"; BA-F3 the shared filter is edited under
  "Parameters"; BA-F4 re-binding a control to another column kept its id, so an old link's
  `f.<id>=North` filtered the new column to zero rows; BA-F5 the widget-builder preview ignores
  an all-targeting values control; BA-F6 the reach badge reads `resolvedColumns`, so a widget whose
  join / steps no longer resolve is badged from its pre-step columns. Walk script W1–W17 below.
- **BA pass 2 folds (`f746168`)** — BA-F4: a column change in the editor drops the saved
  selection and gives the control a **new id** (the old key goes stale → the BA-C1 path); tested
  (re-bind → the PUT carries a new id, no `saved`, the old key is stale). BA-F3: the header
  button, the editor title and the saved toast say "Parameters & filters" / "Tham số & bộ lọc".
  BA-F1 in the close-out docs commit (design doc § As built (4.3), the stale lines fixed). BA-F2
  (contained only if `BLANK_LABEL` stops being the drawer's filter sentinel — not cheap), BA-F5,
  BA-F6 → rolling log. Builder touched files 56 green, `tsc` clean; full builder suite 581 green (detached).

## Check

- [x] backend 705 · builder 581 · contracts 50 green; `tsc --noEmit`; `ruff check`; md / plan /
      design lints 0; M3 guard over `468befe..HEAD` empty
- [x] Visual gate: light (EN + VI) — coder's run (`scratchpad/r199/shots/`, 10) and QA's (EN 6/6 ·
      VI 6/6, `scratchpad/r199/qa-shots/`); dark N/A (no dark theme — owner)
- [ ] BA (contract exit + after build) · code review · QA — no open P0/P1 — **CR re-check
      pending** (CR-1..CR-5 at `588104b`); BA pass 1 CHANGES → folded (`e475f5d`), BA pass 2 PASS
      (conditional on CR-1), QA PASS, code review CHANGES → CR-1 fixed (`588104b`)
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 17`. Light theme, fake
      data only. Walk script drafted by the BA (pass 2):
  - ⬜ W1 Setup — new workspace; fake `calls_demo.csv` (~60 rows: id, team, agent, amount, day;
    team = North, South, West, blank cells, one "Ops, East", one literal "~blank"); `codes.csv`
    (id, code; 1 001 distinct codes). Queries: "Calls" (all columns; declares `as_of` date, default
    today, used as day ≤ as_of); "Agents only" (select step dropping team); "Codes". Dashboard
    "Weekly": bar "Calls by team" (Calls); table "Calls (table)" (Calls, amount total); stat "All
    agents" (Agents only); stat "Untargeted total" (Calls); table "Codes". Add an "As of" parameter
    control.
  - ⬜ W2 Editor add — Parameters → Add → "Values (a shared filter)": label input, "filters
    column", column picker defaulting to a text column. Column team, label "Team"; Targets "Chosen
    widgets" pre-fills widgets whose result has team; add "All agents", remove "Untargeted total".
    Saved value list: "(blank)" first, then values; pick North → Save.
  - ⬜ W3 Saved state — bar "Team [North ▾]", no outline, no "Reset to saved", URL has no `f.`.
    Bar + table show North only, table footer total = North rows; both carry a "Team" tag.
    "Untargeted total" has no tag and counts every row.
  - ⬜ W4 Skip badge — "All agents" shows "Team skipped"; tooltip "This widget's result has no
    column team, so the filter does not change it."; renders normally.
  - ⬜ W5 Viewer pick — select lists "(blank)" first then alphabetical; pick South + (blank),
    deselect North → URL `?f.ctl_…=South,~blank`, control outlined, "Reset to saved" appears; table
    rows keep id order (CR-1).
  - ⬜ W6 URL round trip — F5: same tags, same numbers, still outlined.
  - ⬜ W7 Clear — select ✕ → placeholder "All values", URL `f.ctl_…=` (empty); every targeted
    widget unfiltered, North does NOT come back; reload keeps it.
  - ⬜ W8 Reset — "Reset to saved": `f.` key leaves the URL, North back, outline gone.
  - ⬜ W9 Special values — pick "Ops, East" → URL `Ops%2C%20East`, reload shows one tag "Ops,
    East". Open `…?f.<id>=%7Eblank` → one tag "~blank", only the literal-~blank row. Open
    `…?f.<id>=~blank` → one tag "(blank)", blank-team rows.
  - ⬜ W10 `p.*` and `f.*` together — with Team = South,(blank), change As of → only `p.as_of`
    changes; `f.` part byte-for-byte unchanged.
  - ⬜ W11 Copy link — new tab: same selection and numbers; link has `f.<id>=…` and
    `p.as_of=<absolute date>`.
  - ⬜ W12 Stale link — copy a link with `f.<id>=South`; remove the Team control, Save; open the
    old link → no error, widgets unfiltered, URL loses the `f.` key. Re-add Team (saved North).
  - ⬜ W13 Drawer AND — Team = South; funnel drawer of "Calls (table)" offers only South-row
    options; pick one agent → South AND that agent; drawer filter not in the URL.
  - ⬜ W14 Partial list — values control on `code` targeting "Codes" → "First 1 000 values" in
    the open list's footer and under the closed select.
  - ⬜ W15 Export — "Calls (table)" ⤓ Excel → Filters sheet header `column | values | scope |
source`: viewer South,(blank) → `team | South, (blank) | dashboard filter Team | viewer`;
    after Reset → `team | North | dashboard filter Team | dashboard`; with a drawer filter → extra
    `agent | … | widget filter |`; cleared (W7) → no team row, "— | no filter".
  - ⬜ W16 Editor guards — second values control's column picker does not offer team; a values
    control on a column no targeted widget has → select disabled "No targeted widget has column
    X." and every target badged skipped.
  - ⬜ W17 VI + old dashboards — VI: "(trống)", placeholder "Mọi giá trị", "Bỏ qua Team" +
    tooltip "Kết quả của widget này không có cột team, nên bộ lọc không thay đổi nó.", editor
    "Giá trị (bộ lọc dùng chung)" / "lọc cột", "1 000 giá trị đầu tiên". Then a dashboard saved
    before R199 looks and reads as before.
  - _Walk note (BA-F3 folded after the script was drafted): the header button now reads
    "Parameters & filters" (VI "Tham số & bộ lọc") where W2 says "Parameters"._

## Act

- **Rolling log** ([release-rc2-rc5.plan.md § Rolling log](../programs/release-rc2-rc5/release-rc2-rc5.plan.md)):
  CR-1 (fixed; the R171 reliance now holds only for the unfiltered single-source scan); the
  stepped / joined exports without an `ORDER BY` (P2 candidate); CR-3 (MSW `/rows` ignores
  `f.*`); QA-2 (`/aggregate` pre-step on a stepped query, API-only); BA-F5 (builder preview
  ignores an all-targeting values control); BA-F6 (reach badge from `resolvedColumns` on a
  widget whose join / steps no longer resolve); BA-F2 (VI "(blank)" outside the bar); the two
  owner questions.
- **Owner questions**: (1) should two `values` controls on one column with disjoint targets be
  allowed (built: refused, `duplicate_column`)? (2) should the export's Filters sheet list a
  _skipped_ shared filter as "skipped: no column" (built: unlisted — it filtered nothing; BA-C4)?
- **Promotion: yes — "an order the engine happens to keep is not an order".** Third incident on
  a third read path (R165 W-7 stepped, R172 joined, R199 CR-1 filtered single-source), and R171
  had named this exact reliance as a risk. Per the in-round rule (rc3 § Execution): new memory
  [`2026-10-19-explicit-order-not-engine-default`](../../memory/2026-10-19-explicit-order-not-engine-default.md)
  and `review-cr` item 13 (an `ORDER BY` on a stable key for every paged read / listing, or a
  written reason + guard; a test that `sorted()` its rows is a finding; probe at ≥ 130k rows);
  logged in [`promotions.md`](../promotions.md). R198's candidate ("a two-binding control needs
  its editor tested for the swap") did not recur: the values control binds one column; its
  editor's rebind (BA-F4) is the nearest cousin — a binding change must not keep identifiers the
  URL already holds — kept as a candidate, not promoted.
- **Prune check:** every role found something only it found — BA pass 1 the URL-writer defect
  before any code (BA-C2) and the stale-link rule (BA-C1); code review the P1 (CR-1) by probing
  at scale; QA the same symptom in a browser (graded P2) and the closed-list note (QA-3); BA pass
  2 the doc drift (BA-F1) and the rebind (BA-F4). Nothing to prune. The contract-exit pass ran
  before code this round (the R198 harness gap closed by the orchestrator relay).
- **agents.csv** row appended.

## Feeds into → Round_200

Item 4.4 — definition history (migration, `GET /{kind}/{id}/history`; rc4.md § 4.4), after 4.3
is in Review. Hand-over: a dashboard definition now holds three control kinds and a column change
mints a new control id — 4.4's history rows store whole definitions, so a restored old definition
brings its old control ids back (links made since then go stale and are dropped, BA-C1). The
`review-cr` checklist has item 13 (explicit order).
