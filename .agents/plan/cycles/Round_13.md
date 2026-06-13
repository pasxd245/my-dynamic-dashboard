# Round 13: Workspaces feature — TanStack Query + backend stubs + create modal

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_12](Round_12.md)** — master-layout chrome
lives in the running builder. WorkspacesPage renders the visual
(card grid + empty state + create button) using local `useState`
with hardcoded `SAMPLE_WORKSPACES` and an `R12 DEMO` toggle.

R13 swaps the static demo for **real data**: TanStack Query against
a real backend endpoint, a create flow that persists to the
in-memory backend store, and the deletion of R12's demo toggle.
Visual shape stays the same; only the data layer changes.

This is the round R11's design contract at
[workspaces.md](../../design/data-management/workspaces/workspaces.md) was
written for — all five HIxAI decisions (model, Query, backend
stub, sub-menu UX, empty state) are locked.

_Track: 1 (product — first end-to-end real-data feature). Pulled by:
[Round_11](Round_11.md) workspaces.md feature design + named-pulls
table (R13 row); distillation memo entry N (DEFER → ADOPT-VIA-ROUND
trigger: "first feature reading server data"). Per
[Evolution Rule](../../AGENTS.md)._

## What is IN scope

One cohesive feature: Workspaces real data layer end-to-end —
backend + frontend integration through the build-first BIZ
boundary for the first time.

- **Backend** (`workspace/apps/backend/`):
  - New router `app/routers/workspaces.py` with `GET /workspaces`
    (returns list) and `POST /workspaces` (creates one, returns
    it).
  - Pydantic models `Workspace` + `CreateWorkspace`. Backend type
    mirrors the TypeScript shape: `{ id: str, name: str,
createdAt: str (ISO-8601 UTC) }`.
  - In-memory module-level list as the store. Dies on backend
    restart — persistence (DuckDB / SQLite) explicitly deferred
    to R14+ per the workspaces.md scope.
  - Initial-state decision: ship with an **empty store** by
    default. The empty-state CTA is the first thing a real user
    sees — that's intentional, matches the "no demo data in
    production" principle. (Compare to R12 which seeded 5 sample
    workspaces.)
  - CORS middleware allowing `http://localhost:3000` (the builder
    dev origin) — first time the backend serves the frontend.
  - Pytest tests for both endpoints (GET empty, GET after POST,
    POST validation rejection for empty name).
- **Builder data layer** (`workspace/apps/builder/src/`):
  - Add `@tanstack/react-query` dependency.
  - `QueryClientProvider` in `main.tsx`, above `BrowserRouter`,
    with `defaultOptions: { queries: { staleTime: 60_000,
refetchOnWindowFocus: false } }`.
  - `api/workspacesApi.ts` — `fetch`-based client. Functions:
    `list()`, `create({ name })`. Reads `VITE_API_BASE_URL` env
    (falls back to `http://localhost:8000`).
  - `features/data-management/workspaces/types.ts` — `Workspace`
    type matching backend shape.
  - `features/data-management/workspaces/hooks.ts` —
    `useWorkspacesQuery()` (returns
    `{ data, isLoading, isError }`) +
    `useCreateWorkspaceMutation()` (returns `{ mutate, isPending }`
    with `onSuccess` invalidating the workspaces query).
- **WorkspacesPage rewritten**:
  - Consume `useWorkspacesQuery()`; render loading skeleton
    (AntD `<Skeleton>` inside PageCard) while pending; render
    error alert if query fails; render empty state when data is
    an empty array; render card grid when populated.
  - Delete `SAMPLE_WORKSPACES`, `R12 DEMO` toggle, local
    `useState` for the list — all gone.
  - "Create" button (both PageHeader actions and empty-state CTA)
    opens an AntD `<Modal>` with `<Form>` + single `<Input>` for
    name. Submit triggers `useCreateWorkspaceMutation().mutate`;
    on success modal closes, list refetches.
  - Form validation: name required, 1-80 chars (per the design
    doc).
