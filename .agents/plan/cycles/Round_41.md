# Round 41: MSW — mock service worker for FE/BE parallelization

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_40](Round_40.md)** — R40 closed the
filter DCBF chain. End-of-round Q&A picked MSW for R41, taking
the verification-stack queue's #1 item that has been parked
since R37.

R41 is a **Track-2 round** (agent-method) per the
[verification-stack queue](../../decisions/2026-05-27-verification-stack-queue.md):

> **MSW** — next available Track-2 round (likely R38).
> *Pulled by*: R34 → R35 → R36 sequencing cost. Unlocks
> contracts → (FE ∥ BE).

Adds Mock Service Worker as a builder devDependency, creates
`src/mocks/` with handlers that mirror the OpenAPI contracts,
wires MSW into the vitest setup (Node-side server) and the dev
server (browser-side worker, opt-in via `VITE_MOCKS=1`).
Migrates the `dataset-detail.test.tsx` suite from the existing
manual `vi.stubGlobal('fetch', …)` pattern to MSW handlers as
the proof of pattern; subsequent test files migrate when
touched (no big-bang refactor).

R41 ships no product feature; it's pure tooling. The product
loop benefits next round (and every round after) when an FE
change can iterate without standing up the BE — and when test
setup stops repeating fetch-mock boilerplate.

