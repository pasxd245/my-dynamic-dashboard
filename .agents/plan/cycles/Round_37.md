# Round 37: Design — Per-column filters on dataset detail page

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_36](Round_36.md)** — R33→R36 closed the
dataset-detail DCBF chain. The page now shows a paged row
inspector with a Cmd-F-style substring search (`?q=`). End-of-
round Q&A asked which of three directions R37 should pick:
**query feature**, **dashboard feature**, or **POC polish**.
User picked the query direction, then refined: **filter feature
first, advanced query later**. Filters are the discoverable,
per-column entry point; advanced query (`stage:won AND
amount>10000`) becomes the natural follow-up once filters prove
the predicate demand.

R37 is **design-only** — one new design doc + one preview HTML.
No code under `apps/`, no contracts, no BE, no FE. Locks the
filter UI + URL state + predicate vocabulary the next three
rounds (C/B/F) implement against. Follows the R33 D-round
pattern that produced `dataset-detail.md` before R34→R36 shipped
code.

_Track: 1 (product — per-column filters are the natural
extension of R36's `?q=` substring; closes the
[dataset-detail.md § Read/write boundary](../../design/data-management/dataset-detail.md#readwrite-boundary)
deferral row "Per-column search / typed-filter language"
without committing to a full query language). Pulled by: R36
Feeds-into Q&A; the dataset-detail design's own deferred-list
naming filters as the next pull. Per
[Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Filter scope = the dataset detail page only.** No global
   "filter the catalog" surface this round; that would be a
   datasets-list affordance which is out of scope. R36's `?q=`
   stays unchanged; filters compose AND with it.
2. **Per-column filter widgets typed by `Dataset.columns[].dtype`.**
   The dtype already drives cell rendering (R36 `formatCell`);
   it now also drives which operator set is offered:
   - `string` → contains (default), equals, starts-with,
     ends-with, is empty, is not empty.
   - `integer` / `float` → equals, ≠, >, <, ≥, ≤, between, is
     null, is not null.
   - `date` / `datetime` → equals, ≠, before, after, between, is
     null, is not null.
   - `boolean` → is true, is false, is null, is not null.
3. **AND-only across columns.** No OR, no parenthesized groups.
   Each column contributes at most one filter; multiple columns
   compose with implicit AND. OR/grouping needs a real query
   language and is explicitly deferred to the **advanced query**
   follow-up.
4. **Filter UI placement = column-header dropdown trigger** (a
   small `▾` icon next to the dtype badge), opening an AntD
   `<Popover>` with the typed widget. **Plus** an "Active
   filters" chip row above the table (between the search bar
   and the table) showing each active predicate as a removable
   chip, with a `Clear all` link on the right. The chip row
   mirrors how Datasets-list's workspace filter renders.
5. **URL state = explicit per-column params, not opaque JSON.**
   Each active filter writes one or two params keyed by column
   index: `?f0_op=contains&f0_val=Alice`,
   `?f3_op=between&f3_min=10000&f3_max=50000`. Reasoning:
   debuggable by eye, share-by-URL works, no base64 needed,
   and the param namespace (`f<N>_*`) doesn't collide with
   existing `page`/`page_size`/`q`. Cap of ~12 columns ≈ 24-36
   params is comfortable.
6. **Filter clears reset `?page` to 1** (same trigger as `?q=`
   change and page-size change). Page is meaningless under a
   changed predicate set.
7. **Match counter shows filtered total alongside `q` total.**
   Current copy "Matched X / Y" stays, but `X` is now the
   filtered + searched count, and `Y` remains the dataset's
   full `rowCount`. Naming `q + filters` as a combined predicate
   in the design doc; copy doesn't need to call out filters
   separately (the chip row already does).
8. **No saved filters, no filter presets.** Saving named
   filter sets is a Saved-Queries surface, deferred to the
   advanced-query round. R37's filters are URL-only, ephemeral
   across navigation.
9. **Backend predicate vocabulary mirrors the FE operator set
   1:1**. The C/B rounds will land a discriminated-union
   payload (per-op, per-dtype) in the rows-GET. The design doc
   spells out the target contract shape; R38 mechanizes as YAML.

## What is IN scope

### 1. New design doc — `dataset-filters.md`

Author
[`.agents/design/data-management/dataset-filters.md`](../../design/data-management/dataset-filters.md)
following the R10/R14/R33 canonical template:

- **Status header** — concept name, R37 origin, draft status,
  implementation chain pointer (R38 contract, R39 BE, R40 FE).
- **Mandatory Surface declaration table** at the top — every
  surface R38→R40 will land, with Layer / Reusability / Purity
  / Allowed peer deps. Expected rows:
  - `FilterTrigger` column-header button (feature; plain-UI).
  - `FilterPopover` per-dtype widget container (feature; glue).
  - `StringFilterEditor` / `NumericFilterEditor` /
    `DateFilterEditor` / `BooleanFilterEditor` (feature; plain-UI).
  - `ActiveFilterChips` row component (feature; plain-UI).
  - `useFiltersState` hook — URL ↔ in-memory predicate set
    translation (feature; glue).
  - `datasetsApi.getRows(..., filters?)` extension (builder; glue).
  - `GET /datasets/{id}/rows` extension — filters query params
    (backend; feature).
  - `FilterPredicate` discriminated-union type (feature; data type).
- **Reference materials** — sibling docs:
  [dataset-detail.md](../../design/data-management/dataset-detail.md)
  (the page this extends),
  [datasets.md](../../design/data-management/datasets.md) (where
  `dtype` is defined),
  [upload.md](../../design/data-management/upload.md) (the dtype
  inference source).
- **ASCII layout** — populated state with one active string
  filter + one active numeric range filter (showing both the
  column-header `▾` trigger and the chips row); the open-popover
  state for a numeric column (showing the `between` widget with
  two inputs + op selector); the open-popover state for a date
  column; the no-match state when filters return zero rows.
- **Filter-popover anatomy** — operator selector (AntD
  `<Select>`) at the top; value editor(s) below, varying by
  operator (one input for `equals`, two for `between`, none for
  `is null` / `is not null`); `Apply` + `Cancel` row at the
  bottom. Apply writes URL + closes popover; Cancel discards
  draft.
- **Token map** — chip background / border / remove-X color,
  popover chrome (reuses AntD), operator-selector dropdown,
  numeric input alignment. Cite all against
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts).
- **Behavior** — Mermaid `stateDiagram-v2` for popover open →
  edit → apply / cancel; URL serialization rules; AND-compose
  with `?q=`; `?page` reset on filter change.
