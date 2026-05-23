import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Same reasoning as @mdd/ui setup: ensure React unmounts before
// happy-dom tears down `window`, so AntD's async work doesn't
// fire post-teardown.
afterEach(() => {
  cleanup();
});
