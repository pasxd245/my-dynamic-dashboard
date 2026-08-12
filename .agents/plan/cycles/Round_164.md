# Round 164: the rest of the within-group family — ordered windows

**Status**: Complete
**Date started**: 2026-08-11
**Date completed**: 2026-08-13

## ⟢ At a glance

**Shipped** — the **front half** of the ordered-window family: a **D gate** that settled fourteen
shape questions with **all four ops' SQL executed on the pinned DuckDB before the spec was written**,
and an **F1** surface where the four operations appear in the user's own words — _share of total ·
running total · rank in group · previous period's value_ — behind one step kind the user never meets.
The `[Add step ▾]` menu became **three groups instead of a flat twelve**, and R163's filter-placement
trap became executable: `narrowedBy` + a shared `GrainLine`, with the 100%-rate case pinned as a
rendered test. FE-only on MSW; the engine, the contract and every real number were **deliberately**
R165's, and no `prior_period` figure in this round came from DuckDB.

**Studied** — **verifying the engine before writing the spec changes the design, not just the
confidence.** Running the four window forms on the real DuckDB at the D gate is what produced the
no-in-window-`ORDER BY` decision and the per-op _rejected_-field matrix; a spec written first would
have been rewritten at B. The second lesson is the cheaper one: `ux-design` found the flat-twelve
menu **on the spec, before the build existed**, and the human's walk then confirmed the fix by hand
(_"with 3 groups of Agg Function seem clearer"_) — preventive review and hand-use answering the same
question from opposite ends.

**Watch**

- **Both mitigations this round invented at the D gate were needed and both were wrong in detail** —
  R165's walk found the `prior_period` advisory line could not tell whether its advice had been taken
  (it nagged forever), and the grain line's filter clause vanished in the one arrangement where the
  numbers were identical and unexplained. Neither was visible on MSW, which is exactly why F1 stops
  short of claiming them. **Invented at D, confirmed defective at the next round's walk, fixed there.**
- **Items 2–6 of this round's walk were deferred by the human, not skipped** — and they were
  **returned in [R165](Round_165.md) at 5 of 5**, where they produced six defects, all fixed. The
  deferral was the right call: walked once with real numbers instead of twice on a mock.
- **R163's two unwalked card states left this round unconfirmed for a second time.** They were
  cleared at R165's T5. The carry ended at three rounds, not four.

## Goal

**Inherits from ← [Round_163](Round_163.md)** — the within-group column ships and computes:
`group_column` compiles `<measure> OVER (PARTITION BY …)` with **no in-window `ORDER BY`**, the
grain line returned a **yes** verdict on real data, and the human rebuilt the dashboard that
blocked them on 2026-08-07. R163 also handed forward three live threads this round inherits:
the **filter-placement trap**, the **parked naming finding**, and **`_MAX_STEPS = 8` reached
exactly**.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— **item 2**: the rest of the within-group family — **% of total · running total · rank within
group · vs prior period**. Same mechanism as R163 plus the thing R163 deliberately withheld: an
**in-window `ORDER BY` + frame**.

_Track: 1 (product). Pulled by: program item 2 — and by the grain-alignment dogfood's own tiles
([brainstorm § What the tiles actually require](../brainstorms/2026-08-07-grain-alignment.md)),
where **T4 needs `rank`** and **T1 compares two months**. Neither is expressible today._

## Plan

**Expected outcome**: a data player can add _share of total_, _cumulative_, _rank in group_, and
_vs the previous period_ as columns, in business words, on one card — and **"vs previous period"
does not lie when a period is missing**.

**Falsified if**: the ops need engine words (frame, partition, order key) to be authorable at all;
or the op set turns out to be four unrelated cards rather than one family; or the human's real
month-over-month tile still can't be built because the chain exceeds `_MAX_STEPS` or needs a
period axis the product can't produce.

### D — the design gate (first, per the program's repeatable unit)

- [x] **Settle the step shape** — recommended: **ONE new step kind** (working name
      `window_column`) with an **`op` discriminator**, _not_ four kinds and _not_ a widening of
      `group_column`. R163's own contract text already declares the boundary: _"Running total /
      rank / vs-prior-period need an in-window ORDER BY + frame; that is why they are a separate
      step family, not a widening of this one"_
      ([query.yaml](../../../workspace/packages/contracts/_shared/query.yaml)). **The fork to
      close at this gate**: one kind + `op`, vs one kind per op. Decide, don't discover at C.
- [x] **Settle the op set and each op's SQL** — the four forms below are **already verified
      against the pinned DuckDB 1.1.3** (§ Risks carries the evidence table):

      | op | compiles to | order key | `by` |
      | --- | --- | --- | --- |
      | `pct_of_total` | `col / NULLIF(SUM(col) OVER (PARTITION BY …), 0)` | none | **may be empty** (whole table) |
      | `running_total` | `SUM(col) OVER (… ORDER BY k ROWS UNBOUNDED PRECEDING)` | ≥1 | ≥0 |
      | `rank` | `RANK() / DENSE_RANK() / ROW_NUMBER() OVER (… ORDER BY k)` | ≥1 | ≥0 |
      | `prior_period` | `… ORDER BY d RANGE BETWEEN INTERVAL n <unit> PRECEDING AND INTERVAL n <unit> PRECEDING` | exactly 1, **date/datetime** | ≥0 |

