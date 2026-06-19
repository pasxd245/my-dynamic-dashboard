# Round 88: query-owned relationships — the model (copy-on-pick), clean-slate `0001`

**Status**: **Complete (human-signed-off, 2026-06-19).** All six gates closed: Plan · Design · Contract ·
Backend · Frontend · Integration. Backend **196/196 pytest** + FE **169/169 vitest** green; design docs
re-synced to query-owned (via `design-sync`); the human reviewed the running app and confirmed queries
build/save as before and **editing a governed rel does not break a saved query** (the snapshot win).
First round of the **query-owned-relationships theme**
([brainstorm](../brainstorms/2026-06-19-query-owned-relationships.md)), opened by the **R87 F1 verdict**
([Round_87](Round_87.md) Act).
**Date started**: 2026-06-19
**Date completed**: 2026-06-19
**Flow**: **DCFBI** — `flow-selector` → 0/5 at the Design gate (no new UX → no F1 prototype).

## Goal

**Inherits from ← [Round_87](Round_87.md)** (the F1 verdict — "draw-to-PICK feels like the Form
builder because it _is_ a selection"; the pick-pair canvas editor + `joinGraph.ts` are **retained** as
the **copy-on-pick seed**) and the **[query-owned-relationships brainstorm](../brainstorms/2026-06-19-query-owned-relationships.md)**
— the theme's first round (R88 model → R89 free-form canvas → R90+ dashboards).

Make a query **own its relationships** — the truth layer the whole theme rides on. Today a `JoinStep`
points at a governed `rel_` (`{ relationshipId, type }`); the join resolver looks it up in the workspace
store. **This round moves the edge definition INTO the query**: each join resolves through the query's own
relationship records, seeded by **copy-on-pick** (picking a governed `rel_` copies its definition into the
query, keeping a `originRelationshipId` back-ref). **No new UX** — the existing pick controls (the hop-list
`<Select>` and R87's canvas pick) keep their look; only **what picking _does_** changes (copy, not
reference).

This is the headline robustness win: a query runs on its **own snapshot**, so editing/deleting a governed
rel no longer breaks a saved analysis ([brainstorm §2](../brainstorms/2026-06-19-query-owned-relationships.md)).
Free-form **define** + **promote** + the divergence **warn** UI are **R89** (free-form canvas, React Flow);
dashboards are **R90+**.

_Track: 1 (product feature — model evolution). Pulled by ← the R87 F1 verdict (a DA needs query-local
relationships) + [query-owned-relationships brainstorm](../brainstorms/2026-06-19-query-owned-relationships.md).
Per the [Evolution Rule](../../AGENTS.md)._

## Settled going in (human's calls, 2026-06-19 — see brainstorm §3)

1. **Back-ref / provenance** — `originRelationshipId` on each query-owned rel (null = free-form).
2. **Divergence** — warn-only, no auto-impact (the **warn UI lands R89**; R88 just stores the back-ref +
   the non-breaking snapshot behavior).
3. **Promote** — its own rulebook (**R89**); R88 only makes the model promotable.
4. **Model/contract/engine change** — accepted; **reuse** the existing relationship validation + join
   engine, don't reinvent.
5. **No backward-compat** — collapse alembic to a **fresh `0001`**, re-create seed; **no migration** of old
   `relationshipId`-shaped queries (we are on `dev`).

## Proposed model (to seal at the Design gate — brainstorm §4)

`QueryDefinition` gains `relationships: QueryRelationship[]`; `JoinStep` references one by `queryRelId`
(was `relationshipId`). `QueryRelationship` mirrors the governed `Relationship` shape + `originRelationshipId`.
Picking a governed `rel_` copies it in. **Same connected-acyclic tree, same guards** — only the edge
definition's _home_ moves (workspace store → the query).

## Plan (by gate — DCFBI, pending `flow-selector`)

1. **Plan gate** — ratify: scope = the **model truth + copy-on-pick, no new UX**; clean-slate `0001`;
   free-form/promote/warn → R89. _(This step — awaiting human ratification.)_
2. **Design gate** — seal the model shape (sibling `relationships[]` vs inline on `JoinStep`); confirm the
   join resolver + validation reuse; run `flow-selector`; amend
   [queries.md](../../design/data-management/queries/queries.md) /
   [query-construction.md](../../design/data-management/queries/query-construction.md) /
   [canvas.md](../../design/data-management/queries/canvas.md) to "query-owned rels"
   ([[design-docs-are-source-code]]).
