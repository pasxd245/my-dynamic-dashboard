# Round 73: The multi-join chain — let a Query chain more than one relationship

**Status**: In Progress (Design gate sealed; STOPPED for the human's go-ahead — J-2)
**Date started**: 2026-06-14
**Date completed**:

## Goal

**Inherits from ← [Round_72](Round_72.md)** — R72 shipped the **editable
single-join builder** end to end: `[Edit]` on `/queries/:id` edits **one** join
edge + cross-source predicates, previews the unsaved copy live (a stateless
`POST …/queries/preview`), and Saves via `PUT /queries/{id}`. It **deferred the
multi-join surface as J-1′** with a named trigger:

> _Multiple joins / a visual builder canvas / source graph → R73. Trigger: a Query
> must chain more than one relationship — a multi-hop join the single-edge
> `query_joined_rows` cannot express (R73 also extends the engine)._
> ([query-construction.md § Scope](../../design/data-management/queries/query-construction.md))

R73 fills the [query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
step reserved as **"R73 multi-join canvas"** — the fifth step of the critical
path (`data → relationships → joins → construction → **multi-join** →
dashboards`). It is the **first time the join engine grows past a single edge**.

**The risk axis flips back from R72 — both valves are in play.** R72's model was
settled and twice-validated, so its only risk was **UX** and its valve was the
**F1 timebox** (re-invoking the design-model valve there would have been ceremony
misapplied). R73 is the inverse: it **re-opens the model** — today's
`QueryDefinition.join: JoinStep | None` is **singular**, and `query_joined_rows`
is **hardcoded to exactly two sources**
([rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py):
`FROM read_parquet(?) L INNER JOIN read_parquet(?) R ON …`). Expressing a **chain**
of edges is a genuine **model + engine** change, so the **design-model confidence
valve** (seal-at-Design + a chain truth-test) applies **alongside** the new-
chaining-UX risk (the F1/selector axis). Naming **which** valve fits **which**
risk is itself the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium):
add only the mechanism the named failure mode pulls — here, **both**, because
R73 carries both kinds of risk.

_Track: 1 (product feature). Pulled by ← R72 J-1′ deferral + the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
("R73 multi-join canvas") + [purpose.md](../../context/purpose.md) critical path +
key decision #4 (relationships/joins are central, not fixed). Scoped by the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) and "one
feature per round": the **linear multi-hop chain** only — the free-form visual
source-graph canvas is deferred (J-1′ → R74). Opened as a **Plan + Design pass
that seals the multi-join design at the Design gate, then STOPS** for the human's
go-ahead before any C/F1/F2/B/I (J-2)._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-14)