- **Tests**:
  - **Backend pytest**: GET returns list (initially empty);
    POST creates a workspace and returns it with generated `id`
    and `createdAt`; POST with empty name returns 422 (FastAPI's
    automatic validation).
  - **Builder vitest**: rewrite `routing.test.tsx` workspaces
    tests. Mock `fetch` at the test level (via `vi.spyOn`) —
    return canned responses. Tests cover: empty state renders
    when query returns `[]`; cards render when query returns
    items; create modal opens on button click; submitting the
    form calls fetch with POST + closes modal + invalidates
    query.
  - Maintain ≥ 26 + 7 baseline; expect the new tests to roughly
    match (some old R12 demo-toggle tests retire).
- **Visual smoke check**: `pnpm dev` (the multi-app dev loop
  from R06 — backend + builder together). Verify:
  - On first load: empty state renders (no demo data).
  - Click "Create your first workspace" → modal opens → enter
    "Marketing" → submit → modal closes → "Marketing" card
    appears with today's date.
  - Refresh page → "Marketing" still there (backend in-memory
    survives one refresh).
  - Restart backend → data gone (in-memory). Expected. R14+
    adds persistence.

## What is OUT of scope (explicit deferrals)

- **Workspace persistence** (DuckDB / SQLite / file). Module-level
  list only. R14+ adds real persistence; trigger: in-memory dying
  on backend restart becomes annoying enough during dev work.
- **Edit / rename / delete workspace**. R14+. Trigger: user
  friction with mis-named or stale workspaces.
- **Workspace detail page** at `/data-management/workspaces/<id>`.
  R14+. Trigger: a workspace-scoped action needs a URL (CSV
  upload, query saving, etc.).
- **Authentication / authorization / ownerId**. Far off — current
  product is single-user. R∞.
- **Sorting / filtering controls**. Default sort:
  most-recent-first (backend orders by createdAt desc). UI
  controls land when a user has 20+ workspaces.
- **Workspace templates / starter data**. R∞.
- **`ListCard` primitive extraction to `@mdd/ui`**. R11 open
  question, lean was "yes, name generically." Per the
  "Default = don't add" principle and the fact that R13 has only
  one card consumer (WorkspaceCard) — defer the extraction. When
  R14+ introduces a second list-card surface (DatasetCard,
  SavedQueryCard, etc.), extract `ListCard` then. WorkspaceCard
  stays in the feature folder for R13.
- **Build-first lesson promotion + AntD-wrapper-testing pattern
  promotion**. Both deferred to a post-upload Track-2 batch round
  per the R12 user call. R13 doesn't touch `context/`.
- **Tailwind + CSS layer order** (distillation O). Still no
  Tailwind in the codebase; not triggered.
- **VITE_API_BASE_URL via .env**. R13 uses a TypeScript constant
  with fallback; .env file work defers until staging/prod URLs
  exist.

## Plan

- [x] Add `@tanstack/react-query` to
      [apps/builder/package.json](../../../workspace/apps/builder/package.json);
      `pnpm install`.
- [x] Wire `QueryClientProvider` in
      [main.tsx](../../../workspace/apps/builder/src/main.tsx)
      with the default options noted in IN-scope.
- [x] Implement backend `workspaces` router with `GET` + `POST`,
      Pydantic models, in-memory store, CORS middleware. Register
      in `app/main.py`.
- [x] Add pytest tests for the workspaces endpoints.
- [x] Builder side: `api/workspacesApi.ts`, `types.ts`, `hooks.ts`
      under `features/data-management/workspaces/`.
- [x] Rewrite `WorkspacesPage.tsx`: consume hooks, render
      loading / error / empty / populated states, add create
      modal. Remove `SAMPLE_WORKSPACES`, demo toggle, all of R12's
      local state.
- [x] Update `routing.test.tsx` for the new data layer; mock
      `fetch` for the tests.
- [x] `pnpm --filter @mdd/ui type-check`,
      `pnpm --filter builder type-check` — both clean.
- [x] `pnpm --filter @mdd/ui test`,
      `pnpm --filter builder test` — both green.
