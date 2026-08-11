# Round 163: the within-group column, finished — contract · engine · real numbers

**Status**: Complete
**Date started**: 2026-08-11
**Date completed**: 2026-08-11

<!-- reader-layer authored at close (R159 doctrine). Shipped = what's now true ·
     Studied = predicted→saw→now-believe · Watch = open threads / next bearing. -->

## ⟢ At a glance

**Shipped** — The **within-group column computes**. `group_column` runs end-to-end: contract
(`query.yaml` + the mirrored `workflow.yaml`), engine (`_plan_group_column` + a windowed
`_apply_step` branch), and the two card states R162 deferred (orphaned-by-a-move, name
collision). Both readings of "compare to the group" are reachable and **differ** — pooled vs
average-of-groups — decided purely by where the card sits. The human rebuilt the dashboard that
blocked them on 2026-08-07, on their real 90 581-row call log, and confirmed the numbers.

**Studied** _(predicted → saw → now believe)_ — Predicted the risk was **expressibility**: that a
window function in friendly clothing would only move the complexity, and the grain line might not
make pooled-vs-average legible. Saw the opposite distribution. The grain line **worked** (verdict
returned, after two rounds carrying it), and the assumption under the whole program — that the
blocking question was *compare-to-group* — **held**. What actually bit was **naming**: on the
first hand-use the human built a plausible 4-step chain whose columns were called `rate` (holding
1315) and `delta` (holding 1344.33), and the product agreed all the way to a dashboard-ready
table. Now believe: **for this affordance the danger was never whether the user can express the
operation — it is whether they can tell what they expressed.** The grain line answers *which rows
am I aggregating over*; nothing answers *is this column what its name claims*, and the one tell
already on screen (`rate` rendered as dtype `int`) carries no weight. That is a different axis
from the one the round spent its design budget on.

**Watch**