| #    | Question          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-1  | **Scope** of R73  | **Split → the multi-hop engine + linear-chain editing only** (ratified). Grow `query_joined_rows` to fold an **ordered list** of governed edges into a **linear chain** of inner joins, and let R72's existing builder **add / remove** a join step that **extends from the chain's tail dataset**. **Defer the free-form visual source-graph canvas → R74** (J-1′). Mirrors the R71 (join _execution_) → R72 (rich _surface_) split: ship the engine + minimal chain editing first, the canvas when a non-linear topology actually pulls it. Honors "one feature per round" + the [brake](../../context/purpose.md#dynamic-equilibrium). |
| J-2  | **Round shape**   | **Seal at Design, then STOP** (ratified). Plan + Design only this pass: author + seal the multi-join design at the Design gate, run the **design-model confidence valve** (the chain truth-test) + `flow-selector` + `ui-design` (design-spec), commit the Design seam, and **STOP** for the human's explicit go-ahead before any C/F1/F2/B/I. The cheapest revert seam (a committed design doc) ahead of a build that **re-opens the engine** — here braking **model** uncertainty (R71's axis) as well as UX (R72's).                                                                                                                   |
| J-1′ | **Sub-scope cut** | **Deferred → R74** (ratified): the **free-form visual builder canvas / source graph** and **non-linear topology** (a dataset joined to 2+ others — a star/tree, not a path). Still deferred with their standing triggers: **left / right / outer joins**, **composite / multi-column keys**, **self-joins**, **cross-workspace** joins, **Query × Query composition** (+ the unified `ds_`/`qr_` resolver), **workflow (YAML + polars)**, **rename-in-builder**, **result materialization**. R73 stays **linear, single-column-per-hop, within-workspace, inner**.                                                                        |

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                                       | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **The chain model shape** (re-opens the model) | `QueryDefinition.join: JoinStep \| None` is **singular**. A chain needs an **ordered** representation. Candidates: **(a)** migrate `join` → **`joins: JoinStep[]`** (a single join is just a length-1 chain; one field, clean superset; needs a back-compat read of legacy `join` + a contract change to existing shapes); **(b)** keep `join` + add a separate `joins` for hops past the first (avoids migration, but two fields expressing one concept — a model smell). This is the **design-model confidence-valve decision** + a **chain truth-test** (does folding N edges compose correctly; does it re-open the `Relationship` edge?). Lean: **(a)**, sealed at Design, the build free to deviate.                                                  |
| J-4 | **Doc home + the linear-chain topology rule**  | **Home:** a new **`multi-join.md`** sibling mode doc (the trajectory reserved an "R73" step) vs. extending [joins.md](../../design/data-management/queries/joins.md) / [query-construction.md](../../design/data-management/queries/query-construction.md). **Topology rule:** R73 is a **strict linear path** — each new edge's **left/driving dataset is the chain's current tail** (so the chain stays a path, not a tree) — vs. allowing an edge onto **any** dataset already in the chain (a tree/star → the canvas's job). Lean: **a new `multi-join.md`**; **strict linear path** (tail-extension), tree/star → R74. Sealed at Design (home/mechanism free to deviate — the [build-first](../../memory/2026-05-22-ui-boundary-build-first.md) twin). |

**Invariant (the R69 → R72 anti-duplication rule):** every new/extended surface is
**reuse** of an existing component / layout / engine, never a parallel page or a
re-invented predicate / dtype / join engine
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)). The
chain editor **extends** R72's builder (the same eligible-relationships `<Select>`,
the same chip/advanced predicate editors over `resolvedColumns`, the same
`<PagedRowsView>` preview); the **only** genuinely-new work is the **chained
`QueryDefinition`** + the **multi-hop fold** in `query_joined_rows` — named
honestly, not laundered through "reuse".

## Plan (by gate)

1. **Plan gate** — ratify J-1, J-2, J-1′ with the human; record J-3, J-4 as
   **held open** for the Design gate. Commit the ratified round file as the
   Plan-gate seam.
