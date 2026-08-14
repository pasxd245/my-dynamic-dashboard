# Round 168: what a Workflow is — and the bug that has been waiting for the answer

**Status**: Planning
**Flow**: _(set at the Design exit via `flow-selector`)_
**Date started**: 2026-08-14
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_167](Round_167.md)** — composition is retired in the engine, **D5 is
closed**, and `resolve_source`'s `qr_` branch is now narrowed to **one call site**: Workflow's.
That is the inheritance that matters. Workflow's boundary is finally visible in the code instead
of tangled with a capability the product no longer has, so the noun can be defined against what it
actually does rather than against what it shared.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— **item 4**, the last of the program.

**This round is not open-ended noun design.** Three concrete questions arrive already sharpened by
R167, and each has a shipped consequence waiting on it. Answering them **is** defining the noun;
starting from a blank "what should a Workflow be" would re-derive what four rounds already learned.

_Track: 1 (product). Pulled by: program item 4 — and by R167's deferral of D1, which the human
routed here so the repair lands with the decision that governs it._

## Plan

**Expected outcome**: the Workflow noun is defined in the design corpus, **D1 is repaired** (or
consciously re-deferred with a reason that is not "later"), and the frozen-or-live question is
settled — which also settles whether `composition_cycle` goes live again or is finally retired.

**Falsified if**: the three questions turn out to be separable from "what a Workflow is" — i.e.
D1 can be fixed without deciding what consolidation *means*, in which case the deferral was wrong
and the repair should simply have shipped at R167.

### The three questions R167 hands over

| #     | Question                                                                                                                          | The shipped thing waiting on it                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Does consolidating a query mean consolidating what that query RETURNS?** If yes, D1 is a bug; if no, it is the definition.      | `build_consolidated_relation` never calls `run_steps`, so a Workflow over a _shaped_ query reads **un-shaped** rows — and **freezes them to `output.parquet`**. Seeded and demonstrable. |
| **2** | **Is a workflow source resolved FROZEN or LIVE?**                                                                                 | Today `wf_` is a frozen leaf, which is the _only_ reason `composition_cycle` is unreachable. Live resolution reactivates it; frozen retires it for good.                                 |
| **3** | **What is the noun for, that a Query with `steps` is not?**                                                                       | The whole program tested "query gains steps" against the wall. Consolidation (`UNION ALL BY NAME`) is the one thing a Query cannot express — is that the noun, or is there more?          |

**Question 1 is not rhetorical, and the answer is not obvious.** `GET /queries/{id}/rows` runs a
query's steps, so "the same query answers differently depending on who asks" reads as an
inconsistency. But a Workflow **materializes**, and a defensible reading is that it consolidates
the query's **source rows** and then applies **its own** steps — one shaping layer, not two
stacked. The D gate must pick a reading and say why; the FE says nothing about which is intended.

### D — the design gate

- [ ] **Answer questions 1–3** and write the noun into
      [`workflows.md`](../../design/data-management/workflows/workflows.md)
      ([[d-gate-artifact-in-design-corpus]]) — which already carries R167's § Known defect and the
      resolver-ownership section as the current-state starting point.
- [ ] **Decide D1's repair or its principled deferral.** If it is a bug, the fix is small
      (`run_steps` in the consolidation path); the risk is that a run **materializes**, so a wrong
      answer persists. If it is the definition, the FE must **say so** — a workflow whose output
      does not match its source query is otherwise indistinguishable from a bug (R167's walk
      confirmed a human reads it as one).
- [ ] **Settle `composition_cycle`** — live sources reactivate it, frozen retires it. Either way
      it stops being dormant, which is the state R167 deliberately left it in
      ([api-error.yaml](../../../workspace/packages/contracts/_shared/api-error.yaml)).
- [ ] **Re-confirm the seeded workflow still demonstrates the trap** before designing against it
      (the seed is disposable; `--reset` regenerates it).
- [ ] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md)** at the Design exit.
- [ ] **Write the acceptance-walk questions at D**, with how each outcome is read — **and apply
      R167's new criterion**: _if a test can answer it, it is a test_ ([[walk-record-always-spec-on-ask]]).
      Every question must name a gesture on a surface a human can perceive.

### Explicitly NOT in this round

- **The 8-doc `design-sync` backlog** (~286 round-stamps) — unscoped since R162 and **still
  unscoped**; it is its own work, not a tail-end.
- **The latent pager risk** — recorded at R167, measured as non-reproducing, fix deferred by the
  human.
- **The batched UI cluster** — R165's W-1/W-2, R157's cluster, R166's header-ordering
  generalisation ([[batch-ui-bugs-into-one-round]]). R167's W-1 (canvas layout) is **not** in it:
  the human ignored it rather than queuing it.
- **The naming/legibility cluster** parked at R163.

## Risks / unknowns

| Risk                                                                                                                                | Why it matters                                                                                                                    | Handling                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Defining a noun is open-ended work** and this program has shipped four rounds of narrow, checkable slices.                        | An unbounded design round is where scope goes to die — and item 4 is the last one, so there is no successor to absorb the overflow. | The three questions bound it. If the D gate cannot answer them without a fifth, that is the signal to split, not to widen.                     |
| **D1's repair changes what is FROZEN to disk.**                                                                                     | A materialized wrong answer is not fixed by later fixing the code; nothing re-reads it.                                            | The `workflows` table now holds the seeded demo (R167 closed the empty-table window deliberately). Re-check before relying on it being cheap. |
| **The FE may need to say what a Workflow means**, not just run it.                                                                  | R167's walk showed a human reads a mismatch as a bug. If question 1 answers "by design", silence is not an option.                | Whether that is copy, a badge, or a summary line is the D gate's, and it decides the flow.                                                     |

## Do

_(empty — Planning)_

## Check

_(empty — Planning)_

## Act

_(empty — Planning)_

## Feeds into → the program closes

Item 4 is the last of [`query-shaping-surface`](../programs/query-shaping-surface.plan.md). When
it lands the program's thesis has been tested end to end: **a Query gains operations until it
cannot express the shaping, and the wall that pulls a Workflow noun is consolidation.** What
succeeds it is not pre-decided — the standing backlog (R157 UX cluster, naming/legibility, the
`design-sync` backlog, Export ④, `[F-prov-reimport-choice]`, AI-propose-key #2, R145 1b) is ranked
by the human when the program closes, not before.
