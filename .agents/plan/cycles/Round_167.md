# Round 167: composition retired in the engine — and the bug that outlives it

**Status**: **Review** — D + C + B + I closed; walk 5 of 5, all pass. Awaiting human sign-off to flip Complete.
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

### C + B — what shipped (2026-08-14)

**C — the wire refuses composition structurally.** `sourceId` and `rightSourceId` narrow to
`^ds_…` across the contract, the Pydantic models and the FE types, so a `qr_` is a **422 from the
model** rather than a guard three endpoints must remember. The polymorphic **`SourceId` alias is
retired outright** — it had exactly four users, all query-side, and existed only to say _"a Query
may read a Query"_. `WorkflowSourceId` survives untouched, which is finding A visible in the type
system. `tests/test_composition.py` was **rewritten, not deleted**: three tests assert the refusal
at the wire (including a `qr_` right with a **legal** `ds_` driving source — narrowing only
`sourceId` would let that form through), three craft cycles at the DB layer to prove the dormant
guard still fires.

**B1 — the engine narrowing, made structural.** "Narrowed to Workflow's reader" had to mean
something checkable, so `_resolve_dataset_leaf` was split out and the **join path points at it
directly**. That leaves `resolve_source` reachable from **exactly one call site** — a driving
source — and a driving source is polymorphic only when a Workflow supplies it. D2's set-overlap
collapsed to a single-id membership test; **`cyclic_join` survives** as the self-join boundary.

> **One behaviour change taken deliberately rather than patched around.** A DB-crafted `qr_` on a
> hop's right is now `relationship_stale`, not `composition_cycle`. Routing hop rights back through
> the polymorphic resolver would have preserved the old code — at the cost of undoing the narrowing
> to protect a test. The new answer is more honest (the edge does not name a dataset; nothing can
> recurse), and it **sharpens what "dormant" means**: the guard survives for a **driving** source —
> Workflow's case, the one item 4 could reactivate — and is gone for right-of-hop, which can never
> return because that operand is a `DsId` in the type system, not a policy.

**B1 (FE)** — `joinGraph` loses `EffectiveLookup` / `ProvenanceOf` / `ColumnProvenance`, the
`displayLeft` re-anchoring, `promotable` and the `derived` reason; `QueryCanvas` loses the `qr_`
node kind, card, icon, `effectiveByQr`, `provenanceOf`, `unavailableOf` and the unavailable state.
Two props collapse into one (`rootSourceId`) — they could only differ when a base was composed.
**`query-provenance.test.ts` was deleted but not wholesale**: it held R93's draw-time **dtype
guard** beside the provenance rewrite, and that guard is not retired, so its four tests moved to
`query-canvas-connect.test.ts` rather than going down with the file they happened to share.

**B2 — a workflow is seeded, and it earns its place twice.** Writing the walk questions at D
surfaced that finding A had **nothing to hand-use**. The seed now creates and RUNS one workflow,
pointed at a **shaped** query on purpose. Verified live, not asserted:

| | Result |
| --- | --- |
| **Does Workflow still resolve after the narrowing?** | **Yes** — it runs and returns its table. Finding A's reader survived, on a runnable artifact. |
| **Does its output match its source query?** | **No, by design** — the query shows **4 shaped rows** (`status, amount`); the workflow materializes **120 un-shaped order rows**. |

