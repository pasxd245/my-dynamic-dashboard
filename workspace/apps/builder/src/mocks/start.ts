// R41: dev-mode opt-in helper. Called from `main.tsx` when
// `VITE_MOCKS=1`. Dynamic import via the call site keeps MSW out of
// the production bundle.

import { worker } from './browser';

export async function startMockWorker(): Promise<void> {
  await worker.start({
    // `'bypass'` lets the dev server fall through to the real
    // backend for any endpoint we haven't mocked yet (workspaces
    // already mocked; uploads / datasets etc. land here too).
    // Switch to `'warn'` if you want a console log per unhandled
    // request during local iteration.
    onUnhandledRequest: 'bypass',
  });
  // eslint-disable-next-line no-console
  console.log('[MSW] browser worker started — VITE_MOCKS=1');
}
