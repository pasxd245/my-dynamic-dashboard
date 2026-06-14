# Round 76: Query × Query composition — let a Query read another Query as a join input

**Status**: Planning
**Date started**: 2026-06-14

## Goal

**Inherits from ← [Round_75](Round_75.md)** — R71→R75 grew the join engine over
**Datasets only**: every join input is a `ds_` parquet source, resolved through a
governed `rel_` edge whose **both endpoints are Datasets**. A **Query cannot yet be a
join input** — so "join my *Won-deals* Query to Accounts" is **inexpressible**, even
though [query-builder.md](../../design/data-management/queries/query-builder.md) declares
a Query is **the same readable-table-source kind as a Dataset**. R76 makes that
declaration real.

R76 fills the [query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
step **"later — Query × Query: a Query as a join input; the unified `ds_`/`qr_`
resolver"** and finally pulls **R71's J-2′ deferral** — the **unified `ds_`/`qr_`
table-source resolver** ([joins.md § route-vs-resolver](../../design/data-management/queries/joins.md),
[query-construction.md § J-2′](../../design/data-management/queries/query-construction.md)).
Until now J-2′ was **not pulled** (join inputs were two Datasets via a `rel_`); composition
is its trigger.

**Why this is NOT another "widen a field" round.** R73 (`join`→`joins`), R74 (path→tree),
and R75 (`type` enum) each **re-confirmed** the model without re-opening it. R76 is
different: a join input is **doubly `ds_`-bound** today — `Query.datasetId` is `^ds_…`
(the single driving source) and each `JoinStep.relationshipId` resolves a `rel_` edge
whose endpoints are **both Datasets**, and the engine's fold is a chain of
`read_parquet(?)`. Admitting a `qr_` source **changes the source-reference shape** and
makes the resolver **recursive** (run the inner Query → rows → feed the join). That is a
genuine **model-altitude** move — the kind R73's doctrine says must STOP at Design for a
human, **not** ride through as a field widening.

_Track: 1 (product feature). Pulled by ← R71's J-2′ unified-resolver deferral, the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into),
and the "a Query is the same readable-table-source kind as a Dataset" anchor. Scoped by
the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) and "one
capability per round": **a Query usable as a join source + the unified resolver** only —
the **visual canvas** stays deferred (its "hop-list stops scaling" trigger has not
fired), and composite keys / self-joins / cross-workspace joins keep their standing
triggers._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-14)

| #   | Question         | Resolution                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-0 | **Round topic**  | **Query × Query composition** (ratified) — a Query usable as a join input, pulling R71's J-2′ unified `ds_`/`qr_` resolver. The **visual canvas** stays deferred (trigger unfired). Order going forward: **Query × Query → canvas**.                                                                                                                                          |
| J-1 | **Composition depth** | **Arbitrary nesting + a cycle guard** (ratified) — a Query may compose a Query that itself composes another, etc.; the resolver **recurses** and a **cycle/self-reference guard** rejects a Query that (transitively) composes itself. Most expressive; the guard is the cost. Single-column, within-workspace sources still hold (composite keys / self-joins / cross-workspace stay deferred). |
| J-2 | **Round shape**  | **Seal-then-STOP at Design** (ratified) — unlike R74/R75, R76 **re-opens the source-reference model** (polymorphic `ds_`/`qr_` ref + a recursive resolver), so R73's model-altitude STOP **is** pulled: the closed design is sealed and a **human reviews the model before any build**. Mirrors R72/R73's seal-then-STOP, not R74/R75's run-straight-through.            |

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                                   | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **Where the `qr_` source attaches + the recursive resolver (the model)** | The model question the STOP reviews. The design must decide: does `Query.datasetId` (`^ds_`) **widen to a polymorphic `sourceRef: ds_\|qr_`** (and/or does a join hop carry the composed source)? Do `rel_` **endpoints stay Dataset-only** (composition expressed by the *source ref*, not the edge — keeping the governed edge's altitude), or can an edge endpoint be a `qr_`? How does the **recursive resolver** run an inner Query → rows and feed the join — a sub-SELECT/CTE over the inner definition vs. materialized rows — and how is the **effective-column space** + the cycle guard computed across a composed source? Lean: a polymorphic **source ref**, `rel_` endpoints stay Dataset-only, the resolver recurses on the definition (no materialization), cycle guard at save + run. |
| J-4 | **Doc home + the builder source-picker + error code** | **Home:** extend [joins.md](../../design/data-management/queries/joins.md) / [query-construction.md](../../design/data-management/queries/query-construction.md) (the resolver + the builder), or a new `composition.md`. **Affordance:** the builder's **left/driving source `<Select>`** now lists **Queries as well as Datasets** (one unified source picker). **Contract:** the source-ref shape change + a new **`cyclic_composition`** (or reuse `cyclic_join`) error code. Lean: extend the existing docs; one unified source `<Select>`; a distinct cycle error. Sealed at Design (home/mechanism free to deviate — [build-first](../../memory/2026-05-22-ui-boundary-build-first.md)). |

**Invariant (the R69→R75 anti-duplication rule):** R76 **reuses** the Query archetype +
catalog + `/queries/{id}` routes, R74's hop-list builder, the `query_joined_rows` fold,
the predicate/run engines, and `<PagedRowsView>`
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)); the
**genuinely new** work is the **polymorphic source ref**, the **recursive `ds_`/`qr_`
resolver** (J-2′), the **cycle guard**, and the unified source `<Select>` — named
honestly, not laundered through "reuse" (the R71 honest-split discipline).