- **Data contract (target shape for R38)** — extend the rows-
  GET with an optional `filters` query block. Two
  representational options sketched (encoded params vs JSON
  body via a `POST /datasets/{id}/rows:search`); design names
  encoded params as primary, JSON body as a fallback if param
  count balloons. R38 mechanizes.
- **Predicate vocabulary table** — for each dtype, the exact
  operator names, expected value shape (string / number / null),
  and SQL/DuckDB equivalent. This is the cross-stack spec for
  R38→R40.
- **Read/write boundary** — what R38→R40 implement vs what
  stays deferred. Explicit deferrals: OR/grouping, parenthesized
  expressions, saved filter sets, cross-column derived predicates
  (`col_a > col_b`), regex / glob, null-vs-empty-string nuance
  beyond the listed operators, multi-value `in (...)`.
- **Scope boundary** — what this concept covers, what is
  deferred, what is explicitly out.

### 2. New preview — `dataset-filters.preview.html`

Self-contained Tailwind-CDN HTML preview following
[.agents/design/README.md § previews](../../design/README.md).

- Master-layout chrome (`../_css/preview-shell.css`) so the
  sidebar + topbar match the other previews; active sub-item =
  `Dataset detail` (this is an extension of that page, not its
  own sub-menu).
- Breadcrumb: `Home ▸ Data Management ▸ Datasets ▸
q1_pipeline_Deals` — same as the dataset-detail preview.
- Metadata strip + search bar identical to the R33 preview.
- **New: Active filters chip row** above the table — two chips
  populated (`stage = won`, `amount between 10,000 and
50,000`), each with a removable `×`; a `Clear all` text link
  on the right.
- Data table with column-header `▾` filter trigger next to
  each dtype badge; one trigger highlighted (`stage` and
  `amount` columns) to show the "active filter on this column"
  state.
- **Click-through script** that:
  - Toggles between filters-applied / filters-empty / popover-
    open-on-string-col / popover-open-on-numeric-col /
    popover-open-on-date-col / no-match states via top-of-page
    state buttons (mirrors how `dataset-detail.preview.html`
    toggles its state set).
  - Renders the popover as a positioned `<div>` (Tailwind absolute
    positioning, no real AntD; the preview shows shape, not
    library bindings).
  - Includes the operator `<select>` and the value `<input>`s
    so the user can see all three editor flavors.