**B3 — the incidental-order sweep** (R165's follow-up, deferred here by R166) ran over all 30
backend test files by script, not by eye. **One survivor**, hardened. It also turned up something
larger, **measured and NOT fixed** — see § The pager finding.

**B4 — `_noun-model.md` D5 is CLOSED**, and the four docs whose code changed are code-true again
(`queries.md`, `canvas.md`, `workflows.md`, `_noun-model.md`). `canvas.md`'s `qr_` section was
replaced by an **inventory of what the symmetric canvas cost** — six pieces of machinery, all
deleted — so a future "join anything to anything" proposal has to re-fund them knowingly.

**Gates**: pytest **434** · contracts **40** · builder **363 / 25 files** · `tsc` clean ·
`design:lint` 0/14 · `design:tokens` 0/11 · `md:lint` 0/311 · `check:links` at parity with the
pre-round baseline. The **7 consumer files** (dashboard, workflows) verified untouched against the
staged diff at each commit, not by eye.

### The pager finding — measured, not fixed (human's call, 2026-08-14)

The sweep found `query_dataset_rows` pages with `LIMIT/OFFSET` and **no `ORDER BY`** —
structurally the same shape as R165's W-7 bug, which returned 33 of 96 rows twice and 33 never.

**It does not reproduce.** Measured on 500k rows / 2048-row row groups / 8 threads, in the three
shapes this path actually runs — bare scan, `WHERE` filter, and the `?q=` LIKE — every one
returned **zero duplicates across 10 pages** and agreed with itself on a repeated page. The
stepped path reshuffled because joins/aggregates/windows genuinely reorder under parallelism; a
parquet scan preserves file order.

So it is a **latent** risk (SQL guarantees nothing without `ORDER BY`) with no observed failure,
and closing it means a sort on **every** dataset page read — on a 90k-row table, for a bug that
has never fired. **Recorded rather than fixed**, so it is a decision with evidence rather than a
silent widening of a composition-retirement round.

### Not done, and stated rather than implied

**The 14-doc `design-sync` is half done.** The four docs R167's code changed are synced; the other
**eight are untouched**. R167 changed nothing they describe, so they are not made untrue by this
round — but they carry **~286 round-stamps** (`upload.md` alone 166), which is the ledger accretion
`design-sync` exists to strip. That is its own piece of work, raised for a scope call rather than
absorbed here.

## Check

**Gates are green and that settles nothing about finding A.** Every gate passed before the walk —
pytest 434, contracts 40, builder 363, four linters — and the walk is 2-for-2 across R165/R166 on
finding defects every green gate missed.

**Acceptance walk — run by the human 2026-08-14. `coverage: 5 of 5`, all pass, one defect (W-1).** Questions written at D
([[walk-record-always-spec-on-ask]]); the seeded artifacts they act on are named below, because
this round's questions need specific objects rather than any query.

| #      | Question                                                                                                                                        | Act on                                                    | Verdict |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| **T1** | Open a saved query with **joins and steps** — same rows as before the round?                                                                    | `Monthly revenue by status` · `Customers with orders`      | ✅ pass |
| **T2** | Run the seeded **workflow**. Does it still resolve and produce its table — did narrowing the resolver leave Workflow's reader intact?           | `Consolidated revenue by status`                           | ✅ **pass — finding A did NOT fire** |
| **T3** | Go to a query's **Canvas** tab and look for any trace of a saved query as a source — a node, a column list, a stale label, a grouped picker.    | `Customers with orders` → Edit → Canvas                    | ✅ pass — **no trace**; 1 unrelated defect (**W-1**) |
| **T4** | Ask the API to build a query on a query. Is the refusal legible, or does it read as a bug?                                                      | `POST` a `qr_` `sourceId` (curl)                           | ✅ pass — _"correct and as expected"_ |
| **T5** | Compare the workflow's output against its source query's own detail page. Do they match?                                                       | the workflow **vs** `Revenue by order status`              | ✅ **NO — as predicted** |

**How each outcome is read** — decided in advance, so a result cannot be rationalised after it
arrives:

- **T2 = no is the round's falsification**, and it fires finding A directly: the resolver was
  narrowed past Workflow's reader. Not a bug to patch at I — the narrowing gets re-cut.
- **T5 is EXPECTED to say "no", and that is CORRECT.** The query shows **4 shaped rows**; the
  workflow shows **~120 un-shaped** ones. That is the **deferred D1 trap**, seeded deliberately so
  R168 argues from a screen rather than a paragraph. A "no" here is **evidence handed forward**,
  not a defect in R167. If it unexpectedly says **yes**, something else already runs the steps and
  D1's diagnosis is wrong — which R168 needs to know more than it needs a confirmation.
- **T3 = "I found something"** means the removal list missed a site — a build defect, fixed in-round.
- **T4 = "reads as a bug"** reopens the API-stance call: a `422` from a type can be technically
  right and humanly opaque.

### What the walk returned (2026-08-14)

**T2 is the headline: finding A did not fire.** The seeded workflow resolves and produces its
table, so narrowing `resolve_source` to one call site left Workflow's reader intact — verified by
hand, which is the thing tests could not do for this round.

**T5 confirmed the deferred trap on the surface**, exactly as pre-committed: the workflow's output
is **120 rows** where its base query `Revenue by order status` shows **4**. R168 now inherits a
screen rather than a paragraph. The human's phrasing is worth keeping verbatim — _"the workflow
output is 120 rows, but the base query is 4 (having filter)"_ — because it names the mechanism the
right way round: the base's **shaping** is what goes missing, not its rows.

**T4 read as a boundary** — the human ran it and returned _"correct and as expected"_. The refusal
is a `422` naming the field, the offending value and the expected shape:
`{"loc":["body","sourceId"],"msg":"String should match pattern '^ds_[0-9a-f]{8}$'"}`.

**The tradeoff underneath it is worth recording, because it will look like an oversight later.**
That message states a **regex, not a reason** — Pydantic's raw pattern vocabulary. A friendlier one
(_"a query's source must be a dataset; to make a variant, use Duplicate"_) needs a **custom
validator**, which is exactly the hand-written branch the C gate removed to make create / update /
preview agree **by construction**. So legibility here is bought by giving that guarantee back.
It stays as-is because the message is legible **for its only possible audience**: no gesture can
produce it — R166 withdrew every one — so the only caller is someone writing against the API
directly, for whom `loc` + the expected shape is the useful answer. D4's rule (_in the user's
words, never a run-time engine error_) governs **gestures**, and there is no gesture left.

