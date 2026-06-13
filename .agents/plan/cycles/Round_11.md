# Round 11: Design — master-layout system + Workspaces feature

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_10](Round_10.md)** — methodology
infrastructure shipped: drifted-iteration hub at `context/`,
distillation memo with 20 verdict-tagged entries, target-shape
doc at `workspace-shell.target.md`, mandatory Surface-declaration
header in the design-doc template, citation discipline + sweep,
new PDCA context-rot-check step.

User named the next product direction (2026-05-23 brainstorming):

1. **Master layout same as drifted** — the full chrome system,
   not just one primitive: `PageCard` + `PageHeader` + sub-menu
   (NAV_GROUPS) + top-bar header slot + paired Fold/Unfold icons.
2. **Workspaces card grid** at `/data-management/workspaces` —
   first real product surface inside the new chrome.

Scope estimate was 4–5 rounds; agreed sequence is **3 rounds**
(design + chrome + feature) — see Feeds-into for R12/R13 sketch.

**R11 is design-only** — two design docs, no code. Honors R10's
methodology: each future round implements against a concept doc
authored before the round begins.

_Track: 1 (product — first real feature direction). Pulled by:
conversation 2026-05-23 (user named master-layout + workspaces
together); R10's [target doc](../../design/_platform/workspace-shell.target.md)
(sketched the chrome system) and [distillation memo](../../memory/2026-05-23-drifted-shell-distillation.md)
entries D / E / I / J (chrome primitive pulls). Per
[Evolution Rule](../../AGENTS.md)._

## What is IN scope

