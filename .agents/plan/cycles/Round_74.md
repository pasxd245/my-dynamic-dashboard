# Round 74: The join graph — let a Query join one dataset to two or more others

**Status**: Review
**Date started**: 2026-06-14

## Goal

**Inherits from ← [Round_73](Round_73.md)** — R73 shipped the **linear multi-join
chain**: `QueryDefinition.join` generalized to an ordered **`joins: JoinStep[]`**,
`query_joined_rows` grew from a fixed two-source join into a **fold over N sources**,
and R72's `JoinEditor` became a **`ChainEditor`** (append a hop from the **tail** /
remove the last hop) under a **strict linear-path** constraint. It **deferred the
non-linear topology as J-1′** with a named trigger:

> _The free-form visual builder canvas / source graph and non-linear topology (a
> dataset joined to 2+ others — a star/tree, not a path) → R74. Trigger: a Query must
> join one dataset to two or more others — a branch the linear path cannot represent._
> ([multi-join.md § Scope](../../design/data-management/queries/multi-join.md))

R74 fills the [query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
step reserved as **"R74 visual join canvas"** — the sixth step of the critical path
(`data → relationships → joins → construction → multi-join → **join graph** →
dashboards`). It is the **first time the join topology grows past a single path**.

**The risk axis is the lighter twin of R73's.** R73 re-opened the model (singular
`join` → an ordered chain) *and* the engine *and* the interaction, so it invoked
**both** valves (the design-model confidence valve at Design **and** DFCFBI/F1 for the
chaining UX). R74 is narrower: the model **does not re-open** — `joins: JoinStep[]`
**already** carries each hop's explicit `leftDatasetId`/`rightDatasetId`, so it can
already express a tree. What is linear today is an **invariant**, not the shape:
`_resolve_chain` rejects `rel.left_dataset_id != tail.id` as `nonlinear_chain`
([queries.py](../../../workspace/apps/backend/app/routers/queries.py)), and
`query_joined_rows` hardcodes each hop's ON clause to the **immediately-previous**
source `T{k}` ([rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)).
R74 **relaxes the invariant** (each hop's left = **any prior source**, not just the
tail) + **generalizes the engine ON-clause** (`T{k}` → `T{left_idx}`) + adds a
**left-source `<Select>`** to the hop-list builder. So R74 carries **engine + UX
risk**, but **not model-altitude risk** — naming which risk is present (and which
valve it pulls) is itself the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium).

_Track: 1 (product feature). Pulled by ← R73 J-1′ deferral + the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
("R74 visual join canvas") + [purpose.md](../../context/purpose.md) critical path +
key decision #4 (relationships/joins are central, not fixed). Scoped by the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) and "one
feature per round": the **connected acyclic join graph (a tree) inside the existing
hop-list builder** only — the **free-form visual node-graph canvas** (drag nodes /
draw edges) is deferred (J-1′ → R75)._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-14)

