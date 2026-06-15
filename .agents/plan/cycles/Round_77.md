# Round 77: Make composition reachable — a standalone "New query" create surface

**Status**: Planning
**Date started**: 2026-06-15

## Goal

**Inherits from ← [Round_76](Round_76.md)** — R76 shipped Query × Query composition's
**model + engine + contract + read surfaces + the builder's "Build on" picker**, but the
FE **create** path doesn't send `sourceId`, so a composed query can only be *built/run once
it already exists* — a first-time user **cannot save a new composed query from the UI**.
The whole point of R76 (a Query as a join source) is therefore **unreachable** to a user
who hasn't already got one. R77 closes that gap.

R77 adds a **standalone "New query" create surface**: a first-class entry on the
[Queries catalog](../../design/data-management/queries/saved-query.md) that opens the **shipped hop-list builder in a CREATE
mode** with an **empty source picker** (Datasets **and** saved Queries — R76's
`BuilderBaseSource`), so a user can pick any base, build joins + predicates, name it, and
**Save (POST, carrying `sourceId`)**. No model/contract/engine change — R76's `sourceId`
on create + the unified `ds_`/`qr_` resolver already accept this; R77 is the **FE create
lifecycle** that was the missing half.

**Why a standalone surface (the noun-vs-mode + roadmap call).** Two creation intents now
coexist: **"Save filters as Query"** (capture a *dataset's* active filtered view — the
shipped verb on [dataset-detail.md](../../design/data-management/datasets/dataset-detail.md))
and **"New query"** (build *fresh* from any source). The standalone surface is the home the
**visual canvas** will later upgrade into (the agreed trajectory), so it **pre-positions**
that roadmap step without building it — the canvas's "hop-list stops scaling" trigger has
**not** fired, and R77 stays on the **hop-list** builder. It is **not a new noun**: a query
is still a query; the create surface **reuses** `useQueryBuilder` / `JoinEditor` /
`<PagedRowsView>` (the [reuse invariant](../../design/data-management/queries/query-builder.md#the-reuse-invariant-the-one-rule-this-domain-holds)),
never a parallel page (the discarded-R69 trap).

_Track: 1 (product feature). Pulled by ← R76's named create-path gap (its Feeds-into) +
the [query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into).
Scoped by the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium):
the **create lifecycle + the standalone entry** only — the canvas, the `datasetId → sourceId`
rename cleanup, and a `qr_` on the right of a hop stay deferred with their triggers._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-15)

