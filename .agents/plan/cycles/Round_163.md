# Round 163: the within-group column, finished — contract · engine · real numbers

**Status**: Planning — awaiting human review of this plan
**Date started**:
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_162](Round_162.md)** — the back half of one capability, split by the
`flow-selector`'s **DFCFBI (triggers 1, 3, 5)** result and the standing
[[dfcfbi-two-round-split]]. R162 delivered the D gate (the Query concept re-locked to **datasets
only**, ordered operations) and **F1** (the "Group value" card + the grain line, FE-only on MSW).
**No flow-selector run this round** — the chain is already recorded in R162's Do log and a
recorded `Flow:` line is not re-decided.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— item 1, second half.

Ship the engine behind the affordance: **C → B → F2 → I**, ending with the human rebuilding the
dashboard that blocked them on 2026-08-07, on real data, with numbers they trust.

_Track: 1 (product). Pulled by: R162's split — the affordance exists and computes nothing._

## Plan

**Expected outcome**: the human rebuilds the blocked dashboard — including "each agent vs their
team" — using **one Query over datasets, no composition**, and confirms the numbers.

**Falsified if**: the rebuild fails because the real blocked question was a different shape (see
Risks — this is R162's inherited named assumption, still untested); or the numbers are right but
the human cannot tell *which* reading they got; or ordering interactions make results
unpredictable enough that they don't trust the output.

- [ ] **C — contract.** Add `GroupColumnStep` to
      [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml): body
      `{kind, name, agg, col?, by[]}`, `by` **`minItems: 1`**, `agg` the existing measure enum.
      Add it to the `Step` `oneOf` **and** the `discriminator.mapping`. **Decide the workflow
      question first** (see Risks — the Python `Step` union is shared with `WorkflowDefinition`
      but `workflow.yaml` duplicates its own list). The FE types already landed at F1 — **verify
      they match the YAML rather than re-authoring them**.
- [ ] **B — engine.** `GroupColumnStep` in
      [common.py](../../../workspace/apps/backend/app/models/common.py) + the `Step` union;
      `_plan_group_column` in [query_engine.py](../../../workspace/apps/backend/app/query_engine.py)
      **reusing `_validate_measure` and the `_aggregate_output_columns` dtype rules verbatim** (one
      vocabulary, not a lookalike); a `group_column` branch in `_apply_step`
      ([rows_reader.py:373](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373))
      emitting `SELECT *, <expr> OVER (PARTITION BY <by…>) AS name FROM (prev)`. **No in-window
      `ORDER BY`** — that is what keeps running-total/rank in item 2. Additive; **no existing step
      changes**. pytest covers: row count unchanged; the value equals the collapsing aggregate of
      the same `(agg, col)` over the same `by`, joined back; `sum`/`avg` coalesce an all-NULL group
      to `0` while `min`/`max` stay NULL; `by`/`col`/`name` errors → 422 with the sibling steps'
      detail vocabulary; drift → `409 query_stale`.
- [ ] **F2 — confirm the surface against the real backend**, and build the **two card states F1
      deliberately deferred** now that the error vocabulary exists: **orphaned-by-a-move**
      (`<Alert role="alert">` naming the column, `[Save]` disabled) and the **name-collision**
      inline field error. Both are already specced
      ([query-construction.md § Card states](../../design/data-management/queries/query-construction.md)).
- [ ] **I — Integration walk**, then run
      [`gate-walker`](../../skills/gate-walker/SKILL.md) on the Integration gate.
- [ ] **Acceptance — the human rebuilds the blocked dashboard on real data** (`pnpm dev:seed`, the
      real 2025 call logs) and confirms the numbers. Gates green is necessary, not sufficient
      ([[dfcfbi-f1-needs-human-review]]).
- [ ] **Answer R162's unresolved question — explicitly.** Does the grain line make the
      pooled-vs-average-of-groups reading legible? R162 could not test it (mocked data) and the
      human's walk returned no verdict. **A yes/no is required at this round's close**; silence is
      not a pass.
- [ ] Re-run `design-sync --check` on the docs this round touches, before the close.

### Explicitly NOT in this round

- **The rest of the within-group family** (% of total · running total · rank within group · vs
  prior period) — program item 2, **R164**. Each needs an in-window `ORDER BY` + frame.
- **Retiring composition / shipping Duplicate** — program item 3, **R165**
  ([§ Item 3 scope](../programs/query-shaping-surface.plan.md)).
- **The UX cluster** — `[F-join-label-qualify]`, `[F-promote-gate]` (R162 § Feeds into), the
  remaining R157 items. Batched, per [[r-ui-bug-fixing-round]].
- **Raising `_MAX_STEPS` pre-emptively** — see Risks; the acceptance walk is the trigger.

## Risks / unknowns

- **Inherited named assumption — the blocked question is "compare to a group", *roughly*.** The
  human confirmed the shape from a whole-dashboard view, not a single tile. **This round's
  acceptance walk is the first real test of it.** If the rebuild fails because the true shape
  differs (period-over-period is R164; presence/absence is unscheduled), that is a **successful
  falsification, not a failed round** — record it and re-rank the program before R164 opens.
- **The shared `Step` union widens Workflow silently — a contract/impl split.**
  `WorkflowDefinition.steps` uses the **same** Python `Step` union as `QueryDefinition.steps`
  ([common.py:819](../../../workspace/apps/backend/app/models/common.py#L819) vs
  [:519](../../../workspace/apps/backend/app/models/common.py#L519)), so adding `GroupColumnStep`
  widens workflows **automatically on the Python side**. But
  [`workflow.yaml`](../../../workspace/packages/contracts/_shared/workflow.yaml) maintains its own
  **duplicated** `oneOf`/mapping and would **not** widen — Python would accept what the contract
  forbids. Classic [[widening-shared-wire-model-omit-serializer]]. **Decide at C, don't discover at
  B**: widen `workflow.yaml` too (coherent — workflows run the same `_apply_step` via
  `materialize_steps`, ~2 lines) or narrow the Python side for workflows (asymmetric, more code).
  The contract-validity test is the seam that catches it either way.
- **`_MAX_STEPS = 8` with zero headroom on the harder reading.**
  ([query_engine.py:461](../../../workspace/apps/backend/app/query_engine.py#L461).) The **pooled**
  T3 path costs **exactly 8** steps; per-member costs 6. **Not pre-raised** — if the acceptance
  walk hits the cap, that is the evidence to raise it, and the number to raise it to.
- **`count` in a window means the group's ROW count, not the underlying tally.** After
  `aggregate [agent, team, outcome] → count`, a `count` group-column counts *outcome rows per
  agent* (2–3), not calls. The user wants `sum` of the `count` column. Correct, and a live
  foot-gun — watch for it in the walk; it may pull copy, not code.
- **Order × within-group.** A group column before vs after a `filter` averages over different
  groups. Correct but surprising; the grain line addresses placement relative to `aggregate`, **not
  to `filter`**. If the walk trips on it, that is a real gap.
- **Join-after-aggregate keys.** Joining after a group-by needs the key to have survived it.
  Impossible joins should be unofferable, not errors — the standing **D4 rule**
  ([`_noun-model.md`](../../design/data-management/_noun-model.md)).

## Do

_(to be filled during the round)_

## Check

- [ ] Verify outcomes against the goal (tests, lint, human walk) — the pass/fail verdict
- [ ] **The blocked dashboard rebuilds end-to-end**, and the human confirms the numbers
- [ ] **71.4% (pooled) and 70.8% (average-of-agents) are BOTH reachable**, and the human can say
      which one they got — the explicit verdict R162 could not produce
- [ ] The docs match the shipped code (`design-sync --check` clean, no drift introduced)
- [ ] ⟢ At a glance **Studied** line written: what the round taught (the revised belief)

## Act

**Learnings**:

- _(to be filled at close)_

**Promotions** _(if none: write as plain text, not checkboxes)_:

- _(to be decided at close)_

**Follow-ups (not promotions, just notes):**

- _(to be filled at close)_

## Feeds into → Round_164 (the rest of the within-group family)

Per [the program](../programs/query-shaping-surface.plan.md) item 2: % of total · running total ·
rank within group · vs prior period — the same mechanism plus an **in-window `ORDER BY` + frame**,
once this round proves the primitive on real data. Carries the **prior-period gap trap** (Jan,
Feb, **Apr** → February silently reads as April's previous), whatever the acceptance walk teaches
about naming and the grain line, and the `_MAX_STEPS` verdict.
