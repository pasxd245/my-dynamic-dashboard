# Round 97: Canvas polish — large-screen fill + compact edge info-box

**Status**: **Complete** — human-signed-off 2026-06-26 ("well done, please flip to complete"). DFCFBI;
F1 eyeballed across iterations (canvas fill #004→fixed, zoom, node icons, edge box, unstage) + the
"Build on" tooltip minor; design-sync done (canvas.md · query-construction.md); Contract/Backend
no-change; F2 green. **5 canvas tweaks + 1 minor JoinEditor fix**, all FE-only.
**Date started**: 2026-06-25
**Date completed**: 2026-06-26
**Flow**: **DFCFBI** — `flow-selector` returned DCFBI (only cond 5), human **accepted the DFCFBI
recommendation**: Item 1 (canvas large-screen fill) can't be confirmed by static reasoning (React Flow
sizing), so a mid-round **F1 large-screen eyeball** earns its keep. Runs [D + F1 + design-sync] then
[C + B + F2 + Integration] ([[dfcfbi-two-round-split]]).

## Goal

Two cohesive **canvas UX** improvements on the query builder's Canvas tab (`QueryCanvas`):

1. **Large-screen fill** — the canvas under-fills a tall viewport (it falls back toward its
   `minHeight: 440` floor instead of expanding). Make it fill the available space.
2. **Compact edge info-box** — the relationship/edge box is too big and hard to read; replace it with
   a small cardinality badge that expands (on click) to the full detail + actions.

_Track: 1 (product — canvas UX polish on a shipped surface)._
_Pulled by ← R96 deferred canvas-fill candidate + the human's edge-box readability ask. Per the
[Evolution Rule](../../AGENTS.md)._

## Scope posture

**These two canvas items — nothing more.** They are **independently shippable** (separate concerns:
layout sizing vs edge component) — keep them as separate gate steps / commits so a problem in one
doesn't force discarding the other ([[round-bundling-revert-seams]]).

## Item 1 — Canvas large-screen fill

+ **Symptom** — on a large/tall viewport the canvas does not fill the available container; it sits
  near its minimum.
+ **Cause (grounded)** — `QueryCanvas` root is `minHeight: 440` + `height: '100%'`
  ([QueryCanvas.tsx:954-965](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L954)).
  `height: 100%` only resolves against a **definite-height** ancestor; the builder/canvas host uses
  `PageContainer fill` = **grow / `min-height`** (R95), which doesn't give a definite height — so the
  canvas falls back toward its `minHeight: 440` floor. (React Flow needs a measured/definite pane.)
+ **Direction (the layout-primitive exercise)** — this is the **first deliberate growth of the layout
  vocabulary** ([[layout-is-the-architecture]]): introduce an **`Expanded`-style "fill a
  definite-height parent"** primitive (or make the canvas host bounded when the Canvas tab is active),
  rather than a one-off `height` patch. Ground the approach at the Design gate; **eyeball on a real
  large screen** (React Flow sizing fools static reasoning). See
  [layout brainstorm](../brainstorms/2026-06-25-layout-as-architecture.md).

## Item 2 — Compact edge info-box (cardinality badge → expandable detail)

+ **Symptom** — the edge/relationship box on the canvas carries all its info inline; it's **too big**
  and sometimes hard to view.