| #   | Question        | Resolution                                                                                                                                                                                                                                                                                                                       |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-0 | **Round topic** | **Finish composition's UI create path** (ratified) — make a composed query creatable + savable end-to-end (send `sourceId` on create). The highest-priority gap R76 left open; backend + contract already support it. The canvas + rename cleanup stay deferred.                                                                  |
| J-1 | **Entry point** | **A standalone "New query" surface** (ratified) — a first-class create entry on the Queries catalog, opening the builder with an **empty source picker** (dataset or query). Chosen over "Build on this query" / extending "Save filters as Query" because it is the **home the visual canvas will upgrade into** (roadmap fit). |
| J-2 | **Round shape** | **Run straight through** (ratified) — R77 **re-opens no model** (R76's `sourceId` create + resolver are shipped); it is pure FE create-lifecycle + an entry surface. No Design-gate STOP (unlike R76); per-gate commits are the revert seams. The flow (DCFBI vs DFCFBI) is chosen by `flow-selector` at the Design gate.        |

### Concerns the human raised / the plan holds the round to

+ **The real work is a CREATE-mode builder, not a one-line `sourceId` add.** The shipped
  builder only **edits** an existing query (seeded from a saved query; Save = PUT). A
  from-scratch "New query" needs a **create lifecycle** (no id → pick source → Save = POST
  via `useCreateQueryMutation`), an **empty source state**, and **name capture** — the bulk
  of R77.
+ **Reuse, don't fork.** The standalone surface **composes** `useQueryBuilder` /
  `JoinEditor` / `<PagedRowsView>`; it does not stand up a parallel builder/page.
+ **Two creation entry points coexist** ("Save filters as Query" = capture a view; "New
  query" = build fresh) — they **share the builder**; the design names the distinct intents
  so create logic isn't duplicated.
+ **Hop-list, not canvas.** R77 uses the shipped hop-list builder; the free-form canvas
  stays deferred (its trigger has not fired).

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                                  | Held open for the Design pass                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **The create-mode builder lifecycle**     | How the builder generalizes from edit-only to create+edit: the no-`id` initial state, the empty/required source picker (no preview until a source is chosen), **name capture** (inline field vs a Save dialog — mirror "Save filters as Query"?), Save = POST(`{name, datasetId, sourceId?, definition}`) then navigate to the new `qr_` detail, and the `composition_cycle`/validation states surfaced pre-save. Lean: extend `useQueryBuilder` with a create mode; reuse the name-capture pattern. |
| J-4 | **The entry-point affordance + doc home** | The catalog `[+ New query]` affordance (placement, empty-catalog state), how the route is shaped (`/data-management/queries/new`?), and where it's specified — extend [saved-query.md](../../design/data-management/queries/saved-query.md) (the catalog + create modes) and [query-construction.md](../../design/data-management/queries/query-construction.md) (the builder), or a short new doc. Lean: extend the existing docs; a `…/queries/new` route; an empty-state CTA. Sealed at Design (home/mechanism free to deviate — [build-first](../../memory/2026-05-22-ui-boundary-build-first.md)). |

**Invariant (the R69→R76 anti-duplication rule):** R77 **reuses** the Queries catalog +
detail, `useQueryBuilder` / `JoinEditor` / `QueryBuilderPanel` / `<PagedRowsView>`, the
`useCreateQueryMutation` + preview hooks, and R76's `BuilderBaseSource` + `sourceId` plumbing
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)); the **only**
new work is the **create-mode lifecycle** (no-id seed, name capture, POST-not-PUT) + the
**standalone catalog entry/route** — named honestly, not laundered through "reuse".

## Plan (by gate)

1. **Plan gate** — ratify J-0, J-1, J-2; record J-3, J-4 held open. Commit the ratified
   round file (Plan seam).
2. **Design gate — author the create surface:** the create-mode builder lifecycle (J-3),
   the standalone entry/route + empty states + name capture (J-4), the states, Accessibility,
   the (unchanged) contract intent (create already accepts `sourceId`). Run noun-vs-mode +
   discovered-vs-imposed + the model-confidence valve (to **confirm** — no model re-open).
   Each acceptance criterion → ≥1 future test. Update the doc home per J-4.
3. **Design-gate verification** — `ui-design` (design-spec) on the create surface;
   `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link` / `markdownlint`;
   `gate-walker`; run `flow-selector`; **continue** (J-2: run straight through).
4. **Build chain** (per `flow-selector`) — Frontend (the create-mode builder + catalog
   entry + Save=POST carrying `sourceId`), Integration (a create-a-composed-query lifecycle:
   New query → pick a Query base → add a join → name + Save → its detail runs composed; a
   self/cyclic base is rejected pre-save). Contract is **unchanged** (R76 shipped `sourceId`
   on create) — confirm, don't re-widen.

## Acceptance criteria

+ [ ] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [ ] **Create surface designed** (home per J-4): the standalone `[+ New query]` entry +
      route, the create-mode builder (empty source picker, name capture, Save = POST with
      `sourceId`), the states, Accessibility — reusing the shipped builder.
