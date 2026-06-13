# Round 71: Join execution — a Query consumes a Relationship (the truth-test of R70's edge)

**Status**: Review (Design gate sealed + committed; the C/F/B/I build chain is
deferred to a later session on the human's go-ahead — J-3)
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

- [x] **J-1, J-3, J-4 ratified** with the human and recorded in Do; **J-2
      recorded as deliberately held open** for the Design gate.
- [x] **Join-model truth-test performed at the Design gate**: a concrete
      `Relationship` is traced to joined rows (against the **real read path**, not
      just on paper); the round records **explicitly** that the R70 edge carries a
      real join's needs (J-2 sealed → (a) Extend the Query) and that **J-4 did
      not fire** (R70 unrevised — the headline verdict).
- [x] **Join-execution design exists** (extending the `queries/` docs per J-2,
      not a parallel page) specifying: the extended `QueryDefinition` join step
      (referencing a `rel_` id), the execution model (resolve sources → join on
      validated keys → predicates → page — via the **new `query_joined_rows`**,
      the half-truth split the trace surfaced, reusing the predicate fragment
      builders not `query_dataset_rows` verbatim), the `409 relationship_stale`
      gate, result-column/collision handling, the states, the **minimal**
      definition surface (J-1), and the routes' contract intent (with the J-2′
      resolver question flagged for the Contract gate).
- [x] **Noun-vs-mode + discovered-vs-imposed check passes**: the join surface is
      declared as reuse (not a parallel page / re-invented engine), and the model
      is shown **discovered** (a real join's needs) not **imposed** (R70's
      self-made suite) — [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md).
- [x] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken; `ui-design` (design-spec) per-facet report
      attached (PASS, 0 gaps); `gate-walker` confirms the Design exit criterion met.
- [x] Plan gate and the Design seam **committed separately** (revert seams);
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

### Gate 2 — Design pass (2026-06-13)

**The truth-test (J-2 / J-4) — performed against the real read path, not R70's
suite.** Traced `Deals.account_id ↔ Accounts.id` to joined rows by reading
[rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py),
[filters.py](../../../workspace/apps/backend/app/ingest/filters.py),
[queries.py](../../../workspace/apps/backend/app/routers/queries.py),
[relationships.py](../../../workspace/apps/backend/app/routers/relationships.py),
and [common.py](../../../workspace/apps/backend/app/models/common.py).

- **J-4 verdict — the R70 edge is VALIDATED; the kill-condition did NOT fire.**
  The governed edge carries everything a join **input** needs (the two sources,
  the dtype-validated key pair, the computed `valid|stale` freshness gate,
  declared cardinality). The things it does **not** carry (join type, result-column
  projection, predicate qualification) are **correctly query-time concerns**, not
  edge gaps — exactly the boundary R70 drew. The ordered-pair shape,
  within-workspace scoping, and declared-cardinality MVP all held under a real
  join. **R70 needs no model revision** (`relationships.md` Status updated to
  Accepted + truth-tested).
- **J-2 resolved → (a) Extend the Query, SEALED** — at the IA / archetype / route
  level: `QueryDefinition` gains an optional `join` step `{ relationshipId,
  type }`; the Query stays the one virtual-dataset archetype, reusing its catalog,
  its `/queries/{id}` detail, and its `/queries/{id}/rows` run route.
