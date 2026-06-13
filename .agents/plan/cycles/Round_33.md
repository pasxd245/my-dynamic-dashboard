# Round 33: Design — Dataset detail page (paged row inspector)

**Status**: Complete
**Date started**: 2026-05-26
**Date completed**: 2026-05-26

## Goal

**Inherits from ← [Round_32](Round_32.md)** — R27→R32 closed the
full readiness chain (config rendering, BE/FE config facades,
cross-language constants, runtime safety nets, FE polish, i18n).
With readiness done, Track-1 returns to product features. R32's
`Feeds into` named R33 as the **D-round of a DCBF chain**:

- **R33** (this round, D): `/datasets/:id` design + visual preview
- **R34** (C): GET endpoint contracts (`/datasets/{id}` +
  `/datasets/{id}/rows`)
- **R35** (B): BE handlers + paged-rows reader
- **R36** (F): FE page + virtualized / paged data table

R33 is **design-only** — one canonical design doc + one preview
HTML. No code under `apps/`, no contracts, no BE, no FE. Locks the
contract shape and visual target the next three rounds implement
against. Follows the R14 D-round pattern (the one that produced
`datasets.md` + `upload.md` before R15+ shipped code).

_Track: 1 (product — dataset detail is the missing surface that
makes uploaded data inspectable; closes the R14 R∞ deferral
"clicking a row → detail view"). Pulled by: R32 `Feeds into`
naming the DCBF chain; R14 `datasets.md` Read/write boundary
explicitly deferring detail view to R∞ "until a downstream
surface needs a per-dataset URL" — that surface now arrives.
Per [Evolution Rule](../../AGENTS.md)._

**User decisions locked at R33 planning (reasonable defaults under
[auto mode]; user redirects via end-of-round Q&A if any miss):**

1. **Page surface = paged row inspector + metadata strip.** No
   chart/profile/preview-stats this round (those are downstream
   query/dashboard features, not dataset readout).
2. **Server-side offset pagination** (`?page=&page_size=`). Cursor
   pagination is overkill at POC scale; row counts are
   commit-time-known so total-page math is trivial.
3. **Page size 50 default**, with selector for 25 / 50 / 100. AntD
   `<Pagination>` defaults; matches reading density without forcing
   horizontal-only-scroll fatigue.
4. **No column sorting in MVP.** Parquet is column-oriented but
   sort-by-arbitrary-column still requires full-file read; defer
   until a real query surface needs it.
5. **Rename + delete affordances reuse
   [crud-hygiene.md](../../design/data-management/_shared/crud-hygiene.md)**
   — same `<RenameModal>` + `<DeleteConfirmModal>` already used on
   the Datasets list row. Header `actions` slot on the detail page.
6. **Dtype badges on column headers.** A tiny pill ("int", "date",
   "str") next to each column name so the user can see schema at a
   glance without leaving the row data.
7. **Cell rendering = dtype-aware**: numerics right-aligned with
   `Intl.NumberFormat`, dates ISO-displayed via
   `Intl.DateTimeFormat`, booleans as plain `true`/`false`, nulls
   as a faint `—`, strings truncated with ellipsis at column
   max-width + full-text tooltip on hover.
8. **No re-upload / re-parse / column edit on this page.** Those
   are full features (R∞), not detail-page affordances.

## What is IN scope

### 1. New design doc — `dataset-detail.md`

Author
[`.agents/design/data-management/dataset-detail.md`](../../design/data-management/datasets/dataset-detail.md)
following the R10/R14 canonical template:

- **Status header** — concept name, R33 origin, draft status,
  implementation chain pointer (R34 contract, R35 BE, R36 FE).
- **Mandatory Surface declaration table** at the top — every
  surface R34→R36 will land, with Layer / Reusability / Purity /
  Allowed peer deps. Expected rows:
  - `DatasetDetailPage` route component (feature; glue: router +
    query)
  - `DatasetMetadataStrip` component (feature; plain-UI)
  - `DataTable` (paged) component (feature; plain-UI over AntD
    `<Table>`)
  - `useDatasetQuery(id)` hook (feature; glue)
  - `useDatasetRowsQuery(id, page, pageSize)` hook (feature; glue)
  - `datasetsApi.get(id)` + `datasetsApi.getRows(...)` (builder;
    glue)
  - `GET /datasets/{id}` BE route (backend; feature)
  - `GET /datasets/{id}/rows` BE route (backend; feature)
  - `DatasetDetail` + `RowsPage` types (feature; data type)