+ [ ] **Model-confidence valve invoked to confirm**: R77 adds **no model/contract/engine**
      change (R76's `sourceId` create + unified resolver are shipped); only the FE create
      lifecycle + entry surface are new.
+ [ ] **Noun-vs-mode passes**: "New query" reuses the catalog + builder + `<PagedRowsView>`;
      no parallel page, no re-invented engine; the create + "Save filters as Query" intents
      share the builder.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0, `markdown-check-link`
      0 broken, `markdownlint` 0; `ui-design` (design-spec) PASS; `gate-walker` confirms the
      Design exit.
+ [ ] **Build chain green** (per `flow-selector`): Frontend (create-mode builder + catalog
      entry; Save POSTs `{name, datasetId, sourceId?, definition}`); Integration (the
      end-to-end create-a-composed-query lifecycle + pre-save cycle rejection; dual
      conformance against the **unchanged** contract).
+ [ ] Each gate **committed separately**; **Complete = human-signed-off** (created + ran a
      composed query end-to-end from the UI against the real backend).

## What is OUT of scope

+ **The free-form visual join-graph canvas** → later (its "hop-list stops scaling" trigger
  has not fired; R77 uses the shipped hop-list builder, which the canvas later upgrades).
+ **The `datasetId → sourceId` rename cleanup** → a separate named round once all queries
  carry `sourceId` (R76 shipped `sourceId` additively; `datasetId` is the legacy field).
+ **A `qr_` on the RIGHT of a join hop** (generalize `rel_` endpoints) → deferred (R76's
  named fork); R77 keeps the `qr_` as the **driving/base** source only.
+ **Rename of an existing query; composite keys; self-joins; cross-workspace; `is_empty`
  predicates** — standing triggers hold.

## Risks / unknowns

+ **Create-mode in an edit-shaped builder.** `useQueryBuilder` assumes an existing `query`
  (seed, dirty-vs-saved, PUT). _Mitigation: the design states the no-id create lifecycle;
  Save branches POST-vs-PUT; a test drives New query → Save → detail._
+ **Empty source state.** No preview until a source is chosen; the picker must gate Save.
  _Mitigation: the design states the empty/required states; `ui-design` checks the affordance._
+ **Two creation entry points drifting.** "Save filters as Query" + "New query" could
  duplicate create logic. _Mitigation: both route through one builder + one create mutation;
  the design names the shared path._
+ **Name capture UX.** A from-scratch query needs a name before Save. _Mitigation: reuse the
  "Save filters as Query" name-capture pattern; decided at Design (J-3)._

## Do

### Plan-gate ratification (2026-06-15)

+ **J-0 → finish composition's UI create path** — send `sourceId` on create so a composed
  query is creatable end-to-end; canvas + rename cleanup deferred.
+ **J-1 → a standalone "New query" surface** — a first-class catalog entry opening the
  builder with an empty source picker; the home the canvas later upgrades into (roadmap fit).
+ **J-2 → run straight through** — no model re-open (R76 shipped `sourceId` create + the
  resolver); per-gate commits are the revert seams; `flow-selector` picks the chain at Design.
+ **J-3 → the create-mode builder lifecycle held open** for Design.
+ **J-4 → the entry-point affordance + doc home held open** for Design.
+ **Invariant:** reuse the catalog + builder + `<PagedRowsView>` + create mutation + R76's
  `sourceId` plumbing; the only new work is the create lifecycle + the standalone entry.

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [ ] **Create surface designed** (home per J-4): standalone entry + create-mode builder.
+ [ ] **Model-confidence valve to confirm** — no model/contract/engine change recorded.
+ [ ] **Noun-vs-mode + discovered-vs-imposed** recorded.
+ [ ] `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · `markdown-check-link` 0 broken ·
      `markdownlint` 0.
+ [ ] `ui-design` (design-spec) on the create surface — PASS.
+ [ ] `flow-selector` run + result recorded.
+ [ ] **`gate-walker` (Design gate)** — exit criterion + checks + commit seam recorded.
+ [ ] **Build chain green**: Frontend (create-mode builder + catalog entry) · Integration
      (end-to-end create lifecycle + pre-save cycle rejection; dual conformance).
+ [ ] **Human sign-off** — created + ran a composed query end-to-end from the UI against the
      real backend (Complete = signed-off, not gates-green).

## Act

_Pending — filled at round close._ The intended outcome: composition becomes **reachable** —
a first-time user can build a query on a saved Query from scratch and save it — closing the
gap R76 left, on the shipped hop-list builder, and pre-positioning the standalone surface the
visual canvas will later upgrade into.

## Feeds into → the visual join-graph canvas, then the rename cleanup / workflow

With composition reachable end-to-end, the next trajectory step is the **free-form visual
join-graph canvas** (the standalone "New query" surface is its home), still deferred until
the hop-list stops scaling. The **`datasetId → sourceId` rename cleanup**, a `qr_` on the
right of a hop, composite keys, self-joins, cross-workspace joins, and `is_empty` predicates
remain deferred with their named triggers; **workflow / complex query** (YAML + polars) is
the longer-horizon item.
