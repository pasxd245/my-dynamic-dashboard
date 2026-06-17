# Round 71: Join execution — a Query consumes a Relationship (the truth-test of R70's edge)

**Status**: Complete
**Date started**: 2026-06-13
**Date completed**: 2026-06-13

## Goal

**Inherits from ← [Round_70](Round_70.md)** — R70 sealed and shipped the
**governed `Relationship` edge** (a `rel_` identity, dtype-validated join keys,
workspace-scoped, `valid|stale` status) and graduated the
[`queries/` domain](../../design/data-management/queries/queries.md) with a
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
| J-2 | **How a join is modeled**           | **(a) Extend the Query** — `QueryDefinition` gains a join step referencing a `rel_` id; the Query stays the single ["virtual dataset" archetype](../../design/data-management/queries/queries.md), now multi-source; reuses the Query run route + archetype; the table-source resolver stays internal. Consistent with the [reuse invariant](../../design/data-management/queries/queries.md#the-reuse-invariant-the-one-rule-this-domain-holds). **(b) New joined-source entity** — a join becomes its own first-class source (higher model risk; closest to the discarded R69 new-noun trap). **Lean (not a ratification):** (a), per query-is-virtual-dataset + noun-vs-mode default; the Design pass must *earn* it by actually resolving an edge to rows, or surface why (b) is forced. |
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
     [query-builder.md](../../design/data-management/queries/queries.md)
     and/or [saved-query.md](../../design/data-management/queries/queries.md)
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
  ([saved-query.md](../../design/data-management/queries/queries.md)) and the
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
  [joins.md § Truth-test record](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one).)
- **J-2′ (route/resolver) → unified resolver stays deferred.** R71's join inputs
  are two **Datasets** via a `rel_` (Query×Query composition is deferred), so the
  join runs through the existing `/queries/{id}/rows` route, resolving both
  datasets internally; no mixed `ds_`/`qr_` runtime resolver is pulled. The one
  new contract question (where the joined Query exposes its **effective columns**)
  is flagged for the Contract gate.

**Docs produced / touched:**

- **Authored** [joins.md](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one) — the
  join-execution **mode** (not a new noun): the truth-test record, the extended
  `QueryDefinition` join step + effective-column / collision rule, the
  `query_joined_rows` execution model, the `409 relationship_stale` run gate, the
  minimal create surface + the read-only join summary + stale-edge state, an
  explicit Accessibility declaration, the contract intent, scope, and 10
  acceptance criteria.
- **Updated** [query-builder.md](../../design/data-management/queries/queries.md)
  (trajectory split: R71 join execution → joins.md; construction surface → R72;
  sibling link + scope re-pointed) and
  [relationships.md](../../design/data-management/workspaces/relationships.md)
  (Status → Accepted + **truth-tested R71** note; the `409 relationship_stale`
  marked **consumed**; consumer link → joins.md).