- **Naming is an open enhancement, deliberately parked** (human, 2026-08-11: *"we can post back,
  enhance later"*). Evidence is banked; no affordance proposed — ranking it is a later call.
- **Walk items 3–9 unreturned** — the orphan alert and the name-collision field error **have
  never been seen by a human**, plus VN copy, the step ceiling, and the filter trap. Carried.
- **The filter-placement trap is live and silent**: moving a `filter` above a Group value card
  collapses the denominator (every rate reads **100.0%**), and the grain line does **not** change,
  because it tracks position relative to `aggregate` only. Demonstrated on real data this round.
- **`_MAX_STEPS = 8` reached exactly** by the pooled path, never exceeded — not raised.
- **Composition is still lit in three places** until program item 3 (inherited from R162).

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

- [x] **C — contract.** Add `GroupColumnStep` to
      [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml): body
      `{kind, name, agg, col?, by[]}`, `by` **`minItems: 1`**, `agg` the existing measure enum.
      Add it to the `Step` `oneOf` **and** the `discriminator.mapping`. **Decide the workflow
      question first** (see Risks — the Python `Step` union is shared with `WorkflowDefinition`
      but `workflow.yaml` duplicates its own list). The FE types already landed at F1 — **verify
      they match the YAML rather than re-authoring them**.
- [x] **B — engine.** `GroupColumnStep` in
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
- [x] **F2 — confirm the surface against the real backend**, and build the **two card states F1
      deliberately deferred** now that the error vocabulary exists: **orphaned-by-a-move**
      (`<Alert role="alert">` naming the column, `[Save]` disabled) and the **name-collision**
      inline field error. Both are already specced
      ([query-construction.md § Card states](../../design/data-management/queries/query-construction.md)).
- [x] **I — Integration walk**, then run
      [`gate-walker`](../../skills/gate-walker/SKILL.md) on the Integration gate.
- [ ] **Acceptance — the human rebuilds the blocked dashboard on real data** (`pnpm dev:seed`, the
      real 2025 call logs) and confirms the numbers. Gates green is necessary, not sufficient
      ([[dfcfbi-f1-needs-human-review]]).
- [ ] **Answer R162's unresolved question — explicitly.** Does the grain line make the
      pooled-vs-average-of-groups reading legible? R162 could not test it (mocked data) and the
      human's walk returned no verdict. **A yes/no is required at this round's close**; silence is
      not a pass.
- [x] Re-run `design-sync --check` on the docs this round touches, before the close.

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

**Flow: DFCFBI (triggers 1, 3, 5)** — **inherited, not re-decided.** Recorded here verbatim from
[Round_162's Do log](Round_162.md) so `gate-walker` reads a deterministic branch on this file;
the `flow-selector` was **not** re-run (a recorded chain is not re-decided). This round runs the
back half of that chain: **C → B → F2 → I**.

### C gate — the contract, and the workflow question settled first (2026-08-11)

`GroupColumnStep` added to
[`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml) — body
`{kind, name, agg, col?, by[]}`, `by` `minItems: 1`, `agg` the existing measure enum — plus the
`Step` `oneOf` **and** the `discriminator.mapping`.

**The workflow question, decided at C as the plan demanded: widen `workflow.yaml` too.**
`WorkflowDefinition.steps` uses the **same** Python `Step` union and folds the **same**
`_apply_step` via `materialize_steps`, so narrowing the Python side for workflows would have
meant *more* code to make the two nouns diverge where the engine does not. Widening is ~2 lines
and coherent: a within-group column is exactly as meaningful over a consolidated relation as
over a query's. `workflow.yaml`'s duplicated `oneOf`/mapping now carries a note saying it is a
**mirror** of the query union, so the next kind added goes to both places.
[[widening-shared-wire-model-omit-serializer]] avoided rather than discovered at B.

**The F1 types were verified against the YAML, not re-authored** (plan item): `types.ts:185`'s
`GroupColumnStep` already matches the shipped body field-for-field. No FE type changes at C.

Contract validity green: `@mdd/contracts` **40 passed** (both files parse, all `$ref`s resolve).

**Contract gate closed** — request/response/error shapes frozen (`GroupColumnStep` in
`query.yaml` + the mirrored `workflow.yaml` union); MSW needed no change (the step rides the
existing request body, `resolvedColumns` carries the output); evidence:
`packages/contracts` vitest 40/40.

### B gate — the engine, built by extending the shared vocabulary rather than copying it

Three files, all additive; **no existing step changed**.

- **[common.py](../../../workspace/apps/backend/app/models/common.py)** — `GroupColumnStep` +
  the `Step` union. The union's comment now states the cross-noun consequence explicitly (it
  widens Workflow too, and `workflow.yaml` must widen with it) so the next author does not have
  to re-derive it.
- **[query_engine.py](../../../workspace/apps/backend/app/query_engine.py)** —
  `_plan_group_column`, calling **`_validate_measure` verbatim** for the agg/col rules. To keep
  the *output dtype* rule genuinely shared rather than a lookalike, the rule was **extracted**
  from `_aggregate_output_columns` into a new `_measure_dtype(col, agg, by_name)` that both
  families now call — the plan asked for reuse, and a copied `if/elif` chain would only have
  looked like it.
- **[rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)** — the
  `group_column` branch of `_apply_step`, emitting
  `SELECT *, <expr> OVER (PARTITION BY <by…>) AS name FROM (prev)`, no in-window `ORDER BY`.
  The measure SQL was likewise **extracted** from `build_aggregate_select` into
  `_measure_expr(agg, col, over=…)`, shared by both families.

**One real SQL finding, caught by extracting rather than copying.** `COALESCE(SUM(x), 0)` — the
collapsing form — **cannot** simply have `OVER (…)` appended: `OVER` binds to the aggregate
call, so `COALESCE(SUM(x), 0) OVER (…)` is a syntax error. The shared helper wraps the
**windowed** call instead (`COALESCE(SUM(x) OVER (…), 0)`). A copied expression map would have
produced this bug silently at the first `sum`. All five window forms — including
`COUNT(DISTINCT …) OVER (…)`, which some DuckDB builds reject — were **verified against the
pinned DuckDB 1.1.3** before the branch was written, not assumed.

**One guard the plan did not name.** `by` is re-checked in the planner (`group_by_required`),
not only at the pydantic edge: a saved definition is re-planned on every run and its column
names are **inlined into the window SQL**, so an empty `by` inserted behind the API must never
become a silent whole-table window. Same discipline as `_plan_date_bucket`'s granularity, and
now pinned by a test that writes a bad definition straight to SQLite.

**Tests**: new [`test_group_column.py`](../../../workspace/apps/backend/tests/test_group_column.py),
**20 tests**, on the grain-alignment brainstorm's own T3 fixture. The definitional one asserts
an **equality between the two families** (the windowed value must equal the collapsing
aggregate of the same `(agg, col)` over the same `by`, joined back) with both sides computed —
so it pins semantics, not a typed-in number. Backend suite **404 passed** (384 before, +20);
`ruff check` clean.

**Backend gate closed** — contract conformance + per-endpoint behavior tests pass; evidence:
`uv run pytest` **404 passed**, including `tests/test_group_column.py` (20) covering the
family-equality invariant, the NULL policy, dtypes, seven 422 guards in the sibling vocabulary,
`409 query_stale` on drift, and the widened Workflow union end-to-end (create → run →
materialized rows).

### F2 — the two card states F1 deferred

`groupColumnIssues(step, cols)` in
[steps.ts](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts) —
pure, from the already-threaded column space — drives both:

- **Orphaned by a move** → `<Alert role="alert" type="error">` naming **every** missing
  reference (`col` and/or `within each` columns), with the doc's copy. The move is still never
  blocked.
- **Name collision** → an inline field error on the name `<Input>`, tied to it by
  `aria-invalid` + `aria-errormessage`, never a page-level alert.

`[Save]` needed no new gate: an invalid step makes the preview error, `previewOk` goes false,
and the existing invalid-edit gate disables Save — verified by reading the gate, not assumed.

**Why these two states earn their place — evidence from the live stack, not the spec.** The
**preview** path maps *every* bad step to `409 query_stale` — confirmed uniform across
`derive`, `date_bucket`, and `group_column`, so it is not a new-step quirk. Only the **save**
path returns the precise 422 (`column_exists: 'agent' is already a column`). Without the card
state, a user who reorders into an invalid position is told "stale" and never told **which**
column moved out of reach. That is now recorded in `query-construction.md` so the next reader
gets the reason, not just the rule.

**i18n**: 2 keys × EN + VN, parity re-checked **830 = 830**, zero missing either way. The Alert
uses `title` (the repo's dominant convention, 33 sites vs 5 on the deprecated `message`).

**Tests**: 6 added to `steps-editor.test.tsx`. Builder **340 passed** (334 before);
`type-check` clean.

**F2 gate closed** — confirmation pass complete against the contract-derived MSW **and** the
real backend (below); no shape change was needed, so nothing re-routed as a contract v2.

### I gate — the Integration walk, on the real stack and the seeded data (2026-08-11)

`pnpm dev:local:up` + `pnpm dev:seed`, then the **preview** endpoint the builder actually calls
(`POST /workspaces/{ws}/queries/preview`) over the seeded 2 000-row `Telesale calls` dataset —
the T3 shape on real data, agent-by-agent conversion rate vs the group's:

| agent | converted | of | rate | group | vs |
| --- | --- | --- | --- | --- | --- |
| Carmen Diaz | 50 | 262 | 19.08% | 16.41% | **+2.67pt** |
| Alice Nguyen | 46 | 264 | 17.42% | 16.41% | +1.01pt |
| Dan O'Neil | 37 | 224 | 16.52% | 16.41% | +0.11pt |
| Grace Park | 45 | 274 | 16.42% | 16.41% | +0.01pt |
| Farouk Aziz | 41 | 255 | 16.08% | 16.41% | −0.33pt |
| Elif Kaya | 32 | 239 | 13.39% | 16.41% | −3.02pt |

**Both readings run on real data and they disagree** — average-of-agents **16.41%**, pooled
**16.45%** (329 converted of 2 000). The pooled chain is **8 steps**, i.e. `_MAX_STEPS`
**exactly**: the cap was reached, never exceeded, so per the plan there is **no evidence to
raise it** and it is not raised. R162's D-gate arithmetic (pooled 8, per-member 6) is now
executed, not predicted.

Error vocabulary verified live: a duplicate-`by` save returns
`422 {loc: [body, definition, steps, 0, name], msg: "column_exists: 'agent' is already a
column"}` — the sibling steps' shape exactly.

**The dev stack is left running** (backend :8000, builder :3000, seeded) so the human's
acceptance walk can start without a rebuild. `pnpm dev:local:down` stops it.

**Integration gate closed** — FE-vs-BE verified end-to-end: the builder's own preview endpoint
runs `group_column` chains over seeded data at both readings and at the 8-step ceiling, the
save-path 422 detail matches the sibling steps, and the conformance suites pass on both sides
(MSW: builder **340**; real backend: pytest **404**; contracts **40**).

**`gate-walker` [Integration] — run 2026-08-11.** Flow line present (DFCFBI, inherited above) →
all six gates apply. Exit criterion **met** (evidence cited above, pointers resolve). Commit
seam: **not yet present** — the gate-close text is in the working tree, uncommitted. The skill
names this exact case (*"if you author the gate-close and audit before committing, expect (a) to
say MISSING — that is the check doing its job"*). The per-gate commits are the round's revert
seams ([[round-bundling-revert-seams]]) and are the human's to make; **the gate is otherwise
closed**, and re-running after the commits will return a clean pass.

### Hand-use finding — the confident-wrong-number risk, realised (2026-08-11)

The human, starting the acceptance walk, built a **4-step** variant of the chain and asked whether
it was the same thing. It is not, and what it produced is the round's named primary risk in the
flesh.

Their chain: `aggregate [tsa_name, month, status] → count` · Group value `sum(count)` within
`[tsa_name, month]` **named `rate`** · `filter status = ANSWERED` · Group value `avg(rate)` within
`[month]` **named `delta`**. Run against the real `calls_clean` (90 581 rows), and confirmed
**identical in the builder UI and via the API**:

| tsa_name | month | count | `rate` | `delta` |
| --- | --- | --- | --- | --- |
| Nguyễn Ân | 2025-01 | 691 | **1315** | **1344.33** |
| Đỗ Cương | 2025-01 | 663 | **1308** | 1344.33 |

**Both names lie about their contents.** `rate` holds the agent's *total calls*; `delta` holds the
*average calls per agent* that month. The two `derive` steps that turn counts into a rate and a
rate into a comparison were absent, so nothing computed a rate and nothing compared anything —
and the result is a clean, plausible table anyone would put on a dashboard.

**This is [flow-selector condition 3](Round_162.md), verbatim, first real instance**: *"a confident
wrong number on a dashboard someone acts on — nothing errors, nothing is destroyed, and the
mistake is invisible."* Recorded as evidence that the condition fired for a real reason, not as a
speculative worry.

**Attribution, honestly split.** Part of it is this session's fault: the walk instructions
compressed the chain into one prose arrow-line, and two `derive` steps are easy to lose in that.
But not all of it — the product agreed with every step.

**The sharper half, which the human's own paste surfaced.** The builder renders each column's
dtype in the header: `rate` shows as **`int`**. *A rate that is an integer is a visible
contradiction*, as is a `delta` of 1344.33. **The tell already exists on screen and carries no
weight.** That reframes the gap: not "the surface has no way to say this", but "the signal it
already shows is inert". No affordance is proposed here — naming is the user's, and inventing a
validator now would be design-by-building ([[requirements-table-before-building-ui]]). Logged for
ranking.

**What this does NOT settle.** It is **not** a grain-line failure. At the final card the grain line
correctly read *"each row here is one tsa_name × month × status"* — it answers *which rows am I
aggregating over*, and it answered correctly. It cannot answer *is this column actually a rate*;
different question, different gap. **The grain-line verdict is still unreturned** — this walk never
ran the move-the-card-past-the-aggregate test that would answer it.

**Also confirmed by this exchange**: the builder UI and the API return byte-identical results on
real data — FE↔BE parity verified by hand, which no test in this round could produce.

### design-sync `--check` — 3 drifts, all created by this round's own shipping (2026-08-11)

Scope, stated honestly: the docs this round touches (`queries/queries.md`,
`queries/query-construction.md`, `_noun-model.md`, `workflows/workflows.md`) against the code
this round shipped — **not** the all-14-doc sweep R162 flagged as still outstanding. All three
were **fixed**, so no `OUT OF SYNC` marker was stamped.

1. **`_noun-model.md` D6 said the within-group column "does not exist"**, with anchors to the
   pre-R163 `_apply_step`. Now **CLOSED**, with the shipped function names as the evidence, and
   the operations table's `Shipped?` cell flipped from *"no — R162 ships it"* to yes.
2. **`workflows.md` listed the reused step kinds without `group_column`** — the C-gate decision
   widened the Workflow union, so the concept line was immediately wrong. This is exactly the
   ripple the shared-union risk predicted, landing in a *sibling domain's* doc.
3. **`query-construction.md`'s card-states table still marked two states ⛔ not built**, and its
   note said they "land with the engine in R163". Both flipped to ✅ with the accessibility
   mechanism named, and the note replaced with the *why* (the preview-409 finding above).

Also corrected: `queries.md`'s status line and the `group_column` entry's `by: []` rule (the
planner-level `group_by_required` re-check was not in the spec), and a stale MSW comment saying
*"the backend … does not exist yet"*.

## Check

- [x] **Verdict: PASS on every gate this round owns.** `pytest` **404 passed** (+20) ·
      builder **340 passed** (+6) · contracts **40 passed** · `type-check` clean ·
      `ruff check` clean · `design:lint` 0 · `plan:lint` 0 · markdownlint 0 · i18n parity
      830 = 830. **Gates green is necessary, not sufficient** ([[dfcfbi-f1-needs-human-review]])
      — the acceptance item below is the human's and is deliberately still open.
- [x] **The blocked dashboard rebuilds end-to-end** — **CONFIRMED by the human's acceptance walk,
      2026-08-11.** Their words: *"1&2 seem all good."* Recorded with the hedge intact rather than
      upgraded to an emphatic pass. **This retires R162's inherited named assumption**: the
      2026-08-07 blocking question really was *compare a value to its group*, and one Query over
      datasets — no composition — now expresses it. The falsification arm *"the wall was not grain
      alignment"* did **not** fire.
- [x] **71.4% (pooled) and 70.8% (average-of-agents) are BOTH reachable** — **proven**, on the
      brainstorm's own T3 fixture, by two tests that assert the exact figures plus a third
      asserting they come from the **same** four opening steps and **differ**. The deltas match
      the hand-computed ground truth (+3.6/−4.8 pooled, +4.2 average-of-agents). One
      correction to the brainstorm: its −4.1pt for A2 (average-of-agents) was computed from
      already-rounded rates; full precision is −4.17 → **−4.2**. The engine is right; the
      hand table had a rounding artifact.
- [x] **Can the human say WHICH reading they got?** — **YES.** The verdict R162 carried unanswered
      through two rounds is returned: walking the two-card test (a Group value card moved above
      and below a collapsing `aggregate`), the human confirmed the grain line reads. **The round's
      primary risk did not materialise** — the affordance does not merely move the complexity.
      Recorded at the confidence given (*"seem all good"*), not inflated.
- [~] **The rest of the walk checklist (items 3–9) was not returned.** The orphan alert, the
      name-collision field error, the VN copy of the two new keys, the step ceiling, and the
      filter-placement trap were offered and **not reported on**. Not a failure — the round's
      blocking items were 1 and 2 — but the two **new F2 card states have still never been seen
      by a human**, and per [[dfcfbi-f1-needs-human-review]] that is recorded as unconfirmed,
      not assumed green. Carried to R164's walk.
- [x] The docs match the shipped code — `design-sync --check` run on the four docs this round
      touched; **3 drifts found, all created by this round's own shipping, all fixed** (§ Do).
      The all-14-doc `data-management/` sweep R162 flagged is still outstanding and is still
      not this round's scope.
- [x] ⟢ At a glance authored (**Shipped / Studied / Watch**, per the R159 doctrine).

## Act

**Learnings**:

- **The round guarded expressibility; the failure was legibility of the RESULT.** Two rounds of
  design budget went into making the operation sayable in business words, and that worked. The
  first real hand-use still produced a confident wrong number — not because the user couldn't
  express the operation, but because nothing checked that a column called `rate` was a rate. A
  named risk being *correctly* named ("a confident wrong number… invisible") does not mean the
  mitigation built for it covers the way it actually arrives.
- **Extracting a shared helper is a bug-detector, not just tidiness.** The plan said "reuse
  `_validate_measure` and the `_aggregate_output_columns` dtype rules verbatim". Doing that
  literally — pulling `_measure_dtype` and `_measure_expr` out rather than copying their bodies —
  is what surfaced that `COALESCE(SUM(x), 0)` cannot take `OVER (…)` appended, because `OVER`
  binds to the aggregate call. A copied expression map would have compiled and shipped a syntax
  error on the first `sum`. The reuse instruction paid in correctness, not lines saved.
- **A cross-noun union needs its widening decided at the contract gate, not discovered at the
  engine gate.** One Python `Step` union serves Query and Workflow; `workflow.yaml` duplicates
  its own list. Deciding at C cost ~2 lines and a mirror note; discovering at B would have been
  Python accepting what the contract forbids, in a *sibling domain* nobody was editing.
- **Hand-instructions are a failure surface too.** The acceptance walk was handed over as a
  compressed six-step prose chain; the human built a four-step variant that dropped both `derive`
  steps. The re-test that actually returned the verdict was a **two-card** version isolating the
  single question. When a walk exists to answer one question, give the smallest test that answers
  it — the realistic chain tests the chain, not the question.

**Promotions**: none proposed. Three of the four learnings are round-specific evidence for memory
that already exists ([[dfcfbi-f1-needs-human-review]], [[name-value-not-mechanism]]); the fourth
(minimal-isolating-test for a human walk) is **one instance**, and per R162's own precedent —
*"one instance is not a pattern"* — it waits for a second before it earns a file. Per the
Evolution Rule's *default = don't add*, they strengthen existing artifacts rather than minting one.

**Follow-ups (not promotions, just notes):**

- **Naming — parked by the human** (*"we can post back, enhance later"*). The evidence is banked
  in the Do log: a column named `rate` holding a call count, a `delta` holding an average, and a
  dtype tell (`int`) already rendered in the header that carries no weight. **No affordance is
  proposed** — inventing a validator now would be design-by-building
  ([[requirements-table-before-building-ui]]). Ranking is a later call.
- **The two new F2 card states have never been seen by a human.** Built, tested, unwalked.
- **The filter-placement trap** (a `filter` above a Group value card → every rate 100.0%, grain
  line silent) is the strongest un-actioned finding this round produced. It is R162's "Order ×
  within-group" risk, now demonstrated on real data rather than predicted.
- **A full `design-sync` of `data-management/`** (all 14 docs) is still outstanding — inherited
  from R162, still not done, still worth its own pass before item 3 rewrites the domain.

## Feeds into → Round_164 (the rest of the within-group family)

Per [the program](../programs/query-shaping-surface.plan.md) item 2: % of total · running total ·
rank within group · vs prior period — the same mechanism plus an **in-window `ORDER BY` + frame**,
once this round proves the primitive on real data. Carries the **prior-period gap trap** (Jan,
Feb, **Apr** → February silently reads as April's previous), whatever the acceptance walk teaches
about naming and the grain line, and the `_MAX_STEPS` verdict.