- Honest banner near the top: "Brainstorming preview — not
  production. R37 D-round target."

### 3. Stamp sibling docs

- Update
  [`dataset-detail.md`](../../design/data-management/dataset-detail.md)
  Read/write boundary — flip "Per-column search / typed-filter
  language" deferral row to "Per-column filters — R37 design,
  R38→R40 impl chain" with a sibling link to `dataset-filters.md`.
  Add `dataset-filters.md` to the sibling-docs list at the top.
- Update [`../../design/index.html`](../../design/_archive/index.html) —
  add `dataset-filters.preview.html` as a sub-item in the
  Data-Management sidebar group + a card on the right with the
  R37 badge.

### 4. Round file + audit

- This Round_37.md.
- `npx markdownlint-cli2` repo-wide returns 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No code under `apps/`** — no router, no page, no hooks, no
  api client, no BE. R38 lands contracts; R39 lands BE; R40
  lands FE.
- **No OpenAPI contract files.** Contract shape lives prose-
  only in `dataset-filters.md` § Data contract; R38 mechanizes
  as YAML.
- **No DCBF mechanization.** R37 picks the shape; R38→R40 build
  it. Mixing contract YAML or BE handlers into a D-round breaks
  the one-feature-per-round rule.
- **No advanced query language.** `stage:won AND amount>10000`
  syntax is explicitly the _next_ feature after filters. R37
  designs _only_ the per-column-widget surface. The advanced
  query gets its own DCBF chain when filters prove the demand.
- **No OR / grouping / parenthesized predicates.** AND-only
  across columns; deferred to advanced query.
- **No saved filter sets / presets / named queries.** Belongs
  to the Saved-Queries surface, which lands with advanced
  query.
- **No filter export / share-by-link beyond the URL itself.**
  The URL _is_ the share surface; no separate copy-link button
  this round (could be a 1-line addition in R40 if pulled).
- **No filtering on the datasets list page** (cross-dataset
  catalog filtering). Out of scope; the workspace filter on the
  list page is a different concept.
- **No filter on dataset metadata** (workspace, format, size).
  Filters target row data, not the dataset noun's metadata
  columns.
- **No client-only filtering.** All predicates evaluate
  server-side so `total` reflects the matched count and
  pagination stays correct. Client-only filtering is a perf
  optimization for tiny datasets that we don't need to
  pre-commit to.

## Plan

- [x] Confirm scope at planning review (decisions 1-9 above;
      user redirects any via end-of-round Q&A).
- [x] Author `.agents/design/data-management/dataset-filters.md`
      with the full canonical template (status header, surface
      table, ASCII layout for 5 states, popover anatomy, token
      map, behavior with Mermaid state machine, data contract
      prose YAML, predicate vocabulary table, read/write
      boundary, scope).
- [x] Author
      `.agents/design/data-management/dataset-filters.preview.html`
      with the chip row + per-dtype popover variants + state
      toggle (filters-applied / filters-empty / 4 popover-open
      flavors / no-match).
- [x] Stamp `dataset-detail.md` — flip per-column-filter
      boundary row, append `dataset-filters.md` to sibling-
      docs list.
- [x] Update `.agents/design/index.html` — sidebar sub-item +
      right-side card for the new preview (N=6 previews).
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **URL param explosion at 12+ columns.** A worst-case dataset
  with a filter on every column writes ~30 params. URLs stay
  legible up to ~2000 chars; even at the max we're well under.
  Mitigation: design doc names a soft cap (8 active filters as
  a UX guideline, no hard cap); if it ever bites, fallback to
  the JSON-body `POST /datasets/{id}/rows:search` shape that
  R38 sketches as a secondary option.
- **Operator selector ergonomics for casual users.** Asking a
  non-power user to pick `≥` vs `>` mid-flow may feel
  technical. Mitigation: default each dtype's operator to the
  most common (`contains` for string, `equals` for numeric,
  `equals` for date, `is true` for boolean); the dropdown is
  available but optional.
