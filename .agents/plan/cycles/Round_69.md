# Round 69 (redo): Saved Query as a *mode* of the dataset surfaces

**Status**: In Progress
**Date started**: 2026-06-13
**Date completed**:

## Goal

**Pulled by ← the R69 post-mortem** (commit `9705077`) + the
[purpose.md](../../context/purpose.md) critical path
(data → relationships → dashboards). The first R69 ("Saved Query") was
**discarded** after a root-cause review: it modeled a Query as a **new
top-level noun** with parallel `QueriesPage` + `QueryDetailPage`, duplicating
the datasets list + the dataset-detail row table — when purpose.md says a Query
*"produces a (virtual) dataset."* DCFBI faithfully built the duplicated
surfaces, and the whole D→C→F→B→I chain shipped as **one seamless changeset**,
so the design-altitude error contaminated all four layers with no revert seam →
near-total discard. Nothing was committed, so discard was cheap (the one lucky
break). Salvage parked at `tmp/queries/`.

Lessons captured and now in force:
[design-gate-noun-vs-mode](../../memory/2026-06-13-design-gate-noun-vs-mode.md),
[query-is-virtual-dataset](../../memory/2026-06-13-query-is-virtual-dataset.md),
[round-bundling-revert-seams](../../memory/2026-06-13-round-bundling-revert-seams.md).
The gate-walker now binds each gate to a per-gate commit (R69 post-mortem).

**R69-redo re-does the work on the corrected footing**, and is deliberately a
**Design-only pass this gate** — it produces this round file (Plan gate) and
the design docs (Design gate), each committed at its gate, and **stops before
any code** (C/F/B/I). The build chain is sequenced by the `flow-selector` at
Design exit, in later sessions. This enacts the revert-seams lesson directly:
catch and seal the modeling at D, the cheapest place.

_Track: 1 (product feature). Pulled by ← R69 post-mortem + purpose.md critical
path. Scoped by the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
(design-only this gate; no speculative layout framework)._

## The corrected model (one paragraph)