2. **Design gate — seal the multi-join design (the round's core):**
   - **Author the multi-join design** (home chosen per J-4): the **chained
     `QueryDefinition`** (J-3 resolved), the **effective column space** generalized
     from `left ++ right` to the ordered concatenation across **all** chained
     datasets (collision rule unchanged — qualify duplicate names by dataset), the
     **multi-hop `query_joined_rows`** fold (`FROM read_parquet(D1) JOIN
read_parquet(D2) ON … JOIN read_parquet(D3) ON …`), the **chain editor** UX in
     R72's builder (add a hop from the tail / remove the last hop), the per-hop
     **`409 relationship_stale`** gate, the **linear-chain constraint** (J-4), the
     states, and Accessibility declared (not inferred). Each acceptance criterion →
     ≥1 future F/B/I test.
   - **Run the design-model confidence valve (the chain truth-test):** does the
     R70 `Relationship` edge carry a **multi-hop** join's needs, or does chaining
     re-open it? Trace a concrete 2-hop join end to end; record the verdict
     (expected: the **edge** holds — each hop is still one governed `rel_`; the
     **`QueryDefinition` + engine** grow). Mirrors [joins.md § Truth-test](../../design/data-management/queries/joins.md#truth-test-record-j-4).
   - **Resolve J-3 (chain model shape)** and **J-4 (home + topology rule)** with
     the closed design; update [query-builder.md](../../design/data-management/queries/query-builder.md)
     (trajectory: R72 construction **shipped**; **R73 multi-join chain** → its home;
     **R74 visual canvas** reserved) and cross-link the siblings.
3. **Design-gate verification** — chain truth-test recorded; noun-vs-mode +
   discovered-vs-imposed check; `ui-design` (design-spec) on the multi-join surface;
   `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link`;
   `gate-walker` confirms the Design exit criterion; run **`flow-selector`** to
   sequence the build chain for the next session — and **STOP** (J-2).

## Acceptance criteria (this round = Plan + Design gates only)

- [ ] **J-1, J-2, J-1′ ratified** with the human and recorded in Do; **J-3, J-4
      recorded as held open**, then **resolved at the Design gate**.
- [ ] **Multi-join design authored** (home per J-4) specifying: the **chained
      `QueryDefinition`** (J-3), the generalized effective column space + the
      multi-hop `query_joined_rows` fold, the **chain editor** in R72's builder, the
      per-hop stale gate, the **linear-chain constraint**, the states, Accessibility,
      and the contract intent.
- [ ] **Design-model confidence valve invoked** (unlike R72): the **chain
      truth-test** is recorded — does the `Relationship` edge carry a multi-hop
      join, or does chaining re-open the model? — with a verdict; the **model
      change** (`join` → a chain) and the **engine growth** are named honestly,
      not hidden under "reuse".
- [ ] **Noun-vs-mode check passes**: the chain editor is an **extension of R72's
      Edit mode**, not a parallel `/builder` canvas page or a re-invented predicate /
      join engine — the noun-vs-mode default
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)).
- [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken, `markdownlint` 0; `ui-design` (design-spec)
      per-facet report attached (PASS, 0 gaps); `gate-walker` confirms the Design
      exit criterion met.
- [ ] Plan gate and the Design seam **committed separately** (revert seams);
      `flow-selector` run recorded; round **STOPS** at the Design gate (J-2) — no
      C/F1/F2/B/I this round.

## What is OUT of scope

- **Any C/F1/F2/B/I code** — the chain editor UI, the multi-hop engine fold, the
  contract changes, tests. Sequenced by `flow-selector` at Design exit; built in
  later per-gate commits **on the human's go-ahead** (J-2).
- **The free-form visual builder canvas / source graph + non-linear topology**
  (a dataset joined to 2+ others) → **R74** (J-1′). _Trigger: a Query must join one
  dataset to two or more others — a branch the linear chain cannot express._
- **Left / right / outer joins, composite / multi-column keys, self-joins,
  cross-workspace joins** — standing R70/R71/R72 triggers hold; R73 chains
  **single-column, within-workspace, inner** hops only.
- **Query × Query composition** (a Query as a join input) → later; with it the
  **unified `ds_`/`qr_` table-source resolver** (R71 J-2′) earns its place.
- **Workflow / complex query (YAML + polars); rename-in-builder; result
  materialization / pinned snapshots; Excel export; dashboards** → downstream
  value-out; preview + save stay **live re-run** (the R69 execution discipline).
- **Row-explosion guard / aggregation / dedup** — a real concern once a chain
  multiplies rows; deferred with R71's named trigger (a join too wide to be usable).

## Risks / unknowns

- **Model-altitude risk is back (the central one).** R73 re-opens the
  `QueryDefinition` and grows the engine; getting the **chain representation**
  wrong (J-3) is the expensive error here. _Mitigation: J-2 seal-at-Design + STOP;
  the design-model confidence valve + the chain truth-test, exactly R71's
  mechanism — invoked here because the model genuinely re-opens (the discipline R72
  declined because its model was settled)._
- **Row multiplication compounds across hops.** A `many:many` edge multiplies
  rows; a **chain** of them compounds — a 2-hop chain can explode well past one
  join. _Mitigation: R73 keeps the live-re-run discipline (no materialization) and
  flags row-explosion as a named future trigger; the design states the cardinality
  reality rather than papering over it._
- **Chain-shape creep toward the canvas (J-1′).** "Multi-join" tempts building the
  free-form graph now. _Mitigation: J-1′ pins R73 to a **linear path** (tail
  extension); the canvas is R74 with a named trigger (non-linear topology)._
- **Engine-reuse must hold.** The multi-hop fold must **reuse** the shipped
  predicate fragment builders (`build_filter_sql` / `build_advanced_sql` / `?q=`)
  with side-qualified identifiers over the generalized column index — **not** fork a
  chain-aware predicate engine. _Mitigation: an explicit reuse acceptance criterion;
  R71/R72 already proved predicates resolve over the combined space._
- **The single→chain migration (J-3).** If J-3 picks `join` → `joins[]`, stored
  single-join definitions must read back as a length-1 chain (no data loss).
  _Mitigation: design states the back-compat read shim; flagged for the Contract +
  Backend gates._

## Do

### Plan-gate ratification (2026-06-14)

- **J-1 → Multi-hop engine + linear-chain editing** (split): grow
  `query_joined_rows` to fold an ordered list of edges into a **linear** inner-join
  chain, and let R72's builder add/remove a hop that extends from the chain's tail.
  **Defer the free-form visual canvas → R74.** One feature per round.
- **J-2 → Seal at Design, then STOP**; build on the human's go-ahead in a later
  session. The cheap revert seam ahead of a build — braking **both** model
  uncertainty (R71's axis, re-opened here) **and** chaining-UX uncertainty (R72's).
- **J-1′ → Deferred to R74**: the visual source-graph canvas + non-linear topology;
  plus the standing-deferred left/outer/composite/self/cross-workspace joins,
  Query×Query composition, workflow, rename, materialization.
- **J-3 → chain model shape held open** for the Design gate (re-opens the model):
  migrate `join` → `joins: JoinStep[]` (lean) vs. a second field. The design-model
  confidence-valve decision + the chain truth-test.
- **J-4 → home + topology rule held open** for the Design gate: a new
  `multi-join.md` (lean) vs. extending a sibling; strict linear path (tail
  extension, lean) vs. a tree/star (→ R74 canvas).
- **Invariant:** reuse R72's builder + the shipped predicate/run engines; the
  **only** new work is the chained definition + the multi-hop fold, named honestly.

### Gate 2 — Design pass (2026-06-14)

**Docs produced / touched:**

- **Authored** [multi-join.md](../../design/data-management/queries/multi-join.md)
  (J-4 resolved → a **new `queries/` mode doc**, not extending a sibling and **not**
  a parallel page): the chain truth-test, the **chained `QueryDefinition`**, the
  honest new-vs-reused split, the generalized effective column space + the multi-hop
  fold, the chain-editor UX, the per-hop stale gate, the linear-chain constraint, an
  explicit Accessibility declaration, the contract intent, scope, and 10 acceptance
  criteria.
- **Updated** [query-builder.md](../../design/data-management/queries/query-builder.md)
  (trajectory: R72 construction **shipped** → R73 multi-join chain →
  multi-join.md; **R74 visual canvas** reserved; sibling list + surface map
  re-pointed) and cross-linked
  [joins.md](../../design/data-management/queries/joins.md) +
  [query-construction.md](../../design/data-management/queries/query-construction.md)
  (their R73 defer-lines now point forward to multi-join.md).

**J-3 + J-4 resolved with the closed design:**

- **J-3 (chain model shape) → migrate `join` → `joins: JoinStep[]`** (option (a)):
  a single join is a length-1 chain; one field, clean superset, with a back-compat
  read shim for legacy singular `join`. The second-field option (b) was rejected as
  a model smell. The migration seam (read-shim vs. rewrite) is flagged for the
  Contract/Backend gates; the **shape** is sealed.
- **J-4 (home + topology) → a new `multi-join.md`; strict linear path**
  (tail-extension — each hop's left dataset is the chain's tail). Tree/star topology
  → R74's canvas. The home/mechanism is free to deviate at build
  ([build-first](../../memory/2026-05-22-ui-boundary-build-first.md) twin).

**Model check (Design gate):**

- **Noun-vs-mode:** the chain is an **extension of R72's Edit mode** (the
  `JoinEditor` becomes a `ChainEditor`; the builder panel lists hops) reusing the
  detail shell, the predicate editors, R71's relationship `<Select>`, and
  `<PagedRowsView>`. **No** parallel canvas page, **no** new noun. **Clears.**