- **Reconciled a spec-vs-impl truth-debt R70 flagged** ([purpose.md](../../context/purpose.md)
  #7) while touching the query docs:
  [saved-query.md](../../design/data-management/queries/queries.md) said
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

**Design gate closed + STOPPED (J-3).** The design model is sealed and committed.
Gate commit seams (gate = commit): Plan `921e86d` → Design `806ff3f` (joins.md +
the sibling updates + the saved-query reconciliation + the round record) +
seam-note `1947a54`. Each gate independently revertable.

### Gate 3 — Contract (C) — built on the human's go-ahead (2026-06-13)

The go-ahead came; the DCFBI build chain proceeds, each gate its own commit seam.

**The open contract question (effective-column exposure) → decided:** a
**`resolvedColumns` field on `Query`**, server-computed and present **only when a
join is set** (the combined `left ++ right` space, collision-qualified). Chosen
over a run-response block: the FE needs the headers on the **detail GET** to
render the joined `<PagedRowsView>`, and `RowsPage` stays shared with datasets
unchanged. The J-2′ unified resolver stays deferred (join inputs are two Datasets
via a `rel_`).

**Delivered (contract artifacts — no new routes; the join is a field on existing
shapes):**

- `_shared/query.yaml` — new `JoinStep` (`relationshipId` + `type: inner`);
  `QueryDefinition.join?`; `Query.resolvedColumns?` (the effective columns).
- `_shared/api-error.yaml` — `ApiErrorRelationshipStale` + `relationship_stale`
  in the closed `ApiErrorCode` enum + the `oneOf`/discriminator (R70's reserved
  code, now consumed).
- `queries/rows-get.contract.yaml` — `409` widened to `oneOf(query_stale,
  relationship_stale)` with both examples; `queries/post.contract.yaml` — `422`
  covers an unknown/cross-workspace/stale join edge.
- **Centralized constants:** `relationship_stale` added to `values.yaml` → both
  generated templates (`constants.py.hbs` + `constants.ts.hbs`) → re-rendered
  (BE `ERROR_CODES` + FE `ERROR_CODES.RELATIONSHIP_STALE`).
- **FE wire types** (`queries/types.ts`): `JoinStep`, `QueryDefinition.join?`,
  `ResolvedColumn`, `Query.resolvedColumns?`.
- **MSW + fixtures:** `MOCK_JOINED_QUERY` (join + `resolvedColumns` = Deals ++
  accounts), `MOCK_JOINED_ROWS`, `MOCK_STALE_JOIN_QUERY_ID`; `getQuery` /
  `runQuery` handlers serve the joined query, the joined rows, and the `409
  relationship_stale` for a stale-edge join.

**Contract gate verification:** `@mdd/contracts` OpenAPI validity **22/22**;
builder **type-check clean**; builder suite **130/132** (the 2 failures are the
**pre-existing upload-wizard 5s-timeout flake** documented in
[Round_69 § Contract](Round_69.md) — **7/7 in isolation** at `--test-timeout=15000`;
queries **6/6**). Contract seam: `9c4bbac`.

### Gate 4 — Frontend (F) — DCFBI: F (built against MSW; F1/F2 skipped)

The join surface **reuses** the shipped query-mode shell — no parallel page (the
noun-vs-mode invariant held through the build):

- **`QueryDetailPage` extended** — when `definition.join` is present it renders
  the joined result through the **same** `<PagedRowsView>`, using the
  server-computed **`resolvedColumns`** for headers (the FE can't derive a joined
  header set from one source dataset); adds a **read-only join summary** (left ⋈
  inner ⋈ right, the key pair, a cardinality `<Tag>`, fetched via the R70
  `useRelationshipQuery`), a joined-aware **"Matched X rows"** counter, and the
  **`relationship_stale` → "join unavailable"** state (`role="alert"`, points at
  the workspace Relationships view — flag, don't crash).
- **`JoinWithRelatedModal` (new, minimal create surface, J-1)** — a `<Select>` of
  the dataset's **valid** relationships + a name; Save persists a joined Query
  (`definition.join` referencing the `rel_`, `datasetId` = the edge's left source)
  and navigates to its detail. The rich multi-source builder stays **R72**.
- **`[Join with related dataset]` action** on the dataset detail page, beside
  `[+ Save as Query]` — **disabled with a guiding tooltip when the dataset has no
  valid relationship** (the Credibility state the design-spec gate caught; no
  dead-end empty `<Select>`).
- FE `ApiError` union + `isApiError` widened for `relationship_stale`; i18n
  `queries.detail.*` + `queries.join.*` (en + vi).

**Frontend gate verification:** builder **type-check clean**; suite **134/136**
(4 new `queries.test.tsx` join cases: reopen joined → summary + joined rows via
the reused table; `relationship_stale` → join-unavailable; create round-trip;
affordance disabled when no valid edge). The 2 failures remain the **pre-existing
upload-wizard flake** (7/7 in isolation). _F1/F2 skipped on the DCFBI path._
Frontend seam: `9214c0e`.

### Gate 5 — Backend (B) — DCFBI: B (the engine extension the truth-test named)

The genuinely-new engine the J-2 truth-test surfaced — **`query_joined_rows`** —
is built **beside** `query_dataset_rows` (the single-source path can't express a
two-source join), **reusing** the predicate fragment builders:

- **`query_joined_rows`** ([rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py))
  — `FROM read_parquet(L) INNER JOIN read_parquet(R) ON L.k = R.k`, with an inner
  CTE that **aliases every output column to its effective (collision-qualified)
  name** so the **reused** `build_filter_sql`/`build_advanced_sql`/`?q=` fragments
  compose unqualified over the joined relation. `build_effective_columns` computes
  the `left ++ right` space + the collision rule (qualify duplicate names by
  dataset).
- **Run path** ([queries.py](../../../workspace/apps/backend/app/routers/queries.py))
  — a `join` branch resolves the edge (reusing R70's `_compatible`/`_dtype_of`),
  re-validates atoms against the **effective** columns, and on a **drifted join
  key returns `409 relationship_stale`** (the code R70 reserved), on a drifted
  **predicate** atom `409 query_stale`. Validate-on-save rejects an unknown /
  cross-workspace / stale edge `422`. `GET /queries/{id}` exposes the computed
  **`resolvedColumns`** when joined.
- **`Relationship` model unrevised** — the build consumed the R70 edge exactly as
  the truth-test predicted (`rel_` + key pair + dtype-compat); J-4 stayed un-fired
  through the build, not just the design.

**Backend gate verification:** ruff **clean**; pytest **166/166** (7 new
`test_joins.py`: create+run joined → 3 rows × 8 effective cols; collision-qualified
`resolvedColumns` (`deals.id`/`accounts.id`); predicate over the effective space;
**`409 relationship_stale`** on key drift; `409 query_stale` on predicate drift;
`422` save-guards for unknown + stale edge), each contract-`validate_response`-checked.
Backend seam: `f3a7092`.

### Gate 6 — Integration (I) — DCFBI: I

The FE↔BE seam is the **contract**: both sides conform to the same `queries/*`
YAML — MSW responses are `withContractValidation`-checked in the FE suite (134/136),
BE responses are `validate_response`-checked in pytest (166/166). One contract,
dual conformance — the join field, `resolvedColumns`, and `relationship_stale` all
green on both sides.

Beyond that, a **live cross-process round-trip** against the real backend (uvicorn
:8097, isolated `MDD_BACKEND__DATA_DIR`) exercised the exact join sequence: upload
two CSVs → declare `deals.id ↔ accounts.id` → **create a joined Query** (201) →
**GET** (`resolvedColumns` = `deals.* ++ accounts.*`, collision-qualified) → **run**
(inner join, **3 rows × 8 effective cols**) → drift the join key → **run again →
409 `relationship_stale`** (the join blocked, not silently wrong). The real BE's
responses are byte-shaped identical to the MSW mocks the FE was built against.
Integration seam: this commit.

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
- [x] Plan gate and Design seam **committed separately**; round STOPPED at the
      Design gate (J-3) until the human's go-ahead.
- [x] **Build chain on go-ahead (DCFBI):** **Contract** — OpenAPI **22/22**, FE
      type-check clean, suite green (`9c4bbac`). **Frontend** — suite **134/136**
      (4 join cases; 2 = known upload flake) (`9214c0e`). **Backend** — pytest
      **166/166** (7 join cases, contract-validated) (`f3a7092`). **Integration**
      — dual contract conformance (MSW + real BE) + a live cross-process join
      round-trip (create → get `resolvedColumns` → run 3×8 → key drift → 409
      relationship_stale) (this commit). Each gate its own seam.
- [x] **R70 edge model held through the build** — the `Relationship` entity was
      consumed exactly as the truth-test predicted; **no revision** (J-4 un-fired
      in design *and* build).

## Act

**Outcome — the join model is sealed at the Design gate, and R70's edge passed
its truth-test.** The expensive question this round existed to answer — _does the
governed `Relationship` carry what a real join needs?_ — was answered against the
**code**, not R70's self-referential green suite: yes. The edge is the right
shape for its role (join **input**); **J-4 did not fire; R70 needs no revision**.
[joins.md](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one) seals the join as a
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

**`flow-selector`: DCFBI** (1 of 5 fired; F1/F2 skipped).

**`gate-walker` (Design gate): PASS** — the round file documents the Design exit
criterion (journeys + acceptance in joins.md), the noun-vs-mode +
discovered-vs-imposed model check, and the Design commit seam.

**Build outcome — the join model shipped end to end, and the edge model held its
truth-test through the build.** On the human's go-ahead the design seal built
cleanly through C → F → B → I (each its own commit): a Query now consumes a
governed `Relationship` to read two datasets as one — declared from the dataset
page, reopened with a read-only join summary + the joined rows through the
**reused** `<PagedRowsView>`, run live, blocked with `409 relationship_stale` when
a join key drifts. **The half-truth split the truth-test predicted was exactly
what the build needed:** the `query_dataset_rows` reuse-claim was false (a new
`query_joined_rows` + side-qualified effective columns were built), while the
predicate vocabulary / fragment builders / route / `RowsPage` were genuinely
reused — naming that at the Design gate is why the build had no surprises. And
**R70's `Relationship` needed no revision** — the second, independent consumer
validated the edge in *running code*, not just in a green suite (the watch-item's
real test). The build-first discipline
([ui-boundary-build-first](../../memory/2026-05-22-ui-boundary-build-first.md))
held: the altitude was right at D, the build corrected the mechanism (named in
advance, this time).

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

- **Build chain (C → F → B → I)** for join execution — **done** this round on the
  go-ahead (`9c4bbac` · `9214c0e` · `f3a7092` · Integration). The open Contract
  question (effective-column exposure) → resolved to **`resolvedColumns` on `Query`**.
- **`relationship_stale` delete-guard**: R71 surfaces the first relationship
  *dependency* (a join consumes an edge). R71 **blocks the run** on a stale/gone
  edge (409) but does **not** yet guard *deleting* a consumed relationship — a
  delete still cascades/orphans the joined query's run into the 409 path. A
  pre-delete dependency check (e.g. `409 in_use`) is a clean follow-up if the UX
  needs it; deferred (joins.md Scope).
- **Left/outer joins, composite keys, self-joins, Query×Query composition,
  many:many row-explosion guard** — R71 ships single-column, within-workspace,
  **inner** only; the rest stay R72+ (named triggers in joins.md).
- **`dataset-detail.md` may carry the same `@mdd/ui`-`PagedRowsView` drift** as
  saved-query.md did — reconcile when that doc is next touched (not this round).

## Feeds into → Round_72 (the interactive multi-source query-construction surface)

R72 builds the **interactive construction surface** R71 deferred (J-1): visually
building joins/predicates across sources, on top of R71's now-shipped
join-execution model (the extended `QueryDefinition` + `query_joined_rows` +
`resolvedColumns`). R71's flow-selector noted R72 is the **likely DFCFBI** round —
the visual multi-source builder is a genuinely new interaction pattern with real
UX uncertainty (the conditions R71's scope cut kept quiet). The J-2′ **unified
table-source resolver** stays deferred (R71 runs joins through `/queries/{id}/rows`
over two Datasets); it earns its place when **Query×Query composition** needs to
resolve a mixed `ds_`/`qr_` source by id. R70's `Relationship` model is now
**twice-validated** (governance + a real join consuming it) — no revision pending.
