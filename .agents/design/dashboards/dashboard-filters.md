# Dashboard filters — typed parameters, the view-time date range and shared filters

**Concept**: a dashboard re-read for another period or another slice without anyone rewriting a
query. Three pieces, one model:

- a **parameter**, a typed value a query declares and uses where a constant would go;
- a **shared filter**, a dashboard-level control that reaches the widgets the editor picks;
- the **view-time date range**, a pair of date parameters driven by one control.

This doc settles the model, where parameters may appear, how a value is chosen, what a viewer may
change, and how totals, export, workflow runs and metadata record what was applied. It is the
design input of items 3.7 (typed parameters), 3.8 (metadata triple anchor), 4.2 (view-time date
range) and 4.3 (shared filters) of the release program.
**Status**: Accepted — the owner accepted D1–D7 as drafted on 2026-10-18 (design gate of item
2.7, `Round_190`), with the view-time range as two date parameters and `backend.time_zone`
defaulting to `UTC`. Built by 3.7, 3.8 (rc.3) and 4.2, 4.3 (rc.4). 3.7 built (Round_194–195),
3.8 (Round_197), 4.2 (Round_198), 4.3 (Round_199) — see § As built.
**Domain folder**: `dashboards/` — code will land in
[`apps/builder/src/features/dashboard/`](../../../workspace/apps/builder/src/features/dashboard/)
(controls), the query engine
([`app/query_engine.py`](../../../workspace/apps/backend/app/query_engine.py),
[`app/ingest/filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)) and
[`app/routers/queries.py`](../../../workspace/apps/backend/app/routers/queries.py) (resolution).
**Sibling docs**: [dashboard-layout.md](dashboard-layout.md) (the page and today's per-widget
filter drawer), [widgets.md](widgets.md) (data paths, totals, export),
[queries.md](../data-management/queries/queries.md) (the saved Query, its filters and steps),
[metadata.md](../data-management/_shared/metadata.md) (the entries 3.8 anchors).

---

## Why

Today a query's filter values are constants saved in its definition. To read last week instead of
this week, someone edits the query — which changes its definition version, makes its metadata
"may be out of date" and leaves no record of which week a number was read for. The only runtime
filter is the per-widget drawer: categorical, one widget at a time, forgotten on reload, invisible
in the URL. Analysts re-reading the same report each period need:

1. one query that answers for any period, its definition unchanged;
2. one control that moves every relevant widget at once;
3. a link that reopens exactly the view they saw;
4. every number that leaves the app (total, export, run, note) carrying the values it was read
   with.

## Today (facts this design builds on)

- Literal operands live in filter atoms (`val`, `min`, `max`, `vals`) of source filters, the
  advanced DNF, filter steps and `case` WHEN predicates; constants also appear in `case`
  THEN / otherwise, `derive.right`, `top_n.n` and the free-text `q`
  ([`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml)).
- Dates are strict ISO literals; there is no relative-date operator and no "today" anywhere in
  the backend; datetimes are naive and there is no time-zone setting.
- `/aggregate`, `/totals` and `/export` accept runtime `filters: [{column, values}]` — name-based
  one-of, skipped when the result lacks the column; `GET /rows` accepts none.
- A dashboard definition is `{widgets}` only; the page reads no URL state.
- `POST /workflows/{id}/run` takes no input; its stamp records each source's definition hash and
  data versions (R187).
