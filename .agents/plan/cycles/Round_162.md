# Round 162: compare to the group — the within-group column

**Status**: In Progress
**Date started**: 2026-08-07
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_161](Round_161.md)** — the concept-lock (five nouns Accepted, the
query⇄query composition fork left OPEN, named debt D1–D4). **That fork is now closed by the
human, in the opposite direction to R161's leading candidate**: there is no `query⋈query` at
all. R161's "query" definition is superseded; see
[`programs/query-shaping-surface.plan.md`](../programs/query-shaping-surface.plan.md).

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— item 1 of 4.

On 2026-08-07 the human ran a full-loop dogfood — real datasets, aiming at a dashboard worth
showing — and was blocked: _"I cannot freely 'join' and play with data, it's stopping me from
exploratory."_ The blocking case is **compare a value to its group** (an agent's connect rate
vs their team's). The product ships **collapsing** aggregates only, so the sole way to express
it was to join two shaped results — `query⋈query` — which the engine rejects as `cyclic_join`.

Ship the missing primitive: **a column whose value is an aggregate over a group of other rows**.
That makes the blocked question expressible inside one Query, with no composition.

_Track: 1 (product — the #1 ease story fails at its core: a manager cannot answer an ordinary
question about their own data). Pulled by: the 2026-08-07 dogfood + the same-day Query
concept-lock — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: the human rebuilds the dashboard that blocked them — including "each agent
vs their team" — using one Query over datasets, no composition, and confirms the numbers are
right.

**Falsified if**: the within-group column lands but the dashboard is still not buildable (the
wall was not grain alignment); or the operation cannot be expressed in words a non-technical
manager understands, so it only moves the complexity rather than removing it; or ordering
interactions make results unpredictable enough that the human doesn't trust the output.