3. **Contract gate** — `query.yaml` (`JoinStep.queryRelId`, `QueryDefinition.relationships`,
   `QueryRelationship` w/ `originRelationshipId`); MSW + schema-parity updated.
4. **Backend gate** — `db_models` + the join resolver read query-owned rels; reuse dtype-compat / acyclic /
   leaf validation; **fresh alembic `0001`**; seed re-created; pytest green.
5. **F gate** — FE types; `useQueryBuilder` copy-on-pick (pick → copy into `draft.relationships` with
   back-ref; `joins` reference `queryRelId`); the list + R87 canvas render from query-owned rels; vitest +
   MSW migrated/green.
6. **Integration** — human review: queries build/save as before; **editing a governed rel does not break a
   saved query** (the snapshot holds).

## Acceptance criteria (draft — sharpen at Design)

- [ ] **Query owns its rels** _(model)_ — `QueryDefinition.relationships[]` + `JoinStep.queryRelId`;
      `QueryRelationship` carries `originRelationshipId`. Contract + schema-parity green.
- [ ] **Copy-on-pick** _(FE+BE)_ — picking a governed `rel_` copies its current definition into the query
      (with the back-ref); the join resolves through the copy, not a live lookup.
- [ ] **Snapshot robustness** _(BE+I)_ — editing/deleting the origin governed `rel_` no longer breaks the
      saved query (it runs on its copy). _(The user-facing **warn** is R89.)_
- [ ] **Reuse, not reinvent** _(BE)_ — the join engine + dtype-compat/acyclic/leaf validation are reused
      against the query-owned spec; no parallel validation.
- [ ] **Clean slate** _(BE)_ — a single fresh alembic `0001`; seed re-created; no `relationshipId`
      migration path.
- [ ] **No new UX** _(FE)_ — the pick affordances look unchanged; free-form define / promote / divergence
      warn are **not** in this round.
- [ ] **Design docs current** _(doc)_ — queries/query-construction/canvas describe query-owned rels.

## Out of scope (this round)

- **Free-form define** (draw a column pair with no governed match → create a query-owned rel) → **R89**.
- **Promote** (query-owned rel → governed ER, dedup/conflict rulebook) → **R89**.
- **Divergence warn UI** + re-sync affordance → **R89** (R88 stores the back-ref only).
- **React Flow / free-form canvas drag** → **R89** (where drawing *creates*).
- **Dashboards / charts** → **R90+**.

## Risks / unknowns

- **Blast radius** (contract + BE + engine + FE at once). _Mitigation: clean-slate `0001` (no migration);
  **no new UX** bounds the round; reuse the existing engine + validation._
- **Resolver assumptions** — the join engine may assume a workspace-store lookup. _Mitigation: Design-gate
  read of `queries.py` / `common.py` before sealing the shape._
- **Seed/contract-parity churn** — collapsing `0001` must bring `test_schema_parity` + seed along.
  _Mitigation: Backend-gate checklist._

## Do

### Plan-gate draft (2026-06-19)

Opened from the R87 F1 verdict + the [brainstorm](../brainstorms/2026-06-19-query-owned-relationships.md).
Proposed scope = **model truth + copy-on-pick, no new UX**, clean-slate `0001`; free-form/promote/warn
deferred to R89. **Awaiting the human's ratification** on (a) that scope split (R88 model-only vs folding
in any R89 UX) and (b) the clean-slate `0001` collapse. The Design gate then seals the model shape + runs
`flow-selector`.

### Plan-gate ratification (2026-06-19) — human-signed-off

The human ratified **both** calls: **(a)** R88 = **model truth + copy-on-pick only** (free-form / promote /
divergence-warn → R89); **(b)** **clean-slate**: collapse alembic to a fresh `0001`, re-create seed, **no**
migration. **Plan gate CLOSED.** Next: the Design gate.

### Design-gate work (2026-06-19)

**Real code re-confirmed before sealing** (the design-gate read, not assumptions):

- **Backend is raw-SQLite + Pydantic, NOT SQLModel** (queries.py header — R69 J-3 deviation); alembic
  manages the DDL (`0001_baseline`, `0002_query_source_id`). The clean-slate (decision 5) collapses these
  into one fresh `0001`.
