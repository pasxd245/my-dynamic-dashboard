# Round 07: Land `@mdd/ui/Components/Button` (brand-defaults wrapper)

**Status**: Planning
**Date started**: 2026-05-19
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Introduce a thin `@mdd/ui/Components/Button` wrapper around `antd`'s `Button` that locks down the brand-default surface for the package. This is the first of the chain that finishes the `R06` row of the per-round delivery table (Button + Modal + FormField + NotFound) — per [[round-cadence]], split into four single-feature rounds. This round covers **Button only**; Round_08 = Modal, Round_09 = FormField (zod-aware), Round_10 = NotFound page.

## Product-velocity justification

Package round; product velocity is upstream. Without `@mdd/ui/Components/Button`, every consumer of the package keeps importing antd's `Button` directly and re-deriving the same brand defaults at each call-site. The plan locks the wrapper down once so future consumers (next builder migration, future apps) get a single named import that already matches the brand contract.

## Trajectory

### Immutable Intent

Ship a single named export `Button` from `@mdd/ui/Components` whose surface is **antd's `ButtonProps` minus the un-overridable brand defaults the wrapper supplies**. Anything beyond that — replacing internal call-sites in `apps/builder`, adding new variants beyond what antd already supports, supporting a non-antd fallback — is out of scope. This round establishes the export and its tests; consumer migration is a later round and not required for this round to ship.

### Current Architecture State

- `apps/builder/src/App.tsx:2` imports `Button` straight from `antd`. There is no app-local `Button` wrapper to promote — this round **introduces** the wrapper.
- `packages/ui/package.json` already declares `antd: ^6.3.7` as a `peerDependency` and `devDependency` — no new dependency added by this round (tier-2 trigger avoided).
- `packages/ui/src/themeTokens.ts` already supplies the `ConfigProvider` token bundle (via R01); the wrapper inherits brand styling from `MddUIProvider`'s `ConfigProvider`, not from inline props.
- No `Button` directory exists under `packages/ui/src/Components/`.

### Feedback Scope

- **Local (this round)**: net-new `Button/index.tsx` + tests + barrel re-export + README mention.
- **Global redesign (NOT this round)**: rewriting `apps/builder` Button call-sites to use `@mdd/ui/Components/Button`. The wrapper has to land first so consumer migration is reviewable in isolation; covering it here would bundle two features.

### Allowed Change Boundary

- In-scope: `packages/ui/src/Components/Button/**`, `packages/ui/src/Components/index.ts`, `packages/ui/README.md`.
- Read-only context: `packages/ui/src/Providers/MddUIProvider/**`, `packages/ui/src/themeTokens.ts`, antd's `ButtonProps` type signature.
- **Out of scope** (do NOT touch): `apps/builder/**`, any other consumer call-site.

## Invariants

- No new entry under `"dependencies"` in any `package.json` (critical-security diff-content rule). Antd is already a peer/dev dep — the wrapper imports it, doesn't add it.
- No CSS custom properties added or referenced — brand styling flows via the existing `ConfigProvider` token bundle, not via `var(--…)` literals.
- `pnpm --filter @mdd/ui type-check` stays green.
- `pnpm --filter @mdd/ui test` runs the existing R04 suite (PageCard + PageHeader + earlier tests) plus the new Button suite, all green.
- `pnpm --filter builder type-check` is unchanged — this round does not touch `apps/builder/**`.
- No change to `packages/ui/package.json` exports map (the `./Components` entry already covers it).

## Plan

### Phase 1 — Land `Button` in `@mdd/ui/Components`

**Files** (new):

- `packages/ui/src/Components/Button/index.tsx` — wrapper. Shape:

  ```tsx
  import { Button as AntButton, type ButtonProps as AntButtonProps } from 'antd';
  import type { ReactElement } from 'react';

  export type ButtonProps = AntButtonProps;

  /**
   * Brand-default Button. Inherits all token styling from MddUIProvider's
   * ConfigProvider; this wrapper exists so package consumers have a single
   * named import rather than reaching into `antd` directly.
   */
  export default function Button(props: ButtonProps): ReactElement {
    return <AntButton {...props} />;
  }

  export { Button };
  ```

  Rationale for the no-op body: the brand defaults already live in `themeTokens.ts` and apply through `ConfigProvider`. Re-applying them on every `<Button>` would (a) double the contract, (b) defeat consumers who legitimately need to override per-call (e.g. `type="primary"` vs ghost). The wrapper's value is the **named export surface**, not behavioral override.