- [ ] **D gate — rewrite the design corpus to the closed Query concept.** Rewrite
      [`_noun-model.md`](../../design/data-management/_noun-model.md): Query is a live table
      built from **datasets only**, an **ordered** list of operations (join anywhere · filter ·
      computed column · aggregate · within-group column), never composed, never frozen. Record **D1 as
      dissolved** (no composition ⇒ no step-drop) and **D2 as removed by decision, not fixed** —
      joining two queries is out of scope now, so the capability is deliberately gone; a later
      reader must not read it as a bug that got solved. **State the self-join boundary
      explicitly**: the same dataset may not appear twice in one query, and the **Builder must not
      offer it** rather than erroring at run (human, 2026-08-07 — *"Query only does BIZ, not
      everything"*). Update
      [queries.md](../../design/data-management/queries/queries.md) to match. **Correct the
      dangling `build_stepped_select` reference — that function does not exist.**
- [ ] **Design the operation in the user's words.** It must read as *"compare to the group"*,
      not as a window function. **Must** let the user choose the ambiguous case explicitly:
      averaging the underlying **rows** (pooled) vs averaging the **already-grouped values** —
      for the sample data these give 71.4% and 70.8%, both defensible. Run
      [`ux-design`](../../skills/ux-design/SKILL.md) in design-spec mode at this gate.
- [ ] Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit; record the
      chain in the Do log.
- [ ] **C** — contract for the new operation (a step kind), plus FE types/api/MSW mock.
- [ ] **B** — engine. The existing `derive` step already emits
      `SELECT *, <expr> AS name FROM (…)`; a within-group column is
      `SELECT *, AVG(x) OVER (PARTITION BY g) AS name FROM (…)` — the **same shape**, in the same
      fold ([rows_reader.py:373](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373)),
      validated through the same planner. Additive; no existing step changes.
- [ ] **F + I** — the builder surface for the operation, then the Integration walk.
- [ ] **Acceptance — the human rebuilds the blocked dashboard on real data** and confirms the
      numbers. Gates green is necessary, not sufficient ([[dfcfbi-f1-needs-human-review]]).

### Explicitly NOT in this round

- **The rest of the within-group family** — % of total, running total, rank within group, vs
  prior period. Same mechanism; they are program item 2, once this one proves the pattern.
- **Retiring `query⋈query`** — program item 3. **Replace before you remove**: composition stays
  until the replacement is shipped and proven, or the human ends up more blocked than today.
- **Workflow** — program item 4.
- **D4 draw-time join-error UX** — largely mooted once composition is gone; re-rank later.

## Risks / unknowns

- **Named assumption — the blocked question is "compare to a group", roughly.** The human confirmed
  the *symptom* (a join refused between two things off one dataset) and, at the pre-commit
  cold-review, confirmed the *shape* as compare-to-group — **"roughly"**, from a whole-dashboard
  view rather than a single tile. So the exact shape may differ (period-over-period and
  presence/absence were the live alternatives; period-over-period is R163, absence is unscheduled).
  **This assumption is what the acceptance walk tests.** If the rebuild fails because the real
  question was a different shape, that is a successful falsification, not a failed round — record
  it and re-rank the program before R163 opens.
- **It moves complexity instead of removing it.** A "window function" wearing a friendly label
  still asks a manager to think about partitions. If the affordance can't be expressed in
  business words, this round has failed even with green gates. This is the primary risk.
- **The pooled-vs-per-member ambiguity.** Offering the choice adds a decision; hiding it
  produces a confident wrong number. The design gate must resolve which, not the build.
- **Order interactions.** Since order carries meaning, a within-group column computed before vs
  after a filter averages over different groups. Correct, but potentially surprising — it must
  be visible in the surface, not discovered.
- **Join-after-aggregate keys.** With join allowed anywhere, joining after a group-by requires
  the key to have survived the aggregate. Impossible joins should be unofferable, not errors.
- **Scope creep into the whole family.** d–h are one mechanism, which makes "just add the other
  four" tempting mid-round. The firewall says no; item 2 exists for that.

## Do

### Round opened — plan locked after cold-review (2026-08-07)

Opened `In Progress` with the plan human-reviewed. Next gate: **D** (rewrite the design corpus).

Ran [`cold-reviewer`](../../skills/cold-reviewer/SKILL.md) `[mix]` against the three planning
artifacts before commit ([[fair-review-at-lockin]]). All six anchors grounded; **anchor 5
(reversibility) clear** — every artifact is a document and no product code is touched, so locking
now is cheap and the cost of being wrong lands at R164, not here. Four outcomes folded in:

- **Self-join surfaced as an unowned gap** — the tree invariant rejects the same dataset twice
  ([query_engine.py:212](../../../workspace/apps/backend/app/query_engine.py#L212)), which the
  locked concept's `ds ⋈ ds ⋈ ds` did not exclude. **Human ruled it a deliberate boundary**
  ("Query only does BIZ, not everything"), extended to the Builder: offer nothing, don't error at
  run. Now in the D-gate step; the unserved need is an input to the Workflow round.
- **"D1/D2 dissolved-by-design" was spin** — corrected: D1 dissolves, **D2 is removed by
  decision**. A later reader must not read a deliberate scope cut as a bug that got fixed.
- **The brainstorm's D-A conclusion is superseded** — "pooled 71.4% not expressible" held only
  before order carried meaning. Placing the within-group column *before* the collapsing aggregate
  yields pooled; *after* yields 70.8%. So the choice may be an **ordering**, not a parameter —
  the D gate settles which affordance gets built. Recorded in the program's rolling log; the
  brainstorm is left untouched as a point-in-time record (PDCA: brainstorms are not edited after
  the decision lands).
- **The counter-case became a named assumption** — the human confirmed the blocked shape as
  compare-to-group *"roughly"*, from a whole-dashboard view. Written into Risks so the acceptance
  walk tests it rather than presuming it.

Verified in code during planning (so no round schedules work for them): the **collapsing**
aggregate family is complete — `count` · `count_distinct` · `sum` · `avg` · `min` · `max`
([query_engine.py:376-398](../../../workspace/apps/backend/app/query_engine.py#L376)); join types
shipped are `inner`/`left`/`right`/`full` ([common.py:330](../../../workspace/apps/backend/app/models/common.py#L330)).

## Check

- [ ] Verify outcomes against the goal (tests, lint, human walk) — the pass/fail verdict
- [ ] **The blocked dashboard rebuilds end-to-end**, and the human confirms the numbers
- [ ] The pooled-vs-per-member choice is expressible, and the user can tell which they got
- [ ] `_noun-model.md` and `queries.md` match the shipped code (D gate honoured, no drift)
- [ ] ⟢ At a glance **Studied** line written: what the round taught (the revised belief)

## Act

**Learnings**:

- _(to be filled at close)_

**Promotions** _(if none: write as plain text, not checkboxes)_:

- _(to be decided at close)_

**Follow-ups (not promotions, just notes):**

- _(to be filled at close)_

## Feeds into → Round_163 (the rest of the within-group family)

Per [the program](../programs/query-shaping-surface.plan.md) item 2: % of total · running total ·
rank within group · vs prior period — the same mechanism, once this round proves the pattern and
the naming. Carries forward the **prior-period gap trap** (Jan, Feb, **Apr** → February silently
reads as April's previous) and whatever the design gate settles about naming and ambiguity.
