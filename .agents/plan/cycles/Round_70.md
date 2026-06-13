# Round 70: Relationship governance — declare & validate joins between datasets

**Status**: Planning
**Date started**: 2026-06-13
**Date completed**:

## Goal

**Inherits from ← [Round_69](Round_69.md)** — R69 shipped the **Query** archetype
(a virtual dataset: `qr_` identity + top-level URL + live re-run) and recorded
the deferral this round picks up: _"Joins / relationships (governed
column↔column; Query×Query) → R70. Trigger: a report needs two datasets."_
([saved-query.md § Scope boundary](../../design/data-management/datasets/saved-query.md)).
R69 also banked two doctrines this round runs on from the first commit:
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
(noun-vs-mode / discovered-vs-imposed — seal the model at D, the cheapest place)
and [gate-vs-commit-conflation](../../memory/2026-06-13-gate-vs-commit-conflation.md)
(one commit per gate = the revert seam).

This round establishes **relationship governance**: a user declares that a
column in one dataset joins a column in another (e.g.
`Deals.account_id ↔ Accounts.id`), the system **validates** the pairing
(columns exist, dtypes compatible), and the declared relationship is **stored,
listed, and kept honest** against schema drift (`flag, don't reject` —
[purpose.md](../../context/purpose.md) #5). This is the third step of the
product's critical path (`data → relationships → dashboards`) and a **stated
product requirement**, not a technical extra
([purpose.md](../../context/purpose.md) #4: _"Relationships are central and not
fixed… Join paths change per report; relationship governance is a product
requirement."_).

_Track: 1 (product feature). Pulled by ← R69 deferral + [purpose.md](../../context/purpose.md)
critical path (data → **relationships** → dashboards) + success criterion
("…**govern joins**…"). Scoped by the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
(governance only this round; **no join execution** — that is R71's
Query-as-join-input pull)._

## The proposed model (one paragraph — to ratify at the Plan gate)

A **Relationship** is a **governed edge between two Datasets in the same
Workspace**: an ordered/unordered pair of columns `(left.col ↔ right.col)` with
a declared **cardinality** (1:1 / 1:many / many:many) and a **validation
status** (valid / stale). It is genuinely a **new entity** — an _edge_, not a
table-source (Datasets and Queries are the table-sources it connects) — so
unlike R69's Query it is not a "mode of an existing surface." But the
noun-vs-mode discipline still binds its **surfaces**: the declare flow is a
**modal** (reusing the Save-as-Query / rename-modal pattern), the catalog
**reuses the Page-List layout**, and validation **reuses the dtype metadata +
the per-atom checks** already shipped — never a duplicated page family, never a
re-invented predicate engine. What is genuinely new: the `relationships` table +
`rel_` identity, the declare modal, the relationships catalog, and the
compatibility/stale validation. **Producing joined rows is explicitly out** (R71).

## Judgment calls (ratified at the Plan gate — 2026-06-13)

> Per the [2026-06-13 governance amendment](../../decisions/2026-05-28-hybrid-flow-governance.md)
> and AGENTS.md ("Ask before assuming" on product IA / model), J-1 and J-2 were
> ratified with the human before the Design pass. J-3…J-5 carry the proposed
> lean (raw-SQLite base; compatibility + stale validation; ordered-pair edge),
> revisitable at the Design gate.

| #   | Question                        | Resolution                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J-1 | **Home / IA** for relationships | **Workspace-scoped section** (ratified). A Relationship is owned by the **Workspace** whose datasets it connects — the most domain-honest home (an edge is meaningless without its workspace; joins stay within a workspace). Surfaces **reuse the Page-List layout** in a workspace-scoped relationships view. **Not** a top-level catalog, **not** a dataset-detail section. |
| J-2 | **Scope** this round            | **Governance only** (ratified). Declare + validate (dtype-compatible keys) + list + stale-flag the edge. **Join _execution_ (producing joined rows) is OUT → R71** (R69's earmarked Query-as-join-input). Respects "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium); keeps the model-seal cheap and revertable.                             |
| J-3 | **Backend data-model base**     | **Raw-SQLite + Pydantic** — the _established_ standard the R69 build proved (the SQLModel guess was refuted: the backend is uniformly raw-`sqlite3`; a `relationships` table drops into `db.py`'s `_SCHEMA`). New `rel_` id pattern, mirroring `ds_` / `qr_`.                                                                                                                  |
| J-4 | **Validation rule**             | A relationship is **valid** iff both columns exist and their dtypes are **join-compatible** (same dtype, or a declared compatible pair). MVP cardinality = **declared**; sampling-based inference **deferred** (named trigger). Drift after declare (a join column removed/retyped) → **`relationship_stale`**, mirroring R69's `query_stale` (flag, don't reject).            |
| J-5 | **Direction / cardinality**     | Store the **ordered pair** `(left, right)` + a cardinality enum; conceptually undirected for governance, join direction resolved at _execution_ time (R71). Self-joins and **composite/multi-column** keys are **out** this round (named triggers).                                                                                                                            |

**Invariant across all calls (the R69 anti-duplication rule):** every new
surface is declared as **reuse** of an existing component/layout (Page-List
catalog, modal, dtype validators), never a parallel page or a re-invented engine
— the one thing the discarded first R69 got wrong
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

## Plan (by gate)

1. **Plan gate** — ratify J-1…J-5 with the human (record in Do); commit the
   ratified round file as the Plan-gate seam.
2. **Design gate** — author `relationships.md` (new sibling under
   `data-management/`): the corrected model + why-an-edge-not-a-table-source;
   the `Relationship` data model + raw-SQLite table; the declare flow (modal:
   pick left dataset/col → right dataset/col → cardinality → validate → save);
   the relationships catalog (chosen home per J-1, shared Page-List layout); the
   compatibility-validation + `relationship_stale` states; contract intent (the
   routes — flag the open shape questions for the Contract gate); scope boundary
   - acceptance criteria (each mapping to ≥1 future F/B/I test); sibling
     cross-links. Run the **noun-vs-mode model check** + **`ui-design`
     (design-spec)** + the design lints; **commit at the Design gate and STOP** —
     `flow-selector` runs at Design exit to sequence C/F/B/I for the next session
     (the proven R69-redo shape: seal the model at D, build on the human's "go
     ahead").

## Acceptance criteria (this round = Plan + Design gates only)

- [ ] **J-1…J-5 ratified** with the human and recorded in Do.
- [ ] `relationships.md` exists and specifies: the Relationship as a **governed
      edge** (new entity, reused surfaces), the data model + raw-SQLite table +
      `rel_` identity, the declare/validate flow, the catalog (chosen home),
      the `relationship_stale` + compatibility states, the routes' contract
      intent, the scope boundary, and acceptance criteria each mapping to ≥1
      future F/B/I test.
- [ ] **Noun-vs-mode check passes**: every new surface declared as reuse of an
      existing component/layout, not a parallel page
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached; `gate-walker` confirms the Design exit criterion met.
- [ ] Plan gate and Design gate **committed separately** (revert seams).

## Risks / unknowns

- **Model-altitude risk (the R69 failure mode).** Relationships are the
  product's _central_ not-fixed concept — getting the entity wrong is the
  expensive error. _Mitigation: seal the model at D (this round is Plan+Design
  only); per-gate commits; the noun-vs-mode + discovered-vs-imposed check at the
  Design gate._
- **Governance-vs-execution scope creep (J-2).** The temptation is to build the
  join engine + joined-rows view this round. _Mitigation: governance only; R71
  owns execution (R69's recorded deferral)._
- **Cross-workspace joins.** Datasets list across workspaces, but a governed
  relationship is workspace-scoped for simplicity. _Flag in `relationships.md`;
  cross-workspace is a named future trigger._
- **Contract shape.** Where the routes hang (workspace-scoped vs top-level)
  depends on J-1; the cardinality-inference endpoint (if any) is left open for
  the Contract gate, not pre-decided here.

## Do

### Plan-gate ratification (2026-06-13)

- **J-1 → Workspace-scoped section** for relationships (chosen over a top-level
  catalog and over a dataset-detail section). Rationale (the human's): an edge
  belongs to the **Workspace** whose datasets it connects; joins are
  within-workspace, so the workspace is the honest governance boundary. Surfaces
  reuse the shared Page-List layout — not a parallel page.
- **J-2 → Governance only** this round; join **execution** deferred to R71.
- **J-3 → raw-SQLite + Pydantic** as the base (the R69 build-first standard);
  `rel_` id pattern, `relationships` table in `db.py`.
- **J-4 → dtype-compatible keys; declared cardinality (inference deferred);
  `relationship_stale` on post-declare drift** (flag, don't reject).
- **J-5 → ordered `(left, right)` pair + cardinality enum**; self-joins +
  composite keys out (named triggers).
- **Invariant across all five:** reuse existing layouts/validators, never
  duplicate a page or re-invent the predicate/dtype engine — the discarded R69's
  error ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

_Next: commit the Plan-gate seam, then the Design pass (author
`relationships.md`) and Design-gate verification, committed separately._

## Check

- [ ] `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · `markdown-check-link` 0 broken
- [ ] `ui-design` (design-spec) per-facet report attached
- [ ] Noun-vs-mode check recorded (Model check in Do)
- [ ] `gate-walker` (Design gate) exit criterion + commit seam recorded
- [ ] Plan gate and Design gate committed separately

## Act

_Fills as the Plan and Design gates land._

## Feeds into → Round_71 (Query-as-join-input / join execution)

The governed `Relationship` entity (a `rel_` edge with validated, dtype-
compatible join keys) is the deliberate input for **R71**: a Query that joins
two table-sources by _consuming_ a declared relationship to produce joined rows
— the point at which R69's parked **route-vs-resolver** question (separate
`/rows` routes vs a unified table-source resolver) finally earns its answer
(a join must resolve a mixed `ds_`/`qr_` source by id). Join _execution_,
composite/multi-column keys, cross-workspace joins, and cardinality inference
are the named triggers R70 defers into R71+.