**`Components/index.ts` append**:

```ts
export { default as Button, Button as ButtonNamed } from './Button/index.tsx';
export type { ButtonProps } from './Button/index.tsx';
```

(Both `default` and named exports surface, matching the precedent set by R01's `MasterLayout` barrel line.)

**Gate**:

- `pnpm --filter @mdd/ui type-check` green — confirms the re-export of `AntButtonProps` resolves and no upstream type drift broke the import.

### Phase 2 — Tests

**Files** (new):

- `packages/ui/src/Components/Button/__tests__/Button.test.tsx` — happy-dom; cases:
  1. **Default render**: `<MddUIProvider><Button>Click</Button></MddUIProvider>` produces a `<button>` element whose text content is `Click`. Asserts the wrapper does not interpose extra wrappers around antd's render.
  2. **Prop pass-through**: `<Button type="primary" disabled onClick={spy}>X</Button>` — assert the rendered button has the antd `ant-btn-primary` class, the `disabled` attribute, and `spy` is NOT called on initial render (sanity).
  3. **`ref` forwarding**: `useRef<HTMLButtonElement>()` passed via `ref` resolves to a non-null `HTMLButtonElement` after mount. **If antd's `Button` doesn't forward refs to the underlying `<button>`** (depends on antd 6.x — verify at code-time), drop this case and document it in `Act` as a follow-up.

  3 cases is the minimum coverage that proves "wrapper is a no-op around antd"; lower would fail to detect a regression where someone adds an override layer.

**Gate**:

- `pnpm --filter @mdd/ui test` runs and all suites pass.

### Phase 3 — Close-out

**Files**:

- `packages/ui/README.md` — under "Subpath imports", add `Button` to the `@mdd/ui/Components` line. Add one sentence: "Brand defaults flow through `MddUIProvider`'s `ConfigProvider`; the wrapper itself is a no-op around antd's `Button`, exposed so consumers don't reach into antd directly."
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` green.
- `pnpm --filter @mdd/ui type-check` + `test` green.
- `pnpm --filter builder type-check` unchanged (read-only context, but a smoke check that nothing in builder regressed via type resolution).
- Critical-security check passes: no path-glob hit, no new `"dependencies"`, no `child_process`/`eval`/`vm` import.

## Do

- _(filled by executor in iteration 2)_

## Check

- [ ] `pnpm --filter @mdd/ui type-check`.
- [ ] `pnpm --filter @mdd/ui test` — Button suite all green; existing R04 suites unchanged.
- [ ] `pnpm --filter builder type-check` — no new errors vs Round_06 baseline.
- [ ] `pnpm md:lint`.
- [ ] Critical-security: no path-glob hit; no new runtime dep; no new `child_process`/`eval`/`vm`.

## Act

- _(filled at close)_

## Questions for user before next round

1. **Is the no-op wrapper acceptable** as the package's `Button` surface? Alternative: have the wrapper inject brand-only props (e.g. force `size="middle"` by default, ban `loading` text overrides). The no-op is simpler and matches how PageCard/PageHeader (R04) handled their primitives — neither imposes runtime overrides. But Button is more widely consumed; the brand team may want a tighter contract.
2. **Should Round_08 (Modal) follow the same no-op shape**, or does Modal warrant brand-injected defaults (e.g. force `centered`, force a specific `okType`)? The answer to (1) will steer this.
3. **Defer ref-forwarding case (Phase 2 case 3) if antd 6 doesn't expose it?** Or block the round on adding ref-forwarding upstream? Recommendation: defer + document in `Act` if antd 6 doesn't natively pass refs; chasing antd would inflate the round.
4. **After this chain (R07–R10) closes, is the next round Builder Button/Modal consumer-migration**, or is the package considered "feature-complete enough" and the focus shifts back to `apps/builder` product work?
