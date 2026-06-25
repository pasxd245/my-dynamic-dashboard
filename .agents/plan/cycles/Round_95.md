# Round 95: Responsive-layout bounds — D2 (short-viewport cramp) + D3 (large-screen over-stretch)

**Status**: **Complete** — human-signed-off 2026-06-25 ("flip r95 to Complete"). **Scoped to
responsive bounds only** (D2+D3); the pagination-UX excursion was **split to [Round_96](Round_96.md)**
(human's call) and its edits reverted. Design ratified (DFCFBI, human override), F1 confirmed by the
human on real screens, design-sync done, Contract/Backend no-change, F2 green. DFCFBI,
[[dfcfbi-two-round-split]].
**Date started**: 2026-06-25
**Date completed**: 2026-06-25
**Flow**: **DFCFBI** — **human override at Design ratification** (2026-06-25). The `flow-selector`
returned DCFBI (only cond 5 fired — audit trail in the Do log); the human overrode to DFCFBI to get a
**mid-round F1 hard-stop** for this layout/feel round ([[dfcfbi-f1-needs-human-review]] — green gates
can't see layout feel; catch "the bounds feel wrong" before full build-out, not at the end). Runs as
**[D + F1 + design-sync]** then **[C + B + F2 + Integration]** ([[dfcfbi-two-round-split]]). The
selector's DCFBI record is preserved, not rewritten — this is a documented scope override, not a
re-decision of the tally.

## Goal

Give the app a **deliberate responsive layout** across the ~1366×768 laptop → 2K/4K range, fixing the
two layout defects R94 split out as one strategy decision (not a bug-fix):

+ **D2** — detail/builder pages hard-fix to `height: calc(100vh − 88px)` → cramp on a short viewport
  (controls fall below the fold).
+ **D3** — no content `max-width` anywhere → tables/cards/forms stretch edge-to-edge on large screens
  (unreadable line lengths, sparse rows, wasted space).

Grounded by the research brief
([`2026-06-25-responsive-layout.md`](../../tmp/research/2026-06-25-responsive-layout.md), done
2026-06-25): a **hybrid, per-surface bound** — cap-and-center width (text vs data widths, canvas
fluid), `min-height` not hard `height`, density via columns.

_Track: 1 (product — UX polish / credibility + small-viewport usability on shipped surfaces)._
_Pulled by ← R94's split-out D2+D3 + the research brief. Per the [Evolution Rule](../../AGENTS.md)._

## Scope posture

**Bounds-only (human's call 2026-06-25).** R95 lands the cheaper, high-value **width + height bounds**
and **responsive card-grid density**. The **two-pane (form ↔ live preview) detail redesign** — a
layout redesign, not a width tweak (brief's own caveat) — is **deferred to its own round**.

**IN R95:**

1. A **content-width bound** in shared `@mdd/ui` — a Fixed|Fluid mechanism (mirrors AntD Pro
   `contentWidth`), exposing the cap as **theme tokens** (text/form ~960, data/list ~1440–1600,
   canvas fluid/uncapped). Cap-and-center; canvas opts out.
2. **D2 fix** — swap detail/builder hard `height: calc(100vh − 88px)` → **`min-height`**, so a tall
   viewport still fills (keeps `variant="fill"` stretch) and a short viewport document-scrolls instead
   of cramping. Re-verify the canvas/preview inner scroll panes still measure.
3. **D3 density (cheap half)** — card grids gain **columns** at `lg/xl/xxl` (AntD `Row/Col`
   responsive breakpoints) rather than stretching; bounded width applied to list + detail surfaces.
4. **Canvas stays fluid + the R93 maximize** (the exception — it wants the space).

**OUT (deferred → own rounds):**

+ **Two-pane (form ↔ preview) detail layout** on `lg+` — the D3 redesign half; its own round.
+ Value-out themes (consumer-save / Excel, dashboards) — [[post-mvp-roadmap-migration-first]].
+ Standalone "New query" create + D6's base-change feature — the create-flow design space.

## Design proposal (grounded in the brief — for the Design gate)

| Surface | Width | Height | Large-screen |
| --- | --- | --- | --- |
| **List/catalog** (Table + card grid) | cap-and-center, **generous** (~1440–1600) | natural document scroll (already fine) | card grid → **more `Col`s** at `lg/xl/xxl` |
| **Detail/builder** (form + preview) | **form narrow** (~960 / 66ch); preview wider | **`min-height`** not hard `height` (D2) | (two-pane deferred — single column, bounded) |
| **Canvas** (React Flow) | **fluid / uncapped** (exception) | keep `fill` + R93 maximize | n/a — pan/zoom uses space |

**Mechanism (to ratify at Design):** add a small shared layout primitive (working name
`PageContainer` / a `maxWidth` prop on the page wrapper) in `@mdd/ui` that centers and caps content
to a token-driven width, with a **`fluid`** escape for the canvas. Cap widths live as **theme tokens**
(`themeTokens.ts`), not scattered literals — tunable, spiked on a real 4K panel before the numbers
lock. The shell `Layout.Content` ([WorkspaceShell.tsx:296](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx#L296))
stays the scroll container; the cap applies to the page content inside it.

**Two affordances the design must declare (from the `ui-design --design-spec` review — close 2 gaps
before the spec freezes):**

+ **Short-viewport bottom control bar (Usability).** The `variant="fill"` pages pin a bottom bar
  (save / wizard nav / pagination footer) by relying on a *definite* height. Switching to `min-height`
  means a short viewport document-scrolls — so the bar must **stay reachable**. **Declared:** the
  bottom control bar becomes a **sticky footer** (`position: sticky; bottom: 0`) within the page
  scroll container, so it stays visible when content overflows a short viewport (rather than scrolling
  off to the document end). Re-verify per `variant="fill"` consumer at build.
  **→ Deferred out of R95** (see "Pagination-UX excursion" in Do): a sticky-bottom footer
  *occludes/traps* the rows it floats over, and the broader controls-reachability/pager question grew
  into a redesign — **split to [Round_96](Round_96.md)**. R95 keeps only the `min-height` bound; the
  wizard nav reverted to its original pinned-flex (the `variant="fill"` model keeps it reachable).
+ **Wide-screen gutter treatment (Credibility).** Capped-and-centered content on a 2K/4K screen must
  read as **intentional** whitespace. **Declared:** the centered content block sits on the existing
  `token.colorBgLayout` gutter (the shell Content background already provides it) — a centered card on
  a consistent background, never a left-aligned/cut-off page.

**Touched surfaces (verified):**

+ Shared `@mdd/ui`: new container primitive + width tokens; `PageCard variant="fill"` height-contract
  note (now `min-height`-compatible).
+ Builder detail/builder pages (hard-height → min-height + bounded): `QueryDetailPage`,
  `QueryCreatePage`, `DatasetDetailPage`, `DatasetNewPage`.
+ Builder list pages (bounded width + responsive `Col`s): `QueriesPage`, `DatasetsPage`, workspaces.

## Plan (by gate — DFCFBI; human override; [D+F1+design-sync] then [C+B+F2+I])

1. **Design gate** — **RATIFIED** (human, 2026-06-25): per-surface bound + token-driven container +
   the two affordances (sticky footer, gutter-on-`colorBgLayout`); `ui-design --design-spec` gaps
   closed; flow overridden to DFCFBI.
2. **F1 gate** — FE-only prototype of the bounds (shared container + width tokens; hard `height` →
   `min-height`; responsive card-grid `Col`s; canvas fluid; sticky footer), **no wire changes**
   ([[dfcfbi-f1-precedes-contract]]). **HARD-STOP for the human to eyeball real small + 4K** before
   finishing. **Spike the cap numbers on a real 4K panel during F1 before the tokens lock.**
3. **design-sync** — reconcile the touched design docs to what F1 actually built.
4. **Contract gate** — expected **no change** (pure FE layout); confirm.
5. **Backend gate** — none expected (no server touch).
6. **F2 / Frontend gate** — finalize, each touched surface with type-check + vitest + prettier green.
7. **Integration gate** — real-stack + the human multi-viewport re-check; design docs in sync; human
   Complete.

## Acceptance criteria (finalized at Design ratification)

+ [ ] **D2** — no detail/builder page uses a hard `height: calc(100vh − …)`; short viewport
      document-scrolls (no below-the-fold controls), tall viewport still fills. Inner scroll panes
      (preview table, canvas) still measure/behave.
+ [ ] **D3** — content is **capped and centered** on large screens (text/form ~960, data/list
      ~1440–1600), driven by **theme tokens** (no scattered literals); card grids gain columns at
      `lg/xl/xxl`; **canvas stays fluid**.
+ [ ] No scope creep — two-pane detail redesign stays its own round; touched design docs synced; gates
      green (type-check · vitest · prettier · design:lint/tokens · markdownlint · check:links).

## Risks / unknowns

+ **`variant="fill"` contract.** It needs a *definite* height to stretch `overflow:auto` children;
  `min-height` relaxes that — deliberate `@mdd/ui` change + re-check inner scroll panes (preview
  table, **canvas measured pane** especially) still behave. Surfaces at F1.
+ **Cap numbers are starting points, not laws.** 960 / 1440–1600 are evidence-anchored; validate on a
  real 4K panel at F1, expose as tokens so tuning is one edit.
+ **DFCFBI feel-risk is the point** — the human F1 eyeball on real small + 4K screens is the gate that
  green CI can't replace ([[dfcfbi-f1-needs-human-review]]).

## Do

### Plan-gate draft — opened from the R94 split (2026-06-25)

R94 split D2+D3 to this research-first round; the human picked it and chose **bounds-only** scope
(two-pane detail redesign deferred to its own round). Round opened grounded in the done research brief.
Next: ratify the Design proposal (mechanism + token names), run `ui-design --design-spec` +
`flow-selector` at Design exit.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | The per-surface treatments (list/detail/canvas) + breakpoint tiers are **visual/responsive states**, which the selector excludes; there is no new interactive state model. |
| 2. New interaction pattern           | no     | Cap-and-center, `min-height`, and AntD `Row/Col` responsive breakpoints are standard layout mechanics already in the product; the brief states no new pattern is invented. |
| 3. High user-error risk              | no     | Read-mostly layout change; nothing destructive, irreversible, or multi-step. |
| 4. Contract depends on unresolved UI | no     | Pure FE layout; no wire/contract/backend change expected. |
| 5. UX confidence below threshold     | yes    | The cap numbers (960 / 1440–1600) and the `min-height` feel can't be locked without a real small + 4K eyeball — the exact uncertainty that made R94 split this out. |

Result: **Flow: DCFBI** (only condition 5 fires; the 2-of-5 threshold is not met).

**Tension flagged for human ratification.** The round was *drafted* as DFCFBI on the
[[dfcfbi-f1-needs-human-review]] intuition (a layout/feel change wants a human eyeball). The
governance selector disagrees: with no contract change, the F1-before-Contract value is moot, so only
the feel-uncertainty (cond 5) fires → **DCFBI**. DCFBI still carries an **Integration-gate human
re-check** on the real app, so the feel-check is **not lost** — it lands at Integration instead of a
mid-round F1 hard-stop.

### `ui-design --design-spec` run — 2 gaps, both closed (2026-06-25)

Design-spec review of the bounded layouts: **Utility/Desirability/Accessibility/Findability pass**
(token-driven cap declared; min-height improves reflow). **2 gaps closed in the spec before
ratification:** (1) *Usability* — the `variant="fill"` bottom control bar gets a **sticky footer** so
it stays reachable on a short viewport; (2) *Credibility* — wide-screen **gutters sit on
`colorBgLayout`** so the cap reads intentional. Both now declared in the Design proposal.

### Design gate — RATIFIED (human, 2026-06-25); flow overridden to DFCFBI

The human ratified the bounds-only Design proposal (incl. the two ui-design affordances) and
**overrode the selector's DCFBI → DFCFBI**: for a layout/feel round they want the **mid-round F1
hard-stop** to catch "the bounds feel wrong" on real small + 4K screens *before* full build-out, not
only at Integration ([[dfcfbi-f1-needs-human-review]]). The DCFBI selector tally is preserved above as
the audit record; this is a documented scope override, not a rewrite of the tally. → **Design gate
closed; building the F1 FE-bounds prototype** ([D+F1+design-sync] sub-round).

### F1 gate — FE-bounds prototype built (2026-06-25); awaiting human real-screen eyeball

FE-only, **no wire/contract/backend change** ([[dfcfbi-f1-precedes-contract]]):

+ **Tokens.** `layoutTokens = { contentWidthText: 960, contentWidthData: 1600 }` in `themeTokens.ts`
  (one home for the cap numbers — tunable, to spike on 4K). Exported from `@mdd/ui`.
+ **Primitive.** New `PageContainer` (`@mdd/ui`): `width="data"|"text"|"fluid"` (cap-and-center,
  mirrors AntD Pro `contentWidth`), `fill` (D2: `min-height: calc(100svh − 88px)` + flex column,
  replacing the hard `height`), and a `dataComponent` passthrough so pages keep their DOM identity.
  Empty gutters fall on the shell `colorBgLayout` (Credibility affordance).
+ **Detail/builder (4)** → `PageContainer fill`: `QueryDetailPage` (`fluid` when editing — hosts the
  canvas — else `data`), `QueryCreatePage` (`fluid`), `DatasetDetailPage` (`data`), `DatasetNewPage`
  (`data`). Hard `height` → `min-height` everywhere. _(The F1 ui-design "sticky footer" affordance was
  later reverted — controls-reachability is part of the pagination-UX work split to [Round_96](Round_96.md).)_
+ **List (3)** → `PageContainer width="data"`: `QueriesPage`, `DatasetsPage` (tables fill the cap),
  `WorkspacesPage` (card grid gains `xxl={6}` — a 4th column on very wide screens; D3 density).
+ **Canvas** stays fluid (its host pages pass `width="fluid"`); the `min-height` fill preserves the
  tall-viewport measured-pane behavior identically — the **short-viewport canvas measure is the #1
  F1 eyeball item** (R93 maximize is the escape hatch).

**Verified (automated):** `@mdd/ui` + builder `type-check` clean; builder vitest **196/196**, `@mdd/ui`
vitest **26/26**; round-lint 0 · markdownlint 0 · check:links clean.

+ **Folded-in fix (flagged, not silent):** the `@mdd/ui` `PageHeader` test asserted `textContent`
  "Home" — stale since **R94's D4b** turned the home crumb into an icon (label kept as `aria-label`);
  R94 verified only the builder suite and missed it. Corrected the assertion to the accessible name
  (`[aria-label="Home"]`). A test-only alignment to already-shipped, documented behaviour.
+ **Pre-existing prettier noise (left alone):** `prettier --check` flags 3 list files for violations
  on lines R95 never touched (a `useMemo`, an `Alert`, a stray blank); prettier is **not enforced on
  `.tsx`** (lint-staged covers only `.md`; no eslint). R95's own added lines are prettier-clean at
  printWidth 120. Not reformatting unrelated lines (thin-diff / revert-seam discipline).

**HARD-STOP — human real small + 4K eyeball** ([[dfcfbi-f1-needs-human-review]]): run `pnpm dev` and
check across a short laptop viewport and a wide 2K/4K panel (see the hand-off checklist). Spike the cap
numbers (960 / 1600) on the real 4K display; tune in `layoutTokens` if needed. Then → design-sync →
C/B/F2/Integration.

### F1 gate — CONFIRMED by the human (2026-06-25)

Human ran the app and **confirmed the bounds using mock data** (values.yaml `enable_mock: true`). No
cap-number retune requested — 960 / 1600 stand. **F1 gate closed.** → proceeding to design-sync, then
C/B/F2/Integration (the second DFCFBI sub-round, [[dfcfbi-two-round-split]]).

### design-sync — touched docs reconciled to the F1 build (2026-06-25)

Per [[design-docs-are-source-code]], synced the docs whose layout passages drifted:

+ **`datasets/dataset-detail.md`** (Layout shell) — the fill recipe now reads `<PageContainer fill
  width="data">` with **`min-height: calc(100svh − 88px)`** (was hard `height: calc(100vh − 88px)`) +
  the wide-screen cap; "fixed-viewport-height" → "fills tall, grows on short."
+ **`workspaces/workspaces.md`** (Layout) — wrapped in `<PageContainer width="data">`; grid now **4
  cols ≥1600 (`xxl`, R95), 3 ≥1200 (`xl`), 2 ≥768 (`md`), 1 below** (corrected the prior "3 ≥1280"
  to AntD's real `xl`=1200 while adding the `xxl` tier).
+ **`_platform/workspace-shell.target.md`** — registered **`PageContainer` as a new `@mdd/ui`
  primitive** (width cap-and-center + `min-height` fill doctrine + `layoutTokens`); also corrected the
  stale `PageCardProps` type to include **`'fill'`** (R18 drift the R95 doctrine references).

No drift in `upload.md` or the query-builder docs (they don't document the wrapper mechanics —
`dataset-detail.md` is the canonical home). **Verified:** design:lint 0 · design:tokens 0 ·
markdownlint 0 · check:links clean.

### Contract / Backend gates — no change (2026-06-25)

R95 is **pure FE / CSS + design docs**. Working-tree diff confirms **no contract/schema/backend/SQL/
alembic file touched** — the seven page files, three `@mdd/ui` files (`PageContainer`, `index`,
`themeTokens`), one `@mdd/ui` test, and three design docs. **Contract gate: no change. Backend gate:
none.**

### Pagination-UX excursion → SPLIT OUT to its own round (human's call, 2026-06-25)

The human's real-screen checks surfaced a **pagination-UX** problem on short viewports (the pager
either makes you scroll past all rows, or — if pinned — occludes/traps the rows). We explored fixes
in-round (a sticky pager, then a single-page-scroll model, then a top-pager design the human drafted),
but the human ruled: **R95 stays scoped to the responsive bounds; the pagination-UX redesign is its
own round.** All pagination-specific edits were **reverted** — `PagedRowsView.tsx` is back to its
original (committed) state, and `DatasetDetailPage`/`QueryDetailPage` keep the bounds (`PageContainer
fill` + `variant="fill"`) without any scroll-model change. The pagination / table-view UX (a
per-surface spec — view tables vs the builder preview) is captured in **[Round_96](Round_96.md)**.

_Scope-brake held ([[round-bundling-revert-seams]]): a feel-question that grew into a redesign was
split out, not absorbed into the bounds round._

### F2 gate — finalize (2026-06-25)

R95 is the responsive bounds only: the shared `PageContainer` (token-driven width cap + `min-height`
fill), the seven bounded pages, and the `WorkspacesPage` `xxl` density tier — exactly the F1-confirmed
build, nothing added. **Verified:** `@mdd/ui` + builder type-check clean; builder vitest **196/196**,
`@mdd/ui` vitest **26/26**; design:lint/tokens 0 · round-lint 0 · markdownlint 0 · check:links clean.

_Flaky test noted (not R95):_ `getDatasetRows` MSW handler intermittently failed a `ContractDrift`
check (`total` missing/non-integer) under parallel test runs — green on re-run; **no mock/contract
file is in the R95 diff**. Pre-existing flakiness (shared mock state), worth a future look — logged,
not fixed here.

**HARD-STOP — human Integration re-check + Complete** ([[dfcfbi-f1-needs-human-review]] — Complete is
human-signed-off). Note: **revert `values.yaml` `enable_mock` → `false` before committing** (its own
comment: committing `true` surprises teammates — local-only dev toggle).

## Check

+ [x] **Design gate** — **RATIFIED** (human, 2026-06-25): bounds-only; token-driven container + the
      two ui-design affordances (sticky footer, gutter-on-`colorBgLayout`); flow **overridden to
      DFCFBI**.
+ [x] **F1 gate** — **CONFIRMED** (human, 2026-06-25): bounds confirmed on real screens via mock data;
      no cap-number retune. Build automated-verified (type-check · builder 196/196 · `@mdd/ui` 26/26).
+ [x] **design-sync** — **done**: dataset-detail.md, workspaces.md, workspace-shell.target.md
      reconciled (design:lint/tokens 0 · markdownlint 0 · check:links clean).
+ [x] **Contract / Backend** — **no change** confirmed (diff is FE/CSS + design docs only).
+ [x] **F2 gate** — **closed**: no rework after F1; full gates re-green.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-25** ("flip r95 to
      Complete"). Bounds confirmed on real screens at F1; the human waived a further live re-check in
      favour of closing (fix-forward if anything surfaces). `values.yaml` `enable_mock` reverted to
      `false` before commit.

## Act

R95 shipped the **responsive bounds** (D2+D3): a shared
`PageContainer` (token-driven width cap + `min-height` fill), seven bounded pages, and the
`WorkspacesPage` `xxl` density tier — builder vitest 196/196 + `@mdd/ui` 26/26, type-checks +
design/markdown/link gates clean. Carried lessons:

+ **The human's real-screen F1 check earned its keep** — it caught a pagination-UX problem on short
  viewports that green gates can't see ([[dfcfbi-f1-needs-human-review]]). That problem turned out to
  be a **separate concern**, correctly **split to [Round_96](Round_96.md)** rather than absorbed into
  the bounds round ([[round-bundling-revert-seams]]) — the scope-brake working as intended.
+ **Sticky-bottom footers over scrolling content are an anti-pattern** (they trap with a nested scroll,
  occlude without one) — learned the hard way mid-round; the doctrine now lives in Round_96's design.

## Feeds into → Round_96+

+ **[Round_96](Round_96.md) — pagination / table-view UX** (the immediate next): a per-surface spec
  (view tables = fixed header + viewport-pinned pager; builder preview = plain scroll). Keeps the
  custom `PagedRowsView` (no AntD-`<Table>` migration). Split out of R95 (human's call).
+ **Two-pane (form ↔ preview) detail layout** — the deferred D3 redesign half.
+ **Value-out themes** — consumer-save / Excel, then dashboards ([[post-mvp-roadmap-migration-first]]).
+ **Create-flow design space** — standalone New-query + D6's base-change feature.