- **Discovered-vs-imposed:** _discovered_ — pulled by R72's named J-1′ trigger
  (written before R73) + a real report need (a Deal's account **and** its owner in
  one table); nothing minted to justify a model.
- **Design-model confidence valve INVOKED (the inverse of R72).** The **chain
  truth-test** is recorded in
  [multi-join.md § Truth-test](../../design/data-management/queries/multi-join.md#truth-test-record-the-chain-truth-test--design-model-confidence-valve):
  the `Relationship` **edge is VALIDATED (no revision)** — each hop is one governed
  `rel_`, carrying its two sources + validated key pair + per-edge freshness gate
  exactly as for one join — while the **`QueryDefinition` + engine genuinely
  re-open** (singular `join` → an ordered chain; `query_joined_rows` grows from a
  fixed two-source join into a fold over N sources). The model change + engine
  growth are **named honestly**, not laundered under "reuse" — R72's risk was UX, so
  it declined this valve; R73's risk is model, so it invokes it.

**`ui-design` (design-spec) on multi-join.md — PASS (0 gaps).** All six UX-honeycomb
facets pass; one **Findability/Usability** gap caught **preventively** (the
`[+ Add a join]` affordance had no declared **disabled / no-eligible-tail-edge**
state) and **remediated in-spec** (disabled + the R71 guiding tooltip, no dead-end
empty `<Select>`). Mirrors R71/R72's preventive design-spec catches.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)), against the closed design ([multi-join.md](../../design/data-management/queries/multi-join.md)):

| Condition                            | Fired? | Justification                                                                                                                                                                                                                                   |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The state model has 8 branches (Loading → Populated / HopStale / PredStale / NotFound; Editing → add-hop / remove-hop / edit-pred; Saving → SaveRejected; Redirect), well past 3.                                                               |
| 2. New interaction pattern           | yes    | An **ordered chain editor** (append-a-hop-from-the-tail / remove-the-last-hop, under a linear-path constraint) is genuinely new — R72's `JoinEditor` edits **one** edge; no shipped surface manages an ordered, topology-constrained chain.     |
| 3. High user-error risk              | no     | Editing is reversible — remove the last hop / discard reverts; invalid edits **block** Save; reads are non-destructive. (Row-multiplication compounds across hops, but it is non-destructive and live-re-run, not an irreversible commit.)      |
| 4. Contract depends on unresolved UI | no     | The contract **shape** is settled at Design by J-3 (`joins: JoinStep[]` replaces `join`); the open items (the legacy-`join` migration seam; whether the `409` body names the hop index) are a Backend detail + a minor field, not a route fork. |
| 5. UX confidence below threshold     | yes    | The product's **first** chain builder — how to render a growing chain, enforce tail-extension legibly, and surface compounding row-multiplication are real "not sure this is the right feel yet" questions.                                     |

Result: **Flow: DFCFBI (triggers 1, 2, 5)**. The build chain (D → **F1** → C →
**F2** → B → I) is sequenced for a later session **on the human's go-ahead** (J-2);
per the [DFCFBI-F1-human-review rule](../../memory/2026-06-14-dfcfbi-f1-needs-human-review.md)
(the R72 lesson), **F1 must hard-stop for the human to exercise the running chain
editor** before Contract — DFCFBI fires precisely because the UX is uncertain, and
MSW/pytest cannot judge feel / layout / browser preflight.

**`gate-walker` (Design gate): PASS** — the round + design doc record the Design
exit criterion (journey + 10 acceptance criteria in multi-join.md), the
noun-vs-mode + discovered-vs-imposed model check **and** the invoked design-model
confidence valve (the chain truth-test verdict), and the Design commit seam (below).
_Structural
check only — the modeling answer's correctness remains the human reviewer's call._

**Design gate closed + STOPPED (J-2).** The multi-join design is sealed. Gate commit
seams (gate = commit): Plan `7793897` → Design (this commit). Each gate independently
revertable. The build chain awaits the human's go-ahead.

## Check

- [x] **J-1, J-2, J-1′ ratified** (Plan gate); **J-3, J-4 held open** → resolved at
      the Design gate (J-3 → `joins: JoinStep[]`; J-4 → new `multi-join.md` +
      strict linear path).
- [x] **Multi-join design authored**
      ([multi-join.md](../../design/data-management/queries/multi-join.md)): chained
      `QueryDefinition`, generalized effective columns + multi-hop fold, chain
      editor, per-hop stale gate, linear-chain constraint, states, Accessibility,
      contract intent, 10 acceptance criteria.
- [x] **Design-model confidence valve + chain truth-test recorded** with a verdict —
      the `Relationship` edge is VALIDATED (no revision); the `QueryDefinition` +
      engine genuinely re-open.
- [x] **Noun-vs-mode + discovered-vs-imposed** check recorded (mode not page;
      discovered).
- [x] `design:lint` 0 (15 docs) · `design:tokens` 0 (12 maps) · `plan:lint` 0 ·
      `markdown-check-link` 0 broken (all links resolve) · `markdownlint` 0.
- [x] `ui-design` (design-spec) on the multi-join doc — **PASS, 0 gaps** (one
      Findability/Usability gap caught + remediated in-spec: the disabled
      no-eligible-tail-edge state).
- [x] `flow-selector` run + result recorded — **DFCFBI (triggers 1, 2, 5)**.
- [x] **`gate-walker` (Design gate)** — exit criterion + model checks + commit seam
      recorded (verdict in Act).
- [x] Plan gate and Design seam **committed separately**; round STOPPED at the
      Design gate (J-2) until the human's go-ahead.

## Act

**Outcome — the multi-join design is sealed at the Design gate, and the round STOPS
for the human's go-ahead (J-2).** R73 set out to let a Query **chain more than one
relationship**, and the design does that as a **mode**, not a new noun: the singular
`QueryDefinition.join` generalizes to an ordered **`joins: JoinStep[]`** (a single
join is a length-1 chain), `query_joined_rows` grows from a fixed two-source join
into a **fold over N sources**, and R72's `JoinEditor` becomes a **`ChainEditor`**
(append a hop from the tail / remove the last hop) under a **linear-path**
constraint. [multi-join.md](../../design/data-management/queries/multi-join.md) seals
it; the trajectory now reads R72 construction **shipped** → **R73 multi-join chain**
→ **R74 visual canvas**.

**The risk-axis call was the load-bearing judgment — and it inverted R72's.** R72's
model was settled, so re-invoking the design-model valve would have been ceremony;
R73 **genuinely re-opens the model** (singular join → a chain; the engine grows past
one edge), so it **invokes** that valve. The chain truth-test split the question
cleanly: the **`Relationship` edge holds** (each hop is one governed `rel_`, carrying
its sources + key pair + freshness gate exactly as for one join — **no revision**),
while the **`QueryDefinition` + engine re-open** (the ordered `joins` + the fold).
Naming **which** valve fits **which** risk is the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) in
action: R71 = model valve, R72 = F1 valve, R73 = **both** (model valve at Design +
DFCFBI/F1 for the chaining UX).

