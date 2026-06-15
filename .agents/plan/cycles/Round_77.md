# Round 77: Make composition reachable — "Build on this query"

**Status**: In Progress (Design gate closed — build chain proceeds, no STOP per J-2)
**Date started**: 2026-06-15
**Flow**: DCFBI (only flow-selector condition 1 fired — below 2-of-5; set at the Design gate)

## Goal

**Inherits from ← [Round_76](Round_76.md)** — R76 shipped Query × Query composition's
**model + engine + contract + read surfaces + the builder's "Build on" picker**, but the
FE **create** path doesn't send `sourceId`, so a composed query can only be *built/run once
it already exists* — a first-time user **cannot save a new composed query from the UI**. The
whole point of R76 (a Query as a join source) is therefore **unreachable**. R77 closes that
gap with the **smallest** path that makes composition reachable end-to-end.

R77 adds a **"Build on this query"** action: from a saved Query (its
[detail / catalog](../../design/data-management/queries/saved-query.md)), one click opens the
**shipped hop-list builder in a CREATE mode** with **that Query preset as the base**
(`sourceId`), so the user adds joins + predicates, names it, and **Saves (POST, carrying
`sourceId`)** → a new composed Query. No model/contract/engine change — R76's `sourceId` on
create + the unified `ds_`/`qr_` resolver already accept this; R77 is the **FE create
lifecycle** that was the missing half.

