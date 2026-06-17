# Round 85: canvas theme-opener — build Phase A (the read-only source-graph view)

**Status**: In Progress — Plan + Design gates **closed** (2026-06-18); **F gate next**.
**Date started**: 2026-06-18
**Date completed**:
**Flow**: **DCFBI** (F-only) — Track-1 product feature; set at the Design gate via `flow-selector`
(0/5 fired; recorded in the Do log). Per [canvas.md J-3](../../design/data-management/queries/canvas.md),
Phase A is a **frontend-only** slice (render the existing `joins` tree; no contract/BE/engine change).
Gates: **Plan → Design → F → Integration**.

## Goal

**Inherits from ← [Round_80](Round_80.md)** (the canvas design, banked) and the **human's R85
product call**: _canvas is the #1 end-user-value feature (dashboards #2) — these are what answer
Track-1's "why/what-for"; the MVP only proved the concept._ That call **fires** the build trigger
R80 banked as deferred ([canvas.md J-2](../../design/data-management/queries/canvas.md): "unfired" at
R80's 2–4-node trees). This is the **accelerate** side of the
[dynamic equilibrium](../../context/purpose.md#dynamic-equilibrium): the human pull — not a
hop-list-scaling pain signal — is the authority that opens the build. _The R80 deferral was an
agent-side brake; the human partner, who knows the product intent, overrides it deliberately._

Open the **canvas theme** by building its **Phase A** — the **read-only source-graph VIEW**
([canvas.md § J-5](../../design/data-management/queries/canvas.md)): render a Query's
`definition.joins` **tree** as a node-link graph (nodes = the driving `sourceId` + each hop's right
dataset; edges = `JoinStep`s, labelled with the key pair + cardinality), surfaced as a
**`[List] / [Canvas]` view toggle** in the builder's Build section **over the same working copy**.
**Zero editing, zero model/contract/BE/engine change** — pure visualization of what `joins[]`
already holds. The list stays the editor; the canvas is an *additional*, not a replacement, view
(accessibility: List is the keyboard/SR-complete equivalent, default for assistive tech).

Do it **right, not MVP-rushed** ([[dont-mvp-rush-a-roadmap-home-surface]]): a real graph render
(genuine node-link layout), not a sketch — this is a roadmap-home surface the human flagged as
headline value.

_Track: 1 (product feature). Pulled by ← the human's R85 "canvas is #1 value" call + the
[query-builder trajectory](../../design/data-management/queries/queries.md#the-trajectory-what-queries-grows-into)
canvas step + [canvas.md](../../design/data-management/queries/canvas.md) (the banked design this
builds against). Per the [Evolution Rule](../../AGENTS.md)._

## Plan (by gate)

1. **Plan gate** — ratify: open the canvas theme; build **Phase A only** (read-only view) this
   round; the human pull fires the trigger (record the override of R80's "unfired" verdict). _(This
   step.)_
2. **Design gate** — re-confirm [canvas.md](../../design/data-management/queries/canvas.md)'s
   verdicts against the **current** builder (`useQueryBuilder` / `QueryBuilderPanel` /
   `JoinEditor`, now under [queries.md](../../design/data-management/queries/queries.md) +
   [query-construction.md](../../design/data-management/queries/query-construction.md)); pick the
   graph-render mechanism (react-flow-style lib vs. hand-rolled SVG/DOM) — a build-home decision
   ([[design-altitude-vs-build-home]]); run `flow-selector` (expect F-only DCFBI) and `ui-design`
   (design-spec) on the Phase-A surface. Amend canvas.md in place to reflect Phase A as it ships
   (design docs are current-state — [[design-docs-are-source-code]]).
3. **F gate** — build `QueryCanvas` (read-only node-link render of `joins`), wire the
   `[List] / [Canvas]` toggle into `QueryBuilderPanel` over the **one** working copy; reuse
   `useQueryBuilder`'s resolved chain (no new state); per-edge stale state rendered on the edge
   (reusing the existing `409 relationship_stale`). vitest + MSW for: tree renders faithfully
   (a 2+-hop star), toggle is lossless. **No** contract/BE work (Phase A reads the resolved
   definition the builder already has).
4. **Integration** — open a joined/composed Query, toggle to Canvas, see the graph match the
   hop-list; toggle back, no state lost. **Human review** (run the app — a canvas is a visual
   surface MSW/vitest can't fully judge: [[dfcfbi-f1-needs-human-review]] applies to any
   FE-visual round).

## Acceptance criteria (Phase A — from canvas.md "handed down")

+ [ ] **Canvas renders the tree faithfully** _(FE)_ — nodes = `sourceId` + each hop's right
      dataset; edges = `joins[]` labelled with the key pair + advisory cardinality; a 2+-hop **star**
      (one source driving two hops) renders correctly (not just a linear path); the driving node is
      marked in **text/icon + label**, not colour alone.
+ [ ] **View toggle is lossless** _(FE)_ — `[List] ⇄ [Canvas]` swaps the **rendering** of one
      working copy with **no edit lost and no model fork**; both views read the same
      `useQueryBuilder` chain.
+ [ ] **Read-only — no model/contract/BE/engine change** _(structural)_ — Phase A adds **no** field,
      route, error code, or engine; it renders the resolved `definition.joins` the builder already
      holds. The list remains the editor.
+ [ ] **Accessibility: List is the equivalent** _(FE)_ — the `[List]` view is the
      keyboard/screen-reader-complete equal and the assistive-tech default; the toggle is a labelled,
      keyboard-reachable control; nodes/edges carry text labels; a per-edge stale state is an
      `<Alert role="alert">` with text reason.
+ [ ] **Reuse, not duplication** _(FE)_ — `QueryCanvas` binds to the shipped `useQueryBuilder` and is
      rendered through `QueryBuilderPanel`; it re-implements no engine, predicate editor, or detail
      page (the [reuse invariant](../../design/data-management/queries/queries.md#the-reuse-invariant-the-one-rule-this-domain-holds)).
+ [ ] **Done right, not rushed** _(human review)_ — a genuine node-link render (real layout), judged
      in the running app, not a placeholder sketch.
+ [ ] **Complete = human-signed-off** (Phase A canvas view, run in the app).

## What is OUT of scope (deferred to later canvas-theme rounds)

+ **Phase B — interactive editing** (draw-edge → `addJoin`, delete-leaf → `removeJoin`, pick the
  `rel_`) → **R86**. _Trigger: Phase A's render is confirmed in the app._
+ **Phase C — the standalone "New query" entry** (empty-canvas create, no preset base) → **R87**;
  depends on Phase B's place-a-node interaction.
+ **Persisting cosmetic node positions / auto-layout** → a build detail only if pulled; the model
  carries **no** view state ([[design-altitude-vs-build-home]]).
+ **Any model / contract / BE / engine change** — Phase A is FE-only over the existing tree.
+ **The dashboard theme** (the human's #2) → its own theme after canvas.

## Risks / unknowns

+ **Graph-render mechanism** (react-flow-style dependency vs. hand-rolled SVG/DOM) — a new peer dep
  is a real decision. _Mitigation: decide at the Design gate against the reuse invariant + allowed
  peer-deps; prefer the lightest that renders a real graph; flag the deviation at the gate commit._
+ **Visual surface, thin test coverage** — MSW/vitest can confirm "renders + toggles" but not
  "reads well." _Mitigation: hard-stop for human review in the app (Integration), per
  [[dfcfbi-f1-needs-human-review]]._
+ **Scope creep into editing** — the pull is strong; Phase A must stay read-only. _Mitigation: the
  acceptance criteria gate it; editing is R86._

## Do

### Plan-gate ratification (2026-06-18)

Ratified on "proceed r85". The round opens the **canvas theme** and builds **Phase A only** — the
**read-only source-graph VIEW** ([canvas.md § J-5](../../design/data-management/queries/canvas.md)) —
this round; Phases B (editing) and C ("New query") stay deferred to R86/R87. The scope, acceptance
criteria, and OUT-of-scope list above are accepted as-is.

**Trigger override recorded.** [canvas.md J-2](../../design/data-management/queries/canvas.md) banked
the canvas with the build DEFERRED, verdict **UNFIRED** (at R80's 2–4-node trees the hop-list still
read fine as a list; an agent-side brake). R85 **fires the build on the human's R85 product call** —
_"canvas is the #1 end-user-value feature (dashboards #2); the MVP only proved the concept."_ This is
the **accelerate** side of the [dynamic equilibrium](../../context/purpose.md#dynamic-equilibrium):
the authority opening the build is the **human pull**, not a hop-list-scaling pain signal. The human
partner, who owns the product intent, deliberately overrides the agent-side "unfired" verdict — a
legitimate move under the equilibrium ([[dont-mvp-rush-a-roadmap-home-surface]]: this is why Phase A
is built *right*, not MVP-rushed, in its proper round). canvas.md's "build DEFERRED to R81+" status
will be amended **in place** at the Design gate to reflect Phase A as it ships
([[design-docs-are-source-code]]).

**Phase-A scope confirmed sound against canvas.md** before ratifying:

+ **FE-only / F-only DCFBI** — Phase A renders the resolved `definition.joins` tree the builder
  already holds; **no** field/route/error-code/engine ([canvas.md J-3](../../design/data-management/queries/canvas.md)).
  `flow-selector` runs at the **Design gate** (not Plan) to confirm the F-only lean — its banked
  hypothesis, not a seal.
+ **Reuse invariant** — `QueryCanvas` binds to the shipped `useQueryBuilder`, rendered through
  `QueryBuilderPanel` over **one** working copy; re-implements no engine/predicate-editor/detail page
  ([canvas.md surfaces table](../../design/data-management/queries/canvas.md)).
+ **List stays the editor; canvas is additive** — accessibility default for assistive tech is the
  `[List]` view; the `[List] ⇄ [Canvas]` toggle is lossless over the same chain.

**Open items carried to the Design gate** (not blockers to ratification):

+ **Graph-render mechanism** — react-flow-style peer dep vs. hand-rolled SVG/DOM. A real build-home
  decision ([[design-altitude-vs-build-home]]); decide at the Design gate against the reuse invariant
  + allowed peer-deps (canvas.md declares only `react, antd` for `QueryCanvas`), flag any deviation at
  the gate commit.
+ **Re-confirm canvas.md's verdicts against the *current* builder** (`useQueryBuilder` /
  `QueryBuilderPanel` / `JoinEditor`, now under [queries.md](../../design/data-management/queries/queries.md)
  + [query-construction.md](../../design/data-management/queries/query-construction.md) after the R83/R84
  fold) before drawing against names that may have moved.

**Gates remaining**: Design → F → Integration (Integration hard-stops for **human review** in the
running app — a visual surface MSW/vitest can't fully judge, [[dfcfbi-f1-needs-human-review]]).

### Design-gate close (2026-06-18)

**Verdicts re-confirmed against the current builder.** Read the shipped code under
`workspace/apps/builder/src/features/data-management/queries/` (`useQueryBuilder.ts`,
`QueryBuilderPanel.tsx`, `JoinEditor.tsx`). canvas.md's J-1…J-5 hold: the canvas is a **mode**, not a
noun; `QueryCanvas` binds to `useQueryBuilder`'s `joins` and resolves each hop exactly as `JoinEditor`
does (via `useRelationshipsQuery` + `useDatasetsQuery` → `relById`/`dsNameById`). Two **code-drift**
points found and folded into canvas.md in place ([[design-docs-are-source-code]]):

+ `JoinStep.type` is shipped as `'inner' | 'left' | 'right' | 'full'` (`types.ts`), not "inner only" —
  canvas.md's model block corrected.
+ `useQueryBuilder` exposes only a **chain-wide** `relStale: boolean`, not per-hop; the **per-edge**
  stale state is FE-derivable from each resolved `Relationship.status` (`'valid'|'stale'`). Recorded as
  a code-reality note on canvas.md's stale-edge behaviour so the F gate builds the marker from
  `rel.status`, not an invented wire field.

**Graph-render mechanism → hand-rolled SVG/DOM** (human-confirmed at the gate). AntD-styled nodes
positioned by a small deterministic tree-layout fn; SVG edges with text labels. **No new peer dep** —
matches canvas.md's declared `react, antd`, so **no deviation to flag**; the lighter path
([[design-altitude-vs-build-home]]) for a bounded-small (2–4-node) tree. If Phase B (R86) drag-editing
needs a lib, that is R86's deviation against R86's evidence — not pre-committed now.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | Phase A is read-only; the only interactive branch is the `[List]⇄[Canvas]` toggle (+ a passive edge-stale alert). Editing branches are Phase B. |
| 2. New interaction pattern           | no     | No new *interaction*: a static node-link render + a standard AntD segmented toggle; drag/draw is Phase B. |
| 3. High user-error risk              | no     | Zero editing, zero destructive action — a read-only view; the list stays the editor. |
| 4. Contract depends on unresolved UI | no     | FE-only (J-3); renders the resolved `joins` the builder already holds — no wire field/route/error code. |
| 5. UX confidence below threshold     | no     | canvas.md is a sealed, verdict-reviewed design; Phase A is the lowest-risk slice, "reads-well" uncertainty mitigated by the Integration human-review hard-stop. |

Result: **Flow: DCFBI** (F-only — Phase A adds no contract/BE; confirms J-3's lean).

**`ui-design` (design-spec) on Phase A** — 5 pass / 1 gap. Findability, Usability, Accessibility,
Utility, Desirability **pass** (labelled toggle; text-not-colour nodes/edges; List = SR-complete
equivalent; token map reused). **Credibility gap**: the **no-joins/single-node** and **data-loading**
canvas states were undeclared. **Fixed in canvas.md** (new Phase-A trivial-states bullet: empty graph
renders the lone driving node; the canvas mounts on the builder's existing load — no invented spinner).
Re-review clean.

**canvas.md amended in place** (Design-gate task #4): Status now reads "Phase A building at R85; B/C
deferred" with the R85 build-decision note (mechanism + flow-selector); the phase-scoped "what this doc
specifies" blockquote; the `JoinStep.type` correction; the per-edge-stale code-reality note; the
Phase-A trivial-states declaration.

**F gate next**: build `QueryCanvas` (hand-rolled SVG/DOM, read-only) + the `[List]/[Canvas]` toggle in
`QueryBuilderPanel` over the one working copy; vitest + MSW for faithful render (a 2+-hop star) +
lossless toggle. No contract/BE work.

## Check (2026-06-18)

+ [x] Plan gate ratified on "proceed r85"; Do log records the scope (Phase A only), the **trigger
      override** (human pull fires R80's banked-unfired build), and the Phase-A soundness check
      against canvas.md (FE-only, reuse invariant, additive view).
+ [x] Phase-A scope verified consistent with [canvas.md J-3/J-5](../../design/data-management/queries/canvas.md):
      read-only, FE-only, F-only DCFBI lean, no model/contract/BE/engine change.
+ [x] **Design gate closed.** Verdicts re-confirmed vs. the current builder code (2 drift points
      folded into canvas.md); mechanism picked (**hand-rolled SVG/DOM**, human-confirmed, no peer-dep
      deviation); `flow-selector` run (**0/5 → DCFBI, F-only**); `ui-design` design-spec run (5 pass /
      1 Credibility gap, **fixed** in canvas.md); canvas.md amended in place to current-state.
+ [ ] _F gate (next step): build `QueryCanvas` (read-only SVG/DOM) + `[List]/[Canvas]` toggle; vitest
      + MSW for faithful 2+-hop-star render + lossless toggle; no contract/BE._

## Act

_Pending — filled at round close._

## Feeds into → canvas Phase B/C, then the dashboard theme

Phase A lands the read-only canvas view; **R86** adds editing (Phase B), **R87** the standalone
"New query" entry (Phase C). With the canvas theme delivering the #1 end-user value, the **dashboard
theme** (the human's #2) opens next, reading the clean single-spine Query model
([queries.md](../../design/data-management/queries/queries.md)).
