# Round 71: Join execution — a Query consumes a Relationship (the truth-test of R70's edge)

**Status**: Planning
**Date started**: 2026-06-13
**Date completed**:

## Goal

**Inherits from ← [Round_70](Round_70.md)** — R70 sealed and shipped the
**governed `Relationship` edge** (a `rel_` identity, dtype-validated join keys,
workspace-scoped, `valid|stale` status) and graduated the
[`queries/` domain](../../design/data-management/queries/query-builder.md) with a
named trajectory whose next step is **R71: join execution + the construction
surface**. R71 is the third step of the critical path
(`data → relationships → dashboards`) and a stated product requirement
([purpose.md](../../context/purpose.md) #4 — relationships are central and not
fixed).

R71 is also the round R70 explicitly **earmarked as its own truth-test**
([Round_70 § Watch-item](Round_70.md)):

> R70 is conformant, not yet truth-validated… the truth is tested only when
> **R71 actually consumes a `Relationship` to join** (the second, independent
> consumer). Until then, hold the edge model as a **hypothesis**… **Kill-condition:**
> if R71 finds the governed edge doesn't carry what a real join needs (edge
> shape, cardinality semantics, or workspace-scoping turn out wrong under a real
> join), that is the model **failing its truth-test — treat it as a model
> revision, not an R71 implementation detail.**

So R71 carries the **highest model-altitude risk** in the sequence, plus a named
**bias trap**: R70's green suites are
[self-manufactured evidence](../../memory/2026-06-13-specious-model-lock-in.md)
(mechanism #1) — a live, green relationship entity makes "join = the obvious next
noun on this exact edge shape" *feel* pre-decided. R71's job is to resist that:
**actually resolve an edge to joined rows and let reality, not the existing
suite, decide whether the edge model is right.**

_Track: 1 (product feature). Pulled by ← R70 trajectory + R69 deferral
("Query-as-join-input") + [purpose.md](../../context/purpose.md) critical path
(data → **relationships** → **joins** → dashboards). Scoped by the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) and
"one feature per round": **join execution only** — the interactive multi-source
construction surface is deferred (J-1). Opened as a **Plan + Design pass that
seals (or revises) the join model at the Design gate, then STOPS** for the
human's go-ahead before any C/F/B/I (J-3 — the
[design-model confidence valve](../../decisions/2026-05-28-hybrid-flow-governance.md#design-model-confidence-valve-distinct-from-f1))._

## The model — deliberately held open at the Plan gate (J-2)

Unlike R69 and R70, R71 does **not** ratify its central model at the Plan gate.
The question — **how a join is modeled** — is exactly the kind of plausible,
coherent guess the
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
doctrine warns against locking early. Forcing it now, on the back of R70's
green-but-self-referential evidence, would be the trap. So J-2 is **resolved at
the Design gate, with truth-test evidence in hand** (the act of resolving a real
`Relationship` to real joined rows), not pre-decided here. The Plan gate ratifies
**scope, round-shape, the truth-test framing, and the kill-condition** — and
holds the model as a hypothesis with two live candidates the Design pass will
discriminate between (see J-2).

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-13)

| #   | Question                                | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-1 | **Scope** of R71                        | **Join execution only** (ratified). A Query consumes a declared `Relationship` to produce joined rows; ship only the **minimal definition surface** to express a two-source join. The full **interactive multi-source construction surface is deferred** (→ R72). This is the relationship truth-test + the critical-path step, and honors "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium).                                                                        |
| J-3 | **Round shape**                         | **Seal at Design, then STOP** (ratified). Plan + Design only this pass: seal **or revise** the join model at the Design gate, commit the Design seam, run `flow-selector`, and **STOP** for the human's explicit go-ahead before any Contract/Frontend/Backend/Integration. The highest-model-risk round earns the cheapest revert seam (a committed design doc) — the [design-model confidence valve](../../decisions/2026-05-28-hybrid-flow-governance.md#design-model-confidence-valve-distinct-from-f1). |
| J-4 | **Kill-condition** (truth-test outcome) | A **model failure, not an implementation detail** (ratified, inherited from R70's watch-item). If the Design pass finds the governed edge can't carry a real join — the ordered-pair shape, the cardinality semantics, or workspace-scoping are wrong under join — R71 surfaces it as a **Relationship model revision** (amend `relationships.md`, an explicit Design-gate finding), not a quiet workaround in the query layer.                                                                          |

### Deferred to the Design gate — resolved with truth-test evidence (J-2)

| #   | Question                            | Candidates held open (Design pass discriminates)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-2 | **How a join is modeled**           | **(a) Extend the Query** — `QueryDefinition` gains a join step referencing a `rel_` id; the Query stays the single ["virtual dataset" archetype](../../design/data-management/queries/saved-query.md), now multi-source; reuses the Query run route + archetype; the table-source resolver stays internal. Consistent with the [reuse invariant](../../design/data-management/queries/query-builder.md#the-reuse-invariant-the-one-rule-this-domain-holds). **(b) New joined-source entity** — a join becomes its own first-class source (higher model risk; closest to the discarded R69 new-noun trap). **Lean (not a ratification):** (a), per query-is-virtual-dataset + noun-vs-mode default; the Design pass must *earn* it by actually resolving an edge to rows, or surface why (b) is forced. |
| J-2′ | **Route / resolver** (parked R69+R70) | The R69/R70-parked **separate `/rows` route vs unified table-source resolver** question — *dependent on J-2*. If J-2 = (a), a join runs through the **existing `/queries/{id}/rows`** route and the resolver is an **internal** detail; the unified-by-id resolver lands only if the Design pass shows a join genuinely must resolve a mixed `ds_`/`qr_` source by id. Flagged for the **Contract gate** (post-STOP), as R69 and R70 flagged it — not pre-decided here.                                                                                                              |

**Invariant (the R69 → R70 anti-duplication rule):** any new/extended surface is
**reuse** of an existing component/layout/engine, never a parallel page or a
re-invented predicate/dtype/join engine
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).

