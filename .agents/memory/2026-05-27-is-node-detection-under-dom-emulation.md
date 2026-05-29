# `typeof window === "undefined"` is not a Node detector under happy-dom / jsdom

**Date**: 2026-05-27
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

The "am I in Node?" check `typeof window === "undefined"` is a
classic idiom for branching between Node and browser runtimes.
It works when the test runtime is bare Node — but it **silently
fails** when the test runtime uses a DOM-emulator like
**happy-dom** (vitest default for React projects) or **jsdom**.
Both emulators shim `window` (and `document`, `navigator`, etc.)
onto `globalThis` to make React Testing Library work. So:

| environment            | `typeof window` | intended outcome | what the idiom returns |
| ---------------------- | --------------- | ---------------- | ---------------------- |
| real Node CLI          | `"undefined"`   | Node-branch      | ✅ Node-branch         |
| real browser           | `"object"`      | browser-branch   | ✅ browser-branch      |
| **vitest + happy-dom** | **`"object"`**  | Node-branch      | ❌ browser-branch      |
| **vitest + jsdom**     | **`"object"`**  | Node-branch      | ❌ browser-branch      |

The trap: a `IS_NODE` guard that was meant to enable filesystem
access in tests evaluates to `false`, the Node-only code path is
skipped, and the test passes anyway because no assertion ever
exercises the missing behaviour. The bug is _silently dormant_
until something tries to _prove_ the Node-only path runs.

This bit R42's contract validator
([`src/mocks/contract-validator.ts`](../../workspace/apps/builder/src/mocks/contract-validator.ts))
for one full round. The validator's `loadSchemas()` was guarded
by `IS_NODE = typeof window === "undefined"`; under vitest +
happy-dom, `IS_NODE` was always `false`, so `loadSchemas()`
returned an empty map and `validateResponse()` returned
`{ ok: true }` for every body. R42's tests passed (45/45) because
no test ever provoked drift — the validator looked correct and
the build looked correct. R43's stress-test surfaced the bug only
by _asserting that drift fires_.

## Finding

The correct Node detector under DOM-emulating test runtimes is:

```ts
const IS_NODE = typeof process !== 'undefined' && typeof process.versions?.node === 'string';
```

`process.versions.node` is a Node-runtime property that
DOM-emulators do not shim onto `globalThis`. Real browsers don't
expose `process` either. This check is:

- ✅ `true` under bare Node CLI
- ✅ `true` under vitest + happy-dom / vitest + jsdom (because
  vitest _itself_ runs in Node; happy-dom only shims the _DOM_
  globals, not `process`)
- ✅ `false` in real browsers
- ✅ `false` when the file is statically bundled for a browser
  build (Vite tree-shakes the `node:fs` static imports and the
  guard evaluates against the bundler's `process` polyfill,
  which lacks `versions.node`)

The fix is one-line and reversible. It does not require
restructuring the module or splitting `.node.ts` /
`.browser.ts` variants.

## Evidence

- R42 introduced the bug at
  [`src/mocks/contract-validator.ts:37`](../../workspace/apps/builder/src/mocks/contract-validator.ts#L37)
  with `IS_NODE = typeof window === "undefined"`.
- R43 surfaced it via `tests/contract-validator.test.ts` —
  positive control passed (validator returned the response
  unchanged) but four drift scenarios all left the
  `unhandledException` buffer empty, meaning the validator
  never threw.
- A direct probe `validateResponse('getDatasetRows', { foo: 'bar' })`
  returned `{ ok: true }` from a fresh import — confirming the
  schemas map was empty.
- vitest config for this project uses happy-dom (see
  `workspace/apps/builder/vitest.config.ts` and the
  `@testing-library/jest-dom/vitest` import in
  `tests/setup.ts`).

## Recommendation

**Do**:

- When a module needs to branch between Node and browser
  runtimes inside test-touching code, use:

  ```ts
  const IS_NODE = typeof process !== 'undefined' && typeof process.versions?.node === 'string';
  ```

- Treat happy-dom and jsdom as Node runtimes with a _partial_
  DOM shim, not as browser runtimes. Anything that needs `fs`,
  `path`, `url`, etc. should still run; anything that needs
  _real_ browser APIs (Service Worker registration, real
  `XMLHttpRequest`, layout) should not.
- When writing a module guarded by `IS_NODE`, **author at least
  one test that proves the Node branch actually runs**. R42's
  failure mode was that no assertion ever exercised the
  branch; only an explicit "the schema rejects body X" assertion
  would have caught it. R43's stress-test pattern (force the
  failure path, assert the failure) is the generalizable fix.

**Don't**:

- Use `typeof window === "undefined"` as a Node detector in any
  file that is imported by vitest. It will silently no-op the
  Node branch.
- Use `typeof navigator === "undefined"` for the same reason —
  happy-dom shims `navigator` too.
- Rely on `process.env.NODE_ENV === "test"` as a proxy. It
  works for the narrow "are we in vitest?" case, but doesn't
  generalize to dev-server SSR or other Node contexts where the
  guard should also be `true`.

## Promotion Candidate?

- [ ] `context/` — possibly, if a "writing modules that touch
      both Node and browser" pattern doc ever lands.
- [ ] `skills/`
- [x] Not yet — single-purpose gotcha; revisit if a second
      Node-vs-browser-detection incident accumulates, or if
      we ship another module with the same shape (e.g., a
      preview-HTML renderer that reads from disk in tests
      and bundles to a string in production).
