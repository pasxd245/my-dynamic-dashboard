# Round 09: Land `@mdd/ui/Components/FormField` (zod-aware)

**Status**: Planning
**Date started**: 2026-05-19
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md) (§ FormField + zod)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)
**Chain predecessors**: [Round_07.md](./Round_07.md) (Button), [Round_08.md](./Round_08.md) (Modal)

## Goal

Third link in the R07→R10 chain. Land `@mdd/ui/Components/FormField` — a thin labeled-input wrapper that **accepts `issues?: ReadonlyArray<ZodIssue>` and surfaces the issue whose `path` matches the field's `name`**. The wrapper stays form-state agnostic (no coupling to `@tanstack/react-form` or `react-hook-form`), so consumers can pair it with anything. This round covers **FormField only**; Round_10 = NotFound page.

## Product-velocity justification

Package round. The master plan locked the zod-aware FormField as a design decision (see plan § FormField + zod) because every builder form currently re-derives its own error-surfacing logic; centralizing it in `@mdd/ui` removes the duplication. The wrapper requires `zod` as a `peerDependency` — adding it now (not in a future round) is intentional because the wrapper's `ZodIssue` prop type makes zod a hard package dependency.

## Trajectory

### Immutable Intent

Ship a single named export `FormField` from `@mdd/ui/Components`. Surface:

```tsx
interface FormFieldProps {
  readonly name: string; // dot-path-joined zod issue lookup key
  readonly label: string;
  readonly children: ReactElement; // the input control (consumer-owned)
  readonly issues?: ReadonlyArray<ZodIssue>;
  readonly required?: boolean;
  readonly help?: ReactNode; // contextual hint shown when no error
}
```

Behavior: render a label + the consumer's child input + a single error message when `issues` contains an issue whose `path.join('.') === name`. No form-state library coupling — the consumer wires `useForm` or `useState` to the child.

Out of scope: replacing internal call-sites in `apps/builder` (no current call-sites exist), supporting `react-hook-form`'s `Controller` shape, exposing `ZodSchema` resolution at the wrapper level, surfacing **multiple** errors per field (just the first match — single-error UX matches every existing builder form).

### Current Architecture State