- A definition's version is the 12-hex hash of its JSON with `null` members dropped (decision 14).

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                          | Layer                                                | Reusability | Purity    | Allowed peer deps                  |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------- | --------- | ---------------------------------- |
| `DashboardControlBar` (parameter controls + shared filters, above the grid)                      | `apps/builder/src/features/dashboard/`               | feature     | feature   | react, antd, react-i18next         |
| `ParamControl` (date / number / string input bound to one parameter, or a date-range pair)       | `apps/builder/src/features/dashboard/`               | feature     | plain-UI  | react, antd                        |
| `SharedFilterControl` (values multi-select bound to one column)                                  | `apps/builder/src/features/dashboard/`               | feature     | plain-UI  | react, antd                        |
| `FilterReachBadge` (per card: which controls reached this widget, which were skipped and why)    | `apps/builder/src/features/dashboard/`               | feature     | plain-UI  | react, antd                        |
| `ControlScopeEditor` (edit mode: label, binding, target widgets, saved value)                    | `apps/builder/src/features/dashboard/`               | feature     | feature   | react, antd                        |
| `QueryParamsPanel` + "Use parameter" switch on literal value fields (query page)                 | `apps/builder/src/features/data-management/queries/` | feature     | feature   | react, antd, react-i18next         |
| `useDashboardViewState` (URL `p.*` / `f.*` ⇄ control values; saved values as fallback)           | `apps/builder/src/features/dashboard/`               | feature     | glue      | react, react-router-dom            |
| `controlsForWidget` (which controls reach a widget, given its query's params and result columns) | `apps/builder/src/features/dashboard/`               | feature     | pure      | none                               |
| `QueryParam`, `ParamRef`, `ParamDefault`, `ResolvedParam`, `DashboardControl` (contract types)   | `packages/contracts/_shared/`                        | data type   | data type | none                               |
| `resolve_params` (precedence, type check, `today` in the configured zone)                        | `apps/backend/app/`                                  | backend     | pure      | (stdlib `zoneinfo`)                |
| `validate_param_refs` (save-time: declared, typed, placed only where allowed)                    | `apps/backend/app/ingest/filters.py`                 | backend     | pure      | none                               |
| `GET /queries/{id}/values` (distinct values of one result column, for a shared filter's options) | `apps/backend/app/routers/queries.py`                | backend     | feature   | (FastAPI — backend native; DuckDB) |

All surfaces are planned (nothing is built in this round). **Boundary check**: nothing goes to `@mdd/ui` — the controls are dashboard-specific until a second
surface (e.g. the query page) needs a parameter input; promote then. Resolution lives in the
backend only: the builder never substitutes a value into a definition, it sends values and reads
back what was resolved.

---

## Token map

All values are AntD tokens derived from the seeds in
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts); values are informational.

| Surface                                             | AntD token                                                               | Value (informational) |
| --------------------------------------------------- | ------------------------------------------------------------------------ | --------------------- |
| Control bar background / border                     | `colorBgContainer` / `colorBorderSecondary`                              | derived               |
| Control bar gap between controls                    | `marginSM`                                                               | `12`                  |
| Control label                                       | `colorTextSecondary`, `fontSizeSM`                                       | derived               |
| Control showing a viewer value (differs from saved) | `colorPrimary` outline (AntD `Select` / `DatePicker` default focus look) | derived               |
| Reach badge — reached                               | AntD `Tag` default (`colorFillSecondary`)                                | derived               |
| Reach badge — skipped                               | AntD `Tag` `warning` (`colorWarningBg` / `colorWarningText`)             | derived               |
| "Data only through …" note (incomplete window)      | AntD `Typography.Text type="secondary"` + `colorWarning` icon            | derived               |

No new token. Parity is enforced by
[`design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs).

---

## Layout — ASCII intent

```text
┌ Dashboard: Weekly calls ───────────────────────────────── [Edit] [Copy link] ┐
│ Period [2026-10-05 → 2026-10-11 ▾]   Team [North, South ▾]   As of [2026-10-11] │
│                                                    (viewer values · Reset to saved) │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌ Calls by day ──── Period · Team ┐  ┌ Calls by agent ── Period · Team ┐       │
│ │ ▇▇▅▇▆                           │  │ ...                             │       │
│ └─────────────────────────────────┘  └─────────────────────────────────┘       │
│ ┌ Backlog ─ Period · [Team skipped: no column] ┐ ┌ Note (no badge) ┐          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Decisions

### D1 — The parameter model (decision 7)

- A query declares its parameters in its definition:
  `QueryDefinition.params: [{name, type, label?, default?}]`, at most 8.
  - `name`: `^[a-z][a-z0-9_]{0,31}$`, unique in the query.
  - `type`: `date | number | string`. Scalar only.
  - `default` (optional): a literal of the type; for `date` also the relative form
    `{"kind": "today", "offsetDays": n}` (`n` in −366…366; "yesterday" is `-1`).
- A query uses a parameter by writing `{"param": "<name>"}` **exactly where a literal operand
  would be** (D2). No new step kind, no expression language.
- The declaration (including the default) is part of the definition and of its hash. **Values
  are never written into the definition**: two reads with different values share one
  `definitionVersion`.
- **Authoring on the query page** (3.7): a "Parameters" panel declares them (name, type, label,
  default — the relative "today ± n days" offered for dates), and every literal value field that
  D2 allows gets a "Use parameter" switch listing the declared parameters of a fitting type; the
  chip then reads `as_of (parameter)` instead of a value. The query's preview asks for a value
  for each parameter without a default. The "View as JSON" panel shows the `{"param"}` form.
- **"Today" is resolved by the server** in a configured zone: new setting
  `backend.time_zone` (IANA name, default `UTC`; `MDD_BACKEND__TIME_ZONE`). The resolved value is
  a plain date; data stays naive (no zone conversion of stored values — upload's rule holds).
- **Save-time checks** (422 naming the field, as every definition check today; the read path
  turns a definition that became invalid into its usual `409`): a reference to an undeclared name; a parameter whose type does not fit the atom's column family (date ⇄
  date/datetime, number ⇄ integer/float, string ⇄ string); a reference on an operator that takes
  no operand (`is_null`, `is_empty`, `is_true`…); a reference where D2 does not allow one. A
  declared but unused parameter is allowed (a dashboard may bind it before the query uses it).

### D2 — Where a parameter may appear

| Place                                                          | Allowed | Note                                                                                        |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Filter atom `val`, `min`, `max` (source filters, advanced DNF) | yes     | `between` may take one parameter and one literal                                            |
| One item of `vals` (`in` / `not_in`)                           | yes     | each item is scalar; a parameter that fills the whole list is OUT (named trigger below)     |
| Filter-step predicate operands                                 | yes     | same as atoms                                                                               |
| `case` WHEN predicates                                         | yes     | they are filter predicates                                                                  |
| `refCol` (column-vs-column)                                    | no      | a parameter is never a column; `refCol` and a `{"param"}` operand are exclusive on one atom |
| The anchor pattern (`group_column` cut-off → `date_diff`)      | n/a     | stays data-driven; to anchor on a chosen date instead, filter `date lte {"param":"as_of"}`  |
| `case` THEN / `otherwise`, `derive.right`, `top_n.n`, `q`      | no      | output labels and arithmetic constants — OUT with named triggers                            |
| Workflow steps                                                 | no      | a workflow declares no parameters (D6)                                                      |

### D3 — Choosing a value (precedence)

For each declared parameter of the query being read, the first that applies wins:

1. **viewer value** — the request's `params` (from the dashboard URL `p.<name>`, or an API
   caller);
2. **dashboard saved value** — the value saved on a dashboard control bound to that name;
3. **query default** — the declaration's `default` (relative defaults resolved now, in the
   configured zone);