Two design docs **plus a high-fidelity preview**, one cohesive
outcome ("equip R12 and R13 with concrete contracts to implement
against, and give HIxAI a tangible visual target for the first
time"). Bundled because R13's feature design depends on knowing
R12's chrome contracts, and the preview crosses both — showing the
chrome with the workspaces card grid as its content.

- **Refine [workspace-shell.target.md](../../design/_platform/workspace-shell.target.md)**:
  - Promote sketched sections into concrete decisions for R12:
    - Top-bar contents (which slots, which controls, brand
      placement)
    - `NAV_GROUPS` shape (flat-or-grouped union — drifted's
      `navigation` XOR `navGroups`; sub-menu expand/collapse
      pattern)
    - Paired Fold/Unfold icon direction
    - `PageHeader` prop signature (breadcrumb data shape, actions
      slot)
    - `PageCard` prop signature (`default` / `flush` variants,
      what `flush` actually changes)
  - Update the Named-pulls table: mark R12 candidates with concrete
    primitive names; mark R13 with the workspaces pull
  - **No new ASCII layout** — the existing target layout already
    sketches the full chrome; R11 just hardens the contracts
- **Author [.agents/design/data-management/workspaces.md](../../design/data-management/workspaces/workspaces.md)**
  (new concept doc, follows R10's canonical template):
  - **Mandatory Surface declaration** header table — every surface
    R13 introduces, declared with Layer / Reusability / Purity /
    Allowed peer deps
  - **ASCII layout** — card grid, empty state, hover/active card
    affordance
  - **Workspace data model** — fields decided this round, not
    discovered during R13. Open question for HIxAI review (see
    Risks).
  - **Read/write boundary** — what's stub vs real in R13, what
    defers (e.g., persistence, edit, delete). Lean: read-only
    plus create-stub in R13; edit/delete/persistence in R14+.
  - **State management decision** — TanStack Query enters in R13
    (distillation entry N: DEFER → ADOPT-VIA-ROUND), or pure
    `useState` for the stub? Open question for HIxAI review.
  - **Backend endpoint shape** — `GET /workspaces` real, or
    in-memory stub in the builder? Open question for HIxAI review.
  - **Lifecycle** — when this design doc gets amended (R13 close)
    vs superseded (workspaces-v2 future round if model grows)
- **High-fidelity preview** at
  `../../design/data-management/_archive/workspace-shell.preview.html`
  (supersedes R07's preview at the same path, which was past its
  "immediate next round" lifecycle per the design README):
  - Tailwind via CDN, self-contained, opens directly in browser.
  - Full master-layout target: top bar with header slot, sidebar
    with grouped NAV_GROUPS sub-menu (Data Management → Workspaces
    sub-item), breadcrumb + PageHeader, PageCard wrapping the
    content area, **workspaces card grid as the rendered content**
    inside the PageCard.
  - Click-through behavior demonstrating sub-menu expand/collapse
    and paired Fold/Unfold sidebar collapse — vanilla JS, no
    framework.
  - Token parity with `@mdd/ui` — CSS custom properties mirror
    [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
    in a `<style>` block with the standard comment-pointer to the
    authoritative source.
  - Honest framing banner: "Brainstorming preview — not production
    truth. ~90% fidelity to the target. The running builder is the
    real source."
  - Lifecycle: lives through R11 / R12 / R13; retired in R13's Act
    once the running builder visually matches (or supersedes again
    if a R13+ visual direction emerges).
  - **Stays at N=1** — single preview file at a time per concept.
    A `workspaces.preview.html` for zoomed-in card-grid states
    (empty / hover / edit) is _deferred_ to a future round if R12
    or R13 actually need it. That deferral keeps R11 out of the
    N=2 infrastructure (`_css/` extraction + cross-linked previews)
    per the design README's "When to add structure."

## What is OUT of scope (explicit deferrals)

- **Any code.** R11 is documentation-only. No tests, no
  components, no routes. R12 implements chrome; R13 implements
  workspaces.
- **Locking R12/R13 internal scope.** R11 produces the contracts;
  R12 and R13 each have their own Plan-phase Q&A to set their
  internal scope against the contracts. R11 doesn't write R12 or
  R13's Plan.
- **Backend implementation decisions** beyond "stub vs real" framing.
  If "real," the endpoint shape is decided; the implementation is
  R13's call.
- **Brand refresh, top app-bar BIZ contents (search / user menu /
  notifications)** — still deferred from R07 / R10. The header
  slot is designed; what fills it for users is a later round.
- **Workspace edit / delete / persistence** — read-only + create
  in R13, mutations later. Avoid feature-creep into R13.
- **Storybook / Ladle** — still deferred until 3+ primitives.
  R12 will ship 3+ primitives, so this trigger fires after R12 —
  R12's Act or R13's Plan revisits the deferral.

## Plan

- [x] Refine
      [workspace-shell.target.md](../../design/_platform/workspace-shell.target.md):
      promote sketched sections into concrete decisions (top-bar,
      NAV_GROUPS shape, Fold/Unfold direction, PageHeader signature,
      PageCard signature). Update Named-pulls table.
- [x] Author
      [.agents/design/data-management/workspaces.md](../../design/data-management/workspaces/workspaces.md)
      with mandatory Surface declaration, ASCII layout, data model,
      read/write boundary, state-management decision, endpoint
      shape, lifecycle.
- [x] **Author the high-fidelity preview** at
      `../../design/data-management/_archive/workspace-shell.preview.html`
      (supersedes R07's preview in-place). Tailwind CDN; full
      master-layout target with workspaces card grid as content;
      click-through for sub-menu and Fold/Unfold; honest framing
      banner; CSS-var block mirrors `themeTokens.ts`. Reaches ~90%
      visual fidelity to the target — production truth stays the
      running builder.
- [x] HIxAI Q&A loop on open questions (workspace data model,
      TanStack Query timing, backend stub vs real, empty state,
      sub-menu UX). Lock decisions before flipping to Do-complete.
- [x] `pnpm md:lint` clean across both files.
- [x] `pnpm format:check` clean for R11 files.
- [x] No code paths touched: `git status` shows only `.md` changes
      under `.agents/`; test suites unchanged (12 + 3, same as R10).
- [x] Cross-link: `Inherits from ← Round_10` in Goal (already
      above); `Feeds into → Round_12` in Act, naming PageCard,
      PageHeader, NAV_GROUPS, Fold/Unfold, top-bar as R12's
      cohesive chrome scope.
- [x] Post-round audit per [PDCA.md](../PDCA.md) — including the
      new **context-rot check** (this round adds to
      `design/data-management/`, not `context/`, so the check is a
      no-op — but verify).

## Risks / unknowns

- **Five open design questions** for HIxAI review. R11 cannot
  flip to Complete until each has a decision:
  1. **Workspace data model** — minimal `{ id, name }` or richer
     `{ id, name, description, createdAt, updatedAt }`? Lean:
     `{ id, name, createdAt }` — small but date-aware.
  2. **TanStack Query in R13 or defer?** — first server-data
     consumer. Lean: yes in R13 — distillation entry N's trigger
     is exactly "first feature reading server data," and
     workspaces is that feature.
  3. **Backend stub vs real** — `GET /workspaces` real endpoint,
     or in-memory array in the builder? Lean: real endpoint stub
     (returns hardcoded array from backend) — exercises the
     end-to-end product surface and the build-first BIZ boundary
     under genuine pressure.
  4. **Sub-menu UX** — drifted had inline-expandable sub-items.
     Same? Or a flat second-level rail? Lean: drifted's inline
     expand-collapse — proven pattern, fits 88px sidebar.
  5. **Empty state** — big "create your first workspace" CTA,
     or just empty card grid + a small Create button? Lean:
     centered CTA with affordance — empty state is the first
     impression for a new user.
- **Scope creep into R12.** R11 designs both chrome and feature,
  but R12 only implements chrome. Risk: R11 docs may describe
  workspaces in detail and R12 may feel pressure to "land it
  too." Mitigation: workspaces.md explicitly says "feature lands
  in R13; R12 ships chrome only."
- **Workspaces.md is the second instance of the Surface-declaration
  schema.** R10 risked predicted this would stress-test the schema.
  If R11 needs to add a column or drop one, the README amendment
  lands in R11's Act, not deferred.
- **Design-only round inertia.** Same risk R10 named — a no-code
  round can feel like overhead. Mitigation: R12 and R13 are
  immediately downstream and both pull directly from R11's output.
  The methodology has already proven itself (R10 → this round's
  setup).
- **Markdownlint `+` / Prettier carry-over.** Same R07–R10
  pattern. Use `-` bullets; avoid `+` at start of continuation
  lines.
- **Preview ↔ production divergence.** The Tailwind CDN preview
  uses utility classes; the React app uses AntD `<Layout>` /
  `<Layout.Sider>` etc. ~90% visual match is the goal, not pixel
  parity. Token layer bridges the two; component-level structure
  will not match perfectly. Treat the preview as a visual prompt
  for HIxAI feedback, not a pixel contract — R12 implements
  against the markdown + token map, not the preview's div
  structure. Per the design README's "Honest caveats."
- **Superseding R07's preview is a one-way operation.** R07's
  preview file path is reused; the old simpler version is gone
  after this round. If the new target proves wrong during HIxAI
  review, recovery is to amend the new preview rather than restore
  the old one. Acceptable risk: R07's preview is reconstructible
  from its design doc + git history if needed.

## Do

- **HIxAI Q&A locked the 5 open questions** before drafting. User
  accepted all 5 leans verbatim: workspace data model
  `{ id, name, createdAt }`; TanStack Query enters in R13; real
  backend endpoint stub returning hardcoded array; sub-menu inline
  expand-collapse; centred empty-state CTA. Decisions recorded in
  the relevant design docs.
- **Target doc hardened**
  ([workspace-shell.target.md](../../design/_platform/workspace-shell.target.md))
  — replaced the "Component contracts (target signatures — not yet
  implemented)" section with concrete decisions: NavItem/NavGroup
  data shapes, R11-hardened WorkspaceShell prop signature, PageCard
  ships `default` only (`flush` deferred per "Default = don't add"),
  PageHeader with BreadcrumbItem definition, top-bar slots framing,
  paired Fold/Unfold direction convention. Named-pulls table
  superseded with the concrete R11–R13 chain.
- **Workspaces feature doc authored**
  ([workspaces.md](../../design/data-management/workspaces/workspaces.md))
  — Surface declaration with 7 rows spanning `@mdd/ui` / builder /
  backend; ASCII layouts for populated + empty states; data model;
  read/write boundary for R13; TanStack Query setup notes; backend
  endpoint shapes; sub-menu NAV_GROUPS structure; lifecycle.
- **Surface-declaration schema survived a second instance.** R10
  predicted R11 would stress-test the schema. Result: schema held
  unchanged. The workspaces doc added a fourth Layer value
  (`apps/backend/`) and a `feature (server-data)` Purity variant,
  but these slot naturally into the existing columns — no schema
  amendment needed. R10's mandatory header table is doing its
  job.
- **High-fidelity preview authored**
  (`../../design/data-management/_archive/workspace-shell.preview.html`)
  — supersedes R07's preview in-place. Full master-layout chrome
  rendered with workspaces card grid as content. Honest framing
  banner at top. Click-through working from `file://`:
  - Sidebar collapse toggle (paired Fold/Unfold icons)
  - Sub-menu expand/collapse (Data Management group, Workspace
    group)
  - State toggle (bottom-right) flips between populated and
    empty states so HIxAI review can see both
  - 5 sample workspaces in populated state with hover affordance
  - AntD `<Empty>`-style centred CTA in empty state
- **Open question deferred (not blocking R11)**: should
  `WorkspaceCard` be named generically (e.g., `ListCard`) when it
  lands in `@mdd/ui`? Lean: yes (workspace is BIZ-domain
  language). Recorded as an HIxAI open question in workspaces.md;
  R13 commits the name during its Plan phase. Not blocking R11
  Complete — the design contract is solid either way; only the
  identifier varies.
- **No code touched.** `git status` shows only `.md` + the new
  `.html` preview under `.agents/`. Tests unchanged: 12 + 3 pass.
- **Context-rot check** (new PDCA audit step from R10): this round
  modified `design/data-management/` and `plan/cycles/`, not
  `context/`. Check is a no-op for this round. Verified.
- **Preview review-pass enrichment** (user caught issues before R11
  flipped to Complete; series of iterative refinements):
  1. **Icons replaced with real `@ant-design/icons-svg` paths.**
     Unicode glyphs (`▣`, `▶`, `⏴`) → DatabaseOutlined,
     RightOutlined, MenuFoldOutlined / MenuUnfoldOutlined (JS-swapped
     on toggle), InboxOutlined, AppstoreOutlined (Workspaces),
     TableOutlined, BarChartOutlined, DashboardOutlined,
     SettingOutlined. Matches what the production builder renders.
  2. **Speculative content removed.** Initial sidebar had a confusing
     second "Workspace" group + "(future)" sub-stubs for Datasets
     and Schemas. Removed — they were aspirational noise, not R13
     scope.
  3. **Sidebar collapse pattern reworked twice.** First attempt
     hid sub-items entirely when collapsed — user flagged it
     stranded the Workspaces navigation target. Second attempt
     stacked parent and child icons in the rail (flat icon list);
     user questioned correctness, and a research agent confirmed
     the flat-stack fights AntD and doesn't scale. Final pattern:
     **AntD-native flyout-on-hover** (pair `<Menu inlineCollapsed>`
     with `<SubMenu>`). Parent group icon stays in rail; hover
     opens a floating panel to the right with sub-items and a
     group-label header strip. Matches Linear / Slack / VS Code /
     Material Design rail conventions; agent confirmed this is
     what AntD's docs prescribe out of the box.
  4. **Sample-content reintroduced with clear labelling.** To
     verify the flyout pattern handles multiple variants, the
     preview now includes: (a) Data Management group with the
     real Workspaces sub-item plus two `(sample)` sub-items, (b)
     a second `Reports (sample)` group with its own sub-items, (c)
     a flat top-level `Settings (sample)` item. The honest banner
     names them as preview-only. Sample items use a muted uppercase
     `(SAMPLE)` tag suffix so they're visually distinct from R13's
     real scope.
  5. **Workspaces sub-item icon added.** Originally label-only —
     user flagged the gap. Added AppstoreOutlined (four-squares
     grid) — thematically matches the card grid the link leads to.
  6. **Research record**: agent-delivered report confirmed the
     flyout pattern is AntD's documented behaviour for
     `inlineCollapsed` Menu with SubMenu children. Sources include
     [AntD Menu docs](https://ant.design/components/menu),
     [AntD Layout/Sider docs](https://ant.design/components/layout),
     and real-product references (Linear, Slack, VS Code rail
     pattern). The target doc's "Collapsed-sidebar behaviour"
     section now codifies this so R12 implements via AntD's native
     Menu rather than custom CSS.
  7. **Three CSS bugs caught and fixed before sign-off via
     screenshot review.** **Specificity bug**:
     `.mdd-nav-group.is-expanded .mdd-nav-items` (0,3,0) beat
     `.is-collapsed .mdd-nav-items` (0,2,0), so sub-items stayed
     visible in collapsed mode. Fixed by scoping the expanded-mode
     rule to `.mdd-shell:not(.is-collapsed)`. **Click-pin bug**:
     flyout used both `:hover` and `:focus-within`; click triggers
     focus on the parent button, `:focus-within` then pinned the
     flyout open until focus moved elsewhere. Removed
     `:focus-within` — hover-only. Production AntD Menu handles
     keyboard a11y separately. **Icon alignment bug**: group
     headers retained expanded-mode `padding: 8px 16px` in
     collapsed mode (icon left-aligned at x=16) while flat items
     were centred at x=32 — vertical column zig-zagged. Fixed by
     adding `.is-collapsed .mdd-nav-group-header` with
     `justify-content: center` and `padding: 8px 0`. User
     confirmed: "the layout is now 'standard'."
- **Lint flap pattern revisited.** Hit MD004 `+` continuation in
  one bullet in this Round_11.md draft (a wrapped "+ create-stub"
  in the workspaces.md scope description); fixed by rewording.
  Hit Prettier list-indent disagreement once during the
  Cross-link checkbox formatting; fixed by re-indenting the
  continuation to 6 spaces. Same flap patterns as R07–R10. Per
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md).

## Check

_(To be filled during the post-Do review.)_

- [x] `workspace-shell.target.md` refinements landed: top-bar,
      NAV_GROUPS, Fold/Unfold direction, PageHeader signature,
      PageCard signature all concretely decided (not sketched).
- [x] `workspaces.md` exists with Surface declaration, ASCII
      layout, data model, read/write boundary, state-management
      decision, endpoint shape, lifecycle.
- [x] `workspace-shell.preview.html` exists (replaces R07's) with
      the full master-layout target rendered, workspaces card grid
      shown as content, sub-menu expand/collapse + Fold/Unfold
      click-through working from `file://`, honest framing banner
      visible, token vars mirroring `themeTokens.ts`.
- [x] All five open questions in Risks have a decision recorded
      in the relevant design doc.
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for R11
      files.
- [x] `git status` shows only `.md` + `.html` changes under `.agents/`;
      `@mdd/ui` and builder test suites unchanged in count + pass.
- [x] Cross-links: `Inherits from ← Round_10` in Goal;
      `Feeds into → Round_12` in Act with R12's cohesive scope named.

## Act

**Status**: Complete (human-approved 2026-05-23 after the
preview-driven HIxAI feedback loop landed seven review-pass
enrichments — five interactive design fixes via screenshot review
plus the research-driven flyout pivot).

**Learnings**:

- **HIxAI Q&A loop worked exactly as the methodology intended.**
  Five questions surfaced in R11's Plan-phase Risks; user
  reviewed leans and accepted all 5; design docs locked decisions
  before drafting completed. No mid-Do scope re-negotiation. The
  pattern is reusable: any design round with non-obvious choices
  surfaces them as a numbered question list with explicit leans
  in the Risks section.
- **Schema held under second instance.** R10 said "R11 is the
  schema stress test." Workspaces.md added a fourth Layer value
  (`apps/backend/`) and a feature-purity variant, but these slot
  naturally into the existing columns. No schema amendment needed.
  Worth noting as a small confirmation that R10's mandatory header
  table is the right level of abstraction.
- **Preview-as-HIxAI-target paid off.** The `.preview.html`
  superseding R07's was the first time the user can react to the
  full app shape before code lands. Three things it surfaced that
  pure markdown couldn't: (a) the visual hierarchy of sub-menu
  vs top-bar vs PageHeader; (b) the empty-state ↔ populated-state
  transition; (c) the sidebar-collapsed micro-interaction shape.
  R12 implements against the markdown contracts AND has a visual
  anchor for "what should this end up looking like."
- **The single-preview decision (N=1) was right.** I considered
  splitting into two previews (master-layout chrome + workspaces
  zoom) to trigger the N=2 infrastructure (`_css/` extraction +
  cross-linked previews). Keeping at N=1 avoided that scope. The
  workspaces card grid as content inside the master layout
  preview is genuinely more useful than two separate zooms for
  this round's HIxAI feedback. R13 may pull `workspaces.preview.html`
  if hover/edit/empty zooms become needed; that's the natural N=2
  trigger.
- **R07's preview retired in-place cleanly.** Same path, new
  content. The R07 preview's lifecycle had already expired per
  the design README ("lives through that round and the immediate
  next round"); R11 caught the lifecycle correctly. Worth
  remembering as a pattern: stale previews from prior rounds get
  retired when the next round in the same concept domain ships a
  superseding visual target.

**Promotions** (decision: none this round; R12 is the trigger
for the build-first lesson promotion):

- → `context/`: build-first lesson promotion still queued.
  Trigger: R12 closes — that round ships the second `@mdd/ui`
  primitive (PageCard, PageHeader both new in R12) and the
  second shell consumer (Workspaces is the second consumer
  alongside the existing DataManagementPage). Both criteria fire
  in R12. R12 Act runs the promotion.
- → `skills/`: none this round.

## Feeds into → Round_12 (TBD)

What R11 hands forward:

- **`workspace-shell.target.md` refined** — concrete prop
  signatures and chrome decisions; R12 implements against them.
- **`workspaces.md`** — R13's design contract.
- **Locked open-question decisions** — workspace data model,
  TanStack timing, backend shape, sub-menu UX, empty state.

**R12 candidate scope** (per the 3-round chain agreed
2026-05-23): the master-layout chrome system as one cohesive
feature.

- `PageCard` primitive (`default` variant; `flush` deferred until
  consumer needs it per "Default = don't add")
- `PageHeader` primitive + builder `routeMeta` resolver
- `NAV_GROUPS` data shape (grouped union) + sub-menu UI in
  `<WorkspaceShell>`
- Paired Fold/Unfold hamburger icons
- Top-bar header slot wired through to `<WorkspaceShell>`
- Existing `DataManagementPage` re-wrapped in the new chrome
- Triggers the build-first lesson promotion to `context/` (second
  shell consumer + third `@mdd/ui` primitive lands together)

**R13 candidate scope**: the workspaces feature inside the new
chrome.

- Sub-route `/data-management/workspaces`
- Workspace data model per R11 decision
- Card-grid component (read-only first; create flow if scope
  allows)
- TanStack Query first use (or local state, per R11 decision)
- Backend endpoint shape per R11 decision
- Sub-menu active state for "Workspaces" under "Data Management"
- Promotion deferred: TanStack Query lesson capture if its
  introduction surfaces new patterns worth a memo.
