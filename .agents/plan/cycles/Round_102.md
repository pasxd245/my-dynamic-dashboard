# Round 102: Widget reorder + arrange — drag to order dashboard widgets

**Status**: Complete
**Date started**: 2026-06-28
**Date completed**: 2026-06-28
**Flow**: **DCFBI** — set at the Design gate via `flow-selector`; recorded in the Do log. Contract-free
(FE-only) round, so Contract + Backend are no-ops; the drag feel is checked at the Check visual gate.

## Goal

**Inherits from ← [Round_101](Round_101.md)** — R101 shipped the dashboard as a persisted noun with a
formula-free widget builder and a **per-widget `span`** (1–3 cols of a 3-col grid), but **reorder was
explicitly deferred** (the widgets render in `definition.widgets[]` array order, with no way to change it
from the UI).

Let a user **drag to reorder** the widgets on a dashboard so the layout reflects how they want to read it,
and **persist** that order (survives reload / live re-run). Stays **formula-free** and pointer-simple — no
new vocabulary, just arranging what's already there.

_Track: 1 (product). Pulled by ← R101 Feeds-into (reorder deferred to the dynamic-widgets work) + the
human's R102 theme pick. Per the [Evolution Rule](../../AGENTS.md)._

## Design decisions (ratified — human, 2026-06-28)

1. **Scope = reorder (linear sequence), NOT 2D arrange.** Drag changes the order of
   `definition.widgets[]`; the existing 3-col grid reflows (each widget keeps its `span`). **No contract /
   backend / migration change** — `PUT /dashboards/{id}` already persists the full definition. This is a
   **frontend-only** round on the R101 contract. 2D free placement (persisted positions) is deferred to a
   later round if pulled.
2. **DnD mechanism = `@dnd-kit`** (`@dnd-kit/core` + `@dnd-kit/sortable`). Chosen over native HTML5 drag
   because it ships keyboard + touch sensors and accessible live-region announcements — reorder works for
   keyboard/mobile out of the box (native would hand-roll both, missing the Accessibility bar). One added
   dependency, justified by a named need (accessible drag) — the least mechanism that *meets* the bar.
3. **Drag affordance = an explicit drag handle** on each widget card (not whole-card drag), so the
   existing ⋯ menu (edit / remove) and the interactive chart keep their clicks. The handle is
   keyboard-focusable (dnd-kit keyboard sensor).
4. **Persistence = one `PUT` on drop** (not per-drag-frame): the drop commits the reordered
   `definition.widgets[]` via the existing full-representation update, with optimistic reorder +
   invalidate (mirrors the other widget mutations).
5. **Flow** — set at Design exit via `flow-selector` (below).

## Declared affordances + states (for `ux-design --design-spec`)