- **Reference materials** — sibling docs:
  [datasets.md](../../design/data-management/datasets/datasets.md) (the
  noun; this doc extends its R∞-deferred detail view),
  [upload.md](../../design/data-management/datasets/upload.md) (where the
  data came from),
  [crud-hygiene.md](../../design/data-management/_shared/crud-hygiene.md)
  (rename + delete affordances inherited here).
- **ASCII layout** — populated state (header + metadata strip +
  paged table), loading state (skeleton rows), error state (404
  → "deleted" empty state with `← Back to Datasets`), zero-rows
  state (rare but legit — every column excluded at commit).
- **Token map** — header chrome, metadata strip, table header,
  dtype badge, cell text, numeric-right-align, null-cell muted,
  pagination — each cited against
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts).
- **Behavior** — URL state (`?page=N&page_size=M`),
  back-navigation (preserves the list page's workspace filter +
  search via `referrer` query param or `history.back()`), browser
  back/forward, page-size-change resets to page 1, concurrent
  delete on the list page → detail-page 404 → toast + redirect.
- **Data contract (target shape for R34)** — `DatasetDetail`
  extends `Dataset` (no extra fields needed yet); `RowsPage` is
  `{ rows: (string | null)[][]; page: number; pageSize: number;
total: number }`. Rows are stringified BE-side (cells already
  are values for SQLite/Parquet; FE re-typecasts via `dtype` from
  the column metadata on the parent dataset).
- **Read/write boundary** — what R35/R36 implement vs what stays
  deferred. Explicit deferrals: sorting, filtering, column hide,
  cell editing, full-row inspection drawer, JSON/CSV export, row
  delete, virtualized scroll (offset pagination first; virtualize
  only when 100k+ rows is a real number).
- **Scope boundary** — what this concept covers, what is deferred,
  what is explicitly out.

### 2. New preview — `dataset-detail.preview.html`

Self-contained Tailwind-CDN HTML preview following the convention
in [.agents/design/README.md § previews](../../design/README.md).

- Master-layout chrome (`../_css/preview-shell.css`) so sidebar +
  topbar match the other previews; active sub-item = Datasets
  (this is a sub-page of the Datasets feature, not its own
  sub-menu).
- Breadcrumb: `Home ▸ Data Management ▸ Datasets ▸ q1_pipeline_Deals`
- Metadata strip below header (Workspace · Rows · Cols · Size ·
  Uploaded · Format/sheet).
- Realistic data table — ~12 column headers (mix of dtypes:
  string, int, float, date, datetime, boolean) with dtype
  badges, ~15 sample rows including a few `null` cells, a few
  long-string truncations, a long-decimal float.
- AntD-style `<Pagination>` mocked at the bottom (page 1 of N,
  page-size selector, jumper).
- A small click-through script that:
  - Toggles between populated / loading / 404-deleted / zero-rows
    via top-of-page state buttons (mirrors how
    `crud-hygiene.preview.html` toggles modal variants).
  - Flips a header `Actions` menu open (Rename / Delete copy
    only — no real handlers).
- Honest banner near the top: "Brainstorming preview — not
  production. R33 D-round target."

### 3. Stamp sibling docs

- Update
  [`datasets.md`](../../design/data-management/datasets/datasets.md)
  Read/write boundary table — flip "Dataset detail view (R∞)"
  to "Dataset detail view — R33 design, R34→R36 impl chain";
  add `dataset-detail.md` to the sibling-docs list at the top.
- Update
  [`crud-hygiene.md`](../../design/data-management/_shared/crud-hygiene.md)
  with a one-line note that R33 extends the rename/delete
  affordances to the dataset detail page header (no behavior
  change — same modals, same hooks).
- Update `../../design/_archive/index.html` —
  add `dataset-detail.preview.html` as a sub-item in the
  Data-Management sidebar group + a card on the right.

### 4. Round file + audit

- This Round_33.md.
- `npx markdownlint-cli2` repo-wide returns 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No code under `apps/`** — no router, no page, no hooks, no
  api client. R36 lands FE; R35 lands BE; R34 lands contracts.