- **The join resolver's integration point is a single line.**
  [`_resolve_chain`](../../../workspace/apps/backend/app/routers/queries.py#L186-L211) reads each hop's
  edge with `SELECT * FROM relationships WHERE id = hop["relationshipId"]`, then validates provenance
  (`left_idx`), the acyclic guard (`right ∉ graph`), and dtype-compat (`_compatible(_dtype_of(...))`)
  against **current** dataset columns. **Only the lookup changes** — read the edge spec from the query's
  own `relationships[]` by `hop["queryRelId"]`; **all the validation is reused verbatim.**
- This is the robustness win in one stroke: the resolver stops touching the workspace `relationships`
  table for joins → editing/deleting a governed rel can no longer break a saved query (it runs on its
  embedded copy). Staleness still fires correctly when a **dataset column** drifts (the dtype-compat check
  is against current columns), which is the data-level stale we still want.

**Model shape — SEALED** (the brainstorm §4 proposal, confirmed against the contract + Pydantic):

- **`QueryRelationship`** (new shared schema) — mirrors the governed `Relationship`'s join fields, query-scoped:
  `{ id: "^qrel_[0-9a-f]{8}$", leftDatasetId, leftColumn, rightDatasetId, rightColumn, cardinality,
  originRelationshipId?: "^rel_[0-9a-f]{8}$" }`. `originRelationshipId` is the provenance back-ref (null =
  defined free-form, an R89 path; at R88 it is always set, since R88 only copies-on-pick).
- **`JoinStep`** — `relationshipId` (→ governed `rel_`) becomes **`queryRelId`** (→ a `QueryRelationship.id`
  within the same definition). `type` unchanged.
- **`QueryDefinition`** — gains **`relationships: QueryRelationship[]`** (sibling list; the brainstorm's
  preferred home — it makes provenance + future promotion first-class). `joins[]` references them.
- **Sibling list vs inline-on-JoinStep** → **sibling list**, because (i) promotion (R89) acts on a rel
  object, not a hop; (ii) two hops could share one query-owned rel; (iii) it mirrors the governed shape, so
  copy-on-pick and (later) promote are near-symmetric.

**Copy-on-pick wiring** (FE, this round — no new UX): when the user picks a governed `rel_` in the hop-list
`<Select>` **or** the R87 canvas, `useQueryBuilder` mints a `QueryRelationship` (fresh `qrel_` id, copying
the governed rel's current join fields, `originRelationshipId = rel.id`), appends it to
`draft.relationships`, and adds a `JoinStep { queryRelId, type }`. `removeJoin` drops the hop and prunes any
now-unreferenced query-owned rel. The pick affordances **look identical** — only what they store changes.

**`flow-selector` (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):**

| Condition | Fired? | Justification |
| --- | --- | --- |
| 1. >3 independent states/branches | no | A uniform model swap (read the edge from the definition, not the table) across create/update/preview/run + copy-on-pick wiring — not >3 independent **UI** branches; no new screens/states. |
| 2. New interaction pattern | no | **No new UX** this round (sealed scope); the pick affordances are unchanged. Free-form draw is R89. |
| 3. High user-error risk | no | Internal model change; copy-on-pick is transparent + Save-gated + recoverable. |
| 4. Contract depends on unresolved UI | no | The contract is driven by the **sealed model**, not waiting on any UI decision. |
| 5. UX confidence below threshold | no | No new UX to be unconfident about. |

Result: **0/5 → Flow: DCFBI** (Design → Contract → Frontend → Backend → Integration; **no F1 prototype**).

**Design-doc amendments** ([[design-docs-are-source-code]]) — applied **as the code lands** (Contract/F/B
gates), so docs stay synced to truth: [queries.md](../../design/data-management/queries/queries.md) (the
`joins` model + the new query-owned `relationships[]`), [query-construction.md](../../design/data-management/queries/query-construction.md)
(copy-on-pick), [canvas.md](../../design/data-management/queries/canvas.md) (the canvas pick now copies).

**Design gate CLOSED.** Next: the Contract gate (`query.yaml`: `QueryRelationship`, `JoinStep.queryRelId`,
`QueryDefinition.relationships`; MSW + schema-parity).

### Contract + Frontend gates (2026-06-19)

`query.yaml` gained **`QueryRelationship`** (`^qrel_[0-9a-f]{8}$` + the governed join fields +
`originRelationshipId`), **`JoinStep.queryRelId`** (was `relationshipId`), and
**`QueryDefinition.relationships[]`**; preview/put contract examples migrated to `queryRelId`. FE:
`types.ts` + `useQueryBuilder` copy-on-pick (pick a governed `rel_` → mint a `qrel_`, copy its fields,
record `originRelationshipId`, append to `draft.relationships`, add a `JoinStep{queryRelId}`); the hop
list + R87 canvas + `joinGraph.ts` selectors all read query-owned rels; **`tsc` clean, vitest + MSW
169/169**. (These had landed in the working tree ahead of the round-file ledger; recorded here.)

### Backend gate (2026-06-19) — the model truth + clean-slate `0001`

- **Resolver migrated, validation reused verbatim.** `_resolve_chain` now reads each hop's edge from
  the definition's own `relationships[]` by `queryRelId` (new `_rels_of` helper) instead of
  `SELECT … FROM relationships WHERE id = hop["relationshipId"]`. The acyclic / leaf / dtype-compat
  guards are unchanged — only the lookup moved. This delivers the headline robustness win: the
  resolver no longer touches the workspace `relationships` table for joins, so editing/deleting a
  governed rel can't break a saved query (it runs on its embedded snapshot); column-drift staleness
  still fires (`_compatible` against current columns). Pydantic: `QueryRelationship` + `queryRelId` +
  `relationships[]` (`common.py`); `qrel_` pattern added to `values.yaml` → regenerated constants
  (BE + FE).
- **Clean-slate alembic (decision 5, literal collapse — human's call).** Found at the Backend gate
  that the query-owned model is **JSON-only** (it lives in `definition_json`); the DB **schema/DDL
  does not change**. Surfaced this to the human ([[design-altitude-vs-build-home]]); they chose the
  **literal collapse** anyway. Rewrote `0001_baseline` to create the `queries` table at its head shape
  directly (`source_id NOT NULL`, no `dataset_id`); **dropped `0002_query_source_id`**; **retired the
  pre-Alembic heal-then-stamp adoption bridge** in `db.py` (`run_startup_migrations` is now just
  `upgrade head`) and the now-moot pre-R79 adoption test; `test_schema_parity` version assertions →
  `0001_baseline`. Seed re-created (`scripts/dev/seed.py`): the join query uses copy-on-pick shape;
  also fixed a latent `datasetId`→`sourceId` (R79) staleness.
- **Verification**: **backend 196/196 pytest** (incl. `test_joins` + `test_composition` migrated to
  `queryRelId` + `relationships[]`, schema-parity, conformance) ; `ruff` clean. FE re-confirmed
  **169/169** after the constants regen + the stray `enable_mock` revert.

### Design-sync (2026-06-19)

Ran the **`design-sync`** skill (default mode) on `data-management/queries` — the user's explicit ask,
now appropriate since the code is complete + coherent. Reconciled `queries.md`,
`query-construction.md`, `canvas.md`, and (foundation ripple) `context/persistence.md` to code-truth:
the query-owned model, copy-on-pick, the `columnMissing` per-edge stale mechanism, the single
`0001_baseline` + retired bridge, the built-canvas reality, and removed stray generation tags + a
broken self-link. Gates green: `design:lint` 0 · `design:tokens` 0 · `markdownlint` 0 · `check_links`
clean. Drift report + sync note: `.agents/tmp/design-sync/data-management-queries.md`. (Residual
round-stamp ledger in `canvas.md` noted for a future full compaction pass — not blocking.)

**Backend / Contract / Frontend gates CLOSED.** Next: **Integration** — the human runs the app.

## Check

_(Filled as the gates close — verification against the [Acceptance criteria](#acceptance-criteria-draft--sharpen-at-design).)_

- [x] **Plan gate** — scope (model + copy-on-pick only; free-form/promote/warn → R89) + clean-slate `0001`
      ratified by the human (2026-06-19).
- [x] **Design gate** — real code re-confirmed (raw-SQLite + Pydantic; resolver integration = one lookup in
      `_resolve_chain`); **model SEALED** (`QueryRelationship` + `JoinStep.queryRelId` +
      `QueryDefinition.relationships[]`, sibling list); validation/engine **reused, not forked**;
      `flow-selector` → **0/5 → DCFBI** (no F1); design-doc amendments planned for the build gates.
- [x] **Contract gate** — `query.yaml` `QueryRelationship` + `JoinStep.queryRelId` +
      `QueryDefinition.relationships[]`; preview/put examples migrated; MSW (FE) green.
- [x] **Frontend gate** — `useQueryBuilder` copy-on-pick; list + canvas + `joinGraph.ts` read query-owned
      rels; **tsc clean, vitest + MSW 169/169**.
- [x] **Backend gate** — `_resolve_chain` reads query-owned `relationships[]` by `queryRelId`
      (validation/engine reused verbatim — the robustness win: no live `relationships`-table lookup);
      clean-slate single `0001_baseline` (0002 dropped, pre-Alembic bridge retired); seed re-created;
      **196/196 pytest**, `ruff` clean. _Finding: the model is JSON-only so the DDL didn't change; the
      human chose the literal alembic collapse regardless._
- [x] **Design docs current** — `design-sync` reconciled queries/query-construction/canvas (+ persistence.md)
      to query-owned; design gates green.
- [x] **Integration — human-signed-off (2026-06-19).** The human ran the app and confirmed queries
      build/save as before and that **editing/deleting a governed rel no longer breaks a saved query**
      (the snapshot win), plus the free-form boundary: the model is free-form-*capable* (nullable
      `originRelationshipId`, origin-agnostic resolver) but only copy-on-pick creates rels today —
      free-form *define* / promote / warn remain R89, as scoped. **Round Complete.**

## Act

**Round Complete (human-signed-off, 2026-06-19).** The model truth landed across contract + BE + FE +
docs with every automated suite green, and the human's Integration review confirmed the snapshot win in
the running app. The query-owned-relationships foundation is in place for R89 (free-form + promote).

**Learnings**:

- **A "model change" can be DDL-free.** R88's whole headline — a query owns its relationships — lives
  inside the opaque `definition_json` blob, so the SQLite **schema never changed**. The clean-slate
  "fresh `0001`" decision was premised on the model being a DDL change; it wasn't. The honest move was
  to surface that the alembic collapse was zero-schema-benefit housekeeping before doing it
  ([[design-altitude-vs-build-home]] — the decision's *intent* (no back-compat baggage) was satisfied
  by re-seeding; the *mechanism* guess (collapse alembic) was orthogonal). The human chose the literal
  collapse anyway — a legitimate clean-history call — but the gate is where that premise got checked,
  not assumed. _(Candidate principle: before executing a "schema migration," confirm the change is
  actually in the DDL and not in a JSON/blob column.)_
- **The resolver's one-line integration point held.** The Design gate's read ("only the lookup
  changes; all validation is reused") was exactly right — `_resolve_chain`'s hop loop swapped a table
  `SELECT` for a `relationships[]` dict lookup and every guard (acyclic / leaf / dtype-compat) stayed
  verbatim. Reusing, not reinventing, the join engine + validation (decision 4) cost ~10 lines.
- **The round-file ledger drifted from the working tree.** Contract + FE had already landed in the
  working tree while the round file still said "next: Contract"; closing required reconciling the
  ledger to reality (recorded in Do). A reminder that the round file is also a doc that must track the
  code.

**Promotions**: none land this round. The "confirm a migration is DDL-not-JSON before collapsing
alembic" learning is a **promotion candidate** pending a second rep.

**Follow-ups (not promotions, just notes):**

- **Integration review (human)** — run the app: queries build/save as before; edit/delete a governed
  rel and confirm a saved query that copied it still runs (the snapshot win). Then mark R88 Complete.
- A future full **`design-sync`** pass can compact `canvas.md`'s residual round-stamp ledger (the
  code-truth drift is already reconciled).
- Free-form define + promote + divergence warn UI (React Flow) → **R89**.
- Dashboards / charts → **R90+**.

## Feeds into → Round_89 (free-form canvas UX + promote) (TBD)

The query-owned-relationship model (copy-on-pick, `originRelationshipId` back-ref, the join resolver reading
query-owned specs) becomes R89's foundation: drawing a column pair with **no** governed match **defines** a
new query-owned rel (free-form), a useful one **promotes** up to the governed ER, and the divergence
**warn** surfaces — with **React Flow** as the canvas engine, since drawing now *creates*.