4. else **`422 param_unbound`** naming the parameter (nothing is guessed).

A supplied value of the wrong type → **`422 param_invalid`** naming it. The program text listed
"parameter default" and "value saved in the query" as two levels; in this model they are the same
field (the default is saved in the query), so there are three levels plus the refusal.

**Wire**: `GET /queries/{id}/rows` takes `p.<name>=<value>` query parameters (the same spelling as
the dashboard URL); `POST /aggregate`, `/totals`, `/export` take `params: {name: value}` beside
`filters`. Every read that resolved parameters answers with
`resolvedParams: {name: {value, source: viewer | dashboard | default}}` — the record D7 and 3.8
use. A query without parameters reads exactly as in rc.2 (no `resolvedParams` key).

### D4 — Shared filters and controls on a dashboard

`DashboardDefinition.controls: [DashboardControl]` (at most 12), saved with the dashboard:

| Field                              | Meaning                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                               | `ctl_` + 8 hex, client-generated (like widget ids)                                                                                        |
| `kind`                             | `param` (binds one parameter name) · `date_range` (binds two date parameters, `from` and `to`) · `values` (a shared filter on one column) |
| `label`                            | shown in the bar                                                                                                                          |
| `param` / `from` + `to` / `column` | the binding (by name)                                                                                                                     |
| `targets`                          | `"all"` or a list of widget ids — the editor picks which widgets the control reaches                                                      |
| `saved`                            | optional saved value (D3 level 2); for dates also the relative form                                                                       |