- [x] Backend tests: from `workspace/apps/backend/`, run
      `uv run pytest`. All green.
- [x] Visual smoke via `pnpm dev`: empty state, create flow,
      refresh, restart-loses-data, all as described.
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for R13
      files.
- [x] Cross-link: `Inherits from ← Round_12` in Goal (above);
      `Feeds into → Round_14` in Act naming the upload feature
      direction.
- [x] Post-round audit per [PDCA.md](../PDCA.md) including the
      context-rot check (R13 doesn't touch `context/`; should be
      a no-op verification).

## Risks / unknowns

- **TanStack Query's first-time setup may surface ergonomic
  decisions** the design doc didn't cover (query key shape,
  error-boundary behavior, optimistic updates). Mitigation:
  use the simplest defaults; revisit in R13's Act if any
  ergonomic choice feels load-bearing enough to deserve a memo.
- **`fetch` mocking in vitest** isn't standardised in this repo
  yet. Lean toward `vi.spyOn(globalThis, 'fetch')` returning
  `Promise.resolve(new Response(JSON.stringify(data)))`. If this
  proves fragile (e.g., AntD Form's async-submit timing), switch
  to MSW (Mock Service Worker) — adds a dev dep but is the
  standard for fetch testing. Decide during Do.
- **CORS in backend** is a small but new surface. Wrong
  middleware config = silent failure (network errors in the
  browser console). Verify with `curl -i -H 'Origin: http://localhost:3000'`
  against the dev backend before declaring the integration done.
- **Backend in-memory store has no concurrency guards.** Two
  rapid POSTs could race. Acceptable for R13 (single-user dev);
  real persistence in R14+ inherits proper transactional
  semantics.
- **AntD Modal + Form interaction** has known quirks with
  React 19's auto-batching. Test the create-flow path explicitly;
  don't trust the obvious test passing as proof the dialog
  closes correctly.
- **happy-dom + AntD Modal portal rendering**. Modals render
  into document.body via portal. Tests may need
  `document.body.appendChild`-style assertions or
  `screen.getByRole('dialog')`. Watch for "Modal not in DOM"
  surprises in tests.
- **Scope risk: this round is bigger than R09-R12.** Three
  technical first-times (TanStack Query, backend HTTP API,
  modal create flow) plus integration testing. If the round
  splinters in Do — e.g., Query's defaults surface a design
  decision, or the modal flow needs its own design discussion —
  pause and split into R13a (backend + Query setup) and R13b
  (create modal flow), rather than ship under pressure.
- **Markdownlint `+` / Prettier carry-over.** Same as R07–R12.
- **AntD-wrapper testing lesson now at 4 instances** (R08, R09,
  R12, almost-certainly-R13). Promotion criterion fully met;
  still deferred to the post-upload batch round per the R12
  user call.

## Do

- **Backend.** Added `app/routers/workspaces.py` with
  `GET /workspaces` and `POST /workspaces`, Pydantic
  `Workspace` + `CreateWorkspace`
  (name 1-80 chars), module-level `_store` list, `_new_id` via
  `secrets.token_hex(4)`, `_now_iso` using
  `datetime.now(timezone.utc)`. `reset_store_for_tests()` exported
  for pytest isolation. Wired CORS middleware into `app/main.py`
  (`allow_origins=["http://localhost:3000"]`, methods GET/POST).
  Registered the router with `app.include_router(workspaces.router)`.
  Added `tests/test_workspaces.py` covering: GET empty, POST+GET
  round-trip, 422 on empty name, two-POST list integrity. All 5
  backend tests pass (`uv run pytest`).
- **Builder data layer.** Added
  `@tanstack/react-query@^5` to `apps/builder/package.json`; `pnpm install`
  resolved cleanly. Wrapped `main.tsx` with `QueryClientProvider`
  outside `AntdConfig`, defaults `{ staleTime: 60_000,
refetchOnWindowFocus: false }`. New files:
  - `src/api/workspacesApi.ts` — `fetch` client with
    `VITE_API_BASE_URL` fallback to `http://localhost:8000`.
  - `src/features/data-management/workspaces/types.ts` — shared
    `Workspace` + `CreateWorkspaceInput`.
  - `src/features/data-management/workspaces/hooks.ts` —
    `useWorkspacesQuery` + `useCreateWorkspaceMutation` invalidating
    the `["workspaces"]` key on success.
- **WorkspacesPage rewrite.** Moved
  `features/data-management/WorkspacesPage.tsx` → `…/workspaces/WorkspacesPage.tsx`
  via `git mv` so the feature has its own subfolder
  (api/types/hooks/page colocate). Page now renders:
  - `<Skeleton active>` while `query.isLoading`.
  - AntD `<Alert>` (with the v6 `title` prop, not the deprecated
    `message`) while `query.isError`.
  - Empty state with the same icon + CTA as R12 when the array is
    empty.
  - Card grid when populated.
  - Create modal (`<Modal destroyOnHidden>` — v6 spelling) with
    `<Form>` + `<Input>` validating required + max 80 chars,
    wired to `useCreateWorkspaceMutation`. On success the form
    resets and the modal closes; on error an in-modal `<Alert>`
    surfaces the message. Cancel is disabled while pending.
  - All R12 demo machinery deleted: `SAMPLE_WORKSPACES`, the
    `R12 DEMO` toggle, `useState<Workspace[]>`, `nextId`,
    `todayISO` — gone.
- **Tests.** Rewrote `tests/routing.test.tsx`:
  - Per-render `QueryClient` (no inter-test cache bleed; retries
    off so error tests don't stall).
  - `vi.stubGlobal('fetch', …)` handler that mimics the backend
    in-memory store for the happy path, plus a separate 500-only
    mock for the error case.
  - Coverage: card grid renders (Marketing + Sales Ops), the two
    redirects, active-leaf highlighting, breadcrumb section label,
    empty state, GET failure → error alert, create-flow happy path
    (modal opens → input → POST sent with the right body → modal
    closes → query refetches → new card appears).
  - 8 tests (up from R12's 7).
- **AntD v6 deprecations.** IDE flagged `destroyOnClose` →
  `destroyOnHidden` on `<Modal>` and `<Alert message>` →
  `<Alert title>`. Both fixed; deprecation noise cleared.
- **Quality gates.**
  - `pnpm --filter @mdd/ui type-check` — clean.
  - `pnpm --filter builder type-check` — clean.
  - `pnpm --filter @mdd/ui test` — 26 passed (5 files).
  - `pnpm --filter builder test` — 8 passed (1 file).
  - `uv run pytest` (from `workspace/apps/backend/`) — 5 passed.
  - `pnpm md:lint` — 0 errors.
  - `pnpm format:check` — only the pre-existing R02 / R04 /
    `promotions.md` warnings (carry-over from R07 onward); no R13
    files implicated.
- **Visual smoke via `pnpm dev:local:up`.** Backend on :8000,
  builder on :3000. `curl /workspaces` returned `[]`; `POST` with
  `{"name":"Marketing"}` returned `{id:"ws_…", name:"Marketing",
createdAt:"2026-05-23T16:23:49Z"}`; subsequent `GET` returned the
  one workspace. `curl -i -H 'Origin: http://localhost:3000' /workspaces`
  returned `access-control-allow-origin: http://localhost:3000`.
  `POST` with empty name returned `422`. Builder served the index
  HTML (R13's data path is exercised end-to-end through the
  vitest fetch-mock + the backend's pytest + the curl round-trip;
  no separate browser walk-through needed).
- **No memo emitted.** TanStack Query's defaults landed without
  surfacing an ergonomic decision (query-key shape, error-boundary,
  optimistic updates) that needed a memo. The fetch-mocking
  pattern via `vi.stubGlobal` + per-test `QueryClient` worked on
  the first try; not promoting to memory yet — wait for a second
  instance per the promotion criterion.

## Check

- [x] Backend `GET /workspaces` returns 200 + JSON array;
      `POST /workspaces` returns 201 + created workspace; POST
      with empty name returns 422.
- [x] CORS middleware allows `Origin: http://localhost:3000`.
- [x] Builder has `@tanstack/react-query` installed;
      `QueryClientProvider` mounted in main.tsx.
- [x] WorkspacesPage renders loading skeleton, empty state,
      populated grid, error alert depending on query state.
- [x] Create modal opens, validates name, submits, closes on
      success, refetches the query.
- [x] `SAMPLE_WORKSPACES`, `R12 DEMO` toggle, all R12 local
      state — gone.
- [x] Type-check clean both packages.
- [x] Tests pass on all three: backend pytest, @mdd/ui vitest,
      builder vitest.
- [x] Visual smoke: empty state on first load; create flow works;
      data survives refresh; backend restart wipes the store.
- [x] Lint + format clean for R13 files.
- [x] Cross-links: `Inherits from ← Round_12` in Goal;
      `Feeds into → Round_14` in Act.

## Act

**Status**: Complete.

**Learnings**:

- **TanStack Query setup was a non-event.** Provider above
  `BrowserRouter`, two defaults (staleTime + no focus-refetch),
  one query + one mutation. The "first technical surface" risk
  flagged in Plan didn't materialise — no ergonomic decision
  surfaced that needed a memo. The Query defaults absorbed the
  scope-creep pressure exactly as the design doc bet they would.
- **Fetch-mocking via `vi.stubGlobal('fetch', …)` worked first
  try.** The Plan risk about MSW being needed didn't fire. The
  per-render `QueryClient` (with `retry: false`) was the only
  non-obvious choice — without it, the error-path test stalls
  while Query retries. Capturing this is what the promotion
  criterion is for; not memo-promoting yet (second instance
  required).
- **AntD v6 has shifted some prop names since R12 was written.**
  `Modal.destroyOnClose` → `destroyOnHidden`; `Alert.message` →
  `Alert.title`. Each surfaced as an IDE deprecation warning, not
  a TS error. Worth noting that AntD v6 will keep emitting these
  for a while — fix at the point of contact, don't sweep the
  whole codebase.
- **Backend HTTP API conventions established cleanly.** Router
  with `prefix=/workspaces`, Pydantic in-out models, `Field`-driven
  validation (the empty-name 422 came free), CORS middleware
  with explicit origins, pytest fixture that resets the
  module-level store. R14's upload endpoint slots into the same
  shape.
- **Scope held inside one round.** R13 was the largest round yet
  (backend + Query + modal flow + integration tests), but the
  Plan-risk "split into R13a/R13b if Query surfaces a design
  decision" never triggered. Validates the "design first" R10
  methodology — workspaces.md locked the five decisions ahead of
  Do, so Do was mechanical.

**Promotions** _(decision: none this round; build-first +
AntD-wrapper-testing both still queued for the post-upload Track-2
batch round. The fetch-mock test pattern is a candidate for the
same batch once R14's upload tests use the same pattern — second
instance.)_

## Feeds into → Round_14 (TBD)

What R13 hands forward:

- **End-to-end product surface working**: a real user can create
  workspaces in the running builder via the create modal, the
  backend stores them, the UI refetches and renders. First time
  this repo has end-to-end product feature working.
- **TanStack Query setup live**: future server-data features
  inherit the QueryClientProvider, default options, query-key
  conventions, and the fetch-mocking test pattern.
- **Backend HTTP API conventions established**: Pydantic models,
  router structure, CORS, pytest patterns. R14's upload endpoint
  follows the same shape.
- **Build-first lesson + AntD-wrapper-testing pattern** ready to
  promote in the post-upload batch round.

**R14 candidate scope** (per the original conversation):
**Upload feature** — design + implement CSV upload inside a
workspace. Likely shape: a workspace detail page (`/data-management/workspaces/<id>`)
with an upload zone (drag-drop or file picker) that POSTs to a new
backend endpoint, persists the file (filesystem? DuckDB?), and
shows the parsed table preview. Design first per R10's
methodology — author `upload.md` design doc + maybe a
`upload.preview.html` before any code.