- **No OpenAPI contract files.** Contract shape lives prose-only
  in `dataset-detail.md` § Data contract; R34 mechanizes it as
  YAML.
- **No DCBF mechanization.** R33 picks the shape; R34→R36 build
  it. Mixing contract YAML or BE handlers into a D-round breaks
  the one-feature-per-round rule.
- **Charts / profile / column histograms / null-density bars.**
  Those are dataset _insight_ surfaces — out of scope until a
  query/dashboard surface pulls them in.
- **Row-level CRUD.** No row edit, no row delete, no row insert.
  Datasets are immutable post-commit in this iteration.
- **Cell-content search / filter.** Deferred until query surface
  exists (which IS the cell-search affordance, just generalized).
- **Column reordering / hide / freeze.** Deferred.
- **Virtualized scroll.** Offset pagination handles up to a few
  hundred thousand rows comfortably; virtualize only when row
  counts cross 100k _and_ page-size-100 feels slow.
- **Export (CSV / JSON / Parquet download).** Useful, but a
  separate feature with its own UX + auth/perm story. R∞.
- **Concurrent-edit semantics.** No locking, no
  optimistic-concurrency tokens; the dataset is immutable from
  the user's POV. Only delete races matter (handled via 404).

## Plan

- [x] Confirm scope at planning review (decisions 1-8 above; user
      redirects any via end-of-round Q&A).
- [x] Author `.agents/design/data-management/dataset-detail.md`
      with the full canonical template (status header, surface
      table, ASCII layout, token map, behavior, data contract,
      read/write boundary, scope).
- [x] Author
      `.agents/design/data-management/dataset-detail.preview.html`
      with the populated / loading / 404 / zero-rows toggle and
      header-actions menu.
- [x] Update `datasets.md` — flip detail-view boundary row,
      append `dataset-detail.md` to sibling-docs list.
- [x] Stamp `crud-hygiene.md` with the one-line R33 extension
      note.
- [x] Update `.agents/design/index.html` — sidebar sub-item +
      right-side card for the new preview.
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Open `dataset-detail.preview.html` mentally-walk (headless
      this turn; preview is HTML-only, no runtime deps).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **Pagination-vs-virtualization debate.** Offset pagination
  feels old-fashioned to data-tool users (Excel / Sheets show
  everything). Mitigation: AntD `<Pagination>` is the lowest-
  ceremony stopgap; the doc names virtualization as the lever
  to pull once row counts cross 100k. Document the trigger in
  the deferred-list so R36's Plan can re-evaluate.
- **Dtype badge density on narrow screens.** 12+ columns × dtype
  pill might wrap awkwardly. Mitigation: preview at 1280px
  (typical builder viewport); if it breaks at 1024px, shrink
  the pill to a single-letter glyph (`#` / `📅` / `T`) — decide
  in the preview pass.