**Design-gate findings beyond the seal:**

1. **The legacy-`join` migration is the build's first fork** — migrating singular
   `join` → `joins[]` (J-3) needs a back-compat read of stored definitions; the
   **shape** is sealed now, the **seam** (read-shim vs. one-time rewrite) is
   deliberately left for the Contract/Backend gates (it depends on the persistence
   layer, not the UX).
2. **A scope-tightening caught at the design-spec gate** — `ui-design` flagged the
   `[+ Add a join]` affordance had no declared **no-eligible-tail-edge** state;
   remediated in-spec (disabled + the R71 guiding tooltip), so the spec is
   affordance-consistent before F builds it.

**Next (on the human's go-ahead):** the **DFCFBI** build chain (D → **F1** → C →
**F2** → B → I), each its own commit seam. Per the
[DFCFBI-F1-human-review rule](../../memory/2026-06-14-dfcfbi-f1-needs-human-review.md)
(the R72 lesson), **F1 hard-stops for the human to exercise the running chain
editor** before Contract — DFCFBI fires precisely because the chaining UX is
uncertain, and MSW/pytest cannot judge feel / layout / browser preflight.

**Learnings (notes, not promotions):**

- **The valve-to-risk match now has three data points.** R71 (model risk → model
  valve), R72 (UX risk → F1 valve, model valve **declined**), R73 (model **and** UX
  risk → **both** valves). The discipline "add only the mechanism the named failure
  mode pulls" held across an invert and a both-at-once — this is the third
  re-application of the
  [specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md) /
  hybrid-flow valve distinction. **Candidate to promote** (the don't-add-until-pulled
  rule has now fired three rounds running).
- **A model generalization (singular → ordered) is a clean superset when the
  length-1 case is the old case.** `join` → `joins:[join]` adds no concept — it
  arity-generalizes one — which is why the truth-test could validate the edge while
  re-opening only the definition/engine. A useful shape for "grow N from 1" changes.

## Feeds into → Round_74 (the visual multi-join canvas)

R74 builds the **free-form visual builder canvas / source graph** R73 deferred
(J-1′): non-linear join topology (a dataset joined to 2+ others — a star/tree the
linear chain cannot express), on top of R73's now-shipped multi-hop engine + linear
chain editor. Its named trigger is a Query that must **join one dataset to two or
more others** — a branch the linear path cannot represent. The standing-deferred
joins (left/outer, composite keys, self, cross-workspace), **Query × Query
composition** (+ the unified `ds_`/`qr_` resolver), workflow, rename-in-builder,
and a **row-explosion guard** remain deferred with their named triggers.