| #    | Question          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-1  | **Scope** of R74  | **Extend the builder to a connected acyclic graph (a tree); defer the visual canvas** (ratified). Relax the linear-chain invariant so each hop's **left/driving dataset is ANY source already in the graph** (not just the tail), reusing R73's hop-list builder with a **left-source `<Select>`** per hop. **Defer the free-form drag/draw visual node-graph canvas → R75** (J-1′) until a topology genuinely needs visual editing. Mirrors the R71→R72 and R73 splits: ship the smallest generalization that the named trigger pulls — a **tree**, in the surface that already exists — and stand up the canvas only when the hop-list stops scaling. Honors **noun-vs-mode** (a mode, not a parallel `/canvas` page) + "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium). |
| J-2  | **Round shape**   | **Run straight through** (ratified) — Plan → Design → build chain in one pass, **no Design-gate STOP**. Unlike R73 (which sealed-at-Design because it re-opened the model), R74 **relaxes a constraint** rather than minting a model noun: `joins: JoinStep[]` already expresses a tree, so the expensive model-altitude error R73's STOP braked is **not in play** here. The cheapest revert seam is still **per-gate commits** (each gate independently revertable); the design-model confidence valve (the **topology truth-test**) still runs at Design to *confirm* the model holds, but does not gate a STOP. |
| J-1′ | **Sub-scope cut** | **Deferred → R75** (ratified): the **free-form visual builder canvas / source graph** (drag datasets as nodes, draw edges on a canvas). Still deferred with their standing triggers: **left / right / outer joins**, **composite / multi-column keys**, **self-joins** (a dataset joined to itself — the acyclic rule blocks revisiting a dataset), **cross-workspace** joins, **Query × Query composition** (+ the unified `ds_`/`qr_` resolver), **workflow (YAML + polars)**, **rename-in-builder**, **result materialization**, the **row-explosion guard**. R74 stays **inner, single-column-per-hop, within-workspace**, and the graph stays a **tree** (each new dataset attaches once — no diamonds/cycles). |

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                                       | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **The topology rule + engine generalization**  | The model is settled (`joins: JoinStep[]`, each hop names its own `leftDatasetId`). What R74 must pin is the **graph rule** that replaces the linear invariant: each hop's **left** must be a dataset **already in the graph** (connected) and its **right** must be a dataset **not yet in the graph** (acyclic — a spanning **tree**, so no diamonds/self-joins; those stay deferred). The engine generalizes hop `k`'s ON clause from `T{k}` (the previous source) to **`T{left_idx}`** (the index of the hop's left source), and execution requires a **topological order** (each hop's left precedes it). This is the **topology truth-test**: does the `Relationship` edge / `JoinStep[]` model carry a tree (expected: **yes** — only the invariant + engine ON-clause generalize), and does folding a tree compose correctly (a star: D0 joined to D1 **and** D2)? Lean: **tree rule (connected + acyclic) + `T{left_idx}` engine + topo-order execution**, sealed at Design, the build free to deviate. |
| J-4 | **Doc home + the builder's tree affordance**   | **Home:** **extend [multi-join.md](../../design/data-management/queries/multi-join.md)** (generalize its "strict linear path" to a "join graph (tree)"; the linear chain becomes the degenerate path case) vs. a **new sibling doc**. **Affordance:** the hop-list builder gains a **left-source `<Select>`** per added hop (choose which existing source to extend from), `[+ Add a join]` lists edges driving from the **chosen** source (was: the tail), and **`[Remove]` applies to any leaf hop** (a hop whose right dataset is no parent's left), not just the last. Lean: **extend multi-join.md**; **left-source `<Select>` + leaf-removal**. Sealed at Design (home/mechanism free to deviate — the [build-first](../../memory/2026-05-22-ui-boundary-build-first.md) twin). |

**Invariant (the R69 → R73 anti-duplication rule):** every new/extended surface is
**reuse** of an existing component / layout / engine, never a parallel page or a
re-invented predicate / dtype / join engine
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)). The
tree editor **extends** R73's `ChainEditor` (the same eligible-relationships
`<Select>`, the same chip/advanced predicate editors over `resolvedColumns`, the same
`<PagedRowsView>` preview); the **only** genuinely-new work is the **left-source
choice** in the builder, the **relaxed graph validation**, and the **`T{left_idx}`
engine generalization** — named honestly, not laundered through "reuse".

## Plan (by gate)

1. **Plan gate** — ratify J-1, J-2, J-1′ with the human; record J-3, J-4 as
   **held open** for the Design gate. Commit the ratified round file as the Plan-gate
   seam.
