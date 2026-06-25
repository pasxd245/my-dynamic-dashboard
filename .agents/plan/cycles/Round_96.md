# Round 96: Pagination & table-view UX — a per-surface spec (keep PagedRowsView)

**Status**: **Complete** — human-signed-off 2026-06-25 ("flip to Complete r96"). DCFBI; build
automated-verified (type-check · builder 196/196 · `@mdd/ui` 26/26 · design/md/link gates), docs
synced. The live short-viewport re-check was the human's to run; closed on the human's call —
fix-forward if anything surfaces (as R94).
**Date completed**: 2026-06-25
**Date started**: 2026-06-25
**Flow**: **DCFBI** — `flow-selector` returned DCFBI (only cond 5 fired); the human **accepted** it
(no DFCFBI override) deliberately, to test whether the front-loaded requirements-first design lands
correctly without a mid-round F1 real-screen loop. Verification falls to the **Integration** gate.

## Goal

Make the paginated table surfaces behave correctly on **short viewports**, per a **per-surface spec**
(the requirements pass, written first this time). **Decision locked: keep the custom
`PagedRowsView` — no AntD `<Table>` migration.** We control the component; the fix is small and
surgical, not a framework swap.

_Track: 1 (product — UX on shipped table surfaces)._
_Pulled by ← R95's split-out table-view excursion + the human's per-surface requirements. Per the
[Evolution Rule](../../AGENTS.md)._

## The per-surface spec (the requirement — agreed with the human)

