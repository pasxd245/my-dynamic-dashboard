# Round 165: the ordered-window engine — contract · frame · real numbers

**Status**: Complete
**Date started**: 2026-08-11
**Date completed**: 2026-08-13

## ⟢ At a glance

**Shipped** — the ordered-window family **computes**: `window_column` runs end to end for all four
operations, and _previous period_ **reads blank on a gap instead of reporting the wrong period's
number** — proven on the human's real 90 581-row call log with a month removed, not only in a fixture.
Then the acceptance walk added six fixes: the `Computed column` card no longer looks literal-only, the
`prior_period` advisory stops asking once you have done what it asks, its gap count no longer states a
page count as a result count, the grain line's filter clause survives the reorder that leaves the
numbers unchanged, **pagination partitions the result again** (a pre-existing defect: 33 of 96 rows had
been returned twice and 33 never), and an unrunnable step now says so instead of blaming a filter the
query never had (`step_invalid`, a new error code across contract, engine and four FE surfaces).

**Studied** — **a walk question does not stay inside its own category, and that is the whole argument
for walking.** Five questions produced **six** defects, and **not one** was the thing its question was
nominally about: "is this line help or a scold?" returned two wrong _facts_; "does the filter clause
land?" led to a **pager** bug forty rounds old. Every gate was green before the walk began — contracts
40, pytest 429, builder 359, and an I-gate run on real data — and the gates were not sloppy; they were
thorough and still blind to what a hand on the surface finds in twenty minutes. The sharpest
correction was to the agent, not the code: **T3 was graded FAIL on an assumption about which card the
human had moved**, and their own number (`agent_total` 264) overturned it. Confirm the gesture before
judging the outcome.

**Watch**

- **The naming cluster is still parked** (R163's human call) — a column called `rate` holding a count
  still sails through, and W-1's _affordance_ half (the operand toggle that does not read as a toggle)
  was deferred by the human to the batched UI round rather than grown into this one.
- **Two fixes are honest but incomplete, deliberately.** The gap count is now correctly scoped to the
  page, which is truthful and still cannot see blanks on later pages — a **result-wide** count needs a
  wire field. And W-6's stronger sentence (`filter equals` on a grain dimension ⇒ single-row groups,
  provable from the step list) would _name_ the 100% instead of hinting at it; not built.
- **Adding an error code has an FE step no type error catches.** `isApiError` is a hand-written
  allowlist, so `step_invalid` was invisible to every surface until it was added there — the contract,
  the models and the copy were all already correct. A generated guard would close it.
- **Incidental-order assertions are latent failures.** Two backend tests asserted row order while
  testing something else and fired only when W-7's _correct_ fix landed under them; a third survives
  because `APAC` sorts before `EMEA`. Worth a sweep.

## Goal

