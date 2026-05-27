# MSW v2 swallows resolver throws — `.rejects.toThrow` silently passes

**Date**: 2026-05-27
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

When an MSW v2 request resolver throws (sync or via a rejected
async promise), the awaited `fetch()` at the call site **does
not reject**. MSW catches the exception, emits it via the
server's `unhandledException` event, and resolves the request
with a synthetic 500-style response. The natural vitest pattern:

```ts
await expect(fetch(URL)).rejects.toThrow(SomeError);   // ❌ never fires
```

…silently passes. The resolver *did* throw, the error *did*
exist — it just never reached the awaited promise. So any test
that asserts "the handler throws X on bad input" using
`.rejects.toThrow` will look green while the failure path is
actually broken or absent.

This is by design in MSW v2 — a resolver throwing is treated as
a "server-side error" the network would have hidden behind a
500, not as a transport-level failure (which is what
`fetch.rejects` represents). But the design contradicts the
intuition of "I threw, you should catch."

Tools / code that relied on this:

- **R42's `withContractValidation` decorator** — wraps an MSW
  handler, throws `ContractDriftError` on schema-validation
  failure. R42's decision file documented this as "throws in
  test mode (loud)." It was loud in *intent* but not in
  *effect*: the throw vanished into the `unhandledException`
  event, the awaited fetch resolved cleanly, and no test caught
  the drift. R43's stress-test surfaced this.
- Generally: any test that wraps an MSW handler and wants to
  assert on a resolver-thrown error.

## Finding

To make resolver throws fail tests loudly, **buffer
`unhandledException` events at the server level and drain them
in `afterEach`**. Re-throw the buffered errors so vitest treats
them as test failures.

Reference implementation (R43,
[`workspace/apps/builder/tests/setup.ts`](../../workspace/apps/builder/tests/setup.ts)):

```ts
import { server } from "@/mocks/server";

export const mswUnhandledExceptions: Error[] = [];

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  server.events.on("unhandledException", ({ error }) => {
    mswUnhandledExceptions.push(error as Error);
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  const errs = mswUnhandledExceptions.splice(0);
  if (errs.length === 1) throw errs[0];
  if (errs.length > 1)
    throw new AggregateError(errs, "MSW handler threw unhandled exception(s)");
});

afterAll(() => {
  server.close();
});
```

Tests that *intentionally* provoke a resolver throw and want to
assert on the captured error (rather than fail) drain the buffer
themselves before the `afterEach` guard runs:

```ts
import { mswUnhandledExceptions } from "./setup";

it("drift fires ContractDriftError", async () => {
  server.use(/* override that throws */);
  await fetch(URL);
  const errs = mswUnhandledExceptions.splice(0);   // drain
  expect(errs).toHaveLength(1);
  expect(errs[0]).toBeInstanceOf(ContractDriftError);
});
```

This pattern composes both directions: silent throws fail the
suite by default; tests that need to inspect the throw opt in.

## Evidence

- MSW v2.14.6 behaviour verified empirically against the
  R43 stress-test
  ([`tests/contract-validator.test.ts`](../../workspace/apps/builder/tests/contract-validator.test.ts)).
- Stderr emitted by MSW on each captured throw confirms the
  catch happens at the MSW layer:

  ```text
  [MSW] Encountered an unhandled exception during the handler lookup for
  "GET …/datasets/ds_…/rows". Please see the original error above.
  ```

- `try/catch` around `await fetch(URL)` *never* fires for a
  resolver throw — confirmed by R43's first failing test run
  before the buffer pattern was added.
- The `request:unhandled` event documented in `start.ts`'s
  browser-side listeners is a different event (no matching
  *handler* for the request); `unhandledException` is the
  right channel for handler-thrown errors.

## Recommendation

**Do**:

- Wire `server.events.on("unhandledException", …)` into the
  test-suite setup file. Failure to do so means handler bugs
  silently pass.
- When asserting on a resolver-thrown error, drain the buffer
  inside the test and inspect the captured error, rather than
  expecting the awaited `fetch()` to reject.
- For any "throw X on bad input" handler decorator (validator,
  authorization gate, etc.), add at least one stress-test that
  forces the throw and asserts the buffer caught it. This is
  the only way to prove the "loud" path is actually loud.

**Don't**:

- Use `await expect(fetch(URL)).rejects.toThrow(SomeError)`
  against MSW handlers. It silently passes — the assertion is
  decorative.
- Convert the resolver throw into a `HttpResponse.json({...},
  { status: 500 })` to make `fetch` reject — that loses the
  typed `Error` subclass at the test boundary and doesn't
  surface in `unhandledException` either. Throwing is the
  right shape; the test infrastructure has to catch up.
- Subscribe to `unhandledException` inside the test that
  provokes the throw without de-subscribing afterward — leaked
  listeners across tests cause cross-test pollution. The
  setup-file pattern with a shared buffer is cleanest.

## Promotion Candidate?

- [ ] `context/` — possibly, if a "writing MSW-using tests for
      this repo" doc ever lands. For now, the
      `tests/setup.ts` source is its own documentation.
- [ ] `skills/`
- [x] Not yet — single-purpose gotcha; promote when a second
      MSW-using domain accumulates and the pattern needs to
      be reused outside `apps/builder/tests/`.
