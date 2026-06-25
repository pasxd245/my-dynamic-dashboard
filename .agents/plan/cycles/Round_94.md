# Round 94: UI bug-fix batch — defects from the R93 real-app pass

**Status**: **Complete** — human-signed-off 2026-06-25 ("close the current round"). All four defects
(D1, D4, D5, D6) fixed & automated-verified (vitest 196/196, type-check + lints green); D2/D3 split to
the responsive-layout round, D6's base-change half + the relationships-future questions parked. DCFBI.
**Date started**: 2026-06-25
**Date completed**: 2026-06-25
**Flow**: **DCFBI** (bug fixes over shipped surfaces — no new feature, so no F1/F2 feel-check round;
each fix verified by its touched tests + the human's real-app re-check). Confirmed at the Design-gate
exit via `flow-selector` once scope is set.

## Goal

Batch the UI defects the human surfaced while exercising the real app (the R93 I-phase pass and
after) into **one dedicated round**, rather than fixing them piecemeal mid-feature
([[batch-ui-bugs-into-one-round]] — the human's standing call). Each fix is the **smallest correct
change** over a shipped surface, verified against the real repo (touched tests + a human re-check),
leaving the surface more truthful than found.

_Track: 1 (product — defect cleanup on shipped surfaces). Pulled by ← the human's R93 I-phase
finding ("I found a few defects") + the [[batch-ui-bugs-into-one-round]] discipline. Per the
[Evolution Rule](../../AGENTS.md)._

## Scope posture

**The batch is the enumerated defect list (below) — nothing more.** A bug-fix round does not grow new
features; anything that turns out to need a design decision (a new mode, a flow change) is split out
to its own round, not absorbed here.

**Deferred — NOT in this round:**

+ **Responsive-layout strategy (D2 + D3)** — **split out** (human's call 2026-06-25) to its **own
  research-first round**: the small-viewport cramp (D2) + large-screen over-stretch (D3) are one
  layout-strategy decision over shared `@mdd/ui` primitives, not a bug-fix. A sourced research brief
  (Ant Design layout/grid + content-max-width/density across small→4K) grounds it first —
  **[research brief](../../tmp/research/2026-06-25-responsive-layout.md)** (done 2026-06-25):
  hybrid cap-and-center (text ~66ch · data ~1440–1600 · canvas fluid), `min-height` not hard
  `height`, density-via-columns (AntD Grid `xxl`/`xxxl` + two-pane detail). D2/D3 stay logged below
  for the record; their fix lands in that round, not here.
+ **Standalone "New query" create action** — opened then **deferred** (2026-06-25): it impacts the
  **create flow** (a query needs a driving source, so "no base" means a new source-pick or
  empty-canvas-first interaction — a real design fork, not a quick add). Needs its own design round;
  stays a tracked candidate ([[dont-mvp-rush-a-roadmap-home-surface]], [canvas.md Scope OUT](../../design/data-management/queries/canvas.md)).
+ Value-out themes (consumer-save / Excel, dashboards) — [[post-mvp-roadmap-migration-first]].

## Defect list (collecting, one by one with the human)

Each entry: **symptom → where → expected**, plus the grounded cause; fix + verification land at the
gates. (Two defects were already fixed inside R93's I-phase — the query-node-draw orphaned-leaf
render and the bottom-left controls — closed, not re-listed.)

### D1 — `PageHeader → PageCard` gap is bigger on detail pages than on list pages

+ **Symptom** — the space between the page header and the card looks nice on list views, but on a
  detail page the gap looks noticeably bigger.
+ **Where** — detail / builder pages ([`QueryDetailPage`](../../../workspace/apps/builder/src/features/data-management/queries/QueryDetailPage.tsx#L496),
  [`DatasetDetailPage`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx#L450),
  `QueryCreatePage`) vs. list pages
  ([`QueriesPage`](../../../workspace/apps/builder/src/features/data-management/queries/QueriesPage.tsx#L218),
  [`DatasetsPage`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx#L167)).
+ **Expected** — same layout concept → same `PageHeader→PageCard` spacing everywhere.
+ **Cause (verified)** — `PageHeader` bakes in `marginBottom: 16`
  ([PageHeader.tsx](../../../workspace/packages/ui/src/Components/PageHeader.tsx#L62)). List pages
  stack header + card in a **bare fragment** → 16px. Detail/builder pages wrap them in a **flex
  column with its own `gap: 16`** → flex-gap 16 **+** margin 16 = **32px** (double gap). The detail
  pages' error/loading sub-states use bare fragments (16px), so spacing is inconsistent even within
  one page.
+ **Severity** — cosmetic / consistency.
+ **Fix direction (decide at triage)** — single-source the header→content gap: e.g. drop the
  redundant `gap` on the flex detail wrappers (keep flex for the `variant="fill"` height stretch) and
  let `PageHeader`'s `marginBottom` be the one gap; or make `PageHeader` margin-less inside a gapped
  container. Pick one rule and apply it across all detail/builder pages.

### D2 — detail pages hard-fix to the viewport height → cramped on a small viewport

+ **Symptom** — list views (card + table) scroll naturally to the end (fine, no paginate needed yet),
  but detail pages **fix their height to the viewport**, so on a small viewport the content is
  squeezed into a cramped region (controls/content fall below the fold). Bad UX/UI.
+ **Where** — every fixed-height detail/builder page:
  [`QueryDetailPage`](../../../workspace/apps/builder/src/features/data-management/queries/QueryDetailPage.tsx#L496),
  [`QueryCreatePage`](../../../workspace/apps/builder/src/features/data-management/queries/QueryCreatePage.tsx),
  [`DatasetDetailPage`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx#L450),
  [`DatasetNewPage`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx).
+ **Expected** — a better small-viewport experience: the page should stay usable (no cramping, no
  below-the-fold actions) when the viewport is short, the way the list views degrade gracefully.
+ **Cause (verified)** — those pages set `height: calc(100vh − 88px)` (88px = AntD Layout header 56 +
  Content padding 16×2) and render a `PageCard variant="fill"` that stretches to that fixed height
  with inner sections `overflow:auto`. It's a **hard `height`** (not a `min-height`), so a short
  viewport clamps the whole surface; the inner scroll region shrinks toward unusable. Same root as
  D1's below-the-fold controls and why the R93 canvas needed an in-page **maximize**.
+ **Severity** — usability (more than cosmetic) on small viewports.
+ **Fix direction (decide at triage — likely the biggest item; may need a design call)** — let the
  surface **fill a tall viewport but grow + document-scroll on a short one**: e.g. `minHeight` instead
  of hard `height`, or a responsive breakpoint below which `variant="fill"` relaxes to natural flow.
  Note this changes the `variant="fill"` contract (it needs a definite height to stretch its
  `overflow:auto` children), so it touches the shared `@mdd/ui` `PageCard` — a small design decision,
  not a one-line tweak. If it balloons, **split to its own round**. **See D3 — same axis.**

### D3 — no responsive layout bounds → large 2K/4K screens stretch content edge-to-edge (blank/over-wide)

+ **Symptom** — on a large (2K/4K) viewport, content has **no max-width**, so tables/cards/forms
  stretch the full width — long unreadable line lengths, sparse rows, a sprawling builder/canvas; it
  reads as wasted/blank space. The **other end of D2's axis** (D2 = too-small viewport cramps; D3 =
  too-large viewport over-stretches).
+ **Where** — app-wide: no container cap in [`PageCard`](../../../workspace/packages/ui/src/Components/PageCard.tsx)
  or the shell content area (`AppLayout`); every list + detail surface inherits it.
+ **Expected** — a deliberate responsive layout: bounded, readable content width on large screens
  (and graceful fill/scroll on small — D2), so the app looks intentional from a laptop to a 4K panel.
+ **Cause (verified)** — **no `maxWidth` / container** anywhere; `PageCard` is full-width by default
  and the shell content fills 100%. There is no breakpoint system or content-width token.
+ **Severity** — UX polish / credibility (looks unfinished on large displays).
+ **Disposition — NOT a bug-fix item; its own responsive-layout design round, research-first.** D2 +
  D3 together are a **responsive-layout strategy** decision (min/max bounds, breakpoints, a content
  max-width token, density), touching shared `@mdd/ui` layout primitives. The right move is a focused
  **research brief** (Ant Design layout/grid guidance + content-max-width/density best practices
  across the small→4K range) to ground that round's Design gate — not an ad-hoc number in this
  bug-fix batch. **D1 and the smaller defects stay in R94; D2+D3 split out** (human's call 2026-06-25,
  brief done — see Scope § Deferred).

### D4 — "home action": logo not clickable (+ optional Home-icon breadcrumb)

+ **Symptom** — _(4a)_ the sidebar **brand/logo is not clickable** — there's no quick "back to home"
  affordance on it. _(4b, optional, not really a defect)_ the breadcrumb's first crumb is the **text
  "Home"**; could be a **Home icon** instead.
+ **Where** — _(4a)_ the brand mark in [`WorkspaceShell`](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx#L225)
  (default "M" badge + "MDD"), wired from [`AppLayout`](../../../workspace/apps/builder/src/components/AppLayout.tsx).
  _(4b)_ the home crumb in [`PageHeader`](../../../workspace/packages/ui/src/Components/PageHeader.tsx)
  / the per-page `{ label: t('nav.home'), route: '/' }`.
+ **Expected** — _(4a)_ clicking the logo navigates **home** (`/` → redirects to
  `/data-management/workspaces`), the near-universal convention. _(4b)_ optionally show a Home **icon**
  for the home crumb instead of the word.
+ **Cause (verified)** — _(4a)_ `WorkspaceShell`'s brand `<div>` has **no `onClick` and no
  `onHome`/brand-click prop** (the nearby `cursor:pointer` is the collapse toggle, not the brand); the
  logo is inert. _(4b)_ the home crumb already renders as a clickable `<a>` to `/` — it's purely the
  **text-vs-icon** presentation; `/` exists ([main.tsx:84](../../../workspace/apps/builder/src/main.tsx#L84),
  redirects to workspaces).
+ **Severity** — _(4a)_ minor usability (missing a conventional affordance); _(4b)_ cosmetic, optional.
+ **Fix direction (decide at triage)** — _(4a)_ add an `onHome`/brand-click prop to the shared
  `WorkspaceShell` (or wrap `brandContent` in a `<button>`/link with an `aria-label`); `AppLayout`
  passes `navigate('/')`. _(4b)_ if wanted, render a `HomeOutlined` for the home crumb (keep an
  accessible label) — small, optional, batchable with 4a.

### D5 — Promote is wrongly enabled on a query-anchored edge (creates a governed rel from a non-ds↔ds edge)

+ **Symptom** — an edge that is **not** dataset↔dataset (drawn off a **query** node) still shows an
  **enabled Promote**; clicking it **succeeds** and creates a governed relationship between two
  datasets the user never intended to relate at the ER level. (Functional — not cosmetic.)
+ **Where** — the `promotable` computation in
  [`QueryCanvas` edges](../../../workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx#L831).
+ **Expected** — Promote is offered **only when the edge visually links two datasets** (the doctrine:
  *"suppressed on any `qr_`-side edge"*). An edge anchored on a query node (build-on-query root, or a
  joined-in `qr_` you draw from) must **not** be promotable.
+ **Cause (verified)** — `promotable = !qrel.leftSourceId.startsWith('qr_') && !qrel.rightSourceId.startsWith('qr_')`
  tests the **stored** ids, but the provenance rewrite makes `qrel.leftSourceId` **always a leaf
  `ds_`** (even when drawn off a query), so the left check is always true. The edge's **visual** left
  is `leftNode` (the re-anchored node — a `qr_` for a query-anchored edge). The check uses the wrong
  value. R93's re-anchor surfaced this (the edge now visibly touches the query node) and supplies the
  fix value.
+ **Severity** — **functional / data-integrity** (spurious governed rels). Highest of the batch so far.
+ **Fix direction** — check the **visual** node: `promotable = !leftNode.startsWith('qr_') &&
  !qrel.rightSourceId.startsWith('qr_')`. Pure dataset×dataset is unchanged (`leftNode ===
  qrel.leftSourceId` there); query×query stays blocked via the right. Add a regression test (a
  query-anchored edge → `promotable === false`); consider a tiny pure `isPromotable(leftNode,
  rightSourceId)` helper in `joinGraph.ts` for unit-testability.

### D6 — the driving-source ("Build on") picker is editable but never persists

+ **Symptom** — on a query, the UI **lets you change the base / driving source** (the picker re-runs
  the preview on the new base), but **after Save the base is unchanged** — the edit silently vanishes.
+ **Where** — the driving-source `<Select>` in [`JoinEditor`](../../../workspace/apps/builder/src/features/data-management/queries/JoinEditor.tsx)
  (Form tab; labeled "the driving source — a Dataset or a saved Query", R76), bound to
  `useQueryBuilder`'s `baseSourceId` / `setBaseSource`
  ([useQueryBuilder.ts:398](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L398)).
+ **Expected** — the affordance is **honest**: either the base can actually be changed-and-saved, or
  it's presented **read-only** when it can't be (no control that silently discards the change).
+ **Cause (verified)** — a **documented R76 F1 prototype whose persistence was deferred and never
  finished** ([useQueryBuilder.ts:110-114](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L110):
  *"editable in-builder via the 'Build on' picker … Persisting a changed base is the Contract gate's
  job (the PUT is definition-only this round)"*). The save paths confirm it: **edit** PUTs
  `{ definition }` only ([useQueryBuilder.ts:352](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L352);
  PUT contract is `{ definition }`-only by design — sourceId immutable); **create** POSTs the
  **preset** `createBase.sourceId`, not the edited `baseSourceId`
  ([useQueryBuilder.ts:372](../../../workspace/apps/builder/src/features/data-management/queries/useQueryBuilder.ts#L372)).
  `setBaseSource` only sets local preview state. So the picker never persists in **either** mode.
+ **Severity** — usability / silent-intent-loss (more than cosmetic).
+ **Fix direction — split: bug-fix vs deferred feature.**
  + **Bug-fix (R94):** make it honest — render the driving source **read-only in edit mode** (the
    base is fixed at create; the contract can't change it), removing the misleading editable picker;
    reconcile the create-mode picker (it shows but POSTs the preset). Smallest honest change.
  + **Deferred feature (its own round):** actually *changing a query's base* (persist `sourceId` on
    PUT + re-validate the whole definition — joins/filter column-indices — against the new base) is a
    real feature, in the same create-flow design space as the deferred **New-query** action. Not a
    bug-fix.

## Plan (by gate — DCFBI; tentative until the list is set)

1. **Design gate** — triage the enumerated defects: confirm each is a defect (not a design change),
   group by surface, order by user-impact; `flow-selector` → DCFBI. Split out anything that needs a
   design decision.
2. **Contract gate** — expected **no change** for pure UI defects; confirm per fix.
3. **Backend gate** — only if a defect traces to the server; otherwise none.
4. **Frontend gate** — the fixes, each with its touched unit/integration test; type-check + vitest +
   prettier green.
5. **Integration gate** — real-stack + the human's re-check that each reported defect is gone; design
   docs (canvas.md / the touched surface doc) kept in sync; human Complete.

## Acceptance criteria (finalized at triage)

+ [ ] **D5** — Promote is disabled on a query-anchored edge (visual `leftNode` is a `qr_`); enabled
      only when the edge links two datasets. Regression test green.
+ [ ] **D6** — the driving source is **read-only in edit mode** (no editable picker that silently
      drops on save); create-mode picker reconciled. (Actual base-change is a deferred feature.)
+ [ ] **D1** — `PageHeader → PageCard` gap is the same (16px) on list and detail/builder pages
      (single-sourced).
+ [ ] **D4a** — the sidebar logo is clickable → home (`/`), with an accessible label.
+ [ ] **D4b** — _(optional, include only if confirmed)_ home breadcrumb shows a Home icon.
+ [ ] No scope creep — D2/D3 (responsive layout) and D6's base-change feature stay in their own
      rounds; touched design docs kept in sync; gates green (type-check · vitest · prettier · lints).

## Risks / unknowns

+ **Underspecified repro** — a defect named without exact steps may hide a design question; triage at
  the Design gate and split if so.
+ **Piecemeal creep** — the brake is the enumerated list; new defects found mid-round are logged,
  triaged, and added deliberately, not absorbed silently.

## Do

### Plan-gate draft — opened from the R93 fork, pivoted to bug-fix (2026-06-25)

The human picked "New-query create action" at the R93 completion fork, then **deferred** it (it
impacts the create flow — its own design round) and chose to **focus on bug fixes**. R94 is opened as
the dedicated UI bug-fix batch ([[batch-ui-bugs-into-one-round]]).

### Design-gate triage — batch closed at 6 (2026-06-25)

Collected D1–D6 with the human (one by one, grounded each against code). Triage:

+ **In R94 (4 defects):** **D5** (promote boundary — functional/data-integrity, *fix first*),
  **D6** (driving-source picker honesty — read-only in edit), **D1** (header→card gap consistency),
  **D4** (clickable logo `4a` + optional Home-icon `4b`). Ordered by severity: D5 → D6 → D1 → D4.
+ **Split to the responsive-layout round (research-first):** **D2** (small-viewport cramp) + **D3**
  (large-screen over-stretch) — one layout-strategy decision over shared `@mdd/ui` primitives; brief
  done.
+ **Split to the create-flow feature round:** **D6's "actually change the base"** half (persist
  `sourceId` + re-validate) — a feature, alongside the deferred New-query action.
+ **Surfaces:** query-builder feature (D5, D6) · shared `@mdd/ui` (D1 PageHeader/PageCard + detail
  wrappers, D4a WorkspaceShell brand) · breadcrumb (D4b).
+ **Flow = DCFBI** — all four are fixes over shipped surfaces, no new feature → no F1/F2 feel-check
  round; each verified by its touched tests + the human's real-app re-check at Integration.

**Two small calls for the human at ratification:** (1) include **D4b** (Home icon) or skip as
optional? (2) confirm **D6 = read-only-in-edit** (vs. leaving the picker but disabling it).

### Build gate — done (2026-06-25); awaiting human real-app re-check

All four defects fixed in severity order (DCFBI; FE-only, no contract/backend/migration change):

+ **D5 (promote boundary).** `promotable` now computed in the pure `buildSourceGraph`
  ([joinGraph.ts](../../../workspace/apps/builder/src/features/data-management/queries/joinGraph.ts))
  from the **visual `leftNode`**, not the stored leaf — so an edge anchored on a query node (incl. a
  build-on-query draw) is non-promotable; `QueryCanvas` consumes `edge.promotable`. +4 assertions in
  the `buildSourceGraph` unit tests (dataset×dataset promotable; build-on-query + query×query not).
+ **D6 (base-picker honesty).** `JoinEditor` gains `baseEditable`; the driving-source `<Select>` is
  **disabled with a hint** in edit mode (`baseEditable={builder.isCreate}` from `QueryBuilderPanel`);
  new i18n key `baseSourceFixedHint` (en + vi). The two R76-F1 edit-mode picker tests replaced by one
  asserting the disabled state (composed-preview coverage stays via the R77 create test).
+ **D1 (header gap).** Removed the redundant flex `gap:16` from the four detail/builder wrappers
  (`QueryDetailPage`, `QueryCreatePage`, `DatasetDetailPage`, `DatasetNewPage`); `PageHeader`'s
  `marginBottom:16` is now the single header→content gap (documented on `PageHeader`), matching list
  pages (16px, not 32px).
+ **D4a (clickable logo).** `WorkspaceShell` gains `onHome`/`homeLabel`; the brand becomes a labelled
  `<button>` (→ home) when `onHome` is set; `AppLayout` passes `navigate('/')` + `t('nav.home')`.
+ **D4b (Home icon).** `PageHeader` renders a `HomeOutlined` for the root `/` crumb (label kept as the
  accessible name — never icon-alone), centralized so no per-page breadcrumb churn.

**Verified (automated):** builder + `@mdd/ui` `type-check` clean; builder vitest **196/196** (incl.
the i18n parity test + the new D5/D6 cases); prettier clean on touched files; design:lint 0 ·
design:tokens 0 · markdownlint 0 · check:links clean. Design docs synced: canvas.md (D5 promote
doctrine = visual-anchor), query-construction.md (D6 base read-only in edit), workspace-shell.md
(D4a clickable brand).

**HARD-STOP — human real-app re-check + Complete** ([[dfcfbi-f1-needs-human-review]] — Complete is
human-signed-off): run `pnpm dev` and confirm each defect is gone — D5 (no Promote on a query-anchored
edge), D6 (base picker disabled+hint in edit), D1 (even header gap on detail vs list), D4 (logo →
home, breadcrumb home icon). Then flip Complete.

### Plan gate — RATIFIED (human, 2026-06-25)

"Ratify — build it." Decisions on the two calls: **(1) D4b included** (Home icon on the home crumb);
**(2) D6 = keep the picker but disable it in edit mode with a hint** ("base is fixed after create; use
Build on this query") — not a bare read-only label. Build order D5 → D6 → D1 → D4 (DCFBI; each with
touched tests + docs in sync; human real-app re-check at Integration). → **Plan gate closed; building.**

## Check

+ [x] **Plan gate** — **ratified** (human, 2026-06-25): build D1, D4 (incl. D4b icon), D5, D6; flow
      DCFBI. Decisions: D4b included; D6 = keep picker, disable + hint.
+ [x] **Build gate** — **closed** (2026-06-25): D5 → D6 → D1 → D4 fixed; builder + `@mdd/ui`
      type-check clean · vitest 196/196 · prettier · design:lint/tokens/markdownlint/links 0; docs
      synced (canvas.md, query-construction.md, workspace-shell.md).
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-25** ("close the current
      round"). The four fixes are automated-verified (vitest 196/196 · type-check · prettier ·
      design/markdown/link lints); the human waived the live re-check in favour of closing —
      fix-forward if anything surfaces on next run.

## Act

R94 batched five real defects from the R93 real-app pass into one round and fixed four; the split
discipline ([[batch-ui-bugs-into-one-round]]) held — what was a bug got fixed, what was a design
decision got split out, not absorbed. Carried lessons:

+ **R93's `leftNode` re-anchor paid a second dividend** — D5's promote-boundary fix fell out of it
  (check the visual node, not the stored leaf). A render-fix that also corrected a data-integrity bug.
+ **The base-picker (D6) was a half-finished R76 F1 prototype** — "editable but never persists" lived
  for many rounds because no round re-checked it on the real stack. Reinforces [[dfcfbi-f1-needs-human-review]]:
  the human run finds what green gates can't.
+ **Defect-collection surfaced strategic questions, not just bugs** — D5 → self-join → pipeline →
  governed-rel value. Parked together in
  [the relationships-future brainstorm](../brainstorms/2026-06-25-relationships-future-model.md)
  rather than decided under a bug-round's momentum (the brake).

**Deferred from this round (tracked):** D2+D3 → the research-first responsive-layout round (brief
done); D6's base-change feature + Q1/Q2/Q3 → the relationships-future brainstorm; the draw-time
self/cyclic guard (a minor UX polish) → a future canvas-polish batch.

## Feeds into → Round_95+

Standing roadmap candidates (human's call at the fork):

+ **Value-out themes** (the critical path, [[post-mvp-roadmap-migration-first]]): consumer-save / Excel
  output (purpose #3 "Excel output first"), then dashboards.
+ **Responsive-layout round** (research-first) — D2 + D3; brief at
  [`.agents/tmp/research/2026-06-25-responsive-layout.md`](../../tmp/research/2026-06-25-responsive-layout.md).
+ **Standalone "New query" create** — source-pick vs. empty-canvas fork; in the create-flow design
  space (with D6's base-change half).
+ **Relationships-future model** (parked, no decision) — self-join↔identity, the pipeline/workflow
  reframe (cold-reviewed), and the governed-rel-value re-examination:
  [brainstorm](../brainstorms/2026-06-25-relationships-future-model.md). Decide together, on demand.