2. **Design gate — author the join-graph (tree) design:**
   - **Extend the multi-join design** (home per J-4): the **graph rule** (connected +
     acyclic = a tree) replacing the linear invariant, the **`T{left_idx}` engine
     generalization** + the **topological-order** execution requirement, the
     **left-source `<Select>` + leaf-removal** builder affordance, the per-hop
     **`409 relationship_stale`** gate (unchanged), the effective column space
     (unchanged — still the ordered concat across all sources), the states, and
     Accessibility declared (not inferred). Each acceptance criterion → ≥1 future
     F/B/I test.
   - **Run the design-model confidence valve (the topology truth-test):** does the
     R70 `Relationship` edge / the `joins: JoinStep[]` model carry a **tree** join, or
     does it re-open? Trace a concrete **star** (D0 ⋈ D1 **and** D0 ⋈ D2) end to end;
     record the verdict (expected: the **model holds** — only the invariant + engine
     ON-clause + builder affordance generalize). Mirrors
     [multi-join.md § Truth-test](../../design/data-management/queries/multi-join.md).
   - **Resolve J-3 (topology rule + engine)** and **J-4 (home + affordance)** with the
     closed design; update [query-builder.md](../../design/data-management/queries/query-builder.md)
     (trajectory: R73 multi-join chain **shipped**; **R74 join graph** → its home;
     **R75 visual canvas** reserved) and cross-link the siblings.
3. **Design-gate verification** — topology truth-test recorded; noun-vs-mode +
   discovered-vs-imposed check; `ui-design` (design-spec) on the tree-editor surface;
   `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link`;
   `gate-walker` confirms the Design exit criterion; run **`flow-selector`** to
   sequence the build chain — and **continue** (J-2: run straight through).

## Acceptance criteria

- [ ] **J-1, J-2, J-1′ ratified** with the human and recorded in Do; **J-3, J-4
      recorded as held open**, then **resolved at the Design gate**.
- [ ] **Join-graph (tree) design authored** (home per J-4) specifying: the **graph
      rule** (connected + acyclic) replacing the linear invariant, the **`T{left_idx}`
      engine generalization** + topo-order execution, the **left-source `<Select>` +
      leaf-removal** builder affordance, the per-hop stale gate, the (unchanged)
      effective column space, the states, Accessibility, and the contract intent.
- [ ] **Design-model confidence valve invoked** (to *confirm*, not to STOP): the
      **topology truth-test** is recorded — the `Relationship` edge / `JoinStep[]`
      model carries a tree; only the invariant + engine ON-clause + builder affordance
      generalize — with a verdict, named honestly (no model change is laundered under
      "reuse", and no model change is invented where none is needed).
- [ ] **Noun-vs-mode check passes**: the tree editor is an **extension of R73's
      `ChainEditor`**, not a parallel `/canvas` page or a re-invented predicate / join
      engine — the noun-vs-mode default
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken, `markdownlint` 0; `ui-design` (design-spec)
      per-facet report attached (PASS, 0 gaps); `gate-walker` confirms the Design exit
      criterion met.
- [ ] **Build chain green** (per `flow-selector`): FE builder tree-edit + multi-source
      preview, Contract (no shape change — the `joins` array is unchanged; only the
      validation invariant relaxes), Backend (`T{left_idx}` fold + graph validation),
      Integration (one contract / dual conformance + the real-app lifecycle).
- [ ] Each gate **committed separately** (revert seams); `flow-selector` run recorded;
      **Complete = human-signed-off** (ran the app against the real backend and
      exercised a star join), not gates-green
      ([DFCFBI-F1-human-review](../../memory/2026-06-14-dfcfbi-f1-needs-human-review.md)).

## What is OUT of scope

- **The free-form visual builder canvas / source graph** (drag datasets as nodes,
  draw edges on a canvas) → **R75** (J-1′). _Trigger: the hop-list + left-source
  `<Select>` stops scaling — a topology a human can no longer read as a list._
- **Self-joins / diamonds / general DAGs** — R74's graph is a **tree** (each new
  dataset attaches exactly once; the acyclic rule blocks revisiting a dataset). A
  dataset joined-into from two parents (a diamond) or to itself (a self-join) stays
  deferred with the standing R70/R71 triggers.
- **Left / right / outer joins, composite / multi-column keys, cross-workspace joins**
  — standing triggers hold; R74 joins **single-column, within-workspace, inner** hops
  only.
- **Query × Query composition** (a Query as a join input) → later; with it the unified
  `ds_`/`qr_` table-source resolver (R71 J-2′) earns its place.
- **Workflow / complex query (YAML + polars); rename-in-builder; result
  materialization / pinned snapshots; Excel export; dashboards** → downstream
  value-out; preview + save stay **live re-run** (the R69 execution discipline).