## Plan (by gate)

1. **Plan gate** — ratify J-0, J-1, J-2; record J-3, J-4 held open. Commit the ratified
   round file (Plan seam).
2. **Design gate — author the composition design:** the polymorphic source ref + the
   recursive `ds_`/`qr_` resolver (J-3), the cycle/self-reference guard, the effective-
   column space across a composed source, the unified source-picker (J-4), the (changed)
   contract intent, the states, Accessibility. Run the **model-confidence valve** — and
   because R76 **re-opens the model**, the valve fires on real model surface (the source
   ref + resolver), not just to confirm. Each acceptance criterion → ≥1 future test.
   Update the doc home per J-4 + the [trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into).
3. **Design-gate verification** — noun-vs-mode + discovered-vs-imposed; `ui-design`
   (design-spec); `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link` /
   `markdownlint`; `gate-walker`; run `flow-selector`.
4. **Seal-then-STOP (J-2)** — seal the closed design, commit the Design seam, and **STOP
   for human review of the model** before any build. The build chain (per `flow-selector`)
   resumes only on the human's go-ahead.

## Acceptance criteria

+ [ ] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [ ] **Composition design authored** (home per J-4): the polymorphic `ds_`/`qr_` source
      ref, the recursive resolver (J-2′), the cycle/self-reference guard, the effective-
      column space across a composed source, the unified source-picker, the states,
      Accessibility, the (changed) contract intent.
+ [ ] **Model-confidence valve invoked on the model** (not merely to confirm): the source-
      ref shape + the recursive resolver are the re-opened surface; the design records why
      the chosen shape is right and why `rel_` endpoints stay Dataset-only (or not).
+ [ ] **Noun-vs-mode passes**: the source-picker extends R74's builder; a composed Query
      is the **same readable-table-source kind**, no parallel page, no re-invented engine.
+ [ ] **Cycle guard specified**: a Query that (transitively) composes itself is rejected
      at save **and** run, with a named error code (J-4).
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0,
      `markdown-check-link` 0 broken, `markdownlint` 0; `ui-design` (design-spec) PASS;
      `gate-walker` confirms the Design exit.
+ [ ] **Design sealed + Design seam committed; STOP for human model review** (J-2) — the
      build chain resumes only on the human's go-ahead.
+ [ ] **Build chain green** (per `flow-selector`, after the STOP): Contract (source-ref
      shape + cycle error), Frontend (unified source `<Select>` + composed-source preview),
      Backend (recursive `ds_`/`qr_` resolver + cycle guard), Integration (one contract /
      dual conformance + a Query-composes-Query lifecycle + a cycle-rejection test).
+ [ ] Each gate **committed separately**; **Complete = human-signed-off** (ran the app
      against the real backend, built + ran a Query that joins another Query).

## What is OUT of scope

+ **The free-form visual builder canvas** → later (its "hop-list stops scaling" trigger
  has not fired; a unified source `<Select>` is the R76 affordance).
+ **Composite / multi-column join keys; self-joins; cross-workspace joins** — standing
  R70/R71 triggers hold; R76 keeps single-column, within-workspace sources.