- **Null rendering choice.** `—` is unambiguous for numbers but
  collides with negative-sign in date ranges. Mitigation: use a
  muted-color `—` and never render `-` for actual negative-date
  ranges (we don't have date-range cells anyway). Document the
  rule.
- **Long-string truncation policy.** Truncate-with-tooltip is
  AntD pattern but expensive for 100-row × 12-col page (1200
  Tooltip mounts). Mitigation: render plain `<span title="…">`
  for browser-native tooltip; reserve AntD `<Tooltip>` for
  header dtype-badge explanation only. Document the rule.
- **`history.back()` vs explicit referrer state.** Back from
  detail page should restore list-page state (workspace filter,
  search, scroll). Mitigation: design doc names
  `history.back()` as the R36 default; if it loses state in
  practice (page reload, deep-link entry), R36 can promote to
  a `referrer` query param. Don't pre-decide; flag the
  risk-and-mitigation in the doc.
- **Page-size-change UX.** Switching from 50 to 100 mid-scroll
  is jarring. Mitigation: design doc specifies "always reset to
  page 1" — matches AntD default; covered in Behavior section.

## Do

**Design doc.**

- [`dataset-detail.md`](../../design/data-management/datasets/dataset-detail.md)
  authored from scratch following R10/R14's canonical template
  ([README.md § file-format conventions](../../design/README.md#canonical-conceptmd)).
- **Surface declaration table** at the top names 9 surfaces:
  `DatasetDetailPage` (route, glue), `DatasetMetadataStrip`
  (feature plain-UI), `DataTable` paged (feature plain-UI),
  `useDatasetQuery` + `useDatasetRowsQuery` (feature glue),
  `datasetsApi.get` + `.getRows` (builder glue),
  `GET /datasets/{id}` and `GET /datasets/{id}/rows`
  (BE feature, pyarrow noted as paged-Parquet-read peer dep on
  the rows route), and `DatasetDetail` / `RowsPage`
  types. Boundary check confirms no surface lives in `@mdd/ui`
  per the build-first lesson.
- **ASCII layout** covers all four states: populated (header +
  metadata strip + paged table), loading (skeleton rows),
  404/deleted (centered "this dataset no longer exists" block
  with `← Back to Datasets` button), and zero-rows (header
  visible, table-headers-only with `📭 No rows in this dataset`
  placeholder).
- **Token map** cites 22 tokens against
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
  (via the
  `../../design/_archive/_css/tokens.css` mirror). No new
  token values are introduced; if R36 finds one missing, it
  promotes the value in `themeTokens.ts` as a prerequisite step.
- **Behavior** section uses Mermaid `stateDiagram-v2` for the
  page state machine and prose for URL state, back navigation,
  rename/delete inheritance from
  [crud-hygiene.md](../../design/data-management/_shared/crud-hygiene.md),
  and the concurrent-delete 404 race.
- **Data contract** prose-shapes the two new GET routes as
  YAML-ish blocks; R34 will mechanize. Cell stringification (`string |
null`) rationale documented: BE renders cells, FE re-applies
  dtype-aware display formatting from `Dataset.columns[].dtype`
  on the parent. This keeps the rows payload schema-free.
- **Read/write boundary** explicitly lists R34→R36 scope and
  defers 8 items (sorting, cell-search, virtualized scroll,
  column hide/freeze/reorder, row CRUD, row inspection drawer,
  export, append/re-upload). Each defer has a named trigger.

**Preview HTML.**

- `../../design/data-management/_archive/dataset-detail.preview.html`
  self-contained, opens directly from `file://`. Tailwind CDN
  pulled for layout utilities; chrome via shared
  `../../design/_archive/_css`.
- Master-layout chrome matches the other previews — Datasets
  sub-item stays active in the sidebar (the detail page is a
  sub-page of Datasets, not its own sub-menu). Sidebar cross-
  links to Workspaces + Datasets previews so the flow loop
  closes.
- Realistic 10-row × 8-column populated table mixes all 6
  dtypes — string, int, float, date, datetime, boolean — with
  4 null cells (proves the muted `—` glyph) and 1 long-memo
  cell with native browser `title` tooltip (proves the
  truncate-with-tooltip pattern documented in the design doc).
- Pagination bar shows 50-page-size selector + jumper + "of 50"
  hint, with `is-active` styling on page 1.
- State toggle (bottom-right) flips between Populated /
  Loading (8 skeleton rows) / 404 / Zero rows.
- Header `[Actions ▾]` button opens a small menu (Rename… +
  Delete… items, with Delete styled in `--color-error`); click
  outside dismisses.

**Sibling stamps.**

- [`datasets.md`](../../design/data-management/datasets/datasets.md):
  added `dataset-detail.md` to the sibling-docs list at the
  top, and flipped the Read/write boundary's "Dataset detail
  view (R∞)" row using strikethrough + a "Resolved by R33"
  follow-on bullet that names the R34→R36 implementation
  chain. Round number kept in the strikethrough so future
  archaeology can find the original deferral.
- [`crud-hygiene.md`](../../design/data-management/_shared/crud-hygiene.md):
  appended a new "## R33 stamp — extended to dataset detail
  page" section at the end. Names the third placement of the
  rename/delete affordances (page header actions slot) and
  confirms the modals + hooks are reused unchanged. Workspace
  surfaces unaffected — workspaces have no detail page.

**Design index.**

- `../../design/_archive/index.html`: added
  a new sidebar sub-item "Dataset detail" between Upload and
  CRUD hygiene in the Data Management group, and a matching
  preview card with R33 badge + "paged row inspector · sub-
  page of Datasets" role badge. Topbar placeholder bumped from
  `N = 4 previews` to `N = 5 previews`.

**Check pipeline.**

- `npx markdownlint-cli2` repo-wide: 0 errors over 83 files
  (caught one stray `+` ambiguous list marker in
  `dataset-detail.md` and two `*emphasis*` instances in
  `Round_33.md` on the first pass; fixed before final).
- `git diff --stat`: confirms only 3 existing files modified
  (`crud-hygiene.md`, `datasets.md`, `index.html`) + 3 new files
  (`dataset-detail.md`, `dataset-detail.preview.html`,
  `Round_33.md`). No code under `apps/` or `workspace/packages/`
  changed.
- Preview mentally-walked headless: all four state-toggle
  buttons swap the visible `data-show-when=...` block; the
  Actions menu opens on click and dismisses on outside-click
  via the inline JS. Token classes resolve via the shared
  `_css/tokens.css`.

## Check

- [x] `.agents/design/data-management/dataset-detail.md` exists
      with all canonical sections (status header, surface table,
      reference materials, ASCII layout, token map, behavior,
      data contract, read/write boundary, scope).
- [x] `.agents/design/data-management/dataset-detail.preview.html`
      exists, opens directly in a browser without build step,
      uses the shared `../_css/{tokens,preview-shell}.css`.
- [x] `datasets.md` references `dataset-detail.md` in its sibling
      list; Read/write boundary's detail-view row flipped.
- [x] `crud-hygiene.md` has the R33 extension stamp.
- [x] `.agents/design/index.html` lists the new preview in
      sidebar + right-side card.
- [x] No code under `apps/`, `workspace/`, or
      `workspace/packages/` changed this round (verified via
      `git diff --stat`).
- [x] `npx markdownlint-cli2` returns 0 errors.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
      passes.
- [x] All Plan + Check checkboxes flipped before Status flips to
      Review.

## Act

**Learnings**:

- **D-rounds stay small when the contract shape is already
  obvious.** I considered adding a `target.md` per
  [README.md § target docs](../../design/README.md) —
  the rule triggers at 3+ rounds of iteration. R33→R34→R35→R36
  qualifies _only if_ the destination shape is unstable across
  those rounds; here the contract + visual target are locked at
  R33, so canonical `dataset-detail.md` is enough. R36 amends
  in place if implementation surfaces a missed decision. No
  target doc needed; defer the trigger to the _next_ concept
  that genuinely fans across 3+ rounds with an unstable
  destination.
- **Cell stringification (`string | null`) is a real boundary
  decision, not a default.** I almost punted to typed cells
  (`(string | number | boolean | null)[][]`) to "save the FE a
  re-cast." But that leaks pyarrow's parser opinions through the
  wire — every BE dtype-conversion difference becomes an FE
  display bug. Stringified cells + dtype carried on the parent
  Dataset keeps the responsibility line clean: BE renders, FE
  display-formats. Documented the rationale in the design doc
  so R34's contract review doesn't second-guess it.
- **`history.back()` over `?from=` query param.** Tempting to
  pre-design the referrer state, but the simpler default works
  for the row-click → detail entry path which is ~99% of
  traffic. Deep-link entry (paste URL into a new tab) loses
  list-state, but the user knows they typed the URL. R36 can
  promote to `?from=` if verification finds it flaky — flagged
  in Risks so the trigger is visible.
- **Tokens > new colors.** Dtype badge and null glyph both
  resolve to existing tokens (`--color-fill-quaternary`,
  `--color-text-tertiary`). The design doc's token map cites
  source for every cell; I caught myself once writing
  `color: #999` inline in the preview's first draft — token
  authority discipline applies even in HIxAI previews.

**Promotions** _(none — implementation round's-worth of design
contract; the canonical design doc lives in
[dataset-detail.md](../../design/data-management/datasets/dataset-detail.md)
and is self-evident from `.agents/design/data-management/` going
forward)_:

**Follow-ups (not promotions, just notes):**

- **Sortable columns** is the most-likely first-amendment to
  this design. As soon as a real user opens a 100k-row dataset
  and wants to "see the biggest deals first", the unsorted-only
  decision will break. Add a sort-direction-on-header indicator
  to the design when R37+ a query/dashboard surface lands and
  forces sort to exist.
- **Virtualization trigger**: when 100k+ row datasets become
  routine _and_ page-size-100 feels slow. Currently neither is
  true; AntD `<Table>` paged rendering handles 100 rows ×
  12 cols in tens of milliseconds.
- **Dataset detail's `target.md`**: not needed in R33 (DCBF
  shape is locked). If R34→R36 actually drift the destination
  shape (e.g. we promote to a different pagination strategy
  mid-chain), promote to a target doc retroactively per the
  README.md trigger.
- **Re-upload affordance** ("replace data, keep dataset id") is
  the natural next CRUD operation after delete. Today the user
  has to delete-and-re-upload, which loses the dataset id and
  any downstream query references. R∞ — promote when a real
  user is blocked by id-churn.

## Feeds into → Round_34 (Contract: GET /datasets/{id} + /datasets/{id}/rows)

R33 hands forward to R34:

- **Locked data contract shape.** `DatasetDetail` and `RowsPage`
  prose-shaped in `dataset-detail.md` § Data contract; R34
  mechanizes as OpenAPI 3.1 YAML under
  `workspace/packages/contracts/datasets/`.
- **Locked pagination params.** `?page=` (1-indexed) and
  `?page_size=` (25 / 50 / 100 enum, default 50) — R34 encodes
  the validation rules + 422 surface.
- **Locked error envelope.** 404 reuses R25's `{ code:
"not_found" }` envelope (same as existing dataset routes).
- **Locked field set.** No new fields on `Dataset`; detail GET
  returns the existing shape. Row cells are stringified
  `(string | null)[][]`.

R34 picks up dataset detail's **contract round** (C in DCBF):
OpenAPI YAML for both routes, contract-doc explainer, and
contract-tests in `workspace/packages/contracts/datasets/`.
R35 (B) then implements the FastAPI handlers + paged-rows
Parquet reader. R36 (F) renders the page against R33's design.

## Appending to Complete rounds

**Post-Complete scope amendment — row search (`?q=`)**

_Pull_: during R34 (Review), the user flagged that 2,481 rows ÷
50 page-size = 50 pages of pagination — Cmd-F-style row lookup
is table stakes for any data inspector. R33's original
deferral ("cell-content search lives in the future query
surface") was too aggressive; substring search across all cells
is part of the inspector noun, not a separate analytical
surface. Per-column / typed-filter languages remain deferred to
the future query feature.

_Governance_: R33 is Complete; the round's history is
append-only per [PDCA.md § governance](../PDCA.md#governance).
This note describes the post-Complete amendment to the
**design artifacts** (not to the round file body). The
following design files were updated in the same commit (via
`git commit --amend`) so the R33 design baseline is
self-consistent for R34→R36 to implement against:

- [`dataset-detail.md`](../../design/data-management/datasets/dataset-detail.md)
  — added `RowSearchBar` surface, updated layout ASCII to show
  the search input + match counter, added new "Row search
  (`?q=`)" behavior section, added new "No-match state" ASCII,
  added mermaid `NoMatch` state, extended Read/write boundary
  R34+ scope to include `?q=`, removed "Cell-content search"
  from Deferred (kept "per-column / typed filters" deferred).
  Data contract section gained the `q` query param on rows-GET.
- `../../design/data-management/_archive/dataset-detail.preview.html`
  — added `<input type="search">` + match counter above the
  table in populated state; new no-match state with "Matched
  0 / 2,481" counter, `[Clear]` link, and "No rows match
  '<query>'" placeholder; new toggle button at the bottom-right.
- `../../design/_archive/index.html` — card
  description updated to mention the search bar and no-match
  state.

_Cascade into R34_: R34's `rows-get.contract.yaml` (still in
Review at this moment) will be amended in R34's working scope
to add the `q` query param + matched-vs-full `total` semantics
before R34 itself flips to Complete. That amendment lands in
R34's commit, not this one.

_Why amend instead of a new round_: search-within-a-dataset is
not a separate feature — it's part of the inspector surface
designed in R33. Adding it as R37 would split a single
coherent UX across two design docs and force R36 to ship a
known-incomplete inspector. The amendment keeps the design
self-contained while leaving the future per-column / typed
query surface explicitly deferred.