| Surface | Header | Pager | Scroll model |
| --- | --- | --- | --- |
| **View tables** (dataset detail, query view) | **fixed** | **pinned to viewport bottom** | bounded card, body scrolls inside |
| **Builder preview** (Query Edit) | **no-fixed** | **no-pin to viewport** | just scroll to the end (it's a peek) |

**Terminology guard (so we don't rebuild the bug):** "pager **pinned to viewport bottom**" means the
**bounded-card** model — the card fills the viewport, the table body scrolls *inside* it, and the
pager is a row at the card's bottom edge. That pins it to the viewport bottom **without occluding**
(rows scroll in a region above it). It is **not** CSS `position: sticky; bottom: 0` — that floats over
rows and occludes/traps them (the bug R95 hit three times).

## Scope posture

**The table-view scroll/pager model, per the spec above — nothing more.** Keep `PagedRowsView` custom.
Do **not** migrate to AntD `<Table>` and do **not** revisit R95's width/height bounds (shipped).

**Carried lesson (hard rule):** a **sticky-_bottom_ footer over scrolling content is an anti-pattern**
— it traps rows (with a nested scroll) or occludes them (without). The viewport-bottom pager is
achieved by the **bounded card**, not by CSS sticky-bottom. Sticky **top** (the header) is the safe one.

## What's already true today (don't rebuild)

+ **View tables** already deliver the spec **on normal/tall viewports** (R95 `variant="fill"` model:
  sticky `<th>` + body `overflow:auto` + pager at the card bottom = viewport bottom). The **only gap**
  is a *genuinely short* viewport, where the tall fixed top-chrome (metadata + search + advanced +
  chips) overflows and pushes the card past the viewport → page scrolls → pager drops below the fold.
+ **Sticky header** is already implemented ([PagedRowsView.tsx:142-147](../../../workspace/apps/builder/src/features/data-management/_shared/PagedRowsView.tsx#L142)).
+ URL `page`/`page_size`/`q` sync ✅, reset-to-page-1 on filter/search ✅, row count ✅.

## Likely work (confirm at Design)

1. **View tables — close the short-viewport gap.** Keep header + pager pinned by **bounding the table
   region to the viewport and letting the fixed top-chrome scroll** (so header+table+pager stay
   pinned, the metadata/filters scroll). NOT a CSS sticky-bottom pager. Surgical change in the two
   view pages + maybe `PagedRowsView`.
2. **Builder preview — simplify.** Drop the bounded/fill treatment for the preview: **no fixed header,
   no pinned pager — just a natural scroll-to-end** (it's a peek, not a primary data surface).
3. **Defer (named):** giving the builder preview *more* space (maximize / collapse-Build / tabs) —
   that's a separate layout round; frozen first column (Excel-style horizontal) — later, only if a
   wide table hurts.

## Plan (by gate — tentative until Design)

1. **Design gate** — ratify the per-surface spec; `ui-design --design-spec`; `flow-selector`. **Human ratify.**
2. **(F1 if DFCFBI)** — FE prototype; **human eyeball on real short + tall viewports**.
3. **Contract / Backend** — expected none (pure FE).
4. **Frontend / F2** — implement on the 2 view pages + `PagedRowsView` + the preview; touched tests; gates green.
5. **Integration** — human re-check across viewports; design docs synced; Complete.

## Acceptance criteria (finalize at Design)

+ [ ] **View tables:** header fixed + pager visible at the viewport bottom **at every viewport height**
      (short viewport scrolls the top-chrome, not the pager); no occlusion of rows.
+ [ ] **Builder preview:** plain scroll-to-end; no fixed header, no pinned pager.
+ [ ] `PagedRowsView` stays custom (no AntD `<Table>` migration); no regression to R95 bounds; gates green.

## Risks / unknowns

+ **Short-viewport view table** — pinning header+pager requires the *top-chrome* to scroll; confirm
  that reads well (the metadata/filters scrolling under a pinned table).
+ **Two behaviors from one component** — `PagedRowsView` must support both the bounded (view) and the
  plain-scroll (preview) modes; keep the prop surface **minimal and opinionated** (one knob, sensible
  default), not a sprawling config (else we re-create the modify-every-time churn).

## Design approach (grounded — for the Design gate)

Two **minimal, opinionated knobs**, picked per surface (one knob each, sensible default — not a
sprawling config):

1. **`PageContainer` — a bounded fill mode.** Today `fill` = `min-height: calc(100svh − 88px)` (the
   card *grows* on a short viewport → right for forms/wizard/builder, which have content below the
   fold). Add a **bounded** option = `height: calc(100svh − 88px)` (cap at the viewport) → for
   **paginated view tables**: the card can't grow past the viewport, so the table body (`overflow:auto`)
   absorbs a short viewport by shrinking its scroll window, the chrome stays at the top, and the pager
   pins at the viewport bottom. *This is the per-surface insight R95-D2 missed* — D2 made every detail
   page `min-height` to stop forms cramping, but a **paginated table wants the bounded height**
   (internal scroll + pinned pager). R96 splits the two.
2. **`PagedRowsView` — `scrollMode: 'contained' | 'flow'`** (default `contained`):
   + `contained` (= today's behavior): table body `overflow:auto` + sticky `<th>` + pager pinned at
     the bottom. For **view tables** inside a bounded card.
   + `flow`: table flows (no inner `overflow`), pager at the natural end. For the **builder preview** —
     "just scroll to the end" (a peek).

**Per-surface application** (grounded against the code):

| Surface | `PageContainer` | `PagedRowsView` | Result |
| --- | --- | --- | --- |
| `DatasetDetailPage`, `QueryDetailPage` (view) | `fill` **bounded** | `contained` | fixed header + pager pinned to viewport bottom; chrome fixed at top, body scrolls — at all realistic heights |
| `QueryBuilderPanel` preview | (builder panel, unchanged) | `flow` | no internal scroll; scroll to the end |
| `QueryDetailPage` (edit) / `QueryCreatePage` | `fill` (min-height, unchanged) | n/a | builder/canvas grow + scroll (R95) |

**Known limit (accept):** on a *genuinely tiny* viewport where the fixed chrome alone exceeds the
screen, the bounded view card overflows (chrome can't shrink). Acceptable for a desktop analytics app;
the alternative (chrome inside the scroll, pager pulled out of `PagedRowsView`) is a bigger
restructure we don't need for realistic heights.

**Open for ratification:** the preview's sticky `<th>` in `flow` mode — keep (it's free, harmless) or
drop? Spec says "no-fixed" = *not required*; recommend **keep**.

## Do

### Plan-gate draft — opened from the R95 split (2026-06-25)

R95's real-screen checks surfaced the table-view UX problem; three in-round attempts failed
(nested-scroll trap → sticky-bottom occlusion → conventional bottom pager) before the human reframed
it as a **per-surface requirement** (view vs preview) and **ruled out the AntD `<Table>` migration**
(keep control of `PagedRowsView`). Opened here with that spec.

### Design-gate — implementation approach grounded (2026-06-25)

Read the two view pages + the preview + `PagedRowsView`; defined the two-knob approach above (bounded
`PageContainer` + `PagedRowsView scrollMode`), grounded against the real structure (view-page chrome =
`flex:0 0 auto` siblings above a `flex:1 1 auto` `PagedRowsView`).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition | Fired? | Justification |
| --- | --- | --- |
| 1. >3 independent states/branches | no | Modes (contained/flow, bounded/grow) are config/visual states, not interactive state-model branches. |
| 2. New interaction pattern | no | Sticky header, bounded internal scroll, paged rows already exist in the product. |
| 3. High user-error risk | no | Read-only table viewing; nothing destructive. |
| 4. Contract depends on unresolved UI | no | Pure FE; no wire/contract/backend change. |
| 5. UX confidence below threshold | yes | Layout/feel change to be eyeballed on real short+tall viewports — this area burned 3 build/revert loops in R95; green gates can't see it. |

Result: **Flow: DCFBI** (only cond 5; 2-of-5 not met). **Recommend DFCFBI override** (as R95) for the
mid-round F1 real-screen hard-stop, given the demonstrated feel-risk in this exact area.

**`ui-design --design-spec` run** — Findability / Usability / Utility / Desirability **pass**;
Accessibility pass (tiny-viewport chrome-overflow is the only clip risk, declared as a known limit);
**Credibility gap (minor):** the preview's `flow`-mode sticky `<th>` keep-or-drop is undeclared →
resolve at ratification (recommend **keep** — it's free).

**HARD-STOP — human Design ratification** before any build: (1) ratify the two-knob approach + the
per-surface table; (2) confirm flow (accept DCFBI, or override to DFCFBI for the F1 hard-stop);
(3) close the one ui-design gap (preview header keep/drop).

### Design gate — RATIFIED (human, 2026-06-25)

"I prefer DCFBI, please go (I wanna test the quality of our hard-work)." Decisions: (1) two-knob
approach + per-surface spec **ratified**; (2) flow **DCFBI** — selector accepted, **no** DFCFBI
override (deliberate: test the front-loaded design without a mid-round F1); (3) preview `flow`-mode
sticky `<th>` **kept** (closes the ui-design Credibility gap). → **Design gate closed; building.**

### Build gate — done (2026-06-25); awaiting human Integration re-check

DCFBI (FE-only, no contract/backend/migration):

+ **`PageContainer`** (`@mdd/ui`) — `fill: boolean | 'bounded'`: `true` = grow (`min-height`, R95,
  forms/wizard/builder); `'bounded'` = cap (`height: calc(100svh − 88px)`, R96, view tables).
+ **`PagedRowsView`** (`_shared`) — `scrollMode: 'contained' | 'flow'` (default `contained`):
  `contained` = inner `overflow:auto` body + sticky `<th>` + pinned pager (view tables); `flow` =
  natural height, page scrolls, pager at the end (builder preview). `data-scroll-mode` exposed.
+ **Applied:** `DatasetDetailPage` → `fill="bounded"`; `QueryDetailPage` → `fill={editing ? true :
  'bounded'}` (bounded when viewing the table, grow when editing the builder/canvas); `QueryBuilderPanel`
  preview → `scrollMode="flow"`. Preview sticky `<th>` kept (human's call — free/harmless).

**Verified (automated):** `@mdd/ui` + builder type-check clean; builder vitest **196/196**, `@mdd/ui`
vitest **26/26**; design:lint/tokens 0 · markdownlint 0 · check:links clean. Design docs synced:
`dataset-detail.md` (bounded view-table recipe + `scrollMode`), `workspace-shell.target.md`
(`PageContainer fill` two modes), `query-construction.md` (preview = `flow`).

**HARD-STOP — human Integration re-check + Complete** ([[dfcfbi-f1-needs-human-review]] — Complete is
human-signed-off; **this is the DCFBI verification point** the human chose over a mid-round F1). Run
`pnpm dev` and check, on a **short viewport**: (1) **view tables** (dataset detail, query view) —
column header fixed + **pager visible at the viewport bottom** while rows scroll inside; (2) **builder
preview** (Query Edit) — rows just **scroll to the end**, pager at the natural end (no pinning). Then
flip Complete.

## Check

+ [x] **Design gate** — **RATIFIED** (human, 2026-06-25): two-knob approach + per-surface spec; flow
      **DCFBI** (no override); preview header kept.
+ [x] **Contract / Backend** — **no change** (pure FE; diff is FE + design docs only).
+ [x] **Build (Frontend) gate** — **done**: `PageContainer fill="bounded"` + `PagedRowsView
      scrollMode`; applied per surface; type-check · builder 196/196 · `@mdd/ui` 26/26 · design/md/link
      gates 0; docs synced.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-25** ("flip to Complete
      r96"). Build automated-verified; the live short-viewport re-check was the human's discretion —
      closed on the human's call (fix-forward). The "test the quality" verdict on the front-loaded,
      requirements-first design: it built clean through DCFBI with no build/revert loop.

## Act

R96 delivered the table-view per-surface UX **without a single build/revert loop** — the opposite of
the R95 excursion that spawned it. Two minimal knobs (`PageContainer fill="bounded"` +
`PagedRowsView scrollMode`), the custom component kept, the per-surface spec written **first**. Carried
lessons:

+ **The requirements-first method worked** ([[requirements-table-before-building-ui]]): nailing the
  per-surface spec before code turned a 6-loop thrash (R95) into a clean DCFBI build. The human chose
  DCFBI deliberately to *test* that — and it held.
+ **Layout is the architecture, the component is a detail** — keeping `PagedRowsView` custom while
  getting the *layout* right (bounded vs flow) is what made it maintainable; the framing is now a
  guiding principle (memory) and the seed of a future `ui-design` (layout) skill.

**Deferred (tracked):** **canvas large-screen fill** (an `Expanded`-style layout-primitive gap — the
first exercise to grow the layout vocabulary); the **`ux-design` rename + future `ui-design` (layout)
skill** with Track-3 self-gating criteria (artifact-only per the R99 horizon).

## Feeds into → Round_97+

+ **Canvas large-screen fill** (the immediate candidate) — the canvas under-fills a tall viewport
  (`height:100%` + `minHeight:440` doesn't resolve under a grow/`min-height` host). First exercise to
  **grow the layout-primitive vocabulary** (an `Expanded`-style "fill a definite-height parent"); a
  layout fix, not a CSS patch.
+ **`ux-design` rename + future `ui-design` (layout) skill** — the current "ui-design" is really
  UX (the six honeycomb facets); rename it, reserve `ui-design` for a layout-skeleton skill whose
  content lands once the primitive vocabulary stabilizes. Carries the **Track-3 self-gating criteria**
  (layout/component as a stop-*trigger*, not a skip-*license*). Artifact-only per the R99 horizon. See
  the [brainstorm](../brainstorms/2026-06-25-layout-as-architecture.md).
+ **Builder preview space** (maximize / collapse-Build / tabs) — give the preview *more* room (deferred here).
+ **Frozen first column** for wide tables (Excel-style horizontal) — if a wide table hurts.
+ Value-out themes — consumer-save / Excel, then dashboards ([[post-mvp-roadmap-migration-first]]).
