import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
// R32: initialise i18n once for the whole test run so any component
// rendered in tests sees populated English resources. Tests query by
// real strings (e.g. "Create"), so we can't use the key-as-translation
// shortcut — we need real translations loaded.
import "@/i18n";

// Same reasoning as @mdd/ui setup: ensure React unmounts before
// happy-dom tears down `window`, so AntD's async work doesn't
// fire post-teardown.
afterEach(() => {
  cleanup();
});