- **Row-explosion guard / aggregation / dedup** — a tree of `many:many` edges
  multiplies rows even more than a chain; deferred with R71's named trigger (a join
  too wide to be usable).

## Risks / unknowns

- **Engine ON-clause + topo-order is the load-bearing change.** The fold must
  reference each hop's **left source by index** (`T{left_idx}`), and the FROM clause
  must add sources in an order where every hop's left already exists. _Mitigation: the
  graph is built by appending leaves to existing nodes, so the natural insertion order
  IS a topological order; the design states it and a star test (D0 ⋈ D1 **and**
  D0 ⋈ D2) proves the fold._
- **Builder legibility for a tree-as-list.** A tree rendered as a flat hop list can
  read ambiguously (which source does this hop extend?). _Mitigation: the left-source
  `<Select>` makes each hop's parent explicit; `ui-design` (design-spec) checks the
  affordance before F builds it; the canvas (R75) is the escape hatch when the list
  stops scaling._
- **Leaf-removal vs. last-only removal.** Removing a non-leaf hop would orphan its
  descendants. _Mitigation: `[Remove]` is enabled only on **leaf** hops (a hop whose
  right dataset is no other hop's left); the design states the rule + the disabled
  state._
- **Row multiplication compounds across branches.** A star of `many:many` edges
  multiplies harder than a chain. _Mitigation: R74 keeps the live-re-run discipline
  (no materialization) and re-flags the row-explosion guard as the named future
  trigger; the design states the cardinality reality._
- **Self-join / diamond temptation.** "Join graph" tempts allowing a dataset to be
  joined twice. _Mitigation: J-1′ pins R74 to a **tree** (acyclic, each dataset once);
  diamonds/self-joins stay deferred with their triggers._

## Do

### Plan-gate ratification (2026-06-14)

- **J-1 → Extend the builder to a connected acyclic graph (a tree); defer the visual
  canvas → R75.** Relax the linear invariant so each hop's left = any source already in
  the graph; reuse R73's hop-list builder + a left-source `<Select>` per hop. One
  feature per round.
- **J-2 → Run straight through** — Plan → Design → build in one pass, no Design-gate
  STOP. R74 relaxes a constraint, not the model, so R73's model-altitude STOP isn't
  pulled; per-gate commits remain the revert seams and the topology truth-test still
  runs at Design to confirm the model holds.
- **J-1′ → Deferred to R75**: the free-form visual node-graph canvas; plus the
  standing-deferred self-joins/diamonds, left/outer/composite/cross-workspace joins,
  Query×Query composition, workflow, rename, materialization, row-explosion guard.
- **J-3 → topology rule + engine generalization held open** for the Design gate: the
  tree rule (connected + acyclic) + the `T{left_idx}` engine + topo-order execution.
  The design-model confidence-valve decision + the topology truth-test (a star).
- **J-4 → home + affordance held open** for the Design gate: extend multi-join.md
  (lean) vs. a new sibling; left-source `<Select>` + leaf-removal.
- **Invariant:** reuse R73's `ChainEditor` + the shipped predicate/run engines; the
  **only** new work is the left-source choice, the relaxed validation, and the
  `T{left_idx}` engine generalization, named honestly.

### Gate 2 — Design pass (2026-06-14)

**Docs produced / touched:**

- **Extended** [multi-join.md](../../design/data-management/queries/multi-join.md)
  (J-4 resolved → **extend the mode doc**, not fork a sibling and **not** a parallel
  page): a new **topology truth-test record (R74)**, the topology invariant relaxed
  **linear path → connected acyclic tree**, the **`T{left_idx}` engine
  generalization**, the relaxed `_resolve_chain` rule (`disconnected_join` /
  `cyclic_join`), the **left-source `<Select>` + leaf-removal** builder affordance, an
  Accessibility declaration for the new controls, the (unchanged) contract intent, and
  4 R74 acceptance criteria.
- **Updated** [query-builder.md](../../design/data-management/queries/query-builder.md)
  (trajectory: R73 multi-join chain **shipped** → **R74 join graph (tree)** →
  multi-join.md; **R75 visual canvas** reserved; surface map + status re-pointed).

**J-3 + J-4 resolved with the closed design:**

- **J-3 (topology rule + engine) → connected acyclic tree + `T{left_idx}` engine +
  topo-order.** Each hop's left = any source already in the graph (connected); its
  right ∉ the graph (acyclic — a spanning tree, no diamonds/self-joins); the engine
  joins each new source `T{k+1}` against its own left `T{left_idx}` (R73 hardcoded
  `T{k}`); joins are stored in topological order (the builder produces it naturally).
  **No model change** — `joins: JoinStep[]` already carries a tree.
- **J-4 (home + affordance) → extend multi-join.md; left-source `<Select>` +
  leaf-removal.** The mode doc grows a section rather than forking; the linear chain
  becomes the path special case. The home/affordance is free to deviate at build
  ([build-first](../../memory/2026-05-22-ui-boundary-build-first.md) twin).

**Model check (Design gate):**

- **Noun-vs-mode:** the tree is an **extension of R73's `ChainEditor`** (the same
  hop-list, predicate editors, relationship `<Select>`, `<PagedRowsView>`) — the only
  new affordance is a **left-source `<Select>`** + leaf-removal. **No** `/canvas` page,
  **no** new noun (no `JoinGraph`). **Clears.**
