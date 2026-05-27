// R41: MSW Node server for vitest. The `setupServer` call wires the
// handlers into Node's `fetch` (happy-dom-provided) via MSW's
// interception layer.
//
// Test-mode policy: `onUnhandledRequest: 'bypass'` (configured by the
// caller in tests/setup.ts). The rationale — legacy tests use
// `vi.stubGlobal('fetch', …)` which bypasses MSW entirely; setting
// MSW to `'error'` would break those tests during the gradual
// migration. Per-test handler overrides via `server.use(...)`.

import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const server = setupServer(...handlers);
