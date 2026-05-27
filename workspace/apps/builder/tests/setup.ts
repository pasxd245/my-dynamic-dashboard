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

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  // Same reasoning as @mdd/ui setup: ensure React unmounts before
  // happy-dom tears down `window`, so AntD's async work doesn't
  // fire post-teardown.
  cleanup();
  // Reset MSW handler overrides so each test starts from the default
  // handler set.
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
