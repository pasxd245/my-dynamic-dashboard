# Round 08: Land `@mdd/ui/Components/Modal` (brand-defaults wrapper)

**Status**: Planning
**Date started**: 2026-05-19
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)
**Chain predecessor**: [Round_07.md](./Round_07.md) (Button — no-op wrapper precedent)

## Goal

Second link in the R07→R10 chain. Introduce `@mdd/ui/Components/Modal` as a thin no-op wrapper around `antd`'s `Modal`, matching the Round_07 Button pattern. Brand defaults flow through `MddUIProvider`'s `ConfigProvider`; the wrapper's value is the named-export surface so consumers stop reaching into `antd` directly. This round covers **Modal only**; Round_09 = FormField (zod-aware), Round_10 = NotFound page.

## Product-velocity justification

Package round. Three apps/builder dialogs (`SaveQueryDialog`, `UpdateQueryDialog`, `WorkspacePicker`) import `Modal` straight from `antd`. Without `@mdd/ui/Components/Modal`, each new dialog keeps cementing the antd-direct pattern. The wrapper landing makes the eventual consumer migration (separate round) a barrel-redirect-only change. R07 set the precedent; R08 extends it.

## Trajectory

### Immutable Intent

Ship a single named export `Modal` from `@mdd/ui/Components` whose surface is antd's `ModalProps` re-exported as `ModalProps`. **Sub-components** (`Modal.confirm`, `Modal.useModal`, `Modal.info`, `Modal.success`, `Modal.warning`, `Modal.error`) are out of scope unless the wrapper trivially forwards them — covered as a stretch task only if the type system surfaces them via a single re-export line. Anything else — replacing internal call-sites in `apps/builder`, supporting non-antd fallbacks, or adding new variants on top of antd — is out of scope.

### Current Architecture State

- `apps/builder` has 3 `Modal` call-sites (all importing from `antd`):
  - [SaveQueryDialog.tsx](../../../apps/builder/src/components/SavedQuery/SaveQueryDialog.tsx)
  - [UpdateQueryDialog.tsx](../../../apps/builder/src/components/SavedQuery/UpdateQueryDialog.tsx)
  - [WorkspacePicker.tsx](../../../apps/builder/src/components/workspace/WorkspacePicker.tsx)
- These call-sites are **read-only context** for this round — consumer migration is a future round.
- `packages/ui/package.json` already declares `antd: ^6.3.7` as `peerDependency` + `devDependency`. No new dependency added.
- No `Modal` directory exists under `packages/ui/src/Components/`.

### Feedback Scope

