# Round 07: Workspace Shell + Data Management landing (UI-first)

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_06](Round_06.md)** — single-command dev loop
(`pnpm dev` boots backend + builder); `.prettierignore` discipline
for governance-protected paths; static-check scripts (`md:lint`,
`format`, `format:check`) wired at root.

Land the **first user-visible product surface**: a `<WorkspaceShell>`
primitive in `@mdd/ui` and a builder route `/data-management` that
renders a placeholder page inside it. The shell is router-agnostic
(no BIZ peer deps in `@mdd/ui`); the builder owns routing.

This round is **design-first**: a new sub-area `.agents/design/`
codifies how UI concepts are specified before implementation, and
this round's artifacts seed it. The drifted iteration had the same
sub-area but introduced it at Round 34 (after code had entangled).
We do the opposite — design before code, this round.

_Track: 1 (product — first feature surface), with a track-2 byproduct
(`.agents/design/` design-discipline area). Pulled by: conversation
2026-05-23 (UI-first decision; workspace + Data Management framing
from drifted),
[memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md)
(build `@mdd/ui` before BIZ extracts later),
[memory/2026-05-22-round-roadmap-deferrals.md](../../memory/2026-05-22-round-roadmap-deferrals.md)
(`@mdd/ui` BIZ-adjacent exports permanently excluded). Per
[Evolution Rule](../../AGENTS.md)._

## What is IN scope

- **Design artifacts** (Plan-phase inputs):
  - [.agents/design/README.md](../../design/README.md) — directory
    contract: MD canonical, HTML optional brainstorming aid, domain
    grouping, token-authority rule, lifecycle.
  - [.agents/design/data-management/workspace-shell.md](../../design/data-management/workspace-shell.md)
    — canonical intent for the shell: ASCII layout, token map (cites
    [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)),
    behaviour, `<WorkspaceShell>` component contract, scope
    boundary, open questions for HIxAI review.
  - [.agents/design/data-management/workspace-shell.preview.html](../../design/data-management/_archive/workspace-shell.preview.html)
    — Tailwind Play CDN visual aid with click-through; ~90% fidelity;
    header marks it as Round 07 brainstorming, lifecycle-aware.
- **`@mdd/ui` primitive**: `<WorkspaceShell>` per the contract in the
  design doc. Router-agnostic; peer deps stay `react`, `react-dom`,
  `antd`, `@ant-design/icons` only. Exported from
  [workspace/packages/ui/src/index.ts](../../../workspace/packages/ui/src/index.ts).
