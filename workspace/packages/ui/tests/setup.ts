import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Force React unmount + flush before each test environment teardown.
// AntD Menu schedules async work (popover positioning, hover debounce)
// that otherwise fires after happy-dom's `window` is torn down → causes
// "ReferenceError: window is not defined" in the React scheduler.
afterEach(() => {
  cleanup();
});
