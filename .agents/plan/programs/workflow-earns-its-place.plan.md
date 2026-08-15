# Program plan: Workflow earns its place

**Status**: **Draft — awaiting the human's ranking at item 1.** (opening round — `cycles/Round_175.md`, not yet created)
**Opened**: 2026-08-15

Settle whether the **Workflow** noun survives, and if it does, make it honest. [R174](../cycles/Round_174.md)'s
dogfood found the noun has **no exit** — a materialized output that nothing on the product can
consume — plus two silent wrong-number defects in `consolidate`, its own defining operation. This
program runs the noun-level decision **first** and treats every repair as conditional on it.
Cadence: one slice per round, each independently useful. The goal is that a Workflow is either
something a person can finish a job with, or something the repo no longer carries.

_Track: 1 (product). Pulled by: [R174](../cycles/Round_174.md)'s seven findings, four severe — and
by the [Evolution Rule](../../AGENTS.md)'s pruning discipline: an artifact that no longer shows
evidence of value is pruned, not preserved._

## The question this program exists to answer

> **A Workflow consolidates + materializes. Dataset Append already stacks monthly exports, and no
> widget can read a workflow's output. So what job is left that only this noun can do — and is
> anyone trying to do it?**

Two prior decisions make this sharper than it looks:

- **[Query program, settled decision 8](query-shaping-surface.plan.md)** — _"Stacking is not
  Query's job — monthly exports combine at the dataset level via upload + append. A workflow can
  do it, but that is a consequence, not its purpose."_ The headline stacking use case is **already
  served elsewhere**, and has been since R155.
- **[R168](../cycles/Round_168.md)** — the noun is _exactly_ **consolidate + materialize**, frozen
  permanently; its `steps` are borrowed. That is a deliberately small surface, and R174 found the
  small surface has no consumer.

## Where the findings live

**The evidence is not restated here.** [`Round_174` § Do](../cycles/Round_174.md) holds each
finding with its measurement, commands, and code anchors — it is the append-only record and the
single source of truth for *what was observed*. This file owns only *what we do about it*, tracked
in [§ Rolling log](#rolling-log) below. One finding, one home, one link.

## The repeatable unit (what each round does)

Each round is a **DCFBI slice** over one item, with two program-specific rules:

1. **D updates the design corpus in-round** ([[d-gate-artifact-in-design-corpus]]) —
   [`workflows.md`](../../design/data-management/workflows/workflows.md) and
   [`_noun-model.md`](../../design/data-management/_noun-model.md) are rewritten as part of the
   round, never as a round of their own.
2. **Every item after 1 is conditional and must re-read item 1's ruling before it opens.** If item
   1 prunes the noun, items 2–4 are void, not deferred.
3. **The acceptance walk applies** (PDCA § Round Template) — these are user-exercisable surfaces,
   and R174 is the fourth consecutive round where a walk or a human read found what gates did not.

## Scope + firewall

- **In**: the Workflow noun's disposition, and — conditional on it surviving — consolidate's
  correctness (provenance, schema), staleness detection, and a consumption path.
- **Deferred**: W-5 / W-6, both minor, both batched into the human's planned UI round
  ([[batch-ui-bugs-into-one-round]]).
- **Out**: re-opening what a Query is (settled 2026-08-07), and re-opening `query⋈query` (D5 closed
  at R167).
- **Firewall (anti-creep)** — **this program may not deepen the noun before item 1 rules on it.**
  R174's whole lesson is that four build rounds and four refine rounds never asked whether anything
  could consume the result. No item 2+ work starts on the assumption that the answer is "keep".

## Work items + order

| #   | Item                                                                                       | Status                    | Round     |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| **1** | **Does the noun survive? — give it a consumer, or prune it.** The one-way door. **Reframed by W-7**: the noun is a *materialized view*, so the question is whether a **frozen snapshot that outlives its sources** earns its place — not only whether consolidate does. | **the human's call — open** | `Round_175` |
| 2   | **Provenance on consolidate** (W-3). Port R156's `Source.Name` pattern to the union.        | conditional on 1            | —         |
| 3   | **Same-shape: enforce or widen** (W-2). `422` on divergent sources, or capture the union schema. | conditional on 1        | —         |
| 4   | **Staleness: detect it** (W-4). Needs a schema decision first — `updated_at` vs a definition-hash captured at run vs re-resolve on read. | conditional on 1 | — |

**Item 1 is a one-way door and is deliberately NOT pre-decided here**
([[lock-concepts-hold-one-way-door]]). The two honest directions, with what each costs:

| Direction                     | What it means                                                                                                             | Cost                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **(a) Give it an exit**       | Widen `Widget.queryId` to accept `wf_`. The backend rows path exists and already documents itself as the widget load path. | Small — a contract widen + a picker that lists both. Then items 2–4 follow. |
| **(b) Prune the noun**        | Remove Workflow. Dataset Append already stacks; Query already shapes. Materialization becomes a performance answer to a question nobody asked. | Large deletion, but it removes 3 severe defects instead of fixing them. |

**What would settle it**: a real job the human has that (a) unblocks and (b) does not. R174 could
not produce one from seed data — which is evidence, not proof.

## Rolling log

Every R174 finding appears here exactly once, with a disposition. **Nothing is dropped**: each row
is either an item, deferred to a named home, or void-if-pruned. Evidence stays in
[`Round_174` § Do](../cycles/Round_174.md).

| ID  | Entry                                                | Kind        | Severity | Seen in     | Disposition                            |
| ----- | ------------------------------------------------------ | ------------- | ---------- | ------------- | ---------------------------------------- |
| W-1 | Workflow output has **no consumer**                  | noun/exit   | severe   | R174        | **item 1 — the one-way door**          |
| W-2 | Consolidate narrows schema to the FIRST source       | correctness | severe   | R174        | item 3 _(void if pruned)_              |
| W-3 | Consolidate double-counts; no provenance             | correctness | severe   | R174        | item 2 _(void if pruned)_              |
| W-4 | Upstream staleness, undiagnosable (no `updated_at`)  | correctness | severe   | R168 · R174 | item 4 _(void if pruned)_              |
| W-7 | Workflow **outlives its sources**, still presents as healthy | noun/correctness | severe | R174 | **reframes item 1** + dependency validation |
| W-5 | Workflow accepted over a never-resolved query → `201` | validation  | minor    | R174        | deferred → the human's UI round        |
| W-6 | A query named for an aggregate returns raw rows      | naming      | minor    | R163 · R174 | deferred → the parked naming theme     |

_`updated_at` is absent product-wide, not only for workflows — if item 1 prunes the noun, W-4's
underlying gap survives it and must be re-homed rather than voided._

## Lifecycle

Active until item 1 rules and its consequences land — either the noun has an exit and items 2–4
close, or the noun is pruned and items 2–4 are void. At close, the rolling log's open entries
promote to their own rounds or a decision artifact; this file folds into a closing note.