## Plan (by gate)

1. **Plan gate** — ratify J-1, J-3, J-4 with the human; record that **J-2 is
   deliberately held open** for the Design gate (recorded in Do). Commit the
   ratified round file as the Plan-gate seam.
2. **Design gate — the join-model truth-test (the round's core):**
   - **Resolve J-2 with evidence.** Trace a concrete join end to end on paper —
     take a real declared `Relationship` (`Deals.account_id ↔ Accounts.id`) and
     walk what producing joined rows actually *requires* from the edge: which
     side is the driving table, how cardinality affects row multiplication,
     which columns the result carries, how a `stale` edge blocks the join. Record
     whether the R70 edge **carries** all of it (→ confirm J-2(a), seal) or **does
     not** (→ J-4 kill-condition fires: amend `relationships.md`, a model revision).
   - **Author the join-execution design** in
     [query-builder.md](../../design/data-management/queries/query-builder.md)
     and/or [saved-query.md](../../design/data-management/queries/saved-query.md)
     (home chosen by J-2's outcome — extend the Query docs, not a new page): the
     extended `QueryDefinition` (the join step referencing a `rel_` id), the
     execution model (resolve both table-sources → join on the validated keys →
     apply predicates → page; reuse `query_dataset_rows`), the **`409
     relationship_stale`** gate (R70 reserved it for *exactly* this consumer), the
     result-column / collision rules, the states, the minimal definition surface
     (J-1 — how a 2-source join is expressed, not a full visual builder), the
     contract intent (routes + the J-2′ resolver question flagged for Contract),
     and acceptance criteria each → ≥1 future F/B/I test.
   - If J-4 fires, **amend `relationships.md`** with the model revision (its own
     edit), cross-linked from this round.
3. **Design-gate verification** — noun-vs-mode + discovered-vs-imposed model
   check (does a *real* join's needs discover the edge shape, or did R70's suite
   impose it?); `ui-design` (design-spec) on the touched surface; `design:lint` /
   `design:tokens` / `plan:lint` / `markdown-check-link`; `gate-walker` confirms
   the Design exit criterion; run `flow-selector` to sequence C/F/B/I for the
   next session — and **STOP** (J-3).

## Acceptance criteria (this round = Plan + Design gates only)

- [ ] **J-1, J-3, J-4 ratified** with the human and recorded in Do; **J-2
      recorded as deliberately held open** for the Design gate.
- [ ] **Join-model truth-test performed at the Design gate**: a concrete
      `Relationship` is traced to joined rows on paper; the round records
      **explicitly** whether the R70 edge carries a real join's needs (J-2 sealed
      to (a)/(b)) **or fails** (J-4 kill-condition fires → `relationships.md`
      amended as a model revision).
- [ ] **Join-execution design exists** (extending the `queries/` docs per J-2,
      not a parallel page) specifying: the extended `QueryDefinition` join step
      (referencing a `rel_` id), the execution model (resolve sources → join on
      validated keys → predicates → page, reusing `query_dataset_rows`), the
      `409 relationship_stale` gate, result-column/collision handling, the states,
      the **minimal** definition surface (J-1), and the routes' contract intent
      (with J-2′ resolver question flagged for the Contract gate).
- [ ] **Noun-vs-mode + discovered-vs-imposed check passes**: the join surface is
      declared as reuse (not a parallel page / re-invented engine), and the model
      is shown **discovered** (a real join's needs) not **imposed** (R70's
      self-made suite) — [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached; `gate-walker` confirms the Design exit criterion met.
- [ ] Plan gate and the Design seam **committed separately** (revert seams);
      `flow-selector` run recorded; round **STOPS** at the Design gate (J-3) — no
      C/F/B/I this round.

## What is OUT of scope

- **Any C/F/B/I code** — the join run path, the extended `QueryDefinition`
  contract, FE join-definition surface, tests. Sequenced by `flow-selector` at
  Design exit; built in later per-gate commits **on the human's go-ahead** (J-3).
- **The interactive multi-source visual construction surface** (build joins/
  predicates visually across sources) → **R72** (J-1). _Trigger: a Query must be
  built from more than a minimal two-source join definition._
- **Composite / multi-column join keys, self-joins, cross-workspace joins,
  cardinality inference** — R70 deferred these with named triggers; they stay
  deferred. R71 executes a **single-column, within-workspace** edge.
- **Query composition** (a Query as a join input to another Query) → later;
  R71's join inputs are Datasets via a `Relationship`.
- **Result materialization / pinned snapshots** → live re-run only (the R69
  execution discipline); pull when live join is too slow at real scale.
- **Workflow / complex query (YAML + polars)** → R72+.

## Risks / unknowns

- **Model-altitude risk (the central one).** R71 is where R70's edge model is
  truth-tested; getting the join model wrong is the expensive error. _Mitigation:
  J-2 held open to the Design gate; seal **with** evidence (resolve a real edge to
  rows) or fire the J-4 kill-condition; per-gate commits; STOP after Design (J-3)._
- **Bias from R70's green suite (specious mechanism #1).** A live, conformant
  `Relationship` makes the join model feel pre-decided. _Mitigation: the
  discovered-vs-imposed check is a Design-gate exit item; the lean to J-2(a) is
  explicitly **not** a ratification._
- **Cardinality → row multiplication.** A `many:many` edge can explode row
  counts; the design must state the result-row semantics (and whether MVP join
  is inner only). _Mitigation: a named Design-gate decision, not deferred to
  build._
- **Resolver scope creep (J-2′).** The "unified table-source resolver" is the
  truer abstraction and tempts building now. _Mitigation: per
  [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)
  ("cheap-to-do-later is permission to defer"), keep it the Contract-gate
  question; default to the existing `/queries/{id}/rows` route if J-2 = (a)._
- **Stale-edge gate.** R70 reserved `409 relationship_stale` for this consumer;
  the design must specify that a join over a stale edge is **blocked**, not
  silently wrong. _Mitigation: an explicit acceptance criterion._

## Do

### Plan-gate ratification (2026-06-13)

- **J-1 → Join execution only**; the interactive multi-source construction
  surface deferred to R72. One feature per round.
- **J-2 → deliberately held open** for the Design gate — the join model is
  resolved **with truth-test evidence**, not pre-locked on R70's self-referential
  suite. Lean (not a ratification): extend the Query (`QueryDefinition` join step
  referencing a `rel_`) — per the "Query is a virtual dataset" doctrine
  ([saved-query.md](../../design/data-management/queries/saved-query.md)) and the
  noun-vs-mode default.
- **J-2′ → route/resolver flagged for the Contract gate** (dependent on J-2), as
  R69 and R70 flagged it; default to the existing `/queries/{id}/rows` if J-2 = (a).
- **J-3 → Seal at Design, then STOP**; build on the human's go-ahead in a later
  session (the design-model confidence valve for a high-model-risk round).
- **J-4 → truth-test failure is a model revision**, not an implementation detail
  (inherited from R70's watch-item kill-condition).
- **Invariant:** reuse existing layouts/validators/engines; never duplicate a
  page or re-invent the predicate/dtype/join engine.

### Gate 2 — Design pass

_Fills when the Design pass runs (the next step after this Plan-gate commit)._

## Check

_Fills at Design exit — `design:lint` / `design:tokens` / `plan:lint` /
`markdown-check-link` / `ui-design` (design-spec) / `gate-walker` / the
noun-vs-mode + discovered-vs-imposed model check + `flow-selector` result._

## Act

_Fills at Design exit — the truth-test outcome (edge model sealed to J-2(a)/(b),
or the J-4 kill-condition fired with a `relationships.md` revision), the gate
commit seams, and learnings._

## Feeds into → Round_72 (the interactive multi-source query-construction surface)

R72 builds the **interactive construction surface** R71 deferred (J-1): visually
building joins/predicates across sources, on top of R71's sealed join-execution
model. If R71's Design pass fires the J-4 kill-condition, the **corrected
`Relationship` model** is what R72 (and any re-built R70 layer) inherits. The
J-2′ **route/resolver** decision, taken at R71's Contract gate (post-STOP), is the
table-source abstraction R72's multi-source builder reads through.