- A `values` control is the drawer's filter made dashboard-wide: name-based one-of on a column,
  `(blank)` = NULL or empty, sent in the existing `filters` list. Its options come from the new
  `GET /queries/{id}/values?column=` over the first targeted widget's query (distinct, capped at
  1 000, flagged partial when capped) — not from a capped row fetch. _As built (4.3): the first
  targeted widget **whose result has the column**; see § As built (4.3)._
- The **view-time date range** (item 4.2) is a `date_range` control: two date parameters the
  targeted queries use, typically in `between` or `gte` / `lte`. Presets ("last 7 days", "last
  month") are saved as relative values and resolved by the server; the URL always holds absolute
  dates.
- **Viewer changes live in the URL only**: `?p.<name>=2026-10-11` for parameters,
  `?f.<controlId>=North,South` for values (`~blank` for `(blank)`, values URL-encoded). Opening
  the link reproduces the view. A viewer never saves; "Reset to saved" drops the URL values.
  **Saving a value requires edit mode** (writes `saved`, a dashboard PUT).
- The per-widget drawer stays: its filters AND with the shared ones; it remains per-visit state.
- A control reaches a widget only when the widget is in `targets` **and** (for `param` /
  `date_range`) the widget's query declares the parameter, or (for `values`) the widget's result
  has the column. A note widget is never reached.

### D5 — A control that cannot apply: skip and say so, never an error

- Missing column (values control) or undeclared parameter (param control) on a targeted widget →
  the control is skipped for that widget; the card's `FilterReachBadge` shows it as skipped with
  the reason ("no column Team", "query has no parameter as_of"). The widget renders normally.
- The backend's existing rule matches: a filter on a column the result lacks is skipped; an extra
  `params` entry the query does not declare is ignored (and not echoed in `resolvedParams`).
- The badge lists every control that reached the widget, so a viewer can tell a filtered number
  from an unfiltered one without opening anything.

### D6 — Workflow runs

- A workflow declares no parameters, and its steps may not reference one (422 at save).
- A workflow source query that declares parameters is run with **defaults only** (D3 level 3);
  a source query whose parameter has no default makes the workflow refuse to run
  (`422 param_unbound`, naming the source and the parameter).
- The run stamp records what was used: `sources[].params: {name: value}` beside the source's
  definition hash and data versions. Re-running on another day with a `today` default is a new
  run with a different recorded value — not a stale one.
- Passing values to a run is OUT (named trigger: scheduled refresh, item 4.1, needs a run for a
  given `as_of`).

### D7 — What leaves the app carries what was applied

- **Totals** (2.3) answer with `resolvedParams` and are computed under the same params and
  filters as the widget.
- **Export** (2.4): the Filters sheet gains a `Parameters` block (`name | value | source`) and
  splits filters into `dashboard filter <label>` and `widget filter` rows; CSV keeps its shape
  (no sheet) and a response header `X-MDD-Params` carries the resolved values as JSON (exposed to
  the builder through CORS).
  The exported data version is item 3.2c.
- **Metadata** (3.8): an entry's anchor gains the params it was written for; an entry whose
  params differ from the current view renders collapsed ("written for as_of 2026-10-04").
- **Incomplete window** (input to item 4.5): when a resolved date parameter or range end is later
  than the dataset's coverage `max` (R178) on the column it filters, the widget shows "Data only
  through <max>". It is a note, not a block; the cohort-specific rule stays in 4.5.

### As built (4.3 — Round_199)

- **The `values` control** is the third `kind` of the R195 union:
  `{id, kind: values, label, column, targets, saved?}` — `column` is a result column by effective
  name; `saved` is 1–200 unique values, `null` = `(blank)`. One `values` control per column
  (`duplicate_column`, like one control per parameter); the column is **not** checked against the
  targeted queries at save (D5 skips a missing column at read). A column change in the editor
  drops the saved selection and gives the control a **new id**, so an old link's key goes stale.
- **One engine.** A selection travels in the existing runtime `filters` list as a
  `RuntimeFilter` item with `control: <id>` (no second engine; the drawer's name-based one-of SQL
  applies both). The **server applies the saved selection** (D3 level 2, as R195 does for
  parameters) to every read that names the dashboard + widget and carries no item for that
  control; a viewer item overrides it. `GET /rows` takes the viewer selection as
  `f.<controlId>=v1,v2` (the dashboard URL spelling) and applies the shared filters **before**
  paging and the cap. The widget's own drawer filters AND with them (on `/rows` they stay
  client-side, R103).
