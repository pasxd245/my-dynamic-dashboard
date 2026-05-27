import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
// R32: initialise i18n once for the whole test run so any component
// rendered in tests sees populated English resources. Tests query by
// real strings (e.g. "Create"), so we can't use the key-as-translation
// shortcut — we need real translations loaded.
import "@/i18n";

// R41: MSW server lifecycle. `onUnhandledRequest: 'bypass'` so legacy
// `vi.stubGlobal('fetch', …)` tests still work alongside the
// MSW-using tests. Per-test overrides via `server.use(...)`.
import { server } from "@/mocks/server";

// R43: MSW v2 catches resolver exceptions (including R42's
// ContractDriftError) and emits them via `unhandledException`
// rather than rejecting the awaited `fetch()`. Without this buffer,
// a buggy mock handler would fire silently and the test would pass.
// We collect exceptions per-test and re-throw them in `afterEach`
// so drift becomes a loud failure as R42's design intended. Tests
// that intentionally provoke handler throws drain `mswUnhandledExceptions`
// themselves before the afterEach guard runs (see
// `contract-validator.test.ts`).
export const mswUnhandledExceptions: Error[] = [];

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  server.events.on("unhandledException", ({ error }) => {
    mswUnhandledExceptions.push(error as Error);
  });
});

afterEach(() => {
  // Same reasoning as @mdd/ui setup: ensure React unmounts before
  // happy-dom tears down `window`, so AntD's async work doesn't
  // fire post-teardown.
  cleanup();
  // Reset MSW handler overrides so each test starts from the default
  // handler set.
  server.resetHandlers();
  const errs = mswUnhandledExceptions.splice(0);
  if (errs.length === 1) throw errs[0];
  if (errs.length > 1)
    throw new AggregateError(errs, "MSW handler threw unhandled exception(s)");
});

afterAll(() => {
  server.close();
});