- **Discovered-vs-imposed:** _discovered_ — pulled by R73's named J-1′ trigger
  (written before R74) + a real report need (a Deal's account **and** its owner, both
  hanging off the Deal — a star); nothing minted. R74 **removes a constraint** the
  model never needed.
- **Design-model confidence valve INVOKED to confirm (J-2: run straight through).**
  The **topology truth-test** is recorded in
  [multi-join.md § Topology truth-test record (R74)](../../design/data-management/queries/multi-join.md#topology-truth-test-record-r74):
  the model is **VALIDATED a second time (no revision)** — `joins: JoinStep[]` already
  expresses a tree because each hop names its own `leftDatasetId`; what R73 made linear
  was a **policy** (an invariant + a path-shaped engine), not the data shape. Only the
  invariant + engine ON-clause + builder affordance generalize.

**`ui-design` (design-spec) on multi-join.md — PASS (0 gaps).** All six UX-honeycomb
facets pass; one **Findability/Accessibility** gap caught **preventively** (the new
left-source `<Select>` + the non-leaf `[Remove]` had no declared accessible
name/disabled-reason) and **remediated in-spec** (a labelled "Join from" `<Select>` in
focus order + an `aria-disabled` `[Remove]` with a text tooltip). Mirrors R71/R72/R73's
preventive catches.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), against the closed design ([multi-join.md](../../design/data-management/queries/multi-join.md)):

| Condition                            | Fired? | Justification                                                                                                                                                                                              |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The state model has 9 (Loading → Populated/HopStale/PredStale/NotFound; Editing → add-hop/remove-leaf/edit-pred; Saving → SaveRejected; Redirect).                                                          |
| 2. New interaction pattern           | no     | R74 **reuses** R73's shipped hop-list `<Select>` builder, adding a left-source `<Select>` (standard AntD) + leaf-removal. The genuinely-new drag/draw **canvas** pattern is deferred → R75.                |
| 3. High user-error risk              | no     | Editing is reversible (remove a leaf / discard reverts); invalid edits **block** Save (`422`); reads are non-destructive.                                                                                  |
| 4. Contract depends on unresolved UI | no     | R74 has **no** wire-shape change (`joins` unchanged) and **no** new enumerated error code — only free-form `422` detail messages (`disconnected_join`/`cyclic_join`). The shape is fully settled.          |
| 5. UX confidence below threshold     | no     | A small, confident delta on R73's already **human-reviewed** builder; the tree-as-list legibility concern is resolved in-spec (the left-source `<Select>` makes each hop's parent explicit), R75 the escape hatch. |

