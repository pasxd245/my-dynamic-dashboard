# Round 85: canvas theme-opener — build Phase A (the read-only source-graph view)

**Status**: Planning — Plan gate (this step), awaiting ratification ("proceed r85").
**Date started**: 2026-06-18
**Date completed**:
**Flow**: **Track-1 product feature** (the canvas theme's first build round). Per
[canvas.md J-3](../../design/data-management/queries/canvas.md), Phase A is a **frontend-only**
slice (render the existing `joins` tree; no contract/BE/engine change) → an **F-only DCFBI** lean;
`flow-selector` runs at the **Design gate** to confirm. Gates: **Plan → Design → F → Integration**.

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

_Pending — filled when the Plan seam is ratified ("proceed r85")._

## Check

+ [ ] _(Pending.)_

## Act

_Pending — filled at round close._

## Feeds into → canvas Phase B/C, then the dashboard theme

Phase A lands the read-only canvas view; **R86** adds editing (Phase B), **R87** the standalone
"New query" entry (Phase C). With the canvas theme delivering the #1 end-user value, the **dashboard
theme** (the human's #2) opens next, reading the clean single-spine Query model
([queries.md](../../design/data-management/queries/queries.md)).
