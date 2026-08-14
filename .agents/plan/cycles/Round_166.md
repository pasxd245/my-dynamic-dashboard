# Round 166: Duplicate, and the affordances withdrawn

**Status**: **Review** — D + F + I closed; walk 5 of 5, W-1 fixed in-round. Awaiting human sign-off to flip Complete.
**Flow**: **DCFBI** — set at the Design gate via `flow-selector`; recorded in the Do log
**Date started**: 2026-08-13
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_165](Round_165.md)** — the ordered-window family computes end to end, and
the acceptance walk returned **5 of 5** on the human's real 90 581-row call log. That closes the
program's **replace-before-you-remove** precondition: compare-to-group no longer needs a second
query, so the affordance that invites `query⋈query` can finally be withdrawn without leaving the
human more blocked than the dogfood that opened the program.

**Seeded from ← [Query as the single shaping surface](../programs/query-shaping-surface.plan.md)**
— **item 3a**. Item 3 was **split by layer** at the human's call (2026-08-13) after a D-gate code
walk found that the engine half is neither deletable nor net-negative the way the program plan
assumed (§ What the code says, below). This round is the **FE half**: ship Duplicate, withdraw
every entry point, touch **no engine and no contract**. `Round_167` takes the
engine half.

**The split is the option the design corpus pre-registered.**
[`_noun-model.md`](../../design/data-management/_noun-model.md) closes its D5 section with:
_"Whether to withdraw the affordances **earlier** than the engine (a cheap FE-only change, once
R163 makes the replacement real) is an **open call for the human**, not an agent's to make."_ The
human made it.