Result: **Flow: DCFBI** (only trigger 1 fires — 1 of 5, below the 2-of-5 threshold).
Unlike R73's DFCFBI: R74 reuses the human-reviewed builder, so no F1 prototype/escape
is warranted. The build chain is **D → C → F → B → I**; per the DCFBI visual-verification
gate + the [Complete-is-signed-off rule](../../memory/2026-06-14-dfcfbi-f1-needs-human-review.md),
the human still **runs the app before Review** and **Complete waits on hands-on
sign-off**, not gates-green.

**`gate-walker` (Design gate): PASS** — the round + design doc record the Design exit
criterion (journey + 4 R74 acceptance criteria in multi-join.md), the noun-vs-mode +
discovered-vs-imposed model check **and** the invoked design-model confidence valve
(the topology truth-test verdict), and the Design commit seam (below). _Structural
check only — the modeling answer's correctness remains the human reviewer's call._

**Design gate closed (J-2: run straight through).** The join-graph (tree) design is
sealed. Gate commit seams (gate = commit): Plan `18b9376` → Design `81219ac`. The
build chain proceeds **D → C → F → B → I** without a Design-gate STOP.

### Gate C — Contract (DCFBI) — (2026-06-14)

R74 changes **no wire shape and no enumerated error code** — the lightest contract
gate yet. `joins: JoinStep[]` already carries a tree (each hop names its own
`leftDatasetId`), so only the **prose** generalizes:

- **`_shared/query.yaml`** — `JoinStep`, `QueryDefinition`, and `joins` descriptions
  generalized from "linear chain / strict path" to a **connected acyclic tree** (the
  linear chain is the degenerate path case); records that hops are stored in
  topological order and validated on save (`disconnected_join` / `cyclic_join`).
- **No new route, no schema-shape change, no `values.yaml` change** — the path-invariant
  rejection R73 emitted as a free-form `422` message (`nonlinear_chain`) is replaced by
  two equally free-form messages (`disconnected_join` / `cyclic_join`); both are
  `value_error` strings in the existing `422` envelope, not enumerated codes.

**Contract gate verification:** `@mdd/contracts` OpenAPI validity **24/24** (unchanged
— no new route, no shape change). Contract seam: `ad44f51` (with F).

### Gate F — Frontend (DCFBI) — (2026-06-14)

DCFBI's F **confirms** the design into the FE-on-MSW (no F1 prototype — the
flow-selector chose DCFBI). The chain editor (`JoinEditor`) extends from R73 in place:

- **Add from any in-graph source** — `addEligible` relaxes from tail-only to **every
  valid edge driving from an in-graph dataset to a not-yet-joined one**; when **2+
  distinct sources** can branch, a **left-source `<Select>`** (`BuilderAddJoinSource`,
  _"Join from"_) gates the choice (hidden when only one source is eligible, so the R73
  single-source feel is unchanged).
- **Leaf removal** — `[Remove]` is enabled per **leaf** hop (a hop whose right is no
  other hop's left) and **disabled with a guiding tooltip** on a non-leaf;
  `useQueryBuilder.removeLastJoin` → **`removeJoin(relationshipId)`**.
- **Fixtures** — two leaf datasets (`tiers`, `regions`) + two edges (Accounts→tiers,
  Owners→regions) so a **non-tail branch** is reachable in the MSW graph; the datasets
  list serves all five so the left-source labels resolve.

**F gate verification:** builder **type-check clean**; `queries.test.tsx` **21/21**
(+2 R74: a 3rd hop branches from a **non-tail** source via the left-source `<Select>`;
`[Remove]` enabled on leaves only — the non-leaf disabled). The MSW preview stays an
illustrative confirmation (length-based canned rows); **tree-execution correctness is
the Backend's domain** (real DuckDB engine, below). F seam: `ad44f51`.

### Gate B — Backend (DCFBI) — (2026-06-14)

The engine's **first growth past a single path** — and the **model held** (the
Design-gate topology truth-test, confirmed in running code):

- **`query_joined_rows` — `T{k}` → `T{left_idx}` fold** (`rows_reader.py`): `join_keys`
  grow from `(left_col, right_col)` to **`(left_idx, left_col, right_col)`**; each hop
  joins its new source `T{k+1}` against its **own** left `T{left_idx}` (R73 hardcoded
  the immediately-previous `T{k}` — correct only for a path). Topological order means
  `T{left_idx}` is always already in the FROM clause.