The build must carry these (declared now so they aren't discovered late):

- **Drag handle** — a visible, labelled grab affordance per widget card (e.g. a drag icon with an
  accessible name like "Reorder ‹title›"); cursor changes to indicate draggability.
- **Keyboard reorder** — the handle is focusable; arrow keys (dnd-kit keyboard sensor) move the widget;
  an accessible announcement reports the new position ("‹title› moved to position 2 of 3"). Not
  pointer-only.
- **Drag feedback** — a drag overlay / placeholder shows where the widget will land (Usability); the
  rest of the grid reflows live.
- **Single-widget no-op** — with one widget, the handle is absent or inert (nothing to reorder).
- **Persistence + failure** — order persists across reload (survives the live re-run); a failed `PUT`
  reverts the optimistic order + surfaces an error (reuse `common.error`).
- **Accessibility / Desirability** — handle has a visible label + accessible name; reorder is
  keyboard-reachable; AntD components + theme tokens (no ad-hoc styling).

## Plan (finalized at Design — 2026-06-28)

1. **Design gate** — ratify scope (the two open questions below), pick the DnD mechanism, run
   `flow-selector` + `ux-design --design-spec`. **Human ratify.**
2. **Build** — per the flow the selector picks. If scope = **reorder-sequence** (most likely), this is a
   **frontend-only** round on the existing contract: drag reorders `definition.widgets[]`, the drop
   persists the whole definition via the existing `PUT /dashboards/{id}` (full-representation). The grid
   already reflows from array order (`DashboardDetailPage` + the `span` Col mapping).
3. **Verify** — reorder persists across reload; keyboard-accessible; type-check + tests + build green;
   human app-run.

## Acceptance criteria

- [x] A user can **drag a widget (by its handle) to a new position**; the 3-col grid **reflows** (spans
  respected) and the new order **persists** (survives reload / live re-run). _Human-tested 2026-06-28._
- [x] Reorder is **keyboard-accessible** (focus the handle → arrow keys move it) with an accessible
  announcement of the new position — not pointer-only (dnd-kit KeyboardSensor + live-region).
- [x] The drag handle does **not** swallow the widget's ⋯ menu (edit / remove) or chart interactions
  (handle is the sole drag activator; PointerSensor distance:4).
- [x] With a **single widget**, the handle is absent / inert (`canReorder = ordered.length > 1`).
- [x] A **failed save reverts** the optimistic order and surfaces an error; no silent loss.
- [x] **No contract / backend / migration change** — reorder persists via the existing
  `PUT /dashboards/{id}`. Type-check + 210 tests + build green; human app-run confirmed the feel.

## Risks / unknowns

- **Scope fork (the headline Design question): reorder vs arrange.**
  - **Reorder (linear sequence)** — change the `widgets[]` order; the 3-col grid reflows. **No contract
    change** (the array order already *is* the render order; `PUT` already persists it). Lean, FE-only.
  - **Arrange (2D free placement)** — persist an explicit per-widget position (row/col or x/y/w/h). This
    is a **contract + backend change** (new `Widget` position fields + migration) and a bigger model
    (collision/packing rules). _Provisional lean: **reorder-first**; 2D-arrange is a later round if pulled
    — don't MVP-rush a bigger surface ([[dont-mvp-rush-a-roadmap-home-surface]])._
- **DnD mechanism** — no sortable lib is in `deps` today (only `@xyflow/react`, which is graph-canvas, not
  a grid sorter). Options: **native HTML5 drag** (no dep, but fiddly touch + a11y), **`@dnd-kit/sortable`**
  (a dep, but keyboard + touch sensors built in), or AntD's dnd-kit-based list pattern. Adding a dep is a
  brake-worthy call (least-mechanism) — decide at Design.
- **Accessibility** — drag-only reorder fails keyboard users; need a keyboard path (move up/down, or
  dnd-kit's keyboard sensor). Don't ship colour/pointer-only.
- **Persistence granularity** — persist once on drop (one `PUT`), not per-drag-frame; optimistic update +
  invalidate, like the other widget mutations.
- **Edit/remove coexistence** — the widget card already has a ⋯ menu (edit/remove) + the chart is
  interactive; the drag handle must not swallow those clicks (explicit handle vs whole-card drag).

## Open Design questions (resolve at the Design gate)

1. **Reorder (sequence, contract-free) or Arrange (2D, contract change)?** — provisional: reorder.
2. **DnD mechanism** — native HTML5 vs `@dnd-kit` vs AntD pattern (dep vs no-dep; a11y).
3. **Drag affordance** — whole-card drag vs an explicit drag handle (so edit/remove + chart interactions
   still work).
4. **Flow** — DCFBI vs DFCFBI (set via `flow-selector` once scope is fixed; a contract-free reorder with a
   new drag interaction likely wants an F-phase feel-check but no Contract).

## Do

### Plan-gate draft — opened from R101 (2026-06-28)

R101 Complete + signed off; reorder was its #1 explicit deferral. Human picked **widget reorder + arrange**
as the R102 theme. Drafted the goal, the reorder-vs-arrange scope fork, the DnD-mechanism + a11y risks, and
the open Design questions. **Next: human Design-gate kickoff** (ratify scope → `flow-selector` →
`ux-design --design-spec`).

### Design gate kicked off — decisions ratified (human, 2026-06-28)

Human ratified scope = **reorder-sequence** (contract-free, FE-only) + DnD = **`@dnd-kit`**. Drag affordance
= explicit handle; persist one `PUT` on drop. All 4 decisions above ratified; affordances/states declared.
**Next: `flow-selector` + `ux-design --design-spec`, then human signs the Design gate.**

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                          |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | Reorder adds the standard drag lifecycle (drag → overlay → drop/persist), not >3 independent branches; loading/empty/grid states are R101's. |
| 2. New interaction pattern           | yes    | First sortable drag-reorder in the product (R89's React Flow is graph-node manipulation, not list/grid sorting). |
| 3. High user-error risk              | no     | Reordering is low-stakes and trivially reversible (drag back); no destructive/irreversible action.    |
| 4. Contract depends on unresolved UI | no     | Contract-free by decision — `definition.widgets[]` order already is the render order; `PUT` persists it. |
| 5. UX confidence below threshold     | no     | Standard sortable pattern via `@dnd-kit`; affordances declared, no open UX questions; feel checked at the Check visual gate. |

Result: **Flow: DCFBI** (1 trigger — condition 2). Contract-free FE round → C + B are no-ops; the drag
feel is verified at the Check visual-verification gate (no separate F1 — DFCFBI's "F1 before Contract"
rationale is moot with no contract to freeze).

### Design gate CLOSED + build (human "good to go", 2026-06-28)

`ux-design --design-spec` PASS (0 facet gaps; added the acceptance-criteria list). Human signed the Design
gate. Building the frontend reorder per the ratified decisions: add `@dnd-kit/core` + `@dnd-kit/sortable`,
make the `DashboardDetailPage` grid a sortable `SortableContext` with a focusable per-widget drag handle
(pointer + keyboard sensors, live-region announcements), reorder on drop with optimistic local order +
persist via the existing `PUT`. **Next: build → type-check/tests/build → human Check (drag feel).**

### Build done (2026-06-28) — awaiting human Check (drag feel)

Added `@dnd-kit/{core,sortable,utilities}`. `DashboardDetailPage` grid is now a `DndContext` +
`SortableContext` (`rectSortingStrategy`, `closestCenter`); each widget is a `SortableWidget` cell. The
drag activator is a **per-card handle only** (`HolderOutlined`, `setActivatorNodeRef` + `attributes`/
`listeners`), so the ⋯ menu + chart keep their clicks; the handle is keyboard-focusable (PointerSensor +
KeyboardSensor with `sortableKeyboardCoordinates`) and labelled (`dashboard.reorder.handle`). Local
`orderIds` gives an **optimistic** reorder on drop, **reverts** on a failed `PUT`, and **resyncs** to the
server order via `useEffect([serverKey])` (so success is a no-op, external edits/failures revert). Persist
reuses the existing `PUT /dashboards/{id}` (no contract change). Single widget → handle hidden
(`canReorder`). Live-region announcements (picked/moved/cancelled) added (en + vi). No-op `onDragOver`.

Verification (automated): builder **type-check clean · 210/210 tests · prod build green**. **Pending: the
Check visual-verification gate — human drags to reorder, reloads to confirm persistence, checks keyboard
reorder + that the ⋯ menu / chart still work.**

### Check iteration — handle affordance (human, 2026-06-28)

Human asked to make the handle obviously a move affordance. Final: keep the **`⋮⋮` `HolderOutlined`**
icon (recognizable drag affordance) but set the **cursor to `move`** (four-way arrows = "this moves"), plus
a hover **Tooltip "Drag to reorder"** (`dashboard.reorder.tooltip`, en + vi). (Tried `DragOutlined` +
grab/grabbing first; human preferred dots-icon + move-cursor.) Type-check + build green.

## Check

Verification (2026-06-28):

| Item | Result |
| --- | --- |
| Builder type-check | clean |
| Builder tests (vitest) | **210** (no dashboard component tests; reorder is FE-on-real-API, human-verified) |
| Prod build | green (`@dnd-kit` added; chunk-size warning pre-existing) |
| **Check visual gate (human)** | **PASS** — "I tested, all good": drag-reorder + reload persistence + the ⋯ menu/chart coexistence, with the final `⋮⋮`-icon + `move`-cursor + "Drag to reorder" tooltip affordance. |

Backend / contracts / `@mdd/ui` untouched (FE-only round on the R101 contract).

## Act

**Learnings**:

- Reorder needed **zero contract/backend change** — `definition.widgets[]` order already *was* the render
  order and `PUT` persists the whole definition, so the array-move + existing mutation was the whole job.
  Confirms the R101 full-representation-PUT shape pays off for cheap follow-ons.
- **`@dnd-kit`** (first sortable in the product) gave keyboard + touch + a11y announcements for ~little
  code; the **handle-only activator** keeps the card's other interactions (⋯ menu, chart) intact.
- Affordance is a feel call best left to the human: agent proposed `DragOutlined` + grab/grabbing; human
  preferred the familiar **`⋮⋮` dots + `move` cursor** + tooltip. Cheap to iterate at the Check gate.

**Promotions**: none — no reusable rule/skill emerged; the `@dnd-kit` sortable pattern lives in the code.

**Follow-ups (not promotions, just notes):**

- **2D arrange** (persisted free placement) remains a later round if pulled — would be a contract+backend change.
- Same deferred seam from R101 (same-named dashboards share a nav leaf label) is untouched.

## Feeds into → Round_103 (TBD)

**Feeds into →** the rest of the dashboard-interactivity theme:

- **Interactive widgets** (R101 feedback ①) — runtime filters · date-range · drill (still formula-free).
- **2D arrange** — persisted widget positions (contract+backend), if the linear reorder proves too limiting.
- **Dashboard settings** (R101 feedback ③) — default range, layout prefs.