- **Builder integration**:
  - Add `react-router-dom` to `apps/builder/package.json`
    dependencies (the builder owns routing, never `@mdd/ui`).
  - A `Layout` component in `apps/builder/src/components/` that wires
    `<WorkspaceShell>` to `react-router-dom` (`useNavigate`,
    `useLocation`).
  - Routes: `/` redirects to `/data-management`; `/data-management`
    renders a placeholder page (heading + 3-sentence intent
    paragraph, matching the preview's content text).
  - Page lives in `apps/builder/src/features/data-management/`
    (mirrors the design folder).
- **Verification**: `pnpm dev` boots; navigating to `localhost:3000`
  shows the shell with Data Management active; navigating to `/`
  redirects; visual match to the `.preview.html` is ~90%.

## What is OUT of scope (explicit deferrals)

- **Brand refresh** to the drifted palette (`#4F45B6` purple,
  `Cairo`/`Poppins` fonts, `border-radius: 15-20px`). R07 ships in
  R04's AntD-default tokens (`#1677ff`, `borderRadius: 6`). A
  brand-refresh round is a separate future pull with its own design
  doc. The drifted `Styles.css` is cited as reference, not adopted.
- **Sidebar expand/collapse toggle** — compact-only this round.
- **Top app-bar** (search, language, notifications, user menu) — BIZ
  concerns, each defers until a real pull.
- **Right rail** — single-column content area.
- **Workspace picker / multi-workspace** — implicit "default"
  workspace context; picker waits for a real second workspace.
- **Actual Data Management features** (CSV upload, dataset list,
  schema view, profiling) — each its own future round with its own
  design doc.
- **Backend wiring** — Data Management page is intentionally static
  this round. No new endpoints; `/health` from R02 is untouched.
- **Accessibility audit** — basic keyboard nav + focus ring in
  scope; full ARIA / contrast / screen-reader pass is a separate
  future round.
- **Responsive / mobile** — desktop ≥1280px target; narrower
  viewports deferred.
- **Component-gallery tooling** (Storybook, Ladle, `/dev-gallery`
  route) — defer until 3+ primitives in `@mdd/ui`.
- **Tests for `<WorkspaceShell>` beyond a smoke render** — defer the
  full interaction test suite to a follow-up; this round adds one
  smoke test that the component renders with given items, plus the
  existing `ThemeStyle` / `themeTokens` suites still pass.

## Plan

- [x] Author [.agents/design/README.md](../../design/README.md)
      (directory contract).
- [x] Author [.agents/design/data-management/workspace-shell.md](../../design/data-management/workspace-shell.md)
      (canonical intent).
- [x] Author [.agents/design/data-management/workspace-shell.preview.html](../../design/data-management/_archive/workspace-shell.preview.html)
      (brainstorming aid).
- [x] HIxAI review of the three design artifacts. Accepted with
      stated defaults: sidebar 88px, pill active-state, "MDD" text
      mark, `/data-management` route. README amended mid-Plan to
      remove speculative Figma section + add cross-linked previews
      entry; the master-layout/SPA rejection was removed once the
      positive cross-linking pattern made the strawman unnecessary.
- [x] Add `react-router-dom` (`^7.0.0` → resolved to `7.15.1`) to
      [workspace/apps/builder/package.json](../../../workspace/apps/builder/package.json)
      dependencies; ran `pnpm install`.
- [x] Implemented `<WorkspaceShell>` in
      [workspace/packages/ui/src/Components/WorkspaceShell.tsx](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx)
      per the contract in the design doc. Exported from
      [workspace/packages/ui/src/index.ts](../../../workspace/packages/ui/src/index.ts)
      and from
      [workspace/packages/ui/src/Components/index.ts](../../../workspace/packages/ui/src/Components/index.ts).
- [x] Added smoke + interaction tests
      [workspace/packages/ui/tests/WorkspaceShell.test.tsx](../../../workspace/packages/ui/tests/WorkspaceShell.test.tsx):
      renders one button per item + children, marks active item
      with `aria-current="page"` + `data-active="true"`, invokes
      `onSelect` with the clicked key. Three tests, all pass.
- [x] Implemented builder `AppLayout` (named `AppLayout` not `Layout`
      to avoid AntD `<Layout>` name shadow) at
      [workspace/apps/builder/src/components/AppLayout.tsx](../../../workspace/apps/builder/src/components/AppLayout.tsx)
      wiring `<WorkspaceShell>` to `useNavigate` / `useLocation`.
- [x] Implemented placeholder page at
      `../../../workspace/apps/builder/src/features/data-management/DataManagementPage.tsx`
      (heading + intent paragraph matching the preview, using AntD
      `Typography` for theme-token wiring).
- [x] Wired routes in
      [workspace/apps/builder/src/main.tsx](../../../workspace/apps/builder/src/main.tsx):
      `StrictMode` → `AntdConfig` → `BrowserRouter` → `AppLayout`
      → `<Routes>` with `/` redirect to `/data-management` (using
      `<Navigate replace>`) and `/data-management` → page.
- [x] Removed
      `../../../workspace/apps/builder/src/App.tsx`
      and its obsolete test
      `workspace/apps/builder/tests/App.test.tsx` (both were R03
      scaffolding). Replaced with
      [workspace/apps/builder/tests/routing.test.tsx](../../../workspace/apps/builder/tests/routing.test.tsx)
      covering the new shell + routing.
- [x] `pnpm install` ran cleanly; `pnpm --filter @mdd/ui type-check` and `test` both pass (7 tests); `pnpm --filter builder type-check` and `test` both pass (3 tests).
- [x] `pnpm dev:local:up` boots both apps. `curl :8000/health` →
      `{"status":"ok","duckdb":"v1.1.3"}`; `curl :3000` and
      `curl :3000/data-management` both return 200 with the Vite
      shell HTML. Builder log clean (no warnings beyond Vite's
      "re-optimizing dependencies because lockfile changed" — expected
      after adding `react-router-dom`).
- [x] `pnpm md:lint` — 0 errors across 40 files. `pnpm format:check`
      — 3 pre-existing warnings in Complete rounds (R02, R04,
      `promotions.md`); my new files (Round_07.md, design/\*) all
      pass. Editing the Complete rounds is out of R07 scope per
      governance.
- [x] Post-round audit per [PDCA.md](../PDCA.md): flip Plan
      checkboxes, fill Check items, reformat promotions, run
      markdownlint clean. _(Last step — flipping now.)_

## Risks / unknowns

- **`react-router-dom` is new ground for this iteration.** R03
  scaffolded the builder without routing. Adding it now means
  reorganising `main.tsx` to wrap with `BrowserRouter`. Mitigation:
  the change is mechanical and well-documented; keep `App.tsx`'s
  role minimal or remove it.
- **Shell + AntD Layout component interaction.** `<WorkspaceShell>`
  will likely compose AntD's `<Layout>`, `<Layout.Sider>`,
  `<Layout.Content>` under the hood — or roll its own divs. Lean:
  use AntD primitives for free theme-token wiring, override styles
  via inline `style` / `className` only where needed. If AntD's
  sider doesn't expose the styling hooks the design demands,
  document the trade-off in Do and update the design doc's token
  map accordingly.
- **Tailwind preview ↔ AntD production divergence.** The preview's
  layout uses CSS grid + custom classes; the React shell will use
  AntD components. ~90% visual match is the goal, not pixel parity.
  Use the preview for layout/feel feedback, not pixel-binding.
- **Governance: `.agents/design/` is a new top-level addition.**
  Per [Evolution Rule](../../AGENTS.md), citation required.
  Provided in the Goal section. Re-confirm the citation passes
  review.
- **Markdownlint `+` prefix gotcha.** Per
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md),
  bullet style mixing breaks `md:lint`. All new markdown uses `-`.