- **`_resolve_chain` — linear invariant → tree** (`routers/queries.py`): a hop's left
  must already be in the graph (else **`422 disconnected_join`**) and its right must be
  new (else **`422 cyclic_join`** — a tree, not a diamond/self-join); an `index_of` map
  threads each in-graph dataset → its alias index. The per-hop `409 relationship_stale`
  gate is unchanged. The linear chain is the path special case.

**Backend gate verification:** ruff **clean**; pytest **186/186** (R73's
`nonlinear_chain` test → **star-executes** (deals ⋈ {accounts, owners}, 12 cells); +
`disconnected_join` `422`; + `cyclic_join` `422`; + the **PUT grow-a-chain-into-a-star**
lifecycle), each `validate_response`-checked against the C-gate contract. Backend seam:
`80d64af`.

### Gate I — Integration (DCFBI) — (2026-06-14)

The FE↔BE seam is the **contract**: both sides conform to the same `queries/*` YAML —
the FE's MSW chain `preview`/`put` responses are `withContractValidation`-checked
(**21/21**), the BE's are `validate_response`-checked (**186/186**). **One contract,
dual conformance** — and because R74 changed **no shape and no error code** (only the
validation semantics + free-form `422` messages), the conformance surface is identical
to R73's.

Beyond that, the **full tree lifecycle is exercised against the real ASGI app** (pytest
`TestClient` over the real router + DuckDB engine + SQLite): create → run a **star**
(deals ⋈ {accounts, owners}, both hops driving from the source) → stateless preview of
an unsaved star → **PUT grow a chain into a star** → `422 disconnected_join` (a hop's
left not in the graph) → `422 cyclic_join` (a dataset joined twice) → per-hop
`409 relationship_stale`. R74 adds **no new route and no CORS change** (only an engine +
validation generalization over the existing shapes), so R72's cross-process PUT-CORS
failure mode does not recur. Integration seam: this commit.

## Check

- [x] **J-1, J-2, J-1′ ratified** (Plan gate); **J-3, J-4 held open** → resolved at the
      Design gate (J-3 → tree rule + `T{left_idx}` engine; J-4 → extend multi-join.md +
      left-source `<Select>` + leaf-removal).
- [x] **Join-graph (tree) design authored**
      ([multi-join.md](../../design/data-management/queries/multi-join.md)): topology
      invariant relaxed to a tree, `T{left_idx}` engine, `disconnected_join`/`cyclic_join`
      validation, left-source `<Select>` + leaf-removal, Accessibility, 4 R74 criteria.
- [x] **Design-model confidence valve + topology truth-test recorded** with a verdict —
      the model is VALIDATED a second time (no revision); only the invariant + engine
      ON-clause + builder affordance generalize.
- [x] **Noun-vs-mode + discovered-vs-imposed** check recorded (mode not page;
      discovered — removes a constraint, mints nothing).
- [x] `design:lint` 0 (15 docs) · `design:tokens` 0 (12 maps) · `plan:lint` 0 ·
      `markdown-check-link` 0 broken · `markdownlint` 0.
- [x] `ui-design` (design-spec) on the tree-editor surface — **PASS, 0 gaps** (one
      Findability/Accessibility gap caught + remediated in-spec: the left-source
      `<Select>` accessible name + the non-leaf `[Remove]` disabled-reason).
- [x] `flow-selector` run + result recorded — **DCFBI** (only trigger 1 fires).
- [x] **`gate-walker` (Design gate)** — exit criterion + model checks + commit seam
      recorded.
- [x] **Build chain green** (per `flow-selector` = DCFBI): **C** — query.yaml prose →
      tree, OpenAPI **24/24**, no shape/code change (`ad44f51`); **F** — left-source
      `<Select>` + leaf-removal, `queries.test.tsx` **21/21** (`ad44f51`); **B** —
      `T{left_idx}` fold + tree validation, pytest **186/186** (`80d64af`); **I** — one
      contract / dual conformance + the real-app star lifecycle (this commit).
