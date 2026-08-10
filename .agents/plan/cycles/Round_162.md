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

- [x] **D gate — rewrite the design corpus to the closed Query concept.** Rewrite
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
- [x] **Design the operation in the user's words.** It must read as *"compare to the group"*,
      not as a window function. **Must** let the user choose the ambiguous case explicitly:
      averaging the underlying **rows** (pooled) vs averaging the **already-grouped values** —
      for the sample data these give 71.4% and 70.8%, both defensible. Run
      [`ux-design`](../../skills/ux-design/SKILL.md) in design-spec mode at this gate.
- [x] Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit; record the
      chain in the Do log.
- [ ] **F1 — the authoring affordance, FE-only, contract-safe.** Build the **Group value** card
      in `StepsEditor` + its `steps.ts` column threading + the **grain line**, on MSW. Must stay
      **request-only** ([[dfcfbi-f1-precedes-contract]]): `group_column` rides inside the existing
      `definition.steps` request body and the new column surfaces through the existing
      `resolvedColumns`, so **no response shape changes** and MSW's
      `additionalProperties: false` stays satisfied.
- [ ] **F1 hard stop — the human runs the app.** Does the sentence read? Does the grain line
      change when the card moves past an aggregate? Do the VN labels work? Gates green is
      necessary, not sufficient ([[dfcfbi-f1-needs-human-review]]).
- [ ] Run [`design-sync`](../../skills/design-sync/SKILL.md) `--check` on `data-management/` at
      the round close, so the F1 build and the D-gate docs are verified in sync before R163
      touches the engine.

### Explicitly NOT in this round

- **The rest of the within-group family** — % of total, running total, rank within group, vs
  prior period. Same mechanism; they are program item 2, once this one proves the pattern.
- **Retiring `query⋈query`** — program item 3. **Replace before you remove**: composition stays
  until the replacement is shipped and proven, or the human ends up more blocked than today.
- **Workflow** — program item 4.
- **D4 draw-time join-error UX** — largely mooted once composition is gone; re-rank later.
- **The contract, the engine, and real numbers** — moved to **R163** by the DFCFBI split (below).
  R162 ends at the F1 feel-review on mocked data; **71.4% vs 70.8% is not tested in this round.**

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

### D gate — the design corpus rewritten to the closed Query concept (2026-08-10)

Three docs rewritten/extended; **no product code touched**.

- **[`_noun-model.md`](../../design/data-management/_noun-model.md)** — the Query concept
  re-locked: a live table over **datasets only**, an **ordered** operation list (join · filter ·
  computed column · aggregate · within-group column), never composed, never frozen. The R161
  **fork is closed** in its own section, recording honestly that the human closed it a *third*
  way — neither A nor B, but **rejecting the question**: composition existed only because the
  within-group family was never shipped. What A's analysis genuinely offered (reusing a saved
  shaping as an input) is named as the cost, not hidden. **Self-join stated as a locked
  boundary**, Builder-side. Debt re-cut: **D1 dissolves with D5** (and stays a live bug until
  then — stated, not spun), **D2 removed by decision, not fixed**, D3 → program item 4, D4
  re-scoped onto the self-join gesture, **new D5** (composition is shipped **twice**) and
  **D6** (the missing within-group column).
- **[`queries.md`](../../design/data-management/queries/queries.md)** — the `group_column`
  operation specced (body, dtype rules reusing `_validate_measure`, output dtypes, column-space
  fold, the `OVER (PARTITION BY …)` compile with **no in-window `ORDER BY`** — which is exactly
  why running-total/rank are item 2, not a widening). Acceptance criterion #8 added.
- **[`query-construction.md`](../../design/data-management/queries/query-construction.md)** —
  the builder affordance, plus a **backfill**: `StepsEditor` shipped across R120–R144 with **no
  design-doc home at all**, so the D gate had nowhere to hang the new control
  ([[design-docs-are-source-code]]).

**Three doc↔code drifts corrected** (verified, not assumed):

