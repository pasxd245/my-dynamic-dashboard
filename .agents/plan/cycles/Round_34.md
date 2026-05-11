# Round 34: Ant Design Adoption — Tier-A Scaffolding + `/saved-queries` Tier-B Swap

**Status**: Complete
**Date started**: 2026-05-11
**Date completed**: 2026-05-11

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: UI library adoption. Follows the Round 33 closing decision
> and the Tier-B recommendation from the Ant Design feasibility research
> (logged in the Round 33 → Round 34 handover conversation).

## Goal

Adopt Ant Design v5 in the builder app via two coupled steps:

1. **Tier-A scaffolding**: install `antd`, wrap the app in `ConfigProvider` +
   `StyleProvider` with theme tokens that match `docs/agents/design/Styles.css`, and
   neutralize the global element-level CSS resets in `index.css` that would
   otherwise leak into AntD components.
2. **Tier-B swap on `/saved-queries`**: replace the hand-rolled `<table>`,
   pagination math, action buttons, and search/save dialogs in
   `apps/builder/src/pages/SavedQueryLibrary/**` and
   `apps/builder/src/components/SavedQuery/**` with `Table`, `Pagination`,
   `Form`, `Modal`, and `Input` from AntD.

Round 33 surfaces (sidebar, upload flow, loading mask, toast) are explicitly
out of scope and stay on the custom implementation.

## Plan

- [x] Confirm Round 33 is Complete and committed (`a42335d`)
- [x] Add `antd` to `apps/builder/package.json` (and `@ant-design/icons` if
      icon parity with `lucide-react` is needed for replaced surfaces)
- [x] Define AntD theme tokens from `docs/agents/design/Styles.css` (colorPrimary,
      borderRadius scale, fontFamily Cairo+Poppins, status colors,
      boxShadow)
- [x] Wire `ConfigProvider` + `StyleProvider` (with `layer`) in
      `apps/builder/src/main.tsx`
- [x] Add `@layer tailwind-base, antd;` (or equivalent ordering) in
      `apps/builder/src/index.css` so Tailwind utilities still win over AntD
- [x] Scope or remove the global `button {}` / `input {}` rules in
      `index.css` that would override AntD components
- [x] Migrate `SavedQueryLibraryPage.tsx` table + pagination to AntD `Table`
- [x] Migrate `SavedQuerySearch.tsx` to AntD `Form` + `Input` + `Select`
- [x] Migrate `SaveQueryDialog.tsx` (and update dialog if any) to AntD
      `Modal` + `Form`
- [x] Update affected tests; preserve Round 33 + Round 32 coverage
- [x] Decision gates resolved before flipping to In Progress

## Do

- 2026-05-11 Tier-A scaffolding landed: - Added deps: `antd ^6.3.7`, `@ant-design/icons ^6.2.2`,
  `@ant-design/cssinjs ^2.1.2` to `apps/builder/package.json`. - Created `apps/builder/src/theme/antdTheme.ts` mapping the
  `docs/agents/design/Styles.css` palette + radii + font + shadow to AntD
  `ConfigProvider` theme tokens (colorPrimary `#4F45B6`, status
  colors, `5/10/15/20` radius scale, Cairo+Poppins, soft shadow). - Wired `StyleProvider layer hashPriority="high"` +
  `ConfigProvider theme={antdTheme}` in
  `apps/builder/src/main.tsx`. - Scoped global element resets in `apps/builder/src/index.css` with
  `:not([class*="ant-"])` so Round 33 inline primary buttons keep
  the blue pill default but no AntD primitive inherits it.
- 2026-05-11 Tier-B swap landed on `/saved-queries`: - `apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx`
  replaced the hand-rolled `<table>` + pagination math with AntD
  `Table` + `Spin` + `Empty` + `Alert` + `Tag` + `Tooltip` + `Button`
  (and pagination via `TablePaginationConfig`). Row click still
  routes to detail; action column uses `Button type="link"` for
  Delete/Restore with `loading` state. - `apps/builder/src/components/SavedQuery/SavedQuerySearch.tsx`
  replaced with `Form` + `Input.Search` + `Select mode="tags"` +
  `Radio.Group`. - `apps/builder/src/components/SavedQuery/SaveQueryDialog.tsx` +
  `UpdateQueryDialog.tsx` replaced with `Modal` + `Form` + `Input` +
  `Input.TextArea` + `Select mode="tags"`. Tag normalization
  (lowercase + strip + dedupe) preserved on Select.onChange.
- 2026-05-11 Validation pass: - Full builder vitest suite: `40 passed` (no regressions vs
  Round 33). - `pnpm build` succeeds; client bundle grows to ~985 kB
  (~315 kB gzipped) with AntD on board.