*Track: 2 (agent-method, dev discipline). Pulled by:
verification-stack queue item #1; the R34→R36 sequencing cost
captured in the queue rationale; the test-setup repetition
across `dataset-detail.test.tsx` / `datasets.test.tsx` /
`routing.test.tsx`. Per [Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **MSW version: `^2.x`** (current major; the v1 API is
   deprecated). Adds `msw` to `workspace/apps/builder`
   `devDependencies` only (not shipped to production).
2. **`src/mocks/` layout**: four files —
   `fixtures.ts` (shared seed data: one workspace, one CSV
   dataset matching the rows-get contract examples),
   `handlers.ts` (REST handlers for every dataset endpoint
   today touched by FE tests + dev mode), `server.ts`
   (Node-side `setupServer` for vitest), `browser.ts`
   (browser-side `setupWorker` for dev mode).
3. **Endpoint coverage scope (R41)**: workspaces list /
   create / delete / rename, datasets list / detail / rows
   (with filter + q + pagination AND-compose) / batch /
   patch / delete, uploads create-temp / parse. Mirrors the
   surfaces R40 actually uses + the wizard flow. Endpoints
   not yet touched by FE tests stay un-mocked; promote when
   pulled.
4. **Dev-mode toggle: `VITE_MOCKS=1`** env var enables the
   browser worker on `npm run dev`. Off by default — dev
   still talks to the real BE. The env-flag check happens in
   `main.tsx` before React renders; no runtime overhead in
   normal mode.
5. **Test-mode wiring: `tests/setup.ts`** imports `server`
   from `src/mocks/server.ts` and calls
   `server.listen({ onUnhandledRequest: 'error' })` in
   `beforeAll`, `server.resetHandlers()` in `afterEach`,
   `server.close()` in `afterAll`. `onUnhandledRequest:
   'error'` catches misconfigured tests early — any FE
   request to an un-mocked URL fails loudly.
6. **Migration scope (R41)**: only
   `tests/dataset-detail.test.tsx` migrates from
   `vi.stubGlobal('fetch', …)` to MSW. Other test files
   (`datasets.test.tsx`, `routing.test.tsx`) keep their
   existing patterns — MSW handlers serve as the *default*
   response, and `server.use(...overrides)` lets each test
   override per-case. The two patterns coexist; old tests
   still work because they install `vi.stubGlobal('fetch')`
   before MSW intercepts.

   *Update during execution*: legacy `vi.stubGlobal('fetch')`
   tests bypass MSW entirely (Vitest globalstub wins over
   MSW interception). Switched R41 to **`onUnhandledRequest:
   'bypass'`** for the legacy suites, which lets MSW
   intercept where requested and lets legacy `fetch` mocks
   keep working in their own tests. Documented in
   [`src/mocks/server.ts`](../../../workspace/apps/builder/src/mocks/server.ts).
7. **Public worker file**: `public/mockServiceWorker.js`
   generated via `pnpm exec msw init public/`. The file is
   ~5 KB, committed to the repo (per MSW convention — the
   alternative is generation in a postinstall hook, which
   couples the build to install ordering).
8. **Fixtures shape**: one workspace (`ws_aaaaaaa1` —
   "Marketing"), one CSV dataset matching the R34
   `rows-get.contract.yaml` example (`q1_pipeline_Deals`,
   8 columns, ~10 sample rows). Rows handler implements
   the filter + q + pagination semantics in JS so the dev
   experience round-trips correctly (filter-by-stage,
   between-amount, etc. actually work against the
   fixture). Not as performant as DuckDB, but the fixture
   is ~10 rows; perf is irrelevant.
9. **No fixture-state mutation in tests**. Handlers read
   from `fixtures.ts` (a frozen export); per-test
   overrides via `server.use()` pass new handlers that
   return different bodies. This keeps fixtures
   declarative and tests independent. Mutation patterns
   (e.g. for testing create-then-list flows) get added
   when a real test pulls them in.
10. **No `__mocks__/` convention**, no Jest-style file
    co-location. MSW handlers stay in
    `src/mocks/handlers.ts`; per-test overrides stay
    inline. The path matches `import.meta.glob` and
    Vite's import resolution; no special bundler magic.

## What is IN scope

### 1. Add MSW as a builder devDependency

- `pnpm --filter builder add -D msw`.
- The version pin lands in `workspace/apps/builder/package.json`.
- Generate the browser worker:
  `pnpm --filter builder exec msw init public/ --save`.
  Commits the generated `mockServiceWorker.js`.

### 2. New module `src/mocks/`

- [`src/mocks/fixtures.ts`](../../../workspace/apps/builder/src/mocks/fixtures.ts):
  - One workspace, one dataset, one rows-fixture (8 cols
    × ~10 rows mirroring R34 contract examples).
  - Frozen exports — no runtime mutation.
- [`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts):
  - `http.get('/workspaces', …)` → list of one workspace.
  - `http.post('/workspaces', …)` → echoes the request
    body with a new id (`ws_<8hex>`).
  - `http.patch('/workspaces/:id', …)` → echoes the rename.
  - `http.delete('/workspaces/:id', …)` → 204.
  - `http.get('/datasets', …)` → list of one dataset
    (optionally filtered by `?workspace_id=`).
  - `http.get('/datasets/:id', …)` → 200 with the
    dataset or 404 if unknown.
  - `http.get('/datasets/:id/rows', …)` → in-JS row
    filter + q + pagination. Implements:
    - `?page=&page_size=` slicing.
    - `?q=` case-insensitive substring across all cell
      strings.
    - `?f<N>_op=&f<N>_val=` / `_min=&_max=` per-column
      predicates per the R38 vocabulary (all 18 ops; same
      per-dtype CAST semantics as R39 BE but in JS).
    - 422 for the four R39 error codes
      (`filter_op_dtype_mismatch`, etc.).
  - `http.patch('/datasets/:id', …)` → echoes rename.
  - `http.delete('/datasets/:id', …)` → 204.
  - `http.post('/workspaces/:id/datasets/batch', …)` →
    echoes one new dataset per request item.
  - `http.post('/uploads', …)` → mocked CSV / Excel temp
    upload response.
  - `http.post('/uploads/:tempId/parse', …)` → echoes the
    parse preview.
- [`src/mocks/server.ts`](../../../workspace/apps/builder/src/mocks/server.ts):
  - Exports `server = setupServer(...handlers)`.
- [`src/mocks/browser.ts`](../../../workspace/apps/builder/src/mocks/browser.ts):
  - Exports `worker = setupWorker(...handlers)`.

### 3. Wire MSW into vitest setup

- [`tests/setup.ts`](../../../workspace/apps/builder/tests/setup.ts)
  imports the server, calls `listen` / `resetHandlers` /
  `close` in the standard lifecycle hooks.
- `onUnhandledRequest: 'bypass'` so legacy `vi.stubGlobal('fetch')`
  tests keep working alongside MSW-using tests.

### 4. Wire MSW dev-mode opt-in

- [`src/main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  gains a guarded import:
  `if (import.meta.env.VITE_MOCKS === '1') { await
  startMockWorker(); }`. The dynamic import keeps the worker
  out of the production bundle.
- New `src/mocks/start.ts` helper wraps the
  `worker.start({ onUnhandledRequest: 'bypass' })` boilerplate.

### 5. Migrate `tests/dataset-detail.test.tsx`

- Remove the `installFetch` + `vi.stubGlobal('fetch')`
  boilerplate. Tests rely on the default handlers; per-test
  overrides use `server.use(...)`.
- Tests that previously asserted "fetch URL contained `?q=`"
  shift to MSW's request-interception pattern: handlers
  inspect `new URL(request.url).searchParams` and assert
  via `expect.fn` mocks. Simpler in practice — the
  handler-returns-correct-body proves the FE built the right
  URL.

### 6. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — all green (existing tests
  still pass under MSW + legacy fetch-stub coexistence).
- `pnpm --filter builder build` — green; MSW *not* in the
  production bundle (dev-mode dynamic import).
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

### 7. Update verification-stack queue + decisions

- Update
  [`decisions/2026-05-27-verification-stack-queue.md`](../../decisions/2026-05-27-verification-stack-queue.md)
  — flip queue item #1 (MSW) status to **Landed (R41)**.
- The queue's items 2-7 stay in current state.

## What is OUT of scope

- **No product feature.** R41 ships no user-visible
  change. The "user-visible" effect is a dev-mode workflow
  (`VITE_MOCKS=1 pnpm dev` works without BE) and a tighter
  test setup.
- **No big-bang test migration.** Only
  `dataset-detail.test.tsx` migrates. `datasets.test.tsx` /
  `routing.test.tsx` / others migrate when next touched.
- **No fixture-state mutation in handlers.** Per-test
  overrides via `server.use()` cover the create-then-list
  cases that exist today. Stateful in-memory fixtures
  promote only when a real test pulls them.
- **No contract-generated handlers.** The contracts live as
  OpenAPI YAML; codegen from YAML → MSW handlers would be a
  separate Track-2 round. Manual handlers today; revisit if
  drift becomes a pattern.
- **No `_shared/` test helpers extraction**. The MSW setup
  plus per-file overrides are the simplest pattern at N=1
  migrated file. Extract when a second migration shows
  duplicated patterns.
- **No CI integration changes.** The existing
  `pnpm test` / `pnpm build` pipelines pick up the new
  setup automatically. No new CI step.
- **No mock data for cross-feature flows** (e.g. dashboard
  → query → dataset). Those land in their own rounds when
  the surfaces ship.

## Plan

- [x] Confirm scope at planning review (decisions 1-10
      above; user redirects any via end-of-round Q&A).
- [x] `pnpm --filter builder add -D msw` + run
      `msw init public/`.
- [x] Author `src/mocks/fixtures.ts` with the seed
      workspace + dataset + rows.
- [x] Author `src/mocks/handlers.ts` with all the endpoint
      handlers — including the rows-GET with filter + q +
      pagination AND-compose in JS (all 18 R37 ops + four
      R39 422 codes).
- [x] Author `src/mocks/server.ts` + `src/mocks/browser.ts`.
- [x] Author `src/mocks/start.ts` helper for dev-mode opt-in.
- [x] Wire MSW into `tests/setup.ts` with
      `onUnhandledRequest: 'bypass'`.
- [x] Wire the dev-mode opt-in into `src/main.tsx`
      (dynamic import behind `VITE_MOCKS=1`).
- [x] Bump happy-dom to `^20.0.0` (MSW v2 compatibility).
- [x] Migrate `tests/dataset-detail.test.tsx` to use MSW
      handlers (dropped `installFetch` boilerplate; per-
      test overrides via `server.use(...)`).
- [x] Update `decisions/2026-05-27-verification-stack-queue.md`
      flipping MSW to Landed (R41).
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder test` — **45/45** green.
- [x] Run `pnpm --filter builder build` — green; bundle
      size unchanged from R40 (MSW not in prod bundle).
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      to Review.

## Risks / unknowns

- **MSW v2 `onUnhandledRequest: 'error'` vs legacy
  `vi.stubGlobal('fetch')` coexistence.** If MSW's setup
  hooks fire before a test installs its own fetch stub, MSW
  will surface "unhandled request" errors. Mitigation: use
  `'bypass'` for unhandled requests (the legacy tests'
  fetch stubs intercept their own requests anyway).
  Documented in `server.ts`. Migrate test files one at a
  time to MSW-default; drop bypass when all migrated.
- **`happy-dom` + MSW v2 compatibility.** MSW v2 requires
  a working `Request` / `Response` / `fetch` global, which
  happy-dom provides as of v15. Mitigation: pin happy-dom
  ≥ 15 (current is `^15.0.0`); if compatibility issues
  arise, the fallback is migrating to `jsdom`.
- **`public/mockServiceWorker.js` drift across MSW
  upgrades.** The worker file is generated by `msw init`
  and tied to the MSW version. Mitigation: a `postinstall`
  script could regenerate, but that adds install-time
  complexity. Today we commit the file and accept it as a
  "regenerate when bumping MSW" step. Documented.
- **`VITE_MOCKS=1` env var collision.** No conflict with
  existing env vars (the only existing one is
  `VITE_API_BASE_URL`). Mitigation: documented prefix-by-
  feature convention; new mock vars stay under
  `VITE_MOCKS_*`.
- **Handler vocabulary drift vs the R39 BE.** The MSW
  rows handler reimplements filter + q semantics in JS.
  If R39 changes (or R37 vocabulary amends), the mock can
  drift. Mitigation: the FE `OPS_BY_DTYPE` vocabulary-
  integrity test from R40 catches FE-side drift; the BE
  R39 test catches BE-side. The mock handler imports
  `OPS_BY_DTYPE` from `src/features/.../filters/types.ts`
  for the operator list (single source of truth across
  FE production code + FE mocks). The per-op SQL
  semantics need manual sync — acceptable today; flag for
  a future round if drift bites.
- **Browser worker startup latency.** `worker.start()` is
  async; React must `await` it before render. Mitigation:
  the dev-mode opt-in awaits the start, so the first paint
  is delayed by ~50 ms in mock mode. Imperceptible.
- **Service Worker scope vs Vite dev server.** Vite serves
  from root; MSW's worker scope matches by default. No
  workaround needed.

## Do

**Dependency + worker init.**

- `pnpm --filter builder add -D msw` added `msw@^2.14.6`
  to `workspace/apps/builder/package.json` devDependencies.
- `pnpm --filter builder exec msw init public/` generated
  `workspace/apps/builder/public/mockServiceWorker.js`
  (~6 KB; the service worker the browser registers in
  dev-mode opt-in).
- happy-dom bumped from `^15.0.0` → `^20.0.0` to fix the
  MSW v2 ReadableStream lock surfaced during the test
  migration (v15 + MSW v2 hits a
  `Invalid state: ReadableStream is locked` error on
  `Response.json()`; v20 resolves it).

**`src/mocks/` module.**

- [`src/mocks/fixtures.ts`](../../../workspace/apps/builder/src/mocks/fixtures.ts)
  exports `MOCK_WORKSPACE`, `MOCK_DATASET` (7-column
  q1_pipeline_Deals with all six dtypes), `MOCK_ROWS`
  (8 rows mirroring the R34 contract examples), and
  `MOCK_ROWS_FULL` (the `RowsPage` envelope). All frozen.
- [`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts)
  carries 12 MSW REST handlers covering workspaces (list,
  create, patch, delete), datasets (list, detail, rows,
  patch, delete, batch), and uploads (create-temp, parse).
  The rows handler implements filter + q + pagination
  AND-compose in JS — including all 18 R37 operators with
  per-dtype CAST semantics and the four 422 error codes
  (`filter_op_dtype_mismatch`, `filter_value_unparseable`,
  `filter_col_out_of_range`, `filter_operand_shape`). The
  operator vocabulary imports `OPS_BY_DTYPE` directly
  from `src/features/data-management/datasets/filters/types.ts`
  — single source of truth across FE production code +
  mocks. Path matching uses `*/path` origin-wildcards so
  MSW intercepts regardless of which `apiBaseUrl()` the
  config resolves.
