# Round 87: canvas Phase B — make the canvas an editor (draw-edge / delete-leaf, hop-list parity)

**Status**: **In Progress** — Plan gate **RATIFIED** (human-signed-off, 2026-06-18); **next gate: Design**.
Inherits the confirmed two-tab `Form`/`Canvas` home from [Round_86](Round_86.md) (Complete,
human-signed-off). This round turns the **read-only** Canvas tab into an **editor** at hop-list parity.
**Date started**: 2026-06-18
**Flow**: **DFCFBI (triggers 1, 2, 5)** — set at the Design gate via `flow-selector`; recorded in the Do
log. The genuinely-new column-pick interaction fires conditions 1 (>3 editing branches), 2 (new pattern),
and 5 (UX confidence — prototype-worthy), so the round carries an **F1 interactive-prototype checkpoint**
for human review before the FE is finished ([[dfcfbi-f1-needs-human-review]]). FE-only — **no
contract/BE/engine** ([canvas.md J-3](../../design/data-management/queries/canvas.md)).

## Goal

**Inherits from ← [Round_86](Round_86.md)** (the two-tab `Form`/`Canvas` builder shipped & signed off;
Canvas read-only) and **[canvas.md J-5 Phase B](../../design/data-management/queries/canvas.md)** /
handed-down build criterion #3: make the **Canvas tab an editor at hop-list parity** —

- **Draw an edge** — from an in-graph node to a **not-yet-joined** dataset → pick the governed `rel_` →
  `addJoin(relationshipId)`. The **connected-acyclic guard is unchanged** (eligibility = a `valid` `rel_`
  whose `leftDatasetId` is already in the graph and whose `rightDatasetId` is not — the **same set
  [JoinEditor.tsx](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx)
  already computes**).
- **Delete a leaf edge** — `removeJoin(relationshipId)`; a **non-leaf** edge's delete is **disabled with a
  text tooltip** (the shipped `removeJoinBlocked` reason), the same leaf rule the list enforces.

…over the **same** `useQueryBuilder` working copy, the **same** validation, and the **same** preview/Save
lifecycle. **No new model, route, error code, or engine** — direct-manipulation bindings onto ops the
builder already exposes (`addJoin` / `removeJoin`).

_Track: 1 (product feature). Pulled by ← R86's confirmed two-tab home + Phase A's in-app render
confirmation (the R85→R87 deferral trigger has fired) +
[canvas.md J-5 Phase B](../../design/data-management/queries/canvas.md). Per the
[Evolution Rule](../../AGENTS.md)._

## What is genuinely new vs. reused (the honest split — this round)

Per [canvas.md "honest split"](../../design/data-management/queries/canvas.md): the only genuinely-new
work is the **visual draw/delete UX on the hand-rolled SVG canvas**. Everything else is reuse, already
shipped:

| Reused verbatim (the true half) | Genuinely NEW this round (the visual UX only) |
| --- | --- |
| `useQueryBuilder.addJoin` / `removeJoin` / dirty-Save / preview lifecycle | **Direct-manipulation bindings** (draw → `addJoin`; delete-leaf → `removeJoin`) on the canvas |
| `JoinEditor`'s **eligibility** (`valid && left∈graph && right∉graph`) + `isLeaf` + the `removeJoinBlocked` tooltip | The same eligibility/leaf rules **rendered on a node/edge** instead of a `<Select>` row |
| `QueryCanvas`'s deterministic SVG/DOM tree-layout, node/edge render, per-edge `rel.status` stale marker | A **new-edge affordance** + a **per-leaf-edge delete affordance** drawn onto that render |
| The connected-acyclic guard + `409 relationship_stale` per-edge state | (nothing new — the guards/states already render) |

## The load-bearing Design-gate decision — interaction mechanism (drives the graph-lib question)

