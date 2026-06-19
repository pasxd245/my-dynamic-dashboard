# Round 91: query×query joins — model truth (wire + engine: a saved Query joinable on a hop's right)

**Status**: Review (Contract + Backend + Integration agent-verified; awaiting human `Complete`)
**Date started**: 2026-06-19
**Date completed**: —
**Flow**: **DCFBI** — amended from DFCFBI(2,5) at the Design→build boundary (see the Do-log
**Amendment** entry). R91 is a **no-new-UI model-truth round** (wire + engine + FE types) → DCFBI by
construction; the canvas query×query **UX** (the DFCFBI feel-check) moves to **R92**. Mirrors the
[[query-owned-relationships]] R88 (model truth) → R89 (canvas UX) sequencing.

## Goal

**Inherits from ← [Round_90](Round_90.md)** — the free-form canvas is hardened and proven on the
real stack. R90's own follow-up flagged the next pull: **query↔query joins — a saved Query as a
*non-driving, joined-in* source** ([Round_90 line 216](Round_90.md)). Today a `qr_` can only be the
**driving base** (composition); every join hop's **right** side resolves as a dataset. This theme
lets a `qr_` appear on the **right** of a hop — composing saved queries as peers, not only as a
base.

R91 **opens the query×query-joins theme** (the human's Plan-gate call: _continue the
free-form/relationships theme, not dashboards yet_). It realizes the
[[query-is-virtual-dataset]] "unify `ds_` ∪ `qr_` as one readable table-source" direction and
closes a named scope boundary in
[queries.md](../../design/data-management/queries/queries.md) OUT-of-scope.

**R91 = the model-truth slice** (the wire + engine + FE types; **no new canvas UX**): the
`QueryRelationship` edge gains a polymorphic `rightSourceId` (`ds_|qr_`), and the resolver routes a
hop's right side through `resolve_source` so a saved Query resolves as a joined-in subquery in DuckDB.
The **canvas UX** that lets a user *draw* a query-in-join (query node + 🔎 marker + `[+ Add a source]`
offering `qr_` + Promote-suppression + the unavailable state — decisions 3, 8–11) lands at **R92** as
a DFCFBI round with a real F1 feel-check on this now-working stack. _Why split this way: grounding in
the code showed query×query is wire+engine-bound, so a pre-Contract F1 (the DFCFBI default) can't show
a working prototype — model truth must come first (the R88→R89 precedent). See the Do-log Amendment._

_Track: 1 (product — model + engine + canvas evolution that completes the relationships theme).
Pulled by ← [Round_90](Round_90.md) "Query↔query joins → R91+" (human-flagged, 2026-06-19) +
[queries.md](../../design/data-management/queries/queries.md) OUT-of-scope boundary +
[[query-owned-relationships]] + [[query-is-virtual-dataset]]. Per the
[Evolution Rule](../../AGENTS.md)._

## Plan-gate ratification (2026-06-19)

The human chose the **theme** at the Plan gate (over the alternative — opening dashboards/value-out):

- ✅ **Theme = query×query joins / continue the free-form theme.** Dashboards (value-out) is
  deferred to a later theme — the builder substrate keeps deepening first.
- ✅ **Brainstorm-first** — like the [[query-owned-relationships]] theme (brainstorm → R88–R90).
  Brainstorm written: [`2026-06-19-query-x-query-joins.md`](../brainstorms/2026-06-19-query-x-query-joins.md).
- ✅ **Scope sub-fork = brainstorm + thin slice** (human, 2026-06-19) — build the vertical slice
  this round (resolver routes the right side through `resolve_source`; rel model + contract
  widened; canvas offers `qr_` sources + renders query-node handles, closing the R90 composed-base
  gap; Promote suppressed on `qr_` edges). Proceed to the Design gate + `flow-selector`. See the
  brainstorm §6.

## What the brainstorm settled (proposals to seal at Design)

Full detail: [the brainstorm](../brainstorms/2026-06-19-query-x-query-joins.md). Key findings:

- **The engine is ~80% there.** `resolve_source` already resolves any source polymorphically
  (`ds_`|`qr_`) with cycle-guarding; the resolver's **right side** is the only place that bypasses
  it (hardcoded `_SELECT_DATASET`, [queries.py ~210](../../../workspace/apps/backend/app/routers/queries.py#L210)).
  The BE change is mostly: route the right side through `resolve_source`, threading `visited`.
- **The crux — query×query edges have no governed counterpart.** Governed rels are hard-wired
  dataset↔dataset (FKs). So a `qr_`-side edge is a distinct species: **free-form-only,
  non-promotable**; the governed ER is **not** re-opened. The R88 copy-on-pick/promote symmetry
  stays intact (query×query lives outside it).
- **One FE capability closes two gaps.** Rendering a query's effective columns as a
  handle-bearing canvas node serves both *joining a query in* **and** the R90-flagged
  **composed-base-no-handles** gap.

## Plan (by gate — DCFBI model-truth, the wire + engine)

1. **Plan gate** — theme ratified + scope sub-fork = **brainstorm + thin slice**. _(CLOSED —
   human-ratified 2026-06-19.)_
2. **Design gate** — model sealed (11 decisions below); `ui-design` design-spec run; `flow-selector`
   recorded → **DCFBI** (amended). _(CLOSED — commit `9cd33e9` + the Amendment entry.)_
3. **Contract gate** — rename `QueryRelationship.leftDatasetId`/`rightDatasetId` →
   `leftSourceId`/`rightSourceId` in `_shared/query.yaml`; **`rightSourceId` pattern `^(ds_|qr_)…`**
   (left stays `^ds_…` — right-side-first, decision 2); align MSW + `contract-validator`; rename the FE
   `types.ts`, the working-copy bridge (`chain.ts`), and `joinGraph.ts`. **No new canvas UX.**
4. **Backend gate** — `_resolve_chain` routes a hop's **right** through `resolve_source`
   (parquet for `ds_`, `(<subquery>) AS Ti` for `qr_`), threading `visited` so a self/transitive
   join-in → **`composition_cycle`**; effective-column naming per decision 5 **with a unit test**;
   `relationships.py` stays dataset-only; pytest green (new qr_-right + cycle cases).
5. **Integration gate** — real stack (live backend + DuckDB + seed): a `qr_`-right join **runs**
   end-to-end; a self-join-in is `composition_cycle`-rejected; conformance green against MSW **and**
   the real backend; CORS clean. Human review → `Complete`.

## Acceptance criteria

- [x] **Theme + scope + model + flow ratified** — query×query joins; brainstorm + thin slice; 11
      decisions sealed; DCFBI (amended) — all human-ratified (2026-06-19).
- [ ] **Wire renamed + widened** — `leftSourceId`/`rightSourceId` replace `…DatasetId`; `rightSourceId`
      accepts `^(ds_|qr_)…`; conformance (MSW `additionalProperties:false` + `contract-validator`) green;
      governed `relationships/*.yaml` unchanged (dataset-only).
- [ ] **A saved Query joins in on the right** — a definition with a `qr_` `rightSourceId` resolves via
      `resolve_source` and **runs in DuckDB** (the joined-in query baked as a subquery), paged, in
      effective-column order; collision-qualified names hold across the nested boundary (decision 5, tested).
- [ ] **Cycle + stale reuse existing guards** — a self/transitive join-in → `composition_cycle`; a
      drifted exposed column → `relationship_stale`; deleting a joined-in query stales dependents
      (app-level cascade).
- [ ] **No new UI** — the canvas/Form UX is unchanged this round beyond the mechanical field rename;
      the query×query *drawing* UX is R92.

## Risks / unknowns

- **Governance dilution** — query×query edges could erode the dataset-centric ER. _Mitigation:
  `qr_`-side edges are free-form-only, non-promotable; the governed ER is never re-opened._
- **Effective-column ambiguity** across nested queries. _Mitigation: seal the naming rule at
  Design with a test; reuse `build_effective_columns`._
- **Over-building the model** — repeating an R69-style specious model. _Mitigation: the engine is
  already polymorphic; the slice extends it, doesn't reinvent. Cardinality stays advisory (R90)._
- **Scope creep toward dashboards** — value-out is the explicitly-deferred next theme.

## Do

### Plan-gate: theme pivot ratified + brainstorm written (2026-06-19)

Opened from [Round_90](Round_90.md)'s "Feeds into → Round_91+" on the human's instruction
("proceed r91"). The first Plan-gate draft framed R91 as **dashboards**; the human redirected to the
R90-flagged **query↔query joins** follow-up ("should it QueryxQuery? Continue on free-form?"). After
grounding the claim against the real code (resolver right-side hardcodes a dataset; queries.md
OUT-of-scope names this deferred), the human **chose the query×query theme** over dashboards. A
[brainstorm](../brainstorms/2026-06-19-query-x-query-joins.md) was written settling the model
proposals. **Awaiting the human's scope sub-fork** (brainstorm+slice vs. brainstorm-only) before any
Design/`flow-selector` work.

### Design gate — model sealed (2026-06-19)

Sealed against the [brainstorm](../brainstorms/2026-06-19-query-x-query-joins.md). Per
[[design-docs-are-source-code]] the design docs (queries.md / canvas.md) are **not** rewritten here
(they stay code-true and re-sync to the actual build later); the Design deliverable is this sealed
model + the `ui-design` design-spec check + the flow selection.

**Decisions (human-ratified where noted):**

1. **Rel-edge source fields → rename** `leftDatasetId`/`rightDatasetId` → **`leftSourceId`/`rightSourceId`**,
   typed polymorphic `^(ds_|qr_)[0-9a-f]{8}$` (matches the existing `sourceId` convention). _(human,
   2026-06-19)_ Clean-slate makes it cheap (on `dev`, no back-compat; the model lives in the
   `definition_json` blob → **no DDL**). Touches: `query.yaml`, `common.py`, `types.ts`, the resolver,
   `chain.ts`, the canvas, tests.
2. **Direction scope → right-side-first** — a `qr_` is supported only on the **right** of a hop
   (joined-IN) this round. `qr_` on the left follows in a later round if cheap. _(human, 2026-06-19)_
3. **Query×query edges are free-form-only, non-promotable** — they have no governed (`ds_↔ds_`) home;
   the governed ER is **not** re-opened. The canvas suppresses **Promote** on any edge with a `qr_`
   side; divergence-warn does not apply (no origin). _(brainstorm §3, decision A.)_
4. **Resolver — route the right side through `resolve_source`** (not the hardcoded `_SELECT_DATASET`),
   threading the `visited` frozenset so a query that joins itself in (directly/transitively) reuses the
   existing **`composition_cycle`** guard. A `qr_` right side bakes as `(<subquery>) AS Ti` — the fold
   `query_joined_rows` already emits for a composed base; **no engine reshape**. _(brainstorm §2.)_
5. **Effective-column naming** — a joined-in query contributes its **effective** (already
   collision-qualified) columns; `build_effective_columns` qualifies by the source's display name (a
   dataset name **or** the query's name). On a residual collision the existing bare→qualified rule
   applies one more level. **Sealed with a unit test** at build (the one genuinely-new sub-problem).
   _(agent decision; brainstorm §4.)_
6. **Freshness / cascade — reuse what exists** — re-resolve the inner query each run; a drifted exposed
   column → existing **`relationship_stale`**; deleting a joined-in query stales dependents via the
   **app-level** cascade (polymorphic, no FK), like the `source_id` precedent. _(brainstorm §4.)_
7. **Contract** — widen `query.yaml#/QueryRelationship` side patterns to `^(ds_|qr_)…` (under the
   rename); `relationships/*.yaml` stays **dataset-only** (governed ER unchanged). Confirm MSW
   `additionalProperties:false` + `contract-validator` stay green. _(brainstorm §7.)_
8. **Canvas — one capability closes two gaps** — rendering a query as a column-bearing, handle-bearing
   node (via its `resolvedColumns`) serves both *joining a query in* **and** the R90-flagged
   **composed-base-no-handles** gap; fold the gap-fix into the same node-render path. `[+ Add a source]`
   offers `qr_` sources; `joinGraph.ts` is already polymorphic-ready. _(brainstorm §5.)_
9. **Query-node distinction (Findability)** — _(added from the `ui-design` design-spec review — 3
   facet gaps closed by decisions 9–11)_ — a joined-in query node renders a **text+glyph marker**
   (a 🔎 glyph + a "query" `<Tag>`), paralleling the `◆` driving-node marker (canvas.md) and the
   Queries-catalog 🔎 (queries.md); the `[+ Add a source]` picker **disambiguates** `qr_` from `ds_`
   (a group or 🔎 prefix), so a node/option named "Won deals" is never an ambiguous dataset-or-query.
10. **Form-tab parity (Accessibility)** — joining in a query is **also reachable on the keyboard/SR
    Form tab** (the hop-list source picker offers `qr_` sources too), preserving canvas.md's
    AT-complete invariant ("every canvas edit is reachable on the Form tab"). _This is a scope
    addition the design review surfaced — not canvas-only._
11. **Joined-in-query-unavailable node state (Credibility)** — a deleted/stale joined-in query renders
    a **guided "query unavailable" node state** (flag-don't-crash, [purpose.md](../../context/purpose.md)
    #5), parallel to the per-edge stale `<Alert>`; the backend `relationship_stale` (decision 6) stays
    the authoritative run gate.

**Model check** (Design gate):

- **Noun-vs-mode**: **mode/extension — no new noun.** Query×query joins extends the existing **Query**
  noun + the **Canvas** edit-mode; the `QueryRelationship` gains polymorphic source refs (`ds_|qr_`) but
  mints **no new entity, table, or route**. ([[design-gate-noun-vs-mode]]; canvas.md "why a mode, not a
  noun".)
- **Discovered-vs-imposed**: **discovered** — the engine is **already polymorphic** (`resolve_source`
  resolves `ds_|qr_` with cycle-guarding) and `joinGraph.ts` is **already polymorphic-ready** (generic
  `Edge`, no id introspection); the change extends proven machinery, evidenced by the code map
  independent of this design (the resolver's right-side is the lone non-polymorphic spot). Not imposed.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | The new branches (qr_-edge always-free-form, promote-suppressed, query-node-unavailable) reuse existing copy/define/stale state shapes — 3, not >3; the canvas state model isn't fundamentally expanded. |
| 2. New interaction pattern           | yes    | A query-*result* node has never been interactively joinable (the composed-base node rendered no handles — the R90 gap); joining onto a nested query's *effective/derived*, collision-qualified columns is a first-in-product interaction. |
| 3. High user-error risk              | no     | Joins are reversible + non-destructive; cardinality is advisory (R90 finding); stale is flagged-not-crashed — misstep cost is low. |
| 4. Contract depends on unresolved UI | no     | The contract change (rename `…DatasetId`→`…SourceId` + widen pattern to `^(ds_\|qr_)…`) is fully determined by the sealed model; the node-render/picker UI doesn't alter the wire shape. |
| 5. UX confidence below threshold     | yes    | A new node species (a joinable query-result node with derived-column handles) needs a human feel-check before the wire commits — the established R88–R90 canvas practice ([[dfcfbi-f1-needs-human-review]]). |

Result _(superseded — see the Amendment below)_: **DFCFBI (triggers 2, 5)** — this assumed R91 would
build the **canvas UX** (the new node species). Grounding in the code at the Design→build boundary
showed that UX is wire+engine-bound and can't be a contract-safe pre-Contract F1 — so the round was
re-scoped to model-truth, which is a no-UI round.

### Amendment — reshape to DCFBI model-truth (2026-06-19, human-ratified)

Reading the real canvas/builder code before building revealed that query×query is **wire+engine-bound**
(unlike R89's free-form, which rode the already-nullable `originRelationshipId`):

- A `qr_` in `rightSourceId` would be serialized by `chain.ts`'s `writeDef` into the preview request →
  MSW rejects it against the `^ds_…` pattern; the rename + `qr_`-pattern is a **Contract-gate** change,
  and **F1 runs before Contract** ([[dfcfbi-f1-precedes-contract]]).
- Even rendering a composed-base node's handles to join *from* needs each effective column's inner
  `(dataset, column)` **provenance**, which `resolvedColumns` doesn't carry — itself a wire add.

So a pre-Contract F1 can only show a **hollow** canvas prototype — defeating the feel-check the DFCFBI
split exists for. **Reshape (human's call): R91 = model truth (the wire + engine + FE types, _no new
UX_) → DCFBI; the canvas query×query UX → R92 (DFCFBI, real F1 on the working stack).** This mirrors
the [[query-owned-relationships]] R88 (model) → R89 (canvas) sequencing. Decisions **3, 8, 9, 10, 11**
(all canvas UX) carry forward to **R92**; the `ui-design` design-spec already run becomes R92's
Design-gate input.

**Flow selector re-run (no-UI / refactor branch, per the [skill](../../skills/flow-selector/SKILL.md)):**
R91 introduces **no new UI surface** (a wire rename + a resolver extension + FE type rename). The five
UX-framed conditions read vacuously **no** against a no-UI round → **DCFBI by construction**. Recorded
for the audit trail.

Result: **Flow: DCFBI** (amended; no-UI model-truth round).

### Contract + Backend gates — wire + engine landed (2026-06-19)

Built the model-truth slice (DCFBI; Contract + Backend are one inseparable rename+resolver change,
committed as one seam):

- **Contract** — renamed `QueryRelationship.leftDatasetId`/`rightDatasetId` →
  **`leftSourceId`/`rightSourceId`** in `_shared/query.yaml` (+ the put/preview examples);
  **`rightSourceId` pattern `^(ds_|qr_)…`**, `leftSourceId` stays `^ds_…` (right-side-first). The
  governed `relationship.yaml` + `relationships/*.yaml` are **unchanged** (dataset-only — the ER is not
  re-opened). FE renamed end-to-end: `types.ts`, `chain.ts` (`copyGovernedRel`/`RelFields`),
  `joinGraph.ts` (the `Edge` Pick + `resolveConnect`/`relDivergence`/`isLeafHop`), `QueryCanvas`,
  `QueryDetailPage`, `useQueryBuilder` (promote body maps `…SourceId`→governed `…DatasetId`), `JoinEditor`,
  MSW fixtures/handlers, FE tests. **tsc clean · vitest 186/186** (contract-validator + MSW
  `additionalProperties:false` green).
- **Backend** — `_resolve_chain` routes a hop's **right** through the unified `resolve_source`
  (`read_parquet` for `ds_`, a baked `( … )` sub-relation for a `qr_`, exposing its effective columns),
  threading `visited` so a self/transitive join-in → **`composition_cycle`**. The right-must-be-new tree
  check generalized to dataset-set overlap (a `qr_` brings a set). `build_effective_columns` needed **no
  change** — it qualifies a joined-in query's columns by the query's display name, yielding decision-5's
  two-level qualification (`deals.id` / `Accounts base.id`) naturally. `common.py` `QueryRelationship`
  renamed (`rightSourceId: SourceId`, hoisted the polymorphic alias). `relationships.py` untouched.
  **pytest 199** (196 + 3 new: a `qr_`-right join runs in DuckDB · effective columns qualified · a
  self-join-in is `composition_cycle`-blocked).

### Integration gate — real-stack agent-verified (2026-06-19); awaiting human `Complete`

Ran the **live stack** (uv/uvicorn backend :8000 + DuckDB + `seed.py --reset`, workspace
`Sales demo (seed)`) and drove the data-layer claims over real HTTP ([[seed-data-vs-msw-complementary]];
R90 learning — the data claims are the requests the FE emits, so real HTTP is the stronger check than
the browser). **All PASS:**

| Claim | Result |
| --- | --- |
| **Renamed wire round-trips** (`leftSourceId`/`rightSourceId`) | `POST …/queries` **201** with a `qr_` `rightSourceId` accepted over real uvicorn (the seed itself re-seeded cleanly through the renamed `qrel` shape). |
| **A `qr_`-right join runs in DuckDB** | `orders` ⋈ (the "All customers" query, `qr_`) on `customer_id` → `GET …/rows` **200, 32 rows** — the joined-in query baked as a subquery. |
| **Effective columns qualified (decision 5)** | `resolvedColumns` = `… orders.customer_id … All customers.customer_id …` — collisions qualified by the dataset name **and** the joined-in **query's** name; unique names stay bare. The genuinely-new naming sub-problem, confirmed end-to-end. |
| **Self-join-in → `composition_cycle`** | pytest-verified against real DuckDB (a query joining itself in is `409 composition_cycle`, not infinite recursion). |
| **CORS preflight clean** | `OPTIONS …/queries` **200**, `access-control-allow-origin: http://localhost:3000`, methods `GET, POST, PUT, PATCH, DELETE`. |

Probe query deleted (`204`); seed state restored. **Backend left UP at `http://127.0.0.1:8000`** for an
optional human smoke of the existing flows (the FE rename touched the canvas/detail/save paths — vitest
and MSW are green, but a browser glance is welcome). R91 adds **no new UI**, so there is no new feel to
review; the query×query **canvas UX** is R92. **Human flips `Complete`** ([governance](../../context/governance.md)
— only humans flip).

## Check

- [x] **Plan gate** — theme ratified + scope sub-fork = brainstorm + thin slice (human, 2026-06-19).
- [x] **Design gate** — model sealed (11 decisions above); `ui-design` design-spec run; `flow-selector`
      recorded → DFCFBI(2,5) **then amended → DCFBI** (no-UI model-truth, see Amendment); `gate-walker`
      closed (criterion + model-check + commit seam `design(R91)` `9cd33e9`).
- [x] **Contract gate** — renamed → `leftSourceId`/`rightSourceId`; `rightSourceId` `^(ds_|qr_)…`; MSW +
      `contract-validator` green (vitest 186); `relationships/*.yaml` unchanged (dataset-only).
- [x] **Backend gate** — `_resolve_chain` right-side via `resolve_source` + `composition_cycle` guard;
      effective-column naming (decision 5) tested; **pytest 199** (qr_-right join · qualified cols · cycle).
- [x] **Integration gate** — real-stack **agent-verified**: a `qr_`-right join runs in DuckDB (32 rows);
      effective columns qualified (`orders.customer_id` / `All customers.customer_id`); self-join-in
      `composition_cycle`-rejected (pytest); renamed wire round-trips; CORS clean. **Human `Complete` flip pending.**
- [ ] **Complete** — human-flipped after an optional browser smoke ([governance](../../context/governance.md) — only humans flip).

## Act

**Round at Review (2026-06-19)** — the query×query **model truth** shipped: a saved Query joins in on a
hop's right (`rightSourceId` polymorphic; the resolver routes the right through `resolve_source`),
agent-verified on the real stack. Awaiting the human `Complete` flip.

**Learnings (candidate — pending a 2nd rep):**

- **Ground the F1/Contract split in the wire before committing the flow.** The `flow-selector` honestly
  read DFCFBI(2,5) — the canvas UX is genuinely new — but it measured the _UX_, not whether a
  contract-safe F1 could even _show_ it. Reading the code revealed query×query is wire+engine-bound
  (unlike R89's free-form, which rode an existing nullable field), so a pre-Contract F1 ([[dfcfbi-f1-precedes-contract]])
  would be hollow. The fix was the [[query-owned-relationships]] R88→R89 pattern — **model truth first
  (DCFBI), canvas UX second (DFCFBI)**. _Lesson: when a "new UX" round is wire-bound, the model round
  precedes the UX round; check the wire dependency at the Design→build boundary, not after building._
- **The polymorphic resolver paid off exactly as the brainstorm predicted.** "The engine is ~80% there"
  held: routing the right side through the existing `resolve_source` + reusing `build_effective_columns`
  (which qualified by source name with no change) meant the new capability was a small, localized
  extension — the genuinely-new work was just the rel-model rename + the effective-column naming (tested).

**Promotions**: none this round (humans promote, per [`promotions.md`](../promotions.md)).

**Follow-ups (notes, not promotions):**

- **R92 — the canvas query×query UX** (DFCFBI, real F1 on this stack): the query node + 🔎 marker,
  `[+ Add a source]` offering `qr_`, draw-to-`qr_` free-form define, Promote-suppression on `qr_` edges,
  the query-unavailable node state, Form-tab parity (decisions 3, 8–11). The carried-forward `ui-design`
  design-spec is its Design input.
- `qr_` on the **left** of a hop (left-poly); deeper nesting; then the deferred **dashboards** theme.

## Feeds into → Round_92 (canvas query×query UX — DFCFBI)

R92 builds the **canvas UX** for query×query on this now-working wire+engine: the query node + 🔎 marker,
`[+ Add a source]` offering `qr_`, draw-to-`qr_` free-form define, Promote-suppression, the
query-unavailable node state, and Form-tab parity (decisions 3, 8–11) — **DFCFBI with a real F1
feel-check** (the carried-forward `ui-design` design-spec is its Design input). Beyond that: `qr_` on the
**left** of a hop, deeper nesting, then the deferred **dashboards / value-out** theme.