- [ ] **Human sign-off** — ran the app against the real backend + exercised a star
      join (Complete = signed-off, not gates-green).

## Act

**Outcome — a Query can now join one dataset to two or more others (a tree), built
straight through D → C → F → B → I.** R74 set out to relax R73's linear chain to a
**connected acyclic graph**, and it did so as the cheapest possible "grow the topology"
change: the builder's `JoinEditor` gained a **left-source `<Select>`** (extend from any
in-graph source, not just the tail) + **leaf removal**; `_resolve_chain` swapped its
linear invariant for a **tree rule** (`disconnected_join` / `cyclic_join`); and
`query_joined_rows` generalized its ON-clause from `T{k}` to **`T{left_idx}`** so each
hop joins against its own left. A star (deals ⋈ {accounts, owners}) now executes.

**The load-bearing judgment was the risk call — and it inverted R73's again.** R73
re-opened the model, so it sealed-at-Design + STOPPED and invoked the model valve. R74
**relaxes a constraint the model never needed** — `joins: JoinStep[]` already carried a
tree because each hop names its own `leftDatasetId` — so it **ran straight through**
(J-2). The [topology truth-test](../../design/data-management/queries/multi-join.md#topology-truth-test-record-r74)
held a **second** time in running code: no model revision, no new noun (`JoinGraph` was
not minted), no new route, no new error code — only the **invariant + engine ON-clause +
builder affordance** generalized. That is the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) in action: add
only the mechanism the named failure mode pulls — here, just enough to relax a guard.

**Build findings beyond the seal:**

1. **The MSW preview is topology-blind (a known confirmation-mock limit).** The FE-on-MSW
   preview keys off chain length, not the resolved tree, so it returns illustrative
   canned rows; the FE tests assert **builder mechanics** (the left-source `<Select>` +
   leaf removal), and **tree-execution correctness lives in the Backend** (the real
   DuckDB engine, pytest 186/186). Logged honestly rather than papered over — a future
   round may make the mock a real JS fold if a preview-fidelity gap is pulled.
2. **Edge dedup shaped the cyclic test.** Declaring an identical edge twice returns
   `409 relationship_exists`, so the `cyclic_join` test uses a distinct `accounts→deals`
   back-edge (right = the source, already in the graph) — a truer diamond/self-join probe.

**Learnings (notes, not promotions):**

- **The valve-to-risk match now has four data points.** R71 (model risk → model valve),
  R72 (UX risk → F1 valve, model valve declined), R73 (model **and** UX → **both**), R74
  (constraint-relaxation, no model re-open → **neither** valve; run straight through, the
  truth-test only *confirms*). The "add only the mechanism the named failure mode pulls"
  discipline now spans seal-and-STOP, F1-escape, both-at-once, **and** run-through — the
  fourth re-application of the
  [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md) /
  hybrid-flow distinction. **Strong promote candidate** (it has now governed four rounds'
  flow + valve choices, each different).
- **"Linear" was a policy, not a shape — relaxing a guard beats re-modelling.** R73's
  path constraint lived in an invariant + a hardcoded engine index, not in the data
  model. The cheapest topology growth was to **relax the guard + generalize one index**,
  not to add a graph model. A useful smell for "grow N→M" changes: check whether the
  limit is a *constraint* or the *shape* before re-opening the model.

## Feeds into → Round_75 (the visual join-graph canvas)

R75 builds the **free-form visual builder canvas / source graph** R74 deferred
(J-1′): drag datasets as nodes, draw join edges on a canvas, on top of R74's
now-shipped tree topology + engine + the relaxed validation. Its named trigger is a
topology a human can **no longer read as a hop list** — when the left-source
`<Select>` + flat hop list stops scaling. The standing-deferred capabilities
(self-joins / diamonds / general DAGs, left/outer joins, composite keys,
cross-workspace, **Query × Query composition** + the unified `ds_`/`qr_` resolver,
workflow, rename-in-builder, and a **row-explosion guard**) remain deferred with their
named triggers.