- [x] **`prior_period` uses the RANGE-interval frame, NOT `LAG`.** This is the round's one
      genuinely new correctness decision and it closes a standing program-log trap (_"vs prior
      period lies silently on gaps"_). Positional `LAG` makes **April read as February** on a
      Jan/Feb/Apr axis; the interval frame returns **NULL**. Proven, not assumed — evidence in
      Risks.
- [x] **`% of total` relaxes `by: []`** — the empty partition R163 explicitly refused
      (`group_by_required`, [query_engine.py:566](../../../workspace/apps/backend/app/query_engine.py#L566)).
      It becomes legal **only** for this op, and only because the op _names_ the whole-table
      reading in business words. A bare `group_column` with `by: []` stays refused — the guard was
      there so an empty `by` can never become a **silent** global window, and that reason survives.
- [x] **Decide `rank`'s tie policy in business words.** `RANK` (1,2,2,4) · `DENSE_RANK` (1,2,2,3)
      · `ROW_NUMBER` (1,2,3,4) are three different business answers. Offer one, or name them in
      persona language — a picker labelled `rank` / `dense_rank` fails the "no engine words" bar.
- [x] **Decide what `vs prior period` OUTPUTS** — the previous period's _value_, the _delta_, or
      the _% change_. R163's evidence says this is the round's sharpest legibility question: a
      column named `delta` holding an average shipped to a dashboard-ready table. If the op emits
      the raw previous value, the user still needs a `derive` to compare — one more step against a
      ceiling already at its limit, and one more chance to mis-name the result.
- [x] **Rewrite the design corpus in-round** ([[d-gate-artifact-in-design-corpus]]) —
      [`query-construction.md`](../../design/data-management/queries/query-construction.md)
      (the card, its ASCII, labels EN+VN, card states, accessibility) and
      [`queries.md`](../../design/data-management/queries/queries.md) (the step-kind table + the
      422 vocabulary). `_noun-model.md`'s operations table gains the ordered family.
- [x] **Run [`ux-design`](../../skills/ux-design/SKILL.md) in design-spec mode** on the rewritten
      card spec — primary/preventive use, per PDCA. R163's failure landed on **legibility**, which
      is a Credibility/Usability facet, so this is not ceremony this round.
- [x] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit** and record
      the chain in the Do log. Expect **DFCFBI** again (a new affordance carrying a
      confident-wrong-number risk); if it fires, the standing [[dfcfbi-two-round-split]] splits
      this into **[D + F1]** here and **[C + B + F2 + I]** in R165, exactly as R162→R163 ran, and
      the program renumbers by one.

### F1 — the feel review (this round's back half; the flow selector landed DFCFBI)

**Contract-safe by construction** — FE state + request-only, no new wire field
([[dfcfbi-f1-precedes-contract]]); MSW's `additionalProperties: false` would block one anyway.

- [x] **The four `[Add step ▾]` entries + the three `<OptGroup>`s**, EN + VN, with the ops
      unofferable (disabled + tooltip) when the columns at that position can't satisfy them.
- [x] **The card** — `[What ▾]` op picker with per-op fields, "Across everything" as a named
      empty state, op-derived default names.
- [x] **The grain line's filter clause** — the R163 trap fix. Lands on **both** card families, so
      it repairs the shipped "Group value" card too.
- [x] **The `prior_period` advisory line** + the gap count, both derived from the preview the
      builder already holds.
- [x] **i18n EN + VN parity** re-checked (currently 830 = 830).
- [x] Re-run `design-sync --check` on the docs this round touched, before the close.
- [x] **The human runs the app** — the F1 hard stop. MSW/pytest cannot see layout, feel, or
      whether the advisory line reads as help rather than as a scold
      ([[dfcfbi-f1-needs-human-review]]).
- [~] **Return R163's unwalked items** while the app is open — the orphan alert and the
  name-collision field error **have still never been seen by a human** (R163 Check, item 5).

### Handed to R165 (C + B + F2 + I) — not this round

`WindowColumnStep` in `query.yaml` **and** the mirrored `workflow.yaml`; `_plan_window_column` +
the `_apply_step` branch built by **extending** `_measure_expr` / `_measure_dtype` rather than
copying them (R163's extraction-is-a-bug-detector lesson, and these forms have their own
`COALESCE`/`OVER` binding hazard); the F2 confirmation; the Integration walk; and the acceptance
walk — **the human builds a real month-over-month tile on the real 2025 call log**, including a
missing period, and confirms the gap reads blank rather than as the wrong month.

### Explicitly NOT in this round

- **Retiring composition / shipping Duplicate** — program item 3
  ([§ Item 3 scope](../programs/query-shaping-surface.plan.md)).
- **A naming validator.** R163 banked the evidence (a column called `rate` holding a call count)
  and the human **parked** it — _"we can post back, enhance later"_. Inventing an affordance now
  is design-by-building ([[requirements-table-before-building-ui]]). This round may only make
  naming _less_ likely to lie by construction (e.g. an op-derived default name); it may not build
  a checker.
- **The R157 UX cluster**, `[F-join-label-qualify]`, `[F-promote-gate]` — batched per
  [[r-ui-bug-fixing-round]].
- **The all-14-doc `data-management/` design-sync sweep** — inherited-outstanding from R162/R163,
  still its own pass.

## Risks / unknowns

- **`_MAX_STEPS = 8` will very likely bite this round — and that is now expected, not feared.**
  R163's pooled chain cost **exactly 8**, with the rule _"reached, never exceeded → not raised"_.
  A month-over-month tile plausibly runs `date_bucket → aggregate → window_column(prior_period) →
derive`, and any pooled variant of it exceeds 8. **The trigger the program named has arrived**;
  this round is where the number gets raised, with the walk supplying the evidence and the new
  ceiling. ([query_engine.py:466](../../../workspace/apps/backend/app/query_engine.py#L466).)
- **The gap trap, and its proven fix** (run against the pinned **DuckDB 1.1.3**, 2026-08-11, on a
  deliberately gapped axis — `a`: Jan 10, Feb 20, **Apr** 40):

  | form                                             | Feb reads | **Apr reads**                          |
  | ------------------------------------------------ | --------- | -------------------------------------- |
  | `LAG(x) OVER (PARTITION BY g ORDER BY m)`        | 10 ✅     | **20 ⚠️ — February's value, silently** |
  | `RANGE BETWEEN INTERVAL 1 MONTH PRECEDING AND …` | 10 ✅     | **NULL ✅ — there is no March**        |

  `running_total`, all three rank functions, and the global `SUM(x) OVER ()` also all verified OK
  on the same engine. **The remaining unknown is not the SQL — it is the surface**: how the user
  says _"previous month"_ without saying _frame_, and what a NULL previous period reads as on the
  card and in the preview.

- **The filter-placement trap becomes sharper, not milder.** R163 demonstrated on real data that a
  `filter` above a Group value card collapses the denominator (every rate reads **100.0%**) and
  the grain line does **not** change, because it tracks position relative to `aggregate` only
  ([steps.ts:84](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts#L84)).
  **`% of total` is precisely the op that makes this read 100%.** Shipping it without addressing
  the trap ships a wrong number by a route already demonstrated. **Open question for the D gate**:
  extend the grain line to track filters too, or state the boundary explicitly and defer.
- **Ordered ops add a legibility axis the grain line does not cover.** The grain line answers
  _which rows am I aggregating over_. An ordered op adds _in what order, and how far back_ — and
  R163's finding was that the gap is in reading the **result**, not in expressing the operation.
  Four new ops is four new ways to produce a confidently-named wrong column.
- **`prior_period` needs a date-typed order key that may not exist at that position.** Per the
  standing **D4 rule** ([`_noun-model.md`](../../design/data-management/_noun-model.md)) the op
  must be **unofferable at the gesture**, never an error at run — the same discipline as
  `group_column`'s dtype-gated column pickers. `date_bucket` is the producer of that axis, so the
  two steps are coupled in a way no earlier step pair has been.
- **Scope size is the open call at the top of this round.** Four ops is roughly 1.5× R163's
  contract/engine surface but ~4× its front-end surface (one card, four op shapes, EN+VN copy for
  each, per-op dtype gating). One step kind keeps the C/B cost near-linear; the F cost is what
  splits. The `flow-selector` + [[dfcfbi-two-round-split]] is the mechanism that resolves it — see
  the D gate's last item.

## Do

### Scope, settled by the human before the D gate opened (2026-08-11)

Two calls, both taking the recommended option:

1. **All four ops, ONE step kind.** Not four kinds, and not a widening of `group_column` — R163's
   own contract text already drew that boundary. The C/B cost stays near-linear (one planner
   function, one `_apply_step` branch, an extension of the shared measure helpers); the
   front-end is what multiplies, which is exactly what the `flow-selector` + the standing
   [[dfcfbi-two-round-split]] exist to split.
2. **The filter-placement trap is fixed in this round's D gate**, not deferred. `% of total` is
   the op that makes a mis-placed filter read **100.0%**, so shipping it without the fix would
   ship a wrong number by a route R163 already demonstrated on the human's real 90 581-row log.

### D gate — the design decisions (2026-08-11)

**D-1 · One kind, four ops, and the menu does the naming.** The wire kind is **`window_column`**
with an **`op`** discriminator (`pct_of_total · running_total · rank · prior_period`). The user
never meets the word "window", "partition", "frame", or the kind name — because the kind is
**not** what they pick. **The `[Add step ▾]` menu gains four entries, one per op**, each reading
as a business phrase; the card's title is the op's own label, and a `[What ▾]` picker on the card
switches between them (they share most fields). This is deliberately _unlike_ `group_column`,
which needed a kind label ("Group value") because it is one operation. Four operations behind one
abstract kind label would have been a findability tax on the persona: a player looks for
_"running total"_ in the menu, not for a category that contains it.

**D-2 · The four ops and their SQL** — every form verified against the pinned **DuckDB 1.1.3**
before this gate closed (evidence table in § Risks), per R163's _verify-the-engine-first_ lesson:

| op              | compiles to                                                                                                      | `col`               | order key                               | `by` |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------- | ---- |
| `pct_of_total`  | `col / NULLIF(SUM(col) OVER (PARTITION BY …), 0)`                                                                | required, numeric   | — (rejected)                            | ≥0   |
| `running_total` | `SUM(col) OVER (… ORDER BY k… ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`                                 | required, numeric   | ≥1, any dtype                           | ≥0   |
| `rank`          | `RANK() OVER (… ORDER BY k…)`                                                                                    | — (rejected)        | ≥1, any dtype                           | ≥0   |
| `prior_period`  | `FIRST_VALUE(col) OVER (… ORDER BY d RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND INTERVAL 1 <unit> PRECEDING)` | required, any dtype | exactly 1, **date/datetime**, ascending | ≥0   |

**D-3 · `prior_period` is an INTERVAL frame, not `LAG` — the round's one new correctness
decision.** It closes a trap the program log has carried open since 2026-08-07. Positional `LAG`
walks _rows_, so on a Jan/Feb/**Apr** axis April silently reads February's number; the
`RANGE … INTERVAL` frame walks the _calendar_, so a missing March makes April read **NULL**.
Both were run on the pinned engine — the wrong answer was reproduced, not theorised. **A blank is
the correct answer to "what was the previous month" when there was no previous month**, and it is
the only one of the two that cannot put a confident wrong number on a dashboard. `unit` reuses
`date_bucket`'s **exact** granularity enum (`day · week · month · quarter · year`) rather than
minting a second period vocabulary — one vocabulary, two steps.

**D-4 · `prior_period` emits the previous period's VALUE, not the delta and not the % change.**
The comparison is one `derive` away, and `derive` is already the product's formula-free binary op.
Emitting a delta would bake a subtraction direction into a column the user cannot inspect — the
exact shape of R163's `delta`-holding-an-average finding, except authored by the product itself.
The cost is honest and recorded: **a month-over-month tile is two steps, not one** (`prior_period`
→ `derive`), against a ceiling already at its limit (§ Risks).

**D-5 · Mitigating the naming risk by construction, without building a checker.** The round's
scope line forbids a naming validator (parked by the human; building one now would be
design-by-building). What is allowed, and is taken here, is **op-derived default names**: a
`window_column` defaults its `name` to `<col>_share`, `<col>_running`, `rank`, `prev_<col>` rather
than to a generic placeholder. Today's blank steps default to `new_column` / `bucket` /
`group_value` — names that carry no claim and therefore invite the user to type one that does.
A default that already describes the operation is the cheapest available push away from
R163's failure, and it is a _default_, not a rule: the user may still rename it anything.

**D-6 · "Share of total", not "% of total" — the label is fixed at this gate for a reason.** The
op emits a **ratio in 0..1** (`float`), because percent _formatting_ is presentation and belongs
to the widget (the standing compute-vs-presentation doctrine). A control labelled _"% of total"_
that produces `0.19` would be the product committing R163's own sin — a name that lies about its
contents — in the one place we have complete control. **Share of total** / VN **Tỷ trọng** names
the ratio truthfully. (The program plan keeps the descriptive item name "% of total"; that is the
item, this is the label. [[name-value-not-mechanism]].)

**D-7 · `rank` offers exactly ONE ranking, and refuses row-numbering.** SQL has three
(`RANK` 1,2,2,4 · `DENSE_RANK` 1,2,2,3 · `ROW_NUMBER` 1,2,3,4); a picker naming them would be the
engine vocabulary this concept exists to avoid. **`RANK` ships** — ties share a rank and the next
rank skips, which is what "ranked 2nd" means outside a database. **`ROW_NUMBER` is refused on
correctness grounds, not scope**: it invents an order between genuinely equal rows, so re-running
the same query can reshuffle the tie — a confident wrong number by construction, the exact class
R163 demonstrated. **Named trigger to revisit**: a real user asking for consecutive numbering with
no gaps.

**D-8 · An empty `by` becomes legal here — because the surface NAMES the empty case.** R163
refused `by: []` on `group_column` (`group_by_required`) with a reason worth preserving: an empty
partition must never _silently_ become a whole-table window. The reason is about silence, not
about emptiness. On this card the group control renders an explicit **"Across everything"** /
VN **"Trên toàn bộ"** state when `by` is empty, so the whole-table reading is a visible choice
rather than a blank field. **`group_column`'s guard is unchanged** — one way to say a thing, and
zero regression risk on shipped code.

**D-9 · The filter-placement fix — the grain line learns that filters narrow groups.** `grainAt`
([steps.ts:84](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts#L84))
tracks only the nearest preceding `aggregate`, which is why R163's demonstration — a `filter`
moved above a Group value card, every rate reading **100.0%** — changed no words on screen. It
gains a second output: the **row-narrowing steps** (`filter`, `top_n`) that precede this position,
by the columns they narrow on. The grain sentence gains one clause, and **both card families get
it** — this repairs the shipped `group_column` card as well as the new one:

> _"Each row here is one `agent × month`. Rows were already filtered by `status`, so this covers
> only those rows."_
> VN: _"Mỗi dòng ở đây là một `agent × month`. Các dòng đã được lọc theo `status`, nên phép này
> chỉ tính trên những dòng đó."_

That is the minimum that would have made the 100% legible: it names the cause the user could not
see. **Deliberately NOT added**: a clause about ordering. `running_total` and `prior_period` are
order-dependent, but the card already shows an **"In order of"** control — the order is visible,
so a sentence about it would be ceremony. One new clause, for the one invisible thing.

**D-10 · Labels (EN + VN), settled at the gate** per [[labels-context-and-locale-aware]] —
corpus-checked for collisions, not just chosen:

|                      | EN                              | VN                              | note                                                                                               |
| -------------------- | ------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pct_of_total`       | **Share of total**              | **Tỷ trọng**                    | D-6; the standard VN business word for share-of-total, unused elsewhere in the corpus              |
| `running_total`      | **Running total**               | **Lũy kế**                      | standard VN accounting term for cumulative; unused elsewhere                                       |
| `rank`               | **Rank in group**               | **Xếp hạng trong nhóm**         | reuses `trong nhóm` from `group_column`'s **Giá trị theo nhóm** family                             |
| `prior_period`       | **Previous period's value**     | **Giá trị kỳ trước**            | reuses `Giá trị` from **Giá trị theo nhóm** / **Giá trị đo** — one word for "value" corpus-wide    |
| the order-key field  | **In order of**                 | **Theo thứ tự**                 | `thứ tự` is already the corpus's word for ordering (`steps.hint`)                                  |
| the empty-`by` state | **Across everything**           | **Trên toàn bộ**                | `toàn bộ` is already the corpus's word for "the whole" (5 uses, incl. `rangeFull` = _"(toàn bộ)"_) |
| the period unit      | reuses `granularity_*` verbatim | reuses `granularity_*` verbatim | one period vocabulary, per D-3                                                                     |

Zero EN or VN collisions across `en.json` / `vi.json` — checked before adopting, not after.

**D-11 · Offer-nothing, never error-at-run** — the standing **D4 rule**
([`_noun-model.md`](../../design/data-management/_noun-model.md)). Each op is **disabled in the
`[Add step ▾]` menu and the `[What ▾]` picker, with a tooltip naming why**, when the columns at
that position cannot satisfy it: `prior_period` needs a **date/datetime** column (its producer is
`date_bucket`, so the two steps are coupled more tightly than any earlier pair), `pct_of_total` /
`running_total` need a **numeric** one, `rank` needs any column. This reuses the shipped
`noEligibleColumn` shape rather than inventing a second one.

**D-13 · Three gaps found by `ux-design` at this gate, and closed in the spec** (design-spec mode,
the primary/preventive use — the whole reason it runs at D rather than at F):

1. **Findability** — `[Add step ▾]` is a **flat 8-option `<Select>`** today
   ([StepsEditor.tsx:143](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx#L143));
   four new entries make **12**, five of which append a column. A flat twelve is a scan, not a
   choice. **Fixed**: three text `<OptGroup>`s — **Summarise · Add a column · Shape the result** —
   reusing the `<OptGroup>` mechanism the base/join `<Select>`s already use for
   "Datasets"/"Saved queries". Group 2 leads with the five within-group/ordered ops.
2. **Usability** — D-4 makes a month-over-month tile **two steps**, and the design recorded that
   cost _to itself_ while declaring nothing that carries it to the user. Given R163's realised
   failure was a human dropping exactly the `derive` steps from a chain, that gap is the same
   trap with a fresh coat. **Fixed**: the `prior_period` card carries **one advisory line** under
   the grain line, sharing its mechanism (`role="status"`, ⓘ + text, `colorTextSecondary`, never
   an `<Alert>`), naming the next step **in the menu's own words** with the real column names
   interpolated. Advisory only: it never blocks Save and it **does not auto-insert** the `derive`
   — silently adding an operation the user did not ask for is the opposite of the
   ordered-operations concept.
3. **Credibility** — **blank means two things**: "there was no previous period" and "the previous
   period's value was itself empty" render identically, and only the first must not read as a data
   problem. **Fixed**: a sixth card state — the card **counts** the gapped rows and says so
   (_"3 rows have no previous `month` — those cells are blank."_), derived from the preview the
   builder already holds. A distinct in-cell rendering is **explicitly refused**: that is a
   `<PagedRowsView>`-level concern touching every nullable column in the product, not this step's
   to invent.

Re-run after the edits: **PASS, 0 gaps.** All six facets cited to `query-construction.md` lines;
`design:lint` 0 / `design:tokens` 0 / markdownlint 0 across 308 files.

**D-14 · The cross-noun widening is decided HERE, at D, not discovered at B.** `window_column`
joins the shared Python `Step` union, so it widens `WorkflowDefinition` automatically; the
mirrored `workflow.yaml` must widen with it. R163 paid ~2 lines to decide this at its C gate and
recorded the reason in a MIRROR note that is still in the file — this round follows it rather than
re-deriving it. [[widening-shared-wire-model-omit-serializer]].

### Design gate — closed (2026-08-11)

**Design gate closed** — user journeys + **testable acceptance criteria** documented in the design
corpus, which is the D-gate's durable artifact ([[d-gate-artifact-in-design-corpus]]), not a
section of this file. Evidence: [`query-construction.md`](../../design/data-management/queries/query-construction.md)
(the four ops, the ASCII card, EN+VN labels, the `[Add step ▾]` grouping, six card states, the
grain line's filter clause, the accessibility contract, acceptance criteria **10 · 11 · 12**);
[`queries.md`](../../design/data-management/queries/queries.md) (the `window_column` step entry
with the per-op required/rejected field matrix, the 422 vocabulary, acceptance criterion **9**);
[`_noun-model.md`](../../design/data-management/_noun-model.md) (the operations table gains
**ordered-window column**; D6's closing note now points at the separate kind). `ux-design`
design-spec run + re-run recorded above. Lints: `design:lint` 0 · `design:tokens` 0 ·
markdownlint 0 · `plan:lint` 0.

**Model check** (Design gate):

- Noun-vs-mode: **mode** — `window_column` is a new **step kind inside the existing Query
  noun** and the existing `▾ Transform` steps editor, not a new noun and not a new surface. It
  appends a column to the same ordered operation list, folds through the same `_step_plan`
  planner and the same `_apply_step`, and is authored in the same step card. No new route, no new
  page, no new id prefix. The one thing that _is_ new — four menu entries — is a widening of a
  shipped `<Select>`, not a surface. ([[design-gate-noun-vs-mode]].)
- Discovered-vs-imposed: **discovered** — three sources, none authored to justify this round.
  (a) The grain-alignment dogfood's tile table names **rank** (T4) and a two-month comparison (T1)
  as requirements, written 2026-08-07 before any of this existed. (b) R163's contract text drew
  the "separate step family, not a widening" boundary **while building a different feature**.
  (c) The program's rolling log has carried the prior-period gap trap as an open correctness
  finding since the program opened. **Limit, stated plainly**: this records that the question was
  asked and answered, not that the answer is right — the commission check stays with the human.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired?  | Justification                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | **yes** | The card-states table declares **six** (Normal · Orphaned by a move · Name collision · No date axis · No previous period · Gaps in the period axis), on top of four `op` branches that each show a different field set.                                                                                                           |
| 2. New interaction pattern           | no      | Every mechanism is already shipped in this surface — the step card + reorder (R120), the dtype-gated column pickers and grain line (R162/R163), the order-key editor (`sort`), the `<OptGroup>` menu (base/join `<Select>`s). The `[What ▾]` picker is a variant of the existing per-kind body switch, not a new pattern.         |
| 3. High user-error risk              | **yes** | Nothing is destructive, but the misstep cost is a **confident wrong number on a dashboard someone acts on** — realised for real at R163. `prior_period` emits a component of an answer that reads like the answer; `pct_of_total` under a mis-placed filter reads 100%.                                                           |
| 4. Contract depends on unresolved UI | no      | The D gate closed every shape question: the `op` enum, the per-op required/**rejected** field matrix, `by` may be empty, `unit` reuses `date_bucket`'s granularity, `orderBy` reuses `sort`'s `keys`. The YAML is writable today; the advisory line and the gap count are FE-derived from the preview and need **no** wire field. |
| 5. UX confidence below threshold     | **yes** | Two mitigations were **invented at this gate and have never been in front of a human**: the `prior_period` advisory line, and whether the grain line's new filter clause actually lands. R163's evidence is that this exact surface can pass every gate and still produce a wrong number on first hand-use.                       |

Result: **Flow: DFCFBI (triggers 1, 3, 5)** — the same three as R162, for the same underlying
reason. The standing [[dfcfbi-two-round-split]] therefore applies: **R164 = [D + F1]**,
**R165 = [C + B + F2 + I]**, and program items 3 and 4 shift to **R166** / **R167**. F1 precedes
the Contract gate, so it must stay **contract-safe** — FE state + request-only, no new wire field
([[dfcfbi-f1-precedes-contract]]); MSW response-validation (`additionalProperties: false`) would
block one anyway.

### F1 — the surface, on MSW (2026-08-11)

Contract-safe as required: **no new wire field**. The step rides the existing request body, and
the FE types were authored to the shape the C gate will freeze — the same discipline R163 later
verified ("the F1 types already matched the shipped body field-for-field").

**Five files, all additive; no shipped step changed.**

- **[types.ts](../../../workspace/apps/builder/src/features/data-management/queries/types.ts)** —
  `WindowOp`, `WindowOrderKey`, `WindowColumnStep` + the `Step` union. The per-op
  required/**rejected** field matrix is carried in the type's doc comment, so the next author
  reads the contract at the type rather than re-deriving it from the design doc.
- **[steps.ts](../../../workspace/apps/builder/src/features/data-management/queries/steps.ts)** —
  the pure layer: `windowColumnDtype`, `windowColumnPool`, `windowOrderPool`,
  `windowOpAvailable` (the D4 offer-nothing test), `windowColumnIssues`, `defaultWindowName`,
  `blankWindowStep`, and **`narrowedBy`** — the filter-trap fix. `STEP_KINDS` (a flat list of 8)
  is **replaced by `STEP_MENU`**, three groups of business-phrase entries.
- **[StepsEditor.tsx](../../../workspace/apps/builder/src/features/data-management/queries/StepsEditor.tsx)** —
  `WindowColumnBody` (op picker + per-op fields + the named "Across everything" state + the
  advisory line) and a shared **`GrainLine`** component. `kindLabel` became `stepLabel`, because
  for this family the kind is **not** the operation.
- **[handlers.ts](../../../workspace/apps/builder/src/mocks/handlers.ts)** — `windowColumnStepMock`,
  so F1 renders real-ish numbers rather than a placeholder.
- **i18n** — 13 keys × EN + VN; parity re-checked **843 = 843**, zero missing either way.

**`grainAt` was left untouched; the filter clause is a SECOND function.** _"Which rows am I
aggregating over"_ and _"what has already been dropped"_ are different questions, and folding the
second into the first would have changed a shipped signature for no gain. Both card families
render the same `GrainLine`, so **the R163 trap fix lands on the shipped "Group value" card too** —
that repair is the round's first user-visible correction, ahead of any new capability.

**The mock encodes the D-3 decision, not just the shape.** `prior_period` in MSW looks up the
previous period **by calendar value**, not by row position, so a gapped axis renders blank in the
builder exactly as the engine will. A mock that walked rows would have made F1 _feel_ right while
teaching the opposite of what R165 must build.

**One real defect, caught by a test rather than by the walk.** `prior_period` defaulted its value
column to the first _eligible_ column — and since it accepts any dtype, that was `agent`, a
string. "The previous period's `agent`" is legal and useless. The **defaults now reach for the
shape the op wants** (a number to carry forward, a time axis to walk along) before falling back;
the assertion was updated to the better behaviour rather than the behaviour being fitted to the
test.

**Deferred to R165's F2, with the reason**: the **gap COUNT** on the advisory line
(_"3 rows have no previous month"_). It needs real result rows, which arrive with the engine —
the same reason R162 deferred two card states to R163. Marked ⏳ in the card-states table rather
than left as an undelivered claim.

**Tests**: 16 added to `steps-editor.test.tsx` (pure layer + rendered surface, including the
100%-rate case as an executable test). Builder **356 passed** (340 before, +16); `type-check`
clean; `vite build` clean; prettier clean on all five touched files (each was clean at HEAD, so
the drift was this round's and is fixed).

**Doc↔code check, narrow rather than ceremonial.** `design-sync`'s own guidance is that a full
sync does **not** run inside an in-scope round on the domain being built. Every F1 claim in
`query-construction.md` was instead verified mechanically against the shipped code — three
`<OptGroup>`s, four op entries, the shared grain line on both families, the named empty state, the
advisory line, the disabled-op reason, and 13 EN+VN label pairs. `queries.md`'s status line was
corrected to say the surface is built and the **engine and wire contract land at R165**, which is
the one claim that would otherwise have overstated what shipped. `design:lint` 0 · `design:tokens`
0 · markdownlint 0/308 · links clean.

### The F1 hard stop — the human's walk (not yet returned)

**The builder is left running on MSW at <http://localhost:3000>** so the walk can start without a
rebuild. Per [[dfcfbi-f1-needs-human-review]] this is the gate no automated check can stand in
for, and per R163's own learning the tests below are **minimal isolating** ones — each answers a
single question — rather than one realistic chain (the chain tests the chain, not the question).

| #   | Question                                                | The smallest test                                                                                                                                                                             |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Do the four ops read as business words?                 | Open `[Add step ▾]`. Do the three groups + four entries make sense **without** reading anything else?                                                                                         |
| 2   | **Is the advisory line help, or a scold?**              | Add **Previous period's value**. Read the ⓘ line under it. Invented at the D gate, never seen by a human — the honest reason condition 5 fired.                                               |
| 3   | **Does the filter clause land?** (the R163 trap)        | Add **Group & aggregate**, then **Filter result**, then **Group value**. Now `[↑]` the filter above the Group value card. **Does the sentence change, and does the change explain the 100%?** |
| 4   | Is "Across everything" legible as a choice?             | On a **Share of total** card, clear **Within each**. Does the empty state read as a decision or as a blank?                                                                                   |
| 5   | Is an unofferable op's reason findable?                 | Open `[Add step ▾]` on a query with no date column. Is **Previous period's value** disabled _with a readable reason_?                                                                         |
| 6   | R163's unwalked items — **still never seen by a human** | On a **Group value** card, `[↑]` it above the aggregate → the orphan alert. Then rename its output to an existing column → the inline name error.                                             |

Stop the server with `pnpm dev:local:down` or by killing the `vite` process.

### Walk finding — the F1 environment, diagnosed (2026-08-11)

The human's first walk attempt reported a **canvas bug** (_"removed Rels but Save is still
disabled"_) and **no data on items 2 and 4**. Neither is a bug. One cause, confirmed from the
running backend's own log rather than inferred:

> `"loc": ["body","definition","steps",0]` ·
> `"msg": "Input tag 'window_column' found using 'kind' does not match any of the expected tags"`

The walk ran against the **real backend** (`enable_mock: false`, so the app talks to `:8000`),
and the backend's Python `Step` union has never heard of `window_column` — that lands at
**R165's C + B**. The preview 422s; `previewOk` goes false
([useQueryBuilder.ts:221](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L221));
`canSave = dirty && previewOk && …` therefore disables Save for **every** edit to that query, the
canvas rel removal included. Recovery is to delete the new step card. Re-seeding was considered
and rejected: the data is not involved, and the same 422 would greet the real 90 581-row log.

**The walk is less blocked than it looked, and that matters more than the diagnosis.** The step
cards render from the step list plus the _dataset's own_ columns, not from the preview
([useQueryBuilder.ts:185](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L185)
falls through to `datasetColumns` for a single-source query), so on a single-dataset query every
copy/legibility question is answerable with a failing preview — only the result _table_ is empty.
**Item 3 — the filter trap, the round's inherited blocking question — works end to end with real
numbers today**, because it is a `group_column` chain and that engine shipped at R163. On a
_joined_ query the pickers do go blank, because there the columns come from the preview response.

**What this is and is not, stated honestly.** It corroborates R163's already-logged finding
(_preview failure disables Save without naming the cause_) with a human actually being confused by
it — but **it cannot reach a real user**: in production the FE and BE ship together, so a step
kind the backend rejects cannot exist. It is an artifact of the DFCFBI split putting F1 one round
ahead of the engine. Recorded as evidence for an existing finding, **not** as a new one, and
**not** as a defect this round should fix.

**Decision (human, 2026-08-11): walk now on the copy questions, then build R165.** This keeps the
split's purpose intact — feel the design before a contract is frozen and an engine built against
it — rather than collapsing it for faster numbers.

### The F1 walk — one verdict returned, the rest deferred by the human (2026-08-11)

**Item 1 — PASS.** The human's words: _"with 3 groups of Agg Function seem clearer."_ Recorded
with the hedge intact rather than upgraded to an emphatic pass (R163's precedent). This returns a
verdict on the **`ux-design` Findability gap** found at the D gate: the flat-twelve menu was a
real problem, and the three `<OptGroup>`s are a real fix — confirmed by a human, not by a lint.
The gap was found _preventively_, on the spec, before the build existed.

**Items 2–6 — explicitly deferred by the human to after R165**, so they can be walked once with
real numbers instead of twice. That is the F1 gate's own language (_"open UX questions resolved
**or explicitly deferred**"_), not silence — the distinction R163's Check was careful about.

**F1 gate closed** — interaction decisions frozen for this round (the fourteen D-gate decisions
built without amendment); one UX question resolved by walk; the remainder explicitly deferred by
the human to R165's walk, carried in writing rather than assumed green. The two mitigations
invented at the D gate — the `prior_period` advisory line and the grain line's filter clause —
remain **unconfirmed**, and R165 inherits them as its first walk items.

## Check

- [x] **Gates green on everything this round owns.** Builder **356 passed** (+16) · `type-check`
      clean · `vite build` clean · prettier clean on all five touched files · i18n parity
      **843 = 843** · `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · markdownlint 0/308 ·
      links clean. **Necessary, not sufficient** — the walk below is the gate
      ([[dfcfbi-f1-needs-human-review]]).
- [x] **The D gate answered every shape question it owed**, so the C gate has nothing left to
      discover: the op enum, the per-op required/**rejected** matrix, `by` may be empty, `unit`
      reuses `date_bucket`'s granularity, `orderBy` reuses `sort`'s `keys`. Verified by building
      F1's types against it without a single open question.
- [x] **The R163 filter trap is fixed and executable** — `narrowedBy` + the shared `GrainLine`,
      with the 100%-rate case pinned as a rendered test, not only as prose.
- [~] **The human's F1 walk** — **item 1 returned PASS** (_"with 3 groups of Agg Function seem
  clearer"_), which confirms the `ux-design` Findability fix by hand-use. **Items 2–6 were
  explicitly deferred by the human to R165's walk**, to be done once with real numbers. Not
  silence, and not assumed green — carried in writing.
- [x] **R163's two unwalked card states** (walk item 6) — carried from R163's Check and deferred a
      second time here. **Returned at [R165](Round_165.md)'s T5 and both PASS**: the orphan alert and
      the inline name-collision error. R165 did not let it become three.
- [x] **Deferred to R165, deliberately, NOT claimed here**: the engine, the wire contract, the
      gap COUNT on the advisory line, and the acceptance walk on the real 90 581-row call log
      (including a missing period). No `prior_period` number in this round came from DuckDB — the
      MSW mock is an authoring aid, never a correctness claim. **All delivered at
      [R165](Round_165.md)**, including the gap proven on real data.
- [x] ⟢ At a glance authored (**Shipped / Studied / Watch**, per the R159 doctrine).

### Flip to Complete — the human's sign-off (2026-08-13)

Do + Check closed **2026-08-11**; the round then sat at `Review` by design while R165 ran its back
half, because five of its six walk items were deliberately deferred there. The human signed off
**R164 and R165 together on 2026-08-13**, once R165's walk had returned all five items and the two
D-gate mitigations this round invented had been confirmed — and fixed. Recorded on the sign-off date
rather than back-dated to the work.

## Act

**Learnings** _(draft — the walk may add or overturn these)_:

- **Running `ux-design` at the D gate paid in gaps a build review could not have caught.** Two of
  its three findings were _absences_, not drifts: a menu that would have grown to a flat twelve,
  and an operation that hands back half an answer with nothing saying so. A fidelity pass at F
  compares the build to the spec — it cannot flag what the spec never declared. This is the
  skill's own primary/preventive claim, earning its place for the first time on a round whose
  predecessor failed on exactly this axis.
- **Verifying the engine BEFORE the design gate changed the design, not just the confidence.**
  Running `LAG` and the `RANGE … INTERVAL` frame on the pinned DuckDB _before_ writing the spec
  is what turned "vs prior period lies on gaps" from a risk to carry into a decision to make.
  Had it been checked at B, `LAG` would already have been specced, built, and probably shipped —
  the trap is invisible unless the fixture has a gap in it.
- **A mock can encode a decision, or quietly contradict it.** The MSW `prior_period` looks up the
  previous period by **calendar value**, not row position. A row-walking mock would have been
  simpler, would have passed every test, and would have made F1 _feel_ correct while teaching the
  human the opposite of what the engine must do.
- **The round's one real defect was found by a test, not by the walk it was written for.** A
  `prior_period` card defaulting to "the previous period's `agent`" is legal, useless, and exactly
  the sort of thing a human notices, shrugs at, and works around. Asserting the _rendered
  sentence_ — not the state object — is what surfaced it.

**Promotions**: none proposed yet. The `ux-design`-at-D learning is the strongest candidate, but
it is **one instance**, and R162's own precedent (_"one instance is not a pattern"_) applies —
the skill's doc already declares the preventive claim, so this round is **evidence for an existing
artifact**, not a pull for a new one. Per the Evolution Rule's _default = don't add_, it waits.

**Follow-ups (not promotions, just notes):**

- **The two mitigations invented at the D gate have never been seen by a human** — the
  `prior_period` advisory line and the grain line's filter clause. Walk items 2 and 3.
- **R163's two card states are still unwalked**, now for a second round. Walk item 6.
- **The gap COUNT is deferred to R165's F2** with a stated reason (it needs real result rows),
  and marked ⏳ in the design doc rather than left as an undelivered claim.
- **`_MAX_STEPS = 8` is still not raised.** A month-over-month tile is `date_bucket → aggregate →
prior_period → derive` = 4, so the ceiling is likely to bite only on a pooled variant. R163's
  rule holds: the acceptance walk is the trigger, and it happens at R165.
- **A full `design-sync` of `data-management/`** (all 14 docs) remains outstanding — inherited
  from R162 and R163, still its own pass, and still worth doing before item 3 rewrites the domain.

## Feeds into → Round_165 (the ordered-window engine)

**The `flow-selector` fired DFCFBI (triggers 1, 3, 5)**, so R165 is this round's back half —
**C + B + F2 + I** — and program items 3 and 4 shift to **R166** / **R167**. It inherits: the
fourteen D-gate decisions above as a frozen spec; the four SQL forms already verified on the
pinned DuckDB 1.1.3; the `workflow.yaml` mirror obligation (decided at D-14, executed at C); the
`_MAX_STEPS` question, which a two-step month-over-month tile is likely to answer; and whatever
the F1 walk says about the two mitigations invented at this gate — the `prior_period` advisory
line and the grain line's filter clause.