**Inherits from ← [Round_164](Round_164.md)** — the back half of one capability, split by the
`flow-selector`'s **DFCFBI (triggers 1, 3, 5)** result and the standing
[[dfcfbi-two-round-split]]. R164 delivered the **D gate** (fourteen decisions, all four ops' SQL
verified on the pinned DuckDB before the spec was written) and **F1** (the four menu entries, the
card, the grain line's filter clause, the `prior_period` advisory line — FE-only, MSW-backed).
**No flow-selector run this round** — the chain is recorded in R164's Do log and a recorded
`Flow:` line is not re-decided.

R164's walk returned **one** verdict — the three `[Add step ▾]` groups read clearer — and the
human **explicitly deferred items 2–6** so they could be walked once, with real numbers, here.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— item 2, second half.

Ship the engine behind the affordance: **C → B → F2 → I**, ending with the human building a real
month-over-month tile on their 90 581-row call log — **including a month that is missing**.

_Track: 1 (product). Pulled by: R164's split — four operations exist on screen and compute
nothing._

## Plan

**Expected outcome**: `window_column` runs end to end, and **"previous period" reads blank on a
gap rather than reporting the wrong period's number** — on real data, not only a fixture.

**Falsified if**: the interval frame doesn't survive contact with real `date_bucket` output (e.g.
the axis is a `datetime`, or the seeded months don't align to period starts); or a
month-over-month tile exceeds `_MAX_STEPS`; or the human cannot tell a gap-blank from a
data-blank.

- [x] **C — contract.** `WindowColumnStep` in
      [`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml): body
      `{kind, op, name, col?, by[], orderBy?[], unit?}`, `by` **`minItems: 0`**, the `Step`
      `oneOf` **and** `discriminator.mapping` — **and the mirrored `workflow.yaml`**, decided at
      R164's D-14, not rediscovered here. The FE types landed at F1: **verify they match the YAML
      rather than re-authoring them**.
- [x] **B — engine.** `WindowColumnStep` in
      [common.py](../../../workspace/apps/backend/app/models/common.py) + the `Step` union;
      `_plan_window_column` in [query_engine.py](../../../workspace/apps/backend/app/query_engine.py)
      **reusing `_validate_measure`'s dtype vocabulary rather than a lookalike**; a
      `window_column` branch in `_apply_step`
      ([rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)) built by
      **extending `_measure_expr`**, not copying it (R163's extraction-is-a-bug-detector lesson).
      Per-op required/**rejected** fields are enforced in the PLANNER, not only at the pydantic
      edge — a saved definition is re-planned every run and its names are inlined into the window
      SQL.
- [x] **F2 — confirm the surface against the real backend**, and build the one card state F1
      deferred with a reason: the **gap COUNT** on the `prior_period` advisory line, which needs
      real result rows.
- [x] **I — Integration walk**, then run
      [`gate-walker`](../../skills/gate-walker/SKILL.md) on the Integration gate.
- [ ] **Acceptance — a real month-over-month tile on the real 2025 call log**, including a
      **missing** month. Gates green is necessary, not sufficient ([[dfcfbi-f1-needs-human-review]]).
- [ ] **Return R164's deferred walk items 2–6** — including R163's orphan alert and
      name-collision field error, now unconfirmed for **two** rounds. This round must not let it
      become three.
- [x] Re-run `design-sync --check` on the docs this round touches, before the close.

### Explicitly NOT in this round

- **Retiring composition / shipping Duplicate** — program item 3, **R166**.
- **A naming validator** — parked by the human at R163; still parked.
- **The R157 UX cluster**, `[F-join-label-qualify]`, `[F-promote-gate]` — batched per
  [[r-ui-bug-fixing-round]].
- **The all-14-doc `data-management/` design-sync sweep** — inherited-outstanding since R162.

## Risks / unknowns

- **The interval frame meets real data for the first time.** R164 verified
  `RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND INTERVAL 1 <unit> PRECEDING` on a hand-built
  `DATE` column. Real axes come from `date_bucket`, which emits `CAST(date_trunc(...) AS DATE)` —
  should align exactly, but "should" is what this gate is for. A `datetime` axis that is not
  period-aligned would silently match nothing and read all-blank, which looks like the gap
  behaviour and is not.
- **`_MAX_STEPS = 8`.** A month-over-month tile is `date_bucket → aggregate → window_column →
derive` = 4. A pooled variant costs more. R163's rule stands: **reached is not exceeded** — the
  walk is the trigger, and it supplies the number to raise it to.
- **Rejected-field enforcement is new surface area.** Four ops × four optional fields is the
  first step whose validity depends on a _combination_. The failure mode is a field silently
  ignored rather than refused — which is how a user gets a column that ignores the control they
  set.
- **`COALESCE`/`OVER` binding, again.** R163 found `COALESCE(SUM(x), 0) OVER (…)` is a syntax
  error because `OVER` binds to the aggregate call. `pct_of_total` and `running_total` both reuse
  that path with a frame attached; `NULLIF` in the denominator is a third wrapper. Extract, don't
  copy.

## Do

**Flow: DFCFBI (triggers 1, 3, 5)** — **inherited, not re-decided.** Recorded here verbatim from
[Round_164's Do log](Round_164.md) so `gate-walker` reads a deterministic branch on this file.
This round runs the back half: **C → B → F2 → I**.

### C gate — the contract, and the mirror the last round left as a note (2026-08-11)

`WindowColumnStep` added to
[`_shared/query.yaml`](../../../workspace/packages/contracts/_shared/query.yaml) — body
`{kind, op, name, col?, by[], orderBy?[], unit?}`, `by` `minItems: 0` — plus the `Step` `oneOf`
**and** the `discriminator.mapping`. The per-op required/**rejected** matrix is written into the
schema description, so the contract states the rule rather than leaving it to the engine.

**The `workflow.yaml` mirror cost two lines and no thought**, because R163 left a note in the file
saying a kind added to the query union must be added here too. That note was written by a round
that had just paid to discover the coupling; this round simply followed it. **A comment that
turns a re-derivation into a two-line edit is the cheapest artifact in this repo.**

**The F1 types were verified against the YAML, not re-authored**: `types.ts`'s `WindowColumnStep`
and `WindowOrderKey` already matched field-for-field, including `orderBy`'s camelCase (the wire
convention — `leftColumn`, `rightSourceId`). No FE type changed at C.

**Contract gate closed** — request/response/error shapes frozen; both files parse and every `$ref`
resolves; MSW needed no change (the step rides the existing request body). Evidence:
`@mdd/contracts` **40 passed**.

### B gate — the engine, and two things the D gate had not predicted

Three files, all additive; **no existing step changed**.

- **[common.py](../../../workspace/apps/backend/app/models/common.py)** — `WindowOrderKey`,
  `WindowColumnStep`, and the widened `Step` union. Field names are camelCase with `# noqa: N815`,
  matching `leftColumn`/`rightSourceId` — the repo already had a convention for wire-shaped
  models, and a pydantic `alias` would have been a second one.
- **[query_engine.py](../../../workspace/apps/backend/app/query_engine.py)** —
  `_plan_window_column` + `_window_output_dtype`. The dtype vocabulary is reached by **asking
  `_validate_measure` about the equivalent measure** (`pct_of_total` and `running_total` both SUM,
  so both take `sum`'s rule) rather than restating it — so a future dtype change cannot drift
  between the two families.
- **[rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)** —
  `_apply_window_column` + two small helpers (`_window_over`, `_window_order_sql`), with the
  measure SQL still coming from the shared `_measure_expr`.

**Finding 1 — a real bug in the SHARED helper, caught by a test the design implied.**
`_measure_expr(over="")` tested `if over:`, so an EMPTY window — R164's "across everything" — fell
through to the _collapsing_ branch and emitted a bare `SUM(x)`, which DuckDB rightly rejected
(_column "agent" must appear in the GROUP BY clause_). The helper's contract had quietly conflated
**no window** with **empty window**, and no caller could expose it until one legitimately needed
`OVER ()`. Fixed by making the parameter `str | None` and testing `is not None` — the ambiguity is
now impossible to re-introduce, and the docstring says why. **This is R163's extraction lesson
paying a second time, from the other direction**: extracting a helper concentrates the risk into
one contract, so that contract has to be exact.

**Finding 2 — the frame is a POINT, so the axis must be period-ALIGNED.**
`RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND INTERVAL 1 <unit> PRECEDING` matches the row
_exactly_ one unit back. On `date_bucket` output (month starts) that is precisely "last month". On
**raw** dates — the 15th, then the 3rd — nothing is exactly one month back, so every cell reads
blank: correct, and useless. The D gate said `date_bucket` is the producer of this axis; it did
not know the coupling was **load-bearing** rather than merely conventional. Pinned as its own test
that runs the same data unaligned (all blank) and bucketed (correct), so a future reader meets the
rule as an executable fact.

**Finding 3 — `prior_period` is well-defined only at one row per (partition, period).** With
several rows sharing a period the frame returns the FIRST of them in order — arbitrary among ties.
That grain is exactly what an upstream `aggregate` produces. Documented on the model and in the
contract rather than guarded, because it cannot be known statically.

**Tests**: new [`test_window_column.py`](../../../workspace/apps/backend/tests/test_window_column.py),
**25 tests**. Each op is pinned by an _invariant_, not a typed-in number — a share sums to **1.0**
across its partition; a running total's last row **equals the collapsing `sum`** over the same
`by`; ties **share** a rank and the next rank **skips**. The flagship asserts the gap case as a
full mapping, so a change that fixes April by breaking February cannot pass. Backend suite
**429 passed** (404 before, +25); `ruff check` clean.

**Backend gate closed** — contract conformance + per-endpoint behavior tests pass; evidence:
`uv run pytest` **429 passed**.

### F2 — the one card state F1 deferred, now that there are rows to count

`nullCountOf(name, result)` in
[steps.ts](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts) reads
the blank count off the **shaped preview the builder already holds** — no wire field, no extra
request. It appends one clause to the `prior_period` advisory line.

It returns **null when the column is not in the result at all** (a later `select` may have dropped
or renamed it), because a count we cannot stand behind is worse than no count. And **no gaps → no
clause**: silence is the right answer when nothing is missing.

`QueryBuilderPanel` now passes `result` into `StepsEditor` — read-only feedback, explicitly not an
input; authoring still binds to the PRE-step columns.

**Tests**: 4 added. Builder **49 passed** in `steps-editor.test.tsx`; `type-check` clean.

**F2 gate closed** — confirmation pass complete against the contract-derived MSW **and** the real
backend (below). No shape change was needed, so nothing re-routed as a contract v2.

### I gate — the real stack, the real 90 581 rows (2026-08-11)

`pnpm dev:local:up` + `pnpm dev:seed`, then the **preview** endpoint the builder actually calls,
over `calls_clean` — **the human's real dataset, the one R163 closed on**.

**The tile, at four steps** (`date_bucket → aggregate → prior_period → derive`):

| tsa_name   | m          | count | prev_count | vs_prev  |
| ---------- | ---------- | ----- | ---------- | -------- |
| Châu Quỳnh | 2025-08-01 | 1258  | ∅          | ∅        |
| Châu Quỳnh | 2025-09-01 | 1773  | 1258       | **+515** |
| Châu Quỳnh | 2025-10-01 | 1862  | 1773       | +89      |
| Châu Quỳnh | 2025-11-01 | 1654  | 1862       | **−208** |
| Mai Ly     | 2025-10-01 | 254   | ∅          | ∅        |
| Mai Ly     | 2025-11-01 | 1716  | 254        | +1462    |

**The gap, made real.** No agent in the real data has a naturally missing month, so one was
_created_ in the real data with a `filter` removing January 2026 — which also exercises the
filter-above-a-window interaction:

| tsa_name   | m              | count | prev_count  |
| ---------- | -------------- | ----- | ----------- |
| Châu Quỳnh | 2025-12-01     | 1816  | 1654        |
| Châu Quỳnh | **2026-02-01** | 1047  | **∅ BLANK** |
| Châu Quỳnh | 2026-03-01     | 1743  | 1047        |

**February reads blank, not December's 1816.** That is the round's correctness claim, executed on
real data rather than predicted. A positional `LAG` would have printed 1816 there, and it would
have looked entirely reasonable on a dashboard.

The other three ops on the same data: **running total** accumulates (1258 → 3031 → 4893 → 6547);
**share of total** sums to 1.0 per agent; **rank in group** ranks agents within each month
(Phương Trinh 1, Mai Ly 2, Châu Quỳnh 3 for 2026-05).

**Error vocabulary verified live**, each pointing at the offending field:

> `window_order_not_date: 'tsa_name' is string, not date/datetime` — `loc: […, orderBy, 0, col]` ·
> `window_col_forbidden: op 'rank' must omit col` — `loc: […, col]` ·
> `column_exists: 'count' is already a column` — `loc: […, name]`

**`_MAX_STEPS` — the verdict R163 deferred, returned: NOT raised, and the trigger did not fire.**
The real month-over-month tile costs **4** steps of 8. R163's pooled chain reached exactly 8;
this round's flagship does not come close. The cap is confirmed to fire correctly at 9. There is
**no evidence to raise it**, which is the answer the rule asked for — not an omission.

**Integration gate closed** — FE-vs-BE verified end-to-end: the builder's own preview endpoint runs
all four ops over the real 90 581-row dataset, the gap case returns blank, the save-path 422s match
the sibling steps, and the conformance suites pass on both sides (MSW: builder **359 passed**;
real backend: pytest **429**; contracts **40**).

**Honest note on one suite number.** `tests/datasets.test.tsx` (the R143 upload-wizard coercion
tests) fails intermittently in the full run — 4, then 2, then 1 across three runs, at 100–150s
durations. It is **pre-existing and load-dependent, not a regression**: reproduced at HEAD with
this round's front-end changes stashed, and it **passes in 11s when run in isolation**. Reported
rather than rounded to green.

## Check

- [x] **Verdict: PASS on every gate this round owns.** `pytest` **429 passed** (+25) ·
      contracts **40** · builder **359 passed** · `type-check` clean · `ruff check` clean ·
      i18n parity **844 = 844** · `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 ·
      markdownlint 0/309 · links clean. One **pre-existing, load-dependent** failure in
      `tests/datasets.test.tsx` reported honestly in § Do rather than rounded away — reproduced at
      HEAD with this round's changes stashed, passes in 11s in isolation.
- [x] **The gap case is proven on REAL data**, not only in a fixture — January 2026 filtered out
      of the real 90 581-row `calls_clean`, and February's previous-month reads **blank**, not
      December's 1816.
- [x] **`_MAX_STEPS` — the verdict R163 deferred is returned: NOT raised.** The real tile costs
      **4** of 8; the trigger did not fire. An answer, not an omission.
- [x] **Two things the D gate did not predict were found and pinned as tests**: the shared
      `_measure_expr` conflating _no window_ with _empty window_, and the point-frame's dependence
      on a period-**aligned** axis.

### Method decision — the human-walk convention (human, 2026-08-12)

**Adopted: RECORD always, SPEC on ask.** At any gate that hands over to a human — **F1 and I**
under DFCFBI, **I** under DCFBI — the round's `## Check` always carries the walk **questions** with
**⬜ verdicts** and a **`Walk coverage: N of M`** line; the **exact steps** are generated only when
the human asks for them.

_Track: 2 (agent-method). Pulled by: R163's named learning "hand-instructions are a failure surface
too" (a compressed prose chain lost two `derive` steps → the round's confident-wrong-number
incident), plus three consecutive rounds — R163 items 3–9, R164 items 2–6, R163's two card states —
where unreturned walk items left **no trace** and had to be reconstructed from conversation._

**Why the split, rather than making both optional (the human's first proposal).** The two halves
fail differently. A missing **spec** is _visible_ — the human simply explores instead of following
a script, and nothing is lost. A missing **record** is _invisible_: an item nobody returned reads
exactly like an item nobody needed. The observed failure was the second one, so that half stays
mandatory. It is also nearly free: the questions are relocated from the round's existing acceptance
criteria and Risks, exactly as the R159 ⟢ At a glance block relocates the Act learnings — what is
genuinely new is only the ⬜ column and the coverage line.

**And why not ask-for-everything.** The guard exists against _agent_ failure modes (instruction
drift, claiming-done-without-verifying) but would be authorised by the _human_ — at the end of a
long round, when they most want to stop reading and go look. That is precisely when it would be
declined and precisely when it is needed.

**One timing correction to the proposal, made at adoption**: it is not "the I phase". Under DFCFBI
the FIRST human handover is **F1** — R164 stopped there and needed exactly this. The trigger is
_any human-handover gate_, so a backend-only DCFBI round with no human gate gets neither half, which
is the ceremony the human was right to want avoided.

**`Walk coverage` is the confidence signal**, and it constrains an existing field rather than
adding a score: **the ⟢ At a glance Studied confidence must not exceed the walk coverage.** A round
closing at 1-of-5 is a different claim from one closing at 5-of-5.

**Enforcement deliberately deferred** per [[adopt-artifact-defer-enforcement]]: hand-use for ~3
rounds, **no lint**. A presence-lint cannot tell a good walk spec from a box-ticking one, and
whether the block is _read_ is exactly what the dogfood is testing. If it earns its place it
graduates into [PDCA.md](../PDCA.md)'s Round Template + the post-round audit; if it does not, it is
pruned. **R165 is dogfood round 1.**

### Human walk — the spec (agent cannot self-certify this)

Build on **`telesale`** (2000 rows, `Sales demo (seed)`). Each row is ONE question with the
smallest test that answers it — R163's lesson: _a realistic chain tests the chain, not the
question_. Record the human's **own words**, hedges intact; **⬜ means unreturned, never assumed
green**.

| #   | The one question                                | Exact steps                                                                                                                                                                                                                                                                                                                                                                     | For                         | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Do the numbers read right?                      | `Date bucket` new `month`, of `called_at`, per **Month** → `Group & aggregate` by `agent`,`month` · **Count rows** → **Previous period's value** Value `count` · In order of `month` · per **Month** · Within each `agent` · name `prev_count` → `Computed column` `vs_prev` = `count` − `prev_count`. **Expect** Alice Nguyen Jan `30`/prev **blank**, Feb `23`/prev `30`/`−7` | R165                        | ✅ **PASS** (2026-08-12) — human's own result: Alice Nguyen `01/01/2025` count `30`, prev `—`, vs_prev `—` · `02/01/2025` count `23`, prev `30`, vs_prev **`−7`**. Exactly the expected mapping, blank first period included. Produced W-1 (fixed in-round) + W-2 and W-3 (recorded, deferred)                                                                                                                                                                                                        |
| 2   | **Is the advisory line help, or a scold?**      | On card 3 above, read the ⓘ line. Then delete card 4 — does it still tell you what to add?                                                                                                                                                                                                                                                                                      | R164 · **blocking**         | ✅ **PASS after two in-round fixes** (2026-08-12). Returned first as a **scold** — _"even delete Card 4, card 3 still the same"_ — which found W-4 (the instruction never checked whether it had been taken) and, on the follow-up look, W-5 (the gap count was a page count reading as a result count). **Re-walked with card 4 present**: instruction absent, description + gap count kept; **card 4 deleted**: instruction returns. Both halves verified by hand                                   |
| 3   | **Does the filter clause land?**                | `Group & aggregate` by `agent`,`outcome` · **Count rows** → `Filter result` `outcome` equals `connected` → `Group value` **Sum of** `count` Within each `agent` name `agent_total`. Now `[↑]` the filter above the Group value card. **Does the sentence change, and does the change explain the 100%?**                                                                        | R164 · **blocking**         | ✅ **PASS** (2026-08-13). The sentence changes, and the change is right: the human's `[↑]` moved the **Group value** card (`agent_total` **264**, so the group total forms BEFORE the narrowing — real shares ~31%, no trap), and no clause is the correct answer there. Logged as a FAIL first on an assumption about which card moved; **corrected**. The adjacent hole in the _other_ arrangement was real and is fixed (W-6), and chasing it found and fixed **W-7**, a pre-existing pager defect |
| 4   | Is "Across everything" a decision or a blank?   | `Group & aggregate` by `agent` · **Count rows** → **Share of total** Value `count` Within each `agent` name `count_share`. Then **clear** `Within each`                                                                                                                                                                                                                         | R164                        | ✅ **PASS** (2026-08-13) — human confirmed the cleared `Within each` reads **"Across everything"**, not an empty field. The whole-table window is a NAMED state on screen, which is what R164's `minItems: 0` decision needed the surface to carry                                                                                                                                                                                                                                                    |
| 5   | Do the two reorder-failure states read clearly? | On #4's chain, `[↑]` the Share card above the aggregate → orphan alert. Then rename its output to `agent` → inline name error                                                                                                                                                                                                                                                   | R163, **3 rounds unwalked** | ✅ **PASS — both states** (2026-08-13). **Orphan alert**: _"'count' doesn't exist this early. Move this card back down, or pick a column that does."_ — names the column, the cause and both remedies. **Name collision**, after moving the card back to a valid position: _"'agent' is already a column here. Pick another name."_ — an INLINE field error on the card, not a preview-level one. En route it also exposed W-8 and then confirmed its fix. **R163's oldest debt is cleared**          |

**Walk coverage: 5 of 5 returned** (T1 ✅ · T2 ✅ after two fixes · T3 ✅ after a corrected verdict ·
T4 ✅ · T5 ✅ both states). Both **blocking** items pass, and **R163's two card states are confirmed
after three rounds unwalked** — the debt this round said must not become a fourth did not.

This line is the round's confidence signal, and the ⟢ At a glance **Studied** confidence must not
exceed it. **A returned-and-FAILED item still counts as returned** — coverage measures whether the
human looked, not whether the surface passed; the verdict column carries the pass/fail.

**Three questions produced five findings** — W-1, W-4 and W-5 from the walk directly; W-6 and W-7
from _investigating_ a walk answer, W-7 being a pre-existing defect in a surface this round never
touched. All five fixed. **And one verdict was wrong before it was right**: T3 was logged FAIL on an
assumption about which card the human moved, and their numbers overturned it. The lesson is for the
SPEC half of this round's own convention — "`[↑]` the filter above the Group value card" was ambiguous
because the filter was _already_ above it, so the human reasonably pressed `[↑]` on the other card.
**A walk step must name the card it acts on**, and an agent reading back a walk result must confirm
which gesture happened before grading it.

#### W-1 — the `Computed column` card reads as literal-only (walk T1, fixed in-round, 2026-08-12)

**What the human hit**: building card 4 of T1's chain, `vs_prev = count − prev_count` read as
**blocked** — the card appeared to allow only `count − <a fixed number>`. On being pointed at the
control: _"ok2, it's a toggle! can switch, just 'hard to recognize'"_.

**Not a capability gap.** `DeriveOperand` has been a `col | const` union since R122 and the engine
validates the column case with the same `_require_numeric` rule as the left side; `prev_count` is
`integer` (a `prior_period` carries its source dtype forward), so it was in the pool the whole time.
Two things made the capability invisible:

1. The operand-kind `Segmented` was **unlabelled**, so on a row of four controls it read as a fourth
   value picker rather than as the switch that decides what the row _is_.
2. `blankStep('derive')` defaulted to `right: {kind: 'const', value: 0}` — a fresh card rendered
   `new_column = count − 0`, a **complete-looking arithmetic sentence**. Nothing invited a second
   look, which is what makes this the same class as R163's incident: a `derive` card that is
   silently plausible while wrong.

**Fixed** (FE-only, no contract or engine change — the wire shape was already right):

- [StepsEditor.tsx](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx)
  — the toggle now carries a `FieldLabel` (**"Second value"** / _"Giá trị thứ hai"_), like every
  other field on the card, and switching to `Column` lands on a column you would actually compare
  against instead of on `left` itself (`count − count`).
- [steps.ts](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts) — a
  blank `derive` pairs the **last numeric column** when a second one exists, so the card the walk
  wanted (`count − prev_count`) is the card that appears. One numeric column → the literal stands.
  This is R164's _a default that already carries a claim_ doctrine, applied to the older card that
  never got it.

**Why the default change and not only the label**: the label makes the capability findable, but the
default removes the need to find it in the common case. The two window-then-compare ops
(`prior_period`, `running_total`) both hand the user a second numeric column expressly to subtract
from the first — the literal is the rarer intent, and it was the default.

**Evidence**: 2 tests added (the default's paired shape + its one-numeric fallback; the label
renders) — `steps-editor.test.tsx` **51 passed** (49 before), `i18n` parity **4 passed**,
`type-check` clean.

**Scope note**: this is a walk-driven F2 fix inside R165, not new scope — it changes no step
semantics and no wire field. The **naming** half of this cluster stays parked per R163 (a column
called `rate` holding a count), and T1's numbers question is still open.

**Partially fixed, and stopped there — the human's call (2026-08-12).** Re-walked after the fix:
_"vẫn chưa thật 'rõ' lắm để biết nó là 1 toggle"_ — the label made the control **findable**, not
**pressable**. Root cause diagnosed: the step card is white with a hairline border and antd's
`Segmented` renders its selected item as a **white raised thumb**, so on this card only the
*un*selected half shows any grey — two words, one faintly shaded. Three fixes were costed (one
merged picker with a trailing "A fixed number…" entry · `Radio.Group optionType="button"`, both
halves boxed · a Segmented with an explicit filled track) and the human **deferred all three**:
_"keep it now. Maybe later include with UI enhancement. Because it's not scoped of this round."_

**Deferred deliberately, not dropped** — carried to the batched UI round per
[[r-ui-bug-fixing-round]], alongside the R157 UX cluster this round already listed as out of scope.
The distinction the human drew is the one that matters: the _capability_ was invisible, which was a
correctness-adjacent defect this round owned; the _control's affordance_ is a UI-polish item, which
it does not. Half a fix that closes the defect beats a whole one that grows the round.

#### W-2 — an unreachable backend is indistinguishable from a rejected step (walk T1, recorded)

Mid-walk the human reported card 4 as _"Computed column return no data? -> cannot save"_. It was
**neither a compute bug nor a rejected step**: re-run on a live stack, the same chain returned the
correct numbers (T1 ✅ above), and the engine had already been proven directly — the four-step chain
over `telesale` returns **96 rows** with `vs_prev` as `float` and `−8.0` / `+3.0` where expected.

**What actually happened**: both dev logs contain **zero 4xx/5xx** — every preview in the session
returned 200 — while the backend and vite both shut down **mid-walk**. A network-level failure
leaves no server-side trace, and on this surface it is invisible in a second way:
[`previewOk`](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts)
gates Save on `Boolean(preview) && !previewQuery.isError`, and the preview hook is `retry: false`
with `placeholderData: (prev) => prev`. So **one** failed request produces **both** symptoms at
once: the table falls back to the previous step's result (so the new column simply isn't there) and
Save greys out — with no message, because `query_stale`, `relationship_stale` and
`composition_cycle` each get their own copy while a plain connection failure gets none.

**This is the round's own lesson at a different altitude**: _blank means two things_. R165 built the
gap-count clause because "no previous period" and "an empty value" render identically; here "the
step is wrong" and "the server is gone" render identically, and the second one wastes the walk. Not
fixed — the human has scoped UI work out of this round (W-1) and this is the same batch. Recorded so
the next walker does not re-diagnose it from an empty table.

#### W-3 — adding a step re-orders the result (walk T1, observation, not built)

Found while reproducing T1 against the real backend, not reported by the human — their two Alice
rows happened to come back in order. The same chain at **3 steps** returned one agent's months in
sequence (Jan→Aug); at **4 steps** it interleaved agents (Elif Jan/Feb/Mar, Hiro Jan/Feb/Mar, then
Elif Apr). There is no `sort` step in T1's chain, so the row order is **arbitrary** and every added
step may re-jumble it.

No defect: the numbers are right and the engine promises no ordering. But a month-over-month tile
that arrives interleaved **reads** wrong, which matters for exactly the question T1 asks. Two
candidate answers — a `sort` in the recommended chain, or the `prior_period` advisory line naming
ordering as well as the missing `derive` — both belong with the naming/legibility cluster, not here.

**Promoted from repro-only to CONFIRMED user-visible (T2 re-walk, 2026-08-12).** The human's two
pastes of the same query differ only by whether card 4 exists, and the gap count reads **3** with it
and **4** without it. Their first report of a `4` was read as a slip and corrected to `3`; the
re-walk shows both numbers are real, on the same data, one edit apart. Deleting a `derive` cannot
change which rows are blank — it changes which 25 of 96 rows land on page 1. So arbitrary ordering is
not merely cosmetic: it **moves a reported number** in response to an unrelated edit, and W-5's
"on this page" wording is what made that legible instead of baffling.

#### W-4 — the advisory could not tell whether its advice had been taken (walk T2, fixed in-round)

**Verdict: SCOLD.** T2 asked whether the ⓘ line is help or a scold, and its test was one gesture —
delete the `derive` card and see whether the line changes. The human's finding: _"even delete Card 4,
card 3 still the same."_

**Confirmed in code**: the advisory rendered on `step.op === 'prior_period' && step.col` alone
([StepsEditor.tsx](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx)) —
it never looked at the step list, so **"To compare, add a Computed column: count − prev_count"**
printed identically whether card 4 existed, had just been deleted, or had never been built. Advice
that repeats after you have taken it is not advice.

**Why this matters beyond tone**: the gap count — this round's own F2 deliverable — lives on the
_same line_. A line that nags unconditionally trains the reader to skip it, and the thing they would
then skip is the sentence distinguishing a **gap-blank from a data-blank**. R164 built the advisory
to prevent R163's missing-`derive` incident; unconditional, it was on its way to causing a quieter
version of the same failure.

**Fixed** (FE-only, no contract or engine change):

- `consumedByDerive(steps, index, name)` in
  [steps.ts](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts) — does a
  **later** `derive` reference this card's output column, on **either** side (`count − prev_count`
  and `prev_count − count` are both comparisons)? A pure function beside `grainAt` / `narrowedBy` /
  `nullCountOf`, threaded to the card exactly like `gaps`.
- The line was **split in two keys**, because only half of it was stale: the DESCRIPTION
  (`priorPeriodHint` — "This column holds the previous period's _count_") and the gap count are
  **facts** and always render; the INSTRUCTION (`priorPeriodAdd`) renders only while the chain is
  incomplete. Suppressing the whole line would have taken the gap count with it.
- A later `select` **rename** is deliberately not tracked: it makes the answer "no" and merely
  restores the advisory, which is the safe direction to be wrong in.

**Evidence**: 1 test pinning T2's exact gesture — complete chain → description present, instruction
absent; delete the `derive` → instruction returns. Builder suite **363 passed / 0 failed across 26
files** (`type-check` clean, i18n parity green). Note: `tests/datasets.test.tsx`, flaky under load
earlier this round, **passed cleanly in this run** — reported as observed, not as a fix.

**Also surfaced by T2, unprompted**: the human's quoted line carries _"3 rows have no previous
'month' — those cells are blank"_ and the grain sentence _"Each row here is one agent × month"_ — so
R162's grain line renders correctly by hand. The gap count did **not** survive the same look → W-5.

#### W-5 — the gap count was a PAGE count wearing a result count's words (walk T2, fixed in-round)

Found by chasing a discrepancy in the human's two pastes (which they then corrected — both read
`3`, so there was no instability). The check ran anyway, and the number itself was wrong:

| what is counted                                  | the walk's chain on `telesale`    |
| ------------------------------------------------ | --------------------------------- |
| rows the builder holds (page 1, `page_size=25`)  | **3** blanks ← what the line said |
| the whole result (96 rows, fetched page by page) | **8** blanks ← the truth          |

The result has **7 agents**, so 7 blanks are first-periods and **one is a genuine mid-series gap** in
the seed — the exact case this round exists for, and it was outside the counted page.

**Root cause**: `nullCountOf` counts the rows it is given, and what it is given is
`builder.previewRows` — **one page**. The sentence said "N rows … those cells are blank", a claim
about the result, computed over 26% of it. This round's own F2 note says a count we cannot stand
behind is worse than no count; the count as shipped could not be stood behind, and R165's Do log
overstated it by asserting only the not-in-result case.

**Fixed** — the scope moved into the sentence rather than the number being dropped (the count still
earns its place: it explains the blanks you can actually see):

- `nullCountOf` now returns `{ count, partial }`, `partial` being "these rows are one page of a
  bigger result" (`result.total` threaded from `builder.previewTotal`). **One helper, one contract**
  — a caller cannot forget to ask, which is this round's own `_measure_expr` lesson applied to a
  helper of its own making.
- Two copies: `priorPeriodGaps` unchanged for the whole-result case, `priorPeriodGapsPage` — "N rows
  **on this page** …" — when paginated.

