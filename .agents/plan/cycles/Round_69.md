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

Lessons captured and now in force (committed repo doctrine):
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
(the noun-vs-mode / discovered-vs-imposed trap) +
[gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md)
(per-gate commits as the revert seam).
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
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
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

### Gate 2 — Design pass

**Docs produced:**

- Revised [dataset-detail.md](../../design/data-management/datasets/dataset-detail.md):
  declared the `<PagedRowsView>` extraction (the parked two-consumer trigger
  fired), framed the standard detail layout, added the gated
  `[+ Save as Query]` header action, amended the boundary + lifecycle notes.
- Authored [saved-query.md](../../design/data-management/datasets/saved-query.md):
  Query as a distinct archetype reusing the dataset surfaces — own Queries
  catalog + top-level `/queries/:id` detail (shared layouts), SQLModel base,
  four-route contract intent (with the route-vs-resolver question flagged for
  the Contract gate), live re-run execution, save/stale/404/delete/empty
  states, scope boundary, 11 acceptance criteria.

**Model check** (Design gate — per the
[2026-06-13 governance amendment](../../decisions/2026-05-28-hybrid-flow-governance.md#amendment-2026-06-13-r69-post-mortem)):

- **Noun-vs-mode:** _mode of the existing dataset surfaces_ — a Query reuses
  the standard detail layout + `<PagedRowsView>` and the Page-List layout; it
  adds persistence + identity + routes, never a duplicated page. (It is a
  distinct *archetype* with its own URL, but the **surface** is reuse, not a
  new page family — the discarded R69's error.)
- **Discovered-vs-imposed:** _discovered_ — the second paged-table consumer is
  a genuine, independent pull (the extraction trigger was parked in
  dataset-detail.md/datasets.md long before this round, not minted to justify
  the model); the predicate vocabulary + read path already exist and are reused
  unchanged. Kill-condition: if dashboards/joins never need a shared read
  source, `<PagedRowsView>`/`TableSource` was over-built — but R71 already pulls
  it. See [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md).

**Verification** (Design-gate gates — see Check): `design:lint` 0, `design:tokens`
0 parity, `plan:lint` 0, `markdown-check-link` 0 broken, `ui-design`
(design-spec) **PASS** (0 gaps; 1 a11y advisory deferred to the F-gate backstop).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), against the closed Design output (saved-query.md):

| Condition                            | Fired? | Justification                                                                                                  |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The save-flow and query-mode state models each declare >3 branches (modal submit → success / name-taken / 422; loading / populated / stale / not-found). |
| 2. New interaction pattern           | no     | Every surface reuses a shipped pattern — modal (rename-modal), catalog (datasets list), detail (dataset-detail), predicate chips (`ActiveFilterChips`), warning (Alert). |
| 3. High user-error risk              | no     | Save creates (reversible via delete-with-confirm); reads are non-destructive; no irreversible multi-step.       |
| 4. Contract depends on unresolved UI | no     | The four routes' shapes are determined by the journey and reuse existing `FilterPredicate` / `RowsPage` shapes; the one open question (separate `/rows` route vs unified resolver) is a backend-architecture choice, not a UI-behavior dependency. |
| 5. UX confidence below threshold     | no     | Redo direction ratified with the human (J-1…J-4); all surfaces reuse proven patterns; ui-design design-spec PASS, 0 gaps. |

Result: **Flow: DCFBI** (1 condition fired — the default, cheap lane). The
build chain (C → B → I) is sequenced in later sessions; F1/F2 are skipped on
this path.

**Design gate closed** — commit `b866a53` (the two design docs + the Model
check committed together; this is the Design revert seam). Plan gate seam:
`281657d`.

### Gate 3 — Contract (DCFBI: C)

**Route-vs-resolver decision (the parked open question) → separate
`/queries/{id}/rows` route**, mirroring `/datasets/{id}/rows`. A **unified
table-source resolver** (one route serving both `ds_…` and `qr_…`) is the
truer "Dataset ∪ Query" expression and pre-stages R71, but per
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
("cheap-to-do-later is permission to defer — don't build the abstraction on a
guess"), the separate route is the smaller, lower-risk step and doesn't
preclude the resolver. _Trigger to unify: R71 Query-as-join-input genuinely
needs to resolve a mixed table-source by id._

**Delivered:** the salvaged query contracts ported to the live tree (their
`/queries/{id}` topology already matched J-4) —
`workspace/packages/contracts/queries/{post,get,detail-get,rows-get,delete}.contract.{yaml,md}`
plus `_shared/query.yaml` (Query / QueryDefinition / FilterAtom, reusing the
rows-GET atom shape); `query_stale` added to `_shared/api-error.yaml`; the FE
wire types (`features/data-management/queries/types.ts`); MSW handlers + fixtures
(`MOCK_QUERY` / `MOCK_QUERIES` / `MOCK_STALE_QUERY_ID`; run re-uses the
`getDatasetRows` engine). Doc refs corrected (`queries.md` → `saved-query.md`);
stale D-3 judgment labels re-pointed to J-2/J-4.

**Contract gate verification:** `@mdd/contracts` OpenAPI validity **18/18**;
`builder` type-check clean; `builder` suite **121/121** (two upload-wizard cases
are pre-existing 5s-timeout flake under parallel load — pass in isolation and
at `--test-timeout=15000`).

### Gate 4 — Frontend (DCFBI: F; built against MSW, no hard gate — F1/F2 skipped)

- **`<PagedRowsView>` extracted** (commit `6770fac`) — the parked two-consumer
  trigger. **Deviation from the design's `@mdd/ui` guess → `data-management/_shared/`**:
  the primitive depends on builder-domain `@/lib/formatCell` + the dataset
  dtype types, while `@mdd/ui` is dependency-free; the lowest common ancestor of
  its two consumers is `data-management/_shared/`. A build-first boundary
  correction ([2026-05-22-ui-boundary-build-first](../../memory/2026-05-22-ui-boundary-build-first.md)).
- **Queries feature built**: `queriesApi` (5 routes) + hooks (`useQueriesQuery`
  / `useQueryQuery` / `useQueryRowsQuery` / `useCreateQueryMutation` /
  `useDeleteQueryMutation`); `SaveQueryModal` + the gated `[+ Save as Query]`
  header action on the dataset detail page; `QueriesPage` (own catalog, shared
  Page-List layout, workspace filter, empty state); `QueryDetailPage` (query
  mode reusing `<PagedRowsView>` + read-only predicate summary + stale / 404 /
  delete states); nav + routes + `queries.*` i18n (en + vi).
- **Config (centralized, FE+BE)**: added the `qr_` id pattern, the `query_stale`
  error code, and `query_max` to `values.yaml` + both `constants` templates;
  `ApiError`/`isApiError` widened for `query_stale`.
- **Verification**: `builder` type-check clean; suite **127/127** (the 6 new
  `queries.test.tsx` cases include a full **save → navigate → reopen → run**
  round-trip + the stale state).

### Gate 5 — Backend (DCFBI: B)

**J-3 build-time deviation → raw-SQLite + Pydantic, NOT SQLModel.** The plan
ratified SQLModel as the "standard backend model base," but the build revealed
the backend has **zero SQLModel** — it is uniformly raw-`sqlite3` + Pydantic
response models, and the `queries` table drops cleanly into the existing
`db.py` `_SCHEMA`. Adopting SQLModel for one entity would add a dependency + a
second persistence style for **no real pull** — exactly what the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
forbids, and the kind of premature machinery
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
warns against. So the **established standard (raw-SQLite + Pydantic) IS the
standard base**; `queries` follows it. A build-first correction of a ratified
decision — flagged here for review at this gate's commit (the seam).

**Delivered**: `queries` table in `db.py` (FK CASCADE on workspace + dataset;
inline unique index); `Query` / `QueryDefinition` / `FilterAtom` /
`CreateQueryBody` / `ApiErrorQueryStale` Pydantic models; `routers/queries.py`
(5 routes) wired into `main.py`; the run path re-validates the saved definition
against current columns via the **reused** `_build_aq_atom` (new
`build_definition_predicates` helper in `ingest/filters.py`) and delegates to
`query_dataset_rows` — a 422-on-a-drifted-atom maps to **409 query_stale**.
Validate-on-save (422) blocks unsavable definitions; per-workspace name
uniqueness → 409; unknown/cross-workspace dataset → 422.

**Backend gate verification**: full backend pytest **146/146** (11 new
`test_queries.py`: create / list / get / run-live / name-taken / unknown-dataset
/ invalid-def / **stale→409** / delete / **dataset-delete cascade**), each
happy/error response `validate_response`-checked against the queries contracts;
`test_generated_constants` updated for the `query` id-pattern / `query_stale` /
`query_max`.

## Check

- [x] **`design:lint`** — 0 errors across the new + edited docs (saved-query.md,
      dataset-detail.md).
- [x] **`design:tokens`** — 0 parity errors (no new token; identifiers reused).
- [x] **`plan:lint`** — Round_69.md 0 errors (structure + cross-links).
- [x] **`markdown-check-link`** — 0 broken links across the three touched files
      (memory links re-pointed to the committed repo doctrine files).
- [x] **`ui-design` (design-spec)** on saved-query.md — **PASS**, 0 facet gaps;
      one Accessibility advisory (explicit aria / keyboard for the Save action)
      deferred to the F1/F2 fidelity backstop.
- [x] **Noun-vs-mode check** — every new surface declared as reuse of an
      existing component/layout, not a parallel page (Model check in Do).
- [x] **`gate-walker` (Design gate)** — exit criterion (journeys + acceptance
      in the artifact) + commit seam + model check all recorded (verdict in Act).
- [x] **Per-gate commits** — Plan gate (`281657d`) and Design gate committed
      separately (revert seams).

## Act

**Outcome — the noun-vs-mode error is sealed at the Design gate, the cheapest
place.** The corrected model is committed as a design artifact (a real revert
seam) before any code: a Query is a distinct **archetype** that **reuses** the
dataset surfaces (standard detail layout + the extracted `<PagedRowsView>` + the
Page-List layout), not a duplicated noun. The two compounding R69 failure modes
are both countered — the model error caught at D
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)),
and per-gate commits restore the revert seam
([gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md)).

**Lifecycle.**

- [dataset-detail.md](../../design/data-management/datasets/dataset-detail.md) —
  **amended in place** (PagedRowsView extraction declared; `[+ Save as Query]`
  action added). No change to its states or data contract.
- [saved-query.md](../../design/data-management/datasets/saved-query.md) — **new**
  doc; **supersedes** the discarded new-noun `queries.md` (never committed).

**Gate-walker (Design) verdict:** _recorded below the commit seam_ — Design gate
**closed** (exit criterion + commit seam + model check all present).

**Hand-off.** Flow selected = **DCFBI**. The build chain (Contract → Backend →
Integration) is sequenced in later sessions, each its own per-gate commit. The
open route-vs-resolver question is carried to the Contract gate.

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