+ **A row-explosion guard / aggregation / dedup / materialization** → **not built** (the
  [Query-is-a-connection-not-a-load](../../memory/2026-06-13-specious-model-lock-in.md)
  principle — a multiplied/composed result is the truthful product of declared
  relationships; cost/drift is a consumer-side concern). The resolver recurses over the
  **definition**, it does not pre-materialize composed Queries unless Design proves a need.
+ **`is_empty` / null-aware predicate operators** — a separate named future trigger (R75).

## Risks / unknowns

+ **The model re-open is the round's center of gravity.** The source-ref shape +
  recursive resolver are real model surface, not a field widening. _Mitigation: J-2's
  seal-then-STOP — a human reviews the closed model before any build; the valve fires on
  the model itself._
+ **Cycle / infinite recursion.** A Query composing itself (directly or transitively)
  must be rejected, not loop forever. _Mitigation: a cycle guard at save **and** run with
  a named error code; an Integration test asserts rejection._
+ **Effective-column space across a composed source.** The inner Query already exposes
  `resolvedColumns`; the outer join must concatenate + qualify across a `qr_` source the
  same way it does a `ds_`. _Mitigation: the design states the rule; a test renders headers
  off a composed source._
+ **Contract source-ref shape change.** Widening `^ds_` to a polymorphic ref is a real
  shape change (like R75's enum, larger). _Mitigation: the Contract gate states the shape;
  additive/back-compatible so every stored R69→R75 definition stays valid; dual conformance
  re-checked._

## Do

### Plan-gate ratification (2026-06-14)

+ **J-0 → Query × Query composition** — a Query usable as a join input; pulls R71's J-2′
  unified `ds_`/`qr_` resolver. Canvas deferred (trigger unfired). Order: Query × Query →
  canvas.
+ **J-1 → arbitrary nesting + a cycle guard** — the resolver recurses; a Query that
  transitively composes itself is rejected. Single-column, within-workspace sources hold.
+ **J-2 → seal-then-STOP at Design** — R76 re-opens the source-reference model (polymorphic
  `ds_`/`qr_` ref + recursive resolver), so R73's model-altitude STOP is pulled; the human
  reviews the model before any build (unlike R74/R75's run-straight-through).
+ **J-3 → the `qr_`-source attachment + recursive resolver held open** for Design.
+ **J-4 → doc home + unified source-picker + cycle error code held open** for Design.
+ **Invariant:** reuse the archetype + catalog + routes + builder + fold + predicate/run
  engines; the genuinely new work is the polymorphic source ref, the recursive resolver,
  the cycle guard, and the unified source `<Select>`.

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [ ] **Composition design authored** (home per J-4): polymorphic source ref, recursive
      resolver, cycle guard, effective-column space, unified source-picker, contract intent.
+ [ ] **Model-confidence valve invoked on the model** — the re-opened source-ref + resolver
      surface, not merely confirmed.
+ [ ] **Noun-vs-mode + discovered-vs-imposed** recorded.
+ [ ] `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · `markdown-check-link` 0 broken ·
      `markdownlint` 0.
+ [ ] `ui-design` (design-spec) on the unified source-picker — PASS.
+ [ ] `flow-selector` run + result recorded.
+ [ ] **`gate-walker` (Design gate)** — exit criterion + model checks + commit seam recorded.
+ [ ] **Design sealed + STOP for human model review** (J-2).
+ [ ] **Build chain green** (after the STOP): C (source-ref + cycle error) · F (unified
      source `<Select>` + composed preview) · B (recursive resolver + cycle guard) · I
      (dual conformance + compose-Query lifecycle + cycle rejection).
+ [ ] **Human sign-off** — ran the app against the real backend + built + ran a Query that
      joins another Query (Complete = signed-off, not gates-green).

## Act

_Pending — filled at round close._ The intended outcome: a Query becomes a first-class
**join input**, the unified `ds_`/`qr_` table-source resolver (R71's J-2′) earns its
place, and "a Query is the same readable-table-source kind as a Dataset" stops being a
declaration and becomes executable. This is the round where the join engine stops being
Dataset-only — the first **model re-open** since R73, run as a seal-then-STOP.

## Feeds into → the visual join-graph canvas (next), then workflow / complex query

After R76, the agreed next step is the **free-form visual join-graph canvas** (drag
nodes / draw edges), still **deferred until the unified source `<Select>` + hop-list
stops scaling**. Composite/multi-column keys, self-joins, cross-workspace joins, and
null-aware (`is_empty`) predicates remain deferred with their named triggers; **workflow /
complex query** (YAML + polars) stays the longer-horizon trajectory item.