**Why "Build on this", not a standalone "New query" surface (the scope call — revised at
Plan, 2026-06-15).** The standalone "New query" surface (a first-class create entry + an
empty source picker) is **important precisely because it is the home the visual canvas will
grow into** — so it should be built **properly with the canvas round**, not rushed as an MVP
bolt-on. "Build on this" makes composition reachable **now** with far less: it **presets the
base from the surface you're on** (no empty source-picker, no standalone route, no
from-scratch IA), and **reuses the exact "Save filters as Query" rhythm** (a verb on an
existing surface → the builder → name + Save). It is **not a new noun**: a query is still a
query; the create path **reuses** `useQueryBuilder` / `JoinEditor` / `<PagedRowsView>` (the
[reuse invariant](../../design/data-management/queries/query-builder.md#the-reuse-invariant-the-one-rule-this-domain-holds)),
never a parallel page (the discarded-R69 trap).

_Track: 1 (product feature). Pulled by ← R76's named create-path gap (its Feeds-into).
Scoped by the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium): the
**create lifecycle + the "Build on this" verb** only — the standalone "New query" surface,
the canvas, the `datasetId → sourceId` rename cleanup, and a `qr_` on the right of a hop all
stay deferred with their triggers._

## Judgment calls

### Resolved with the human at the Plan gate (2026-06-15)

| #   | Question        | Resolution                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-0 | **Round topic** | **Finish composition's UI create path** (ratified) — make a composed query creatable + savable end-to-end (send `sourceId` on create). The highest-priority gap R76 left open; backend + contract already support it.                                                                                                                                |
| J-1 | **Entry point** | **"Build on this query"** (ratified — **revised from a standalone "New query" surface**). A verb on a saved Query opens the builder with that Query preset as the base. _Revised because:_ the standalone "New query" surface is **too important to MVP-rush** — it is the home the **visual canvas** will grow into, so it's built **with that round**, done right. "Build on this" reaches composition now with the least surface area (base preset from context; no empty picker / standalone route). |
| J-2 | **Round shape** | **Run straight through** (ratified) — R77 **re-opens no model** (R76's `sourceId` create + resolver are shipped); pure FE create-lifecycle + a verb. No Design-gate STOP (unlike R76); per-gate commits are the revert seams. The flow (DCFBI vs DFCFBI) is chosen by `flow-selector` at the Design gate.                                              |

### The MVP discipline this round holds to

+ **Still a CREATE-mode builder (the real work), but minimal.** The shipped builder only
  **edits** an existing query (seeded from a saved query; Save = PUT). "Build on this" needs
  a **create lifecycle** (no id → base **preset** → Save = POST via `useCreateQueryMutation`)
  + **name capture** — but **no** empty source picker, **no** standalone route, **no**
  from-scratch IA (those ship with the canvas).
+ **Reuse, don't fork.** The create path **composes** `useQueryBuilder` / `JoinEditor` /
  `<PagedRowsView>` + the shipped create mutation; no parallel builder/page.
+ **Mirror "Save filters as Query".** "Build on this" is the same shape (a verb on an
  existing surface → builder → name + Save), so create logic isn't duplicated.
+ **Hop-list, not canvas; preset base, not a picker.** R77 keeps the `qr_` as the **base**,
  preset from the source Query; the empty source picker + standalone surface are the canvas
  round's.

### Deferred to the Design gate — to be resolved with the closed design (J-3, J-4)

| #   | Question                                  | Held open for the Design pass                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **The create-mode builder lifecycle**     | How the builder generalizes from edit-only to create+edit with a **preset base**: the no-`id` initial state seeded with `sourceId` = the source Query, **name capture** (mirror "Save filters as Query" — inline field vs a Save dialog), Save = POST(`{name, datasetId, sourceId, definition}`) then navigate to the new `qr_` detail, and the `composition_cycle`/validation states surfaced pre-save. Lean: extend `useQueryBuilder` with a create mode; reuse the name-capture pattern. |
| J-4 | **The "Build on this" affordance + doc home** | Where the verb lives (the Query **detail** header, the **catalog** row action, or both), its label + how the new draft is routed/opened (a transient builder over the catalog vs a `…/queries/new?base=qr_…` route), and the doc home — extend [saved-query.md](../../design/data-management/queries/saved-query.md) (the catalog + create modes) + [query-construction.md](../../design/data-management/queries/query-construction.md) (the builder). Lean: a Query-detail verb mirroring "Save filters as Query"; extend the existing docs. Sealed at Design (home/mechanism free to deviate — [build-first](../../memory/2026-05-22-ui-boundary-build-first.md)). |

**Invariant (the R69→R76 anti-duplication rule):** R77 **reuses** the Queries catalog +
detail, `useQueryBuilder` / `JoinEditor` / `QueryBuilderPanel` / `<PagedRowsView>`, the
`useCreateQueryMutation` + preview hooks, and R76's `BuilderBaseSource` + `sourceId` plumbing
([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)); the **only**
new work is the **create-mode lifecycle** (no-id seed with a preset base, name capture,
POST-not-PUT) + the **"Build on this" verb** — named honestly, not laundered through "reuse".

## Plan (by gate)

1. **Plan gate** — ratify J-0, J-1, J-2; record J-3, J-4 held open. Commit the ratified
   round file (Plan seam).
2. **Design gate — author the create path:** the create-mode builder lifecycle with a preset
   base (J-3), the "Build on this" verb + routing + name capture (J-4), the states,
   Accessibility, the (unchanged) contract intent (create already accepts `sourceId`). Run
   noun-vs-mode + discovered-vs-imposed + the model-confidence valve (to **confirm** — no
   model re-open). Each acceptance criterion → ≥1 future test. Update the doc home per J-4.
3. **Design-gate verification** — `ui-design` (design-spec) on the create path;
   `design:lint` / `design:tokens` / `plan:lint` / `markdown-check-link` / `markdownlint`;
   `gate-walker`; run `flow-selector`; **continue** (J-2: run straight through).
4. **Build chain** (per `flow-selector`) — Frontend (create-mode builder with a preset base +
   the "Build on this" verb + Save=POST carrying `sourceId`), Integration (a create-a-composed
   -query lifecycle: from a Query → Build on this → add a join → name + Save → its detail runs
   composed; a self/cyclic base is rejected pre-save). Contract is **unchanged** (R76 shipped
   `sourceId` on create) — confirm, don't re-widen.

## Acceptance criteria

+ [ ] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [ ] **Create path designed** (home per J-4): the "Build on this query" verb + the
      create-mode builder (base preset, name capture, Save = POST with `sourceId`), the
      states, Accessibility — reusing the shipped builder.
+ [ ] **Model-confidence valve invoked to confirm**: R77 adds **no model/contract/engine**
      change (R76's `sourceId` create + unified resolver are shipped); only the FE create
      lifecycle + the verb are new.
+ [ ] **Noun-vs-mode passes**: "Build on this" reuses the catalog + builder +
      `<PagedRowsView>`; no parallel page, no re-invented engine; the create + "Save filters
      as Query" intents share the builder.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `plan:lint` 0, `markdown-check-link`
      0 broken, `markdownlint` 0; `ui-design` (design-spec) PASS; `gate-walker` confirms the
      Design exit.
+ [ ] **Build chain green** (per `flow-selector`): Frontend ("Build on this" verb +
      create-mode builder with a preset base; Save POSTs `{name, datasetId, sourceId,
      definition}`); Integration (the end-to-end create-a-composed-query lifecycle + pre-save
      cycle rejection; dual conformance against the **unchanged** contract).
+ [ ] Each gate **committed separately**; **Complete = human-signed-off** (created + ran a
      composed query end-to-end from the UI against the real backend).

## What is OUT of scope

+ **The standalone "New query" surface + an empty source picker** → **deferred to the visual
  canvas round** — it is the home the canvas grows into and is **high user value** (the
  Builder helps users a lot); deferring is **deferred-to-do-right, not deprioritized**, a
  deliberate refusal to "accelerate only". R77's "Build on this" MVP **proves composition is
  reachable** — it is the proof-of-concept, not the finished value. R77 presets the base from
  the source Query instead ([[dont-mvp-rush-a-roadmap-home-surface]]).
+ **The free-form visual join-graph canvas** → later (its "hop-list stops scaling" trigger
  has not fired; R77 uses the shipped hop-list builder).
+ **The `datasetId → sourceId` rename cleanup** → a separate named round once all queries
  carry `sourceId` (R76 shipped `sourceId` additively; `datasetId` is the legacy field).
+ **A `qr_` on the RIGHT of a join hop** (generalize `rel_` endpoints) → deferred (R76's
  named fork); R77 keeps the `qr_` as the **driving/base** source only.
+ **Rename of an existing query; composite keys; self-joins; cross-workspace; `is_empty`
  predicates** — standing triggers hold.

## Risks / unknowns

+ **Create-mode in an edit-shaped builder.** `useQueryBuilder` assumes an existing `query`
  (seed, dirty-vs-saved, PUT). _Mitigation: the design states the no-id create lifecycle with
  a preset base; Save branches POST-vs-PUT; a test drives Build-on-this → Save → detail._
+ **Name capture UX.** A new query needs a name before Save. _Mitigation: reuse the "Save
  filters as Query" name-capture pattern; decided at Design (J-3)._
+ **Two creation entry points drifting.** "Save filters as Query" + "Build on this" could
  duplicate create logic. _Mitigation: both route through one builder + one create mutation;
  the design names the shared path._
+ **A base that can't be composed.** Building on a Query whose own keys/base drifted should
  fail gracefully pre-save. _Mitigation: the builder surfaces resolve errors
  (`composition_cycle` / `relationship_stale`) before Save, reusing R76's gates._

## Do

### Plan-gate ratification (2026-06-15)

+ **J-0 → finish composition's UI create path** — send `sourceId` on create so a composed
  query is creatable end-to-end.
+ **J-1 → "Build on this query"** — a verb on a saved Query presets it as the base in the
  builder. **Revised from a standalone "New query" surface**, which is too important to
  MVP-rush and is deferred to the **canvas round** (its proper home).
+ **J-2 → run straight through** — no model re-open (R76 shipped `sourceId` create + the
  resolver); per-gate commits are the revert seams; `flow-selector` picks the chain at Design.
+ **J-3 → the create-mode builder lifecycle (preset base) held open** for Design.
+ **J-4 → the "Build on this" affordance + doc home held open** for Design.
+ **Invariant:** reuse the catalog + builder + `<PagedRowsView>` + create mutation + R76's
  `sourceId` plumbing; the only new work is the create lifecycle + the "Build on this" verb.

### Gate 2 — Design pass (2026-06-15)

**Doc home (J-4 → extend the existing docs, not a fork):** authored the create path into
**[query-construction.md § Create mode (R77)](../../design/data-management/queries/query-construction.md#create-mode-r77-build-a-new-query-on-a-preset-base)**
(the create-mode builder lifecycle — the J-3 home, since this is the builder doc) and the
**"Build on this query"** verb into
**[saved-query.md § Build on this query](../../design/data-management/queries/saved-query.md#build-on-this-query-r77-the-create-entry)**
(the catalog + create-modes home — the J-4 affordance). Updated
[composition.md](../../design/data-management/queries/composition.md) (create now reachable;
its R76 Status reconciled to **shipped** — O-rule truth-fix) and the
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md#the-trajectory-what-queries-grows-into)
(an R77 row; R76 → shipped).

**J-3 + J-4 resolved (grounded in the shipped build, [[design-altitude-vs-build-home]]):**

+ **J-3 → the create-mode lifecycle = a MODE of `useQueryBuilder`.** Edit-only generalizes
  to edit + create: **no id**, baseline = the **empty definition**, the driving source
  **preset** to the chosen Query's `qr_` (not seeded from a saved `sourceId`); the composed
  `POST …/preview` runs the unsaved draft **unchanged**; **name captured at Save** via the
  reused `SaveQueryModal`; **Save = `POST`** `{ name, datasetId: base.datasetId, sourceId:
  base.id, definition }` via the reused `useCreateQueryMutation` → navigate to the new `qr_`.
  _Grounding:_ the backend create handler **already** accepts `sourceId`
  (`source_id = body.sourceId or body.datasetId`, [queries.py](../../../workspace/apps/backend/app/routers/queries.py)),
  but still requires a valid `datasetId` (the legacy `NOT NULL` column) — so the create body
  carries **both** `datasetId = base.datasetId` **and** `sourceId = base.id` (the `datasetId →
  sourceId` rename is the deferred cleanup). The only FE type change is widening
  `CreateQueryRequest` to carry `sourceId` (request-only alignment to R76's YAML).
+ **J-4 → the verb on the Query detail header + a base-gated `/queries/new?base=qr_…` route**
  (reached only via the verb — **not** the deferred standalone empty-picker surface);
  name capture mirrors "Save filters as Query"; home/mechanism sealed loosely (build may use
  a transient overlay instead — the **intent** is sealed). _A catalog row action is an optional
  second placement the build may add._

**Model check:** **noun-vs-mode** — a new composed Query is the **same readable-table-source
kind**; create is a **mode** of the shipped builder (same `QueryBuilderPanel`), no parallel
page, no new engine. **Discovered-vs-imposed** — _discovered_: R76 left a named create gap
(composition unreachable for a first-time user); R77 closes it with the least surface area, no
invented surface. **Model-confidence valve INVOKED to CONFIRM (not re-open)** — R77 adds **no**
model / contract / engine / route / error-code change; it sends R76's `sourceId` on the create
path. (Contrast R76, which re-opened the source-reference model.)

**`ui-design` (design-spec) on the create path — PASS (0 gaps).** All six facets declared:
Findability (the "Build on this query" verb is a visible **text** action on the detail header,
distinguishable from `[Edit]`/`[Delete]`; the base is **preset**, no empty picker to learn);
Usability (primary Save + Cancel/discard-confirm; `canSave` gated on valid preview + non-empty
name; `name_taken`/base-unavailable recoverable); Accessibility (keyboard-reachable labelled
verb, text-labelled preset base, reused `SaveQueryModal` semantics, `<Alert role="alert">`
text-not-colour); Credibility (every create state specced — Editing/PreviewLoading/
PreviewPopulated/BaseUnavailable/NameCapture/Saving→NewDetail/NameTaken/SaveRejected/Leave;
the structurally-impossible new-node self-cycle named honestly); Utility (closes R76's create
gap — criteria 1–6); Desirability (**no new token** — reuses the shipped token maps +
`SaveQueryModal` styling).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                                                          |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The create state model branches PreviewLoading → {PreviewPopulated, BaseUnavailable} and Saving → {NewDetail, NameTaken, SaveRejected}, + Editing / NameCapture / Leave — over three. |
| 2. New interaction pattern           | no     | The create path **reuses** the shipped `QueryBuilderPanel`, R69's `SaveQueryModal`, R76's base picker, and the exact "Save filters as Query" verb→builder→name→Save rhythm — nothing new. |
| 3. High user-error risk              | no     | Creating a Query is **non-destructive** (the source Query is untouched, nothing overwritten); a bad/unrunnable base is flagged pre-save and blocks Save; `name_taken` is recoverable. |
| 4. Contract depends on unresolved UI | no     | The contract is **unchanged** (R76 shipped `sourceId` on create/preview); the FE merely sends it — no YAML decision pends a UI answer.                                  |
| 5. UX confidence below threshold     | no     | The create path composes **already-shipped, human-reviewed** surfaces (builder R72, base picker R76, save modal R69); `ui-design` PASS 0 gaps; no open fork (unlike R76). |

Result: **Flow: DCFBI** (only condition 1 fires — below the 2-of-5 threshold; the cheap lane,
no F1/F2 human-prototype gates). Consistent with J-2 "run straight through": build chain
**D → C → F → B → I**, per-gate commits as the revert seams.

**`gate-walker` (Design gate): PASS** — query-construction.md + saved-query.md + this round
record the Design exit criterion (the R77 user journey + acceptance criteria 1–6, each → ≥1
future test), the noun-vs-mode + discovered-vs-imposed checks, the **model-confidence valve
invoked to confirm** (no model surface re-opened), and the Design commit seam. _Structural
check only — the design's correctness is the human reviewer's call._ **No Design-gate STOP**
(J-2: run straight through — R77 re-opens no model).

**Design gate closed → continue (J-2, no STOP).** Gate seams: Plan `bd3ca5f` → Design (this
commit). The DCFBI build chain (C → F → B → I) proceeds; **Complete = human-signed-off** (a
composed query created + run end-to-end from the UI).

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [x] **Create path designed** (home per J-4): the "Build on this" verb
      ([saved-query.md](../../design/data-management/queries/saved-query.md#build-on-this-query-r77-the-create-entry))
      + the create-mode builder
      ([query-construction.md](../../design/data-management/queries/query-construction.md#create-mode-r77-build-a-new-query-on-a-preset-base)).
+ [x] **Model-confidence valve to confirm** — no model/contract/engine/route/error-code change
      recorded; R77 sends R76's `sourceId` on the create path.
+ [x] **Noun-vs-mode + discovered-vs-imposed** recorded (mode of the shipped builder; discovered
      — R76's named create gap).
+ [x] `design:lint` 0 (16 docs) · `design:tokens` 0 (13 maps) · `plan:lint` 0 (77 rounds) ·
      `markdown-check-link` 0 broken (4 changed) · `markdownlint` 0 (189 files).
+ [x] `ui-design` (design-spec) on the create path — **PASS, 0 gaps**.
+ [x] `flow-selector` run + result recorded — **DCFBI** (only condition 1 fires; below 2-of-5).
+ [x] **`gate-walker` (Design gate)** — exit criterion + checks + commit seam recorded; no STOP (J-2).
+ [ ] **Build chain green** (DCFBI D→C→F→B→I): Contract (confirm `sourceId` on create — no
      re-widen) · Frontend ("Build on this" verb + create-mode builder; Save POSTs `sourceId`) ·
      Backend (confirm composed create — no change) · Integration (end-to-end create lifecycle +
      pre-save unrunnable-base rejection; dual conformance against the unchanged contract).
+ [ ] **Human sign-off** — created + ran a composed query end-to-end from the UI against the
      real backend (Complete = signed-off, not gates-green).

## Act

_Pending — filled at round close._ The intended outcome: composition becomes **reachable** —
from a saved Query, "Build on this" lets a user create + save a query built on it — closing
the gap R76 left, on the shipped hop-list builder, with the least surface area. The standalone
"New query" surface is consciously **saved for the canvas round** (built right, not rushed).

## Feeds into → the standalone "New query" surface + the visual canvas, then the rename cleanup

With composition reachable via "Build on this", the next trajectory step is the **standalone
"New query" surface + the free-form visual join-graph canvas** (built together — the surface
is the canvas's home), still deferred until the hop-list stops scaling. The **`datasetId →
sourceId` rename cleanup**, a `qr_` on the right of a hop, composite keys, self-joins,
cross-workspace joins, and `is_empty` predicates remain deferred with their named triggers;
**workflow / complex query** (YAML + polars) is the longer-horizon item.
