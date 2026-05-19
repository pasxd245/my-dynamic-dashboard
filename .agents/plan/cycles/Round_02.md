# Round 02: Collapse `apps/builder/src/theme/antdTheme.ts` to re-export `@mdd/ui/themeTokens`

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Make `@mdd/ui/themeTokens` the **single source of truth** for the AntD theme by replacing the body of [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts) with a re-export from the package. After this round, the file is two lines (a re-export and an alias) and there is exactly one ThemeConfig literal in the repo.

## Trajectory

- **Immutable intent**: collapse the duplicate. Anything else — `PageCard` / `PageHeader` promotion, `AppShell` → `MasterLayout` swap — is **out of scope**, deferred to subsequent rounds.
- **Why split now**: `packages-ui.plan.md`'s R02 row groups three migrations into one. Per memory `feedback_round_cadence`, this round-writer splits them into a chain:
  - **R02 (this)** — theme collapse. Touches `apps/builder/src/theme/antdTheme.ts` + `apps/builder/src/main.tsx` (alias). Smallest, lowest-risk change; unlocks the "single source of truth" invariant.
  - **R03** — promote `PageCard` + `PageHeader` to `packages/ui/src/Components/`; delete in-app dupes.
  - **R04** — swap `AppShell` → `MasterLayout`. **Blocked** on a `@mdd/ui/MasterLayout` API extension: AppShell uses a `navGroups: AppShellNavGroup[]` shape (2-level group → items) and `header?: ReactNode` + `brand?: ReactNode` slots, neither of which the R01 MasterLayout exposes. R04's first phase must extend MasterLayout (additive — optional props, no R01 API break), or R04 must precede with an R03.5 round dedicated to the extension.
- **Architecture state**: theme is consumed in exactly one place — [apps/builder/src/main.tsx](../../../apps/builder/src/main.tsx) line 9 (`import { antdTheme } from "./theme/antdTheme"`) feeds line 16 (`<ConfigProvider theme={antdTheme}>`). No other importer.
- **Allowed change boundary**: `apps/builder/src/theme/antdTheme.ts` + read-only-for-context: [apps/builder/src/main.tsx](../../../apps/builder/src/main.tsx), [packages/ui/src/themeTokens.ts](../../../packages/ui/src/themeTokens.ts). Plus `apps/builder/package.json` (to add `"@mdd/ui": "workspace:*"`). Plus root `pnpm-lock.yaml` (necessary artifact of `pnpm install`, per Round_01 observation `boundaryVsLockfileContradiction`).

## Invariants

- `apps/builder` keeps building, type-checking, testing, and rendering every route unchanged — pixel-identical because both the old and new ThemeConfig literals are byte-identical (verified in Round_01: `themeTokens.ts` is a verbatim copy of the R01-era `antdTheme.ts`).
- `<ConfigProvider theme={antdTheme}>` in [apps/builder/src/main.tsx](../../../apps/builder/src/main.tsx) keeps working unchanged — the export name `antdTheme` is preserved as an alias of `themeTokens`.
- No new `@mdd/ui/*` imports elsewhere in `apps/builder/**` (those are R03/R04).
- Zero new hex literals anywhere; zero `@tanstack/react-router` introductions.
- `packages/ui/**` is untouched. (If a future R01-era bug in `themeTokens.ts` surfaces during this round, fix it in a separate round, not here.)

## Plan

### Phase 1 — Add `@mdd/ui` to builder deps

**Files**:

- `apps/builder/package.json` — add `"@mdd/ui": "workspace:*"` under `dependencies`.

Then `pnpm install` at the repo root.

**Gate**:

- `pnpm install` succeeds and `pnpm -r ls --filter apps/builder` lists `@mdd/ui` under deps.
- `apps/builder/package.json` and `pnpm-lock.yaml` are the only edits in the diff so far.

### Phase 2 — Collapse `antdTheme.ts` to a re-export

**File**:

- `apps/builder/src/theme/antdTheme.ts` — full replacement.

**New content** (5 lines):

```ts
// One source of truth for the AntD theme: @mdd/ui/themeTokens.
// `antdTheme` is preserved as an alias so apps/builder/src/main.tsx
// keeps working without an import-site change.
export { themeTokens as antdTheme } from '@mdd/ui/themeTokens';
export { themeTokens as default } from '@mdd/ui/themeTokens';
```

(Both the named `antdTheme` re-export AND a default re-export — the original file had a named export only, but supplying default is cheap insurance against future call sites switching to `import antdTheme from "./theme/antdTheme"`.)

**Gate**:

- `pnpm --filter apps/builder type-check` (or whatever builder's typecheck script is named — check `apps/builder/package.json` `scripts` before running) green.
- `grep -n 'ThemeConfig' apps/builder/src/theme/antdTheme.ts` returns no hits (the literal is gone — only re-exports remain).
- `grep -rn 'antdTheme' apps/builder/src/ | grep -v '/theme/antdTheme\.ts:'` shows the same call-sites as before (i.e. `main.tsx` still imports `antdTheme`).
- Run `apps/builder`'s test suite (vitest) — must stay green.

### Phase 3 — Verify pixel-identity + close-out

**Files**:

- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `git diff main...HEAD -- apps/builder/src/` shows changes confined to `apps/builder/src/theme/antdTheme.ts`.
- Hex-literal scan: `grep -oE '#[0-9a-fA-F]{3,8}' apps/builder/src/theme/antdTheme.ts` returns zero (the file no longer contains hex literals — they live in `@mdd/ui/themeTokens` now).
- A human run of `apps/builder` (dev server, browse `/`, `/saved-queries`, `/workflow/upload-source`, `/workflow/query`) shows no visual diff vs. main. This is a manual gate — note as such in `Check`.

## Do

- 2026-05-19 — Round_02 executed on the same `autoagent/20260519/Round_02` branch as the draft (per the post-Option-A priority-2 contract). Executor: direct-edit (5-line change, well below the "trivially small" carve-out threshold).
- Phase 1 — added `"@mdd/ui": "workspace:*"` under `apps/builder/package.json` dependencies (kept alphabetic order). `pnpm install` succeeded; `apps/builder/node_modules/@mdd/ui` is a symlink to `../../../../packages/ui` (verified).
- Phase 2 — replaced [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts) body with the 5-line re-export (`antdTheme` named alias + default re-export of `themeTokens` from `@mdd/ui/themeTokens`). [apps/builder/src/main.tsx](../../../apps/builder/src/main.tsx) keeps working unchanged.
- Phase 3 — boundary held (exactly 3 files modified: `apps/builder/package.json`, `apps/builder/src/theme/antdTheme.ts`, `pnpm-lock.yaml`). `pnpm --filter builder test`: **70/70 pass**. `pnpm --filter builder type-check`: fails on a **pre-existing** error in `src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx:98` (`'all' | 'active' | 'deleted'` not assignable to `'active' | 'deleted' | undefined`) — confirmed identical on dev pre-Round_02, so not a regression introduced by this round. Surfaced as a follow-up bugfix round candidate.

## Check

- [x] Phase 1 gate — `@mdd/ui` linked in builder's `node_modules` (symlink to `packages/ui`); `pnpm install` succeeded with only `pnpm-lock.yaml` + `apps/builder/package.json` modified.
- [x] Phase 2 gate — `ThemeConfig` literal no longer in `apps/builder/src/theme/antdTheme.ts` (grep clean); `apps/builder/src/main.tsx:9` `import { antdTheme } from "./theme/antdTheme"` still resolves; vitest 70/70 green. (Typecheck regression check: same single pre-existing error on dev — no new errors introduced.)
- [x] Phase 3 gate — boundary holds (3 files in diff); hex-literal count in `apps/builder/src/theme/antdTheme.ts` is **0** (was 16 before R02); manual visual smoke deferred to a human reviewer.

## Act

**Learnings**:

- The pre-Option-A draft → Meta_NN convention has been retired (autoagent.md commit `5e9ad01` on dev). Round_02 became the first round to use the new flow: draft phase landed on `autoagent/20260519/Round_02` (was `Meta_01`, renamed), execute phase landed on the same branch via `git switch` (no new branch). Worked as intended.
- The pre-existing TypeScript error in `apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx:98` deserves its own bugfix round. It's not blocking Round_02 but it means `pnpm --filter builder type-check` is currently red on dev — any future Phase gate that checks for green typecheck on builder will need to fix or filter this first.
- `apps/builder/src/theme/antdTheme.ts` is now 5 lines (down from 230). Round_01's invariant "themeTokens.ts is a verbatim copy of antdTheme.ts" is now upside-down — the builder file is the alias, the package file is canonical. master-plan invariant #2 ("One source of truth for brand tokens") is now satisfied.

**Promotions**:

- [ ] → context/ : (none — product migration, not agent infra)
- [ ] → skills/ : —
- [x] → meta-state (`openObservations`) : `builderTypecheckPreExistingRegression` — `apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx:98` typechecks red on dev pre-Round_02; surface as a bugfix round candidate.

## Round chain (for context, not part of this round's scope)

- **Round 03** — Promote `PageCard` + `PageHeader` to `packages/ui/src/Components/`. Delete `apps/builder/src/components/layout/PageCard.tsx` and `apps/builder/src/components/ui/PageHeader.tsx`; redirect their `components/{layout,ui}/index.ts` barrels to re-export from `@mdd/ui/Components`.
- **Round 04** — Extend `@mdd/ui/MasterLayout` API (optional props: `header?: ReactNode`, `brand?: ReactNode`, `navGroups?: NavigationGroup[]`) — additive only, no R01 break. Then swap `apps/builder/src/components/ui/AppShell.tsx` → `MasterLayout` and delete the local file. **Note**: master-plan should be updated to record this split before R04 begins.