1. `build_stepped_select` — cited by `_noun-model.md`, **does not exist** anywhere in the repo.
2. `QueryRelationship.leftDatasetId` / `rightDatasetId` — the shipped model is
   `leftSourceId` / `rightSourceId` ([common.py:305-309](../../../workspace/apps/backend/app/models/common.py#L305)).
3. `queries.md` and `query-construction.md` both listed "a `qr_` on the right of a join hop" as
   **out of scope** — **R91 built it**. That makes composition shipped twice, which is why the
   D gate raised it to its own debt row (D5) rather than folding it into D2.

**The design decision the gate owed: pooled vs per-member is an ORDERING, not a parameter.**
No `basis` field. A parameter would be a second way to say what step position already says, and
would contradict the ordered-operations rule the whole concept rests on. What makes the choice
legible is a **grain line** on every card — one sentence naming *what one row means at this
position*, derived from the step list alone (no data, no new wire field), which **rewrites
itself when the card is moved past an aggregate**. So the two readings are one keystroke apart
and each is named in business words at the moment of choosing. This confirms the pre-commit
cold-review's supersede of the brainstorm's D-A row.

**Two findings banked during the gate** (neither schedules work):

- **The within-group column also unblocks the connect rate itself**, which is inexpressible
  today. `derive` needs numeric operands, so there is no 0/1 indicator from `outcome =
  'connected'` — the program plan's "a computed 0/1 column plus `avg` gives a rate" **does not
  hold on shipped code**. The route that does work is `aggregate [agent, team, outcome] → count`,
  then roll the group up: `SUM(count) OVER (agent)`, filter to connected, divide. So "two
  aggregates over the same rows" (brainstorm T2) reduces to *aggregate finer, then roll up
  within group* — one more tile the round unblocks than the plan claimed.
- **`_MAX_STEPS = 8`** ([query_engine.py:461](../../../workspace/apps/backend/app/query_engine.py#L461)).
  The **pooled** T3 path costs **exactly 8 steps**; the per-member path costs 6. The cap is not
  hit, but there is zero headroom on the harder reading. Not pre-raised — if the acceptance walk
  hits it, that is the evidence to raise it.

**`ux-design` [design-spec]** run on the new surface: **5 of 6 facets gapped** on the first pass
(only Utility passed) — no declared labels for the sentence controls, no state for the
*invalid* form of the reorder gesture that is the round's whole affordance, the grain line
silent to assistive tech, card error states unspecced, no token row for a new visual element.
All five remediated in-doc, re-run **PASS**. Worth noting: every gap was in the *new* affordance,
and the sharpest (the grain line as a live region) was in the one control the round most depends
on — the D-gate review earned its place here rather than being ceremony.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | **yes** | The card-states table declares 4 reachable branches — normal · orphaned-by-a-move · nothing-to-offer · name-collision — each with a different affordance, not a visual variant. |
| 2. New interaction pattern           | no     | The card is the **shipped** `StepsEditor` pattern (ordered add/reorder/remove with dtype-gated selects, R120–R144); reorder-changes-meaning is already how `sort`/`aggregate` behave. The grain line is hint text, not a new pattern. |
| 3. High user-error risk              | **yes** | The failure mode is a *confident wrong number* on a dashboard someone acts on (the brainstorm's T3 trap) — nothing errors, nothing is destroyed, and the mistake is invisible. |
| 4. Contract depends on unresolved UI | no     | `{kind, name, agg, col?, by[]}` is fully written above, and the one open question (no `basis` field) was resolved **at D**, before C. The grain line needs no wire field. |
| 5. UX confidence below threshold     | **yes** | The whole affordance rests on an untested claim — that a grain line makes pooled-vs-per-member legible. The round file names this as its primary risk and says green gates are insufficient; an honest author says "I'm not sure this is the right UX." |

Result: **Flow: DFCFBI (triggers 1, 3, 5)**

_(The round file carries no `**Flow**:` header field, so the skill's step-5 header sync is n/a;
this Do-log block is the record.)_

**Consequence the human owns.** DFCFBI puts **F1 before Contract**, and the standing call
[[dfcfbi-two-round-split]] splits such a round into **[D + F1 + design-sync]** then
**[C + B + F2 + Integration]**. Two things follow, neither of which an agent should settle:

1. **F1 must be contract-safe** ([[dfcfbi-f1-precedes-contract]]) — MSW response-validation
   (`additionalProperties: false`) blocks new wire fields before C. That is satisfiable here:
   `group_column` rides inside the existing `definition.steps` **request** body, and the new
   column surfaces through the existing `resolvedColumns` **response** field, so no response
   shape changes. But a mocked preview cannot compute a real window, so **F1 tests whether the
   affordance reads, not whether the numbers are right** — the 71.4/70.8 discrimination lands
   at Integration.
2. **The split collides with the program's numbering** — item 2 is already pencilled as R163.
   Splitting R162 either renumbers the program or runs as R162a/R162b. The program firewall is
   **not** breached either way (a D+F1 slice ships FE code, not only documents).

### Flow split settled — R162 ends at F1 (human, 2026-08-10)

The DFCFBI result was put to the human with its consequence. Their call: **split, keeping R162 as
[D + F1]**, with **[C + B + F2 + Integration] as R163** and the within-group family shifting to
**R164** — the program renumbers by one rather than inventing an `R162a/R162b` form the repo has
never used. The F1 feel-review on mocked data was confirmed as worth running: *the affordance is
the risk*, and it is precisely what MSW and pytest cannot see.

**What this round can no longer claim.** R162's own "Expected outcome" — the human rebuilds the
blocked dashboard and confirms the numbers — **moves to R163**. R162 proves the operation can be
*authored* in business words, not that it computes the right value. The falsification test splits
with it: *"only moves the complexity"* is testable here; *"the wall was not grain alignment"* is
not testable until R163.

**Firewall check** — the program's "no round ships only documents" rule holds: this slice ships
`StepsEditor` + `steps.ts` FE code, not only the D-gate corpus.

### F1 built — the Group value card, FE-only on MSW (2026-08-10)

**Contract-safe, verified not assumed.** The MSW decorator validates **response** bodies only
(`withContractValidation` compiles the 2xx schemas —
[contract-validator.ts](../../../workspace/apps/builder/src/mocks/contract-validator.ts)), and
`group_column` rides inside the existing `definition.steps` **request** body while its output
column surfaces through the existing `resolvedColumns`. **No contract YAML touched, no response
shape changed** — exactly the [[dfcfbi-f1-precedes-contract]] discipline.

Built:

- **`types.ts`** — `GroupColumnStep` (`{kind, name, agg, col?, by[]}`) added to the `Step` union.
- **`steps.ts`** — `stepOutput` appends one column with the collapsing measure's dtype rules;
  `groupColumnPool` applies the same dtype gates as a measure; `blankStep` defaults to *average
  of the first numeric, within the first categorical*; `STEP_KINDS` places it **next to
  `aggregate`** — same vocabulary, opposite row-count effect. New pure **`grainAt(steps, i)`**
  returns what one row means at a position, carrying dimension names through later `select`
  renames/projections so the sentence names columns the user can actually see.
- **`StepsEditor.tsx`** — the `GroupColumnBody` card: three `FieldLabel`ed controls, each with an
  accessible name; the column picker disabled-with-a-reason when no column fits the agg; and the
  **grain line** as a `role="status" aria-live="polite"` advisory (`colorTextSecondary`, never an
  `<Alert>`).
- **i18n** — 6 keys × EN + VN. Parity checked: **828 = 828**, zero missing either way.
- **MSW** — `groupColumnStepMock` mirrors `OVER (PARTITION BY …)` over the mock rows, with the
  backend's NULL conventions (`sum`/`avg` coalesce an all-NULL group to 0; `min`/`max` stay NULL).

**Deliberately NOT built** (they belong to R163's C/B): the contract YAML, the backend
`_plan_group_column` + `_apply_step` branch, and the orphaned-by-a-move `<Alert>` — that state
needs the backend's `unknown_column` vocabulary to name the offending column honestly, and
inventing an FE-only version now would be a second source of truth to delete later.

**Verification**: `type-check` clean · builder suite **328 passed / 328** (317 before, +11 new) ·
`design:lint` 0 · `plan:lint` 0 · markdownlint 0 · links resolve. The new tests pin the round's
**central claim** rather than the plumbing: the same card in two positions must produce two
different grain sentences, and the grain line must be a polite live region so the change is
announced when the card moves. (`handlers.ts` fails `prettier --check` — **pre-existing**,
confirmed against a clean stash; prettier is not wired for `.ts` in `.lintstagedrc.json`, so
reformatting it would be a large unrelated diff.)

One doc↔code correction folded back: the D-gate spec said the agg label reads **Value**, but
reusing `steps.measure` verbatim renders **Measure** / **Giá trị đo**. The doc now says Measure —
reuse of the sibling's vocabulary is the point, so the code was right and the doc was wrong.

**Next: the F1 hard stop — the human runs the app.** Gates cannot see this
([[dfcfbi-f1-needs-human-review]]).

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

## Feeds into → Round_163 (C + B + F2 + Integration — the same capability, finished)

The DFCFBI split (human, 2026-08-10) puts the contract, the engine, the confirmed FE, and the
Integration walk in **R163**, carrying:

- the `group_column` wire body settled at this D gate — `{kind, name, agg, col?, by[]}`, `by`
  min-length 1, dtype rules reusing `_validate_measure`, output dtypes mirroring
  `_aggregate_output_columns`;
- the engine one-liner: `SELECT *, <expr> OVER (PARTITION BY <by…>) AS name FROM (prev)` in the
  same `_apply_step` fold as `derive`
  ([rows_reader.py:373](../../../workspace/apps/backend/app/ingest/rows_reader.py#L373)) —
  additive, no existing step changes;
- **the acceptance that R162 cannot run**: the human rebuilds the blocked dashboard on real data
  and confirms 71.4% vs 70.8% are both reachable and distinguishable;
- the `_MAX_STEPS = 8` ceiling, to be raised only if the rebuild actually hits it;
- whatever F1's feel-review changes about the naming, the grain line, or the VN copy.

**Then → Round_164** — the rest of the within-group family (% of total · running total · rank
within group · vs prior period), per [the program](../programs/query-shaping-surface.plan.md)
item 2. Carries the **prior-period gap trap** (Jan, Feb, **Apr** → February silently reads as
April's previous).
