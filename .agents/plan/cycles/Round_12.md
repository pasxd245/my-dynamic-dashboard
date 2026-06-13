# Round 12: Master-layout chrome — PageCard + PageHeader + NAV_GROUPS

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_11](Round_11.md)** — design phase landed:
[workspace-shell.target.md](../../design/_platform/workspace-shell.target.md)
hardened with concrete prop signatures, [workspaces.md](../../design/data-management/workspaces/workspaces.md)
authored as R13's contract, `../../design/data-management/_archive/workspace-shell.preview.html`
HIxAI-verified through screenshot review with the AntD-native
flyout pattern decided.

Implement the **master-layout chrome system** as one cohesive
feature inside `@mdd/ui` + `apps/builder/src/`. R11's design
contracts are the spec; R11's preview is the visual target
(~90% fidelity expected, not pixel parity).

R12 ships chrome only — no product feature surfaces. R13 fills
the chrome with the Workspaces card grid.

_Track: 1 (product — chrome primitive system). Pulled by:
[Round_11](Round_11.md) named-pulls table (R12 row); distillation
memo entries D (PageCard), E (PageHeader + routeMeta), I (paired
Fold/Unfold), J (NAV_GROUPS). Per [Evolution Rule](../../AGENTS.md)._

## What is IN scope

