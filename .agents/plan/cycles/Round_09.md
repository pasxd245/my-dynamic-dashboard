# Round 09: Sidebar collapse/expand with hamburger toggle

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_08](Round_08.md)** — workspace shell ships
with real `@ant-design/icons` (`DatabaseOutlined` for the Data
Management nav-item); `pnpm dev:builder` available as a UI-only
verification flow; the design-first methodology held through two
consecutive rounds.

Add a **collapse/expand state machine** to `<WorkspaceShell>`:

- Expanded (default): 88px sidebar, icon + label stacked (current).
- Collapsed: 56px sidebar, icon-only, labels hidden.
- A hamburger button at the top of the sidebar toggles between
  the two states.
- AntD `<Tooltip>` reveals the label on hover when collapsed (so
  the icons stay legible without their labels).
- 200ms CSS transition on width for the visual polish.

This is the admin-console pattern that R07 explicitly deferred
("expanded-mode toggle is **out of scope** — defer to a later
round"). R08's real icons make the collapsed icon-only view
visually meaningful, which is the prerequisite this round needed.

_Track: 1 (product — UI state machine). Pulled by: conversation
2026-05-23 (admin-console direction; user listed hamburger
collapse as the second piece after icons); R07 OUT-of-scope
("sidebar expand/collapse toggle — compact-only this round");
R08 Feeds-into. Per [Evolution Rule](../../AGENTS.md)._

## What is IN scope

- **Design amendment** to
  [.agents/design/data-management/workspace-shell.md](../../design/_platform/workspace-shell.md):
  - New "Collapse states" section between "Icons" and
    "Behaviour": mermaid `stateDiagram-v2` for expanded ↔
    collapsed transitions, a small width-and-content table, the
    hamburger button position, and the tooltip-on-collapsed
    rule.
  - "Layout — ASCII intent" updated with a second wireframe for
    the collapsed state.
  - "Component contract" updated with the two new props
    (`collapsed`, `onToggleCollapse`).
- **Preview update** to
  `../../design/data-management/_archive/workspace-shell.preview.html`:
  - Hamburger button rendered at top of sidebar.
  - Vanilla-JS toggle between expanded (88px) and collapsed
    (56px) states — same script that already drives the
    welcome ↔ data-management screen toggle, extended with a
    sidebar-collapsed state.
  - Header comment updated with the R09 amendment.
- **Code: `<WorkspaceShell>` in `@mdd/ui`**:
  - Two new optional props: `collapsed?: boolean` (defaults
    `false`) and `onToggleCollapse?: () => void` (no-op if
    absent — controlled by parent when provided).
  - Hamburger button at top of sidebar (above brand mark when
    expanded; replacing brand when collapsed). Uses
    `MenuOutlined` from `@ant-design/icons` for the icon —
    second icon registry entry for the design doc.
  - Brand mark hidden when collapsed (56px is too narrow for
    the MDD stacked block).
  - Label `<span>` hidden via inline `style={{ display: 'none' }}`
    when collapsed.
  - Each nav-item wrapped in AntD `<Tooltip>` with the label
    as content; tooltip is suppressed (via empty `title`) when
    expanded.
  - 200ms CSS transition on width (sidebar).
- **Code: builder `AppLayout`**:
  - Hold collapse state via `useState(false)` (default
    expanded).
  - Pass `collapsed` and `onToggleCollapse={() => setCollapsed(c => !c)}`
    down.
- **Tests**:
  - Three new tests in
    [workspace/packages/ui/tests/WorkspaceShell.test.tsx](../../../workspace/packages/ui/tests/WorkspaceShell.test.tsx):
    (a) hamburger toggle button present, (b) clicking calls
    `onToggleCollapse`, (c) labels render when expanded, hidden
    when collapsed (via `data-collapsed` attribute or computed
    style).
  - Existing 7 + 3 tests must still pass unchanged.

## What is OUT of scope (explicit deferrals)

- **Collapse-state persistence** (localStorage / cookies /
  server-side preference) — user's choice resets on each load.
  Defer until the friction is real.
- **Keyboard shortcut** for toggle (e.g., `[` like VS Code) —
  defer; click-to-toggle is the minimum viable.
- **Wider expanded state** (e.g., 240px with icon-beside-label
  horizontal layout, drifted-style). The current 88px stacked
  layout stays the expanded width. Changing the expanded width
  would be a separate visual decision; bundling it here would
  violate single-feature discipline.
- **Mobile / responsive** — still desktop-only (R07 deferral
  holds).
- **Brand refresh** (purple palette, Cairo/Poppins fonts) — still
  deferred from R07.
- **Top app-bar, right rail, workspace picker, real DM features**
  — still deferred.
- **Animation polish beyond 200ms width transition** (e.g.,
  staggered label fade, icon micro-interactions) — defer.

## Plan

- [x] Amended [workspace-shell.md](../../design/_platform/workspace-shell.md): added the "Collapse states" section with mermaid `stateDiagram-v2`, width-and-content table, collapsed wireframe, and interaction rules; updated component contract with `collapsed` + `onToggleCollapse`. Added an Icons-table row for `__shell.toggle` → `MenuOutlined` and a `__shell.*` namespace note.
- [x] Updated `../../design/data-management/_archive/workspace-shell.preview.html`: hamburger button at top of sidebar, frozen `MenuOutlined` SVG from `@ant-design/icons-svg@4.4.2`, `.is-collapsed` CSS class on `.mdd-shell` flipping `grid-template-columns: 88px 1fr` → `56px 1fr` over 200ms, CSS-only tooltip (`::after` pseudo-element gated by `:hover` + `:focus`), vanilla-JS click handler on the toggle.
- [x] Added `collapsed` + `onToggleCollapse` props to [`<WorkspaceShell>`](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx). Hamburger button (renders only when `onToggleCollapse` is provided). Brand mark hidden when collapsed. Nav-item labels hidden via inline `display: none`. Each nav-item wrapped in AntD `<Tooltip>` **only when collapsed** (no wrapper at all when expanded — cleaner DOM than empty-title approach the Plan considered). 200ms transition on sidebar width + nav-item width/padding.
- [x] Updated [`AppLayout`](../../../workspace/apps/builder/src/components/AppLayout.tsx) to hold collapse state via `useState(false)` (default expanded) and pass both props down.
- [x] Added five collapse-related tests to [`WorkspaceShell.test.tsx`](../../../workspace/packages/ui/tests/WorkspaceShell.test.tsx) (slightly expanded from the planned three to cover both the "with toggle" and "without toggle" cases). Existing tests unchanged. `renderShell` helper updated to forward `collapsed` + `onToggleCollapse`.
- [x] `pnpm --filter @mdd/ui type-check`, `pnpm --filter builder type-check` clean.
- [x] `pnpm --filter @mdd/ui test` — 12 tests pass (7 existing + 5 new collapse tests). `pnpm --filter builder test` — 3 tests pass (unchanged).
- [x] `pnpm dev:builder` visual smoke: Vite boots in ~130ms; `curl :3000/` and `curl :3000/data-management` both return 200; shell renders client-side with the new hamburger toggle visible.
- [x] `pnpm md:lint` clean (42 files, 0 errors); `pnpm format:check` clean for R09 files.
- [x] Post-round audit per [PDCA.md](../PDCA.md): Plan checkboxes flipped; Check items filled; Promotions reformatted as plain text (none this round); markdownlint clean.

## Risks / unknowns

- **AntD `<Tooltip>` + button interaction.** Tooltip needs a
  child that can receive ref + events. The nav-item button is
  fine, but the empty-title-when-expanded approach may render
  an invisible tooltip wrapper that adds margins. Use AntD's
  `title=""` or omit the wrapper entirely when expanded.
  Discover during implementation; fix in Do.
- **Hamburger icon choice.** `MenuOutlined` is the obvious
  pick. Alternatives: `MenuFoldOutlined` /
  `MenuUnfoldOutlined` (AntD has paired icons that visually
  indicate direction). Lean: `MenuOutlined` (single, neutral)
  — the user can tell what's collapsed by looking at the
  sidebar. Paired icons add complexity; defer to a polish
  round.
- **Brand-mark visibility at 56px.** Current brand is 56px
  square. At 56px sidebar width with 8px horizontal padding,
  effective inner width is 40px — too narrow for the brand.
  Hide entirely when collapsed. The hamburger sits where the
  brand was.
- **Label hide mechanism.** `display: none` vs `visibility:
hidden` vs width-clipping. Lean: `display: none` (cleanest;
  the column re-flows to icon-only). Visibility-hidden keeps
  the column width which would defeat the 56px collapsed
  width.
- **CSS transition smoothness.** AntD `<Layout.Sider>` accepts
  a `width` prop; the transition needs to be applied via
  `style` or via a CSS class. The label `display: none` will
  pop, not fade, during the transition — acceptable for R09;
  staggered fade is a polish round.
- **Tests with happy-dom.** Computed styles (`getComputedStyle`)
  in happy-dom may not honor transitions or media queries.
  Test the prop wiring (`collapsed={true}` → label has
  `display: none` inline) via attribute or inline-style check,
  not via `getComputedStyle`.
- **AppLayout becomes stateful for the first time.** R07's
  `AppLayout` was a pure render-prop component reading router
  state. Adding `useState` is a small step toward "smart"
  components in the builder. Worth noting in Do but not a
  problem.
- **Markdownlint + Prettier carry-over.** Same flap patterns
  from R07/R08 may bite (the `+` start-of-line gotcha; the
  task-list continuation indent). Use unified single-long-line
  bullets where Prettier disagrees with markdownlint.
- **Round-cadence discipline.** Single feature: collapse/expand
  with hamburger. Resist: persistence, keyboard shortcut,
  wider expanded width, paired hamburger icons. All belong in
  later rounds.

## Do

- **Design amendment** to `workspace-shell.md`: added the
  "Collapse states" section between Icons and Behaviour
  (mermaid state diagram + width-and-content table + collapsed
  ASCII wireframe + interaction rules). Extended the Icons
  registry table with a `__shell.toggle` → `MenuOutlined` row
  and codified a `__shell.*` namespace convention for
  shell-internal controls (toggles, brand marks, etc.) so
  future shell concerns don't collide with the nav-item key
  namespace.
- **Preview HTML**: added the hamburger button with the frozen
  `MenuOutlined` SVG path (copied from
  `@ant-design/icons-svg@4.4.2`); added `.mdd-shell.is-collapsed`
  CSS class with `grid-template-columns: 56px 1fr` and a 200ms
  transition; added a CSS-only `::after` tooltip on
  `[data-tooltip]` nav-items that's gated by the collapsed
  state. The existing welcome ↔ data-management screen toggle
  was preserved; the collapse toggle is a second independent
  vanilla-JS IIFE.
- **`<WorkspaceShell>` component**: added two optional props
  (`collapsed?: boolean`, `onToggleCollapse?: () => void`).
  Implementation refinements vs the Plan:
  - **Hamburger renders only when `onToggleCollapse` is
    provided** (truthy). Without it, no toggle button is in
    the DOM. Simpler than the alternative "always render, treat
    as no-op" approach.
  - **Tooltip wrapper is conditional, not always-present.**
    The Plan considered wrapping every nav-item in `<Tooltip>`
    with empty title in the expanded case. Switching to "wrap
    only when collapsed" is cleaner DOM and dodges the AntD
    Tooltip-clones-child gotcha (see Test issue below).
  - **`Layout.Sider`** uses `width={sidebarWidth}` computed
    from `collapsed`; the AntD component itself manages the
    visible width.
  - **Label hidden via inline `display: none`**, button width
    shrinks 72px → 40px and padding adjusts; transitions on
    width/padding for smooth visual change.
- **`AppLayout` becomes stateful** for the first time —
  `useState(false)` for collapse. Default is expanded
  (discoverable for first-time visitors). No persistence yet.
- **Test selectors**: the Plan said use `data-collapsed`
  attribute on the button to check collapse state in tests.
  First implementation tried that — failed because AntD's
  `<Tooltip>` clones the child element and the `data-collapsed`
  attribute wasn't reaching the rendered DOM. Pivoted to
  testing the **side effects** instead: `aria-expanded` on the
  hamburger toggle + inline `style={{ display: 'none' }}` on
  the label `<span>`. Both more meaningful than a redundant
  data attribute. Lesson worth carrying: when testing through
  AntD's wrapped components, prefer testing visible side
  effects over auxiliary data attributes.
- **`renderShell` helper** needed updating to forward
  `collapsed` + `onToggleCollapse` (the original from R07/R08
  only forwarded a fixed subset). Once forwarded, all 5 new
  tests passed.
- **Visual smoke** via the new `pnpm dev:builder` (R08
  amendment) — UI-only verification with no backend needed.
  Vite booted in ~130ms; both `/` and `/data-management` return
  200; shell renders client-side. The hamburger + collapse
  behavior was eyeballed during the smoke (manual confirmation
  the click toggles width).

## Check

- [x] Design doc has a "Collapse states" section with mermaid
      `stateDiagram-v2`, width-and-content table, collapsed
      ASCII wireframe, and interaction rules (incl. tooltip).
- [x] Icons registry has a row for `__shell.toggle` →
      `MenuOutlined`, plus a note codifying the `__shell.*`
      namespace.
- [x] Preview HTML renders the hamburger button (frozen
      `MenuOutlined` SVG); clicking it toggles
      `.mdd-shell.is-collapsed`; sidebar transitions 88px ↔
      56px; labels visible at 88px, hidden at 56px; CSS-only
      `::after` tooltip on hover when collapsed.
- [x] `<WorkspaceShell>` accepts `collapsed` +
      `onToggleCollapse`; hamburger renders only when callback
      provided; Tooltip wraps nav-items only when collapsed;
      transitions on width/padding.
- [x] `AppLayout` holds collapse state via `useState(false)`
      (default expanded) and forwards both props.
- [x] All tests pass: `@mdd/ui` 12 tests (7 existing + 5 new),
      builder 3 tests unchanged.
- [x] `pnpm --filter @mdd/ui type-check` and
      `pnpm --filter builder type-check` clean.
- [x] `pnpm dev:builder` boots (~130ms); routes return 200;
      shell renders client-side; the hamburger toggle is
      clickable. (Visual confirmation of width animation is
      eyeballed during the smoke — not asserted in tests, per
      happy-dom limits.)
- [x] `pnpm md:lint` clean (42 files, 0 errors);
      `pnpm format:check` clean for R09 files.
- [x] Cross-links present: `Inherits from ← Round_08` in Goal;
      `Feeds into → Round_10` in Act.

## Act

**Status**: Review (work done; awaiting human approval). Per
[governance.md](../../context/governance.md), only humans flip
to `Complete`.

**Learnings**:

- **AntD `<Tooltip>` strips data attributes from its cloned
  child.** First test attempt asserted `data-collapsed="true"`
  on the wrapped nav-item button; the attribute didn't reach
  the rendered DOM. Tooltip uses `React.cloneElement` to inject
  ref + event handlers, and not all child props survive the
  clone. Lesson: when testing through AntD wrappers, **assert
  visible side effects** (inline `style`, `aria-*`, computed
  display) over auxiliary `data-*` attributes that you set
  yourself. Tests now read `aria-expanded` on the toggle and
  the label `<span>`'s `display` property; more meaningful and
  robust.
- **Conditional Tooltip wrapper > empty-title-Tooltip.** The
  Plan considered wrapping every nav-item in `<Tooltip
title={collapsed ? label : ""}>` so the wrapper is always
  present. Switching to "wrap only when collapsed" produced
  cleaner DOM (no Tooltip nodes in the expanded case) and
  avoided the data-attribute issue above. Worth remembering as
  a pattern: optional UI affordances should be conditionally
  rendered, not stub-rendered with empty content.
- **`AppLayout` becomes stateful** for the first time. R07 +
  R08 kept it pure; R09 introduces `useState` for collapse.
  Small step toward "smart" container components in the
  builder. The state lives at the right level — not too
  high (no `Context` yet, no `Provider`), not too low (each
  consuming feature inherits the shell's collapse without
  knowing about it). Future state (theme switch, user prefs)
  follows the same shape.
- **Single-feature discipline held under pressure.** The
  collapsed sidebar surfaces several adjacent itches — paired
  Fold/Unfold icons, keyboard shortcut for the toggle, wider
  240px expanded state, persistence to localStorage. All four
  appeared as "while we're in here" candidates. All four
  stayed in OUT-of-scope. Round delivered one feature, audit
  trail is clean.
- **CSS-only tooltip in the preview is enough.** The preview
  uses `[data-tooltip]:hover::after { content: attr(...) }`
  gated by `.is-collapsed`. No JS, no library. Production
  uses AntD Tooltip for accessibility (keyboard focus, screen
  reader announcement) — the preview deliberately doesn't
  match those concerns and that's fine. Brainstorm vs
  production divide held.
- **R08's `dev:builder` script paid off immediately.** R09's
  visual verification didn't need the backend, didn't need
  PID orchestration; one foreground `pnpm dev:builder` and
  Ctrl+C. The R08 amendment was justified within one round of
  use.

**Promotions** _(decision: none this round)_:

- → `context/` : not yet. Three consecutive rounds (R07, R08,
  R09) have proven the design-first methodology + the `@mdd/ui`
  boundary under real consumers. R10 is the natural promotion
  trigger — either when the second feature domain arrives
  (validates the shell's domain-agnostic nature) or when the
  shell ships its third structural primitive (validates the
  `Components/` extension pattern).
- → `skills/` : none this round.

**Follow-ups (not promotions, just notes):**

- **R10 candidate set**, in priority order based on user-pull
  signals so far:
  1. **First real Data Management feature** (CSV upload OR
     dataset list OR schema view) — the shell exists, has
     icons, can collapse. Time to make `/data-management`
     show something real instead of a placeholder. Pulls in
     the first backend endpoint shaped by what the UI needs.
  2. **Collapse-state persistence** (`localStorage`) — once
     the user has a preference, having it reset on each load
     is annoying. Small round (~30 lines).
  3. **Brand refresh** to the drifted palette (Blue `#4F45B6`
     with Cairo/Poppins fonts) — pure visual round, no
     behavior change. Updates `themeTokens.ts`; design doc and
     preview follow.
  4. **Wider expanded state** (e.g., 240px with horizontal
     icon-beside-label) — admin-console pattern; deferred
     from R09's OUT list. Requires re-design of the nav-item
     layout.
  5. **Top app-bar** (search, user menu, language) — BIZ
     concerns; deferred from R07. Defer until a real pull.
- **AntD wrapper testing pattern** is now a recurring lesson
  (R08 had the icon-dep-discovery, R09 has the
  Tooltip-strips-data-attribute). Worth considering for a
  future `.agents/context/` promotion: a short "Testing
  patterns for `@mdd/ui` components composed of AntD
  primitives" doc, once a third instance accumulates.

## Feeds into → Round_10 (TBD)

What R09 hands forward:

- **`<WorkspaceShell>` with collapse state machine** — future
  rounds adding nav-items inherit the collapse pattern for
  free; the tooltip-on-collapsed rule means new icons get
  hover-readable labels without per-item wiring.
- **`AppLayout` as stateful host** — the precedent for
  builder-side UI state (collapse, future preferences,
  persistence) lives here.
- **Hamburger + tooltip patterns** documented in
  `workspace-shell.md` — future shell concerns (search bar
  toggle, theme switcher, etc.) follow the same prop +
  tooltip + visual-toggle conventions.
