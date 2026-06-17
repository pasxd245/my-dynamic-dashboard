# Round 76: Query × Query composition — let a Query read another Query as a join input

**Status**: Complete
**Date started**: 2026-06-14
**Date completed**: 2026-06-15
**Flow**: DFCFBI (triggers 1, 5 — set at the Design gate, locked)

## Goal

**Inherits from ← [Round_75](Round_75.md)** — R71→R75 grew the join engine over
**Datasets only**: every join input is a `ds_` parquet source, resolved through a
governed `rel_` edge whose **both endpoints are Datasets**. A **Query cannot yet be a
join input** — so "join my *Won-deals* Query to Accounts" is **inexpressible**, even
though [query-builder.md](../../design/data-management/queries/queries.md) declares
a Query is **the same readable-table-source kind as a Dataset**. R76 makes that
declaration real.

R76 fills the [query-builder.md trajectory](../../design/data-management/queries/queries.md#the-trajectory-what-queries-grows-into)
step **"later — Query × Query: a Query as a join input; the unified `ds_`/`qr_`
resolver"** and finally pulls **R71's J-2′ deferral** — the **unified `ds_`/`qr_`
table-source resolver** ([joins.md § route-vs-resolver](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one),
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
[query-builder.md trajectory](../../design/data-management/queries/queries.md#the-trajectory-what-queries-grows-into),
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
| J-4 | **Doc home + the builder source-picker + error code** | **Home:** extend [joins.md](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one) / [query-construction.md](../../design/data-management/queries/query-construction.md) (the resolver + the builder), or a new `composition.md`. **Affordance:** the builder's **left/driving source `<Select>`** now lists **Queries as well as Datasets** (one unified source picker). **Contract:** the source-ref shape change + a new **`cyclic_composition`** (or reuse `cyclic_join`) error code. Lean: extend the existing docs; one unified source `<Select>`; a distinct cycle error. Sealed at Design (home/mechanism free to deviate — [build-first](../../memory/2026-05-22-ui-boundary-build-first.md)). |

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
   Update the doc home per J-4 + the [trajectory](../../design/data-management/queries/queries.md#the-trajectory-what-queries-grows-into).
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

### Gate 2 — Design pass (2026-06-14)

**Doc home (J-4 → new sibling doc, not a fork):** authored
[composition.md](../../design/data-management/queries/queries.md#composed-source-qr_) — the **fifth
construction mode**, a sibling of [joins.md](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one) /
[multi-join.md](../../design/data-management/queries/queries.md#joins-reading-related-datasets-as-one) under the
[query-builder.md](../../design/data-management/queries/queries.md) anchor (each
mode gets its own doc — the trajectory's pattern). Updated the query-builder
**trajectory** (R76 row) + its composition/J-2′ deferral lines, and joins.md's Scope to
point at composition.md.

**J-3 + J-4 resolved (the model):**

+ **J-3 → polymorphic driving-source ref + recursive resolver.** `Query.datasetId`
  (`^ds_`) widens to **`sourceId: ds_ | qr_`** — a `qr_` is admitted as the **driving/base**
  source. One **unified `ds_`/`qr_` resolver** (`resolve_source`, R71's J-2′) returns each
  source's effective columns + SQL relation — `read_parquet(?)` for a `ds_`, a
  **recursively-composed subquery** for a `qr_` — consumed by both save-validation and run.
  **Relationships stay dataset↔dataset** (no governed-edge re-open); a composed join reuses
  the dataset-level `rel_` whose left dataset is a member of the base's source set, the ON
  key resolving against the base's effective columns by **provenance**. A visited-set
  **`composition_cycle`** guard (save `422` + run `409`) makes arbitrary nesting safe.
+ **J-4 → new `composition.md`; the base-source `<Select>` (Datasets + Queries, text
  `<OptGroup>`s); `sourceId` shape change + a new `composition_cycle` error code; no new
  route.**

**Model check:** **noun-vs-mode** — the base-source picker extends R74's builder; a composed
Query is the **same readable-table-source kind**, no parallel page, no new noun.
**Discovered-vs-imposed** — _discovered_: the inner-only-Dataset limit blocks a real
expression a user wants; the `qr_` source is pulled by that gap and the resolver was named
by R71 (J-2′), not minted now. **Source-model confidence valve INVOKED on the model (not to
confirm)** — unlike R73→R75's field widenings, R76 **re-opens the source-reference model**
(polymorphic `sourceId` + recursive resolver); the design records the sealed leaning + the
**named fork** the human adjudicates at the STOP (base-only `qr_` vs. generalizing `rel_`
endpoints to admit a `qr_` on the *right* of a hop — the latter deferred with a trigger).

**`ui-design` (design-spec) on composition.md — PASS (0 gaps).** All six facets declared:
Findability (the base-source `<Select>` carries a visible label + text `<OptGroup>` headings
that disambiguate Datasets vs Queries — the learnability affordance caught preventively and
**remediated in-spec**); Usability (pick + Save primary, reversible, recoverable cycle/stale
states with actions); Accessibility (accessible names, keyboard focus order, text-not-colour,
`<Alert role="alert">`); Credibility (all 7 states specced — Loading/Populated/BaseStale/
CycleBlocked/EdgeStale/PredStale/NotFound + SaveRejected); Utility (fulfils the compose-and-run
journey); Desirability (reuses shipped chrome, no new surface). Mirrors R71–R75's preventive
catches.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                                          |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The state model branches Loading → {Populated, BaseStale, CycleBlocked, EdgeStale, PredStale, NotFound} (6) + Editing → SaveRejected — well over three. |
| 2. New interaction pattern           | no     | The base-source `<Select>` (Datasets + Queries via text `<OptGroup>`s) extends R74's shipped source select — a standard AntD pattern, not a new one.    |
| 3. High user-error risk              | no     | Reads are non-destructive; a cycle is **guarded** (rejected, reversible); composition keeps more expressiveness, deletes nothing.                       |
| 4. Contract depends on unresolved UI | no     | The `sourceId` shape follows from the **sealed model**, not unresolved UI; a Query option is obvious from the journey.                                  |
| 5. UX confidence below threshold     | yes    | A model re-open with a genuinely new "compose a Query" mental model **and** a named, unresolved fork (base-only vs. `rel_`-endpoint generalization).    |

Result: **Flow: DFCFBI (triggers 1, 5)**. Build chain **D → F1 → C → F2 → B → I** — F1 is a
human-reviewed prototype gate. Consistent with R73, the prior model-re-open round. _(The
J-2 model-review STOP gates the **whole** build chain; F1 then gates the UX prototype.)_

**`gate-walker` (Design gate): PASS** — composition.md + this round record the Design exit
criterion (the user journey + the 10 acceptance criteria, each → ≥1 future test), the
noun-vs-mode + discovered-vs-imposed checks, the **invoked source-model confidence valve**
(the re-opened source-ref + resolver surface + the named fork), and the Design commit seam.
_Structural check only — the modelling answer's correctness is the human reviewer's call at
the STOP._

**Design gate closed → SEAL-THEN-STOP (J-2).** The closed model is sealed; gate seams:
Plan `0c092bc` → Design `389faf2`. **Human model review PASSED (2026-06-14)** — approved
the base-only composition model (`sourceId: ds_|qr_`, recursive resolver, cycle guard,
relationships unchanged); the `qr_`-on-the-right fork stays deferred. Build chain
(D → F1 → C → F2 → B → I) proceeds.

### Gate F1 — Frontend prototype (DFCFBI, human-reviewed) — (2026-06-14)

DFCFBI's F1 is the FE-on-MSW prototype the human runs before Contract. **Scoped to the
builder picker** (resolved with the human): F1 runs **before** the Contract gate, and MSW
response-validation (`additionalProperties: false`) blocks new wire fields until C — so F1
is **contract-safe** (the picker is FE state, the preview body carries the base, the
response stays the unchanged `RowsPage` shape). Mirrors R73/R74's F1 (builder + preview,
human-reviewed); the detail-page composition summary + cycle/base-stale states + the
`sourceId`/`composition_cycle` **wire** move to **C → F2**.

**Built:** a **"Build on" base-source `<Select>`** in the `JoinEditor` (`BuilderBaseSource`,
labelled, two text `<OptGroup>`s — _Datasets_ + _Saved queries_; the current query excluded
as the trivial self-cycle); `useQueryBuilder` holds the driving `baseSourceId` (seeded from
`query.sourceId ?? query.datasetId`) + `setBaseSource`, threaded into the preview so picking
a `qr_` re-runs **composed** (`isComposed` → the composed effective space); the MSW preview
handler branches on a `qr_` base. `Query.sourceId?` + `PreviewQueryRequest.sourceId?` are
FE forward-decls (request-only). i18n in **en + vi**.

**F1 gate green:** `type-check` clean; `queries.test.tsx` **25/25** (+2 R76: the picker lists
Datasets + Saved queries; picking a Query re-runs the preview composed → 13-col effective
space). Seam: this commit.

**As-built notes (O-rule, for C/F2):** ① The base-source picker is the new affordance, but a
**changed base does not persist** in F1 (the PUT is definition-only; `sourceId` is identity,
not in the definition) — **the Contract gate adds `sourceId` to create/preview/get** and F2
wires persistence. ② The composed preview is **mocked with the chain fixture** (the real
recursive `ds_`/`qr_` resolver + provenance match is the **Backend** gate). ③ The **detail-page
composition summary + cycle/base-unavailable states** are **F2** (they need the `sourceId` /
`composition_cycle` wire C formalizes).

**F1 STOP — human hands-on review.** Per DFCFBI doctrine (gates can't see layout/feel), F1
hard-stops for the human to **run the app** and exercise the "Build on" picker before Contract.
**F1 review PASSED (2026-06-14)** — picker UX approved; proceed to Contract.

### Gate C — Contract (DCFBI/DFCFBI) — (2026-06-14)

Widen the Query's source reference + add the cycle error code. **Mechanism deviation from
the design's "rename", flagged (O-rule, per [[design-altitude-vs-build-home]]):** the design
named a full **rename** `datasetId → sourceId`; the build chose an **additive** widening
instead — `sourceId` is added as an **optional** field (pattern `^(ds_|qr_)[0-9a-f]{8}$`)
alongside `datasetId`. _Why:_ a hard rename breaks **both** FE and BE conformance until each
catches up, but B isn't in this batch; additive keeps the 3-impl (YAML + TS + Python) stack
**green incrementally** (FE reads `sourceId ?? datasetId`; BE still emits `datasetId` and
conforms; MSW may emit `sourceId` and conforms). The design's **intent** (polymorphic
driving source) is delivered; **`datasetId` removal is a named cleanup** once all queries
carry `sourceId`.

**Changed:** `_shared/query.yaml` (`Query.sourceId?` optional), `queries/post` +
`queries/preview` request bodies (`sourceId?`), `_shared/api-error.yaml` (new
**`composition_cycle`** code + `ApiErrorCompositionCycle` variant + the `oneOf`/discriminator),
`config/values.yaml` + both constant templates (FE + BE) → regenerated. No new route.
**C gate green:** `@mdd/contracts` OpenAPI validity **24/24**; constants re-rendered (FE
`COMPOSITION_CYCLE` + BE `composition_cycle`). Seam: this commit.

### Gate F2 — Frontend confirm (DFCFBI) — (2026-06-14)

DFCFBI's F2 confirms the design's remaining FE surfaces against the now-widened contract
(what F1 deferred). **Built:** the read-only **"Built on" composition summary**
(`QueryCompositionSummary` — names the base query + an open-base link) above the join
summary; the **composed badge**; the **`composition_cycle` "would loop" state**
(`QueryDetailCompositionUnavailable`, `role="alert"`, guided open-base / delete actions);
composed effective columns (`resolvedColumns` when composed). FE type + `isApiError` widened
for `composition_cycle`; MSW gains a composed-query fixture (`MOCK_COMPOSED_QUERY`,
`sourceId = qr_`) + a cycle fixture (`MOCK_CYCLE_QUERY_ID` → 409). i18n en + vi.
**F2 gate green:** `type-check` clean; `queries.test.tsx` **27/27** (+2: composed detail
renders the "Built on" summary + composed rows; a cyclic composition renders the guided
"would loop" state). _(Pre-existing, unrelated: 2 upload-wizard flakes in `datasets.test.tsx`
fail on the committed F1 state too — not touched by R76.)_ Seam: this commit (with C).

### Gate B — Backend (DFCFBI) — (2026-06-14)

**The unified `ds_`/`qr_` resolver (R71's J-2′) — the first source past a dataset.** The
engine generalized from `parquets: list[Path]` to composable **`relations: list[(sql,
params)]`** (`build_joined_select` factors the typed fold — TYPED, no CAST, so a composed
sub-relation's join key stays integer — and `query_joined_rows` wraps it for paged VARCHAR
output). New **`resolve_source(con, source_id, ws, visited)`**: a `ds_` → `read_parquet(?)`;
a `qr_` → its full typed SELECT (its own driving source + joins + **its own filters**)
wrapped `( … )` as a sub-relation, **recursing** (the base may itself be composed) with a
**visited-set cycle guard**. `_resolve_chain` now takes a polymorphic `source_id`; the R74
tree-membership check generalized to **dataset provenance** (a hop's left dataset may live
INSIDE a composed base's source set). `Query.sourceId` (`Literal`-less `^(ds_|qr_)…`) +
`CreateQueryBody`/`PreviewQueryBody.sourceId` widen; the `queries` table gains a nullable
`source_id` column (additive; `dataset_id` kept) — applied to pre-R76 DBs by an **idempotent
`bootstrap_schema` migration** (`PRAGMA table_info` → `ALTER TABLE … ADD COLUMN`), since
`CREATE TABLE IF NOT EXISTS` never alters an existing table (caught live: `GET /queries` 500'd
on a persisted DB whose `queries` predated the column). `composition_cycle` is raised at **save**
(409) and **run** (409). pytest **193/193** (+5 composition: create+run a composed query;
the base's own filter bakes into the composed run; depth-2 nesting resolves; a self-cycle and
a transitive cycle each block the run with `composition_cycle`), `validate_response`-checked.
`ruff` clean. Seam: this commit.

### Gate I — Integration (DFCFBI) — (2026-06-14)

**One contract / dual conformance:** the FE's MSW composed preview/get/rows bodies are
`withContractValidation`-checked (**27/27**) and the BE's composed post/detail-get/rows are
`validate_response`-checked (**193/193**), both against the widened `sourceId` shape + the
new `composition_cycle` code. The **compose lifecycle** is exercised vs the real ASGI app
(pytest `TestClient`): create a Query on a saved Query → run keeps the base's rows through the
join (the base's own filter carried in), and a **cycle is rejected** (`composition_cycle`, not
an infinite recursion). R76 adds **no new route and no CORS change** (an additive field + a new
error code), so R72's PUT-CORS mode does not recur. Integration seam: this commit (with B).

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [x] **Composition design authored** ([composition.md](../../design/data-management/queries/queries.md#composed-source-qr_),
      home per J-4 → new sibling doc): polymorphic `sourceId` ref, recursive `ds_`/`qr_`
      resolver, `composition_cycle` guard, effective-column space spanning the base, base-source
      picker, contract intent.
+ [x] **Source-model confidence valve invoked on the model** — the re-opened source-ref +
      recursive resolver surface (not merely confirmed); the named base-only-vs-rel-endpoint
      fork recorded for the STOP.
+ [x] **Noun-vs-mode + discovered-vs-imposed** recorded (mode not page; discovered — inner-only
      Dataset limit blocks a real expression; resolver named by R71's J-2′).
+ [x] `design:lint` 0 (1 doc) · `design:tokens` 0 (13 maps) · `plan:lint` 0 (76 rounds) ·
      `markdown-check-link` 0 broken · `markdownlint` 0.
+ [x] `ui-design` (design-spec) on composition.md — **PASS, 0 gaps** (the base-source
      `<Select>` learnability/disambiguation affordance caught + remediated in-spec via text
      `<OptGroup>`s).
+ [x] `flow-selector` run + result recorded — **DFCFBI (triggers 1, 5)**.
+ [x] **`gate-walker` (Design gate)** — exit criterion + model checks + commit seam recorded.
+ [x] **Design sealed + human model review PASSED** (J-2) — base-only model approved; build proceeds.
+ [x] **Build chain green** (DFCFBI D→F1→C→F2→B→I): **F1** ✓ base-source picker, human-reviewed
      (STOP) · **C** ✓ `sourceId?` (additive) + `composition_cycle`, OpenAPI **24/24** · **F2** ✓
      composition summary + cycle state, `queries.test.tsx` **27/27** · **B** ✓ unified
      recursive `ds_`/`qr_` resolver + cycle guard, pytest **193/193**, `ruff` clean · **I** ✓
      dual conformance + compose lifecycle + cycle rejection (no new route / CORS).
+ [x] **Human sign-off** (2026-06-15) — ran the app against the real backend + exercised a
      composed query (a Query built on another Query) through the live resolver; the live
      `GET /queries` 500 (a persisted DB predating `queries.source_id`) was caught + fixed
      with an idempotent `bootstrap_schema` migration. Complete = signed-off, not gates-green.
      _Known boundary carried to R77: the FE **create** path doesn't yet send `sourceId`, so
      saving a brand-new composed query end-to-end from the UI is the next round's pull._

## Act

**Outcome — a Query is now a first-class join SOURCE.** The unified `ds_`/`qr_`
table-source resolver (R71's J-2′, deferred three rounds) earns its place: a Query
whose driving source is another saved Query runs via a recursive subquery fold, and
"a Query is the same readable-table-source kind as a Dataset" stopped being a
declaration and became executable. The join engine no longer reads Datasets only.

**The model re-open was the right risk call — run as a seal-then-STOP (J-2).** Unlike
R73→R75's three "widen a field" rounds, R76 re-opened the **source-reference** model
(`datasetId` → a polymorphic `ds_`/`qr_` driving source + a recursive resolver), so the
closed model was reviewed by a human before any build. The cheapest coherent model held:
the **edge stayed dataset↔dataset** (no relationships.md re-open), the `qr_` attaches at
the **driving source**, and a visited-set **`composition_cycle`** guard makes arbitrary
nesting safe. The named fork — a `qr_` on the *right* of a hop (which would generalize
`rel_` endpoints) — stayed deferred.

**Two build-discipline learnings (notes, not promotions):**

+ **A rename in a 3-impl (YAML + TS + Python) contract can't land atomically gate-by-gate.**
  The design said rename `datasetId → sourceId`; the build chose an **additive** optional
  `sourceId` (deviation flagged, [[design-altitude-vs-build-home]]) so each layer stayed
  conformance-green incrementally. Doctrine recorded: [[dfcfbi-f1-precedes-contract]] — F1
  runs before C, so new wire fields can't ride F1; keep F1 contract-safe.
+ **An additive column still needs a migration on persisted DBs.** `CREATE TABLE IF NOT
  EXISTS` never ALTERs; the live `GET /queries` 500 proved gates-green ≠ runs-on-real-data
  (again — the R72/R75 lesson). The human-sign-off gate caught it; an idempotent
  `bootstrap_schema` column migration is the fix.

## Feeds into → finish composition's UI create path (R77), then the visual canvas

**Immediate pull → R77:** R76 shipped the composition model + engine + contract + the
read + the builder picker, but the FE **create** path doesn't send `sourceId`, so a
brand-new composed query can't be saved end-to-end from the UI (only built/run once it
exists). R77's pull is to **wire the create/save path** — the highest-priority gap, since
without it composition isn't reachable for a first-time user.

**Then** the agreed trajectory step — the **free-form visual join-graph canvas** (drag
nodes / draw edges), still **deferred until the unified source `<Select>` + hop-list stops
scaling**. Composite/multi-column keys, a `qr_` on the *right* of a hop (generalize `rel_`
endpoints), self-joins, cross-workspace joins, the `datasetId → sourceId` rename cleanup,
and null-aware (`is_empty`) predicates remain deferred with their named triggers; **workflow
/ complex query** (YAML + polars) stays the longer-horizon trajectory item.