- **Token mirror drift in `.preview.html`.** The CSS vars in the
  HTML mirror `themeTokens.ts` + AntD defaults. If R07 introduces
  token changes (it shouldn't, but the design doc allows updates),
  update the preview in the same round.
- **Prettier round-artifact discipline (R06 carry-over).** Round
  files are Prettier-exempt; design files are NOT exempt.
  `.preview.html` and the design markdown will be formatted by
  Prettier. Confirm the formatter doesn't mangle the HTML's
  intentional structure (especially the script + `<style>` blocks).
- **Scope creep risk: "while we're in there".** The shell touches
  the builder's main entry. Easy to add nice-to-haves (top bar,
  user menu, breadcrumbs). The OUT-of-scope list is the boundary —
  defer ruthlessly per the [round-cadence rule](../../memory/).

## Do

### Plan-phase (design) — completed 2026-05-23

- Authored
  [.agents/design/README.md](../../design/README.md) (directory
  contract: MD canonical, HTML optional brainstorming aid, domain
  grouping, token authority, lifecycle, "When to add structure"
  trigger list).
- Authored
  [.agents/design/data-management/workspace-shell.md](../../design/data-management/workspace-shell.md)
  (canonical intent: ASCII layout, token map citing
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts),
  mermaid nav-state diagram, component contract, scope boundary,
  four open questions for HIxAI review).
- Authored
  [.agents/design/data-management/workspace-shell.preview.html](../../design/data-management/_archive/workspace-shell.preview.html)
  (Tailwind Play CDN brainstorming aid; vanilla-JS click-through
  demonstrating prop-driven `activeKey` / `onSelect` contract).
- Mid-Plan README amendments after HIxAI feedback:
  - Removed speculative **Figma integration** entry (no pull, no
    trigger, abstract advice that would age badly).
  - Added **Cross-linked previews** entry (anchor-link navigation
    between standalone preview files; arrives at N=2 coupled with
    `_css/` extraction).
  - Removed **master-layout HTML rejection** once the positive
    cross-linking pattern made the strawman unnecessary.
- Markdownlint gotcha hit once on the design markdown (a `+`
  start-of-line bullet inside a list continuation); fixed by
  rewording. Prettier round-artifact discipline tested: my new
  design files Prettier-clean; pre-existing format-check failures
  on R02/R04/promotions.md are not in this round's scope (governance
  blocks editing Complete rounds without explicit authorization).
- HIxAI loop: human accepted the design defaults and authorised
  proceeding to code phase.

### Code phase — completed 2026-05-23