### W-1 — a canvas drag looks like an edit and isn't (T3)

**Found**: re-arranging a node on the canvas does not mark the builder dirty, so `[Save]` stays
disabled. The human graded it _"very small issue as of now"_.

**Diagnosed, and the diagnosis inverts the report.** `Save` is **correctly** disabled — there is
genuinely nothing to save. Node positions live in `posOverride`, component-local `useState`, and
`position` / `layout` appear **nowhere** in `QueryDefinition` (`types.ts`, `chain.ts`). Canvas
layout is **not a persisted concept at all**: an arrangement is lost on tab-switch, remount or
reload, and always has been. So the defect is not a missing dirty-flag — it is that the canvas
**offers a gesture whose result silently does not last**, and a disabled Save is the only hint.
That is D4's rule from the other side: not _an error at run_, but _a gesture that quietly does
nothing durable_.

**Not an R167 regression** — `posOverride` dates to R89 (`39cc5e2`) and this round never touched
it. **Not fixed here**: persisting layout is a model + contract change and a real design question
(does a data definition own its picture?), which is not a composition-retirement round's to answer.
**Batched to the R157 UX cluster** ([[batch-ui-bugs-into-one-round]]), where it joins R165's W-1/W-2
and R166's header-ordering generalisation.

> **Third instance, and it is now a pattern worth promoting.** T3 asked about withdrawn `qr_`
> traces and returned a **drag-persistence** defect. R165: five questions, six defects, none about
> what its question asked. R166: T1 asked about rows, returned **button order**. R167: T3 asked
> about `qr_` traces, returned **canvas layout**. Three rounds, three domains, same shape — _a walk
> question works by putting a human in front of the surface, and what they notice is not bounded by
> what you asked_. Per the Evolution Rule's third-instance bar, this is now a **promotion
> candidate** rather than a note.

## Act

**The round's claim held.** A Query is a live table over datasets only — in the wire, in the engine
and on every surface — and **D5 is closed**, the debt that opened this program. Neither _Falsified
if_ fired: T2 proved the narrowing left Workflow's reader intact (finding A's whole risk), and the
narrowing needed no answer to _what a Workflow is_, so the FE/engine seam was the right second cut.

**What R167 got right by refusing the plan.** The program said item 3 would "delete the machinery".
Three of the four things it named were **not deleted**, each because a code walk said so before a
line moved: `resolve_source`'s `qr_` branch (Workflow's reader), `cyclic_join` (the self-join
boundary), and `composition_cycle` (dormant, retained for a live-resolving Workflow source). A
round executed faithfully against that plan would have broken Workflow outright.

**Two lessons.**

1. **"Narrowed" has to be checkable or it is just a comment.** The round could have satisfied
   finding A by documenting that the `qr_` branch is Workflow's. Instead the dataset leaf was split
   out and the join path pointed at it, leaving `resolve_source` reachable from **exactly one call
   site** — so the boundary is in the **call graph**, where a future reader trips over it, rather
   than in prose they can skip. **Candidate for `memory/`**: _a boundary asserted in a comment is
   not a boundary; move a call site instead._
2. **Seed the artifact a walk needs, or the walk cannot ask the question.** Writing T2/T5 at D
   surfaced that finding A had **nothing to hand-use** — the `workflows` table was empty, so this
   round's riskiest change would have been tested only by tests while the round implied otherwise.
   Seeding one workflow made T2 answerable **and** made the deferred D1 trap visible on a screen.

**Promotion candidate — third instance, now over the bar.** T3 asked about withdrawn `qr_` traces
and returned a **canvas drag-persistence** defect. R165: six defects, none about their question.
R166: T1 asked about rows, returned **button order**. R167: T3 asked about traces, returned
**layout**. Three rounds, three domains, one shape — _a walk question works by putting a human in
front of the surface, and what they notice is not bounded by what you asked._ Per the Evolution
Rule's third-instance bar this is now a **proposal for the human**, not a note.

**Handed to R168** (§ Feeds into) and **to the batched UI cluster** (W-1 canvas layout, joining
R165's W-1/W-2 and R166's header-ordering generalisation).

**Two open calls left with the human**, neither absorbed silently: the **latent pager risk**
(measured, not fixed — § The pager finding) and the **8-doc `design-sync` backlog** (~286
round-stamps; R167 synced only the four its code changed).

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