_Track: 1 (product). Pulled by: program item 3 — and by [R160's dogfood](Round_160.md), where
`[Build on this query]` was the first thing reached for and led to the `cyclic_join` dead end._

## Plan

**Expected outcome**: no surface offers building a query on a query; the variant need that
affordance served is met by **Duplicate**; and the FE is **net-negative** — a page, a route and the
canvas's whole `qr_`-as-a-source treatment leave, one button and one modal arrive.

**Falsified if**: the human hand-uses Duplicate and it does not serve the need (the program plan's
own _honest caveat_ — no recorded instance of a clone need exists); or withdrawing the canvas's
"Saved queries" group re-blocks a real question the within-group column does not actually cover; or
the removal cannot be done without touching the wire, which would mean the layer split was drawn in
the wrong place.

**Why this half goes first.** It is the cheaper, additive, reversible half, and it answers the
honest caveat **before** the engine is touched — per
[[probe-desirability-before-additive-depth]], whose lesson was earned by a round that built green
and was reverted at the Integration walk. If Duplicate misses, R167 gets rewritten rather than
reverted.

### What the code says that the program plan did not

A code walk done before this plan was written returned **five findings**. Two shape this round;
three are R167's and are recorded here so the split is legible from either side.

| #     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Whose       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **A** | **The `qr_` resolver is load-bearing for Workflow.** A Workflow's sources are `qr_`/`wf_` and **never** `ds_` ([common.py:905](../../../workspace/apps/backend/app/models/common.py#L905)), resolved through the same branch composition uses ([workflows.py:216](../../../workspace/apps/backend/app/routers/workflows.py#L216) → [query_engine.py:74](../../../workspace/apps/backend/app/query_engine.py#L74)). It cannot be deleted; it is narrowed to Workflow's reader. | R167        |
| **B** | **`cyclic_join` is NOT deleted — it is the self-join boundary** for a `ds_` right already in the graph, which `_noun-model.md` says stays rejected. Only the _set-overlap_ form (D2) dies ([query_engine.py:213-218](../../../workspace/apps/backend/app/query_engine.py#L213)).                                                                                                                                                                                              | R167        |
| **C** | **`composition_cycle` becomes unreachable; `composition_base_missing` stays alive** — the same reason string is also the un-run-workflow case ([query_engine.py:142](../../../workspace/apps/backend/app/query_engine.py#L142)).                                                                                                                                                                                                                                              | R167        |
| **D** | **D1 does NOT dissolve — it relocates.** `build_consolidated_relation` never calls `run_steps`, so a Workflow consolidating a _shaped_ query reads its **un-shaped** rows and **materializes them to parquet** ([query_engine.py:446](../../../workspace/apps/backend/app/query_engine.py#L446)).                                                                                                                                                                             | R167        |
| **E** | **The data cleanup costs nothing on this DB** — 10 saved queries, **zero** composed; the `workflows` table is empty (direct read of `data/app.sqlite`, 2026-08-13).                                                                                                                                                                                                                                                                                                           | R166 + R167 |

**Finding E is what makes this round safe to run first.** Withdrawing an affordance nobody's saved
work depends on is a UI change, not a migration.

### D — the design gate

- [x] **Specify Duplicate in the design corpus** ([[d-gate-artifact-in-design-corpus]]), under
      [`queries/`](../../design/data-management/queries/). Labels are already settled by the human
      (**Duplicate** / **Tạo bản sao**; default name `{{name}} (copy)` / `{{name}} (bản sao)`).
- [x] **Close the modal title** — a third display context, per [[labels-context-and-locale-aware]].
      The bare verb is right for the header button and wrong for a title.
- [x] **Decide whether the deep copy reuses `qrel_` ids verbatim or mints fresh ones.** They are
      query-local, so both are correct; pick one and say why.
- [x] **Decide what Duplicate does with a base whose `sourceId` is a `qr_`** — impossible to create
      after R167 and absent from this DB (finding E), but the copy path must not be undefined for a
      round.
- [x] **Confirm Duplicate needs no contract change.** `CreateQueryBody` is
      `{sourceId, name, definition}`
      ([queries.py:94](../../../workspace/apps/backend/app/routers/queries.py#L94)) — exactly what
      Duplicate posts. **Verified before this plan was written**, and it is the premise the whole
      layer split rests on: if it turns out false, the split is wrong, not the round.
- [x] **Write the removal list from the code, not from a grep.** The counted surface:

      | File | Hits | Fate |
      | --- | --- | --- |
      | `QueryCanvas.tsx` | 29 | `qr_` node rendering, wide-source column expansion, column→leaf provenance, non-promotable `qr_`-side edge, unavailable-`qr_` state |
      | `joinGraph.ts` | 14 | left-provenance resolution for a `qr_` operand |
      | `useQueryBuilder.ts` | 12 | base-source state |
      | `types.ts` | 9 | `baseSourceId`, `qr_` node kinds |
      | `mocks/handlers.ts` | 7 | MSW must stop serving what the FE stops asking for |
      | `QueryDetailPage.tsx` | 4 | `[Build on this query]` → replaced by `[Duplicate]` |
      | `JoinEditor.tsx` | 4 | `qr_`-right affordance |
      | `QueryCreatePage.tsx` | 180 LOC | **deleted whole**, with the `/data-management/queries/new` route ([main.tsx:110](../../../workspace/apps/builder/src/main.tsx#L110)) |

      **The trap: not every `qr_` in the FE is composition.**
      `features/dashboard/wire.ts` and `features/data-management/workflows/types.ts` reference
      `qr_` as a **consumer** relationship — a widget reads a query, a workflow sources one. Both
      **stay**. A grep-driven removal would break the dashboard.

- [x] **Decide what replaces entry point #2 in the canvas** — nothing, deliberately (the human's
      2026-08-10 call). The gate's job is the **wording**: a user who reaches for "Saved queries"
      in the source picker should meet an absence that reads as a boundary, not as a missing
      feature. D4's standing rule applies — _unofferable at the gesture, never an error at run_.
- [x] **Run [`ux-design`](../../skills/ux-design/SKILL.md) in design-spec mode** on the Duplicate
      spec. Cheap, and R164's evidence is that it finds **absences** a build review cannot.
- [x] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md) at the Design exit** and record
      the chain in the Do log. **Expect DCFBI** — a button plus a name modal reusing
      `SaveQueryModal` is not a new interaction pattern, and most of the round is deletion. If it
      returns DFCFBI, the standing [[dfcfbi-two-round-split]] applies and the program renumbers
      again.
- [x] **Write the acceptance-walk questions at D**, not at I ([[walk-record-always-spec-on-ask]]).
      This round's rebuild: duplicate a **shaped** query (steps and all), modify the copy, confirm
      the original is untouched and both return the rows they should.

### After D

F → I per the recorded chain. **No C and no B** — that is the layer split, and if either turns out
to be needed, the split was drawn in the wrong place and this plan should be re-cut rather than
widened. The acceptance bar is unchanged: **the human runs the app**
([[dfcfbi-f1-needs-human-review]]), because MSW and vitest cannot see whether Duplicate feels like
the thing they wanted.

### Explicitly NOT in this round

- **Every engine and contract change** — `rightSourceId: SourceId → DsId`, narrowing the `qr_`
  branch, retiring `composition_cycle`, collapsing D2's set-overlap check, fixing D1 in the
  workflow consolidation path, the migration stance, and the 14-doc `design-sync`. All
  `Round_167`.
- **Closing D5 in `_noun-model.md`.** The engine still accepts `qr_` operands after this round;
  D5's surface-entry-point table is updated to say _withdrawn at R166, engine retires at R167_, and
  the debt itself closes there. **Withdrawing an affordance is not retiring a capability**, and the
  doc must not claim otherwise for a round.
- **What a Workflow is** — program item 4, now `Round_168`.
- **The batched UI cluster** — R165's W-1 (the `derive` operand toggle) and W-2 (a dead backend
  reads as a rejected step), plus the R157 cluster, stay batched per [[r-ui-bug-fixing-round]].
- **The naming/legibility cluster** parked by the human at R163.

## Risks / unknowns

| Risk                                                                                                                                             | Why it matters                                                                                                                                                                             | Handling                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Duplicate serves no observed need.** The program plan says so itself: R160's dogfood used composition to _join_ two queries, not to clone one. | Building an unwanted affordance is what [[probe-desirability-before-additive-depth]] warns about, and that lesson was earned by a round that shipped green then reverted.                  | **This round is the probe.** The human wants the feature and does not want to wait for a pull (2026-08-13) — so the question is not _whether_ to build it but whether the built thing lands. The I-gate walk asks. |
| **For one round the engine accepts `qr_` operands that no UI offers.** Shipped exceeds concept.                                                  | It is the state the product is already in, so it is not a regression — but an undocumented gap invites a later reader to call it a bug.                                                    | **Named here, closed at R167.** The API is not a public surface; no saved query uses it (finding E).                                                                                                               |
| **The canvas removal touches 29 sites in one file**, and a grep-driven list would also hit the dashboard's legitimate `qr_` uses.                | R165's pager bug was forty rounds old and only surfaced under hand-use; broad edits break bystanders.                                                                                      | The removal list is written at D from the code, with the consumer-vs-composition distinction explicit. Gates plus the acceptance walk.                                                                             |
| **MSW handlers and fixtures encode composition.** 7 hits in `handlers.ts`, plus `fixtures.ts`.                                                   | [the MSW contract anchor](../../decisions/2026-05-27-msw-contract-anchor.md) — a mock that keeps serving a withdrawn shape lets the FE pass tests for a surface the product no longer has. | Handlers and fixtures are part of the removal list, not a follow-up.                                                                                                                                               |
| **Incidental-order assertions** — R165 found two backend tests asserting row order while testing something else.                                 | A deletion round moves a lot of code under a lot of tests.                                                                                                                                 | R165 left a sweep as a follow-up; it belongs to R167 (the backend round), not here.                                                                                                                                |

## Do

### D gate — the spec, and two calls the human made (2026-08-13)

**The durable artifact is the design corpus, not this section** ([[d-gate-artifact-in-design-corpus]]).
Four docs rewritten in-round:

| Doc                                                                                           | What changed                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`queries/queries.md`](../../design/data-management/queries/queries.md)                       | **§ Duplicate** written (verb · copy rules · invariant · labels · collision · post-copy announcement); § Composed source banner-marked **ENGINE-ONLY, retires R167**; the `/queries/new` route removed from § IA |
| [`queries/query-construction.md`](../../design/data-management/queries/query-construction.md) | **Create mode deleted** — the builder is **edit-only**; `useQueryBuilder` loses its `mode` flag; the source picker's `<OptGroup>`s go flat                                                                       |
| [`queries/canvas.md`](../../design/data-management/queries/canvas.md)                         | `[+ Add a source]` is **datasets only, flat**; § Query (`qr_`) source nodes marked **WITHDRAWN**; acceptance criteria 11–13 retired **by decision**, with the record of why                                      |
| [`_noun-model.md`](../../design/data-management/_noun-model.md)                               | D5's entry-point table gains its per-entry **R166 disposition**; the "open call for the human" is marked **answered**; **D1 and D2 re-dispositioned** (findings D and B)                                         |

**Gates run**: `design:lint` 0 errors / 0 grandfathered across 14 docs · `md:lint` 0 across
310 files · `check:links` all resolve · `plan:lint` 0 across 166 rounds.

**Three specification calls closed at this gate** (the ones the program plan left open):

| Call                     | Decision                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modal title**          | **`Duplicate {{name}}`** / **`Tạo bản sao của {{name}}`** — not the bare verb. Mirrors the register of the page it replaces (`queries.create.title` was `Build on {{name}}`) and names the object. |
| **`qrel_` ids**          | **Reused verbatim, not re-minted.** They are query-local; re-minting buys nothing and costs a rewrite pass over every `joins[].queryRelId`. It also **preserves the deep-equality invariant**.     |
| **A `qr_`-sourced base** | **Copied verbatim, no special case.** None exist (`data/app.sqlite`, 2026-08-13); a refusal state for zero rows buys an explanation nobody needs. R167's migration covers base and copy uniformly. |

**`ux-design` (design-spec mode) — 2 gaps, 1 dissolved, 1 accepted, 1 settled by reuse.**

- **Gap 3 (catalog-row `aria-label`) dissolved — the spec had invented a surface.** It said
  `[Duplicate]` sits "on each catalog row's action set"; the Queries catalog has **no per-row
  action column** — a row is entirely click-to-open. The finding was real, its remedy was not:
  the fix is not a label, it is **not adding the column**.
- **Gap 1 (the second duplicate always collides) — ACCEPTED, not closed** (human). `{{name}} (copy)`
  twice ⇒ guaranteed `409 name_taken`, rendered as the inline field error `SaveQueryModal` already
  has. Two alternatives (pre-flight suffix · recover-on-409) were specified and declined as not
  worth their copy and code for a second-use annoyance with an obvious escape. **Revisit trigger**:
  the walk finds duplicating twice is common rather than incidental.
- **Gap 2 (post-copy announcement) — settled by reuse, no call needed.** `message.success` then
  `navigate`, the exact pair "Save filters as Query" has shipped since R69. One thing made
  explicit: the toast names the **copy's** name, and the **navigation is the significant event**.

**Human calls (2026-08-13)**: `[Duplicate]` lives on the **detail header only** — catalog row
actions are a cross-catalog question that belongs with the R157 UX cluster; and the collision
stays an inline error.

**One `ux-design` non-gap worth keeping**: the canvas's withdrawn "Saved queries" group is specified
as **an absence with no explanation**, and the skill graded that _correct_ — an explanation would
advertise a capability the product does not have. D4's rule applied, not merely cited.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired?  | Justification                                                                                                                                                                        |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. >3 independent states/branches    | **no**  | Name-capture → saving → (201 navigate \| 409 inline error), plus Cancel — three branches, all of them states `SaveQueryModal` already ships. The withdrawal half **removes** states. |
| 2. New interaction pattern           | **no**  | Verb → name modal → `POST` → navigate is the "Save filters as Query" rhythm, shipped since R69 through the **same component and mutation**.                                          |
| 3. High user-error risk              | **no**  | Additive and reversible — a duplicate creates a new artifact, never mutates the base; the worst outcome is an extra query the user deletes. Nothing commits irreversibly.            |
| 4. Contract depends on unresolved UI | **no**  | Verified before the plan: `CreateQueryBody` is already `{sourceId, name, definition}`. There is no contract change to shape.                                                         |
| 5. UX confidence below threshold     | **yes** | The round's own _Falsified if_ is a UX question left open at Design exit — whether Duplicate serves the need at all rests on inference, not observation (the program plan's caveat). |

Result: **Flow: DCFBI** (1 of 5 — DFCFBI needs 2)

**Reading the chain honestly**: DCFBI's **C and B are empty by construction** here, not skipped —
the round is contract-safe and touches no engine, which is the layer split. The executed chain is
**D → F → I**. If a C or a B turns out to be needed, that is the signal the split was cut in the
wrong place, and the plan says to re-cut rather than widen.

### Acceptance-walk questions — written at D, not improvised at I

Per [[walk-record-always-spec-on-ask]]: the questions and their ⬜ verdicts belong to the round
now; exact steps only if asked. **`coverage: 0 of 5`** until the walk runs.

| #      | Question                                                                                                                                         | Verdict |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **T1** | Duplicate a **shaped** query (steps and all), modify the copy — is the original untouched, and do both return the rows they should?              | ⬜      |
| **T2** | Does `[Duplicate]` read as _independent_ rather than _linked_ — i.e. does the copy behave the way the header button led you to expect?           | ⬜      |
| **T3** | Duplicate the same query twice. Is the inline name-taken error a recoverable annoyance, or the thing that makes you stop using the feature?      | ⬜      |
| **T4** | Go looking for a way to join two saved queries. Does the absence read as a boundary, or as something broken/missing?                             | ⬜      |
| **T5** | Was Duplicate the thing you actually wanted? (the honest caveat — the program plan says no recorded clone need exists; this is where that lands) | ⬜      |

**T5 is the round's falsification test, and a "no" is a successful outcome**, not a failed round —
it means R167 gets rewritten before the engine is touched, which is exactly why this half went
first.

### F gate — the build (2026-08-14)

**One fork the round's own artifacts disagreed on, resolved by the human before any code moved.**
The Plan's removal table reads as though the canvas's **whole** `qr_` treatment leaves here (29
sites); [`canvas.md`](../../design/data-management/queries/canvas.md) — the **durable** D-gate
artifact — says the opposite three times (_"WITHDRAWN at R166, code retires at R167"_, _"retained
as current-state code"_, _"described because the code still carries it"_). **Human's call
(2026-08-14): follow `canvas.md`.** R166 withdraws the **offering**; R167 deletes the rendering
**with** the engine, in one place. So a pre-R166 `qr_`-sourced query still renders while the
engine still runs it — shipped and concept stay in step for the one round the split costs.

**What left, what arrived** — the FE is net-negative as the round promised:

| Out                                                                            | LOC   |
| ------------------------------------------------------------------------------ | ----- |
| `QueryCreatePage.tsx`, deleted whole + its `/data-management/queries/new` route | ~181  |
| `useQueryBuilder`'s create mode (`isCreate` · `createBase` · `createWithName` · `onCreated` · `createError`) and the **`baseSourceId` state**, now a derived read of `query.sourceId` | ~55   |
| `JoinEditor`'s `qr_` base options + the `queryId` / `onSetBaseSource` / `baseEditable` props | ~25   |
| `QueryCanvas`'s `stageableQueries` + both `<OptGroup>`s                        | ~20   |
| `queries.create.*` (11 keys) · `detail.buildOnThis` · the four group labels — **EN and VN** | ~28   |
| the R77 create-mode test block                                                 | ~96   |
| **In**: `[Duplicate]` + `submitDuplicate` + the modal mount; `SaveQueryModal`'s `title` + `selectNameOnOpen`; `queries.duplicate.*` (4 keys × 2 locales); 4 tests | **~150** |

**Three build decisions worth the record**:

- **The deep copy is `JSON.parse(JSON.stringify(...))`**, not a hand-walked clone. It is the wire
  shape by construction, which is exactly what makes the **deep-equality invariant** assertable —
  and the test asserts it directly (`posted.definition` `toEqual` the base's), rather than
  spot-checking fields a hand-walk could miss.
- **The base picker stayed, disabled and flat** rather than being deleted. It still tells the user
  what a query reads from; what it no longer does is offer to change it — which it hadn't since
  R94 (D6) in edit mode anyway. With create mode gone there is no mode in which it is editable.
- **`selectNameOnOpen` is a new prop, not new behaviour for everyone.** `autoFocus` leaves the
  caret at the end; the spec asks for the default **selected** so accepting is one keystroke and
  overtyping needs no clearing gesture. Making that universal would have changed "Save filters as
  Query" as a side effect, so it is opt-in.

**Gates**: `tsc --noEmit` clean (and clean again under `--noUnusedLocals --noUnusedParameters`,
so nothing was orphaned) · **vitest 368/368 across 26 files** — including the i18n EN/VN parity
suite and the contract validator · `design:lint` 0/0 across 14 docs · `design:tokens` 0 across
11 maps · `plan:lint` 0 across 166 rounds · `md:lint` 0 across 310 files · `check:links` at
**exact parity with the pre-build baseline** (which is itself non-zero — 25 stale links in
historical round docs, pre-existing). Deleting `QueryCreatePage.tsx` broke two of those historical
citations (R94, R162); both were de-linked to plain text naming where the file went, so the round
adds **no** new breakage.

**No C and no B ran** — the layer split held. `CreateQueryBody` was already
`{sourceId, name, definition}`, so Duplicate needed no contract change and no engine change, which
was the premise the whole split rested on. **The design corpus needed no re-sync**: the four docs
rewritten at D describe what shipped.

_(I gate next — the human runs the app. Gates cannot see whether Duplicate is the thing they
wanted; that is T5.)_

## Check

**Gates are green and that settles nothing about this round's question.** R165's dogfood is the
standing evidence: 5 of 5 walk questions passed and the walk still turned up **six** defects after
every gate was green, one of them a **forty-round-old** pager bug. Vitest and MSW cannot see
whether Duplicate is the thing the human wanted — which is this round's entire falsification test.

**Acceptance walk — run by the human 2026-08-14. `coverage: 5 of 5.`** Questions were written at
D ([[walk-record-always-spec-on-ask]]), not improvised here; exact steps on request.

| #      | Question                                                                                                                                         | Verdict                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| **T1** | Duplicate a **shaped** query (steps and all), modify the copy — is the original untouched, and do both return the rows they should?              | ✅ **pass — 1 defect (W-1)** |
| **T2** | Does `[Duplicate]` read as _independent_ rather than _linked_ — i.e. does the copy behave the way the header button led you to expect?           | ✅ pass                     |
| **T3** | Duplicate the same query twice. Is the inline name-taken error a recoverable annoyance, or the thing that makes you stop using the feature?      | ✅ pass — **note N-1**      |
| **T4** | Go looking for a way to join two saved queries. Does the absence read as a boundary, or as something broken/missing?                             | ✅ pass — _"don't see it from UI"_ |
| **T5** | Was Duplicate the thing you actually wanted?                                                                                                    | ✅ **"yes, that's what I think and expected"** |

**T5 is the round's falsification test and it held.** The program plan's _honest caveat_ — that no
recorded instance of a clone need existed — is now answered by hand-use rather than inference, and
**R167 proceeds as planned instead of being rewritten**. That answer is the one thing this half
could hand the engine half that no gate could produce.

**T4 read as a boundary, not a break.** The human went looking and reported simply that there is no
way to it from the UI — no report of anything seeming broken or missing, which is what the
absence-with-no-explanation call (D4) was betting on. Withdrawing the affordance did **not** re-block
a real question: the within-group family covers the need it served.

### W-1 — header action order (T1), fixed in-round

**Found**: the header shipped `[Duplicate] [Edit] [Delete]`. **The human's rule**: `[Edit]`
highest use → first; `[Duplicate]` less → second; `[Delete]` last so its **distance** guards
against a wrong click. **Fixed** to `[Edit] [Duplicate] [Delete]`, with a test locking the order.

**The cause is the instructive part, and it is a doc lesson, not a code one.** This round's own
[`queries.md`](../../design/data-management/queries/queries.md) layout ASCII had drawn
`[Duplicate] [Edit] [Delete]`. The build followed the picture — and in doing so **regressed an
ordering the shipped page already had right** (`[Edit] [Build on this query] [Delete]`). Nobody
decided to put Duplicate first; a sketch drawn to show _which buttons exist_ silently answered
_in which order_, and the D gate reviewed the words beside it, not the picture. **An ASCII sketch
carries a decision whether or not it was making one.** The rule now sits in prose next to the
picture, where a reviewer can disagree with it.

### N-1 — `abc (copy) (copy)` (T3), accepted

Duplicating a **copy** suffixes again. It does not collide, it is the plain consequence of the one
default-name rule, and the human judged it **acceptable**. Recorded in the spec so a later reader
meets a decided behaviour rather than an unhandled edge — and so nobody "fixes" it into a
`(copy 2)` parser, which is the same locale-correct-in-EN-and-VN complexity already rejected for
the collision case, bought for a smaller annoyance. **T3's revisit trigger did not fire.**

### The seed the walk ran on

The human switched to the **light** seed first, to verify numbers by hand, and asked whether it
covered enough — a good question that turned up **two real gaps**, fixed before the walk
(`5a896f4`): the seed had **no** `group_column` / `window_column` example in _either_ mode (every
shaped query in it collapsed rows), and light was too shallow to page. Light is now **15/120/80**,
chosen at the knee of a measured curve. The measurement produced a finding worth keeping:

> **"Bolder" is not monotonically better.** `prior_period` must return NULL for a **missing**
> period rather than the wrong period's value — and a dense table has no missing periods to prove
> it on. At the **full** volume, **zero** order statuses have an interior month gap; at light,
> three of four do. Light detects *less* of anything volume-driven and **more** of anything
> sparsity-driven, so it is **not a subset** of full and a green light run must not be read as
> covering it.

**How to read the outcomes**, decided in advance so the result cannot be rationalised after it
arrives:

- **T5 = no is a SUCCESS**, not a failed round. It means R167 gets **rewritten before the engine is
  touched** — which is the whole reason this half went first ([[probe-desirability-before-additive-depth]]).
- **T3 = "makes me stop using it"** fires the revisit trigger the D gate recorded when it accepted
  the collision. The two declined alternatives (pre-flight suffix · recover-on-409) are already
  specified in [queries.md § The second duplicate collides](../../design/data-management/queries/queries.md).
- **T4 = "broken/missing"** falsifies the _absence-with-no-explanation_ call, and D4's rule needs
  re-opening rather than the copy being patched.
- **T1 is the only question a test could have answered**, and it is here anyway because the
  invariant holding on MSW fixtures is not the same claim as it holding on the human's real data.

## Act

**The round's own claim held**: no surface offers building a query on a query, the variant need is
met by Duplicate, and the FE is net-negative (~405 LOC out, ~150 in). No _Falsified if_ condition
fired — Duplicate served the need (T5), the withdrawal re-blocked nothing (T4), and the removal
needed no wire change, so the layer split was cut in the right place.

**Kept for R167** (unchanged by the walk): findings **A–E**, the `qr_` rendering the human ruled
stays until it retires **with** the engine, and the 14-doc `design-sync` outstanding since R162.
R167 now starts knowing Duplicate lands — which is the only thing this half could tell it.

**Two lessons, one candidate promotion.**

1. **An ASCII sketch carries a decision whether or not it was making one** (W-1). Design docs here
   are source code, and a picture is the part reviewers skim. Where a sketch shows an arrangement,
   state the rule in prose beside it — otherwise the picture becomes the rule and a build that
   follows the doc faithfully can regress something the code already had right. **Candidate for
   `memory/`**, and the sharper cousin of [[design-docs-are-source-code]]: it is not enough for a
   doc to be code-true, its _sketches_ must be reviewed as claims.
2. **A dogfooding seed is not a volume knob** (the seed work). Sparsity and volume detect
   **different** defect classes, so "smaller = weaker" is wrong — the full seed cannot exercise
   `prior_period`'s gap contract at all. When a mode exists for hand-verification, say what it
   detects **better**, not only what it gives up.

**Deferred, deliberately.** Generalising W-1's ordering rule to every detail header is a
cross-surface question and belongs with the **R157 UX cluster**, alongside the catalog-row-actions
question the D gate sent there — not invented here for one page ([[batch-ui-bugs-into-one-round]]
in spirit: don't fix a cross-cutting UI convention piecemeal mid-feature).

**Still parked, untouched by this round**: R165's W-1/W-2, the R157 UX cluster, the naming
/legibility cluster, `[F-prov-reimport-choice]`, AI-propose-key #2, R145 1b, Export ④.

## Feeds into → Round_167 (composition retired in the engine)

Program item 3b — the engine half, whose scope is findings **A–E** above plus the human's
2026-08-13 decisions: narrow `resolve_source`'s `qr_` branch to Workflow's reader rather than
deleting it; fix D1 in the workflow consolidation path; fold in the 14-doc `design-sync` of
`data-management/`, outstanding since R162, so it syncs the final state once rather than twice.
This round hands R167 one thing it cannot get any other way: **whether Duplicate actually serves
the need**, answered by hand before the engine is touched.
