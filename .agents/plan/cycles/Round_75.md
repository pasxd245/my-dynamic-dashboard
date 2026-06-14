# Round 75: Left / outer joins — keep unmatched rows, not just inner matches

**Status**: Planning
**Date started**: 2026-06-14

## Goal

**Inherits from ← [Round_74](Round_74.md)** — R74 shipped the **join graph (tree)**:
a Query can join one dataset to two or more others, edited in the hop-list builder.
Every join R71→R74 executes is an **inner** join: a row survives only if it matches
on **every** hop. So a Query **silently drops** unmatched rows — "all Deals, with
their owner **if any**" is **inexpressible** today; an ownerless Deal vanishes.

R75 fills the [query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
step **"R75 left / outer joins"** — widen each hop's **`type`** beyond `inner`
(left / right / full outer) so a relationship can be **expressed**, not just used to
**filter**. It is the **first join semantic past inner**.

**Why this round, not the canvas or a row-explosion guard (the pull check).** R74's
trajectory named the **visual canvas** next, but its trigger ("the hop-list stops
scaling") **has not fired** — building it now is building ahead of the pull. A
**row-explosion guard** was considered and **dropped**: a join that multiplies rows
produces the **truthful** product of the declared relationships, live re-run and
read-only — runtime cost / report-drift are a **consumer-side** concern (the
worksheet that *loads* the connection), not the Query definition's (the
**Query-is-a-connection-not-a-load** principle, user — R75 scoping). Left/outer joins, by
contrast, **strengthen how a relationship is expressed** — a real, pulled gap
(inner-only drops rows a consumer wants). _The model needs no re-open:_ `JoinStep`
**already carries `type`** as a query-time choice
([joins.md § truth-test](../../design/data-management/queries/joins.md): "join type …
correctly a query-time choice, belongs in the join step, not the edge") — R75 only
**widens the enum** + the engine's JOIN keyword + a builder picker.

_Track: 1 (product feature). Pulled by ← R71's named "left/right/outer joins"
deferral ([joins.md § Scope](../../design/data-management/queries/joins.md)) + the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)

+ the user's "express the relationship, don't guard consumption" framing (R75
scoping). Scoped by the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
and "one feature per round": the **per-hop join `type`** only — composite keys,
self-joins, cross-workspace joins, and the visual canvas stay deferred with their
standing triggers._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-14)

| #    | Question          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-0  | **Round topic**   | **Left / outer joins** (ratified). A **row-explosion guard was dropped** — it had no problem to solve (the multiplied result is the truthful product of declared relationships; cost/drift is consumer-side, per the **Query-is-a-connection-not-a-load** principle). The **visual canvas** stays deferred (its "hop-list stops scaling" trigger has not fired). Order going forward: **left/outer → Query × Query → canvas**.                  |
| J-1  | **Scope** of R75  | **Per-hop join `type`: `inner` (default) + `left` + `right` + `full` outer** (ratified). One capability — once the engine emits an outer `JOIN`, the three variants are nearly free; `inner` stays the default so every R71→R74 Query is unchanged. A graph may **mix** inner + outer hops. **Out:** composite/multi-column keys, self-joins, cross-workspace, the canvas — standing triggers hold; R75 keeps **single-column, within-workspace** hops. |
| J-2  | **Round shape**   | **Run straight through** (ratified) — Plan → Design → build, no Design-gate STOP. Like R74, R75 **widens an existing field** (`JoinStep.type`) rather than re-opening the model, so R73's model-altitude STOP is not pulled; per-gate commits stay the revert seams. The model-confidence valve still runs at Design to *confirm* (the type truth-test: the edge already declines to own `type`).                                |

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                              | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **NULL semantics + predicate/effective-column behaviour** | An outer join introduces **NULLs** on the unmatched side. The design must state: how the effective-column cells render the NULLs (the VARCHAR cast → `None` → the existing `<PagedRowsView>` blank), how the **reused predicate engine** behaves over a now-nullable column (standard SQL: `equals`/`contains` don't match NULL; a future `is_empty` is a separate trigger), and how a **multi-hop tree mixes** inner + outer hops (each hop's `type` applies to its own edge in the fold). Lean: reuse everything; NULLs are just absent cells; no predicate change. |
| J-4 | **Doc home + the builder type-picker** | **Home:** extend [joins.md](../../design/data-management/queries/joins.md) (the per-edge join *semantic* lives there; [multi-join.md](../../design/data-management/queries/multi-join.md)'s fold *consumes* the per-hop type) vs. a new doc. **Affordance:** a **join-type `<Select>`** per hop (inner default) in the `JoinEditor`; the read summary shows `⋈ left ⋈` etc. **Contract:** the `JoinStep.type` enum **widens** (a real shape change, unlike R74). Lean: extend joins.md; per-hop type `<Select>`; widen the enum. Sealed at Design (home/mechanism free to deviate — [build-first](../../memory/2026-05-22-ui-boundary-build-first.md)).            |

**Invariant (the R69→R74 anti-duplication rule):** R75 **reuses** R74's hop-list
builder, the `query_joined_rows` fold, the predicate/run engines, and `<PagedRowsView>`
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)); the
**only** new work is the widened `type` enum, the per-hop JOIN-keyword choice in the
fold, and a type `<Select>` — named honestly, not laundered through "reuse".