- `zod` is **not** in any `package.json` in the repo (grep'd `apps/*/package.json`, `packages/*/package.json`, root `package.json`).
- `apps/builder` uses `@tanstack/react-form` (per plan's FormField + zod section line ~5). No current zod usage; adopting will start with this wrapper.
- No `FormField` directory exists under `packages/ui/src/Components/`.

### Feedback Scope

- **Local (this round)**: net-new `FormField/index.tsx` + tests + barrel re-export + README mention + `packages/ui/package.json` peer/dev dep add for zod + root `pnpm-lock.yaml` update.
- **Global redesign (NOT this round)**: introducing zod-aware forms in `apps/builder`. The wrapper exists first; consumer adoption is a future round.

### Allowed Change Boundary

- In-scope: `packages/ui/src/Components/FormField/**`, `packages/ui/src/Components/index.ts`, `packages/ui/package.json`, `packages/ui/README.md`, root `pnpm-lock.yaml` (lockfile-only, no top-level dep adds).
- Read-only context: zod's `ZodIssue` type signature (`zod@^3` — the `path: (string | number)[]` shape), `packages/ui/src/Providers/MddUIProvider/**`.
- **Out of scope**: `apps/builder/**`, the root `package.json`, any other consumer call-site.

## Invariants

- **`zod` is added as `peerDependency: ^3` + `devDependency: ^3`** in `packages/ui/package.json`. Per autoagent.md's diff-content critical-security rule, only NEW runtime `"dependencies"` adds trigger tier-2 — `peerDependencies` and `devDependencies` are tier-1.
- **Root `pnpm-lock.yaml` will update** when `pnpm install` runs after the package.json edit. Per autoagent.md's "Known noise" carve-out (precedent R01 2026-05-19, workspace-add lockfile), root lockfile updates that follow from a legitimate package.json edit are tier-1. This round's edit is a peerDep+devDep add, which is the same category — the lockfile ripple is expected.
- No new entry under `"dependencies"` (runtime) in any `package.json`.
- `pnpm --filter @mdd/ui type-check` stays green.
- `pnpm --filter @mdd/ui test` runs the existing suite (18 tests after Round_08) plus the new FormField suite, all green.
- `pnpm --filter builder type-check` is unchanged.

## Plan

### Phase 1 — Add zod to `packages/ui`

**Files**:

- `packages/ui/package.json` — add to existing `peerDependencies` block:

  ```jsonc
  "zod": "^3.23.0"
  ```

  and to `devDependencies`:

  ```jsonc
  "zod": "^3.23.0"
  ```

  Choosing `^3.23.0` because that's a recent stable line in the zod-3 series; the API of `ZodIssue.path` has been stable across zod-3.

- Run `pnpm install` at repo root. Expect: root `pnpm-lock.yaml` gains a `zod@3.23.x` entry under the importer for `packages/ui`. **No other lockfile importer touched** — assert with `git diff --stat pnpm-lock.yaml` showing one file changed and the importer block being `packages/ui` only.

**Gate**:

- `pnpm --filter @mdd/ui type-check` green — confirms zod's type surface is reachable.
- `git diff --stat` shows: `packages/ui/package.json`, `pnpm-lock.yaml` (root), and nothing else.

### Phase 2 — Land `FormField` in `@mdd/ui/Components`

**Files** (new):

- `packages/ui/src/Components/FormField/index.tsx`:

  ```tsx
  import type { ReactElement, ReactNode } from 'react';
  import type { ZodIssue } from 'zod';

  export interface FormFieldProps {
    readonly name: string;
    readonly label: string;
    readonly children: ReactElement;
    readonly issues?: ReadonlyArray<ZodIssue>;
    readonly required?: boolean;
    readonly help?: ReactNode;
  }

  /**
   * Labeled form-field wrapper. Surfaces the first ZodIssue whose
   * `path.join('.') === name` as an error message under the input.
   * No coupling to a specific form-state library — pair with
   * `@tanstack/react-form`, `react-hook-form`, or plain `useState`.
   */
  export default function FormField({
    name,
    label,
    children,
    issues,
    required,
    help,
  }: FormFieldProps): ReactElement {
    const issue = issues?.find((i) => i.path.join('.') === name);
    const message = issue?.message;
    const showHelp = !message && help != null;
    return (
      <div className="mdd-ui-form-field" data-field={name}>
        <label className="mdd-ui-form-field__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {children}
        {message != null ? (
          <p className="mdd-ui-form-field__error" role="alert">
            {message}
          </p>
        ) : null}
        {showHelp ? <p className="mdd-ui-form-field__help">{help}</p> : null}
      </div>
    );
  }

  export { FormField };
  ```

  Class names use a `mdd-ui-` prefix (not the antd `ant-` prefix or the builder-app `.page-card` style) — consumers can choose to style them or not. No CSS file shipped; the wrapper's structure is render-by-default and consumers add CSS at their leisure. **Decision rule**: no built-in styling matches Button/Modal's no-op philosophy.

**`Components/index.ts` append**:

```ts
export { default as FormField } from './FormField/index.tsx';
export type { FormFieldProps } from './FormField/index.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.

### Phase 3 — Tests

**Files** (new):

- `packages/ui/src/Components/FormField/__tests__/FormField.test.tsx` — happy-dom; cases:
  1. **No issues** → renders label + child + no `[role="alert"]`. Help text shows when `help` prop supplied.
  2. **Matching issue** → renders the issue's message inside `[role="alert"]`; help text is **hidden** when an error is present (error wins over help).
  3. **Non-matching issue** (issue.path joins to a different name) → no error rendered; help text shows.
  4. **Nested path** (`name="user.email"`, issue path `["user", "email"]`) → error renders. Confirms `path.join('.')` matches the documented contract.
  5. **`required` flag** → label contains the visible `*` marker.

  5 cases is the minimum to cover the wrapper's core contract; lower would miss the path-matching invariant.

  Tests construct synthetic `ZodIssue` objects (not via `z.object().safeParse`) so the test doesn't depend on zod runtime behavior — only on the `ZodIssue` shape. That keeps the test fast and isolates the wrapper.

**Gate**:

- `pnpm --filter @mdd/ui test` all green.

### Phase 4 — Close-out

**Files**:

- `packages/ui/README.md` — extend Subpath imports to include `FormField`. Add a short `## FormField (R09)` section showing the prop shape and a paired `@tanstack/react-form` example (matching the plan's FormField + zod section).
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` green.
- `pnpm --filter @mdd/ui type-check` + `test` green.
- `pnpm --filter builder type-check` unchanged.
- Critical-security: no path-glob hit, no new `"dependencies"`, no `child_process`/`eval`/`vm`.

## Do

- _(filled by executor in iteration 6)_

## Check

- [ ] `pnpm --filter @mdd/ui type-check`.
- [ ] `pnpm --filter @mdd/ui test` — FormField cases green.
- [ ] `pnpm --filter builder type-check` — unchanged.
- [ ] `pnpm md:lint`.
- [ ] Critical-security: ✅.
- [ ] `git diff --stat pnpm-lock.yaml` shows zod added under `packages/ui` importer only.

## Act

- _(filled at close)_

## Questions for user before next round

1. **Class-name prefix `mdd-ui-form-field-*`** — confirm or override. Alternatives: BEM, antd `ant-form-*` (would clash with antd's own Form), or no class names (render plain `<div>` + `<label>`). The `mdd-ui-` prefix is opt-in for consumer styling; ships nothing breakable.
2. **Single-error UX**: surface only the first matching `ZodIssue`. Confirm or override (surface all matching issues as a `<ul>`)? Every existing builder form shows one error per field today, so this matches actual UX.
3. **No bundled CSS** — consumers style `.mdd-ui-form-field` themselves. Should we ship a base CSS file or keep render-only? Render-only matches Button/Modal precedent and avoids the soft CSS-var contract pain documented in PageCard's R04 follow-ups.
4. **Round_10 (NotFound page)** — confirm it's the last in the chain, or roll into a smaller subset? NotFound is a Pages export and doesn't depend on R09 — could be done before or after; R10 keeps the original plan's numbering.