- **Date range cross-locale.** Date input formatting via
  `<input type="date">` is locale-aware by browser, not by app.
  Mitigation: use AntD `<DatePicker>` in the popover (already
  in the bundle from R17 wizard's parse-options panel); FE
  controls the format, BE accepts ISO date strings.
- **Filter + `?q=` interaction**. A user types in the search
  bar while filters are active — expected behavior is AND
  (search runs within filtered rows). Mitigation: design doc
  spells out the AND-compose rule; preview shows both `?q=` +
  chip row simultaneously to make the visual rule self-evident.
- **Per-popover apply vs. live filter.** Should the popover
  apply on every keystroke (live), or only on `Apply` click
  (committed)? Committed is less server traffic and clearer
  user mental model; live feels modern but races with the
  300ms search debounce. Mitigation: design specifies
  **committed** (Apply button is required); flag for revisit
  in R40 if it feels heavy.
- **Removing a chip vs. clearing within the popover.** Two
  affordances to remove a filter: chip `×` and popover's "Clear
  this filter" link. Mitigation: design doc shows both; chip
  `×` is the primary, popover-internal clear is for the case
  where the user opens to edit and decides to remove instead.
- **Filter-state caching across the rows query key.** TanStack
  cache key must include the full filter set; otherwise stale
  results bleed. Mitigation: design doc names
  `['datasets', { id }, 'rows', { page, pageSize, q, filters }]`
  as the target key shape; R40 implements with the canonical
  serialization (sorted by `f<N>` index so key equality is
  stable across different param-write orders).

## Do

**Design doc.**

- [`dataset-filters.md`](../../design/data-management/dataset-filters.md)
  authored from scratch following R10/R14/R33's canonical
  template ([README.md § file-format conventions](../../design/README.md#canonical-conceptmd)).
- **Surface declaration table** at the top names 8 surfaces:
  `FilterTrigger` (column-header `▾` button, feature plain-UI),
  `FilterPopover` (per-dtype container, feature glue),
  per-dtype editors (`StringFilterEditor` /
  `NumericFilterEditor` / `DateFilterEditor` /
  `BooleanFilterEditor`, feature plain-UI),
  `ActiveFilterChips` (chip row, feature plain-UI),
  `useFiltersState` (URL ↔ predicate-set hook, feature glue),
  `datasetsApi.getRows` extension (builder glue), the
  `GET /datasets/{id}/rows` filter-params extension (BE
  feature), and the `FilterPredicate` discriminated-union type.
  Boundary check confirms no surface lives in `@mdd/ui` per
  the build-first lesson — feature-local until a second
  consumer arrives.
- **ASCII layouts** cover 5 states: filters-applied (chip row
  populated + 2 active column triggers), 4 open-popover flavors
  (string `equals`, numeric `between`, date `between`, boolean
  `is true`), and no-match (filters return zero rows).
- **Filter-trigger anatomy** + **chip-row anatomy** spelled
  out as discrete sub-sections so R40 implements against a
  pixel-shape, not just behavior.
- **Token map** cites 18 tokens against
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
  (via the
  [`tokens.css`](../../design/_archive/_css/tokens.css) mirror). No new
  token values introduced.
- **Behavior** section uses Mermaid `stateDiagram-v2` for the
  popover lifecycle (Idle → PopoverOpen → PopoverEditing →
  Idle via Apply / Cancel / Clear filter / Esc / chip ×); prose
  for URL state, AND-compose with `?q=`, page-reset rule,
  popover validation (Apply disabled when value missing),
  TanStack cache-key shape.
- **Data contract** prose-shapes the rows-GET extension two
  ways: primary as encoded params (`f<N>_op`, `f<N>_val`,
  `f<N>_min`, `f<N>_max`) and fallback as a
  `POST /datasets/{id}/rows:search` JSON body. R38 picks based
  on contract-validity testing.
- **Predicate vocabulary table** spells out every (dtype,
  operator) pair with URL-key, value shape, and DuckDB SQL
  equivalent — the cross-stack spec R38 / R39 / R40
  implement against.
- **Read/write boundary** explicitly lists R38→R40 scope plus
  the deferrals (OR/grouping, saved filters, regex,
  cross-column predicates, multi-value `in (...)`, client-only
  filtering) which all roll up under the advanced-query
  follow-up.

**Preview HTML.**

- [`dataset-filters.preview.html`](../../design/data-management/_archive/dataset-filters.preview.html)
  authored. Self-contained Tailwind-CDN preview, reuses the
  master-layout chrome via `../_css/{tokens.css,
preview-shell.css}`.
- Active sub-item in the sidebar = `Dataset detail` (the
  filter page is a sub-page of the detail page, not its own
  sub-menu).
- 7-state toggle bottom-right: Applied (default), Empty,
  Popover · string, Popover · numeric, Popover · date,
  Popover · bool, No match. Each state composes the chip row
  (or hides it) + the relevant popover (positioned absolute
  within the table wrap, anchored to its target column header).
- Column headers carry the new `▾` filter trigger next to the
  dtype badge; `amount` and `stage` are styled active (primary
  color + redundant top-right dot) in every state with the chip
  row visible.
- Popover bodies match the design doc's ASCII spec: operator
  `<select>` at top, value editor varying by dtype (one input
  for string, two for numeric range, two AntD-style date
  inputs, no-input + hint for boolean), and a footer row
  containing `Clear filter`, Cancel, and Apply.
- Chip text format honors the design rule (`stage = won`,
  `amount between 10,000 and 50,000`, `won_at after 2026-12-01`
  in the no-match state to show the date-after operator).
- Banner near the top names the round + lifecycle per
  README convention.

**Sibling doc stamps.**

- [`dataset-detail.md`](../../design/data-management/dataset-detail.md)
  Read/write boundary — the "Per-column search / typed-filter
  language" deferral row replaced with "Per-column filters —
  R37 design, R38→R40 impl chain" + a sibling link to
  `dataset-filters.md`. The advanced-query language stays
  flagged as the _next_ deferral. Sibling-docs list at the top
  of the file gained the new entry.

**Design index.**

- [`.agents/design/index.html`](../../design/_archive/index.html)
  gained a sub-item under the Data-Management sidebar group
  (FilterOutlined SVG icon) and a right-side preview card with
  the R37 badge + the "per-column typed filters · sub-page of
  Dataset detail" role badge. Topbar `N = 5 previews` →
  `N = 6 previews`.

**Lint pipeline.**

- `npx markdownlint-cli2` — 0 errors over 95 files (R37 added
  2 files to the linted set: `Round_37.md` +
  `dataset-filters.md`). One emphasis-style nit caught
  mid-round (`*next*` / `*only*` / `*is*` → `_next_` / `_only_`
  / `_is_` to satisfy `MD049/emphasis-style` underscore rule);
  fixed in place.

## Check

- [x] Design doc covers all canonical-template sections
      (status header, surface table, ASCII for 5 states,
      anatomy sub-sections, token map citing themeTokens.ts,
      Mermaid behavior, prose YAML contract, predicate
      vocabulary, read/write boundary, scope, lifecycle).
- [x] Surface declaration table: 8 rows, every surface has
      Layer / Reusability / Purity / Allowed-peer-deps
      declared. Boundary check note explicitly states no
      `@mdd/ui` extraction this round.
- [x] Preview HTML: 7-state toggle works (filters-applied /
      filters-empty / 4 popover variants / no-match) via
      body-class swap; popover overlay shows/hides correctly
      per state; column-header `▾` triggers and active-state
      styling render against the same tokens as the canonical
      design doc references.
- [x] `dataset-detail.md` Read/write boundary updated; the
      "Per-column search / typed-filter language" row is
      replaced with the R37 promotion entry; advanced query
      stays explicitly deferred.
- [x] `dataset-detail.md` sibling-docs list at the top
      includes `dataset-filters.md`.
- [x] Design index sidebar + right-side card include the new
      preview; topbar preview count updated to N = 6.
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      Status → 0 unticked.

## Act

**Learnings**:

- **Discriminated-union types pay for themselves the moment
  the operator set is dtype-dependent.** The `FilterPredicate`
  type sketched in the design doc collapses the
  combinatorial (dtype × operator) space into ~8 variants the
  compiler can exhaust-check. R40 will benefit from this:
  every editor narrows to a single variant via `dtype`, and
  the URL serializer pattern-matches per variant instead of
  juggling optional fields. Worth pre-baking the type at
  design-time rather than letting it emerge in R40.
- **The encoded-params URL is debuggable; the JSON body is
  escape-valve.** A user-share URL like
  `?f0_op=equals&f0_val=won&f3_op=between&f3_min=10000&f3_max=50000`
  is something a power user can read and edit by hand. That's
  the kind of property POC users actively use ("share this
  filtered view as a URL"). Reserving the JSON-body path as
  fallback (without committing to it now) keeps the option
  available if param explosion hits.
- **Filter trigger as button-next-to-dtype-badge avoided the
  AntD `<Table>` column-config debate that surfaced in R36.**
  R36 chose a hand-rolled `<table>` over AntD's column-config
  for cell-render flexibility; that decision now also means
  the filter trigger is just an extra `<button>` per `<th>`,
  no AntD `columnFilters` API to fight. The R36 trade-off
  pays a second dividend here.
- **Numeric / date `between` ergonomics**: two side-by-side
  inputs in a 2-col grid is the cheapest visual that
  communicates "range, inclusive on both ends." Putting "(From
  — To)" in the label avoids the need for a separator glyph
  between the two inputs.
- **`is null` / `is not null` as explicit operators (not a
  checkbox).** A "include nulls" checkbox crosses the
  operator/operand boundary and would require the BE to mix
  `OR col IS NULL` into every other predicate's WHERE clause.
  Modeling null-handling as its own pair of operators keeps
  the predicate vocabulary closed under "one row per WHERE
  clause" and lets users be explicit ("show me only the rows
  with no won_at").

**Promotions** _(none — design round; the F-round patterns
will land as feature-local components in R40)_:

**Follow-ups (not promotions, just notes):**

- **R38 has two competing pulls.** The verification-stack
  queue
  ([`decisions/2026-05-27-verification-stack-queue.md`](../../decisions/2026-05-27-verification-stack-queue.md))
  names MSW as "next available Track-2 round (likely R38)";
  R37 closing now also pulls the contracts round. User decides
  at end-of-round Q&A which lands first; if MSW lands first,
  contracts slip one round and FE in R41 can parallelize with
  BE in R40 (MSW unlocks the FE-without-BE path).
- **Preview-HTML in design rounds** is queue item #4 in the
  verification stack — the trigger is "next design round
  (post-R37) catches a layout surprise ASCII would not have
  caught." R37 is a design round; the preview HTML _did_ catch
  one layout question (chip-row max width / wrap behavior at
  8+ active filters) that the ASCII alone underspecified.
  Tracked in the design doc's § Layout shell wrap-behavior
  note; not yet enough to trip the queue's named trigger, but
  worth flagging.
- **Operator labels (i18n)**: dtype-operator labels (`contains`,
  `≠`, `between`, `is true`) live under `datasets.filters.op.*`
  in R40's i18n payload. Vietnamese translations will follow
  R32 / R36's naive-AI-translation caveat; flag for a real
  translator pass when the locale list grows.
- **URL param-key index reliance on column order.** Using
  `f<N>_op` keyed by column index means if a future round
  ever lets the user reorder / hide columns at the
  UI level, the URL semantics need to follow column _id_ (not
  index) to stay stable. Currently the schema is fixed
  post-commit (R14 Read/write boundary), so this is moot;
  flag for revisit if column reorder ever lands.
- **Filter + sort interaction (when sort lands)**: sort is
  deferred per R33 § Read/write boundary. When it arrives, the
  URL gains `?order_by=&direction=` params orthogonal to
  filters; cache key adds those fields too. No design impact on
  filters themselves.

## Feeds into → Round_38 (TBD — see R37 Goal)

R37 closes the design phase for the per-column-filter feature.
Implementation chain begins R38:

- **R38** (C): extend
  [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  with the filter param vocabulary (encoded-params shape per
  R37's primary recommendation; `:search` POST fallback only
  promoted if contract-validity testing flags param-key
  parameterization as too clumsy); rationale doc; contract-
  validity tests stay green.
- **R39** (B): extend the BE rows handler to evaluate the
  per-column predicates against DuckDB (push filters into the
  WHERE clause before pagination); BE unit tests covering each
  operator + dtype-mismatch 422.
- **R40** (F): extend `datasetsApi.getRows`, the rows hook,
  and `DatasetDetailPage` with the filter trigger / popover
  per dtype / chip row / URL serialization; vitest cases for
  each dtype + combined filter+`q` interaction + no-match.

Verification-stack-queue note: the MSW round (queue item #1)
has "likely R38" as a soft target. User picks at end-of-R37
Q&A whether R38 is MSW (Track-2, slips the contracts work to
R39) or filter contracts (Track-1, slips MSW to R41 or later).
The DCBF chain stays intact either way; sequencing changes
only.
