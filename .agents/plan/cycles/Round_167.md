# Round 167: composition retired in the engine — and the bug that outlives it

**Status**: Planning
**Flow**: _(set at the Design exit via `flow-selector` — expect **DCFBI**; no new surface, and the FE work is deletion)_
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
wrong rows to disk. So the shape here is **narrow, collapse, and repair**, not remove.

_Track: 1 (product). Pulled by: program item 3b, and by R166's T5 — the replacement was confirmed
by hand before anything irreversible was touched._

## Plan

**Expected outcome**: a Query is a live table over **datasets only**, in the **engine** as well as
on every surface — the concept locked at R161 and the shipped code finally agree. **D5 closes.**
Workflow keeps reading its `qr_` sources through a resolver that is now **narrowed to it alone**,
and stops materializing **un-shaped** rows when it consolidates a shaped query.

**Falsified if**: narrowing the `qr_` branch breaks Workflow (finding A's whole point — the
`workflows` table is empty, so **tests are the only guard**, not hand-use); or D1's fix turns out
to change what a Workflow *means* rather than what it *reads*, which would make it item 4's
question and not this round's; or retiring `composition_cycle` from the contract costs more than
leaving a published-but-unreachable code (R165's `isApiError` lesson cuts **both** ways).

### The five findings, and what each becomes

Carried verbatim from R166 so the split stays legible from this side. **All five were re-verified
against the code on 2026-08-14** before this plan was written.

| #     | Finding                                                                                                                                                                                                                                                                                | Becomes                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A** | The `qr_` resolver is load-bearing for Workflow — a Workflow's sources are `qr_`/`wf_` and **never** `ds_` ([common.py:905](../../../workspace/apps/backend/app/models/common.py#L905)), resolved through the branch composition uses ([query_engine.py:74](../../../workspace/apps/backend/app/query_engine.py#L74)) | **NARROW**, don't delete — the branch survives as Workflow's reader; a Query's driving source becomes `ds_` only                   |
| **B** | `cyclic_join` is the **self-join boundary** for a `ds_` right already in the graph ([query_engine.py:213](../../../workspace/apps/backend/app/query_engine.py#L213)), which `_noun-model.md` says stays rejected                                                                        | **COLLAPSE** — the set-overlap form (D2) dies; the check degenerates to a single-id membership test. The error code **survives**   |
| **C** | `composition_cycle` becomes unreachable; `composition_base_missing` **stays alive** — the same reason string is the un-run-workflow case ([query_engine.py:142](../../../workspace/apps/backend/app/query_engine.py#L142))                                                             | **A CONTRACT CALL at D** (below) — not an automatic removal                                                                        |
| **D** | D1 relocates: `build_consolidated_relation` calls `_resolve_plan` + `_build_inner_relation` and **never `run_steps`** ([query_engine.py:831](../../../workspace/apps/backend/app/query_engine.py#L831)), so consolidating a _shaped_ query reads **un-shaped** rows — and **freezes them to `output.parquet`** | **REPAIR** — the one place in this round where a user-visible bug is fixed rather than a capability withdrawn                     |
| **E** | Zero composed queries exist; the `workflows` table is empty (`data/app.sqlite`, re-checked at D)                                                                                                                                                                                       | **A POLICY call, not a data job** — and the reason D1's repair is safe to make now                                                 |

### D — the design gate

- [ ] **Re-read `data/app.sqlite` and re-confirm finding E.** It is a live database and this plan
      rests on it. If a composed query now exists, the migration stance stops being a policy call.
- [ ] **Decide `composition_cycle`'s fate** — the round's one genuine contract question. Removing a
      published error code is a wire change with a **hand-written FE allowlist** on the other side
      (`isApiError`), which is exactly the seam R165 found the hard way; keeping it means publishing
      a code nothing can emit. Name the choice and its cost; do not let it default.
- [ ] **Decide whether D1's repair belongs here or in item 4.** The program plan says here, and
      finding E makes it safe (nothing is materialized yet). But "a Workflow consolidating a shaped
      query should read its shaped rows" is arguably a claim about **what a Workflow is** — item
      4's question. If the answer needs Workflow's definition first, split it out rather than
      guessing ([[split-a-fragile-subphase]]).
- [ ] **Decide what the API answers when handed a `qr_` `sourceId` after this round** — which
      status, which code, and whether create/update and preview all agree. D4's standing rule
      (_unofferable at the gesture, never an error at run_) is about surfaces; this is the API,
      where an error **is** the honest answer.
- [ ] **Write the migration stance** for a hypothetical pre-R166 composed query — none exist, but
      the stance must cover base **and** copy uniformly, which is what R166's Duplicate spec
      promised it would.
- [ ] **Write the removal list from the code, not a grep**, as R166 did — and carry R166's trap
      forward: **not every `qr_` is composition.** `features/dashboard/wire.ts` and
      `workflows/types.ts` reference `qr_` as a **consumer** relationship. Both stay.
- [ ] **Confirm the FE deletion list** the human deferred from R166 (2026-08-14): the canvas's
      `qr_` node rendering, `joinGraph`'s `EffectiveLookup` / `ProvenanceOf` / `displayLeft`
      re-anchoring / the `promotable` test, the unavailable-`qr_` state, the detail page's
      composition summary + badge + `composition_cycle` state, and the MSW fixtures + handlers
      behind them.
- [ ] **Close D5 in [`_noun-model.md`](../../design/data-management/_noun-model.md)** — and only
      here. R166 deliberately left it open because withdrawing an affordance is not retiring a
      capability.
- [ ] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit** and record
      the chain. Expect **DCFBI** — no new surface, and the FE half is deletion.
- [ ] **Write the acceptance-walk questions at D**, not at I ([[walk-record-always-spec-on-ask]]),
      **and how each outcome will be read** — the refinement R166 added. The walk is now 2-for-2 on
      finding defects every green gate missed.

### After D

C → B → I per the recorded chain. **The `design-sync` runs last**, once, over the final state —
that is why R162's sync was deliberately allowed to stay outstanding rather than run twice.

### Explicitly NOT in this round

- **What a Workflow is** — program item 4, `Round_168`. If the D gate finds D1 needs that answer
  first, D1 goes there with it.
- **The batched UI cluster** — R165's W-1/W-2 and the R157 cluster stay batched
  ([[batch-ui-bugs-into-one-round]]). R166 added one to it: **generalising `[Edit] [Duplicate]
  [Delete]`'s ordering rule to every detail header**, a cross-surface question parked with R157
  next to catalog row actions.
- **The naming/legibility cluster** parked by the human at R163.

## Risks / unknowns

| Risk                                                                                                                                                | Why it matters                                                                                                                                                            | Handling                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Narrowing a resolver Workflow depends on, with no Workflow to hand-use.** Finding E cuts both ways: the empty `workflows` table makes the repair safe **and** removes the walk that would catch a regression. | R166's whole method was "the human runs it". Here they cannot — there is nothing to run.                                                                                 | **Tests are the acceptance gate for the Workflow path, and the round must say so rather than implying a walk covered it.** Consider seeding a workflow so the I gate has one. |
| **Removing a published error code has an FE step no type error catches.** `isApiError` is a hand-written allowlist (R165).                          | The contract, the models and the copy can all be correct while the surface silently fails to recognise the code.                                                          | The D-gate call names it; if the code is removed, grep the allowlist as part of the change, not after.                                                                        |
| **D1's repair changes what gets frozen to disk.** A workflow run materializes `output.parquet`.                                                     | A behaviour change in a materializing path is not revertable by editing code — stale outputs would survive it.                                                             | Finding E (empty table) is the reason to do it **now**; re-confirm at D before relying on it.                                                                                 |
| **A 14-doc `design-sync` is a large diff at the end of a round that already changed the engine.**                                                   | [[design-docs-are-source-code]] — a sync that runs on a half-finished state has to run again.                                                                            | Run it **last**, once, and commit it as its own gate seam ([[round-bundling-and-revert-seams]]).                                                                             |
| **Incidental-order test assertions** — R165 found two backend tests asserting row order while testing something else; R166 deferred the sweep here. | A round that moves engine code moves a lot of code under a lot of tests, and an incidental assertion fails for the wrong reason.                                          | Sweep as part of B, not as a follow-up.                                                                                                                                     |

## Do

_(empty — Planning)_

## Check

_(empty — Planning)_

## Act

_(empty — Planning)_

## Feeds into → Round_168 (what a Workflow is)

Program **item 4**, the last of the program. This round hands it two things: a `qr_` resolver
**narrowed to Workflow's reader alone** — so Workflow's boundary is finally visible in the code
rather than tangled with a retired capability — and, depending on the D gate's second call, either
a fixed D1 or the reason it belongs to Workflow's own definition.
