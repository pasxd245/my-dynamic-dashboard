# Round 70: The Query domain comes of age — `queries/` graduation + relationship governance

**Status**: Complete
**Date started**: 2026-06-13
**Date completed**: 2026-06-13

## Goal

**Inherits from ← [Round_69](Round_69.md)** — R69 shipped the **Query** archetype
as the thinnest slice (a virtual dataset: `qr_` identity + own URL + catalog +
live re-run), but deliberately parked its design doc under `datasets/` as "a
mode of the dataset surfaces" — a **brake**, not a permanent truth. R69 recorded
the deferral this round picks up: _"Joins / relationships (governed
column↔column) → R70. Trigger: a report needs two datasets."_
([saved-query.md § Scope boundary](../../design/data-management/queries/queries.md)),
and noted saved-query.md would be _"extended by R70."_ R69 also banked two
doctrines this round runs on from the first commit:
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
(noun-vs-mode / discovered-vs-imposed — seal the model at D) and
[gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md)
(one commit per gate = the revert seam).

R70 is the inflection point where the **Query Builder** becomes the product's
critical, central concept — so two things happen, both **design-only** (seal at
the Design gate; build later):

1. **The Query concept graduates to its own `data-management/queries/` domain.**
   The complexity is now genuinely _pulled_ (Query Builder + joins + composition
   R71 + workflow R72), so a first-class domain home is discovered, not
   speculative. `saved-query.md` relocates from `datasets/` to `queries/`;
   **"Save as Query" becomes an action/verb** on the dataset surface (the
   noun/verb split the repo already runs for [datasets.md](../../design/data-management/datasets/datasets.md)
   noun ↔ [upload.md](../../design/data-management/datasets/upload.md) verb); a
   new `query-builder.md` overview anchors the domain and frames its trajectory.
   **The anti-duplication invariant is unchanged** — `queries/` surfaces still
   _reuse_ `<PagedRowsView>` + the Page-List layout, never parallel pages. (Doc
   home and UI-duplication are independent axes; only the latter was R69's sin.)
2. **Relationship governance is sealed as the concrete next slice.** A user
   declares that a column in one dataset joins a column in another (e.g.
   `Deals.account_id ↔ Accounts.id`), the system **validates** the pairing
   (columns exist, dtypes compatible), and the declared edge is **stored,
   listed, and kept honest** against schema drift (`flag, don't reject` —
   [purpose.md](../../context/purpose.md) #5). This is the third step of the
   critical path (`data → relationships → dashboards`) and a **stated product
   requirement** ([purpose.md](../../context/purpose.md) #4). Join _execution_
   (a query consuming a relationship to produce joined rows) is **R71**.

_Track: 1 (product feature). Pulled by ← R69 deferral + [purpose.md](../../context/purpose.md)
critical path (data → **relationships** → dashboards) + success criterion
("…**govern joins**…"). Scoped by the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
(**governance only — no join execution**; **no interactive query-construction
surface** — both are R71's pull). Opened as a Plan + Design pass (seal the model
at D); **on the human's "go ahead" continued through the full DCFBI build chain**
in the same round, each gate its own commit seam (the R69-redo shape)._

## The model (judgment calls ratified at the Plan gate — 2026-06-13)

A **Relationship** is a **governed edge between two Datasets in the same
Workspace**: a column pair `(left.col ↔ right.col)` with a declared
**cardinality** (1:1 / 1:many / many:many) and a **validation status** (valid /
stale). It is a genuinely **new entity** — an _edge_, not a table-source
(Datasets and Queries are the table-sources it connects) — and its **home is the
Workspace** that owns the datasets it links (J-1). The **Query Builder** is its
_consumer_ (R71), not its home — so J-1 (workspace-scoped governance) and the
`queries/` graduation are complementary, not in tension. The noun-vs-mode
discipline binds the **surfaces**: declare = a **modal**, the catalog **reuses
the Page-List layout**, validation **reuses the dataset dtype metadata** — never
a duplicated page, never a re-invented predicate/dtype engine.

| #   | Question                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J-1 | **Home / IA** for relationships | **Workspace-scoped section** (ratified). A Relationship is owned by the **Workspace** whose datasets it connects — the most domain-honest home; joins stay within a workspace. There is no workspace _detail_ route today (only card-grid lists), so this introduces a thin workspace-scoped sub-route **`/data-management/workspaces/:id/relationships`** reached from the workspace card. **Not** a top-level catalog, **not** a dataset-detail section.               |
| J-2 | **Scope** this round            | **Governance only** (ratified). Declare + validate (dtype-compatible keys) + list + stale-flag the edge. **Join _execution_ (producing joined rows) is OUT → R71** (R69's earmarked Query-as-join-input). Respects "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium).                                                                                                                                                                  |
| J-3 | **Backend data-model base**     | **Raw-SQLite + Pydantic** — the _established_ standard the R69 build proved (the SQLModel guess was refuted; a `relationships` table drops into `db.py`'s `_SCHEMA`). New **`rel_`** id pattern + **`relationship_stale`** error code + `relationship_max` length, mirroring R69's centralized `values.yaml` → generated-constants path.                                                                                                                                 |
| J-4 | **Validation rule**             | A relationship is **valid** iff both columns exist and their dtypes are **join-compatible**: same dtype, with `integer`/`float` cross-compatible (numeric); all other pairs require exact match (the closed dtype enum `string` / `integer` / `float` / `boolean` / `date` / `datetime`). MVP cardinality = **declared**; sampling-based inference **deferred**. Post-declare drift (a join column removed/retyped) → **`relationship_stale`**, mirroring `query_stale`. |
| J-5 | **Direction / cardinality**     | Store the **ordered pair** `(left_dataset, left_col, right_dataset, right_col)` + a cardinality enum; conceptually undirected for governance, join direction resolved at _execution_ time (R71). **No user-supplied name** — a derived label (`left.col ↔ right.col`); uniqueness on the column-pair tuple within the workspace. Self-joins and **composite/multi-column** keys are **out** (named triggers).                                                            |
| J-6 | **Query domain graduation**     | **Graduate `queries/`** (ratified — the "Query Builder" reframing). `saved-query.md` relocates `datasets/` → `queries/` (refactored: Query = noun in `queries/`, "Save as Query" = action on `dataset-detail.md`); new `query-builder.md` overview anchors the domain + trajectory. Anti-duplication invariant preserved. Reconciled with J-1 (relationship home = workspace; Query Builder = consumer).                                                                 |

**Invariant across all calls (the R69 anti-duplication rule):** every new or
moved surface is declared as **reuse** of an existing component/layout, never a
parallel page or a re-invented engine
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

## Plan (by gate)

1. **Plan gate** — ratify J-1…J-6 with the human (recorded in Do); commit the
   ratified round file as the Plan-gate seam. _(Initial Plan committed `7092b7c`;
   this amended Plan adds the J-6 `queries/` graduation after the Query-Builder
   reframing — re-committed as the corrected Plan seam.)_
2. **Design gate — Seam A (`queries/` graduation, a refactor):** `git mv`
   `saved-query.md` → `data-management/queries/`; fix its internal sibling links
   (`→ ../datasets/…`); reframe its header (domain = `queries/`; Query = the noun;
   "Save as Query" = an action documented on `dataset-detail.md`). Author
   `queries/query-builder.md` (domain overview: Query as the central
   construction concept; the trajectory single-source → joins → composition →
   workflow; links to `saved-query.md` as the first mode + `relationships.md` as
   the join input). Refactor inbound links in `dataset-detail.md` + `datasets.md`
   (action framing + re-pointed paths); re-point Round_69's 15 unanchored
   `saved-query.md` paths (mechanical relocation — no history change; documented
   in Do). Commit as the graduation seam.
3. **Design gate — Seam B (relationship governance, the feature):** author
   `data-management/workspaces/relationships.md` — the corrected model
   (edge, not table-source); the `Relationship` data model + raw-SQLite
   `relationships` table + `rel_` identity + the dtype-compatibility rule; the
   declare flow (modal: left dataset/col → right dataset/col → cardinality →
   validate → save); the workspace-scoped relationships view (`/workspaces/:id/relationships`,
   shared Page-List layout); the `relationship_stale` + compatibility states;
   contract intent (routes — `rel_`/`relationship_stale` additions flagged for
   the Contract gate); scope boundary + acceptance criteria (each → ≥1 future
   F/B/I test). Cross-link to `query-builder.md` (the R71 consumer). Commit as
   the relationships-design seam.
4. **Design-gate verification** — noun-vs-mode model check + `ui-design`
   (design-spec) + `design:lint` / `design:tokens` / `plan:lint` /
   `markdown-check-link`; `gate-walker` confirms the Design exit criterion; run
   `flow-selector` at Design exit to sequence C/B/I for the next session, and
   **STOP** (the proven R69-redo shape: seal the model at D, build on the
   human's "go ahead").

## Acceptance criteria (this round = Plan + Design gates only)

- [x] **J-1…J-6 ratified** with the human and recorded in Do.
- [x] **`queries/` domain exists**: `saved-query.md` relocated + refactored
      (Query = noun in `queries/`; "Save as Query" = an action on
      `dataset-detail.md`); `query-builder.md` overview authored; all inbound
      links (active docs + the locked Round_69's paths) resolve.
- [x] `relationships.md` exists and specifies: the Relationship as a **governed
      edge** (new entity, reused surfaces), the data model + raw-SQLite table +
      `rel_` identity + the dtype-compatibility rule, the declare/validate flow,
      the workspace-scoped view (chosen home), the `status: valid|stale` +
      compatibility states, the routes' contract intent, the scope boundary, and
      acceptance criteria each mapping to ≥1 future F/B/I test.
- [x] **Noun-vs-mode check passes**: every new/moved surface declared as reuse
      of an existing component/layout, not a parallel page
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
- [x] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached; `gate-walker` confirms the Design exit criterion met.
- [x] Plan gate and the two Design seams **committed separately** (revert seams).

## Risks / unknowns

- **Model-altitude risk (the R69 failure mode).** Relationships are the
  product's _central_ not-fixed concept; the Query Builder is its critical
  surface. Getting either entity wrong is the expensive error. _Mitigation: seal
  the model at D (design-only); per-gate commits; the noun-vs-mode +
  discovered-vs-imposed check at the Design gate._
- **Graduation churn touches a locked round.** Moving `saved-query.md` breaks
  Round*69's 15 (unanchored) links. \_Mitigation: re-point the paths as mechanical
  relocation maintenance (the same artifact, new home) — Round_69's narrative /
  decisions / dates are untouched; documented in Do. A tombstone stub was
  rejected (it would fail `design:lint`'s 5-section rule).*
- **Workspace detail surface.** J-1 introduces the first workspace-scoped
  sub-route (`/workspaces/:id/relationships`); there's no workspace detail page
  today. _Mitigation: a thin relationships-only sub-route reached from the
  workspace card, not a full workspace detail page (brake)._
- **Scope creep into the Query Builder surface.** The reframing tempts designing
  the interactive construction UI now. _Mitigation: R70 graduates the domain +
  ships an overview doc + relationship governance only; the construction surface
  and join execution are R71._
- **Contract shape.** Relationship routes hang under `/workspaces/{id}/relationships`
  (J-1); no `/rows` route this round (governance only). The unified
  table-source resolver stays R71's question.

## Do

### Plan-gate ratification (2026-06-13)

- **J-1 → Workspace-scoped section** for relationships (chosen over a top-level
  catalog and a dataset-detail section). An edge belongs to the **Workspace**
  whose datasets it connects; introduces a thin `/workspaces/:id/relationships`
  sub-route (no workspace detail page exists yet).
- **J-2 → Governance only**; join **execution** deferred to R71.
- **J-3 → raw-SQLite + Pydantic** base; `rel_` id + `relationship_stale` +
  `relationship_max` via the centralized `values.yaml` → generated constants.
- **J-4 → dtype-compatible keys** (same dtype; `integer`/`float` numeric
  cross-compatible); **declared cardinality** (inference deferred);
  **`relationship_stale`** on post-declare drift (flag, don't reject).
- **J-5 → ordered column-pair edge + cardinality enum**; derived label (no user
  name); self-joins + composite keys out (named triggers).
- **J-6 → `queries/` domain graduation** (the "Query Builder" reframing — raised
  by the human mid-Plan): the Query concept is now genuinely pulled into its own
  first-class domain; `saved-query.md` relocates, "Save as Query" becomes an
  action, `query-builder.md` anchors the domain. Doc-home and UI-duplication are
  independent axes — the graduation preserves the anti-duplication invariant
  (reuse `<PagedRowsView>` + Page-List), so it does **not** re-commit the
  discarded R69's parallel-pages error.
- **Invariant across all six:** reuse existing layouts/validators, never
  duplicate a page or re-invent the predicate/dtype engine
  ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

### Gate 2 — Design pass

**Seam A — `queries/` graduation (refactor):** `git mv` `saved-query.md`
`datasets/` → `queries/`; reframed its header (domain = `queries/`; Query = the
noun; "Save as Query" = an action on [dataset-detail.md](../../design/data-management/datasets/dataset-detail.md);
preserved the anti-duplication invariant + the independent-axes note). Authored
[query-builder.md](../../design/data-management/queries/queries.md) — the
domain anchor (the reuse invariant table, the surface map, the
single-source→joins→composition→workflow trajectory, the noun/verb framing).
Relocated all inbound links via `markdown-check-link --fix` (37 auto-fixed,
unique-basename): `dataset-detail.md` (×5), the 5 `contracts/queries/*.md`,
**Round_69's 15 unanchored paths** (mechanical relocation — no history change),

- `saved-query.md`'s own outbound sibling links (→ `../datasets/`).

**Seam B — relationship governance (feature):** authored
[relationships.md](../../design/data-management/workspaces/relationships.md) —
the governed-edge model (edge, not table-source), the `Relationship` data model

- raw-SQLite `relationships` table + `rel_` identity + the dtype-compatibility
  rule, the declare/validate flow (modal + live compatibility), the
  workspace-scoped view (`/workspaces/:id/relationships`, shared Page-List), the
  computed `status: valid|stale` (stale = a non-erroring flag; the `409
relationship_stale` deferred to R71 execution — a design-gate refinement of J-4),
  the four routes' contract intent, an explicit Accessibility declaration
  (`aria-live` compatibility line + icon-not-colour status), 10 acceptance criteria.

**Model check** (Design gate — per the
[2026-06-13 governance amendment](../../decisions/2026-05-28-hybrid-flow-governance.md)):

- **Noun-vs-mode:** a Relationship is a genuinely **new entity** (an _edge_,
  structurally distinct from a table-source) — but its **surfaces are reuse**
  (modal + Page-List + `<DeleteConfirmModal>` + the dataset dtype metadata),
  never a parallel page. The `queries/` graduation is a **doc-home** move on an
  axis independent of UI-duplication; it preserves the reuse invariant. So both
  R70 surfaces clear the noun-vs-mode check.
- **Discovered-vs-imposed:** _discovered_ — joins were a parked R69 deferral
  pulled by a real product requirement (purpose #4); the Query-domain graduation
  was pulled by the human's Query-Builder reframing, not minted to justify a
  folder. Kill-condition: if no report ever needs two datasets, the edge was
  over-built — but the critical path pulls it next (R71).

**Verification** (Design-gate gates — see Check): `design:lint` 0 (12 docs),
`design:tokens` 0 (9 token maps), `plan:lint` 0, `markdown-check-link` 0 broken
(169 files), `markdownlint` 0; `ui-design` (design-spec) on `relationships.md`
**PASS** (0 facet gaps — the one Accessibility gap caught preventively and
remediated in-spec).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), against the closed design (relationships.md):

| Condition                            | Fired? | Justification                                                                                                                                                                                                |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. >3 independent states/branches    | yes    | The declare-flow state model has >3 branches (Empty → Picking → Incompatible/Compatible → Saving → Saved/Duplicate/Invalid) plus the list model.                                                             |
| 2. New interaction pattern           | no     | Every surface reuses a shipped pattern — modal, Page-List catalog, `<Select>`/`<Segmented>`, `<DeleteConfirmModal>`, `<Alert>`/`<Tag>`; the compatibility line is a micro-affordance on existing primitives. |
| 3. High user-error risk              | no     | Declare creates a reversible edge (delete-with-confirm); reads non-destructive; server re-validation; no irreversible multi-step.                                                                            |
| 4. Contract depends on unresolved UI | no     | Routes follow the journey and reuse existing shapes; the one open question (specific 422 code vs generic) is a backend choice, not a UI dependency.                                                          |
| 5. UX confidence below threshold     | no     | J-1…J-6 ratified with the human; all surfaces reuse proven patterns; ui-design design-spec PASS, 0 gaps.                                                                                                     |

Result: **Flow: DCFBI** (1 condition fired — the default, cheap lane; F1/F2
skipped on this path). The build chain (C → B → I) is sequenced in later
sessions on the human's go-ahead.

**Design gate closed.** Gate commit seams (gate = commit; 2026-06-13
amendment): Plan `7092b7c` → amended Plan `746c411` → Design **Seam A**
(`queries/` graduation) `3aa0c5d` → Design **Seam B** (relationships.md + this
round record) `6f3c68a`. Each gate is independently revertable.

### Gate 3–6 — Build chain (DCFBI, on the human's "go ahead")

On the human's go-ahead the design seal was built out through the full DCFBI
chain (the proven R69-redo shape), each gate its own commit seam:

- **Contract (C)** `ff352af` — `contracts/relationships/{post,get,detail-get,delete}`
  - `_shared/relationship.yaml`; `relationship_exists` added to the api-error
    enum; `rel_` id + `relationship_exists` centralized in `values.yaml` → both
    generated-constants templates; FE `relationships/types.ts` + `ApiError` union;
    MSW handlers + fixtures (a second dataset to relate + a stale edge).
    **OpenAPI validity 22/22**; builder type-check clean; suite **127/127**.
- **Frontend (F)** `408bf31` — `relationshipsApi` + hooks; `DeclareRelationshipModal`
  (left/right dataset+column selects, cardinality, **live aria-live
  dtype-compatibility** line gating Declare); `WorkspaceRelationshipsPage`
  (workspace-scoped view at `/workspaces/:id/relationships`, **reusing** the
  Page-List layout + `<DeleteConfirmModal>`); workspace-card entry; route; i18n
  en+vi. Suite **132/132** (5 new cases). _F1/F2 skipped on the DCFBI path._
- **Backend (B)** `42c8907` — raw-SQLite `relationships` table (FK CASCADE ×3,
  unique ordered-pair index); `Relationship` / `CreateRelationshipBody` Pydantic
  models; `routers/relationships.py` (declare/list/get/delete) with
  dtype-compat validation (integer/float numeric pair), self-join + cross-workspace
  → 422, duplicate → 409, **computed `valid|stale` status** on read. pytest
  **159/159** (13 new), each response `validate_response`-checked.
- **Integration (I)** — dual contract conformance (MSW `withContractValidation`
  - BE `validate_response` against one `relationships/*` YAML, both green) **plus**
    a **live cross-process round-trip** against the real backend (uvicorn :8099,
    isolated data dir): declare (201, `rel_` id, status valid) → list (1, valid)
    → get (200) → duplicate (**409 relationship_exists**) → incompatible (**422**)
    → delete (204) → get-after (404). The real BE produces byte-shaped responses
    identical to the MSW mocks the FE was built against.

**Two build-time refinements** (flagged at their gate commits): (1) `relationship_stale`
is surfaced as a non-erroring computed `status` for governance reads — the `409`
variant is deferred to R71 join execution (its first consumer); (2) the
J-3-planned `relationship_max` name length was dropped — J-5 ratified **no
user-supplied name** (derived `left.col ↔ right.col` label), so there is nothing
to bound.

**Build gate commit seams:** Contract `ff352af` · Frontend `408bf31` · Backend
`42c8907` · Integration (this commit). Seven independently-revertable seams
across the round (Plan ×2, Design ×2, C, F, B) + this Integration commit.

## Check

- [x] `design:lint` 0 (12 docs) · `design:tokens` 0 (9 maps) · `plan:lint` 0 ·
      `markdown-check-link` 0 broken (169 files) · `markdownlint` 0
- [x] `ui-design` (design-spec) per-facet report attached — **PASS**, 0 gaps
      (Accessibility gap caught + remediated in-spec)
- [x] Noun-vs-mode check recorded (Model check in Do) — edge = new entity, reuse
      surfaces; graduation = independent doc-home axis
- [x] `queries/` graduation: relocated doc + overview + all inbound links resolve
- [x] `gate-walker` (Design gate) exit criterion + commit seams recorded (verdict in Act)
- [x] Plan gate + two Design seams committed separately
- [x] **Contract** — `@mdd/contracts` OpenAPI validity **22/22** (4 relationship
      routes + `relationship.yaml` + `relationship_exists` envelope)
- [x] **Frontend** — builder type-check clean; suite **132/132** (5 new
      relationships cases: list valid+stale, empty, declare round-trip,
      incompatible gating, delete)
- [x] **Backend** — pytest **159/159** (13 new, contract-validated, incl.
      numeric-pair compat, self-join/cross-workspace 422, stale, cascade)
- [x] **Integration** — dual contract conformance (MSW + real BE) + a live
      cross-process round-trip (declare→list→get→duplicate→incompatible→delete) green
- [x] Each gate committed separately (Plan ×2 · Design ×2 · C · F · B · I)

## Act

**Outcome — the Query domain came of age and the relationship model is sealed at
the Design gate, before any code.** Two design artifacts (real revert seams)
landed: (1) `queries/` graduated to a first-class domain — `saved-query.md`
relocated, "Save as Query" reframed as an action, and
[query-builder.md](../../design/data-management/queries/queries.md) authored
as the domain anchor + trajectory; (2)
[relationships.md](../../design/data-management/workspaces/relationships.md)
sealed the **governed-edge** model — workspace-scoped, governance-only,
raw-SQLite, dtype-validated, stale-flagged.

**The two R69 doctrines held.** The model-altitude error was pre-empted at D
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)):
the noun-vs-mode check distinguished a Relationship (a genuinely new _edge_
entity) from its surfaces (all reuse), and surfaced the key insight that
**doc-home and UI-duplication are independent axes** — so graduating `queries/`
does not re-commit the discarded R69's parallel-pages sin. Per-gate commits gave
independently-revertable seams (Plan, then Seam A, then Seam B —
[gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md)).

**A mid-Plan reframing, caught at the cheapest place.** The human's "Query
Builder" observation re-shaped R70 from "relationships, standalone" to "the Query
domain comes of age" while still at the Plan altitude — the revert-seams
discipline ([gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md))
in action (a re-frame before any code costs an amended Plan commit, not a discard).

**One design-gate refinement of a ratified judgment:** J-4 named
`relationship_stale`; the design realized stale is best a **non-erroring
`status` field** on governance reads (flag-don't-reject), reserving the `409
relationship_stale` for R71's join execution (its first real consumer) — recorded
in `relationships.md § Data contract`.

**`flow-selector`: DCFBI** (1 of 5 fired; F1/F2 skipped).

**Build outcome — the governed-edge model shipped end to end.** On the human's
go-ahead the design seal built cleanly through C → F → B → I (each its own
commit): the relationship-governance feature is live — declare a dtype-validated
edge between two of a workspace's datasets, list it with a computed `valid|stale`
status, delete it (cascading on dataset/workspace delete). The FE **reuses** the
Page-List layout + `<DeleteConfirmModal>` (no parallel page — the noun-vs-mode
invariant held through the build), and the real backend's responses are
byte-identical to the MSW mocks (one `relationships/*` contract, dual-conformed).
Two small build-time refinements (stale-as-status not error; no `relationship_max`
since there's no name) are recorded at their gate commits — the build-first
discipline ([ui-boundary-build-first](../../memory/2026-05-22-ui-boundary-build-first.md)):
the design's altitude was right, the build corrected the details.

**Learnings**:

- **A concept's design-doc _home_ can graduate independently of its _surfaces_.**
  R69 deliberately under-homed the Query (doc under `datasets/`) as a brake;
  R70's real pull let it graduate to `queries/` **without** touching the
  anti-duplication invariant — because doc-home and UI-duplication are different
  axes. The R69 lesson ("reuse, don't duplicate") is about components, not
  folders. _(Candidate memory — see Promotions.)_

**Promotions**: none this round. The candidate learning — "doc-home vs
UI-duplication are independent axes" (a refinement of
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md) and
[ui-boundary-build-first](../../memory/2026-05-22-ui-boundary-build-first.md)) —
is **deferred**: it has fired once (R70). Promote when a third round re-applies
it, per the don't-add-until-pulled rule.

**Follow-ups (not promotions, just notes):**

- **Stale truth-check on `saved-query.md`**: its Data-model section still says
  "`queries` table + SQLModel", but R69's build shipped raw-SQLite (the J-3
  build-first correction). Not introduced by R70; reconcile when the queries
  backend doc is next touched (purpose #7 spec-vs-impl truth check).
- **Build chain (C → F → B → I)** for relationship governance — **done** this
  round on the go-ahead (commits `ff352af` · `408bf31` · `42c8907` · Integration).
- **A11y fidelity backstop** for the declare modal (the design-spec aria-live
  declaration) — verify in a real browser if pulled; the build carried the
  `aria-live` + icon-not-colour status, unverified live.

## Prune check

No rule/gate/doc-section retired this round. The gates earned their place: the
noun-vs-mode model check pre-empted the exact R69 failure mode again, and
`ui-design` (design-spec) caught a real Accessibility gap preventively. Nothing
to cut.

## Feeds into → Round_71 (Query Builder: join execution / Query-as-join-input)

R70 hands forward two things R71 consumes: (1) the `queries/` domain + the
`query-builder.md` overview that frames the construction surface R71 designs;
(2) the governed `Relationship` entity (a `rel_` edge with validated,
dtype-compatible join keys) that R71's join _execution_ resolves to produce
joined rows — the point at which R69's parked **route-vs-resolver** question
(separate `/rows` routes vs a unified table-source resolver) finally earns its
answer. Join execution, the interactive query-construction UI, composite/
multi-column keys, cross-workspace joins, and cardinality inference are the named
triggers R70 defers into R71+.

**Watch-item — R70 is conformant, not yet truth-validated (human, 2026-06-13).**
The relationship model "seems promising," but its green suites prove
_conformance_, never _truth_ — and the truth is tested only when **R71 actually
consumes a `Relationship` to join** (the second, independent consumer). Until
then, hold the edge model as a **hypothesis**, not a settled fact. The named
risk: R70 could **bias R71** — a live, green relationship entity is exactly the
_self-manufactured evidence_ (mechanism #1) that would make "join = the obvious
next noun on this exact edge shape" feel pre-decided. **Kill-condition:** if R71
finds the governed edge doesn't carry what a real join needs (e.g. the edge
shape, cardinality semantics, or the workspace-scoping turn out wrong under a
real join), that is the model failing its truth-test — treat it as a model
revision, not an R71 implementation detail. R71 is where the half (if any) gets
split. See [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
(mechanism 3: test-green ≠ model-true).
