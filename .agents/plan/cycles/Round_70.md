# Round 70: The Query domain comes of age — `queries/` graduation + relationship governance

**Status**: Planning
**Date started**: 2026-06-13
**Date completed**:

## Goal

**Inherits from ← [Round_69](Round_69.md)** — R69 shipped the **Query** archetype
as the thinnest slice (a virtual dataset: `qr_` identity + own URL + catalog +
live re-run), but deliberately parked its design doc under `datasets/` as "a
mode of the dataset surfaces" — a **brake**, not a permanent truth. R69 recorded
the deferral this round picks up: _"Joins / relationships (governed
column↔column) → R70. Trigger: a report needs two datasets."_
([saved-query.md § Scope boundary](../../design/data-management/queries/saved-query.md)),
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
(design-only this round; **governance only — no join execution**; **no
interactive query-construction surface** — both are R71's pull)._

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

- [ ] **J-1…J-6 ratified** with the human and recorded in Do.
- [ ] **`queries/` domain exists**: `saved-query.md` relocated + refactored
      (Query = noun in `queries/`; "Save as Query" = an action on
      `dataset-detail.md`); `query-builder.md` overview authored; all inbound
      links (active docs + the locked Round_69's paths) resolve.
- [ ] `relationships.md` exists and specifies: the Relationship as a **governed
      edge** (new entity, reused surfaces), the data model + raw-SQLite table +
      `rel_` identity + the dtype-compatibility rule, the declare/validate flow,
      the workspace-scoped view (chosen home), the `relationship_stale` +
      compatibility states, the routes' contract intent, the scope boundary, and
      acceptance criteria each mapping to ≥1 future F/B/I test.
- [ ] **Noun-vs-mode check passes**: every new/moved surface declared as reuse
      of an existing component/layout, not a parallel page
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached; `gate-walker` confirms the Design exit criterion met.
- [ ] Plan gate and the two Design seams **committed separately** (revert seams).

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

_Next: the two Design seams (A: `queries/` graduation; B: `relationships.md`),
then Design-gate verification + `flow-selector`, committed separately._

## Check

- [ ] `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · `markdown-check-link` 0 broken
- [ ] `ui-design` (design-spec) per-facet report attached
- [ ] Noun-vs-mode check recorded (Model check in Do)
- [ ] `queries/` graduation: relocated doc + overview + all inbound links resolve
- [ ] `gate-walker` (Design gate) exit criterion + commit seams recorded
- [ ] Plan gate + two Design seams committed separately

## Act

_Fills as the Plan and Design gates land._

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
