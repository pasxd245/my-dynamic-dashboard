# Round 167: composition retired in the engine — and the bug that outlives it

**Status**: In Progress — **D gate closed**; C (contract narrowing) next
**Flow**: **DCFBI** — set at the Design exit via `flow-selector` (0 of 5); recorded in the Do log
**Date started**: 2026-08-14
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_166](Round_166.md)** — Duplicate shipped, every surface that offered
`query⋈query` is withdrawn, and the acceptance walk returned **5 of 5** with **T5 = yes**. That
answer is this round's licence: the replacement was hand-used and served the need, so the thing it
replaces can come out **without** the round being rewritten. R166 was the reversible half; this one
is not.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— **item 3b**, the engine half of the layer split the human called on 2026-08-13.

**This round is not a deletion, and that is the whole finding.** The program plan said item 3
would "delete the machinery"; a D-gate code walk before R166 found that wrong in four places. The
`qr_` resolver is **load-bearing for Workflow**, `cyclic_join` is the **self-join boundary** rather
than composition machinery, `composition_base_missing` stays **alive** as the un-run-workflow case,
and D1 does **not** dissolve — it **relocates**, into a path where it additionally freezes the
wrong rows to disk. So the shape here is **narrow and collapse**, not remove — and the relocated
bug travels on to item 4 with the decision that governs it (human, 2026-08-14).

_Track: 1 (product). Pulled by: program item 3b, and by R166's T5 — the replacement was confirmed
by hand before anything irreversible was touched._

## Plan

**Expected outcome**: a Query is a live table over **datasets only**, in the **engine** as well as
on every surface — the concept locked at R161 and the shipped code finally agree. **D5 closes.**
Workflow keeps reading its `qr_` sources through a resolver **narrowed to it alone**, so its
boundary is visible in the code instead of tangled with a capability that no longer exists.

**Falsified if**: narrowing the `qr_` branch breaks Workflow (finding A's whole point — and the
`workflows` table is empty, so **tests are the only guard**, not hand-use); or the narrowing cannot
be done without also answering *what a Workflow is*, which would mean the FE/engine seam was the
wrong second cut and item 3b should merge into item 4 rather than precede it.

### The five findings, and what each becomes

Carried verbatim from R166 so the split stays legible from this side. **All five were re-verified
against the code on 2026-08-14** before this plan was written.