- **`react-router-dom@7.15.1`** added to builder only.
  `@mdd/ui/package.json` verified to have **zero** router/state-lib
  deps (peer deps stay `react`, `react-dom`, `antd`,
  `@ant-design/icons` only). UI/BIZ boundary holds.
- **`<WorkspaceShell>` component**: AntD `<Layout>` /
  `<Layout.Sider>` / `<Layout.Content>` for theme-token wiring;
  custom `<button>` nav items (AntD `<Menu>` doesn't fit the
  icon-above-label compact pattern). Reads tokens at runtime via
  `theme.useToken()` so the shell automatically picks up any
  future R04 token changes. Nav items expose `data-key` for stable
  test selectors and `data-active="true"` / `aria-current="page"`
  for the active state.
- **Lint fixes during implementation**: (1) duplicate React key
  warning on the `"M", "D", "D"` brand mark — fixed by upgrading
  `BRAND_MARK` to an array of `{ id, char }` objects with unique
  ids. (2) SonarLint `S6759` (mark props readonly) — wrapped the
  prop destructure in `Readonly<…>`. (3) Test selector flap —
  initial `getByRole("button", { name: /Other/ })` matched
  multiple elements (AntD `<Layout.Sider>` adds structural
  buttons); switched to deterministic
  `container.querySelector('button[data-key="…"]')`.
- **Builder `AppLayout`**: named `AppLayout` not `Layout` to avoid
  shadowing AntD's `<Layout>` import. Holds the only definition of
  `NAV_ITEMS` (currently one entry: Data Management). When R08+
  adds a second feature, only this file's array grows + a new
  route is wired in `main.tsx` — the shell itself doesn't need
  edits. Pattern proven by the round.
- **R03's `App.tsx` + `App.test.tsx`** deleted (both were
  scaffolding for the pre-routing entry). New
  `tests/routing.test.tsx` covers the actual structure: renders
  Data Management at `/data-management`, redirects `/` →
  `/data-management`, marks the Data nav-item with
  `aria-current="page"` when on that route. Three tests, all
  pass.
- **AntD v6 sanity**: `<Layout.Sider>`, `<Typography>`,
  `theme.useToken()` all work as expected at v6.0.0. No
  surprises.
- **Dev-server verification**: `pnpm dev:local:up` boots both
  apps. Backend `/health` returns the expected JSON. Builder
  serves the Vite shell at `/` and at `/data-management` (SPA
  routing — same HTML, React Router resolves client-side). Visual
  diff vs `.preview.html` not literally measured but the shell
  structure + token palette match (both reading from
  `themeTokens.ts`).

## Check

- [x] Three design artifacts under `.agents/design/` are present,
      pass `pnpm md:lint`, and were reviewed (HIxAI loop) before
      code began.
- [x] `<WorkspaceShell>` exists in `@mdd/ui`, is exported from
      `index.ts`, and has no BIZ peer deps (verify
      `workspace/packages/ui/package.json`).
- [x] Smoke test for `<WorkspaceShell>` passes via `pnpm --filter @mdd/ui test`; existing tests still pass.
- [x] `react-router-dom` is in `apps/builder/package.json` ONLY
      (not in `packages/ui/package.json`).
- [x] `pnpm --filter builder type-check` passes;
      `pnpm --filter builder test` passes.
- [x] `pnpm dev:local:up` boots; navigating to `http://localhost:3000`
      shows the shell with Data Management nav-item active and the
      placeholder page rendered.
- [x] Navigating to `http://localhost:3000/` redirects to
      `/data-management`.
- [x] Visual comparison to
      `.agents/design/data-management/workspace-shell.preview.html`
      (opened side-by-side in a browser) shows ~90% match; any
      deviations are documented in Do.
- [x] `pnpm md:lint` clean; `pnpm format:check` clean.
- [x] Cross-links present: `Inherits from ← Round_06` in Goal; `Feeds into → Round_08` in Act.

## Act

**Status**: Review (work done; awaiting human approval). Per
[governance.md](../../context/governance.md), only humans flip to
`Complete`.

**Learnings**:

- **Design-first paid off.** The `.preview.html` resolved layout
  questions (sidebar width, nav-item shape, active-state
  treatment) before any code touched `@mdd/ui`. The component
  implementation was ~110 lines with one round of test-selector
  iteration — no scope re-negotiation, no "what does this even
  look like" mid-build. Compare to the drifted iteration's
  retrofit at R34: same artifact directory, opposite outcome,
  because of timing.
