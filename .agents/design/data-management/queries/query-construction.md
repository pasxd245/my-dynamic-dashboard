# Query Construction — the interactive builder: edit a Query's definition + preview before save

**Concept**: the **construction surface** is the editable builder for a
[Query](saved-query.md): an **Edit mode** of the query detail (and a **Create mode**
reached from "Build on this query") that lets a user build a Query's definition — pick its
driving source, edit its [join tree](saved-query.md#joins-reading-related-datasets-as-one),
and compose **cross-source predicates** over the combined column space — and **preview**
the resulting rows **before saving**. It is **not a new noun and not a new engine**: it
edits the [`QueryDefinition`](saved-query.md#data-model) the spine owns and runs the spine's
`query_joined_rows` / `query_dataset_rows` / `resolve_source` engines through a stateless
preview. This doc owns the **builder UX** — layout, the edit/create lifecycle, the live
preview, and the in-builder validation — while the model, routes, and engine live in the
[saved-query.md spine](saved-query.md).

**Status**: Accepted.
**Sibling docs**:
[saved-query.md](saved-query.md) (the spine — the `QueryDefinition` model, the
`POST …/preview` / `PUT /queries/{id}` / `POST …/queries` routes, the engines, and the
`query_stale` / `relationship_stale` / `composition_cycle` gates this builder edits and
previews against),
[query-builder.md](query-builder.md) (the domain anchor; the
[reuse invariant](query-builder.md#the-reuse-invariant-the-one-rule-this-domain-holds)
this obeys),
[canvas.md](canvas.md) (the visual editor that adds a canvas view/edit mode over this
same builder — design banked, build deferred),
[dataset-filters.md](../datasets/dataset-filters.md) +
[advanced-query.md](../datasets/advanced-query.md) (the chip + advanced-DNF predicate
**editors** reused verbatim — bound to the Query's effective columns),
[dataset-detail.md](../datasets/dataset-detail.md) (owns `<PagedRowsView>`, reused for
the live preview),
[crud-hygiene.md](../_shared/crud-hygiene.md) (the discard-changes confirm pattern),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome all
surfaces render inside).

---

## Why a mode, not a noun

Building a Query introduces **no new readable-table-source kind** and **no new engine** —
it edits the `QueryDefinition` the spine seals and runs the spine's engines through a
stateless preview. So construction is an **Edit/Create mode** of the existing detail and
catalog rather than a `/builder` page or a `QueryBuilder` noun. What is genuinely this
doc's: the **edit + preview + create UX**, named below — never laundered as new
capability. The reuse invariant binds it: the builder **composes** the shipped predicate
editors, the relationship/base `<Select>`s, and `<PagedRowsView>`; it re-implements no
predicate engine, join engine, or detail page.

---

## What the builder edits (reused vs new)

| Reused verbatim | New (the edit + preview + create UX only) |
| --- | --- |
| The `QueryDefinition` (`q` / `filters` / `advanced` / `joins`) + the polymorphic `sourceId` — **edited, not extended** | An **Edit mode** on `/queries/:id` + a **Create mode** at `/queries/new?base=qr_…` |
| The chip-filter + advanced-DNF **editors** + their serializers/validators | Those editors **bound to the effective columns** (the combined `joins`-tree space) |
| The base/relationship `<Select>`s + per-hop join-type `<Select>` | The **`JoinEditor`** that mutates the `joins` tree (base source, add/remove hops, per-hop type) in place |
| `query_joined_rows` / `query_dataset_rows` / `resolve_source`; the `409 query_stale` / `409 relationship_stale` / `409 composition_cycle` gates | A **stateless preview** of the **unsaved** definition (`POST …/queries/preview`) |
| `<PagedRowsView>`, the `RowsPage` shape, `SaveQueryModal`, `useCreateQueryMutation`, the `<DeleteConfirmModal>` confirm pattern | A **dirty / Save / discard** lifecycle on the detail, and a **no-id create** lifecycle (preset base → name capture → `POST`) |

**No new model. No new engine. No new route beyond the spine's `preview` + `update`.**

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                  | Layer                                                | Reusability         | Purity   | Allowed peer deps                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------- | -------- | ---------------------------------- |
| `QueryDetailPage` (Edit toggle; header `[Cancel] [Save]`)                | `apps/builder/src/features/data-management/queries`  | feature             | feature  | react, antd, @tanstack/react-query |
| `QueryCreatePage` (create mode at `/queries/new?base=qr_…`)              | `apps/builder/src/features/data-management/queries`  | feature             | feature  | react, antd, @tanstack/react-query |
| `QueryBuilderPanel` (presentational, collapsible Build + Preview)        | `apps/builder/src/features/data-management/queries`  | feature             | feature  | react, antd                        |
| `useQueryBuilder` (builder state + debounced preview + Save lifecycle; edit + create modes) | `apps/builder/src/features/data-management/queries` | feature       | glue     | @tanstack/react-query, antd        |
| `JoinEditor` (base-source picker + join-tree editor: ≤1-hop single edit; hop-rows + add/remove for ≥2) | `apps/builder/src/features/data-management/queries` | feature | feature | react, antd                  |
| `JoinWithRelatedModal` (minimal join-create entry from a dataset)        | `apps/builder/src/features/data-management/queries`  | feature             | feature  | react, antd                        |
| `SaveQueryModal` (reused — name capture for save + create)               | `apps/builder/src/features/data-management/queries`  | feature             | feature  | react, antd                        |
| chip-filter + advanced-DNF editors (reused, not owned)                   | `apps/builder/src/features/data-management/datasets` | feature             | feature  | react, antd                        |
| `<PagedRowsView>` (reused; preview body + per-column filter headers)     | `apps/builder/src/features/data-management/_shared`  | shared cross-domain | plain-UI | react, antd, react-i18next         |

**Boundary check**: the only shared-cross-domain row (`<PagedRowsView>`) is **reused, not
owned** ([dataset-detail.md](../datasets/dataset-detail.md)). The predicate editors are
**reused by reference** from the datasets feature; the builder composes them over the
Query's effective columns, never re-implementing them. `JoinEditor` reuses the
relationship/base `<Select>`s. No builder surface re-implements a dataset/query page or a
predicate/join engine.

---

## Token map

The builder surfaces are AntD primitives (`<Select>`, `<Button>`, `<Tag>`, `<Alert>`,
`<Collapse>`, `<Table>` via `<PagedRowsView>`, the reused chip/advanced editors) styled by
the `<ConfigProvider>` tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the source of
truth). **No new token is introduced**; the map reuses identifiers already cited by
[saved-query.md](saved-query.md). `Value` is informational.

| Surface                                        | AntD token (themeTokens.ts) | Value (informational) |
| ---------------------------------------------- | --------------------------- | --------------------- |
| Page background                                | `colorBgLayout`             | `#f5f5f5`             |
| Builder panel card background                  | `colorBgBase`               | derived               |
| `[Edit]` / `[Save]` / primary action           | `colorPrimary`              | `#1677ff`             |
| Editable join / predicate `<Tag>` text         | `colorTextSecondary`        | derived               |
| Builder section / table border                 | `colorBorderSecondary`      | `#f0f0f0`             |
| Dirty-state / unsaved-changes hint             | `colorWarning`              | `#faad14`             |
| Invalid predicate / unavailable-edge `<Alert>` | `colorError`                | `#ff4d4f`             |
| Border radius (card, table, tag, button)       | `borderRadius`              | `6`                   |
| Font family                                    | `fontFamily`                | system stack          |

Identifier parity is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## Layout — ASCII intent

The builder is an **Edit mode** of the query detail — the same standard detail shell
(`PageHeader` + `PageCard` + `<PagedRowsView>`). An `[Edit]` action (page header) swaps to
`[Cancel] [Save]` and reveals the builder as **two collapsible sections** — **Build**
(source + join editor + predicate editors) and **Preview** (the live rows). Both open by
default; collapse Build to give the preview full height on a short screen. Per-column
filters live in the **preview table headers** (filter where you see the data).

### View mode (read-only)

```text
Home ▸ Data Management ▸ Queries ▸ Deals × Accounts              [Edit]  [Delete]
Deals × Accounts                                  🔎 Query · live re-run · join
  ┌─ Join (read-only) ─────────────────────────────────────────────────────────┐
  │  Deals  ⋈ inner ⋈  Accounts      on  account_id ↔ id      many:many          │
  └────────────────────────────────────────────────────────────────────────────┘
  ┌─ Applied predicates (read-only) ───────────────────────────────────────────┐
  │  Deals.stage = won     Accounts.region = APAC                               │
  └────────────────────────────────────────────────────────────────────────────┘
  Matched 1,204 rows   <the shared <PagedRowsView> — saved definition's rows>
```

### Edit mode (the builder)

```text
Home ▸ Data Management ▸ Queries ▸ Deals × Accounts × Owners        [Cancel] [Save]
Deals × Accounts × Owners                          🔎 Query · editing (unsaved)

  ▾ Build
  ┌─ Source ─────────────────────────────────────────────────────────────────────┐
  │  Build on:  [ Deals (dataset)                                          ▾ ]    │  ← base: ds_ or qr_
  └───────────────────────────────────────────────────────────────────────────────┘
  ┌─ Joins ──────────────────────────────────────────────────────────────────────┐
  │  Deals  ⋈ [inner ▾]  [ account_id ↔ Accounts.id   (many:many)          ▾ ]    │
  │  Accounts  ⋈ [left ▾]  [ owner_id ↔ Owners.id     (many:one)    ▾ ]  [Remove] │  ← leaf
  │  [ + Add a join ]   from: [ Owners ▾ ]   (a left-source for 2+ in-graph nodes) │
  └───────────────────────────────────────────────────────────────────────────────┘
  (columns from all sources)
  Deals.stage = won  ×    Owners.region = APAC  ×            ← active-filter chips
  Advanced query  [ stage:won AND amount:>1000 ]      Search [ Match any cell… ]

  ▾ Preview · 1,204 rows   ⟳        [ Preview ]      ← collapse to free screen height
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Deals.id ⏷  Deals.stage ⏷ … Owners.region ⏷       ← per-col filter funnels │
  │  <the shared <PagedRowsView> — preview of the UNSAVED definition; combined │
  │   columns, duplicate names qualified; items-per-page 10 / 25 / 50 / 100>  │
  └────────────────────────────────────────────────────────────────────────┘
```

The `▾ Build` / `▾ Preview` bars are independently collapsible. `[Cancel] [Save]` live in
the page header; the preview re-runs the unsaved copy **debounced** (`[Preview]` flushes
it). The `JoinEditor` renders a single-edge affordance for ≤1 hop and hop-rows with a
left-source `<Select>` + per-hop type + add/leaf-remove for ≥2 (the spine's join tree).

### Invalid-edit / preview-blocked states (flag-don't-crash)

```text
  ⓧ  This predicate references "amount", which isn't in the joined columns.
     Remove it or pick a current column.                         (predicate invalid)

  ⚠  This join is unavailable — "account_id" no longer exists in Deals.
     Pick a different relationship, or remove the join.       (relationship_stale)

  ⚠  This base query loops back on itself. Pick a different base.   (composition_cycle)
```

`[Save]` is **disabled** while any predicate is invalid, an edge is stale, or the base is
unrunnable — the builder mirrors the server's validate-on-save guard, so a user can't save
a definition that wouldn't run.

---

## Behaviour — states

```mermaid
stateDiagram-v2
    [*] --> Viewing: enter /queries/:id (read-only)
    Viewing --> Editing: click [Edit]
    Editing --> PreviewLoading: change source / join / predicate (debounced) or [Preview]
    PreviewLoading --> PreviewPopulated: unsaved def valid → preview rows
    PreviewLoading --> PreviewBlocked: predicate invalid / edge stale / base unrunnable → [Save] disabled
    PreviewPopulated --> Editing: further edits
    PreviewBlocked --> Editing: fix the offending predicate / edge / base
    Editing --> Saving: click [Save] (def valid)
    Saving --> Viewing: 200 → persisted, toast, back to read-only
    Saving --> SaveRejected: 422 / 409 → inline error
    Editing --> DiscardConfirm: click [Cancel] with unsaved changes
    DiscardConfirm --> Viewing: discard → revert to saved definition
    DiscardConfirm --> Editing: keep editing
```

- **Enter Edit** — `[Edit]` flips the read-only summaries into the `JoinEditor` + reused
  predicate editors, seeded from the **saved** definition; the row body switches to a
  **preview** of the working copy.
- **Edit the source / joins** — the base `<Select>` picks the driving `sourceId` (a
  Dataset or a Query); `JoinEditor` adds a hop from any in-graph source (left-source
  `<Select>` when 2+ can branch), removes any leaf, and sets each hop's type. Editing the
  tree recomputes the effective columns, so the predicate editors re-bind; a predicate
  over a now-absent column flags invalid **in the builder**.
- **Edit predicates** — the chip + advanced editors operate over the effective columns
  (collision-qualified when joined; one dataset's columns when not), reusing the shipped
  serializers/validators verbatim.
- **Live preview** — the working-copy definition runs through the stateless
  `POST /workspaces/{id}/queries/preview` (auto-run on change, **debounced 300ms**; an
  explicit `[Preview]` flushes it), reusing the spine's engines and **persisting nothing**.
  Preview is paged (`10 / 25 / 50 / 100`).
- **Save (edit mode)** — persists the working copy via `PUT /queries/{id}` (**definition
  only** — name + source unchanged, so no `name_taken`); the server re-validates (a bad
  atom / unknown / cross-workspace / stale edge → `422`; a looping base → `409
  composition_cycle`). Success returns to Viewing.
- **Discard** — `[Cancel]` with unsaved changes confirms (the
  [crud-hygiene](../_shared/crud-hygiene.md) pattern), then reverts to the saved
  definition — no partial writes.

---

## Create mode (R77): build a new Query on a preset base

The builder also runs in **create mode** to construct a **brand-new** Query whose driving
source is preset to a saved Query you chose to build on (`sourceId = qr_…`). It is the
same `QueryBuilderPanel` + `useQueryBuilder` rendered with a **mode** flag — never a
parallel page. The entry verb **"Build on this query"** lives on the Query detail header
([saved-query.md § IA](saved-query.md#ia-and-navigation)); its route is
`/data-management/queries/new?base=qr_…` (`QueryCreatePage`), reached **only** via the verb
(no nav item, no empty source picker — the standalone "New query" entry ships with the
[canvas](canvas.md), built right: [[dont-mvp-rush-a-roadmap-home-surface]]).

How edit-only generalizes to edit + create (`useQueryBuilder` gains a mode):

| Concern | Edit mode | Create mode |
| --- | --- | --- |
| Identity | an existing `query` (`qr_…`) | **no id** — a draft until Saved |
| Baseline | `normalize(query.definition)` | the **empty definition** (`{ q: null, filters: [], advanced: [], joins: [] }`) |
| Driving source | seeded `query.sourceId`; editable | **preset** `sourceId = the source Query's qr_`; the base picker is seeded to it |
| Live preview | the composed `POST …/preview` | the **same** composed preview, keyed on the preset base |
| Name | unchanged (`PUT` is definition-only) | **captured at Save** via the reused `SaveQueryModal` |
| Save | `PUT /queries/{id}` `{ definition }` | **`POST /workspaces/{id}/queries`** `{ name, sourceId, definition }` via `useCreateQueryMutation` → navigate to the new `qr_` detail |
| Gate | `canSave = dirty && previewOk && invalidCount === 0` | `canSave = previewOk && !pending && invalidCount === 0` **+ a non-empty name** (no `dirty` baseline — a base + zero edits is a valid, if trivial, composed Query) |

The create `POST` carries **`{ name, sourceId, definition }`** — `sourceId` is the
canonical (and only) source field; there is no `datasetId` (it was dropped in migration
`0002`, see [saved-query.md § Data model](saved-query.md#data-model)). Both "Save filters
as Query" and "Build on this query" route through the **same** `SaveQueryModal` +
`useCreateQueryMutation`, so create logic is never duplicated.

### Create-mode states

```mermaid
stateDiagram-v2
    [*] --> Editing: open /queries/new?base=qr_… (base preset, empty draft)
    Editing --> PreviewLoading: add a join / predicate (debounced) or [Preview]
    PreviewLoading --> PreviewPopulated: composed draft valid → preview rows
    PreviewLoading --> BaseUnavailable: 409 (base deleted / unrunnable / composition_cycle / stale)
    PreviewPopulated --> NameCapture: click [Save]
    NameCapture --> Saving: submit (name valid)
    Saving --> NewDetail: 201 → toast + navigate to /queries/{new id}
    Saving --> NameTaken: 409 name_taken → inline field error (stay in modal)
    Saving --> SaveRejected: 422 (bad atom / unknown source) → inline error
    Editing --> Leave: [Cancel] (confirm if edited) → back to the base query
    BaseUnavailable --> Leave: open base / back
```

A create draft has no id, so a **direct** cycle is structurally impossible at create; what
the preview surfaces pre-save is the **base's own** resolve failure (deleted / unrunnable /
transitively cyclic / drifted) → the guided base-unavailable state, with `[Save]` disabled.
The server re-validates on `POST` (`422` bad atom / unknown source; `409 composition_cycle`
if a base loops) — flag-don't-crash, mirroring the edit-mode and run-time gates.

---

## Accessibility (declared so F builds it, not infers it)

- `[Edit]` / `[Save]` / `[Cancel]` / **"Build on this query"** are keyboard-reachable with
  **visible text labels** (not icon-only); the editing state is announced
  (`role="status"`); on "Build on this query", focus moves into the builder.
- The **base `<Select>`** and **`JoinEditor` `<Select>`s** (relationship, left-source,
  per-hop type) carry visible labels (label-above per AntD Data-Entry guidance); options
  name the edge / source / type in **text** (`Deals.account_id ↔ Accounts.id`, `inner`),
  never colour/glyph alone; `<OptGroup>` headings ("Datasets" / "Saved queries") stay text;
  a disabled non-leaf `[Remove]` keeps its label and exposes its reason via tooltip
  (`aria-disabled`), so the leaf rule is discoverable.
- The **predicate editors** inherit the shipped chip/advanced accessibility; column options
  read as **text** (`Deals.id` / `Accounts.id`) so duplicate names stay unique and
  screen-reader-navigable.
- The **live-preview status** ("Preview · N rows", loading, updated) is a `role="status"`
  live region; the **invalid-predicate**, **stale-edge**, and **base-unavailable** blocks
  are `<Alert role="alert">` whose reason is **text** (the offending column / base named),
  icon + text — not a colour swatch; `[Save]`-disabled state has an accessible reason.
- The **name-capture modal** reuses `SaveQueryModal`'s shipped semantics: labelled
  `<Input>`, autofocus, an accessible `name_taken` error tied to the field.
- The preview reuses `<PagedRowsView>`'s shipped table semantics; collision-qualified
  headers keep every column name unique and readable.

---

## Acceptance criteria

1. **Edit mode is a mode, not a page** — `[Edit]` on `/queries/:id` reveals the builder in
   place (the same detail shell); there is **no** new `/builder` route and **no**
   copy-pasted detail page.
2. **Source + join tree are editable in place** — the base `<Select>` sets the driving
   `sourceId` (Dataset or Query); `JoinEditor` adds a hop from any in-graph source, removes
   any leaf, and sets each hop's type; editing re-binds the predicate columns; a source
   with no eligible edge disables the add control with a guiding tooltip.
3. **Predicates compose over the effective space** — the reused chip + advanced editors
   bind to the effective columns when joined (collision-qualified) and to the single
   dataset's columns when not; atoms round-trip through the shipped serializers unchanged.
4. **Live preview runs the unsaved definition** — editing updates the previewed rows via
   `POST …/queries/preview` **without** persisting; the preview is paged and reuses
   `<PagedRowsView>`; mutating source data between two previews changes the result.
5. **Invalid edits block save, flag-don't-crash** — a predicate over an absent column, a
   stale edge, or an unrunnable base renders the in-builder state and **disables `[Save]`**;
   the server `422`s / `409`s a bad definition on save — never a saved-but-unrunnable query.
6. **Save mutates the existing Query** — `[Save]` (edit) persists via `PUT /queries/{id}`
   (definition-only); reopening shows the new definition.
7. **Create mode builds a new composed Query** — "Build on this query" opens the **same**
   builder in create mode with `sourceId` preset to the base `qr_`; the composed preview
   runs the unsaved draft; `[Save]` captures a name and `POST`s `{ name, sourceId,
   definition }` → the new `qr_` detail (no `datasetId` in the body).
8. **One create rhythm (no duplication)** — both "Save filters as Query" and "Build on
   this query" route through `SaveQueryModal` + `useCreateQueryMutation`.
9. **Reuse, not duplication** — the builder composes the shipped predicate editors, the
   relationship/base `<Select>`s, and `<PagedRowsView>`; it re-implements no engine or page.

---

## Scope boundary

### IN scope

- An **Edit mode** on `/queries/:id`: the `JoinEditor` (base source + the full `joins`
  tree: add from any source, remove any leaf, per-hop type) + the reused chip/advanced
  predicate editors bound to the effective columns; a dirty/Save/discard lifecycle via
  `PUT /queries/{id}`.
- A **Create mode** at `/queries/new?base=qr_…` (`QueryCreatePage`): no-id, **preset base**,
  the composed preview, name capture at Save (reused `SaveQueryModal`), Save = `POST`
  carrying `{ name, sourceId, definition }`.
- **Live preview** of the unsaved definition through `POST …/queries/preview` +
  `<PagedRowsView>`; in-builder invalid-predicate / stale-edge / base-unavailable blocking
  of Save (the existing gates, consumed pre-save).

### OUT of scope (deferred with named triggers)

- **The visual source-graph canvas** (a canvas view/edit mode over this builder + the
  standalone "New query" entry) → design banked, build deferred ([canvas.md](canvas.md)).
- **Renaming a Query from the builder** → the builder edits the **definition** only; a
  separate rename affordance is its own pull.
- **A `qr_` on the right of a join hop; composite keys; self-joins; cross-workspace
  joins; null-aware predicate operators** → spine-level future triggers
  ([saved-query.md § Scope](saved-query.md#scope-boundary)).
- **Workflow / complex query (YAML + polars); result materialization; Excel export;
  dashboards** → downstream value-out; preview + save stay live re-run.

### This concept explicitly does NOT cover

- The `QueryDefinition` model, the routes + error codes, and the join/composition engines —
  [saved-query.md](saved-query.md); this **edits + previews** them, it does not restate them.
- The predicate vocabulary internals — [dataset-filters.md](../datasets/dataset-filters.md)
  - [advanced-query.md](../datasets/advanced-query.md).
- The governed-edge model (declare / validate / stale) —
  [relationships.md](../workspaces/relationships.md); this consumes it via a join.

---

## Reference materials (read-only)

- [saved-query.md](saved-query.md) — the Query model, routes, engines, and gates this
  builder edits + previews.
- [query-builder.md](query-builder.md) — the domain anchor + reuse invariant + trajectory.
- [canvas.md](canvas.md) — the deferred visual editor that re-presents this builder.
- [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md) — the
  noun-vs-mode / honest-split discipline this doc applies.
</content>
