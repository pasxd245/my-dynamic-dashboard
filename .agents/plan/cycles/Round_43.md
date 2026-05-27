# Round 43: MSW validator stress-test — prove drift-detection fires

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_42](Round_42.md)** — R42 landed
`withContractValidation` and wrapped the rows-GET handler, but
the validator is *dormant*: today's handler conforms, so
`ContractDriftError` has never actually fired. R42 declared the
drift-detector surface "ready" without exercising it. Before we
trust it (R42 follow-up #1 extends coverage to more endpoints;
that bet only pays off if the underlying mechanism works), we
should force the validator through the failure path and confirm
the error surfaces with a useful diff.

R43 is the **stress-test round**: drive the validator through
deliberate handler-drift scenarios via `server.use(...)`
overrides on the rows-GET endpoint, assert each one throws
`ContractDriftError`, and confirm the error message points at
the bad field. If the diff is unreadable or any scenario fails
to fire, fix the validator in this same round — the test is the
forcing function.

R43 is **Track-2** (agent-method, validator-correctness). No
product feature; no FE/BE behavior change. The only runtime
output is one new test file (~50 → ~55 tests).

*Track: 2 (agent-method). Pulled by: R42 closed the
contract-anchor design gap but left the validator
unexercised; the end-of-R42 conversation 2026-05-27 named
"prove it fires" as the natural precondition for the
[`withContractValidation`](../../decisions/2026-05-27-msw-contract-anchor.md)
discipline to be load-bearing — per
[Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Test file path =
   `workspace/apps/builder/tests/contract-validator.test.ts`.**
   Sits next to the other vitest files (peer of
   `dataset-detail.test.tsx`). One file, one concern.
2. **Drive drift via `server.use(...)` per test.** Each test
   installs a one-shot handler that returns a deliberately
   off-shape body, then issues the matching fetch and asserts
   on the thrown error. The base
   [`tests/setup.ts`](../../../workspace/apps/builder/tests/setup.ts)
   already runs `server.resetHandlers()` between tests, so
   overrides don't leak.
3. **Scenarios = the five shape-drift categories AJV
   distinguishes:**
   - Missing required field (`total` dropped from response).
   - Wrong type (`total` as string instead of integer).
   - Extra property under `additionalProperties: false`
     (add an unexpected top-level key).
   - Wrong nested shape (rows as `Record<string, …>` objects
     instead of arrays-of-cells).
   - **Positive control** — a correctly-shaped override
     still passes (proves the test rig itself isn't lying).
4. **Assertion shape** = `expect(fetchPromise).rejects.toThrow(ContractDriftError)`
   plus a follow-up assertion on `err.operationId === 'getDatasetRows'`
   and `err.errors[0].instancePath` pointing at the bad
   field. The `instancePath` assertion is what proves the diff
   is *useful*, not just present.
5. **Use the real MSW server** from
   [`src/mocks/server.ts`](../../../workspace/apps/builder/src/mocks/server.ts),
   not a separate test-only one. The whole point is to
   exercise the production wiring; standing up a parallel
   server would test a parallel codepath.
6. **Reuse `withContractValidation` directly** in the
   override builders — `server.use(withContractValidation('get',
   '*/datasets/:id/rows', 'getDatasetRows', (info) => …drift…))`.
   This mirrors how a future buggy handler in `handlers.ts`
   would look, so the test stays faithful to the real
   failure mode.
7. **Negative-path regression: confirm 204 / 4xx / non-JSON
   responses still pass through unwrapped.** Three small
   assertions verifying that `delete` (204), an injected 422,
   and an injected `text/plain` 200 all bypass the
   validator. Cheap insurance against the content-type /
   status-code guards in
   [`contract-validator.ts`](../../../workspace/apps/builder/src/mocks/contract-validator.ts:140-144)
   silently breaking.
8. **If a scenario doesn't fire, fix the validator in this
   round.** The test surfaces the gap; the gap gets closed
   in the same commit. Common failure modes anticipated:
   AJV strict-mode false negatives, `allErrors: true` not
   actually returning all errors, error message JSON-stringify
   losing context. All fixable in `contract-validator.ts`
   without rethinking the design.
9. **No new dependencies.** AJV + js-yaml + MSW are already
   in `devDependencies` from R41/R42. The stress-test only
   exercises what's there.
10. **No decision file.** R42's
    [contract-anchor decision](../../decisions/2026-05-27-msw-contract-anchor.md)
    already pins the convention; R43 is a *verification*
    round on top, not a new commitment. If the validator
    needs design changes (unlikely), update the existing
    decision's `## What this allows` section in place — but
    most likely the existing decision stands as-is.

## What is IN scope

### 1. New test file `tests/contract-validator.test.ts`

- ~5 drift scenarios + 3 passthrough scenarios + 1 positive
  control = ~9 `it(...)` blocks under one `describe('MSW
  contract validator', …)`.
- Imports `withContractValidation`, `ContractDriftError`
  from `@/mocks/contract-validator`; imports `server` from
  `@/mocks/server`.
- Uses the same fetch-and-assert pattern as
  `dataset-detail.test.tsx` so the rig is familiar.

### 2. Validator fixes (only if a scenario surfaces a gap)

- Edit `src/mocks/contract-validator.ts` *in place* if any
  drift scenario fails to throw, throws the wrong error
  type, or produces an unreadable diff.
- Anticipated touch-points: AJV options (`strict: false`,
  `allErrors: true`), `ContractDriftError` message
  formatting, the content-type / status-code guards at
  lines 140-144.

### 3. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — 45 → ~54 green.
- `pnpm --filter builder build` — green; bundle size
  unchanged from R42 (1418.74 kB / 448.84 kB gzip — the
  test file doesn't enter the production bundle).
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping
  Status — per
  [feedback_round_doc_flip_checkboxes](../../../../.claude/projects/-home-ubuntu-pf-my-dynamic-dashboard/memory/feedback_round_doc_flip_checkboxes.md).

## What is OUT of scope

- **No extending validation to more endpoints.** R42
  follow-up #1 (`getDataset`, list, batch, uploads via
  `@apidevtools/swagger-parser`) stays deferred until
  *after* the validator is proven correct on the one
  endpoint it covers today.
- **No `$ref` dereferencing.** Same reason.
- **No browser-side validation.** R42 follow-up #2 stays
  deferred.
- **No `loadYamlExampleRows()` exercise.** R42 follow-up
  #3 is a separate round.
- **No new MSW handlers, no new contract YAMLs, no new
  production code paths.** This round only adds test
  coverage and (maybe) tightens existing validator code.
- **No `faker` / virtualization.** Orthogonal.

## Plan

- [x] Confirm scope at planning review (decisions 1-10
      above; user redirects any via end-of-round Q&A).
- [x] Author `tests/contract-validator.test.ts` with the
      five drift scenarios + positive control.
- [x] Run `pnpm --filter builder test --run
      tests/contract-validator.test.ts`; iterate until each
      drift scenario throws `ContractDriftError` with a
      useful `instancePath`.
- [x] Add the three passthrough scenarios (204, 4xx,
      non-JSON). Confirm all pass without invoking the
      validator.
- [x] If any scenario surfaced a validator gap, fix
      `src/mocks/contract-validator.ts` in place. Re-run the
      full test file. **Two gaps surfaced and fixed** — see Do.
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder test` — full suite green;
      53/53 (was 45).
- [x] Run `pnpm --filter builder build` — green; bundle
      size unchanged (1418.74 kB / 448.84 kB gzip).
- [x] `npx markdownlint-cli2` — 0 errors repo-wide
      (103 files).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      Status to Review.

## Risks / unknowns

- **AJV strict mode may reject the rows-get schema** when
  fed certain drift inputs in unexpected ways (e.g., type
  coercion). R42 already set `strict: false`; if a scenario
  still misfires, the fix is in `Ajv({...})` options, not
  the test. Bounded.
- **`additionalProperties: false` may not be set on every
  level of the rows-get schema.** If the contract YAML
  doesn't enforce it at the top level, the "extra property"
  scenario won't throw. Mitigation: check the YAML first; if
  the constraint isn't there, either add it to the
  contract (Track-1 amendment, out of R43 scope — drop that
  scenario instead and document why) or test a deeper-level
  `additionalProperties` violation that *is* enforced.
- **`server.use(...)` override ordering.** The
  base handler from `handlers.ts` also matches the rows-GET
  path; if MSW matches the base before the override,
  the test fails for the wrong reason. MSW v2's
  documented behavior is LIFO (overrides win), but the
  `*/datasets/:id/rows` wildcard may interact unexpectedly.
  Mitigation: a one-line sanity test asserts the override
  is reached *before* asserting drift behavior.
- **`ContractDriftError` thrown inside an MSW handler may
  surface as a *handler error*, not a rejected fetch
  promise.** MSW v2 typically catches handler exceptions
  and returns a 500. If that's what happens, the test's
  `.rejects.toThrow(ContractDriftError)` assertion fails
  even though the validator works. Mitigation: check what
  MSW does with thrown errors; the assertion may need to
  be on `console.error` content or on a 500 response with
  the error name in its body. May need to add a vitest
  `setup.ts` listener (`server.events.on('unhandledException',
  …)`) that re-surfaces the error. Likely the largest
  unknown going in.
- **Vitest's parallel test runner** could let one scenario's
  override leak into a sibling test if `server.resetHandlers`
  isn't running between them. Confirmed by reading
  [`tests/setup.ts`](../../../workspace/apps/builder/tests/setup.ts) —
  it should be; verify before authoring.
- **Diff-readability is subjective.** "Useful" `instancePath`
  may mean `/total`, `/rows/0`, or `/rows/0/2` depending on
  scenario. The test asserts on *the right path for each
  scenario*, not on a generic "is non-empty" predicate.

## Do

The stress-test surfaced **two R42 bugs** that the dormant
validator had hidden. Both were exactly the kind of latent drift
that R43 was designed to flush out.

**Bug 1: validator never ran in tests (R42 `IS_NODE` check was wrong).**

R42's `contract-validator.ts:37` defined:

```ts
const IS_NODE = typeof window === "undefined";
```

Intent: skip validation in browser builds. Reality: vitest uses
`happy-dom` which shims `window` globally, so `IS_NODE` was
`false` *in tests*. `loadSchemas()` short-circuited to an empty
map; `validateResponse()` returned `{ ok: true }` for every body.
The validator has been silently no-op'd since R42 landed.

Discovery path: positive-control test passed (override body
returned), but all four drift tests showed the
`mswUnhandledExceptions` buffer empty — meaning the validator
never threw. A direct probe `validateResponse('getDatasetRows',
{ foo: 'bar' })` returned `{ ok: true }`, confirming no schema
loaded.

Fix: switch to a `process`-based Node detector that happy-dom
doesn't shim:

```ts
const IS_NODE =
  typeof process !== "undefined" && typeof process.versions?.node === "string";
```

Browser builds still skip (Vite stubs `node:fs` imports for the
browser bundle and the `IS_NODE` guard short-circuits anyway).
Vitest + happy-dom now correctly resolves to `IS_NODE = true`,
schemas load from disk, validation runs.

**Bug 2: MSW v2 swallows resolver throws — `.rejects.toThrow` doesn't work.**

R42 documented the failure mode as *"throws ContractDriftError
with the diff. Loud."* (decision file § "Mode detection") and the
plan's failure-mode line read *"throws in test"*. In MSW v2.14.6
that's only half-true: the resolver does throw, but MSW catches
the exception and emits it via the `unhandledException` event.
The awaited `fetch()` resolves cleanly (with a 500-style response),
so `await expect(fetch(...)).rejects.toThrow(ContractDriftError)`
never fires.

Fix: extend
[`tests/setup.ts`](../../../workspace/apps/builder/tests/setup.ts)
with a per-suite `unhandledException` listener that buffers
errors into an exported array; `afterEach` drains the buffer and
re-throws to fail the test. Tests that intentionally provoke
exceptions (the stress-test) drain the buffer themselves before
asserting.

Combined effect: **drift now actually fails tests loudly**,
restoring R42's claimed-but-broken contract. Any future
contract-handler drift in `dataset-detail.test.tsx` (or any
other MSW-using test) will now fail the suite instead of being
silently ignored.

**Test file authored.**

[`tests/contract-validator.test.ts`](../../../workspace/apps/builder/tests/contract-validator.test.ts) —
8 tests under two `describe` blocks:

- *Drift scenarios fire ContractDriftError* (5 tests):
  positive control + missing-required + wrong-type +
  additional-property + wrong-nested-shape. Each drift test
  asserts on `err.operationId`, `err.errors[0].keyword`, and
  the precise `instancePath` / `params.missingProperty`.
- *Passthrough regression (R42 guards)* (3 tests): 204
  no-content + 4xx envelope + non-JSON 200 — all bypass the
  validator unwrapped, exercising the content-type and
  status-code guards in `contract-validator.ts`.

**Pipeline.**

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **53/53 green** (was 45;
  +8 from R43; existing tests unaffected because the
  production `getDatasetRows` handler conforms to its
  contract YAML — no false-positive drift on the real
  handler).
- `pnpm --filter builder build` — green; bundle
  **1418.74 kB / 448.84 kB gzip** (unchanged from R42 —
  the IS_NODE fix is a Node-side path; Vite still
  tree-shakes for the browser).
- `npx markdownlint-cli2` — 0 errors over 103 files.

## Check

- [x] `tests/contract-validator.test.ts` exists and runs
      under `pnpm --filter builder test`.
- [x] All five drift scenarios throw `ContractDriftError`
      with `err.operationId === 'getDatasetRows'` and a
      precise `instancePath` / `params.missingProperty` /
      `params.additionalProperty`.
- [x] Positive-control scenario (well-formed override)
      passes without throwing.
- [x] All three passthrough scenarios (204, 4xx, non-JSON)
      return their response unwrapped — validator never
      runs (asserted via `mswUnhandledExceptions.length === 0`
      on each).
- [x] Validator fixes landed in
      `src/mocks/contract-validator.ts`:
      `IS_NODE` switched to `process.versions.node` check;
      multi-line comment cites the happy-dom shim as the
      reason.
- [x] No existing test broke; full builder suite green
      (53/53). The production `getDatasetRows` handler in
      [`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts)
      conforms to the contract YAML — the now-active
      validator does not flag it.
- [x] Type-check, build, markdownlint all green.
- [x] Post-round audit passes; all Plan + Check checkboxes
      flipped.

## Act

**Learnings**:

- **A verification round is only as good as the gaps it
  exposes.** R43 was sold as "stress-test a working
  validator." It turned into "fix the validator that was
  silently broken since R42." The round delivered more
  value than the plan promised — because the *premise* of
  the plan ("validator works, prove it") was wrong. The
  forcing-function value of writing the test is exactly
  this: an attempt to assert correctness surfaces the
  cases where correctness was assumed but not held.
- **`typeof window === "undefined"` is not a Node detector
  under DOM-emulating test environments.** Happy-dom (and
  jsdom) shim `window` globally so the test runtime looks
  browser-shaped. `typeof process !== "undefined" && process.versions?.node`
  is the canonical Node-runtime check that resists this
  shim. Generalizable beyond this round.
- **MSW v2 swallows resolver throws by default.** The
  resolver throws → MSW catches → emits
  `unhandledException` event → awaited `fetch()` resolves
  with a synthetic 500. Tests using
  `.rejects.toThrow(SomeError)` against MSW handlers will
  *silently pass* unless `unhandledException` is wired to
  fail tests. R43 added the wiring in `tests/setup.ts`.
- **Two bugs found is not a coincidence; it's the
  signature of dormant code.** R42's design *seemed*
  fully wired (typed handler decorator, typed error class,
  JSON-schema validation against a parsed YAML), and the
  build/test pipeline passed. But neither failure path was
  ever exercised. The lesson: if a code path can only
  *fail loudly*, it must be *exercised loudly* at least
  once to know the loudness works. Apply forward to other
  defensive code (the R39 BE conformance helper deserves
  the same check at some point).
- **The R42 decision file stands as written.** The
  validator's `applies-when` / `failure-mode` /
  `revisit-trigger` are unchanged — what changed is that
  the validator now *actually* enforces them. No decision-
  file amendment needed.

**Promotions** *(none this round — Track-2 verification work;
the test file stays under `tests/` until a second mocks
domain or `packages/mocks` extraction pulls it out, same as
R42's validator)*:

**Follow-ups (not promotions, just notes):**

- **Extend coverage to $ref-using endpoints.** Now that the
  validator actually runs, R42's named follow-up #1
  (`@apidevtools/swagger-parser` to dereference
  `getDataset`, list, batch, uploads) pays off — drift on
  those endpoints would be loud, not silent. Candidate for
  R44 if the next round stays in Track-2.
- **Capture the IS_NODE / MSW-unhandledException gotchas
  in `memory/`.** Both are reusable Vite/vitest/MSW
  patterns that a future round (or a parallel project)
  could trip over. Worth one short memory file each.
- **Browser dev validation deferred (still).** R42 named
  this as follow-up #2; nothing in R43 changes the
  calculus. Cost: bundle AJV behind `import.meta.env.DEV`.
  No pull yet.
- **Audit other defensive code paths for the same dormant-
  failure trap.** The R39 BE `validate_response()` helper
  and the R34 contract-validity tests both have the same
  shape — they fire only on drift. A small "verify the
  verification" round across the stack could surface other
  R42-style bugs. Not pulled today; flag for later.
- **The R42 decision file's `failure-mode:` value is sharper
  in retrospect.** R43 demonstrated the failure mode it
  named was *also* the failure mode of the validator itself
  (silent drift between *intended* loud-failure semantics
  and *actual* silent no-op semantics). The discipline
  worked; the bug was deeper than the convention's scope.

## Feeds into → Round_44 (TBD)

R43 closed two latent R42 bugs and made the contract validator
actually load-bearing for the first time. Three candidate
directions for R44:

- **Track-2, validator coverage extension** — adopt
  `@apidevtools/swagger-parser` and wrap the remaining
  contract endpoints (`getDataset`, list, batch, uploads).
  Closes R42's named follow-up #1. Now meaningful because
  the validator actually runs.
- **Track-2, gotcha capture** — small memory-file round
  documenting the IS_NODE + MSW-unhandledException
  patterns so they don't get re-discovered. Low cost; mostly
  prose.
- **Track-1, return to product** — sort DCBF chain,
  dashboard, advanced query, or POC polish per R42's
  deferred list. The MSW stack is now genuinely paid for.

Choice deferred to end-of-R43 Q&A.
