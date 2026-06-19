# Round 91: query×query joins — a saved Query as a joined-in source (theme opening — Plan gate)

**Status**: Planning
**Date started**: 2026-06-19
**Date completed**: —
**Flow**: **DFCFBI (triggers 2, 5)** — set at the Design gate via `flow-selector`; recorded in the Do
log. Per [[dfcfbi-two-round-split]], R91 runs **[D + F1 + design-sync]**; **[C + B + F2 + Integration]**
lands as R92.

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

## Plan (by gate — pending the scope sub-fork + `flow-selector` at Design)

1. **Plan gate** — theme ratified + scope sub-fork = **brainstorm + thin slice** (above);
   brainstorm written. _(CLOSED — human-ratified 2026-06-19.)_
2. **Design gate** — run `flow-selector`; seal the model (rename `…DatasetId` → `…SourceId` vs.
   widen-in-place; the effective-column naming rule **with a test**; right-side-first vs. both
   sides); run `ui-design` (design-spec mode) on the canvas query-node + Promote-suppression;
   re-sync [queries.md](../../design/data-management/queries/queries.md) +
   [canvas.md](../../design/data-management/queries/canvas.md) ([[design-docs-are-source-code]]).
3. **C / F / B / I** (or **F1** if DFCFBI) — per the sealed flow, **only if** the sub-fork is
   "brainstorm + thin slice."

## Acceptance criteria (draft — sharpen at Plan/Design)

- [x] **Theme ratified** — query×query joins, brainstorm-first (human, 2026-06-19).
- [ ] **Scope sub-fork ratified** — the human has chosen brainstorm+slice vs. brainstorm-only.
- [ ] **Model sealed at Design** — the rel-edge source fields, the effective-column naming rule
      (with a test), and right-side-first vs. both-sides — decided; governed ER confirmed unchanged.
- [ ] **A saved Query joins in on the right** _(first slice, if a build round)_ — `qr_` on a hop's
      right resolves via `resolve_source`, runs in DuckDB; the canvas renders it as a
      handle-bearing node (closing the R90 composed-base gap); Promote suppressed on `qr_` edges;
      cycle/stale reuse the existing guards.

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

Result: **Flow: DFCFBI (triggers 2, 5)**. Per [[dfcfbi-two-round-split]], R91 runs **[D + F1 +
design-sync]**; **[C + B + F2 + Integration]** lands as R92. F1 is **contract-safe** (FE working-state
and request-only, no new wire serialization — [[dfcfbi-f1-precedes-contract]]); the rename/pattern-widen
lands at Contract (R92).

## Check

- [ ] **Plan gate** — theme ratified ✅; scope sub-fork = brainstorm + thin slice ✅ (human, 2026-06-19).
- [ ] **Design gate** — model sealed (11 decisions above); `ui-design` design-spec run (3 facet gaps
      → closed by decisions 9–11); `flow-selector` recorded.

## Act

_(Drafted at Review.)_

## Feeds into → Round_92+ (TBD)

If R91 is brainstorm-only, R92 builds the slice. Beyond that: `qr_` on the **left** of a hop, more
nested depth, then the deferred **dashboards / value-out** theme (free exploration → rich queries →
visualized).