[canvas.md's Phase-B ASCII](../../design/data-management/queries/canvas.md) sketches "**⊕ drag from a node
to a not-yet-joined dataset**". But parity with the hop list does **not require true drag** — the list
achieves the same `addJoin` with a `<Select>` of eligible `rel_`s. Two mechanisms reach parity:

- **A — click-to-add (recommended first cut).** A node carries a `[+]`/`[+ Add a source]` affordance →
  opens a small picker (the **same** eligible-`rel_` `<Select>` `JoinEditor` already renders) → `addJoin`.
  A leaf edge carries a `[×]` delete control → `removeJoin`; non-leaf `[×]` disabled + tooltip. **No new
  peer dep** — pure AntD + the existing SVG/DOM render. Keyboard-reachable by construction. This is the
  **thin-but-not-rushed** parity cut ([[dont-mvp-rush-a-roadmap-home-surface]]): genuine canvas editing,
  zero bundle/lib risk, and it keeps the a11y story trivial (it **is** the list's controls, on the graph).
- **B — true drag-to-draw.** Literal pointer-drag from a node handle to a target → drop → pick `rel_`.
  More "canvas-native," but it is the interaction that **may force a graph-lib deviation** from the
  declared `react, antd` peer deps ([canvas.md surfaces table](../../design/data-management/queries/canvas.md))
  — exactly the deviation **R85's Design-gate note reserved for "R87's evidence."** It also carries the
  a11y burden (drag must have a keyboard-equivalent path — which collapses back toward mechanism A anyway).

**Recommendation: ship A this round (parity + zero lib risk), and let true-drag (B) be its own pull** if,
once A is in the app, the human judges drag worth the lib. This keeps R87 a clean, revertible editing
slice on the confirmed home and **defers the graph-lib deviation until there is real evidence it's
needed** ([[design-altitude-vs-build-home]]). **This is the human's call** — recorded here as the Plan
gate's one substantive scope question; the formal build-mechanism + any peer-dep deviation are sealed at
the **Design gate** against R87's evidence.

### Human's direction (2026-06-18) — "both", a TWO-STEP column-level interaction (DRAFT, pending research)

The human chose **neither A nor B as posed, but both, in two steps** (ER-diagram-style):

1. **Click to add an _entity_** (a dataset **or** a saved query) onto the canvas — a node, _placed first,
   not-yet-joined_.
2. **Draw a link/pointer _between the columns_** of two nodes to create the join.

> _"This just draft idea. Please research out there as well."_ — so this is a direction to **validate
> against how visual join / ER-diagram editors do it out there**, not yet a sealed mechanism.

**This is richer than parity and surfaces two genuinely-new design questions** (both are **Design-gate
calls against the research + the model**, flagged here so they aren't laundered):

- **(Q1) A placed-but-unjoined node.** Today the model is a **connected tree** rooted at `sourceId`; every
  non-root node is reached _via_ a join. A node placed before it's linked is **FE-only staging/view
  state** — it enters `joins[]` only when the column-link is drawn. Likely still **FE-only** (J-3 holds)
  **iff** the unjoined node is ephemeral and never persisted; to confirm at Design.
- **(Q2) Column-to-column linking = _pick_ a governed `rel_`, or _declare_ one?** Drawing a column pointer
  where a `valid` `rel_` **already exists** = selecting that rel = `addJoin` (FE-only, parity+). But
  drawing between columns with **no declared relationship** would mean **declaring a relationship inline**
  — which today lives in [relationships.md](../../design/data-management/workspaces/relationships.md)
  (governed edges, possibly BE) and is **outside the canvas's reuse invariant** ("the canvas _consumes_
  one governed `rel_` per edge"). **Recommendation: scope R87 to column-linking that _picks among existing
  governed `rel_`s_** (the join, drawn at column granularity); inline relationship _declaration_ is its
  own pull (touches governance/BE). To be sealed at the Design gate with the research in hand.

**Research is the next action** (below) — bring back how dbdiagram.io / drawSQL / Metabase notebook /
Prisma editors / Retool / Hasura / Supabase / n8n et al. do click-to-add-node + column-to-column join
drawing (interaction, graph-lib dependence, a11y/keyboard path, pick-vs-declare), to seal the mechanism
and the J-3 boundary at the Design gate.

### Research outcome (2026-06-18) — prior-art brief ([2026-06-18-r87-canvas-editing-prior-art.md](../brainstorms/2026-06-18-r87-canvas-editing-prior-art.md))

Surveyed dbdiagram.io, drawSQL, draw.io, Supabase Visual Schema Designer, MS Access/SSMS, Prisma editors,
Metabase, Hasura, Looker/dbt, n8n, and React Flow's own Database Schema Node. **The decisive finding is a
category split** that answers Q2 cleanly:

- **Schema-authoring tools** (dbdiagram, drawSQL, Supabase Designer, Access, SSMS, Prisma) — a drawn
  column→column link **DECLARES a new FK**. The diagram _is_ the schema.
- **Query/analytics tools** (Metabase, Hasura, Looker, dbt) — a join **PICKS / consumes an existing**
  relationship; it never alters the schema.

**Our canvas edits a _query's_ join tree → it is firmly in the query category.** So **(Q2 resolved →
PICK)**: column-linking **selects an existing governed `rel_`**; **inline relationship _declaration_ is
schema-authoring → [relationships.md](../../design/data-management/workspaces/relationships.md), a
separate pull, OUT of R87.** When no governed `rel_` matches the drawn column pair, the canvas **guides to
relationships.md** — it does **not** declare inline.

**On the graph-lib (the R85-reserved deviation):** **React Flow (`@xyflow/react`)** is the de-facto React
standard for this (Supabase Studio, Prismaliser, Hubql) and ships a **per-column-handle** node that draws
column→column edges out of the box — the closest match to the human's sketch. **But** (i) its ready-made
node is shadcn/Tailwind, not AntD (custom node work either way under
[design-token-parity](../../../scripts/lint/design-token-parity.mjs)); (ii) its a11y covers node
move/select, **not** the _connect_ gesture (a keyboard equivalent for "draw a link" is custom regardless);
and (iii) Metabase's **dropdown/pick-pair** approach is the most accessible of all and mirrors our "Form
tab stays the keyboard/SR-complete equivalent" rule.

**Evidence-backed recommendation (to seal at the Design gate, not pre-committed):** keep the human's
**two-step** shape (add entity node → connect at column granularity) with **PICK-existing-`rel_`**
semantics; **default to a lighter AntD-native, zero-dep _pick-pair_** (click source column → click target
column, or a small `<Select>` of eligible governed pairs) that is keyboard-accessible by construction and
tractable on our bounded-small (2–4-node) trees — **adopt React Flow only if a Design-gate prototype shows
the human strongly values literal drag + pan/zoom**, taken then as a flagged peer-dep deviation.

## Plan (by gate)

1. **Plan gate** — ratify: open Phase B editing on the Canvas tab; **decide the interaction mechanism**
   (A click-to-add vs B true-drag — recommendation: A); confirm scope = **draw-edge + delete-leaf parity
   only**, canvas stays a **second editor over one working copy** (Phase C "New query" stays **R88**).
   _(This step.)_
2. **Design gate** — re-confirm the shipped builder
   (`useQueryBuilder` `addJoin`/`removeJoin`/`canSave`, `JoinEditor`'s eligibility/leaf logic,
   `QueryCanvas`'s layout/render); run `flow-selector` (expect condition 2 to fire — DCFBI vs DFCFBI per
   the 2-of-5) and `ui-design` (design-spec) on the editing affordances (Findability of the add/delete
   controls; the disabled-non-leaf reason as text; keyboard reach + focus order on nodes/edges); **seal
   the build mechanism + any peer-dep deviation against evidence** ([canvas.md R85 note](../../design/data-management/queries/canvas.md));
   amend [canvas.md](../../design/data-management/queries/canvas.md)'s Canvas tab from "read-only at R86"
   to **editor at R87** ([[design-docs-are-source-code]]).
3. **F gate** (and F1 prototype checkpoint if DFCFBI) — bind the draw/delete affordances on `QueryCanvas`
   to `useQueryBuilder.addJoin`/`removeJoin`, reusing `JoinEditor`'s eligibility + leaf rules (extract the
   shared selector if it avoids duplication). vitest + MSW: draw-edge adds the hop & updates the live
   preview; delete-leaf removes it; non-leaf delete is disabled with the tooltip reason; an ineligible
   graph offers no edge (the `addJoinNone` state); Save stays correctly gated through the edit. **No**
   contract/BE work.
4. **Integration** — **human review** in the running app: editing on the canvas reads well and reaches
   hop-list parity, the guards (acyclic, leaf-only delete, stale-edge) behave as on the list, nothing
   feels lost vs. the Form editor ([[dfcfbi-f1-needs-human-review]]).

## Acceptance criteria

- [ ] **Draw-edge at parity** _(FE)_ — from an in-graph node, the user adds a hop to a not-yet-joined
      dataset by picking a governed `rel_`; this calls `addJoin` with the **same** eligibility set the
      list computes (`valid && left∈graph && right∉graph`); the connected-acyclic guard is unchanged.
- [ ] **Delete-leaf at parity** _(FE)_ — a **leaf** edge is removable (`removeJoin`); a **non-leaf** edge's
      delete is **disabled with a text tooltip** (the shipped `removeJoinBlocked` reason). Exactly the
      list's leaf rule, on the graph.
- [ ] **Live preview + Save gate hold through edits** _(FE)_ — every draw/delete updates the **same**
      debounced preview; `canSave` stays correct (a stale edge / invalid predicate still disables Save);
      the Canvas-tab status chip reflects the post-edit gate state ([Round_86](Round_86.md)).
- [ ] **One working copy; mode, not route** _(structural)_ — editing on the canvas and on the Form tab
      mutate the **one** `useQueryBuilder` copy; switching tabs after an edit loses nothing; no new
      page/state/model.
- [ ] **No new model / contract / BE / engine** _(structural)_ — FE-only over the existing `joins` tree;
      `addJoin`/`removeJoin` unchanged; no new wire field, route, or error code (J-3 held). **Any peer-dep
      deviation (graph-lib) is flagged + justified at the Design gate against evidence**, not assumed.
- [ ] **Accessibility** _(FE)_ — the add/delete affordances are labelled, keyboard-reachable controls in a
      defined focus order; the disabled non-leaf delete exposes its reason as **text** (`aria-disabled`,
      not a dead control); the Form tab remains the keyboard/SR-complete equivalent + AT default.
- [ ] **canvas.md is current-state** _(doc)_ — the Canvas tab is described as an **editor (R87)**, not
      "read-only at R86"; the Phase-B section reflects the shipped mechanism ([[design-docs-are-source-code]]).
- [ ] **Complete = human-signed-off** (canvas editing, run in the app).

## What is OUT of scope (this round)

- **Phase C — standalone "New query"** (empty-canvas create, place-the-first-node) → **R88**
  ([canvas.md J-4](../../design/data-management/queries/canvas.md)); depends on this round's add-a-source
  interaction.
- **Inline relationship _declaration_** — drawing a column link where **no** governed `rel_` exists must
  **not** mint one (that is schema-authoring →
  [relationships.md](../../design/data-management/workspaces/relationships.md), a separate pull). R87
  column-linking **picks an existing** governed `rel_` only; the no-match case guides to relationships.md.
- **A graph-library peer dep (React Flow / `@xyflow/react`)** — **only** if the Design-gate prototype
  shows literal drag-to-connect + pan/zoom is worth it; otherwise out (the recommended AntD-native
  pick-pair needs none). The evidence-backed default is **no lib**
  ([prior-art brief](../brainstorms/2026-06-18-r87-canvas-editing-prior-art.md)).
- **Persisting cosmetic node positions / auto-layout** — the model carries **no** view state
  ([[design-altitude-vs-build-home]]); a build detail only if pulled.
- **Self-joins / diamonds / re-ordering hops / left-vs-outer choice / composite keys** — the canvas edits
  the **same tree** the model already permits, no more ([canvas.md scope boundary](../../design/data-management/queries/canvas.md)).
- **Any model / contract / BE / engine change**; **the dashboard theme** (the human's #2) → after canvas.
- **The batched UI-bug-fixing round** (R86's deferred whole-page-scroll re-confirm + polish)
  ([[r-ui-bug-fixing-round]]) — a separate round, not folded in here.

## Risks / unknowns

- **Graph-lib deviation (the #1 question above).** True-drag (B) may need a lib, deviating from the
  declared `react, antd` peer deps. _Mitigation: recommend the click-to-add cut (A) — parity with zero lib
  risk; B becomes its own evidence-backed pull. The Design gate seals the mechanism + any deviation
  against R87's evidence, per [R85's reserved note](../../design/data-management/queries/canvas.md)._
- **New-interaction confidence (drives the flow).** Drag/draw is the genuinely-new pattern R86 deferred
  here; if confidence is below threshold, `flow-selector` may pick **DFCFBI** with an F1 prototype
  checkpoint. _Mitigation: that is the Design gate's call (condition 2 + maybe 5); A keeps confidence high
  by reusing the list's exact controls._
- **a11y of a graph editor.** Editing affordances on an SVG/DOM graph must stay keyboard-reachable with a
  defined focus order. _Mitigation: `ui-design` design-spec at the Design gate; A inherits the list's
  already-accessible controls._
- **Eligibility/leaf logic duplication.** Re-deriving eligibility/`isLeaf` on the canvas would fork the
  list's logic. _Mitigation: extract/share the selector from `JoinEditor` rather than copy it._

## Do

### Plan-gate draft (2026-06-18)

Drafted on "open R87". Proposed **scope = canvas editing (Phase B) at hop-list parity** — draw-edge
(`addJoin`) + delete-leaf (`removeJoin`, non-leaf disabled+tooltip) — on the Canvas tab of R86's
confirmed two-tab home, over the **one** `useQueryBuilder` working copy, FE-only (J-3 held). Phase C "New
query" stays **R88**.

**Human's direction**: **"both"** — click to add an _entity_ node, then draw a link **between columns** —
plus _"research out there as well"_. Recorded above as a two-step column-level interaction (DRAFT), with
two new design questions flagged (Q1 placed-but-unjoined node = FE staging; Q2 column-link = pick vs
declare).

**Research run** (the `research` skill) →
[prior-art brief](../brainstorms/2026-06-18-r87-canvas-editing-prior-art.md). Surveyed 11 tools + React
Flow. **Q2 resolved → PICK an existing governed `rel_`** (our canvas is a _query_ editor, not a schema
authoring tool; inline declaration → relationships.md, OUT of R87). **Graph-lib**: React Flow is the
standard for literal column-drag, but the evidence-backed default is the **lighter AntD-native, zero-dep
pick-pair** (accessible by construction, tractable on our 2–4-node trees); adopt React Flow only if a
Design-gate prototype shows drag/pan-zoom is worth the flagged deviation.

**Awaiting the human's ratification** on: (a) scope = canvas editing at parity, picking existing `rel_`s,
Phase C → R88; (b) the column-level two-step interaction with the pick-pair-default mechanism (lib
deferred to a Design-gate prototype). The Design gate then runs `flow-selector` + `ui-design` and seals
the mechanism + any deviation against the prototype.

### Plan-gate ratification (2026-06-18) — human-signed-off

The human **ratified both** substantive calls:

- **(a) Scope — ratified as drafted.** Phase B canvas editing at hop-list parity (draw-edge → `addJoin`,
  delete-leaf → `removeJoin`, non-leaf disabled+tooltip), FE-only over the one `useQueryBuilder` working
  copy, column-linking **PICKS an existing governed `rel_`** (inline relationship _declaration_ →
  [relationships.md](../../design/data-management/workspaces/relationships.md), a separate pull, OUT).
  **Phase C "New query" stays R88.**
- **(b) Mechanism — pick-pair default, lib deferred.** Ship the lighter **AntD-native, zero-dep pick-pair**
  (click source column → click target column / small `<Select>` of eligible governed pairs),
  keyboard-accessible by construction. **React Flow (`@xyflow/react`) held in reserve** — adopted only if a
  **Design-gate prototype** shows the human values literal drag-to-connect + pan/zoom enough to take the
  flagged peer-dep deviation ([R85's reserved note](../../design/data-management/queries/canvas.md)).

**Plan gate CLOSED.** Next action: the **Design gate** — re-confirm the shipped builder, run
`flow-selector` (expect condition 2 to fire) + `ui-design` (design-spec on the add/delete affordances),
prototype the column-draw to seal pick-pair-vs-React-Flow, and amend
[canvas.md](../../design/data-management/queries/canvas.md)'s Canvas tab from "read-only at R86" to
**editor at R87**.

**Gates remaining**: Design → F (+ F1 prototype if DFCFBI) → Integration (human-review hard-stop).

### Design-gate work (2026-06-18)

**Reuse surface re-confirmed** (Explore over the shipped builder): `addJoin(relationshipId)` /
`removeJoin(relationshipId)` are stable
([useQueryBuilder.ts:232-237](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L232-L237));
the eligibility set (`valid && left∈graph && right∉graph`) + `isLeaf` + `removeJoinBlocked` tooltip +
`addJoinNone` empty state all live locally in
[JoinEditor.tsx](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx)
(extractable for the canvas, not yet externalized); each governed `rel_` carries top-level
`leftColumn`/`rightColumn`
([relationships/types.ts](../../../workspace/apps/builder/src/features/data-management/relationships/types.ts))
— so **column-level pick-pair is fully expressible with no model change** (J-3 confirmed). `QueryCanvas`
already receives the working-copy `joins[]` and renders per-edge `rel.status` stale markers.

**canvas.md amended** ([[design-docs-are-source-code]]): Canvas tab "read-only at R86" → **editor at R87**;
added the **R87 Design-gate build decision** note (pick-pair, zero-dep, **no peer-dep deviation** — R85's
reserved deviation resolved to "none"); rewrote the Phase-B layout + behaviour to the **two-step
pick-pair** (stage node → column-pick → PICK existing `rel_` → `addJoin`; no-match guides to
relationships.md); extended the a11y section for column-granularity (focus order over columns +
`<Select>` as the keyboard/SR equivalent).

**`ui-design` (design-spec) run** on the editing affordances → initial **GAP (2: Findability,
Accessibility)** on the new column-granularity mechanism (column-pick learnability + column keyboard
path under-declared); **remediated in canvas.md** (row-highlight cue + hint + `<Select>` learnable
equivalent; column focus order + `<Select>` keyboard/SR equivalent + always-visible `[×]`) → **re-run
PASS (6/6)**.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | yes    | Editing adds ≥4 independent branches beyond R86's read-only states: add-via-column-pick, add-via-`<Select>`, `addJoinNone`, no-match→relationships.md guide, delete-leaf, non-leaf-delete-blocked. |
| 2. New interaction pattern           | yes    | Direct-manipulation column-to-column linking on the canvas is genuinely new; R86's canvas was read-only — no connect/draw gesture exists in-product. |
| 3. High user-error risk              | no     | Maps to `addJoin`/`removeJoin` under the unchanged acyclic + leaf-only guards; non-destructive until Save (Save-gated); recoverable. |
| 4. Contract depends on unresolved UI | no     | FE-only (J-3); `addJoin`/`removeJoin` unchanged, no new wire field — request/response shapes are untouched. |
| 5. UX confidence below threshold     | yes    | The column-pick gesture's feel is unproven in-product and the human reserved the React-Flow-vs-pick-pair call pending an interactive prototype (the brief's "prototype the column-draw" recommendation) — a genuine open UX question. |

Result: **Flow: DFCFBI (triggers 1, 2, 5)** — an **F1 interactive-prototype checkpoint** before the FE is
finished. F1 is where the human sees pick-pair working and the React-Flow-in-reserve question is resolved
against real evidence ([[dfcfbi-f1-needs-human-review]]).

## Check

_(Filled as the gates close — verification against the [Acceptance criteria](#acceptance-criteria).)_

- [x] **Design gate** — builder re-confirmed (`addJoin`/`removeJoin`/`canSave`, `JoinEditor` eligibility +
      leaf, `QueryCanvas` layout); `flow-selector` run → **DFCFBI (1,2,5)**; `ui-design` (design-spec) on the
      add/delete affordances → remediated → **PASS 6/6**; mechanism sealed = **pick-pair, zero-dep** (no
      lib); the React-Flow-vs-drag call moves to the **F1 interactive-prototype** (DFCFBI); canvas.md
      amended to "editor at R87".
- [ ] **F gate** (+ F1 prototype checkpoint if DFCFBI) — draw-edge / delete-leaf bound to the builder;
      vitest + MSW green (add hop + live preview; remove leaf; non-leaf delete disabled + tooltip;
      `addJoinNone` ineligible state; Save stays gated). No contract/BE work.
- [ ] **Integration** — human review in the running app: canvas editing reaches hop-list parity; guards
      (acyclic, leaf-only delete, stale-edge) behave as on the list.

## Act

_(Filled at round close.)_

**Learnings**: TBD.

**Promotions** _(if none: write as plain text, not checkboxes)_: TBD at close.

**Follow-ups (not promotions, just notes):**

- Phase C standalone "New query" → **R88** (depends on this round's add-a-source interaction).
- True drag-to-connect via React Flow → its own evidence-backed pull, only if the Design-gate prototype
  showed it worth the peer-dep deviation.
- Inline relationship _declaration_ → a [relationships.md](../../design/data-management/workspaces/relationships.md)
  (schema-authoring) pull, OUT of R87.

## Feeds into → Round_88 (canvas Phase C "New query") (TBD)

The shipped canvas **editor** (draw-edge + delete-leaf at parity, pick-pair mechanism over one
`useQueryBuilder` copy) and its add-a-source interaction become R88's foundation for the standalone
"New query" empty-canvas create flow. Any Design-gate verdict on the graph-lib (pick-pair vs React Flow)
hands forward as the sealed mechanism R88 inherits.
