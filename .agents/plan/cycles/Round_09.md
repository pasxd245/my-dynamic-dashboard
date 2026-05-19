# Round 09: Land `@mdd/ui/Components/FormField` (zod-aware)

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

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

- 2026-05-19 — Iter 6 of `/autoagent --budget 10 --warm`. Executor: direct-edit on `autoagent/20260519/Round_09` branch.
- Phase 1 — added `zod: ^3.23.0` to `packages/ui/package.json` peerDependencies + devDependencies. Ran `pnpm install` at repo root; +1 package installed (zod@3.25.76, within the `^3.23.0` range). Root `pnpm-lock.yaml` gained 8 lines (one importer entry under `packages/ui` + one resolution block). Pre-existing peer warning for `@tanstack/react-form` v0.9.0 (unmet React 17/18 vs the repo's React 19) was already present before this round and is unrelated.
- Phase 2 — created `packages/ui/src/Components/FormField/index.tsx` with the signature locked in the plan. Render shape: `<div.mdd-ui-form-field>` → `<label.mdd-ui-form-field__label>` (with `<span aria-hidden="true">` for the `*` required marker) → consumer's child → `<p.mdd-ui-form-field__error role="alert">` when a matching issue is found → `<p.mdd-ui-form-field__help>` when no error but help text supplied. Appended `FormField` re-exports to `packages/ui/src/Components/index.ts`.
- Phase 3 — created `packages/ui/src/Components/FormField/__tests__/FormField.test.tsx` with 5 happy-dom cases:
  1. No issues → label + child render; help text shows.
  2. Matching issue → `role="alert"` carries the message; help is hidden.
  3. Non-matching issue → no alert; help falls back.
  4. Nested path (`name="user.email"`, issue path `["user", "email"]`) → alert matches.
  5. `required` flag → label contains the `*` marker.

  **Discovered cross-file DOM leakage**: happy-dom's `document.body` persists across test files in vitest, so antd portal residue from earlier Modal tests was leaking into `queryByRole('alert')` lookups (one test failed with "expected `<p>` to be null", another with "Found multiple elements with the role alert"). Switched to a local `alertIn(container)` helper using `container.querySelector('[role="alert"]')` to scope assertions to the test's own render container. All 23 tests pass under this pattern.

- Phase 4 — extended [packages/ui/README.md](../../README.md) Subpath imports to include `FormField`. Added a `## FormField (R09)` section with the prop shape, a paired plain-`useState` + `zod.safeParse` example (simpler than the `@tanstack/react-form` example originally planned, since builder doesn't yet have a FormField consumer to point at), and a note on the four BEM-style class names consumers can style.

## Check

- [x] `pnpm --filter @mdd/ui type-check` — green.
- [x] `pnpm --filter @mdd/ui test` — 8 files, 23 tests pass (5 new FormField + 18 existing). Duration 6.93s.
- [x] `pnpm --filter builder type-check` — unchanged baseline (pre-existing errors in `useSavedQueries.ts` / `useWorkspace.ts` / `appConfig.ts` / test files persist).
- [x] `pnpm md:lint` — 0 errors.
- [x] Critical-security: no path-glob hit (only `packages/ui/**` + root `pnpm-lock.yaml` + this round file); no new entry under `"dependencies"` (zod added to peer + dev only); no `child_process`/`eval`/`vm` imports.
- [x] `git diff --stat pnpm-lock.yaml` — 8 insertions, importer block is `packages/ui` only.

## Act

**Learnings**:

- **Cross-file DOM leakage in happy-dom** is real. Vitest does not reset `document.body` between test files when using `--vitest-environment happy-dom`. Antd portal content from earlier `Modal` tests was leaking into `FormField` tests, causing `queryByRole('alert')` (which searches `document.body` by default) to return stale matches. Adopted a `container.querySelector('[role="alert"]')` pattern that scopes to the test's own render container. **This is a portable pattern** that future R10 tests (and any future component test that uses role-based queries) should follow. Captured in the test file as a comment block.
- **zod runtime not exercised** — tests synthesize `ZodIssue` shapes via a small `makeIssue` helper (`as ZodIssue`) so the wrapper's contract is tested independently of zod's runtime parse. The IDE flagged the `as ZodIssue` cast as "unnecessary" (typescript:S4325) but the cast IS load-bearing because zod-3's `ZodIssue` is a discriminated union with required fields per `code` value. tsc itself accepts the file; the warning is a Sonar heuristic that misreads the structural check.
- **Plan called for `@tanstack/react-form` README example**; substituted a plain-`useState` example because the builder app doesn't yet have a FormField consumer to mirror. The plain example is shorter and more obviously demonstrates the issues-prop contract.
- **Lockfile ripple was minimal** (8 lines, single importer). The autoagent.md "Known noise" carve-out for workspace-add lockfile churn extends cleanly to peerDep/devDep adds in an existing workspace package — worth surfacing as a candidate framework refinement.

**Follow-ups (not absorbed)**:

- **Round_10 = NotFound page** (final chain link). Lives under `@mdd/ui/Pages/NotFound`, which is currently empty. Net-new file + barrel + test + README.
- **Builder consumer adoption of FormField** is a future round (not part of this chain).
- **Test isolation regression candidate**: revisit whether a per-file `afterEach(() => document.body.innerHTML = '')` hook would be useful to prevent cross-file DOM leakage at the source. Out of scope for R09 — covered by the per-test container-scoped pattern.

## Questions for user before next round

1. **Class-name prefix `mdd-ui-form-field-*`** — confirm or override. Alternatives: BEM, antd `ant-form-*` (would clash with antd's own Form), or no class names (render plain `<div>` + `<label>`). The `mdd-ui-` prefix is opt-in for consumer styling; ships nothing breakable.
2. **Single-error UX**: surface only the first matching `ZodIssue`. Confirm or override (surface all matching issues as a `<ul>`)? Every existing builder form shows one error per field today, so this matches actual UX.
3. **No bundled CSS** — consumers style `.mdd-ui-form-field` themselves. Should we ship a base CSS file or keep render-only? Render-only matches Button/Modal precedent and avoids the soft CSS-var contract pain documented in PageCard's R04 follow-ups.
4. **Round_10 (NotFound page)** — confirm it's the last in the chain, or roll into a smaller subset? NotFound is a Pages export and doesn't depend on R09 — could be done before or after; R10 keeps the original plan's numbering.
