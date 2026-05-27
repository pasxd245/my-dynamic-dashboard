// R41 base + R42 debug listeners. Called from `main.tsx` when
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

  // R42: debug event listeners. Pattern borrowed from ref1/ref2
  // (nextjs-mock-with-msw). Cost ~10 LOC; answers the "did my mock
  // match?" question that comes up the moment you add the second
  // handler. Use `console.debug` so dev tools can filter the noise
  // off when not needed.
  worker.events.on('request:start', ({ request }) => {
    console.debug('[MSW] →', request.method, request.url);
  });
  worker.events.on('request:match', ({ request }) => {
    console.debug('[MSW] ✓', request.method, request.url);
  });
  worker.events.on('request:unhandled', ({ request }) => {
    console.debug('[MSW] ?', request.method, request.url, '(no handler — bypass)');
  });

  console.info('[MSW] browser worker started — VITE_MOCKS=1');
}