A **Query** is a named, persisted predicate state over a single source Dataset
— a **mode of the existing dataset surfaces, not a new noun.** It keeps its own
`qr_` identity + URL (so R71 Query-as-join-input can reference it) but renders
through the **same** detail layout as a Dataset: `PageHeader` + `PageCard` +
a shared paged-rows body, each noun adding its own sections. A Query is a
distinct **archetype** from a Dataset — same readable-table-source surfaces,
but its own home + URL: a **Queries catalog** (a nav item +
`/data-management/queries` list route) and a top-level
**`/data-management/queries/:id`** detail, both rendered through the **shared**
Page-List and detail layouts (reuse, not duplication — the invariant that keeps
this clear of the discard's parallel-pages error). The predicate vocabulary,
serializers, and the live re-run path are reused verbatim; only **persistence +
identity + the Queries catalog/detail routes** are new.

## Judgment calls

### Resolved with the human (2026-06-13)

- **J-1 — Reopen model → query-mode sub-route reusing a shared detail layout.**
  Not a duplicated page (the discard's error) and not a pure URL-state bundle.
  Extract the inline paged-rows body from
  [DatasetDetailPage.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx)
  (`DataTableBody` + row-search + `<Pagination>` + loading/zero/no-match/404
  states) into a shared `<PagedRowsView>`; Dataset-detail and Query-detail both
  = `PageHeader` + `PageCard` + `<PagedRowsView>` + own sections. Query-detail
  is the **second concrete consumer** — the exact extraction trigger that
  [dataset-detail.md § Surfaces](../../design/data-management/datasets/dataset-detail.md)
  and [datasets.md](../../design/data-management/datasets/datasets.md) parked.
- **J-2 — Catalog home → an own Queries catalog** (a **Queries** nav item +
  a `/data-management/queries` list route), rendered through the **shared**
  Page-List layout with a query column config (Name / Source dataset /
  Workspace / Predicates / Saved). Reconciled with J-4: a top-level detail URL
  pairs with a top-level list home. **Not** a duplicated `QueriesPage` — it
  reuses the layout/components; the anti-duplication invariant is what keeps it
  clear of the discard's error.
- **J-3 — Standard backend data-model base.** `Query` adopts **SQLModel** as
  the forward standard model base (first entity to do so); the raw-sqlite
  datasets/workspaces stores migrate incrementally — **deferred** (no migration
  this round). Mirrors the salvaged D-1 and the Evolution Rule (don't add until
  pulled).
- **J-4 — query-detail URL shape → top-level `/data-management/queries/:id`**
  (`:id` = `^qr_[0-9a-f]{8}$`), **not** nested under `datasets/`. Rationale (the
  human's): a Query is the *same datasource kind* as a Dataset but a **different
  archetype** — it earns its own top-level namespace (own home + URL), while
  still reusing the dataset surfaces' layout/components. This also strengthens
  the R71 join-input story (a Query is referenceable as a peer table source, not
  buried under datasets).

## Plan (by gate)

1. **Plan gate** — J-1…J-4 ratified with the human (2026-06-13, recorded in
   Do); commit the ratified round file as the Plan-gate seam.
2. **Gate 2a — revise
   [dataset-detail.md](../../design/data-management/datasets/dataset-detail.md):**
   declare the extracted `<PagedRowsView>` (columns + paged rows-provider +
   header slot + the four states, inside `PageCard variant="fill"`); frame the
   standard detail layout (`PageHeader` + `PageCard` + `<PagedRowsView>`) both
   nouns instantiate; cite the two-consumer extraction trigger as satisfied;
   add the gated **`[+ Save as Query]`** header action (enabled iff
   `filters ∨ advanced ∨ q`). Keep all existing dataset behavior.
3. **Gate 2b — author
   [saved-query.md](../../design/data-management/datasets/saved-query.md)**
   (thin mode-doc, sibling under `datasets/`): concept + why-separate (contrast
   the discarded new-noun model); `Query` data model + SQLModel base; Save
   flow; query-mode detail (reused layout + read-only predicate summary +
   source link + stale/404/delete states); the Queries catalog (nav item +
   `/data-management/queries` list route, shared Page-List layout); live re-run
   execution; contract intent (the four routes — reference salvaged YAML; flag
   *separate `/rows` route vs unified table-source resolver* for the Contract
   gate); scope boundary + acceptance criteria; sibling cross-links.
4. **Gate 2c — Design-gate verification** (see Check) then **commit at the
   Design gate** and **STOP** — `flow-selector` runs at Design exit to sequence
   C/F/B/I for the next session.

## Acceptance criteria (this round = Plan + Design gates only)

- [x] **J-1…J-4 ratified** with the human (2026-06-13) and recorded in Do.
- [ ] `dataset-detail.md` declares the shared `<PagedRowsView>` + standard
      detail layout, the satisfied two-consumer extraction trigger, and the
      gated `[+ Save as Query]` action — with no regression to existing
      dataset behavior.
- [ ] `saved-query.md` exists and specifies the Query as a **distinct archetype
      that reuses the dataset surfaces** (own Queries catalog + top-level
      `/queries/:id` detail, shared layouts), the data model + SQLModel base,
      the four
      routes' intent, the stale/empty/404 states, the scope boundary, and
      acceptance criteria that each map to ≥1 future F/B/I test.
- [ ] **Noun-vs-mode check passes**: every new surface is declared as reuse of
      an existing component/layout, not a parallel page
      ([design-gate-noun-vs-mode](../../memory/2026-06-13-design-gate-noun-vs-mode.md)).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached; `gate-walker` confirms the Design exit criterion met.
- [ ] Plan gate and Design gate **committed separately** (revert seams).

## What is OUT of scope

- **Any C/F/B/I code** — contracts YAML, backend `Query` model/routes, FE
  components/hooks/routes, tests. Sequenced by `flow-selector` at Design exit,
  built in later per-gate commits.
- **Extracting layout primitives beyond `<PagedRowsView>`** — the only one this
  feature consumes. No speculative layout framework (dynamic-equilibrium brake).
- **Migrating datasets/workspaces to SQLModel** — incremental; pull when schema
  churn needs it (J-3).
- **Joins / relationships (R70), Query composition (R71), workflow (R72),
  versioning + execution logs, predicate-editing / overwrite, result
  materialization, Excel export / dashboards** — deferred with named triggers
  in `saved-query.md § Scope boundary`.

## Risks / unknowns

- **Extraction churn in `dataset-detail.md`.** Pulling `DataTableBody` into a
  shared `<PagedRowsView>` touches a load-bearing existing surface. _Mitigation:
  it is a **declaration** this gate (design only); the actual extraction is a
  later F-gate commit, independently revertable; the trigger is the repo's own
  parked two-consumer rule, not speculation._
- **Identity-vs-mode tension.** A Query needs a stable `qr_` id/URL for R71 yet
  must not become a duplicated noun. _Mitigation: own id + own top-level
  archetype URL (J-4), but the **surface** is the shared layout (J-1) — reuse,
  not duplication. Recorded so R71 inherits the seam._
- **Contract shape — `/queries/:id/rows` vs unified resolver.** Left open for
  the Contract gate; flagged in `saved-query.md`, not pre-decided here.
- **Scope creep at D.** The temptation is to design the whole Query layer
  (joins/composition). _Mitigation: single-dataset only (salvaged D-4); the
  brake + scope boundary hold the line._

## Do

### Plan-gate ratification (2026-06-13)

- **J-1 → query-mode reopen reusing a shared detail layout** (extract
  `<PagedRowsView>`; no duplicated page).
- **J-2 → own Queries catalog** (Queries nav item + `/data-management/queries`
  list route via the shared Page-List layout). Reconciled with J-4 from the
  initial "segment on Datasets" lean once the human chose a top-level detail URL.
- **J-3 → SQLModel as the standard backend model base** for `Query`;
  datasets/workspaces migration deferred.
- **J-4 → top-level `/data-management/queries/:id`** (own archetype; not nested
  under `datasets/`). Human rationale: same datasource kind, different archetype
  → own namespace; also sets up R71 Query-as-peer-table-source.
- **Invariant across all four:** reuse the dataset surfaces' layout/components,
  never duplicate them — the one thing the discarded R69 got wrong.

_Gate 2 (Design) Do-notes — per-gate commits + any mid-round deviations — fill
as the two design docs land._

## Check

_Fills at Design-gate verification: `design:lint` / `design:tokens` /
`plan:lint` / `markdown-check-link` results, the `ui-design` per-facet report,
and the `gate-walker` Design-gate verdict._

## Act

_Fills at round close: confirm the noun-vs-mode error is sealed at D, state the
lifecycle event for each doc (amended / new), and hand off to the build chain._

## Feeds into → R69 build chain (C/F/B/I) + R70 (TBD)

With the corrected design committed at the Design gate, the next step is the
`flow-selector` (DCFBI vs DFCFBI) at Design exit, then the per-gate build
commits in later sessions. Downstream, **R70 (relationships / joins)** extends
the `Query` entity beyond a single dataset, inheriting the stable `qr_` id +
the shared table-source seam this round establishes.

---

> **Plan gate ratified (2026-06-13).** J-1…J-4 resolved with the human (see
> Do). Next: commit the Plan-gate seam, then the Design pass (Gate 2a/2b) and
> Design-gate verification (Gate 2c). Check / Act fill as those land.