| #     | Finding                                                                                                                                                                                                                                                                                | Becomes                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A** | The `qr_` resolver is load-bearing for Workflow — a Workflow's sources are `qr_`/`wf_` and **never** `ds_` ([common.py:905](../../../workspace/apps/backend/app/models/common.py#L905)), resolved through the branch composition uses ([query_engine.py:74](../../../workspace/apps/backend/app/query_engine.py#L74)) | **NARROW**, don't delete — the branch survives as Workflow's reader; a Query's driving source becomes `ds_` only                   |
| **B** | `cyclic_join` is the **self-join boundary** for a `ds_` right already in the graph ([query_engine.py:213](../../../workspace/apps/backend/app/query_engine.py#L213)), which `_noun-model.md` says stays rejected                                                                        | **COLLAPSE** — the set-overlap form (D2) dies; the check degenerates to a single-id membership test. The error code **survives**   |
| **C** | `composition_cycle` becomes unreachable; `composition_base_missing` **stays alive** — the same reason string is the un-run-workflow case ([query_engine.py:142](../../../workspace/apps/backend/app/query_engine.py#L142))                                                             | **A CONTRACT CALL at D** (below) — not an automatic removal                                                                        |
| **D** | D1 relocates: `build_consolidated_relation` calls `_resolve_plan` + `_build_inner_relation` and **never `run_steps`** ([query_engine.py:831](../../../workspace/apps/backend/app/query_engine.py#L831)), so consolidating a _shaped_ query reads **un-shaped** rows — and **freezes them to `output.parquet`** | **DEFERRED to item 4** (human, 2026-08-14) — the repair lands with the decision that governs it, not ahead of it. See § D-gate calls |
| **E** | **Re-confirmed 2026-08-14**: **14** saved queries, **zero** composed in _either_ form (no `qr_` driving base, no `qr_` on the right of a hop); `workflows` table **empty**                                                                                                             | **A POLICY call, not a data job** — and, with D deferred, the reason the deferral is survivable                                    |

### D — the design gate

- [x] **Re-read `data/app.sqlite` and re-confirm finding E** — done 2026-08-14, and it came back
      **stronger** than at R166: 14 saved queries (was 10), **zero** composed in either form,
      `workflows` still empty. The DB also carries R166's walk (`Telesale calls (copy)` and
      `(copy 2)`, both shaped **differently** from an original that stayed plain) — T1 and T2
      answered in data, not only in report.
- [x] **Decide `composition_cycle`'s fate** — **kept, and re-framed by the human** (§ D-gate calls).
- [x] **Decide whether D1's repair belongs here or in item 4** — **deferred to item 4** (human).
- [x] **Decide what the API answers when handed a `qr_` `sourceId` after this round** — which
      status, which code, and whether create/update and preview all agree. D4's standing rule
      (_unofferable at the gesture, never an error at run_) is about surfaces; this is the API,
      where an error **is** the honest answer.
- [x] **Write the migration stance** for a hypothetical pre-R166 composed query — none exist, but
      the stance must cover base **and** copy uniformly, which is what R166's Duplicate spec
      promised it would.
- [x] **Write the removal list from the code, not a grep**, as R166 did — and carry R166's trap
      forward: **not every `qr_` is composition.** `features/dashboard/wire.ts` and
      `workflows/types.ts` reference `qr_` as a **consumer** relationship. Both stay.
- [x] **Confirm the FE deletion list** the human deferred from R166 (2026-08-14): the canvas's
      `qr_` node rendering, `joinGraph`'s `EffectiveLookup` / `ProvenanceOf` / `displayLeft`
      re-anchoring / the `promotable` test, the unavailable-`qr_` state, the detail page's
      composition summary + badge + `composition_cycle` state, and the MSW fixtures + handlers
      behind them.
- [~] **Close D5 in [`_noun-model.md`](../../design/data-management/_noun-model.md)** —
      **deliberately NOT a D-gate edit.** D5 closes when the **code** retires composition, so
      writing the closure now would make the doc claim something untrue for the length of the
      round — the exact failure R166 avoided by leaving it open. **The spec already exists**: R166
      wrote D5's per-entry disposition as _"withdrawn at R166, engine retires at R167"_, which is
      the D-gate artifact ([[d-gate-artifact-in-design-corpus]]) this round implements against. The
      **edit** lands with B, inside the final `design-sync`.
- [x] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit** — **DCFBI**,
      0 of 5, via the skill's no-UI branch; recorded in the Do log.
- [x] **Write the acceptance-walk questions at D**, not at I ([[walk-record-always-spec-on-ask]]),
      **and how each outcome will be read** — done, and it forced a build item: **B must seed a
      workflow**, or the round's riskiest change (finding A) has no hand-use at all.

### After D

C → B → I per the recorded chain. **The `design-sync` runs last**, once, over the final state —
that is why R162's sync was deliberately allowed to stay outstanding rather than run twice.

### Explicitly NOT in this round

- **What a Workflow is** — program item 4, `Round_168`. **And D1's repair goes there with it**
  (human, 2026-08-14), along with the question of whether a workflow source resolves **frozen or
  live** — which is also what decides whether `composition_cycle` reactivates.
- **Removing `composition_cycle` from the contract** — kept as a dormant guard, see § D-gate calls.
- **The batched UI cluster** — R165's W-1/W-2 and the R157 cluster stay batched
  ([[batch-ui-bugs-into-one-round]]). R166 added one to it: **generalising `[Edit] [Duplicate]
  [Delete]`'s ordering rule to every detail header**, a cross-surface question parked with R157
  next to catalog row actions.
- **The naming/legibility cluster** parked by the human at R163.

## Risks / unknowns

| Risk                                                                                                                                                | Why it matters                                                                                                                                                            | Handling                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Narrowing a resolver Workflow depends on, with no Workflow to hand-use.** Finding E cuts both ways: the empty `workflows` table makes the repair safe **and** removes the walk that would catch a regression. | R166's whole method was "the human runs it". Here they cannot — there is nothing to run.                                                                                 | **Tests are the acceptance gate for the Workflow path, and the round must say so rather than implying a walk covered it.** Consider seeding a workflow so the I gate has one. |
| ~~Removing a published error code~~ — **retired as a risk at the D gate**: `composition_cycle` stays.                                                | It was the round's only wire-breaking change; keeping the dormant guard removes the `isApiError` exposure (R165's seam) entirely.                                        | **Closed.** The remaining contract change is narrowing `SourceId → DsId`, which is a tightening — it rejects what nothing sends (finding E), rather than withdrawing a shape. |
| **D1 is deferred, so a live trap ships for a round**: a Workflow consolidating a query with `steps` freezes **un-shaped** rows to `output.parquet`. | A materialized wrong answer is not fixed by later fixing the code — nothing re-reads it. And re-running is the user's gesture, not ours.                                  | **The window is exactly "until the first workflow exists"** (finding E: table empty). Named in the round, in `_noun-model.md` D1, and in R168's inheritance — not discovered. |
| **A 14-doc `design-sync` is a large diff at the end of a round that already changed the engine.**                                                   | [[design-docs-are-source-code]] — a sync that runs on a half-finished state has to run again.                                                                            | Run it **last**, once, and commit it as its own gate seam ([[round-bundling-and-revert-seams]]).                                                                             |
| **Incidental-order test assertions** — R165 found two backend tests asserting row order while testing something else; R166 deferred the sweep here. | A round that moves engine code moves a lot of code under a lot of tests, and an incidental assertion fails for the wrong reason.                                          | Sweep as part of B, not as a follow-up.                                                                                                                                     |

## Do

### D-gate calls — the two the human made (2026-08-14)

#### 1. `composition_cycle` stays — and it is **dormant, not dead**

**The human's reframing, which is the better reading**: _"deprecated is okay, but is it useful —
the query can be a 'base' when working with Workflow (maybe)?"_ That question changes the answer's
**shape**, not just its value. "Deprecate pending deletion" and "retain as the guard for a case
Workflow may reintroduce" both keep the code today and mean opposite things at R168.

**What the code says.** `composition_cycle` is raised in exactly **one** place
([query_engine.py:76](../../../workspace/apps/backend/app/query_engine.py#L76)) — the `qr_` branch
of `resolve_source`, when a source is already on the recursion path — and **caught in six** router
sites, including [workflows.py:218](../../../workspace/apps/backend/app/routers/workflows.py#L218).
After this round it is **provably unreachable**, and the proof is worth writing down because it is
also the proof of when it comes back:

- a Query's driving source and every hop's right narrow to `ds_`, so resolving a `qr_` never
  recurses into a second `qr_` — `visited` can never hold two;
- a Workflow's `wf_` source is a **LEAF** — `_resolve_workflow_leaf` reads the already-materialized
  parquet and **never resolves the workflow's own definition**, so a self-reference reads stale
  rows rather than looping;
- `visited` is seeded **fresh per source**
  ([query_engine.py:163](../../../workspace/apps/backend/app/query_engine.py#L163)), so even
  `sources: [qr_A, qr_A]` cannot cycle across a consolidation.

**So the guard is unreachable exactly because workflow-source resolution is FROZEN, not live** —
and _that_ is an item-4 question, not a settled fact. **If R168 makes a workflow source resolve
live, cycles return and this is precisely the code for them.** Deleting it now would mean deleting
a guard and re-deriving it one round later.

**Decision**: keep the code, keep the enum member, and document it in `api-error.yaml` as
**dormant — unreachable since R167, retained as the recursive-source guard**, naming the condition
that reactivates it. **Not** "deprecated". Zero wire change, zero FE risk (`isApiError` is a
hand-written allowlist — the R165 seam — and stays untouched). R168 decides whether it goes live
again or finally goes.

#### 2. D1's repair is deferred to item 4

**Human's call**: the repair lands with the decision that governs it. R167 stays purely about
retiring composition.

**The evidence for the other option is recorded, because the deferral has a cost and the cost has
a shape.** The inconsistency is concrete and one-sided:

```text
GET /queries/{id}/rows        → _run_steps(…)                    → SHAPED rows
Workflow consolidating it     → _resolve_plan + _build_inner_relation
                                (run_steps NEVER called)          → UN-SHAPED rows
                              → materialized to output.parquet
```

Same query, two answers, and **the wrong one is the one that persists**.

**The live trap this leaves open, named so it is not rediscovered**: **any Workflow built before
R168 that consolidates a query carrying `steps` freezes the wrong rows to disk**, and re-running it
after the fix will not repair an output nothing re-reads. Today that costs nothing — the
`workflows` table is empty (finding E) — and **that is the whole window**: it closes the moment a
workflow is built. Recorded here, in `_noun-model.md` D1, and in R168's inheritance.

### The API's answer, and the migration stance (2026-08-14)

**A `qr_` `sourceId` after this round → `422`, from the type, not a hand-written check.** Narrowing
`CreateQueryBody.sourceId` / `PreviewQueryBody.sourceId` and `QueryRelationship.rightSourceId` from
`SourceId` (`^(ds_|qr_)…`) to `DsId` makes Pydantic reject it at the edge, so create, update and
preview **agree by construction** rather than by three matching branches. This is the honest place
for an error: D4's rule is _unofferable at the gesture_ — and after R166 no gesture offers it — so
anything arriving here is an API caller, for whom a refusal **is** the answer.

**Migration: none, by the repo's standing clean-slate posture.** Alembic carries one baseline and
a stale dev DB is **re-created, not migrated** (`queries.md` § Data model). With zero composed rows
in either form (finding E, re-confirmed), there is nothing to migrate — so the stance is
**reject-at-write**, and it covers base and copy uniformly exactly as R166's Duplicate spec
promised, because neither can be created any more.

**One consequence to decide with eyes open**: narrowing the **read** model (`Query.sourceId`) too
means a hypothetical legacy row would fail validation on `GET` rather than render a degraded state.
That is the right trade **only because** finding E says no such row exists — so the narrowing must
be verified against the DB at build time, not assumed from this plan. If a composed row ever
appears, this line is the one that turns a data question into a `500`.

### Removal list — written from the code (2026-08-14)

**R166's trap carries forward: not every `qr_` in the FE is composition.** Verified per file:

| File                     | `qr_` | Fate                                                                                                   |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| `QueryCanvas.tsx`        | 24    | **remove** — `qr_` node kind + card, wide-source column expansion, "+N more", unavailable-`qr_` state |
| `joinGraph.ts`           | 14    | **remove** — `EffectiveLookup`, `ProvenanceOf`, `displayLeft` re-anchoring, the `promotable` test     |
| `types.ts`               | 9     | **narrow** — `SourceId` → `DsId` on the composition-bearing fields                                    |
| `mocks/fixtures.ts`      | 8     | **remove** — `MOCK_COMPOSED_QUERY`, `MOCK_CYCLE_QUERY_ID` and their column fixtures                   |
| `mocks/handlers.ts`      | 7     | **remove** — the composed-preview branch and the `composition_cycle` run branch                       |
| `useQueryBuilder.ts`     | 7     | **remove** — `isComposed`, the composed-columns fallback, the `compositionCycle` flag                 |
| `QueryDetailPage.tsx`    | 3     | **remove** — composition summary, composed badge, the `composition_cycle` state + its i18n            |
| `hooks.ts` · `chain.ts` · `QueriesPage.tsx` · `JoinEditor.tsx` | 1 ea. | **inspect** — each is a comment or a narrowing, not a branch          |
| **`features/dashboard/wire.ts` · `hooks.ts`** | 2 | **STAY — consumer.** A widget *reads* a query.                                     |
| **`features/data-management/workflows/types.ts` · `hooks.ts`** | 5 | **STAY — consumer.** A workflow *sources* a query.               |

A grep-driven removal would break the dashboard and Workflow. **7 of the 15 files that match `qr_`
must not be touched**, and `workflows/hooks.ts` is the subtle one: its `isQr` branch is Workflow
resolving its own source, which finding A says is the branch that **survives**.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)) — the
skill's **no-UI / refactor branch**: this is a feature round that changes the contract and engine
and adds **no new UI surface**, so the "design source" is this round's resolved calls + acceptance
criteria rather than a UI design doc.

| Condition                            | Fired? | Justification                                                                                                                                                       |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | **no** | The round **removes** states — the composed badge, the composition summary and the `composition_cycle` detail state all go. It adds none.                          |
| 2. New interaction pattern           | **no** | Nothing is introduced; the FE half is deletion and the engine half is a narrowing of an existing resolver.                                                          |
| 3. High user-error risk              | **no** | No new gesture can be mis-taken. The one new refusal is a `422` to an **API caller** for a shape no surface offers — and after R166 there is no gesture that sends it. |
| 4. Contract depends on unresolved UI | **no** | `SourceId → DsId` is decided by the **concept** (locked R161), not by any UI behaviour; R166 already withdrew every surface that could have influenced it.          |
| 5. UX confidence below threshold     | **no** | R166's walk closed the UX question by hand (T5 = yes, T4 = boundary). This round's uncertainty is **engine** risk — does narrowing break Workflow — which is not a UX question. |

Result: **Flow: DCFBI** (0 of 5 — a no-UI round lands DCFBI by construction; the run is recorded
because the audit trail is the point, not the suspense).

### Acceptance-walk questions — written at D, with how each outcome is read

Per [[walk-record-always-spec-on-ask]]. **`coverage: 0 of 5`** until the walk runs.

**A prerequisite this round has to buy, and R166 did not**: the `workflows` table is **empty**, so
finding A's central risk — narrowing a resolver Workflow depends on — has **nothing to hand-use**.
**B seeds a workflow** over a saved query so the I gate has one. Without it, T2 and T5 are
unaskable and the round would have to admit that its riskiest change was tested only by tests.

| #      | Question                                                                                                                                                                    | Verdict |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **T1** | Open a saved query with **joins and steps** (e.g. `Monthly revenue by status`). Same rows as before the round?                                                             | ⬜      |
| **T2** | Run the seeded **workflow** over a saved query. Does it still resolve and produce its table — i.e. did narrowing the resolver leave Workflow's reader intact?                | ⬜      |
| **T3** | Go to the query canvas and look for any trace of a saved query as a source — a node, a column list, a stale label.                                                          | ⬜      |
| **T4** | Ask the API to build a query on a query (`POST` a `qr_` `sourceId`). Is the refusal legible, or does it read as a bug?                                                      | ⬜      |
| **T5** | Point the workflow at a query that **has steps**. Does its output match what that query shows on its own detail page?                                                       | ⬜      |

**How each outcome is read** — decided now, so the result cannot be rationalised later:

- **T2 = no is the round's falsification**, and it fires finding A directly: the resolver was
  narrowed past Workflow's reader. Not a bug to patch at I — the narrowing is re-cut.
- **T5 is expected to say "no", and that is CORRECT for this round.** It is the deferred D1 trap
  made visible on purpose: the workflow shows **un-shaped** rows where the query shows shaped ones.
  A "no" here is **evidence handed to R168**, not a defect in R167. If it unexpectedly says "yes",
  something else already runs the steps and D1's diagnosis is wrong — which R168 needs to know
  more than a confirmation.
- **T3 = "I found something"** means the FE removal list missed a site; that is a build defect and
  is fixed in-round.
- **T4 = "reads as a bug"** reopens the API-stance call — a `422` from a type may be technically
  right and humanly opaque.

## Check

_(empty — Planning)_

## Act

_(empty — Planning)_

## Feeds into → Round_168 (what a Workflow is)

Program **item 4**, the last of the program. This round hands it **four** things:

1. A `qr_` resolver **narrowed to Workflow's reader alone** — Workflow's boundary finally visible
   in the code instead of tangled with a retired capability.
2. **D1, unrepaired and fully diagnosed** (human's call, 2026-08-14): `build_consolidated_relation`
   never runs a source query's `steps`, so consolidating a shaped query reads — and **freezes** —
   un-shaped rows. R168 fixes it as part of deciding what consolidation *means*.
3. **The frozen-or-live question**, which turns out to govern both of the above: `wf_` sources are
   leaves today (stale-but-safe). If R168 makes them live, cycles become possible again.
4. **A dormant `composition_cycle`** — kept precisely because (3) may reactivate it. R168 either
   makes it live again or finally retires it, with Workflow's definition in hand rather than
   guessed at a round early.