## Plan (by gate)

1. **Plan gate** — ratify J-0, J-1, J-2; record J-3, J-4 held open. Commit the
   ratified round file (Plan seam).
2. **Design gate — extend the join design:** the widened `type` enum, the per-hop
   JOIN-keyword in the fold, the NULL/effective-column semantics (J-3), the builder
   type-picker (J-4), the (widened) contract intent, the states, Accessibility. Run
   the model-confidence valve (the **type truth-test**: the edge already declines to
   own `type` — confirmed). Each acceptance criterion → ≥1 future test. Update
   [joins.md](../../design/data-management/queries/joins.md) +
   [multi-join.md](../../design/data-management/queries/multi-join.md) (the fold
   consumes per-hop type).
3. **Design-gate verification** — type truth-test recorded; noun-vs-mode +
   discovered-vs-imposed; `ui-design` (design-spec); `design:lint` / `design:tokens` /
   `plan:lint` / `markdown-check-link`; `gate-walker`; run `flow-selector`; **continue**
   (J-2).

## Acceptance criteria

+ [ ] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [ ] **Join-type design authored** (home per J-4): the widened `JoinStep.type` enum,
      the per-hop JOIN keyword in the fold, the NULL/effective-column + predicate
      semantics (J-3), the builder type-picker, the states, Accessibility, the
      (widened) contract intent.