- **Reach (D5).** A targeted widget whose result has the column is reached; one that lacks it is
  skipped and badged "no column <column>" — the server skips the filter there too; a note is
  never reached. An `f.` key / `control` item naming **no** `values` control of the dashboard
  (removed since the link was copied) is **ignored**, like an unused `p.<name>`, and the builder
  drops it from the URL on load (never re-pinned). 422 only for a `control` without a dashboard
  (`control_without_dashboard`) or on another column (`control_column`).
- **The URL spelling.** Split on `,` **before** percent-decoding; each token percent-decoded only
  (`+` is a literal plus; a malformed escape stays as typed — both sides); the raw token `~blank`
  is `(blank)` while `%7Eblank` is the literal "~blank"; `,` in a value is `%2C`; an empty token
  is ignored; a repeated key → the last wins; `f.<id>=` (empty) = cleared — no filter and the
  saved selection **not** applied; an absent key = the saved selection applies. The page writes
  every URL change (a `p.*` change, Reset, Copy link, an `f.*` change) through **one raw writer**
  that keeps the `f.*` bytes (never re-serialised by `URLSearchParams`). Copy link pins every
  values control (the viewer's selection as it is, else the saved one, else `f.<id>=`); Reset to
  saved drops every `p.*` and `f.*`.
- **Options.** `GET /queries/{id}/values?column=` reads `SELECT DISTINCT` over the **final**
  (post-step) relation: blank first, then ascending in the column's own order (numbers
  numerically, dates chronologically, text lexically), the first 1 000 with `partial` when more
  exist ("First 1 000 values" under the select and in the open list's footer). Parameters resolve
  as on `/rows`; no runtime filter applies (no cascading, not its own saved). The bar reads them
  over the **first targeted widget whose result has the column**, with that widget's parameter
  context; none → the select is disabled, "No targeted widget has column X".
- **Export (D7).** The Filters sheet's filter rows are `column | values | scope | source`:
  `widget filter` (source empty) for the drawer's, `dashboard filter <label>` with `viewer` or
  `dashboard` for a shared one. A **cleared** shared filter and a **skipped** one (the result
  lacks the column) are not listed — neither filtered anything (owner question: list the
  skipped one?).
- **Order.** A **filtered** single-source read pages `ORDER BY file_row_number` (and the
  single-source export lists in that order): an `IN` list or an `OR … IS NULL` term made the scan
  lose file order (R199 CR-1, which also covered the definition `in` atom). The unfiltered scan
  keeps the R172 behaviour. A dataset with its own `file_row_number` column (DuckDB then refuses
  its positional option) is numbered over the bare scan under a reserved name instead (CR-6).
- Not built (rolling log): the widget-builder preview does not carry a values control targeting
  all (BA-F5); the reach badge reads `resolvedColumns`, so a widget whose join/steps no longer
  resolve can be badged from its pre-step columns (BA-F6); `/aggregate` filters a stepped query
  pre-step (API-only — the builder never server-aggregates one, R127); the MSW `/rows` ignores
  `f.*`; VI "(blank)" on the chart axis / drawer / XLSX (only the bar's tag says "(trống)");
  stepped and joined exports list without an `ORDER BY`.

### As built (4.2 — Round_198)

- **The `date_range` control** is a `kind`-keyed sibling of the R195 `param` control:
  `{id, kind: date_range, label, from, to, targets, saved?}` — `from` / `to` name two date
  parameters (distinct; no other control binds either). `saved` is a **preset**
  (`this_week | last_week | last_7_days | this_month | last_month`) or a fixed pair
  (`{from, to}`, each absolute or `today ± n`). The **server** resolves it in `backend.time_zone`
  on every read (weeks start Monday; `last_7_days` = today − 6 … today; calendar months) and
  applies the two values as the dashboard level to the targeted widgets whose queries use them.
- **The URL holds absolute dates** (`?p.<from>=…&p.<to>=…`). In the bar a preset the viewer picks
  is computed in the browser's zone and written as two dates at once; a typed bound writes one.
  Copy link pins the server-resolved pair. Reset to saved drops both.
- **Reach** (D5): a targeted widget whose query uses `from` or `to` is reached; one whose query
  uses neither is skipped and badged with both names. Save checks (422 naming the field):
  `from` = `to`, a name bound twice, a targeted query using the name as a non-date, a saved pair
  that runs backwards, a malformed preset.
- **Incomplete window** (D7): `resolvedParams[name].dataThrough` = the filtered dataset column's
  coverage `max` when a date value is an **upper** bound (`lte`, `lt`, `before`, `between.max`)
  past it; the widget shows "Data only through <max>" under its badge. A joined query's columns
  carry no coverage, so no note there. A lower bound never notes.
- **Metadata (3.8)** anchors a dashboard or widget note to the two resolved dates (not the preset).
- Not built (rolling log): an endpoint for "today" (a viewer's preset is browser-side); coverage on
  joined effective columns. (The `values` control was built by 4.3 — § As built (4.3).)

### As built (3.8 — Round_197)

- A metadata entry anchors to the parameter values it was written under; a dashboard's are its
  param controls as the bar shows them (viewer → saved → default), a widget's as it reads. A read
  under other values marks the entry `other_period` and the panel collapses it to "Written for As
  of 2026-10-11 · viewing As of 2026-10-17". Full rule: [metadata.md § The triple
  anchor](../data-management/_shared/metadata.md).

### As built (3.7 — Round_194 engine, Round_195 builder)

- **D3 level 2 is read by the server.** A widget read names its dashboard + widget
  (`dashboard`/`widget` on `GET /rows`, `dashboard: {id, widgetId}` on the POST reads); the server
  reads that dashboard's saved control values that reach the widget. A client never asserts a
  "dashboard" value.
- **Only USED parameters** (referenced by an operand) are resolved, required and echoed; a
  declared but unused parameter never claims to have been applied. `param_unbound` lists every
  missing one (`missing[]`); `param_invalid` names the expected type and the level, and
  `reason: range_reversed` for a `between` whose bound came from a parameter and ends before it
  starts. A number on an integer column must be whole.
- **A date parameter on a datetime column is a calendar day**: lower bounds start at 00:00, upper
  bounds end at 23:59:59.999999; `equals` / `ne` / `in` / `not_in` there are refused at save.
- **A viewer value reaches only the widgets its control targets** (the builder sends each widget
  only those values). Copy link pins every control as an absolute value (the server-resolved one
  where the viewer set none).
- Not built yet (rolling log): a parameter in the advanced (DNF) text, on `between` / one list item
  in the steps editor; the `date_range` and `values` controls (4.2, 4.3).

---

## Behaviour

| State                                | What the viewer sees                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Dashboard without controls           | no bar; everything as in rc.2                                                                  |
| Saved values only                    | controls show saved values; URL clean                                                          |
| Viewer changed a value               | control outlined; URL updated; "Reset to saved" visible                                        |
| Link opened with `p.*` / `f.*`       | controls show the URL values; widgets read them                                                |
| URL value of the wrong type          | the control shows it as invalid; widgets bound to it show the `param_invalid` message          |
| Parameter with no value at any level | bound widgets show "Pick a value for <label>" (from `param_unbound`), others render            |
| Control skipped on a widget          | badge in warning style with the reason                                                         |
| Values list capped                   | info line "first 1 000 values"                                                                 |
| Resolved date beyond coverage        | secondary note "Data only through <max>"                                                       |
| Edit mode                            | each control has an edit affordance (label, binding, targets, saved value) and a remove action |

---

## Acceptance criteria (Design gate exit)

**User journeys**

- _J1 — Re-read for another week:_ an analyst opens a dashboard whose queries declare `as_of`,
  changes As of to last Sunday, sees every bound widget move, copies the link; a colleague opens
  it and sees the same numbers. No query was edited; its definition version is unchanged.
- _J2 — One filter, several widgets:_ an editor adds a Team filter reaching four of six widgets,
  saves "North" as the default; viewers see those four filtered and badged, the other two
  untouched, and a widget whose query has no Team column badged as skipped.
- _J3 — Numbers that leave the app:_ the analyst exports a table and adds its total to a report;
  the file and the total say which period and which filters they were read under.

**Testable criteria** (owner of each in brackets: the round that builds it)

1. _(3.7, pytest)_ precedence: viewer > dashboard saved > query default > `422 param_unbound`
   naming it — four cases.
2. _(3.7, pytest)_ a value of the wrong type → `422 param_invalid`; a reference to an undeclared
   name, a type that does not fit the column, a reference on `is_null` or in a D2 "no" place →
   422 at save.
3. _(3.7, pytest)_ the same query read with two `as_of` values gives different numbers and the
   same `definitionVersion`; a query without params answers byte-identically to rc.2.
4. _(3.7, pytest)_ `{"kind":"today","offsetDays":-1}` resolves to yesterday in
   `backend.time_zone` (tested at a fixed clock in two zones across midnight).
5. _(3.7, FE)_ URL round trip: `p.as_of` set → reload → same value; "Reset to saved" clears it;
   saving a value is only offered in edit mode.
6. _(4.3, FE + BE)_ a `values` control reaches exactly its targets; a target lacking the column is
   skipped with a badge and renders; `(blank)` survives the URL as `~blank`.
7. _(3.7 / 4.3, BE)_ totals and export echo `resolvedParams`; the XLSX Filters sheet lists
   parameters with their source and separates dashboard from widget filters.
8. _(3.7, pytest)_ a workflow whose source declares a defaulted parameter records the resolved
   value in `run.sources[].params`; one without a default refuses to run, naming both.
9. _(4.2, FE)_ a `date_range` preset saved as "last 7 days" resolves server-side; the URL shows
   absolute dates.
10. _(3.8)_ a metadata entry written under other params renders collapsed with the params it was
    written for.

---

## Scope boundary

### IN scope

- The parameter model, its placement rules and resolution; dashboard controls (param,
  date range, shared values filter), their scope, URL state and saved values; skip-and-badge;
  how totals, export, workflow runs and metadata record the applied values; the time-zone setting.

### OUT of scope (deferred with named triggers)

- **List parameters** (one parameter filling a whole `in` list) — pull when a report needs a
  viewer-chosen set on a column that is not a dashboard `values` filter.
- **Parameters in outputs** (`case` THEN, `derive` constants, `top_n.n`, `q`) — pull with a
  concrete report that needs a viewer-chosen label, constant or N.
- **Parameters on workflow runs** — pull with item 4.1 (scheduled refresh for a given `as_of`).
- **Cascading controls** (one control's options depend on another's value) — pull when a values
  list is too long to be usable without it.
- **Per-viewer saved views** (named bookmarks beyond the URL) — needs users; out with multi-user
  scoping.
- **Time-zone-aware data** — stored datetimes stay naive; only "today" uses the zone.

### This concept explicitly does NOT cover

- The widget kinds, totals and export mechanics — [widgets.md](widgets.md).
- The page, grid and per-widget drawer — [dashboard-layout.md](dashboard-layout.md).
- The query definition beyond its parameter fields — [queries.md](../data-management/queries/queries.md).
- Scheduled refresh (4.1) and definition history (4.4).

---

## Reference materials (read-only)

- Contracts: [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml)
  (filter atoms, steps, `AggregateFilter`),
  [`_shared/dashboard.yaml`](../../../workspace/packages/contracts/_shared/dashboard.yaml),
  [`_shared/workflow.yaml`](../../../workspace/packages/contracts/_shared/workflow.yaml) (run
  stamp).
- Backend: [`app/ingest/filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)
  (`OPS_BY_DTYPE`, `_build_aq_atom`, `_predicate_sql`),
  [`app/ingest/rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
  (`_name_in_sql`, `_apply_step`), [`app/metadata.py`](../../../workspace/apps/backend/app/metadata.py)
  (`definition_version`), [`app/workflow_runs.py`](../../../workspace/apps/backend/app/workflow_runs.py)
  (`stamp_sources`).
- Builder: `features/dashboard/DashboardDetailPage.tsx` (per-widget filter state),
  `WidgetFilterDrawer.tsx`, `WidgetView.tsx` (`toWireFilters`), `exportWidget.ts`.
- Program: [release-rc2-rc5 § rc.3 item 2.7](../../plan/programs/release-rc2-rc5/rc3.md);
  market check in the program's rolling log (parameter precedence and URL-held viewer values are
  an established pattern).