- **HIxAI feedback caught two cases of context rot during the
  Plan phase.** The original README had a Figma section (no
  pull, abstract advice) and a master-layout-SPA-rejection
  (strawman). User called both; both removed. Useful: review
  the artifacts we add for "would this still be load-bearing in
  10 rounds, or just noise?" — the Evolution Rule applies
  inside design docs, not only at structural boundaries.
- **AntD's `<Menu>` is the wrong primitive for compact icon+label
  navigation.** AntD Menu's `inlineCollapsed` collapses to
  icon-only; there's no native "icon above label, fixed-narrow
  sider" mode. Rolling custom `<button>` elements styled with
  `theme.useToken()` tokens is the right call for this shell
  shape. Worth remembering for future AntD-based custom nav
  patterns.
- **`getByRole("button", { name: /…/ })` is unreliable inside
  AntD `<Layout.Sider>`.** Multiple structural elements get the
  button role. Deterministic test selectors via
  `data-key="…"` + `container.querySelector` are cheap to add at
  component-creation time and pay back in test stability. Worth
  promoting as a pattern for any future `@mdd/ui` primitive that
  composes AntD layout components.
- **`replace_all` is dangerous on PDCA documents.** Flipping all
  remaining unchecked task-list bullets to checked swept the
  Promotions entries too, which per the template should be
  plain-text decisions when no promotion happens. Targeted Edit
  per section is safer; reserve `replace_all` for true global
  renames.
- **The `App.tsx`/`App.test.tsx` from R03 was scaffolding, not
  product.** Deleting it cleanly (rather than mutilating it into
  a router host) kept the file tree honest. The replacement
  `routing.test.tsx` tests the actual contract (routes resolve,
  active state, redirect) instead of a placeholder heading.

**Promotions** _(decision: none this round)_:

- → `context/` : not yet — the build-first lesson
  ([memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md))
  has now had one consumer (the shell). Per the original
  promotion criterion "once R03 validates the boundary,"
  technically eligible. Holding for one more round: the second
  feature added to the shell (R08+) will be the real test of
  whether the boundary stays clean under feature pressure. If it
  does, promote then with stronger evidence.
- → `skills/` : none this round.

**Follow-ups (not promotions, just notes):**

- **`.preview.html` lifecycle decision deferred to R08.** Per the
  design README, the preview lives through R07 and the immediate
  next round. R08's Plan should explicitly decide whether to
  retain or remove `workspace-shell.preview.html` — coupled with
  whether R08 introduces a second `.preview.html` (which would
  trigger CSS extraction + cross-linked previews per the
  README's "When to add structure" section).
- **AppLayout's `NAV_ITEMS` is the next-round seam.** When R08
  adds its feature, only `apps/builder/src/components/AppLayout.tsx`
  gains a nav-item entry and `main.tsx` gains a route. The shell
  primitive does not change. Test against this assumption next
  round — if either file needs structural edits to accommodate
  feature #2, the shell contract needs revisiting.
- **3 pre-existing Prettier warnings** in Complete rounds (R02,
  R04, `promotions.md`) remain. Governance blocks editing
  Complete rounds without explicit authorisation. A future
  cleanup round could re-run `prettier --write` with explicit
  human authorisation if those warnings start blocking CI; not
  urgent yet.
- **R08 next-feature pick.** Three candidates from R07's OUT
  list: (a) CSV upload for CRM exports, (b) dataset list pulled
  from DuckDB, (c) basic schema inspection. Each becomes its own
  design doc under `.agents/design/data-management/`. Backend
  endpoint shape will be pulled by the chosen feature, not
  designed in a vacuum.

## Feeds into → Round_08 (TBD)

What R07 hands forward:

- **`<WorkspaceShell>` primitive** in `@mdd/ui` — future rounds add
  features by registering nav items and routing to them; no
  shell-restructuring needed.
- **`.agents/design/` directory** with a working contract — future
  UI rounds author their design doc first (and optional
  brainstorming preview), then implement against it.
- **Builder routing** wired with `react-router-dom` — future
  features add routes under `apps/builder/src/features/<domain>/`
  without touching the shell.
- **Data Management page slot** — the placeholder is the host for
  Round 08+ features (CSV upload, dataset list, schema view —
  picked by next-round Q&A).