- **Local (this round)**: net-new `Modal/index.tsx` (function-component wrapper + namespace re-export for the imperative API if it's trivially type-safe) + tests + barrel re-export + README mention.
- **Global redesign (NOT this round)**: rewriting the 3 builder dialog call-sites to use `@mdd/ui/Components/Modal`. Bundling it would mix two features.

### Allowed Change Boundary

- In-scope: `packages/ui/src/Components/Modal/**`, `packages/ui/src/Components/index.ts`, `packages/ui/README.md`.
- Read-only context: `packages/ui/src/Providers/MddUIProvider/**`, antd's `ModalProps` type signature, the 3 builder Modal call-sites listed above (signature shape only).
- **Out of scope** (do NOT touch): `apps/builder/**`, any other consumer call-site.

## Invariants

- No new entry under `"dependencies"` in any `package.json` (critical-security diff-content rule).
- `pnpm --filter @mdd/ui type-check` stays green.
- `pnpm --filter @mdd/ui test` runs the existing suite (15 tests after Round_07) plus the new Modal suite, all green.
- `pnpm --filter builder type-check` is unchanged — this round does not touch `apps/builder/**`.
- No CSS custom properties added or referenced — brand styling flows via `ConfigProvider`.
- No change to `packages/ui/package.json` exports map.

## Plan

### Phase 1 — Land `Modal` in `@mdd/ui/Components`

**Files** (new):

- `packages/ui/src/Components/Modal/index.tsx` — wrapper. Shape:

  ```tsx
  import { Modal as AntModal, type ModalProps as AntModalProps } from 'antd';
  import type { ReactElement } from 'react';

  export type ModalProps = AntModalProps;

  /**
   * Brand-default Modal. Inherits all token styling from MddUIProvider's
   * ConfigProvider; this wrapper exists so package consumers have a single
   * named import rather than reaching into `antd` directly.
   *
   * NOTE: antd's Modal exposes static methods (`Modal.confirm`,
   * `Modal.info`, …) and a `useModal` hook. Those are NOT re-exported by
   * this wrapper — use them via `antd` directly until a consumer needs
   * them through this package. Adding them is a separate round.
   */
  export default function Modal(props: ModalProps): ReactElement {
    return <AntModal {...props} />;
  }

  export { Modal };
  ```

  Rationale for the no-op body + omitted statics: same as Round_07 Button — brand defaults already live in `themeTokens.ts` and apply through `ConfigProvider`. Statics omitted to keep the wrapper a simple function component; promoting them later (if needed) is a focused follow-up. **Decision rule**: deviate from R07's no-op shape only if the user feedback on Round_07 redirects.

**`Components/index.ts` append**:

```ts
export { default as Modal } from './Modal/index.tsx';
export type { ModalProps } from './Modal/index.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green — confirms `AntModalProps` re-export resolves.

### Phase 2 — Tests

**Files** (new):

- `packages/ui/src/Components/Modal/__tests__/Modal.test.tsx` — happy-dom; cases:
  1. **Closed render** (`open={false}`): no modal content visible in the DOM. Confirms `open` prop pass-through.
  2. **Open render** (`open={true}`): modal content (`<div>body</div>`) is in the DOM; the close button (`.ant-modal-close`) is present. Title prop passes through (asserted via text match).
  3. **Cancel handler**: `open={true} onCancel={spy}` — locate the close button and `fireEvent.click`; assert `spy` is called. Proves event-handler pass-through.

  These three cases prove the wrapper interposes nothing between consumer and antd's Modal. Lower coverage would fail to detect a regression where someone adds an override layer.

  **happy-dom caveat**: antd's `Modal` portals its content via `react-dom`. happy-dom's portal handling is good enough for `container.querySelector` to find content after a render flush (Round_04's PageHeader test relied on similar assumptions). If a case turns out to flake, drop it and replace with a smoke test that only verifies the export resolves — same fallback pattern as Round_07's ref case.

**Gate**:

- `pnpm --filter @mdd/ui test` runs and all suites pass.

### Phase 3 — Close-out

**Files**:

- `packages/ui/README.md` — extend the Subpath imports block to include `Modal`. Add one sentence: same no-op-wrapper note already established for Button — call out the omitted statics (`Modal.confirm`, `useModal`) as a future-round candidate.
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` green.
- `pnpm --filter @mdd/ui type-check` + `test` green.
- `pnpm --filter builder type-check` unchanged vs Round_07 baseline (smoke).
- Critical-security check passes: no path-glob hit, no new `"dependencies"`, no `child_process`/`eval`/`vm` imports.

## Do

- _(filled by executor in iteration 4)_

## Check

- [ ] `pnpm --filter @mdd/ui type-check`.
- [ ] `pnpm --filter @mdd/ui test` — Modal suite green; existing R04+R07 suites unchanged.
- [ ] `pnpm --filter builder type-check` — unchanged vs Round_07 baseline.
- [ ] `pnpm md:lint`.
- [ ] Critical-security: no path-glob hit; no new runtime dep; no new `child_process`/`eval`/`vm`.

## Act

- _(filled at close)_

## Questions for user before next round

1. **Modal statics (`Modal.confirm`, `Modal.info`, `useModal`) deliberately omitted**. Confirm or override: keep them out of `@mdd/ui/Components/Modal` (current plan) or surface them at this round's cost? The 3 existing builder dialog call-sites all use the function-component `<Modal>` form, not the statics — so the current plan covers actual usage.
2. **Round_09 = FormField (zod-aware)** introduces `zod` as a `peerDependency: ^3` in `packages/ui/package.json`. `peerDependencies` adds are tier-1 per the critical-security diff-content rule (only `dependencies` runtime adds trigger tier-2), but pnpm-lock.yaml will see workspace-wide ripples. Pre-confirm or block?
3. **happy-dom portal handling** for the Modal tests — if it flakes, drop to smoke-test-only per Round_07's ref-case precedent? Recommendation: yes, deferring is consistent with [[round-cadence]] (one feature per round; don't absorb test-infra investigations).