+ **Direction (the human's spec)** — collapse the edge to a **small cardinality badge**, sized like
  the existing **"Free-form" item**; **on click**, expand an info box showing:
  + **on** — column ↔ column (as today)
  + **join type** — inner | left | … (the hop type)
  + **relationship** — 1:1 | 1:n | n:n (the declared **cardinality**)
  + **relationship type** — free-form / governed
  + **actions** — **Promote**, **Remove**
+ **Grounded (FE-only)** — the query-edge **already carries everything** the spec lists:
  `QueryRelationship.cardinality` ([types.ts:38](../../../workspace/apps/builder/src/features/data-management/queries/types.ts#L38)),
  the key-pair, join/hop type, and free-form/governed; the current edge label already renders
  `key-pair · cardinality · type · governed/free` and a click reveals a context pad of actions
  ([QueryCanvas.tsx:394](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L394)).
  So this is a **presentation/compaction** change — no contract/backend.
+ **Free-form cardinality — RESOLVED (no fallback needed):** a free-form drawn pair gets an
  **inferred default cardinality** at draw-time (R90,
  [joinGraph.ts:286](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts#L286)),
  so every edge always has a cardinality to badge.
+ **Preserve, don't drop:** the existing actions are **Promote · Re-sync · Remove** — the spec named
  Promote/Remove, but **Re-sync** (for a diverged copied edge, R89) must stay, shown **conditionally**
  (only when the copied edge has diverged). The divergence/governed/free-form **state variants** of the
  edge must survive the redesign.

## Plan (by gate — tentative until Design)

1. **Design gate** — ground both items; for Item 1 decide the layout-primitive vs bounded-host
   approach; for Item 2 write the per-element spec (collapsed badge ↔ expanded box) + resolve the
   free-form-cardinality fallback; `flow-selector`; `ux-design`/`ui-design` review as available. **Human ratify.**
2. **(F1 if DFCFBI)** — FE prototype; **human eyeball** (Item 1 on a large screen; Item 2 the
   badge/popover feel).
3. **Contract / Backend** — expected **none** (both FE).
4. **Frontend / F2** — implement; touched tests; gates green.
5. **Integration** — human re-check; design docs synced (canvas.md); Complete.

## Acceptance criteria (finalize at Design)

+ [ ] **Item 1** — the canvas fills a large/tall viewport (no under-fill to the `minHeight` floor);
      keeps the min size + the R93 maximize on small screens. Verified on a real large screen.
+ [ ] **Item 2** — the edge shows a compact cardinality badge (1:1/1:n/n:n), sized like the Free-form
      item; clicking expands the detail (on · join type · relationship · relationship type) + Promote /
      Remove; Promote stays governed-boundary-correct (R94 D5).
+ [ ] FE-only (no contract/backend); both items independently revertable; gates green
      (type-check · vitest · prettier · design/markdown/link).

## Risks / unknowns

+ **React Flow sizing** (Item 1) — `height:100%` vs `flex:1` vs a definite-height host behaves
  differently; needs a real large-screen eyeball, not static reasoning.
+ **Free-form edge cardinality** (Item 2) — see the Design grounding note; pick a fallback, don't
  silently add a model field.
+ **Edge popover interaction** (Item 2) — click-to-expand on a React Flow edge (vs the current inline
  box) needs the open/close + Promote/Remove wiring re-checked; keep the keyboard/SR path.

## Do

### Plan-gate draft — opened from the R96 split + human ask (2026-06-25)

R96 deferred the canvas-fill candidate; the human added the edge info-box readability redesign and
asked to open a canvas round for both. Opened here; both grounded above.

### Design-gate — approach + skills (2026-06-25)

**Item 1 approach (to ratify):** introduce a small **`FillPane`-style layout primitive** in `@mdd/ui`
(an `Expanded`-equivalent: a flex child that fills a definite-height parent) — the canvas host wraps
the canvas in it so React Flow gets a resolved height instead of falling back to `minHeight: 440`.
The host must present a *definite* height on the Canvas tab; mechanism (bounded host when canvas-active
vs. a self-contained fill) is **verified at F1 on a real large screen** (React Flow sizing fools static
reasoning — this is exactly the [[layout-is-the-architecture]] vocabulary-growth exercise).

**Item 2 spec (to ratify):** collapsed = a cardinality badge (1:1/1:n/n:n) sized like the
free-form/governed tag; click → an expandable box: `on` (col↔col) · join type · relationship
(cardinality) · relationship type (free-form/governed) · actions **Promote / Remove / Re-sync**
(Re-sync conditional on divergence). Compaction of the existing edge label + context pad — preserve
the governed/free-form/diverged state variants.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition | Fired? | Justification |
| --- | --- | --- |
| 1. >3 independent states/branches | no | The edge's state variants (free-form/governed/diverged) + actions already exist; the redesign re-presents them — ~3 existing branches, not >3 new. |
| 2. New interaction pattern | no | Click-edge → reveal actions already exists (context pad); compact-badge→expand is an evolution, not a new pattern. |
| 3. High user-error risk | no | Promote/Remove already exist with the R94-D5 boundary + confirmations; the redesign adds none. |
| 4. Contract depends on unresolved UI | no | Both items FE-only (cardinality modeled; canvas sizing is layout). |
| 5. UX confidence below threshold | yes | Both are visual/feel on the canvas — Item 1 especially (React Flow sizing needs a real large-screen eyeball); Item 2 the badge/popover feel. |

Result: **Flow: DCFBI** (only cond 5). **But Item 1 has a strong DFCFBI case** — React Flow sizing
genuinely can't be confirmed by static reasoning, so a mid-round **F1 large-screen eyeball** is worth
considering (human's call at ratification, as R95).

**`ui-design --design-spec` (Item 2)** — Utility/Desirability pass (reuses tokens, matches the
free-form tag). **Gaps to declare:** (a) *Findability* — the collapsed badge must **signal it's
clickable** (cursor/hover cue), not a bare tag; (b) *Accessibility* — the expand + actions must be
**keyboard-reachable + SR-named** (preserve the existing edge keyboard/SR path); (c) *Credibility* —
the **diverged/Re-sync** state must survive (don't drop it in the compaction).

**HARD-STOP — human Design ratification** before any build, on: (1) the Item 1 approach (`FillPane`
primitive) and the flow (accept DCFBI, or DFCFBI for the Item-1 large-screen F1); (2) the Item 2 spec
including preserve-Re-sync and the three ui-design affordances (clickable cue, a11y, diverged state).

### Design gate — RATIFIED (human, 2026-06-25); F1 build done (2026-06-26)

"confirm, pls proceed" — approach + Item-2 spec ratified; **flow DFCFBI** (accepted the recommendation
— Item 1 needs a real large-screen eyeball). F1 prototype (FE-only, no wire change):

+ **`@mdd/ui` `FillPane`** — an `Expanded`-style primitive (`flex:1 1 auto; minHeight; flex column`,
  optional `scroll`); the first of the layout-primitive vocabulary ([[layout-is-the-architecture]]).
+ **Item 1** — `CanvasTab` wraps the canvas in `<FillPane scroll>`; `QueryCanvas` root `height:100%`
  → `flex:1 1 auto` (keeps the `minHeight:440` floor + R93 maximize). The canvas now fills via the
  flex chain instead of unreliable percentage-height.
+ **Item 2** — `RelEdge`: at rest a **compact cardinality badge** (`Tag`, sized like the free-form
  tag) + a warn icon when diverged/stale; click → an **expandable info-box** (`EdgeInfoRow`: On ·
  Join type · Relationship · Relationship type) + the actions row (**Promote · Re-sync · Remove**,
  Re-sync conditional on divergence). ui-design affordances: badge `role="button"` + `aria-label`
  (cardinality · type), `cursor:pointer` + selectTip tooltip; diverged/Re-sync state preserved. 4 new
  i18n keys (en + vi). Two edge tests updated (key-pair now read from the expanded pad).

**Verified (automated):** `@mdd/ui` + builder type-check clean; builder vitest **196/196** (incl. i18n
parity), `@mdd/ui` **26/26**.

**HARD-STOP — human F1 eyeball** ([[dfcfbi-f1-needs-human-review]]): run `pnpm dev`, open a query in
edit → Canvas tab. (1) **Item 1** on a **large/tall screen** — the canvas fills the space (no
under-fill to the 440 floor); small screen still scrolls + maximizes. (2) **Item 2** — edges show a
compact cardinality badge; clicking expands the info-box + actions; Promote/Remove/Re-sync work; the
diverged (warn) state still reads. Then → design-sync → C/B/F2/Integration.

### F1 eyeball #1 — findings + fixes (2026-06-26)

Human eyeballed; four fixes applied (still F1 — no commit):

+ **Item 1 still under-filled — root cause found.** `FillPane` was necessary but not sufficient: the
  React Flow pane was **height-clamped** (`height: clamp(420px, 60vh, 640px); flex: 0 0 auto`) — a
  640px cap that never filled. Changed the pane to `flex: 1 1 auto; minHeight: 420` (fills via FillPane;
  floor keeps it "always real" + FillPane scrolls below it). The clamp was the real culprit; this is
  the fix to re-verify on a large screen.
+ **Cardinality badge — drop the background.** Collapsed badge is now **plain text** (no `Tag` fill);
  a faint chip remains only for canvas readability + click affordance.
+ **Box is "modal"-like.** Added a **close [×] (circle) top-right**; the collapsed badge **hides while
  the box is open** (not both at once); the box **animates in** (`canvasEdgeBoxIn`).
+ **Remove is a labelled link** (like Promote), not a bare `[×]` icon (`type="link" danger`,
  `data-component="CanvasEdgeDelete"` preserved).

**Verified (automated):** type-check clean; builder **196/196** (2 edge tests already read the key-pair
from the expanded box); `@mdd/ui` **26/26**. **Re-eyeball needed** (Item 1 fill especially).

### F1 eyeball #2 — React Flow error #004; Item 1 re-fixed (2026-06-26)

Human re-eyeballed: **React Flow #004 "parent needs a width and a height"** — my `FillPane`/flex-fill
approach was the **wrong tool**: React Flow needs a *definite* height, and the `fill=true`
(`min-height`) host doesn't give the flex chain one → the pane collapsed to 0. **The original
structure was right except the `640px` cap.** Fix: the pane keeps an explicit height, now
**viewport-relative** — `clamp(420px, calc(100svh − 280px), 2400px)` — so it's **definite (no #004)**
*and* **fills** large screens (the old `clamp(…, 60vh, 640)` capped at 640). **`FillPane` pruned**
(no consumer; the layout-vocabulary lesson: React Flow wants a definite height, not an `Expanded`).
Item 2 (compact box) unchanged. **Re-eyeball Item 1 fill** (the ~280px chrome offset is tunable).

**Verified (automated):** `@mdd/ui` + builder type-check clean; builder **196/196**; `@mdd/ui` **26/26**.

**F1 eyeball #3 — canvas init zoom (2026-06-26):** with the larger pane, `fitView` zoomed the small
graph to React Flow's default **maxZoom 2×** ("init is max level, quite big"). Capped the fit at **1×**
(`fitViewOptions={{ padding: 0.2, maxZoom: 1 }}` + the on-change re-fit) so nodes init at natural size.
Type-check clean. Re-eyeball the init zoom.

**F1 eyeball #4 — default node icon (2026-06-26):** datasets had no node icon (queries used a `🔎`
emoji). Added a **default icon by kind** — `TableOutlined` (dataset) / `FilterOutlined` (query),
mirroring the nav — replacing the emoji; `aria-hidden` (the type Tag carries the accessible name).
Ready for a per-dataset icon field later (default applies when unset). type-check + builder **196/196**.

**F1 eyeball #5 — remove an unconnected staged source (2026-06-26):** a staged source was only
removed from `staged` when **connected** (a join drawn); stage-and-don't-connect left it stuck (the
only escape was a tab-switch, which unmounts the canvas and clears *all* staged). Added a **[×] on a
staged + editable node** → `setStaged` filter (pure canvas state; no definition/save impact);
`stopPropagation` so it doesn't start a node-drag. New i18n `canvasUnstageSource` (en+vi). type-check +
builder **196/196**.

_R97 F1 now carries 5 canvas tweaks (fill · zoom · node icon · edge box · unstage) — all small + same
surface + same eyeball loop, but the round is full. Close R97 after the human's pass; further canvas
ideas → a fresh round (keep this one revertable, [[round-bundling-revert-seams]])._

### Minor issue — "Build on" tooltip (JoinEditor, not canvas; human's call to fold in, 2026-06-26)

Not a canvas item — a `JoinEditor` (Form tab) copy nit the human flagged: the tooltip on the
**disabled** "Build on" picker (R94-D6 `baseSourceFixedHint`) was "not useful at all" — verbose, and
it restated what the disabled state already conveys, with an easy-to-miss "Build on this query"
pointer. The field is disabled because **changing a query's base is the deferred D6 create-flow
feature**; the tooltip is its stopgap. **Fix (human's call — just remove it):** dropped the `Tooltip`
wrapper on the disabled "Build on" `Select` entirely — the disabled state already conveys "can't change
here" — and **pruned the now-unused `baseSourceFixedHint`** key (en + vi). `Tooltip` import stays (used
elsewhere in `JoinEditor`); no test asserted the hint. _(Folded in on the human's explicit call,
overriding the usual [[batch-ui-bugs-into-one-round]] discipline for this one-liner.)_

### design-sync + finalize (2026-06-26)

design-sync (canvas.md + query-construction.md) reconciled to the build: edge → compact cardinality
badge + expandable info-box; node default kind-icons (table/filter, `🔎` dropped); staged-node `[×]`
unstage; pane viewport-relative height + `fitView` maxZoom 1; the disabled "Build on" picker tooltip
dropped. **Contract/Backend: no change** (FE + docs only). **F2:** no rework after the F1 eyeball.
**Verified:** `@mdd/ui` + builder type-check clean; builder vitest **196/196**; `@mdd/ui` **26/26**;
design:lint/tokens 0 · markdownlint 0 · check:links clean.

## Check

+ [x] **Design gate** — **RATIFIED** (human, 2026-06-25): approach + Item-2 spec; flow **DFCFBI**.
+ [x] **F1 gate** — **CONFIRMED** (human, 2026-06-26) across iterations (fill #004→fixed · zoom · node
      icons · edge box · unstage); automated-verified throughout.
+ [x] **design-sync** — **done** (canvas.md · query-construction.md; doc gates 0).
+ [x] **Contract / Backend** — **no change** (FE + docs only).
+ [x] **F2 gate** — **closed**: no rework after F1; full gates green.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-26** ("well done, flip to
      complete"). The DFCFBI F1 eyeball caught the real bugs (React Flow #004, over-zoom, stuck staged
      node) that static reasoning + green gates couldn't.

## Act

R97 polished the canvas through a tight DFCFBI F1 eyeball loop — five tweaks (fill · zoom · node icons
· compact edge box · unstage) + one minor JoinEditor fix (Build-on tooltip). Carried lessons:

+ **The F1 eyeball earned its keep, repeatedly** — it caught **React Flow #004** (flex chain collapse),
  the **over-zoom** (fitView maxZoom 2×), and the **stuck staged node** — none visible to static
  reasoning or green gates ([[dfcfbi-f1-needs-human-review]]). The human's deliberate DFCFBI choice
  (over the selector's DCFBI) was vindicated.
+ **`FillPane` was a wrong turn, pruned** — the canvas-fill exercise was meant to grow the
  layout-primitive vocabulary ([[layout-is-the-architecture]]), but **React Flow needs a *definite*
  height**, not a flex-`Expanded`; a flex chain off a `min-height` host collapses → #004. The fix was a
  **viewport-relative definite height** (`clamp(420px, calc(100svh − 280px), 2400px)`). Lesson: match
  the primitive to the consumer's sizing model — don't force flex-fill where a definite height is
  required. (Memory + brainstorm updated.)
+ **Scope held** — 5 cohesive canvas tweaks in one F1 loop is the cap; further canvas ideas → a fresh
  round so R97 stays a clean revert seam ([[round-bundling-revert-seams]]).

## Feeds into → Round_98+

+ **`ux-design` rename + `ui-design` (layout) skill** — the layout-primitive vocabulary did **not**
  grow here (FillPane pruned — React Flow needs a definite height, not an `Expanded`); the first real
  primitive is still TBD. Codify the layout-review skill once the vocabulary stabilizes (see the
  [layout brainstorm](../brainstorms/2026-06-25-layout-as-architecture.md)).
+ **Per-dataset node icon** — R97 added a default kind-icon; a custom per-dataset icon field could
  override it later.
+ Value-out themes — consumer-save / Excel, then dashboards ([[post-mvp-roadmap-migration-first]]).