- [`src/mocks/server.ts`](../../../workspace/apps/builder/src/mocks/server.ts)
  exports the Node `setupServer(...handlers)` instance for
  vitest.
- [`src/mocks/browser.ts`](../../../workspace/apps/builder/src/mocks/browser.ts)
  exports the `setupWorker(...handlers)` instance for the
  dev-mode service worker.
- [`src/mocks/start.ts`](../../../workspace/apps/builder/src/mocks/start.ts)
  wraps `worker.start({ onUnhandledRequest: 'bypass' })`
  with a one-line console log so dev-mode startup is
  visible in the browser console.

**Vitest setup wiring.**

- [`tests/setup.ts`](../../../workspace/apps/builder/tests/setup.ts)
  imports `server` and registers `server.listen({
  onUnhandledRequest: 'bypass' })` in `beforeAll`,
  `server.resetHandlers()` in `afterEach`, and
  `server.close()` in `afterAll`. `bypass` is the key
  choice: legacy tests that use `vi.stubGlobal('fetch',
  mockFn)` keep working because unmatched requests fall
  through to the global stub instead of erroring.
  Per-test handler overrides use `server.use(...)`.

**Dev-mode opt-in in `main.tsx`.**

- [`src/main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  gained a guarded dynamic-import branch — when
  `import.meta.env.DEV && import.meta.env.VITE_MOCKS === '1'`,
  it dynamically imports `@/mocks/start` and awaits
  `startMockWorker()` before rendering. Otherwise renders
  synchronously. The dynamic import keeps the MSW code
  out of the production bundle (Vite tree-shakes the
  unreached branch — build verified +0 KB gzip vs R40
  baseline).
- The `appTree` JSX is extracted to a const so both the
  mock-mode `then(renderApp)` and the production-mode
  direct call share the same React subtree.

**Test migration: `tests/dataset-detail.test.tsx`.**

- Dropped the 60+ LOC `installFetch` / `vi.stubGlobal(
  'fetch')` / `vi.unstubAllGlobals` boilerplate.
- Tests now rely on the default handlers from `src/mocks/handlers.ts`
  for the happy paths. Per-test overrides via `server.use(
  http.get('*/datasets/:id', () => HttpResponse.json({
  code: 'not_found' }, { status: 404 })))` for the 404
  state test. The OPS_BY_DTYPE vocabulary-integrity test
  stays unchanged — it's a pure import-based assertion.
- Test assertions shifted from "fetch URL contained
  `?q=`" to "matched counter shows the right number" —
  the handler-returns-correct-body proves the FE built
  the right URL. Simpler test code; less coupling to
  network internals.
- Migration scope held: the other test files
  (`datasets.test.tsx`, `routing.test.tsx`, etc.) stay on
  their `vi.stubGlobal('fetch')` pattern. They coexist
  cleanly because `bypass` lets them install their own
  stub.

**Decisions register update.**

- [`decisions/2026-05-27-verification-stack-queue.md`](../../decisions/2026-05-27-verification-stack-queue.md)
  flipped queue item #1 (MSW) to **Landed (R41)** with a
  three-line summary citing this round.

**Pipeline.**

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **45/45 green**
  (38 existing + 7 new R40 tests; the dataset-detail
  suite now runs against MSW handlers; ~13s).
- `pnpm --filter builder build` — green; production
  bundle 1.42 MB / 448 KB gzip (unchanged from R40 since
  MSW is dynamic-imported behind the dev guard).
- `npx markdownlint-cli2` — 0 errors. One MD049 nit
  caught mid-round (this file's first emphasis sets the
  consistency rule to asterisk — earlier R37-R40 used
  underscore via different first-emphasis ordering;
  Round_41 is asterisk-first).
- One mid-round adjustment to the build: the dev-mode
  `await maybeStartMocks()` originally used top-level
  await, which esbuild rejected against the build's
  `chrome87`/`safari14`/`firefox78` target. Refactored
  to a `Promise.then(renderApp)` chain to avoid the
  top-level-await dependency.

## Check

- [x] MSW added as a builder devDependency at `^2.14.6`;
      `mockServiceWorker.js` committed.
- [x] happy-dom bumped to `^20.0.0` (MSW v2 compatibility).
- [x] All 5 mock files (`fixtures.ts`, `handlers.ts`,
      `server.ts`, `browser.ts`, `start.ts`) author the
      documented surface and import the FE
      `OPS_BY_DTYPE` for the operator vocabulary.
- [x] The rows handler implements filter + q + pagination
      AND-compose in JS, surfaces 422 for the four R39
      error codes, and uses fixture mutation-free reads.
- [x] `tests/setup.ts` runs `server.listen` /
      `resetHandlers` / `close` with `bypass` for
      unhandled requests.
- [x] `main.tsx` opt-in via `VITE_MOCKS=1` works behind a
      dev-only guard; the dynamic import keeps MSW out
      of the production bundle (verified by build size
      unchanged from R40).
- [x] `tests/dataset-detail.test.tsx` migrated to MSW;
      all 12 tests pass against the new handlers.
- [x] Legacy tests (`datasets.test.tsx`,
      `routing.test.tsx`) still pass under the coexistence
      pattern — 45/45 green.
- [x] Type-check, test, build, markdownlint all green.
- [x] Decision register updated: queue item #1 (MSW)
      flipped to Landed (R41).
- [x] Post-round audit passes; all Plan + Check
      checkboxes flipped.

## Act

**Learnings**:

- **MSW v2 needs happy-dom ≥ 16 (we landed v20).** v15
  has a known `ReadableStream is locked` bug when MSW v2
  intercepts and the test calls `await response.json()`.
  Surfaced via the MSW probe test I wrote during
  debugging. Bumping happy-dom to `^20.0.0` fixed it
  cleanly; no other test code changes needed.
- **`onUnhandledRequest: 'bypass'` is the right
  coexistence mode during gradual migration.** Legacy
  tests that use `vi.stubGlobal('fetch', mockFn)`
  install their own stub on `globalThis.fetch`. With
  `bypass`, MSW lets unmatched requests fall through —
  to the stub if installed, to the real network
  otherwise. With `error`, the legacy tests' first
  request errors before they get to install their stub.
- **Top-level await is rejected by the build target.**
  Vite's esbuild transform fails when the configured
  target (`chrome87 + safari14 + firefox78`) doesn't
  support TLA. The fix is to wrap the async startup in
  a `Promise.then(renderApp)` chain. Worth remembering
  for any future dev-mode-only async startup pattern.
- **Importing `OPS_BY_DTYPE` from production code into
  mock handlers** is the cleanest way to keep the
  mock's operator vocabulary in lockstep with the FE.
  The R40 vocabulary-integrity test still catches any
  drift between R37 design and FE code; this round
  extends the integrity by anchoring the mocks to the
  same source.
- **Per-test handler overrides via `server.use(...)` are
  much cleaner than the legacy fetch-stub pattern.** A
  test that wants a 404 response writes 3 lines of
  `http.get('*/datasets/:id', () => HttpResponse.json({
  code: 'not_found' }, { status: 404 }))` instead of
  60 lines of fetch-mock plumbing. The pattern scales
  linearly with test cases instead of multiplicatively.
- **Dynamic import keeps MSW out of the production
  bundle for free.** Vite + Rollup tree-shake the
  dev-only branch when `import.meta.env.DEV` is
  statically false at build time. Bundle size verified
  unchanged from R40 (1.42 MB / 448 KB gzip).

**Promotions** *(none — Track-2 tooling round; the mock
files stay co-located in `src/mocks/` until a second app
needs them or a `_shared/` extraction trigger fires)*:

**Follow-ups (not promotions, just notes):**

- **Remaining test files to migrate.** `datasets.test.tsx`
  and `routing.test.tsx` still use the legacy fetch-stub
  pattern. They'll migrate when next touched
  organically; no big-bang refactor scheduled.
- **Contract → MSW handler codegen.** OpenAPI YAML →
  MSW handlers would close the FE↔contract drift loop
  entirely; today the manual handlers can diverge from
  the YAML. Not pulled by R41; promote if a
  contract-vs-mock drift incident surfaces.
- **Browser worker on production builds.** Today the
  dev-mode opt-in is gated on `import.meta.env.DEV`
  AND `VITE_MOCKS === '1'`. Future case: demo /
  staging modes might want mocks too. Promote a more
  flexible env-var check (`VITE_MOCK_MODE=demo`) when
  pulled by a real demo deadline.
- **Workspaces / uploads endpoint handlers are minimal**
  — happy-path only. Edge cases (409 name-taken on
  workspace create, parse-failed on upload) land when a
  test needs them. Documented in `handlers.ts` comments.
- **Vitest worker isolation.** The transient
  full-suite failure I saw mid-run (two upload-wizard
  tests timing out) didn't reproduce on re-run.
  Suspected vitest worker startup flake under cold
  caches; if it recurs, look at `pool: 'forks'` or
  worker-count tuning.
- **MSW v2 upgrade cadence.** `mockServiceWorker.js`
  is tied to the MSW major version. When we bump MSW,
  regenerate with `pnpm exec msw init public/ --save`.
  Documented in this round's Plan.

## Feeds into → Round_42 (TBD — see R41 end-of-round Q&A)

R41 lands MSW. With FE/BE parallelization unlocked, the
candidates for R42 are the ones queued at end-of-R40:

- **Sort DCBF chain** — first product round to benefit from
  MSW (FE for sort can start before BE handlers if the
  handlers go in parallel).
- **Dashboard feature** — large fresh DCBF chain.
- **Advanced query** — OR/grouping syntax on top of
  filters.
- **POC polish** — bundle size, virtualization, real vi-VN
  translator.

The verification-stack queue's remaining items (2-7) stay
parked; the next available Track-2 slot serves whichever
trigger fires first.