**Evidence**: 1 test pinning both scopes (96-total → `partial: true`; total = rows held →
`partial: false`); the two existing `nullCountOf` tests moved to the new shape. Builder **364 passed
/ 0 failed across 26 files**, `type-check` clean, i18n parity green.

**Truthful now, not complete — and the limit is worth naming.** A page-scoped count cannot answer the
question the clause exists for: on a page with no blanks it says nothing while blanks sit on page 2,
and it moves when the page contents move (W-3, confirmed by this very re-walk: 3 with card 4, 4
without). The honest fix was to stop the sentence overclaiming; the complete fix is a **result-wide
count**, which needs a wire field on the preview response — contract work, deliberately not started
mid-walk. Candidate for the batch alongside W-1/W-2, and the first item here with a real product
argument rather than polish.

**The lesson worth carrying**: T2 asked about TONE and found two wrong FACTS (W-4's stale
instruction, W-5's mis-scoped number) plus the confirmation of a third (W-3). A walk question does
not stay inside its own category — which is the argument for the walk convention adopted this round,
not for a longer question list.

#### W-8 — an invalid STEP was reported as an invalid FILTER, in a query with no filters (walk T5, FIXED)

The orphan alert itself passed, and the card said the true thing. The panel below it did not:

> ⓘ card: _"'count' doesn't exist this early. Move this card back down, or pick a column that does."_
> ⚠ panel: _"**1 filter** references a column that isn't in these results. Remove it or pick a current
> column."_

There is **no filter in the query**. The count is not measured either — it is
`Math.max(invalidCount, 1)`, so it prints "1" when the real number of bad filters is **zero**.

**Root cause — two different failures share one error code and one sentence.** The preview handler
wraps predicate-building _and_ step-planning in the same `try`, and maps **either** 422 to the same
409 `query_stale` ([queries.py](../../../workspace/apps/backend/app/routers/queries.py)). The panel
then renders `predStale || invalidCount > 0` through the single `predInvalid` copy
([QueryBuilderPanel.tsx](../../../workspace/apps/builder/src/features/data-management/queries/QueryBuilderPanel.tsx)),
which is written about filters. So a step the engine refused is announced as a filter the user never
wrote — while the correct explanation is already on screen, six lines above.

**Same family as W-2**: a surface that cannot distinguish two causes will name the wrong one with full
confidence. There the two were "server gone" and "step rejected"; here they are "filter drifted" and
"step invalid". This one is worse in one respect — it does not merely fail to explain, it **asserts
something false about the user's own query**.

**FIXED with a distinct error code** (human's call, 2026-08-13) — not the shallow branch on
`invalidCount === 0`, which would have been a guess dressed as a message. `step_invalid` is now a
first-class code, so the sentence is DERIVED rather than inferred:

- **Contract** — [api-error.yaml](../../../workspace/packages/contracts/_shared/api-error.yaml): the
  closed `ApiErrorCode` enum, an `ApiErrorStepInvalid` schema whose description records _why the split
  exists_, the `oneOf`, and the `discriminator.mapping`. Plus `values.yaml` and **both** codegen
  templates (the FE and BE constant lists enumerate codes by hand).
- **Backend** — the merged `try` split in **both** handlers that had it (`/queries/{id}/rows` and
  `/queries/preview`) and in the workflow run. A refused PREDICATE stays `query_stale`; a refused STEP
  is `step_invalid`.
- **FE** — `stepInvalid` on the builder (blocks Save, own sentence, defers to the card that already
  names the column); the saved-query detail page keeps the same needs-attention panel with the **true**
  reason instead of "re-save it from the dataset", where there is nothing to fix; the workflow run
  message. Both locales. The filter sentence now prints the **real** count instead of
  `Math.max(count, 1)` — the source of the phantom "1 filter".
- **MSW** — the mock can emit what the contract documents, gated by the same orphan check the engine
  applies and reusing the FE's own `threadColumns` so the mock cannot drift from the editor.

**Confirmed by hand on the re-walk** (2026-08-13), T5's exact state, both messages present and each
saying the true thing:

> card: _"Share of total: 'count' doesn't exist this early. Move this card back down, or pick a column
> that does."_ · panel: _"A step can't run on the columns available where it sits — see the highlighted
> card above."_

Live stack returns `409 {"code": "step_invalid"}` for that chain.

**Two things the tests caught that would otherwise have shipped broken:**

1. **Four backend tests asserted `query_stale` for STEP failures — and only those four moved.** No
   predicate test budged, which is the evidence the split is surgical rather than a rename. All four
   were updated with the reason, and two renamed (a test whose NAME states the old code is a second
   place the wrong idea lives).
2. **`isApiError` is an explicit allowlist**, so `step_invalid` first fell through as a generic error
   and **no** surface recognised it — the detail-page test failed on exactly that. Worth carrying:
   **adding an error code has a required FE step that no type error can catch**, because an unknown
   code is legal input to a type guard. The contract, the models, and the copy can all be right while
   the code is invisible.

**Evidence**: contracts **40** · backend **437** (+1) · builder **368** (+2, 26 files, 0 failed) ·
`type-check` clean · `ruff` clean · live `409 step_invalid` verified.

#### W-6 — the filter clause vanishes while the trap it warns about stays (found investigating T3; NOT what T3 walked)

**Correction, recorded because the first verdict was wrong.** T3 was initially logged as a FAIL on the
strength of the human's two pastes — clause present, then absent after `[↑]`. That read assumed the
`[↑]` had moved the **filter**. It had not: the human moved the **Group value** card, and their own
numbers prove it (`agent_total` **264**, not 86 — see the third row below). In that arrangement the
absent clause is **correct**, so what T3 actually walked was correct behaviour. **T3 passes.**

The defect below is real and was verified with numbers, but it was found by _analysis while
investigating T3_, not by the walk — and the record now says so rather than crediting the walk with a
finding it did not make.

| chain                                  | the ⓘ clause                                  | the numbers                      |
| -------------------------------------- | --------------------------------------------- | -------------------------------- |
| `aggregate` → `filter` → `Group value` | _"Rows were already filtered by 'outcome' …"_ | every rate **100.0%**            |
| `filter` → `aggregate` → `Group value` | **clause gone** (pre-fix)                     | every rate **100.0%** ← the hole |

Verified on `telesale` through the builder's own preview endpoint: **byte-identical results** — Elif
Kaya 70/70, Alice Nguyen 86/86, Hiro Tanaka 78/78, 8 rows, both orders. So that reorder removes the
warning and changes nothing about the failure. **The clause was present in one arrangement and absent
in the identical-but-unexplained one.**

**Root cause — a D-gate rule that is right in general and wrong here.** `narrowedBy` resets at a
collapsing `aggregate`, on a rationale written into its own docstring: _"a filter BEFORE it narrowed
the rows that were summarised, which the grain sentence already covers."_ That holds unless the
filtered column is **also a grain dimension**. Here `outcome` is both: pinning it to one value with
`equals` leaves exactly **one row per (agent, outcome) group**, so every within-group aggregate
returns the row's own value and every share is 100% **by construction**. The grain sentence says
_"one agent × outcome"_ and never says `outcome` now has a single value — so it does not, in fact,
cover the case its own rationale claims it covers.

**This is R163's incident, in the order R164 did not cover.** R163's realised failure was a filter
above a Group value card making every rate 100%; R164 answered it with the filter clause; T3 shows
the answer covers one of the two positions, and a user reaching for the ⓘ line in the other position
is told less than nothing. **Not fixed** — the reset rule is a recorded R164 D-gate decision and
changing it is a design call, not a copy edit; it is the round's open question at the human's gate.

**FIXED — the narrowest amendment to the rule** (human's call, 2026-08-12): `narrowedBy` no longer
clears a narrowed column at an `aggregate` when that column is one of the aggregate's **dimensions**.
The clause now survives T3's `[↑]` and the warning is present in both arrangements, which is the
point — the two arrangements produce identical numbers. A filter on a **non-dimension** still clears,
so R164's rationale stands where it was right; only its blind spot closed.

**Tests**: 2 added — `narrowedBy` reporting the clause in both orders (plus the non-dimension case
still clearing, R164's rule intact), and the **RENDERED** sentence keeping the clause after the move,
because the predicate being right is not the same as the card saying so. The existing R164 tests pass
unchanged, because their fixture filters `status` while grouping by `agent` — a non-dimension, which
is exactly why the blind spot survived the round that introduced it. `type-check` clean.

**All THREE arrangements, measured — and the third is the diagnostic.** `[↑]` can move either card,
and which one moved is visible in the numbers:

| card order                                                 | `agent_total` | the share  | clause               |
| ---------------------------------------------------------- | ------------- | ---------- | -------------------- |
| `aggregate` → `filter` → Group value                       | 86            | **100.0%** | shown (R164)         |
| `filter` → `aggregate` → Group value (**T3's gesture**)    | 86            | **100.0%** | shown (W-6 fix)      |
| `aggregate` → Group value → `filter` (the **other** `[↑]`) | 264           | **32.6%**  | correctly **absent** |

The third row is not a trap at all: the group total is formed before the narrowing, so the share is a
real share of the agent's total calls — which is what a rate is usually reaching for. No clause is the
right answer there, so an absent clause is only a bug in the second row. **100% vs ~31% identifies
which card was moved** without asking.

**Deliberately NOT built** — the stronger sentence: **`filter` on `equals` + that column in the grain
⇒ single-row groups** is provable from the step list with no data, so the card could say _why_ the
number is degenerate ("each group holds one row, so this equals the row's own count") instead of
hinting that rows were filtered. That is a new detector and new copy in both locales; it belongs with
the naming/legibility cluster the human parked at R163, and the amendment above is what T3 asked for.

#### W-7 — pagination does not partition the result: 33 rows shown twice, 33 never shown (found chasing T3, OPEN, PRE-EXISTING)

The agent-count mismatch between two of this walk's own measurements turned out to be real, and it is
the most serious thing the walk has surfaced. Paging through T1's own 96-row result, 25 at a time:

|                                               |        |
| --------------------------------------------- | ------ |
| rows returned across pages 1–4                | **96** |
| **distinct** `(agent, month)` keys among them | **63** |
| keys returned on more than one page           | **33** |
| rows never returned on **any** page           | **33** |

**Root cause**: `run_steps` pages with `LIMIT ? OFFSET ?` over the composed step SQL
([rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py)), and that SQL carries
**no deterministic ORDER BY** unless the user happens to end with `sort`/`top_n` — and even then ties
are unordered. Each page is an independent execution free to return rows in a different order, so
`OFFSET` slices a _re-shuffled_ relation. This is also the true root cause of **W-3** (the jumbled
tile) and of **W-5's** wobbling gap count: one defect, three symptoms.

**Not R165's defect** — it has been latent since stepped queries shipped (R125) and is a property of
the pager, not of `window_column`. But it is strictly worse than anything else found here: a reader
paging a dashboard-ready table sees one row twice and another not at all, with **no signal**. Both
the "confident wrong number" class this round cares about and the loop-survival concern the product
is organised around.

**FIXED as a scoped hotfix** (human's call, 2026-08-12): `_page_order_sql` in
[rows_reader.py](../../../workspace/apps/backend/app/ingest/rows_reader.py) gives the paged read a
deterministic **total** order. The user's explicit ordering still leads — the LAST `sort`/`top_n`
supplies the leading keys with those steps' own `NULLS LAST`-both-directions rule — and every
remaining column is appended as a **tiebreak**, so `OFFSET` means what it says. Backend-only, no
contract change.

**Verified on the live stack, same probe that found it**: 96 rows, **96 distinct, 0 duplicated, 0
missing** (was 63 / 33 / 33). W-3's jumbled tile is settled as a side effect — all-columns-ascending
puts each agent's months in order, which is what a month-over-month tile wants anyway.

**Two order-dependent tests failed and were RIGHT to fail** — and neither was testing order:
`test_week_bucket_appends_iso_monday_start_date` asserted bucketed weeks positionally (now a mapping
from each source timestamp — the claim was always "which week does this call fall in"), and
`test_select_projects_renames_and_reorders` asserted `rows[0]` while testing COLUMN order (now the
whole set). A neighbouring aggregate test passed only because `APAC` < `EMEA`. **Incidental-order
assertions are latent failures**: they pass for a reason the test never states, and they fire when
something unrelated and correct changes underneath them.

**Tests**: new [`test_paging_total_order.py`](../../../workspace/apps/backend/tests/test_paging_total_order.py),
**7 tests** — 4 pin the ORDER-BY contract on the SQL itself (no reliance on whether a given DuckDB
build happens to reshuffle), 3 assert the properties a reader depends on: every row exactly once,
paged == unpaged, identical requests agree, and an explicit `sort` surviving page boundaries. Backend
**436 passed** (429 before, +7); `ruff` clean.

**Already banked, not part of this walk**: the real-data proof ran at the I gate on the human's
90 581-row `calls_clean` before they cleaned it up — a manufactured gapped month read blank rather
than reporting December's 1816 (§ I gate). Per the repo's two-track method, **seed verifies the
features; real data verifies the real problem** — so this walk is about whether the SURFACE reads
right, not whether the numbers are right.

- [x] **The human's acceptance walk** — **complete, 5 of 5, all passing.** Gates green was necessary
      and not sufficient, exactly as [[dfcfbi-f1-needs-human-review]] says: every gate was green
      before the walk began, and the walk still found **six** defects (W-1, W-4, W-5, W-6, W-7, W-8),
      all fixed, one of them pre-existing in a surface this round never touched.
- [x] **R164's deferred walk items 2–6 are returned**, including R163's two card states — the
      three-round carry ends here (T2–T5).
- [x] ⟢ At a glance authored (**Shipped / Studied / Watch**, per the R159 doctrine). **Studied
      confidence is uncapped**: the walk closed at **5 of 5**, so the round's claim about its surface
      rests on hand-use of every state, not on inference from a subset.

### Flip to Complete — the human's sign-off (2026-08-13)

The human signed off **R164 and R165 together** after T5 returned, closing the walk at 5 of 5. The
round shipped in two halves by the standing [[dfcfbi-two-round-split]], and its acceptance gate was
the walk, not the suites: six defects found after every gate was green, all six fixed with tests, one
of them (**W-7**) pre-existing since R125 in a surface this round never touched. Final:
contracts **40** · backend **437** · builder **368** · `type-check`, `ruff`, `plan:lint`,
markdownlint, links all clean.

## Act

**Learnings** _(the acceptance walk has now run; it added four and overturned none)_:

- **A walk question does not stay inside its own category.** T2 asked about TONE — help or scold — and
  returned two wrong FACTS (a stale instruction, a mis-scoped number) plus the confirmation of a
  third. T3 asked whether a sentence lands and led to a **pager** defect that predates the round by
  forty rounds. Five questions produced six fixed defects, and **not one** of them was the thing the
  question was nominally about. The argument this makes is for asking a human to _use_ the surface,
  not for a longer question list — the list was five items and it was enough.
- **Gates green, six defects.** Every gate was closed and every suite green before the walk started:
  contracts 40, pytest 429, builder 359, and an I-gate run on 90 581 real rows. The walk then found
  six. [[dfcfbi-f1-needs-human-review]] said green is necessary and not sufficient; this round is the
  strongest single piece of evidence for it so far, because the gates were not sloppy — they were
  thorough, and they were still blind to what a hand on the surface sees in twenty minutes.
- **Grade the gesture, not the outcome.** T3 was logged FAIL on the assumption that `[↑]` had moved
  the filter card; the human had moved the Group value card, and their own `agent_total` of 264
  overturned the verdict. An agent reading back a walk result must confirm **which action happened**
  before judging what it produced — and a walk spec must name the card it acts on ("`[↑]` the filter
  above the Group value card" was ambiguous, because the filter was already above it).
- **Incidental-order assertions are latent failures.** Two backend tests asserted row order while
  testing truncation and column projection; both fired when W-7's _correct_ fix landed underneath
  them, and a third survived only because `APAC` sorts before `EMEA`. A test that passes for a reason
  it never states is a trap primed for whoever changes the thing it silently depends on.

_Carried from before the walk:_

- **Extracting a shared helper concentrates the risk into its contract, so the contract must be
  exact.** R163 learned that extraction _finds_ bugs; this round learned the other half.
  `_measure_expr`'s `over: str = ""` quietly meant two things — _no window_ and _empty window_ —
  and no caller could reveal it until one legitimately needed `OVER ()`. The fix was a type, not a
  branch: `str | None`. A shared helper's ambiguity is a latent bug in every future caller.
- **A one-line comment left by the round that paid for a lesson is the cheapest artifact here.**
  R163 discovered the Query/Workflow union coupling and wrote a MIRROR note in `workflow.yaml`.
  This round's C gate cost two lines and no thought. The note did what a lint would have, at none
  of the cost — evidence for _least mechanism that works_ over adding a gate.
- **"Verify the engine first" keeps paying at a different altitude each time.** R164 verified the
  four SQL forms and that _changed the design_. R165 ran them against real data and found two
  things the D gate had no way to know: the point-frame's dependence on a period-aligned axis, and
  the tie behaviour at the wrong grain. Verification is not a one-time gate — each altitude has
  its own surprises, and the fixture that proves a form does not prove its coupling.
- **Proving a correctness claim sometimes means MANUFACTURING the case in real data.** No agent in
  90 581 real rows had a missing month, so the gap was created with a `filter` on real data rather
  than retreating to a fixture — which also exercised the filter-above-a-window interaction for
  free. "Test it on real data" and "test the hard case" can conflict; a filter resolves them.

**Promotions**: still none proposed, but the walk produced three candidates worth naming for the
human's review — **(a)** "a walk question does not stay inside its own category" (the strongest, and
it argues for the convention adopted this round rather than for new machinery); **(b)** "incidental
order in a test is a latent failure"; **(c)** "a hand-listed guard makes a new enum value invisible"
(W-8's `isApiError`). Per the Evolution Rule's _default = don't add_, each waits for a second
instance in a different domain. The strongest candidate — _a shared helper's ambiguity is a latent
bug in every caller_ — is a second instance of the extraction lesson rather than a new one, and it
strengthens the existing `[[widening-shared-wire-model-omit-serializer]]` family. Per the
Evolution Rule's _default = don't add_, it waits for a third.

**Follow-ups (not promotions, just notes):**

- **`prior_period` needs a period-ALIGNED axis** (`date_bucket` output). On raw dates every cell
  reads blank — correct and useless. Documented and tested; **no affordance built**, because the
  card cannot tell the two kinds of `date` column apart. A candidate for the naming/legibility
  cluster the human parked at R163.
- **`prior_period` at the wrong grain** (several rows per period) returns the first of them.
  Documented, not guarded — it cannot be known statically.
- **The `derive` operand toggle still doesn't READ as a toggle** (W-1, second half) — a white
  `Segmented` thumb on a white card. Three costed options are in W-1; deferred by the human to the
  batched UI round per [[r-ui-bug-fixing-round]]. The capability is no longer invisible, so this is
  polish, not a defect.
- **A dead backend reads as a rejected step** (W-2) — no data, Save off, no message; one failed
  preview produces both symptoms. Same batch as W-1.
- **W-6, W-7 and W-8 are FIXED in-round** on the human's call (T3's vanishing clause; the pager's
  missing total order; the step-vs-filter error code). W-3 is settled as a side effect of W-7 — the
  tile now arrives ordered.
- **Adding an error code has an FE step no type error catches** (W-8) — `isApiError` is a hand-written
  allowlist, so a new code is invisible to every surface until it is added there. Cheap to forget,
  silent when forgotten; a candidate for a generated guard rather than a hand-listed one.
- **R163's two card states are CLEARED** — both walked and passing at T5 after three rounds of
  carrying them. The orphan alert and the inline name-collision error both read correctly by hand.
- **The stronger degeneracy sentence is NOT built** (W-6's second half) — `filter equals` on a grain
  dimension implies single-row groups, provable from the step list; it would name the 100% instead of
  hinting at it. Naming/legibility cluster.
- **Incidental-order assertions are latent failures** — two backend tests asserted row order while
  testing something else, and only fired when W-7's correct fix landed underneath them. Worth a sweep
  for others.
- **A result-wide gap count needs a wire field** (W-5's remaining half) — the page-scoped count is now
  honest but cannot see blanks on later pages. Contract work, not started mid-walk.
- **R163's two card states are still unwalked**, now across three rounds.
- **`tests/datasets.test.tsx` is flaky under full-suite load** — pre-existing, unrelated to this
  work, and worth its own look before it masks a real failure.
- **A full `design-sync` of `data-management/`** (all 14 docs) remains outstanding since R162.

## Feeds into → Round_166 (retire composition, ship Duplicate)

Program item 3: remove `query⋈query` in **both** its shipped forms (the `qr_` driving base and
R91's `qr_` on the right of a hop), ship **Duplicate** in its place, delete the `cyclic_join` /
`composition_cycle` / shared-leaf machinery, and delete `QueryCreatePage` + the `?base=` route.
Net-negative code. Carries this round's `_MAX_STEPS` verdict and whatever the acceptance walk
teaches about naming ordered columns.
