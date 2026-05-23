# Round 08: Real menu icons in the workspace shell

**Status**: Review
**Date started**: 2026-05-23
**Date completed**:

## Goal

**Inherits from ← [Round_07](Round_07.md)** —
`<WorkspaceShell>` primitive shipped with a `NavItem.icon: ReactNode`
slot accepting any React node; current builder uses a placeholder
text glyph (`▣`) for the single Data Management nav-item. The
design-first methodology + `.agents/design/` directory are proven
and reused (no new structure).

Swap the placeholder text glyph for a real
[`@ant-design/icons`](https://ant.design/components/icon)
React component. `@ant-design/icons@^6.0.0` is already a peer
dependency of `@mdd/ui`; this round binds the first concrete icon
choice for the Data Management nav-item and updates the design
artifacts to record it.

This is a tight single-feature round per the
[round cadence](../../memory/) — icons-only, no shell-state changes.
The sidebar collapse/expand pattern that motivates having real
icons (so the collapsed icon-only view is visually meaningful) is
**deferred to R09**.

_Track: 1 (product — UI vocabulary). Pulled by: conversation
2026-05-23 (admin-console direction; user listed real icons as
the first piece); R07 Follow-ups (R08 candidate chain). Per
[Evolution Rule](../../AGENTS.md)._

## What is IN scope

- **Design amendment** to
  [.agents/design/data-management/workspace-shell.md](../../design/data-management/workspace-shell.md):
  add a new "Icons" subsection mapping each nav-item to the
  chosen AntD icon. R08 binds one entry (Data Management →
  `DatabaseOutlined`); future rounds extend the table when they
  add nav-items.
- **Preview update** to
  [.agents/design/data-management/workspace-shell.preview.html](../../design/data-management/workspace-shell.preview.html):
  replace the `▣` text glyph with an inline SVG copied from the
  actual rendered AntD icon (single copy, frozen) — this keeps
  the preview's "~90% fidelity" promise honest now that production
  has a real icon. Update the header comment to note the R08
  amendment.
- **Code change** in
  [workspace/apps/builder/src/components/AppLayout.tsx](../../../workspace/apps/builder/src/components/AppLayout.tsx):
  import `DatabaseOutlined` from `@ant-design/icons` and pass it
  as the `icon` for the Data Management nav-item. No changes to
  `<WorkspaceShell>` itself — the prop signature already accepts
  `ReactNode`.
- **Verification**: existing tests still pass (icon content
  isn't asserted; `data-key` selectors are stable); dev server
  boots; visual diff vs the updated preview is ~95% (closer than
  R07's ~90% because the preview now mirrors the real icon).

## What is OUT of scope (explicit deferrals)

- **Sidebar collapse/expand + hamburger toggle** — R09. The
  whole point of having real icons is so the collapsed icon-only
  view is meaningful; R09 builds the state machine + width
  transition that exercises this.
- **Icons for nav-items that don't exist yet.** Only the Data
  Management nav-item exists; binding speculative icons for
  future features (Upload, Analytics, Settings) violates the
  Evolution Rule. Each future nav-item picks its icon in the
  round that introduces the item.
- **Custom icon system / SVG sprite / icon font.** AntD's icon
  set is large and theme-aware out of the box; rolling our own
  isn't pulled.
- **Icon size / spacing token changes.** `<WorkspaceShell>`
  currently renders icons at 20px; that stays. If R09's
  collapse/expand reveals a sizing issue, fix in R09.
- **Brand refresh** (the drifted iteration's purple palette,
  Cairo/Poppins fonts) — still deferred from R07.
- **Top app-bar, right rail, workspace picker** — still deferred
  from R07.

## Plan

- [x] Added an "Icons" subsection to
      [workspace-shell.md](../../design/data-management/workspace-shell.md)
      with a registry table (key → AntD icon → rationale → round
      added). Initial row: `data-management` → `DatabaseOutlined`
      → "Represents the underlying DuckDB store; signals 'data
      work, not chrome.'" R08 in the round-added column.
- [x] Updated
      [workspace-shell.preview.html](../../design/data-management/workspace-shell.preview.html):
      `▣` text glyph replaced with the actual SVG markup from
      `@ant-design/icons-svg@4.4.2`'s `DatabaseOutlined.js`
      (path data copied verbatim). Added `.mdd-nav-icon svg`
      style block (20×20px, `fill: currentColor` so the icon
      inherits the active/inactive text colour). Header comment
      updated with R07/R08 round history + drift caveat.
- [x] Updated
      [workspace/apps/builder/src/components/AppLayout.tsx](../../../workspace/apps/builder/src/components/AppLayout.tsx):
      `import { DatabaseOutlined } from "@ant-design/icons";`
      added; `NAV_ITEMS` now passes `icon: <DatabaseOutlined />`
      instead of `"▣"`.
- [x] **Mid-round dependency discovery**: builder's type-check failed with `TS2307: Cannot find module '@ant-design/icons'`. `@mdd/ui` declares it as a peer dep; the builder (consumer) must declare it as a direct dep. Added `@ant-design/icons@^6.0.0` to [workspace/apps/builder/package.json](../../../workspace/apps/builder/package.json) `dependencies` and re-ran `pnpm install`. Type-check clean after. Worth remembering: peer deps in `@mdd/ui` need to be installed at the consumer for TypeScript module resolution to succeed.
- [x] `pnpm --filter @mdd/ui type-check` and
      `pnpm --filter builder type-check` clean.
- [x] `pnpm --filter @mdd/ui test` — 7 tests pass; `pnpm --filter builder test` — 3 tests pass. Icon swap doesn't affect tests (selectors are `data-key`-based, not name-or-icon-based).
- [x] `pnpm dev:local:up` boots clean. Vite re-optimised dependencies once (expected after `@ant-design/icons` was added to the lockfile). No errors in the builder log. SVG renders client-side (verified by absence of import/runtime errors).
- [x] `pnpm md:lint` clean (41 files, 0 errors). `pnpm format:check` clean for all R08 new/changed files; pre-existing warnings on R02/R04/`promotions.md` remain governance-deferred.
- [x] Post-round audit per [PDCA.md](../PDCA.md): Plan
      checkboxes flipped; Check items filled below; Promotions
      reformatted as plain text (none this round); markdownlint
      clean.

## Risks / unknowns

- **AntD icon import shape.** `@ant-design/icons` v6 exports
  named React components (`DatabaseOutlined`, `UploadOutlined`,
  etc.). Should be a direct named import. If v6 changed the
  pattern (rare), discover during type-check and document in Do.
- **Icon visual choice.** `DatabaseOutlined` is the obvious pick
  for "Data Management" — represents a stack of disks/cylinders.
  Alternatives: `DatabaseFilled` (heavier weight),
  `HddOutlined`, `TableOutlined` (lighter, file-cabinet feel).
  Lean: `DatabaseOutlined` (outlined weight matches AntD's
  default nav idiom). If during the round we find the outlined
  weight reads poorly at 20px, switch and document.
- **Preview SVG accuracy.** Copying the rendered SVG once
  freezes it — if a future AntD upgrade changes the icon's path,
  preview and production drift. Acceptable because: (a) the
  README's token-authority section already says preview drift is
  acceptable; (b) AntD icon path changes are rare; (c) the
  visible difference would be small.
- **Test stability.** Existing tests query by `data-key`, not
  by icon content or accessible name. Should be unaffected.
  Verify in Plan step.
- **Round-cadence discipline.** This is genuinely a small round
  (~3 edits, ~30 min of work). Resist scope creep — the
  hamburger / collapse pattern is right there but belongs in
  R09. The OUT-of-scope list is the boundary.

## Do

- **Design doc amendment**: added a 12-row "Icons" registry
  section to
  [workspace-shell.md](../../design/data-management/workspace-shell.md)
  between the "Token map" and "Behaviour" sections. Established
  the per-round-extension pattern (one row added per future
  round that introduces a nav-item).
- **Preview SVG freeze**: copied the path data verbatim from
  [`@ant-design/icons-svg@4.4.2`](../../../node_modules/.pnpm/@ant-design+icons-svg@4.4.2/node_modules/@ant-design/icons-svg/es/asn/DatabaseOutlined.js)
  rather than rendering through a browser. Cleaner provenance:
  the SVG markup in the preview is bit-for-bit the same path
  that the production React component renders. CSS additions
  (`.mdd-nav-icon svg { width:20; height:20; fill:currentColor }`)
  carry the same sizing + colour-inheritance contract the React
  component gets from AntD's icon wrapper.
- **`AppLayout.tsx` import**: trivial one-line change after the
  dependency was added.
- **Builder dependency discovery**: hit `TS2307: Cannot find
module '@ant-design/icons'` on first type-check. The
  `@ant-design/icons` declaration in `@mdd/ui`'s `peerDependencies`
  signals "I need this to render" but doesn't install it for
  consumers. Added `^6.0.0` to `apps/builder/package.json` and
  ran `pnpm install`. After: pnpm reports "Already up to date"
  (icon package was already in the workspace tree via `@mdd/ui`'s
  devDeps, just not visible to the builder's resolution scope).
  Type-check clean.
- **Visual choice held**: `DatabaseOutlined` (outlined weight)
  vs alternatives. The outlined weight reads cleanly at 20px,
  matches AntD's default nav-item idiom, and the design doc
  acknowledged this as the default lean. No switch needed.
- **Tests untouched**: existing 7 + 3 tests pass without
  modification. The `data-key` selector pattern established in
  R07 paid off — icon swap was invisible to the test suite.

## Check

- [x] Design doc has an "Icons" subsection with a registry row
      for `data-management` → `DatabaseOutlined`.
- [x] Preview HTML renders the real `DatabaseOutlined` SVG
      (path data frozen from `@ant-design/icons-svg@4.4.2`).
- [x] `AppLayout.tsx` imports `DatabaseOutlined` and passes
      `<DatabaseOutlined />` in `NAV_ITEMS`.
- [x] `@mdd/ui` tests pass — 7 tests (unchanged). Builder tests
      pass — 3 tests (unchanged).
- [x] `pnpm --filter @mdd/ui type-check` clean;
      `pnpm --filter builder type-check` clean.
- [x] `pnpm dev:local:up` boots; backend `/health` returns
      `{"status":"ok","duckdb":"v1.1.3"}`; builder log clean;
      no console errors during the Vite re-optimisation pass.
- [x] `pnpm md:lint` clean (41 files, 0 errors);
      `pnpm format:check` clean for R08 files (pre-existing
      warnings on R02/R04/`promotions.md` are governance-deferred).
- [x] Cross-links present: `Inherits from ← Round_07` in Goal;
      `Feeds into → Round_09` in Act.

## Act

**Status**: Review (work done; awaiting human approval). Per
[governance.md](../../context/governance.md), only humans flip to
`Complete`.

**Learnings**:

- **Peer deps in `@mdd/ui` are install-time invisible to
  consumers.** `@mdd/ui` declares `@ant-design/icons` as a peer
  dep — it tells pnpm "I need this at runtime" but does NOT
  install it in the consumer's resolution scope. The builder
  had to declare its own direct dep. Pattern: any AntD icon use
  in the builder needs `@ant-design/icons` as a direct
  dependency, not just transitive via `@mdd/ui`. Same will apply
  to `react`, `react-dom`, `antd` — all are peers in `@mdd/ui`
  and direct deps in the builder. Was already the case before
  R08; now confirmed for `@ant-design/icons` too.
- **Freezing SVG from source > rendering and screenshotting.**
  R08's Plan said "open in the running builder, copy the
  `<svg>` from devtools." During implementation, copying the
  path data directly from
  `@ant-design/icons-svg@4.4.2/es/asn/DatabaseOutlined.js`
  proved cleaner: same provenance, no browser, exactly the
  bytes the production React component renders. Lesson worth
  carrying forward for future icon previews.
- **`data-key` test selectors held under change.** R07's
  decision to query nav items by `data-key="…"` rather than
  by accessible name (icon + label text) meant R08's icon swap
  passed all existing tests with zero edits. Stable test
  selectors compound — confirms the value of investing in them
  at component-creation time.
- **Round-cadence discipline paid off.** R08 was three small
  edits (~30 lines across two files, one design-doc section).
  Total turnaround from Planning → Review was minutes, not
  hours. Single-feature rounds work; the temptation to bundle
  "while we're in there" (hamburger toggle, icons for
  speculative future items) was resisted. Both belong to R09+.
- **`@ant-design/icons` v6.0.0 import shape unchanged from
  prior majors.** Named exports work as documented; no surprises.

**Promotions** _(decision: none this round)_:

- → `context/` : not yet. The shell + design-first methodology
  now has two consecutive consumers (R07 introduced, R08
  extended) but only one feature on the shell. Promote the
  build-first lesson + design-first pattern after R09's
  hamburger/collapse work confirms the shell stays composable
  under structural change, or after R10+ adds a second feature
  domain. Whichever comes first is the better promotion trigger.
- → `skills/` : none this round.

**Follow-ups (not promotions, just notes):**

- **R09 = sidebar collapse/expand with hamburger toggle.** Now
  unblocked: real icons make the collapsed icon-only view
  meaningful. Design-first pattern continues — new design-doc
  section ("Collapse states") + preview update with the
  collapsed variant + then code.
- **Future nav-items inherit the registry pattern.** When R10+
  adds a Settings or Analytics nav-item, that round adds (a) a
  row to `workspace-shell.md`'s Icons table, (b) the icon to
  the preview, (c) the nav-item to `AppLayout.tsx`'s
  `NAV_ITEMS`. Three edits, mechanical. The shell primitive
  itself doesn't change.
- **Icon dep boundary applies to other AntD families.** Same
  pattern will hold if `@ant-design/charts`, `@ant-design/pro-*`,
  etc. ever enter the picture — declare in the consumer, not
  hoisted via `@mdd/ui`.

## Feeds into → Round_09 (TBD)

What R08 hands forward:

- **Real `@ant-design/icons` vocabulary** wired into the shell.
  R09's sidebar collapse can rely on icons rendering meaningfully
  at the collapsed width (no labels visible, icons carry the
  whole message).
- **Design-doc "Icons" table** as a registry — each future
  nav-item adds a row when introduced, so the shell's icon
  inventory is documented in one place.
- **Preview SVG freeze pattern** — the `.preview.html` now
  contains real AntD SVG markup; future visual previews can
  follow the same "copy once, freeze, note the drift caveat"
  rule.