- **But the truth-test split a half-truth** (the
  [specious discipline](../../memory/2026-06-13-specious-model-lock-in.md)): the
  J-2(a) lean silently carried _"reuse the run path verbatim,"_ which the trace
  **refuted at the execution layer** — the predicate atom (`col` = index into ONE
  dataset) + the SQL builder (unqualified `"col"`) are **single-source by
  construction**, and `query_dataset_rows` is hardcoded to one `read_parquet(?)`.
  So the design **names the genuinely-new engine** instead of laundering it as
  reuse: a `query_joined_rows` path (`FROM read_parquet(L) JOIN read_parquet(R)
  ON …`), a **side-qualified** column reference over the effective combined column
  space, and a result-column **collision rule**. What _is_ genuinely reused: the
  predicate _vocabulary_, the SQL _fragment builders_, the `409 *_stale` pattern,
  and the `RowsPage` shape. (Recorded in
  [joins.md § Truth-test record](../../design/data-management/queries/joins.md#truth-test-record-j-4).)
- **J-2′ (route/resolver) → unified resolver stays deferred.** R71's join inputs
  are two **Datasets** via a `rel_` (Query×Query composition is deferred), so the
  join runs through the existing `/queries/{id}/rows` route, resolving both
  datasets internally; no mixed `ds_`/`qr_` runtime resolver is pulled. The one
  new contract question (where the joined Query exposes its **effective columns**)
  is flagged for the Contract gate.

**Docs produced / touched:**

- **Authored** [joins.md](../../design/data-management/queries/joins.md) — the
  join-execution **mode** (not a new noun): the truth-test record, the extended
  `QueryDefinition` join step + effective-column / collision rule, the
  `query_joined_rows` execution model, the `409 relationship_stale` run gate, the
  minimal create surface + the read-only join summary + stale-edge state, an
  explicit Accessibility declaration, the contract intent, scope, and 10
  acceptance criteria.
- **Updated** [query-builder.md](../../design/data-management/queries/query-builder.md)
  (trajectory split: R71 join execution → joins.md; construction surface → R72;
  sibling link + scope re-pointed) and
  [relationships.md](../../design/data-management/workspaces/relationships.md)
  (Status → Accepted + **truth-tested R71** note; the `409 relationship_stale`
  marked **consumed**; consumer link → joins.md).
- **Reconciled a spec-vs-impl truth-debt R70 flagged** ([purpose.md](../../context/purpose.md)
  #7) while touching the query docs:
  [saved-query.md](../../design/data-management/queries/saved-query.md) said
  **SQLModel** (the J-3 plan) and **`@mdd/ui`** for `<PagedRowsView>`, but the R69
  build shipped **raw-SQLite + Pydantic** and `data-management/_shared/`.
  Reconciled to the shipped truth (the J-3 row annotated as build-corrected, not
  rewritten; the genuinely-`@mdd/ui` `PageHeader`/`PageCard` shells left intact —
  verified against `packages/ui/src/Components/`).

**Model check** (Design gate — per the
[2026-06-13 governance amendment](../../decisions/2026-05-28-hybrid-flow-governance.md#design-model-confidence-valve-distinct-from-f1)):

- **Noun-vs-mode:** a join is a **mode** of the existing Query (a multi-source
  virtual dataset), not a new noun — it extends `QueryDefinition` + the run path
  and reuses the catalog / detail / `<PagedRowsView>`; the only new surfaces are
  the minimal join affordance + a read-only summary. No parallel "joined view"
  page. **Clears the check.**
- **Discovered-vs-imposed:** _discovered_ — the join keys, freshness gate, and two
  sources are needs a real join genuinely has, and the edge held them **before**
  R71 existed (not minted to justify it). The one thing R71 _adds_ (the join step
  plus `query_joined_rows`) is pulled by the read path's actual single-source
  limit, not by R70's suite. The bias trap (R70's green suite making "join = obvious next
  noun" feel pre-decided) was countered by testing against the **code**, not the
  suite.

**Verification** (see Check): `design:lint` 0 (13 docs), `design:tokens` 0 (10
maps), `plan:lint` 0, `markdown-check-link` 0 broken, `markdownlint` 0;
`ui-design` (design-spec) on joins.md **PASS** (0 gaps — one **Credibility** gap
caught preventively: the "no eligible relationships" create state was undeclared;
remediated in-spec).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), against the closed design (joins.md):

| Condition                            | Fired? | Justification                                                                                                                                                  |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The run/detail state model has >3 branches (Loading → Populated / EdgeStale / PredStale / NotFound) plus the create eligible / no-eligible state.              |
| 2. New interaction pattern           | no     | Every surface reuses a shipped pattern — `<Select>`, the read-only summary (saved-query), `<Alert>` stale state, `<PagedRowsView>`, `<DeleteConfirmModal>`.   |
| 3. High user-error risk              | no     | Creating a joined query is reversible (delete-with-confirm); reads non-destructive; the server re-validates + the stale gate blocks a bad join; no irreversible step. |
| 4. Contract depends on unresolved UI | no     | The join is a field on existing shapes; the open questions (effective-column exposure, the resolver) are backend/architecture choices, not UI dependencies.   |
| 5. UX confidence below threshold     | no     | J-1 ratified; all surfaces reuse proven patterns; ui-design design-spec PASS, 0 gaps.                                                                          |

Result: **Flow: DCFBI** (1 condition fired — the default cheap lane; F1/F2
skipped on this path). The build chain (C → F → B → I) is sequenced for a later
session **on the human's go-ahead** (J-3) — note the new `query_joined_rows`
engine + side-qualified columns are a **Backend-gate** focus, flagged in joins.md.

**Design gate closed + STOPPED (J-3).** The design model is sealed and committed;
no C/F/B/I this round. Gate commit seams (gate = commit): Plan `921e86d` → Design
`806ff3f` (joins.md + the sibling updates + the saved-query reconciliation + the
round record) + this seam-note commit. Each gate independently revertable.

## Check

- [x] **J-1, J-3, J-4 ratified** with the human (Plan gate); **J-2 held open**
      and **resolved at the Design gate with evidence** (the join trace).
- [x] **Truth-test performed** against the real read path (not R70's suite):
      `Deals.account_id ↔ Accounts.id` traced to joined rows. **Verdict recorded**
      — edge VALIDATED, **J-4 did not fire** (R70 unrevised); J-2 sealed → (a)
      Extend the Query, with the **engine-extension half-truth split** named.
- [x] **joins.md authored** (the join-execution mode): extended `QueryDefinition`,
      `query_joined_rows` execution model, `409 relationship_stale` gate,
      effective-column + collision rule, minimal create surface + stale state,
      Accessibility declaration, contract intent, 10 acceptance criteria.
- [x] **Noun-vs-mode + discovered-vs-imposed check recorded** (Model check in Do)
      — a join is a mode of the Query (reuse), discovered by a real join's needs.
- [x] `design:lint` 0 (13 docs) · `design:tokens` 0 (10 maps) · `plan:lint` 0 ·
      `markdown-check-link` 0 broken · `markdownlint` 0.
- [x] `ui-design` (design-spec) on joins.md — **PASS**, 0 gaps (one Credibility
      gap — the "no eligible relationships" create state — caught + remediated
      in-spec).
- [x] **Spec-vs-impl reconciliation** ([purpose.md](../../context/purpose.md) #7):
      saved-query.md's stale `SQLModel` / `@mdd/ui`-`PagedRowsView` claims fixed to
      the shipped raw-SQLite + `data-management/_shared/` truth.
- [x] `flow-selector` run + result recorded (**DCFBI**, 1 of 5 fired).
- [x] **`gate-walker` (Design gate)** — exit criterion + model check + commit seam
      recorded (verdict in Act).
- [x] Plan gate and Design seam **committed separately**; round **STOPS** at the
      Design gate (J-3) — no C/F/B/I this round.

## Act

**Outcome — the join model is sealed at the Design gate, and R70's edge passed
its truth-test.** The expensive question this round existed to answer — _does the
governed `Relationship` carry what a real join needs?_ — was answered against the
**code**, not R70's self-referential green suite: yes. The edge is the right
shape for its role (join **input**); **J-4 did not fire; R70 needs no revision**.
[joins.md](../../design/data-management/queries/joins.md) seals the join as a
**mode** of the Query (extend `QueryDefinition`, reuse the archetype/route), not a
new noun.

**The doctrine earned its keep — twice.**

- **Holding J-2 open to the Design gate** (instead of ratifying it at Plan on
  R70's evidence) is what let the trace **split a half-truth**
  ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)):
  the J-2(a) "extend the Query" lean was _true at the IA level_ but smuggled a
  _false_ "reuse the engine verbatim." The trace caught it — the predicate/atom
  model and `query_dataset_rows` are single-source by construction — so the design
  **names** the new engine (`query_joined_rows` + side-qualified columns) rather
  than discovering it mid-build. Had J-2 been sealed at Plan, that false half
  would have ridden the true half straight into the Contract/Backend gates.
- **Sealing at D and STOPPING** (J-3, the design-model confidence valve) keeps the
  most expensive error class (a wrong join model) behind the cheapest revert seam
  (a committed design doc), before any code.

**Two design-gate findings beyond the seal:**

1. **The half-truth split is the headline** — `query_joined_rows`, the
   side-qualified column reference, and the result-column collision rule are
   declared now as genuinely-new build work, flagged as the **Backend-gate**
   focus; the predicate vocabulary / fragment builders / `RowsPage` / route are
   the true reuse.
2. **A spec-vs-impl truth-debt reconciled** ([purpose.md](../../context/purpose.md)
   #7): saved-query.md's `SQLModel` + `@mdd/ui`-`PagedRowsView` claims (the R69
   plan that the build corrected to raw-SQLite + `data-management/_shared/`) were
   fixed where I was already touching the query docs — R70 had scheduled this for
   "when the queries backend doc is next touched."

**`flow-selector`: DCFBI** (1 of 5 fired; F1/F2 skipped). The build chain is
sequenced for a later session **on the human's go-ahead** (J-3).

**`gate-walker` (Design gate): PASS** — the round file documents the Design exit
criterion (journeys + acceptance in joins.md), the noun-vs-mode +
discovered-vs-imposed model check, and the Design commit seam; the round correctly
STOPS before C/F/B/I.

**Learnings:**

- **A truth-test's job is to find the half that's only riding along, even when the
  headline verdict is "validated."** R70's edge passed (the expected result), but
  the _real_ value of holding J-2 open was catching that "extend the Query"
  carried a false "reuse the engine" — a half-truth invisible until you trace the
  actual read path. The discipline isn't only "does the model survive?" but "which
  sub-claim is smuggling through on the survivor's credibility?" _(Candidate
  memory — see Promotions.)_

**Promotions**: none this round. The candidate — "a validated model can still
carry a false sub-claim; the truth-test must split it" — is a sharpening of
[specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)'s
split-the-half note; it has fired once here. Promote if a third round re-applies
it (the don't-add-until-pulled rule).

**Follow-ups (notes, not promotions):**

- **Build chain (C → F → B → I)** for join execution — deferred to the human's
  go-ahead (J-3). The new `query_joined_rows` engine + side-qualified columns are
  the Backend-gate focus; the effective-column exposure is the one open Contract
  question.
- **`relationships.md` delete-guard** when an edge is consumed by a join (the
  first relationship dependency) — decided at R71's Backend gate, per joins.md
  Scope.
- **`dataset-detail.md` may carry the same `@mdd/ui`-`PagedRowsView` drift** as
  saved-query.md did — reconcile when that doc is next touched (not this round).

## Feeds into → Round_72 (the interactive multi-source query-construction surface)

R72 builds the **interactive construction surface** R71 deferred (J-1): visually
building joins/predicates across sources, on top of R71's sealed join-execution
model. If R71's Design pass fires the J-4 kill-condition, the **corrected
`Relationship` model** is what R72 (and any re-built R70 layer) inherits. The
J-2′ **route/resolver** decision, taken at R71's Contract gate (post-STOP), is the
table-source abstraction R72's multi-source builder reads through.