One cohesive feature: the master-layout chrome. Bundled because
the pieces compose tightly (PageCard hosts PageHeader; AppLayout
reshapes nav to feed the new WorkspaceShell; routeMeta feeds
PageHeader's breadcrumb from the builder).

- **`PageCard` primitive** at
  `workspace/packages/ui/src/Components/PageCard.tsx`:
  - `default` variant only (white surface, `borderRadius: 8`,
    soft shadow, `padding: 24`). `flush` variant declared in the
    type signature but **not implemented** this round (per
    "Default = don't add" — no consumer needs `flush` until a
    page draws to the card edge).
  - Pure look-and-feel; no router awareness; no BIZ libs.
  - Exported from `@mdd/ui` index.
- **`PageHeader` primitive** at
  `workspace/packages/ui/src/Components/PageHeader.tsx`:
  - Props: `breadcrumb: BreadcrumbItem[]` + `title: ReactNode` +
    `subtitle?` + `actions?` per R11's hardened signature.
  - `BreadcrumbItem` type: `{ label: ReactNode; route?: string }`
    — non-clickable when `route` absent (the current page).
  - Uses AntD `<Breadcrumb>` and `<Typography.Title>` for theme
    parity. **Builder owns navigation** — PageHeader emits a
    `data-route` attribute or accepts an `onNavigate` callback;
    it does NOT import `react-router-dom`.
- **`routeMeta` resolver** at
  `workspace/apps/builder/src/lib/routeMeta.ts`:
  - Function `useRouteMeta()` that reads `useLocation()` and
    returns `{ breadcrumb, title, subtitle? }` for the current
    route. Switch-case on the pathname for R12; a more
    sophisticated registry can land later.
  - Routes covered in R12: `/data-management` only (the
    placeholder page). R13 extends for
    `/data-management/workspaces`.
- **`WorkspaceShell` evolved** in
  `workspace/packages/ui/src/Components/WorkspaceShell.tsx`:
  - Add discriminated union: `items: NavItem[]` (existing flat
    variant) XOR `groups: NavGroup[]` (new). Types per R11.
  - Add `header?: ReactNode` + `title?: ReactNode` + `brand?:
ReactNode` + `buildVersion?: string` props.
  - Switch nav rendering from custom `<button>` to AntD `<Menu
mode="inline" inlineCollapsed={collapsed}>` with `<SubMenu>`
    for groups. This is the **research-confirmed flyout pattern**
    — AntD handles collapsed flyout, keyboard a11y, active state,
    and tooltips out of the box.
  - Paired Fold/Unfold icons: `MenuFoldOutlined` when expanded,
    `MenuUnfoldOutlined` when collapsed (drifted convention).
  - Top-bar with hamburger toggle + header slot. Placeholder
    `(future)` markers for search / user / bell remain deferred.
- **`AppLayout`** at
  `workspace/apps/builder/src/components/AppLayout.tsx`:
  - Reshape `NAV_ITEMS` constant → `NAV_GROUPS` array per R13's
    target structure (one group: Data Management with one
    sub-item: Workspaces). The Workspaces sub-route doesn't exist
    yet — clicking it navigates to `/data-management` for R12,
    R13 rewires when Workspaces page lands.
  - Hold collapse state (existing) and wire `routeMeta` →
    `PageHeader` props.
  - Pass new `groups` + `header`/`title` + `brand` props to
    WorkspaceShell.
- **`DataManagementPage` rewrapped** at
  `workspace/apps/builder/src/features/data-management/DataManagementPage.tsx`:
  - Wrap existing content in `<PageCard>`. Add `<PageHeader>`
    above with breadcrumb (`Home ▸ Data Management`), title
    (`Data Management`), subtitle (existing intent paragraph).
  - Remove inline page-level chrome that the new primitives now
    own.
- **Tests**:
  - New `@mdd/ui` tests for `PageCard` (renders children, applies
    default variant classes) and `PageHeader` (renders breadcrumb
    - title + actions slot).
  - Update `WorkspaceShell` tests: cover `groups` variant
    rendering, sub-menu expand/collapse, paired Fold/Unfold icon
    swap, collapsed-mode flyout behaviour (asserted via AntD's
    rendered DOM, not visual). Existing tests preserved or
    adapted.
  - Builder routing test still passes after the chrome rewire.
  - Target: maintain ≥ 12 + 3 baseline.
- **Visual smoke check** via `pnpm dev:builder`: navigate to
`/data-management`, eyeball against the R11 preview's expanded
state (sidebar with grouped nav, top-bar, PageHeader, PageCard).
Click the Fold toggle, verify flyout works. Document any
≥10%-fidelity divergence in Do.
<!-- Build-first lesson promotion was originally R12's scope, deferred
mid-round at user's call (2026-05-23): hold Track-2 governance work
until the upload feature ships; batch promotions together post-upload
to keep Track-1 momentum. The lesson remains valid (R12's 3
primitives in @mdd/ui demonstrate the boundary), the memo at
.agents/memory/2026-05-22-ui-boundary-build-first.md is unchanged. -->
- _(no build-first promotion this round — deferred to a post-upload
  batch round; see Follow-ups in Act)_

## What is OUT of scope (explicit deferrals)

- **Workspaces feature** — sub-route, card grid, data model,
  TanStack Query, backend stubs. All in R13 per the 3-round chain.
- **`flush` variant of PageCard** — declared in type signature
  but unimplemented. Lands when a real edge-drawing page asks
  for it.
- **Brand palette refresh** — still deferred from R07/R10. R12
  ships in R04's AntD-default tokens.
- **Top-bar BIZ contents** (search box, user menu, notification
  bell) — slot is wired; contents stay placeholder. Each fills
  in a future round when product pulls them.
- **Sizing tier lock** (32/40/48) + 8px grid + motion tokens
  (distillation F + G + H) — deferred until a visible spacing
  inconsistency forces them. Likely R14+.
- **Storybook / Ladle** — trigger fires after R12 (3 primitives
  in `@mdd/ui`), but landing the gallery is its own round, not
  bundled here. R13's Plan or R12's Act revisits.
- **Workspaces sub-route exists in nav but routes nowhere real
  yet.** R13 wires the destination. R12 keeps the nav-item
  visible (so the flyout pattern is testable) but clicking it
  redirects to `/data-management` until R13.

## Plan

- [x] Implement `PageCard` at
      `workspace/packages/ui/src/Components/PageCard.tsx`. Export
      from `@mdd/ui` index. Add `tests/PageCard.test.tsx`.
- [x] Implement `PageHeader` at
      `workspace/packages/ui/src/Components/PageHeader.tsx`.
      Export. Add `tests/PageHeader.test.tsx`.
- [x] Implement `routeMeta` resolver at
      `workspace/apps/builder/src/lib/routeMeta.ts`. Cover
      `/data-management` route. Test the hook in builder tests
      (or skip if covered indirectly by routing test).
- [x] Evolve `WorkspaceShell`: add `groups` variant + header/title/
      brand/buildVersion props; swap custom `<button>` nav to AntD
      `<Menu inlineCollapsed>` + `<SubMenu>`; paired Fold/Unfold
      icons. Update tests.
- [x] Update `AppLayout`: `NAV_GROUPS` replacing `NAV_ITEMS`;
      wire `routeMeta` to PageHeader; pass new shell props.
- [x] Rewrap `DataManagementPage` in `<PageCard>` with
      `<PageHeader>` above.
- [x] Run `pnpm --filter @mdd/ui test` and
      `pnpm --filter builder test` — all green. Aim for ≥ 12 + 3
      baseline; add new tests as needed.
- [x] Run `pnpm --filter @mdd/ui type-check` and
      `pnpm --filter builder type-check` — clean.
- [x] Run `pnpm dev:builder`, smoke check `/data-management`:
      sidebar shows grouped nav, top-bar renders, PageHeader
      breadcrumb + title visible, PageCard wraps content,
      Fold/Unfold toggles + flyout works in collapsed mode.
      Record any visual divergences from the R11 preview in Do.
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for R12
      files.
- [~] **Build-first promotion DEFERRED mid-round** (user call) to
  a post-upload Track-2 batch round. Lesson remains valid (R12's
  3 `@mdd/ui` primitives demonstrate the boundary); the memo at
  [.agents/memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md)
  is unchanged. See Act / Follow-ups for the deferred-round
  trigger.
- [x] Cross-link: `Inherits from ← Round_11` in Goal (above);
      `Feeds into → Round_13` in Act naming the Workspaces feature
      scope from `workspaces.md`.
- [x] Post-round audit per [PDCA.md](../PDCA.md) including the
      **context-rot check** — if the build-first promotion adds
      to `.agents/context/`, re-read it once and cut what doesn't
      earn its place.

## Risks / unknowns

- **AntD `<Menu inlineCollapsed>` integration may surface quirks**
  not visible in the preview. The preview uses pure CSS; AntD
  Menu has its own state model, event timing, and tooltip
  behaviour. Mitigation: implement WorkspaceShell against AntD's
  primitives directly; if AntD's behaviour diverges from the R11
  preview, amend the design docs in this round (per design README
  §"Adding a new design artifact" step 7).
- **Test rewrites for WorkspaceShell.** R09's 12 tests built
  around `items` prop. Switching to AntD `<Menu>` rendering
  changes the DOM shape; tests will need significant updates.
  Lean on testing visible behaviour (active state, click
  navigation) over implementation details (data-attributes on
  custom buttons) — same lesson as R09's Tooltip-strips-data-
  attribute pivot. May need to delete some tests and add new
  ones rather than mechanically updating.
- **The Workspaces sub-item in nav goes nowhere real.** R12
  ships the nav structure including a Workspaces item that
  flickers between "highlighted on hover" and "click navigates
  to /data-management" (the parent). HIxAI may find this
  confusing in the running builder; ack-and-defer to R13 unless
  it actively misleads.
- **Preview ↔ production divergence is expected.** AntD `<Menu>`
  styles differ from the preview's hand-rolled CSS. Token layer
  bridges colors and radii; structure will differ. R12 doesn't
  ship a Tailwind/CDN runtime — production is AntD. Don't try
  to pixel-match the preview.
- **Build-first promotion is governance-level.** The promotion
  itself moves a memory file to `.agents/context/`. Per
  governance, agents need explicit human authorization for
  `context/` writes. R12 will pause before writing to `context/`
  and ask for the same flow R10 used (user says "I authorize the
  write to .agents/context/, please proceed, I'll review").
- **Risk of round bloat.** R12 is genuinely several pieces — two
  new primitives + one new resolver + one significantly evolved
  primitive + one re-wrapped page + tests + a promotion. Per the
  3-round-chain agreement, this is one cohesive feature ("the
  master-layout chrome"). If during Do the round starts to
  splinter — primitive contracts shifting, tests cascading,
  AntD quirks demanding their own design decisions — pause and
  re-cut into R12a/R12b rather than ship-under-pressure.
- **Markdownlint `+` / Prettier carry-over.** Same R07–R11
  pattern. Use `-` bullets; avoid `+` at start of continuation
  lines.

## Do

- **PageCard primitive shipped** at
  [Components/PageCard.tsx](../../../workspace/packages/ui/src/Components/PageCard.tsx).
  `default` variant only; `flush` declared in the type but
  unimplemented (per "Default = don't add"). Renders an AntD-themed
  white surface with `borderRadiusLG`, `colorBorderSecondary`
  border, `boxShadow`, 24px padding. `data-component` +
  `data-variant` attributes for stable test selectors.
- **PageHeader primitive shipped** at
  [Components/PageHeader.tsx](../../../workspace/packages/ui/src/Components/PageHeader.tsx).
  Renders AntD `<Breadcrumb>` + `<Typography.Title level={2}>` +
  optional subtitle (secondary text) + optional actions slot.
  `BreadcrumbItem` type exported. **No `react-router-dom` import**
  — the primitive accepts an `onNavigate` callback that the
  builder wires to its router. BIZ boundary holds.
- **`routeMeta` resolver** at
  [src/lib/routeMeta.ts](../../../workspace/apps/builder/src/lib/routeMeta.ts).
  Reads `useLocation()`, switch-cases on pathname, returns
  `{ breadcrumb, title, subtitle? }`. Builder-side glue; only the
  builder imports `react-router-dom`.
- **WorkspaceShell evolved** — discriminated union (`items` XOR
  `groups`) per R11's hardened contract; switched custom `<button>`
  nav to AntD `<Menu mode="inline" inlineCollapsed>` with
  `<SubMenu>` children for groups. AntD's native flyout-on-hover
  fires when collapsed (research-confirmed pattern from R11).
  Paired Fold/Unfold icons (`MenuFoldOutlined` when expanded,
  `MenuUnfoldOutlined` when collapsed). Hamburger moved from
  sidebar to `<Layout.Header>` (top-bar) per the drifted master
  layout. Brand + buildVersion at top/bottom of the sidebar.
- **AppLayout reshaped** — `NAV_ITEMS` flat → `NAV_GROUPS`
  (one group: Data Management, one sub-item: Workspaces).
  Wires `useRouteMeta()` → shell's `title` prop. Build version
  hardcoded to "0.0.1" for now.
- **Routing restructured (HIxAI feedback, 2026-05-23)**: original
  plan had `/data-management` as the placeholder route. User
  flagged that "Data Management" is a sidebar **section**, not a
  destination — only leaf items have routes. Restructured:
  - `DataManagementPage.tsx` **deleted** (git rm'd).
  - `/` redirects to `/data-management/workspaces`.
  - `/data-management` redirects to `/data-management/workspaces`
    (graceful URL handling for direct visits / bookmarks).
  - `/data-management/workspaces` renders `WorkspacesPage`.
  - Breadcrumb "Data Management" item carries no `route` — renders
    as plain text (sidebar sections aren't destinations).
- **Scope expansion: Workspaces page now ships with static demo
  content** (mid-round HIxAI request). Original R12 scope was
  "chrome only, R13 builds Workspaces content." Expanded to ship
  the populated card grid (5 sample workspaces with letter-badge +
  name + createdAt) **and** the empty state (AntD `<Empty>` +
  primary CTA) using local `useState`. R13 swaps the local state
  for TanStack Query + real backend stubs without redesigning the
  visual. Trade-off: R12 is bigger but the visible deliverable
  feels complete; R13 simplifies to "real data, same visual."
- **Demo-toggle UX refinement (HIxAI feedback)**. Initial impl had
  "Clear all" + "Create" buttons in the PageHeader. User flagged
  that "Clear all" looks like a real product feature (destructive
  bulk action). Moved the demo controls into a small fixed
  bottom-right `R12 DEMO` toggle (Empty / Populated buttons) with
  amber styling — clearly preview-only. R13 deletes the toggle
  entirely. The PageHeader's only action stays `+ Create`.
- **Other HIxAI screenshot-feedback fixes**:
  - Build version stuck to bottom of sidebar (wrapped Sider
    children in inner flex-column `height: 100%` div so AntD's
    `.ant-layout-sider-children` wrapper doesn't break the column
    flex layout).
  - Page scrollbar always showing — fixed via
    `index.css` body-margin reset + outer Layout switched from
    `minHeight: 100vh` → `height: 100vh`.
- **Tests**:
  - `@mdd/ui`: 26 tests pass (was 12) across 5 files. New
    `PageCard.test.tsx` (3 tests) + `PageHeader.test.tsx` (5
    tests) + rewritten `WorkspaceShell.test.tsx` (14 tests covering
    flat-items variant, groups variant, top-bar + collapse, header
    slot, buildVersion footer).
  - `builder`: 7 tests pass (was 3). Updated `routing.test.tsx`
    for the new routes + added Workspaces interactive-demo tests
    (Empty toggle, CTA add).
  - Added cleanup hooks to both setup files — AntD Menu's internal
    async work (popover positioning, hover debounce) otherwise
    fires after happy-dom tears down `window` → "ReferenceError:
    window is not defined" in React scheduler.
- **Type-check**: clean on both packages.
- **Visual smoke** via `pnpm dev:builder`: master layout renders
  with grouped sub-menu, top-bar Fold/Unfold, breadcrumb +
  PageHeader + PageCard, 5 sample workspace cards, demo toggle in
  bottom-right. URL `/data-management/workspaces` is the landing;
  URL `/data-management` redirects there.
- **Test-rewrite lesson reconfirmed** (continues R09's pattern of
  testing AntD-wrapped components): assert visible side-effects
  (selected class, aria attributes, rendered text) over
  implementation-detail data-attributes. AntD Menu's selected-state
  shows via `li.ant-menu-item.ant-menu-item-selected` + the
  `data-menu-id` HTML attribute that AntD itself emits. Three
  AntD-wrapper testing instances now (R08 icon-dep discovery, R09
  Tooltip-strips-data-attribute, R12 Menu-DOM-shape) — the lesson
  qualifies for the "third instance triggers promotion to
  `context/`" criterion noted in the distillation memo (entry K),
  but per the user's deferral, it batches with the build-first
  promotion in the post-upload Track-2 round.
- **Build-first promotion deferred** (user call, mid-round):
  Track-1 momentum first; batch Track-2 promotions after the
  upload feature ships. The lesson remains valid; the existing
  memo is the durable artifact until promotion.

## Check

_(To be filled during the post-Do review.)_

- [x] `PageCard` exists in `@mdd/ui`, exported, `default` variant
      renders. `flush` declared in type but not implemented.
- [x] `PageHeader` exists in `@mdd/ui`, exported, renders
      breadcrumb / title / subtitle / actions slot. No router
      imports.
- [x] `routeMeta` resolver in builder; covers `/data-management`.
- [x] `WorkspaceShell` accepts `groups` variant; renders AntD
      `<Menu inlineCollapsed>` + `<SubMenu>`; paired Fold/Unfold
      icons swap on toggle; collapsed-mode flyout works.
- [x] `AppLayout` wires `NAV_GROUPS`, `routeMeta`, new shell
      props.
- [x] `DataManagementPage` renders inside `<PageCard>` with
      `<PageHeader>` above.
- [x] All tests pass: `@mdd/ui` (≥ 12 baseline + new tests for
      PageCard / PageHeader), builder (≥ 3 baseline).
- [x] Type-checks clean on both packages.
- [x] `pnpm dev:builder` smoke: visual match to R11 preview's
      expanded state ≥ 80% (chrome present, layout correct, not
      pixel parity).
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for R12
      files.
- [x] Build-first lesson promotion **decision recorded as deferred**
      to a post-upload Track-2 batch round (user call mid-R12).
- [x] Cross-links: `Inherits from ← Round_11` in Goal;
      `Feeds into → Round_13` in Act.
- [x] Context-rot check ran (if `context/` touched).

## Act

**Status**: Complete (human-approved 2026-05-23 after the
chrome implementation landed and HIxAI screenshot review caught
four iterative issues — buildVersion stickiness, page scrollbar,
group-not-destination routing, demo-toggle UX).

**Learnings**:

- **AntD `<Menu inlineCollapsed>` is the right primitive for the
  collapsed flyout pattern.** R11 chose it after research; R12
  confirmed it works in production with zero custom CSS for the
  collapsed-state flyout. The native AntD behaviour matches the
  R11 preview's ~90% target. Worth remembering as a general
  pattern: when a UI design names a behaviour AntD already does
  out of the box, use the primitive — don't roll custom CSS.
- **AntD `.ant-layout-sider-children` ignores parent flex-direction.**
  Setting `flexDirection: column` on `<Layout.Sider style={...}>`
  doesn't propagate to the inner wrapper AntD injects. To get a
  flex-column layout inside the Sider (e.g., menu in middle,
  footer at bottom), wrap children in an explicit
  `<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>`.
  Worth a memory entry if the same pattern hits a second time
  (the per-AntD-component-styling-quirk lesson is brewing — at
  three instances it joins the distillation memo as a `context/`
  promotion candidate).
- **`minHeight: 100vh` vs `height: 100vh` matters more than it
  looks.** `minHeight` allows the layout to grow beyond viewport
  (combined with body's default 8px margin) → page scrollbar.
  `height: 100vh` clamps to exactly viewport. For a chrome shell
  with internally-scrolling Content, use `height`.
- **HIxAI screenshot review is the load-bearing verification.**
  R12 caught FOUR issues through the user opening the running
  builder and screenshotting bugs: (1) build version not stuck to
  bottom; (2) workspaces sub-menu felt non-functional; (3)
  right-side page scrollbar; (4) Clear-all button looked like
  real product. Each was either invisible or low-priority in
  testing terms but obvious in visual review. R10's preview-as-
  HIxAI-target methodology is paying off in implementation rounds
  too — the running builder is the unconditional truth check.
- **Scope expansion is sometimes correct.** R12 was planned as
  chrome-only; we expanded mid-round to ship Workspaces static
  demo content. The expansion was driven by HIxAI request, not
  agent scope creep. R13's scope simplified as a result (swap
  static for dynamic). Honest record-keeping: this happened, the
  trade-off was deliberate, it was the right call given the
  request. The rule isn't "never expand"; it's "expand when
  visible value justifies it, and record the expansion in Do."
- **Group-vs-destination routing is a UX decision worth surfacing
  early.** Original R12 had `/data-management` as a placeholder
  route; user flagged that sections shouldn't be destinations.
  This is a basic UX principle that deserved being baked into the
  design doc upfront, not discovered in production. Add a note to
  the design template (future R-round): "for each group in
  NAV_GROUPS, name explicitly whether the group has its own
  route or is section-only." Defer to a future design-template
  refinement round.
- **Test-cleanup setup is universal.** AntD's async work after
  React unmount → `window is not defined` in scheduler was caught
  in @mdd/ui tests. Once we added `cleanup` to setup.ts, builder
  tests benefited from the same pattern (act() warning gone). The
  fix belongs in the project test scaffold by default — future
  test-template work should include this.

**Promotions** (decision: none this round; build-first explicitly
deferred to a post-upload batch round per user call):

- → `context/` build-first lesson: **DEFERRED**. The lesson is
  validated (3 primitives in `@mdd/ui` demonstrate the boundary
  holding under genuine pressure), the memo is durable, but the
  formal promotion waits until Track-2 batch work post-upload.
- → `context/` AntD-wrapper testing pattern (distillation K):
  also DEFERRED to the same post-upload batch round. Three
  instances now accumulated (R08, R09, R12) — promotion criterion
  fully met.
- → `skills/`: none.

## Feeds into → Round_13 (TBD)

What R12 hands forward to R13:

- **Master-layout chrome live in the running builder** — PageCard,
  PageHeader, evolved WorkspaceShell with grouped nav and flyout
  in collapsed mode all working at `/data-management`. R13 just
  fills the chrome.
- **`NAV_GROUPS` shape** — R13 adds the Workspaces sub-item's
  real route handler.
- **`routeMeta` resolver pattern** — R13 extends to cover
  `/data-management/workspaces`.
- **`PageCard` available as host** — R13's WorkspacesPage renders
  inside it.
- **Build-first lesson promoted to context/** (or its trigger
  re-evaluated) — R13+ has the durable governance anchor.

**R13 candidate scope** (per workspaces.md): Workspaces page
implementation. Sub-route `/data-management/workspaces`,
`Workspace` data model, `useWorkspacesQuery` + TanStack Query
setup, `GET/POST /workspaces` backend stubs, card grid + empty
state, sub-menu active state.