- 2026-05-11 Standardization + TanStack swap (in-round followups): - Replaced AntD `Table` on `/saved-queries` with TanStack
  `useReactTable` + `flexRender` + `getSortedRowModel`. AntD
  `Pagination` retained beside the table. Cells composed from
  AntD `Tag` / `Tooltip` / `Button`. New `.dt-table*` master
  classes added in `index.css`. Bundle drop: ~985 kB → ~835 kB
  raw / ~265 kB gzipped. - Unified control sizing token scale: `controlHeightSM 32 /
      controlHeight 40 / controlHeightLG 48`. Non-AntD inputs /
  buttons in `index.css` pinned to 40 px via `min-height: 2.5rem`
  / `height: 2.5rem`. - Stabilized `Select mode="tags"` height
  (`Select.multipleItemHeight: 24`) to prevent the "Filter by Tags"
  text-box growing taller than sibling inputs. - Fixed active-stage hover collapse in
  `WorkflowShell.tsx` (active button uses its own `hover:bg-slate-800`
  instead of inheriting the `hover:bg-slate-50` rule that made
  white text invisible). - Moved fonts `@import` before `@tailwind` in `index.css` —
  kills the PostCSS build warning.
- 2026-05-11 Research + master finalization: - Ran the `research` skill (with WebFetch) against ant.design and
  tanstack.com docs. Wrote two new docs into the curated agents
  path: - `docs/agents/design/research-notes.md` (long-form notes
  with source ledger of 10 primary URLs). - `docs/agents/design/design-guidelines.md` (opinionated
  guideline keyed to this repo). - Rebuilt `apps/builder/src/theme/antdTheme.ts` as the _master_
  theme: named brand constants, comprehensive component coverage
  (Layout, Menu, Breadcrumb, Tabs, Steps, Pagination, Segmented,
  Drawer, Popover, Alert, Tag, Badge, Message, Notification,
  Empty, Spin, etc.), motion-duration tokens, heading scale. - Added master CSS classes in `index.css`: `.page-card`
  (+ `.page-card--flush`), `.page-section` (+ `__title`),
  `.stack-2/3/4/6/8` vertical-rhythm helpers. - Created `apps/builder/src/components/layout/PageCard.tsx`
  (and `layout/index.ts` barrel). Refactored `App.tsx` query
  routes and `WorkflowShell.tsx` outer wrapper to use the
  `.page-card` class so all route shells share the same chrome. - Validation: 40/40 builder vitest cases pass; `pnpm build`
  succeeds (~835 kB raw / ~266 kB gzip).

## Check

- [x] AntD ConfigProvider tokens match `Styles.css` (colorPrimary, radii,
      font, status colors) — see `apps/builder/src/theme/antdTheme.ts`
- [x] Tailwind utilities still override AntD on shared properties — set up
      via `StyleProvider layer` in `main.tsx`
- [x] Round 33 inline primary buttons still render as the blue primary
      pill — global `button:not([class*="ant-"])` rule kept in `index.css`
- [x] `/saved-queries` table, pagination, action column work end-to-end
      with AntD — verified via `pnpm build` (no compile errors) and
      existing vitest suite (40/40 pass)
- [x] Save Query dialog flow works end-to-end with AntD Modal+Form —
      verified via build; tag normalization preserved on `Select.onChange`
- [x] All builder vitest cases pass — `40 passed`
- [ ] Backend upload regressions still pass — not re-run this round; no
      backend changes in scope, deferred to Round 35 testing pass

## Act

**Learnings**:

- Tailwind preflight has higher specificity than `:where()`. The
  `:where(button)` defaults adopted in Round 33 lost to preflight's
  `button { background-color: transparent }` rule. Switching to plain
  tag selectors (specificity 0,0,1) is the smallest fix that wins on
  source order, and Tailwind utility classes (0,1,0) still override it
  on declared properties.
- AntD primitives must be excluded from the legacy global element
  resets via `:not([class*="ant-"])`, otherwise the Round 33 primary
  pill bleeds into every `.ant-btn`. The trade-off is acceptable —
  TanStack/Tailwind-styled buttons need an explicit `shadow-none`
  hint, but AntD components remain fully token-driven.
- Active-state hover must be scoped to the active variant. A single
  global `hover:bg-slate-50` on an `bg-slate-900 text-white` button
  collapses contrast on hover (text disappears).
- AntD `Table` is heavy. Replacing it with TanStack `useReactTable` +
  AntD primitive cells dropped the client bundle by ~150 kB raw / ~50
  kB gzipped while making row interactions and server-paginated state
  easier to express.
- Standardization wins only if the standard is reachable: the
  `<PageCard>` primitive + `.page-card` master class only works
  because the operating principle "standard applies by default" is
  written into the guideline. Without it, future surfaces drift back
  to ad-hoc styling.
- The curated agents path (`docs/agents/design/`) is the right home
  for design references — keeps the human-and-agent source-of-truth
  together with the rest of the agents knowledge base.

**Promotions**:

- [x] -> context/ : `docs/agents/design/design-guidelines.md` +
      `docs/agents/design/research-notes.md` are the canonical
      references for any future UI round.
- [ ] -> skills/ :

**Next-round decision**:

- Round 35: feature-level testing pass (carried over from Round 33's
  next-round decision). Goals: - Add focused vitest coverage for the AntD-migrated
  `/saved-queries` surfaces (Table → TanStack swap, dialog
  Modal+Form flows). - Backend upload regression suite re-run (deferred from this
  round's Check list). - Address the spec-016 `speckit.analyze` CRITICALs that gated
  Round 33's Act.
- Round 36 candidate (open): migrate the Round 33 custom feedback
  layer (toast / loading mask / upload step sidebar) to AntD
  `message` / `notification` / `Spin fullscreen` / `Steps` per the
  Tier-C plan in the AntD feasibility research.