+ [ ] **Model-confidence valve invoked to confirm**: the **type truth-test** records
      that the governed edge already **declines to own `type`** (R71's verdict), so
      only the enum + engine keyword + builder picker widen — no edge/model re-open,
      no new noun.
+ [ ] **Noun-vs-mode passes**: the type-picker extends R74's `JoinEditor`; no parallel
      page, no re-invented engine.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken, `markdownlint` 0; `ui-design` (design-spec) PASS;
      `gate-walker` confirms the Design exit.
+ [ ] **Build chain green** (per `flow-selector`): Contract (widen the `type` enum),
      Frontend (type `<Select>` + outer-join preview), Backend (per-hop outer JOIN
      keyword in the fold), Integration (one contract / dual conformance + a left-join
      lifecycle keeping unmatched rows).
+ [ ] Each gate **committed separately**; **Complete = human-signed-off** (ran the app
      against the real backend, exercised a left join that keeps an unmatched row).

## What is OUT of scope

+ **Composite / multi-column join keys; self-joins; cross-workspace joins** — standing
  R70/R71 triggers hold; R75 keeps single-column, within-workspace hops.
+ **Query × Query composition** (a Query as a join input) + the unified `ds_`/`qr_`
  resolver → next (the agreed order: after R75).
+ **The free-form visual builder canvas** → later (its "hop-list stops scaling" trigger
  has not fired).
+ **A row-explosion guard / aggregation / dedup / materialization** → **not built**: a
  multiplied result is the truthful product of declared relationships; cost/drift is a
  **consumer-side** concern, not the Query's
  (the **Query-is-a-connection-not-a-load** principle).
+ **`is_empty` / null-aware predicate operators** — an outer join makes NULLs visible;
  a predicate that *matches* NULLs is a separate, named future trigger.

## Risks / unknowns

+ **NULL handling in the effective space + predicates.** Outer joins introduce NULLs;
  the VARCHAR-cast → `None` → blank cell must render cleanly, and the reused predicate
  fragment builders must behave (standard SQL: `equals`/`contains` exclude NULL).
  _Mitigation: the design states the NULL semantics; a pytest asserts an unmatched row
  appears with blanks and that a predicate over the nullable side behaves as SQL does._
+ **Mixing inner + outer hops in a tree.** A graph may mix types per hop; the fold must
  emit the right keyword **per hop**, not globally. _Mitigation: `join_keys`/the fold
  carries a per-hop `type`; a test mixes an inner hop and a left hop._
+ **Contract enum widening is a real shape change** (unlike R74). _Mitigation: the
  Contract gate widens `JoinStep.type`; OpenAPI validity + dual conformance re-checked;
  `inner` default keeps every stored R71→R74 definition valid._
+ **`full`/`right` outer semantics at the driving source.** `right`/`full` can keep
  rows with no driving-source match (NULLs on the left). _Mitigation: the design states
  each variant's row-keeping rule; tests cover left (keep-left) explicitly; right/full
  are the symmetric/union cases._

## Do

### Plan-gate ratification (2026-06-14)

+ **J-0 → Left/outer joins**; row-explosion guard **dropped** (no problem to solve —
  consumer-side concern per the Query-is-a-connection-not-a-load principle); canvas deferred
  (trigger unfired). Order: left/outer → Query × Query → canvas.
+ **J-1 → per-hop `type`: inner (default) + left + right + full outer** — one
  capability; `inner` default keeps R71→R74 unchanged; a graph may mix types.
+ **J-2 → Run straight through** — widens an existing field, no model re-open; per-gate
  commits are the revert seams; the type truth-test confirms at Design.
+ **J-3 → NULL semantics + predicate/effective-column behaviour held open** for Design.
+ **J-4 → home (extend joins.md) + builder type-picker + enum widening held open** for
  Design.
+ **Invariant:** reuse R74's builder + the fold + the predicate/run engines; the only
  new work is the widened enum + the per-hop JOIN keyword + the type `<Select>`.

### Gate 2 — Design pass (2026-06-14)

**Docs touched:** extended [joins.md](../../design/data-management/queries/joins.md)
(J-4 → extend the per-edge join-semantic doc, not fork) with a **§ R75 outer join
types** section: the widened `JoinStep.type` enum, the **type truth-test** (the edge
already declines to own `type` — R71's verdict), the per-hop JOIN keyword in the fold,
the **NULL semantics + reused-predicate behaviour** (J-3), the builder type-`<Select>`

+ its Accessibility, and the (widened) contract intent. The row-explosion-guard line
was reconciled to "**dropped** (consumer-side concern)".

**J-3 + J-4 resolved:** J-3 → reuse everything; NULLs become blank cells (the VARCHAR
cast → `None`), the predicate builders behave as standard SQL (exclude NULL), a graph
mixes per-hop types; null-aware operators (`is_empty`) are a separate future trigger.
J-4 → extend joins.md; per-hop type `<Select>` (default inner); the `JoinStep.type`
enum widens (a real contract shape change, unlike R74).

**Model check:** **noun-vs-mode** — the type-picker extends R74's `JoinEditor`; no
parallel page, no new noun. **Discovered-vs-imposed** — _discovered_: inner-only
silently drops unmatched rows a consumer wants (a real expression gap); nothing minted.
**Model-confidence valve INVOKED to confirm** — the **type truth-test** records that
`type` is a query-time choice the **edge already declines to own** (R71's sealed
verdict), so only the enum + engine keyword + builder picker widen — no edge/model
re-open, the R74 "widen a field, don't re-model" pattern a second time.

**`ui-design` (design-spec) on the § R75 type-picker — PASS (0 gaps).** All six facets
pass; one **Accessibility** gap caught preventively (the new type `<Select>` had no
declared accessible name) and **remediated in-spec** (a labelled _"Join type"_ select
in focus order, text options). Mirrors R71–R74's preventive catches.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                              |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The state model is R74's (Loading → Populated/HopStale/PredStale/NotFound; Editing → add/remove/edit-pred/**set-type**; Saving → SaveRejected). |
| 2. New interaction pattern           | no     | A per-hop join-type `<Select>` is a standard AntD select on R74's shipped hop-row — not a new pattern.                                     |
| 3. High user-error risk              | no     | Reversible (re-pick / discard); reads non-destructive; an outer join keeps **more** rows, never deletes.                                  |
| 4. Contract depends on unresolved UI | no     | The four enum values (inner/left/right/full) are settled; the contract widen is not UI-dependent.                                          |
| 5. UX confidence below threshold     | no     | A type `<Select>` on the already human-reviewed builder; the only subtlety (blanks = no match) is text-legible.                            |

Result: **Flow: DCFBI** (1 of 5). Build chain **C → F → B → I**; the human still runs
the app before Review + signs off before Complete (the visual-verification gate).

**`gate-walker` (Design gate): PASS** — the round + joins.md record the Design exit
criterion (the § R75 journey + R75 acceptance criteria), the noun-vs-mode +
discovered-vs-imposed check + the invoked model-confidence valve (the type truth-test),
and the Design commit seam. _Structural check only — the modelling answer's correctness
is the human reviewer's call._

**Design gate closed (J-2: run straight through).** Gate seams: Plan `091c220` →
Design (this commit). Build proceeds C → F → B → I without a STOP.

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [x] **Join-type design authored** ([joins.md § R75](../../design/data-management/queries/joins.md#r75-outer-join-types)): widened `type` enum, per-hop JOIN keyword, NULL semantics, type-`<Select>`, contract intent.
+ [x] **Model-confidence valve + type truth-test recorded** — `type` is a query-time choice the edge declines to own (R71's verdict); only the enum + engine keyword + picker widen.
+ [x] **Noun-vs-mode + discovered-vs-imposed** check recorded (mode not page; discovered — inner-only drops rows a consumer wants).
+ [x] `design:lint` 0 (15 docs) · `design:tokens` 0 (12 maps) · `plan:lint` 0 · `markdown-check-link` 0 broken · `markdownlint` 0.
+ [x] `ui-design` (design-spec) on the type-picker surface — **PASS, 0 gaps** (one Accessibility gap caught + remediated in-spec: the type `<Select>` accessible name).
+ [x] `flow-selector` run + result recorded — **DCFBI** (1 of 5).
+ [x] **`gate-walker` (Design gate)** — exit criterion + model checks + commit seam recorded.
+ [ ] **Build chain green**: Contract + Frontend + Backend + Integration, each a seam.
+ [ ] **Human sign-off** — ran the app against the real backend + exercised a left join
      keeping an unmatched row (Complete = signed-off, not gates-green).

## Act

_Pending — filled at round close._

## Feeds into → Query × Query composition (next), then the visual canvas

The agreed order after R75 is **Query × Query composition** (a Query as a join input,
unlocking the unified `ds_`/`qr_` table-source resolver R71 deferred as J-2′), then the
**visual join-graph canvas** (deferred until the hop-list + left-source `<Select>`
stops scaling). Composite/multi-column keys, self-joins, cross-workspace joins, and
null-aware (`is_empty`) predicates remain deferred with their named triggers.
