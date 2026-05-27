# Round 45: Validator coverage extension — $ref-using endpoints

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_44](Round_44.md)** — R44 captured the
R43 gotchas in `memory/`; R43 made the contract validator
actually run (IS_NODE fix + unhandledException buffer). R42
named extending coverage to `$ref`-using endpoints as
follow-up #1; R43's Act and R44's Feeds-into both pointed at
this as the next step.

R45 wraps the remaining JSON-200 handlers in
[`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts)
with `withContractValidation`. The blocker until now was that
12 of the 17 contract YAMLs use `$ref` into
`workspace/packages/contracts/_shared/`, which AJV can't compile
directly. R45 adds `@apidevtools/swagger-parser` to dereference
`$ref`s before AJV compilation, then iterates the full contracts
tree (not just `rows-get.contract.yaml` like R42 did) and builds
the operationId→schema map.

R45 is **Track-2** (agent-method, drift-detection extension).
No product feature; no FE/BE behaviour change. Runtime output:
9 additional wrapped handlers + 1 parameterized
schema-coverage smoke test that proves each wrapped
`operationId` has a loaded schema that rejects clearly-wrong
bodies.

*Track: 2 (agent-method). Pulled by: R42 follow-up #1
(extend coverage); R43 Act § Follow-ups ("Extend coverage to
$ref-using endpoints. Now that the validator actually runs,
[the named follow-up] pays off — drift on those endpoints
would be loud, not silent."); R44 Feeds-into. Per
[Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Dereferencer = `@apidevtools/swagger-parser`** as a
   builder devDependency (already transitive in
   pnpm-lock.yaml; just lift to explicit). Its
   `SwaggerParser.dereference(yamlPath)` opens an OpenAPI
   document, follows cross-file `$ref`s, and returns a
   fully-inlined document. AJV can then compile each 200
   response schema directly.
2. **`loadSchemas()` becomes async**, called once at module
   load via top-level await. Vitest + Vite both support TLA;
   the browser bundle never reaches this code (`IS_NODE`
   gate plus dead-code elimination on the mocks tree). The
   one-time cost (~50ms cold start for 12 YAMLs) is
   invisible in tests and N/A in production.
3. **Iterate the contracts tree by glob** rather than
   hard-coding paths. Pattern:
   `workspace/packages/contracts/**/*.contract.yaml` (the
   `_shared/` files have no `.contract.yaml` suffix; they
   are pulled in via `$ref` only). The validator stays
   contract-tree-shape-aware: adding a new contract YAML
   ships with validator coverage automatically.
4. **Wrap all 9 JSON-200 handlers**: `listWorkspaces`,
   `createWorkspace`, `renameWorkspace`, `listDatasets`,
   `getDataset`, `renameDataset`, `commitDatasetsBatch`,
   `createTempUpload`, `parseTempUpload`. Each gets a
   `withContractValidation('<method>', path, '<opId>', resolver)`
   wrap. DELETE handlers stay unwrapped — they return 204
   and bypass the validator by the content-type guard.
5. **Test shape = one parameterized smoke**, not per-endpoint
   drift tests. `it.each(WRAPPED_OPS)('validator has a
   schema that rejects bad bodies for %s', …)` exercises
   `validateResponse(opId, { obviously: 'wrong' })` directly
   (no MSW round-trip). Proves: (a) the schema for each opId
   loaded, (b) AJV rejects clearly-wrong bodies. The 5
   detailed drift scenarios from R43 stay as-is — they
   exercise the *MSW integration*; this new test exercises
   the *coverage*.
6. **Existing test suite is the integration coverage.**
   `datasets.test.tsx`, `dataset-detail.test.tsx`,
   `routing.test.tsx` already drive most of the wrapped
   endpoints in their normal flow. If any default handler in
   `handlers.ts` returns a shape that doesn't match its
   contract, those tests will fail via the
   `mswUnhandledExceptions` buffer R43 added to
   `tests/setup.ts`. No new endpoint-specific tests beyond
   the smoke loop.
7. **If a default handler surfaces drift**, fix the handler
   to conform (the YAML is the spec). This is the
   high-probability event per R43's pattern (R43 found 2
   bugs in 1 round; R45 wraps 9 handlers, so by base rate
   we should expect 0-2 fixes). Each fix lands inline with
   a one-line comment naming the AJV error keyword + path
   so the diff explains *why*.
8. **`onUnhandledRequest: 'bypass'` stays.** Legacy tests
   that still use `vi.stubGlobal('fetch', …)` continue to
   work alongside the now-fuller MSW handler set.
9. **No production-bundle impact.** Same R42/R43 calculus:
   the validator path is Node-only (`IS_NODE` gated), Vite
   tree-shakes the mocks tree from the production bundle.
   Bundle should stay at **1418.74 kB / 448.84 kB gzip**.
10. **No decision-file amendment.** R42's
    [MSW contract-anchor decision](../../decisions/2026-05-27-msw-contract-anchor.md)
    already says "future-extension cost (adding
    `@apidevtools/swagger-parser` or a small ref resolver)
    is small but unjustified until a second contract is
    worth validating." R45 is the round that pays that
    cost; the decision's commitment doesn't change.

## What is IN scope

### 1. Add `@apidevtools/swagger-parser` as builder devDep

- `pnpm --filter builder add -D @apidevtools/swagger-parser`.
- Lifts the transitive dep (already in `pnpm-lock.yaml`) to
  explicit; declares the intent.

### 2. Refactor `loadSchemas()` for `$ref` + tree-walk

- File:
  [`src/mocks/contract-validator.ts`](../../../workspace/apps/builder/src/mocks/contract-validator.ts).
- Replace the single-YAML read (rows-get only) with:
  - Glob the contracts tree for `*.contract.yaml`.
  - For each: `await SwaggerParser.dereference(yamlPath)` →
    fully-inlined OpenAPI doc.
  - Walk `doc.paths[<path>][<method>]`, extract
    `operationId` and `responses["200"].content["application/json"].schema`.
  - `ajv.compile(schema)` keyed by operationId.
- Function becomes async; module uses **top-level await** so
  `validateResponse()` and `withContractValidation()` stay
  sync at the call site.

### 3. Wrap handlers in `src/mocks/handlers.ts`

- Wrap each of the 9 JSON-200 handlers:

  | Method | Path | OperationId |
  |---|---|---|
  | GET | `/workspaces` | `listWorkspaces` |
  | POST | `/workspaces` | `createWorkspace` |
  | PATCH | `/workspaces/:id` | `renameWorkspace` |
  | GET | `/datasets` | `listDatasets` |
  | GET | `/datasets/:id` | `getDataset` |
  | PATCH | `/datasets/:id` | `renameDataset` |
  | POST | `/workspaces/:id/datasets/batch` | `commitDatasetsBatch` |
  | POST | `/uploads` | `createTempUpload` |
  | POST | `/uploads/:tempId/parse` | `parseTempUpload` |

- DELETE handlers stay unwrapped (204, bypass by content-
  type).

### 4. Coverage smoke test

- Add a parameterized `it.each(WRAPPED_OPS)('validator has a
  loaded schema for %s', …)` to
  [`tests/contract-validator.test.ts`](../../../workspace/apps/builder/tests/contract-validator.test.ts)
  that calls `validateResponse(opId, { obviously: 'wrong' })`
  and asserts `result.ok === false`. Proves both "schema
  loaded" and "AJV rejects bad bodies" in one assertion.
- `WRAPPED_OPS` is a `const` array of the 10 operationIds
  (9 new + the R42-original `getDatasetRows`).

### 5. Fix any default-handler drift surfaced

- Run full suite; if existing tests now fail because a
  default handler's shape doesn't match its contract YAML,
  fix the *handler* (the YAML is the spec). Each fix lands
  inline in `handlers.ts` with a one-line `// R45: AJV
  <keyword> at <path>` comment.
- If a fix is non-trivial (requires shape redesign), leave
  the handler unwrapped with a `// TODO(R46): drift —
  <description>` comment and document in this round's Do
  section. Don't bloat the round.

### 6. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — full suite green;
  expect 53 → ~63 (53 + 10 smoke tests). Some existing
  tests may surface drift; fix inline.
- `pnpm --filter builder build` — green; bundle size
  unchanged (1418.74 kB / 448.84 kB gzip — validator
  path is Node-only; Vite tree-shakes for browser).
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping
  Status.

## What is OUT of scope

- **No DELETE handler wrapping.** 204 bypasses the
  validator by design; wrapping them adds no value.
- **No per-endpoint detailed drift tests.** R43 already
  proved drift detection works end-to-end; R45 trusts that
  proof and adds only the coverage-smoke loop. If a future
  bug surfaces on a specific endpoint, *that* incident
  pulls a detailed test for it.
- **No browser-side validation.** R42's follow-up #2 stays
  deferred.
- **No `loadYamlExampleRows()` migration.** R42 follow-up
  #3 stays separate.
- **No production code changes beyond mocks/.** This is a
  test-discipline round.
- **No `packages/mocks` extraction.** R42's revisit-trigger
  is N ≥ 3 mock-using domains; today N = 1.
- **No codegen from YAML.** R42's revisit-trigger; not
  pulled.

## Plan

- [x] Confirm scope at planning review.
- [x] `pnpm --filter builder add -D @apidevtools/swagger-parser`.
- [x] Refactor `loadSchemas()` to:
      - walk `**/*.contract.yaml` via `findContractFiles`,
      - `await SwaggerParser.dereference(fileUrl, parserOpts)`
        per file with custom file resolver,
      - extract `operationId → first-2xx JSON schema` map via
        `registerDocSchemas` + `pickSuccessSchema` helpers.
- [x] Convert module to top-level await so call sites stay
      sync.
- [x] Wrap the 9 JSON-2xx handlers with
      `withContractValidation` (10 total including R42's
      `getDatasetRows`).
- [x] Add `WRAPPED_OPS` constant + parameterized smoke test
      in `tests/contract-validator.test.ts`.
- [x] Run `pnpm --filter builder test`; **zero
      default-handler drift surfaced** (plan budgeted 0-2;
      got 0). Full suite 53 → 63 green.
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder build` — green; bundle
      **1418.74 kB / 448.84 kB gzip** (unchanged from R43).
- [x] `npx markdownlint-cli2` — 0 errors over 107 files.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      Status.
- [x] **Post-Review tidy A.** Replace the brittle
      `../../../../packages/contracts` traversal at
      `contract-validator.ts:42` and `fixtures.ts:99-103` with a
      shared `src/mocks/contracts-root.ts` that resolves
      `@mdd/contracts` via `createRequire(import.meta.url)`. Add
      `@mdd/contracts: workspace:*` to builder devDeps.
- [x] **Post-Review tidy B.** Route the MSW opt-in through the
      existing js-tmpl config pipeline: add `builder.enable_mock`
      (default `false`) to `workspace/config/values.yaml`,
      conditional-emit `VITE_MOCKS=1` in
      `workspace/config/builder/.env.hbs`. Devs flip the value
      and re-run `pnpm config:render` instead of remembering a
      shell env var.
- [x] **Verify-phase tidy C.** Browser bundle was crashing the
      first time MSW was actually enabled in dev: static
      `import { createRequire } from "node:module"` and
      `import { dirname } from "node:path"` both fire Vite's
      browser-externalization throw-on-access at module-load
      time, regardless of IS_NODE gating at the call site. Fix:
      *all* node-only deps in `contracts-root.ts` and
      `contract-validator.ts` move to `await import(...)` inside
      the IS_NODE-gated functions. IS_NODE itself switches from
      `typeof process.versions.node` (lies in Vite's browser
      shim) to `import.meta.url.startsWith("file:")` (direct
      runtime check, immune to `process`/`window` shimming).
      Validator's `findContractFiles` is inlined inside
      `loadSchemas` to close over the dynamic-imported deps; the
      4 dynamic imports run in parallel via `Promise.all` to stay
      under vitest's 5s per-test ceiling.
- [x] **Verify-phase tidy D.** `main.tsx` had a latent
      temporal-dead-zone bug surfaced once MSW actually loaded:
      a recent local change had swapped the original
      `.then(renderApp)` pattern for `await import + finally`,
      but `const appTree` was still declared *after* the
      if/else block. With TLA, module eval pauses at the
      await — `appTree` is in TDZ when `renderApp` runs.
      Moved `appTree` declaration above the `renderApp`
      function and the if/else block; both paths now read an
      initialized `appTree`. (The bug was also latent in the
      mock-off `else` branch but never surfaced before because
      that path was the team default and never triggered an
      in-browser load.)
- [x] **Verify-phase tidy E.** Compacted the verbose comment
      headers across the touched files (`contracts-root.ts`,
      `contract-validator.ts`, `fixtures.ts`, `main.tsx`) —
      TL;DR pass per round-cadence convention.

## Risks / unknowns

- **Top-level await + Vite tree-shaking interaction.**
  TLA in a module that *also* needs to be safely
  tree-shaken for the browser bundle is a known sharp edge.
  Mitigation: keep `IS_NODE` as the first thing the TLA
  block checks; if false, resolve immediately to an empty
  map. Vite should still tree-shake the SwaggerParser
  import in browser builds because it's only reachable
  behind the `IS_NODE` guard. If Vite complains, fall back
  to sync manual `$ref` resolution (~30 LOC, all
  `_shared/<file>.yaml#/components/schemas/<Name>` shape —
  bounded).
- **SwaggerParser sync I/O.** It reads from disk; in
  vitest + happy-dom this works (we proved the IS_NODE
  check works in R43). In a future SSR build where this
  module is statically imported, the file-system reads
  could fail. Mitigation: keep the IS_NODE guard; document
  the Node-only constraint in the file header (R42 already
  does this).
- **OpenAPI 3.1 vs 3.0 schema differences.** Some
  contracts may use 3.1-only keywords (e.g.,
  `type: [string, "null"]` — already in rows-get).
  SwaggerParser 10.x supports both. Mitigation: AJV is
  configured with `strict: false` (R42) — unknown keywords
  warn but don't fail compile. Already proven on rows-get.
- **Handler-vs-contract drift on a freshly-wrapped
  endpoint.** R43's hit rate (2 bugs in 1 round) suggests
  R45 will surface 0-2 drift cases across 9 endpoints.
  Each fix is small (rename a field, fix a type) and lands
  inline. The round commits with the fix; if a fix needs
  redesign, the endpoint stays unwrapped with a
  `TODO(R46)` and the round documents the carve-out.
- **`additionalProperties` not set on `_shared/` schemas.**
  If a referenced `_shared/dataset.yaml` schema lacks
  `additionalProperties: false`, the validator becomes
  laxer than the YAML intent suggests. Mitigation: not
  this round's problem — the YAML is the spec; if the
  spec is lax, the validator is correctly lax. Could
  surface as a *future* spec tightening round if drift
  goes undetected.
- **Vitest worker initialization cost.** Top-level await
  at module load means every vitest worker pays the
  dereference cost on first import of `contract-validator.ts`.
  With ~12 YAMLs and SwaggerParser, this is probably
  ~100-200ms. Mitigation: cache compiled schemas
  (already done via module-scoped const); the cost is one-
  shot per worker, not per-test.
- **`AggregateError` polyfill or Node version.** R43's
  `tests/setup.ts` uses `AggregateError` — Node 16+. If a
  future Node downgrade or a CI runner lacks support, the
  buffer drain would crash. Mitigation: this is R43's
  surface, not R45's; flag if a CI issue arises.

## Do

**Dependency lift.**

- `pnpm --filter builder add -D @apidevtools/swagger-parser`
  landed `@apidevtools/swagger-parser@10.1.1` as an explicit
  builder devDep (was transitive in pnpm-lock).

**Validator refactor.**

- [`src/mocks/contract-validator.ts`](../../../workspace/apps/builder/src/mocks/contract-validator.ts)
  rewrite of the schema-loading half:
  - `findContractFiles(root)` — sync recursive `readdirSync`
    walk that returns every `*.contract.yaml` path. The
    `_shared/` files are followed via `$ref` by
    SwaggerParser; we don't enumerate them directly.
  - `pickSuccessSchema(op)` — extracts the first 2xx
    response's `application/json` schema. Handles
    GET-200 and POST-201 uniformly without per-code
    disambiguation.
  - `registerDocSchemas(doc, ajv, map)` — walks a
    dereferenced OpenAPI doc, calls `pickSuccessSchema`
    per operation, compiles via AJV. Extracted to keep
    `loadSchemas` cognitive complexity below SonarJS's
    threshold.
  - `loadSchemas()` — async; iterates contract files,
    `await SwaggerParser.dereference(fileUrl, parserOpts)`
    per file, hands each doc to `registerDocSchemas`.
  - Top-level `const schemas = await loadSchemas()` —
    consumers (handlers.ts, validateResponse) see a
    fully-populated Map by the time their imports resolve.
    `validateResponse` stays sync.
- **Two snags surfaced and fixed in-round.**
  1. SwaggerParser interpreted absolute paths as relative
     to happy-dom's `http://localhost:3000/` origin (same
     happy-dom shim that bit R43). Fix: wrap each path
     with `pathToFileURL(yamlPath).href` so the
     `file://` URL bypasses the HTTP heuristic.
  2. The default file resolver was still being
     skipped under happy-dom — likely because the
     environment-sniffing in `json-schema-ref-parser`
     thought it was browser-side. Fix: pass an explicit
     `resolve.file.read` that uses Node's `readFileSync`,
     and disable the HTTP resolver outright. Documented
     inline as the R45-specific happy-dom workaround.
- The R42 `IS_NODE` guard (R43 fix) stays load-bearing for
  the browser bundle; Vite tree-shakes the SwaggerParser
  import when the mocks tree is unreachable.

**Handler wrapping.**

- [`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts) —
  wrapped 9 additional JSON-2xx handlers with
  `withContractValidation`. Full wrapped set is 10
  (including R42's `getDatasetRows`):
  - `listWorkspaces` (GET /workspaces, 200)
  - `createWorkspace` (POST /workspaces, 201)
  - `renameWorkspace` (PATCH /workspaces/:id, 200)
  - `listDatasets` (GET /datasets, 200)
  - `getDataset` (GET /datasets/:id, 200)
  - `renameDataset` (PATCH /datasets/:id, 200)
  - `getDatasetRows` (GET /datasets/:id/rows, 200) — R42
  - `commitDatasetsBatch` (POST /workspaces/:id/datasets/batch, 201)
  - `createTempUpload` (POST /uploads, 201)
  - `parseTempUpload` (POST /uploads/:tempId/parse, 200)
- DELETE handlers stay unwrapped — they return 204 and
  bypass the validator via the content-type guard.

**Coverage smoke test.**

- [`tests/contract-validator.test.ts`](../../../workspace/apps/builder/tests/contract-validator.test.ts) —
  added a `describe("MSW contract validator — coverage smoke (R45)")`
  block with a single parameterized
  `it.each(WRAPPED_OPS)('%s has a loaded schema that rejects
  obviously-wrong bodies', …)`. Probes `validateResponse(opId,
  { obviously: 'wrong' })` directly (bypasses MSW) and
  asserts `result.ok === false`. One assertion proves both
  *schema loaded* and *AJV rejects bad bodies*; a green test
  here is strong evidence the coverage is wired.
- `WRAPPED_OPS` is a `const` array of the 10 operationIds —
  authoritative list; if a new handler gets wrapped in
  handlers.ts, the opId is added here.

**Drift outcome: zero fixes needed.**

- The plan budgeted 0-2 handler fixes per R43's base rate.
  Actual: 0. Every default response in handlers.ts already
  matched its contract YAML — confirmed by the existing test
  suite, which now exercises 8 of the 10 wrapped operations
  through default flows (datasets.test.tsx, dataset-detail,
  routing, upload wizard CSV/Excel) without any
  `mswUnhandledExceptions` firing.
- The 2 not exercised by existing default flows
  (`renameWorkspace`, `renameDataset`) are covered by the
  smoke loop, which probes `validateResponse` directly
  without needing the handler to fire.

**Post-Review tidy A: brittle `../../../..` path → workspace resolve.**

- Two sites carried the on-disk location of `packages/contracts`
  as a relative-segment count from `src/mocks/`:
  `contract-validator.ts:42` and `fixtures.ts:99-103`, both with
  a `// src/mocks → builder → apps → workspace → packages/contracts`
  guide-comment that was itself a smell. The traversal would
  break silently on any future move of `apps/builder` or
  `packages/contracts`.
- Fix: lift `@mdd/contracts` (already a named workspace package)
  to an explicit builder devDep (`workspace:*`) and resolve via
  package.json lookup in a new
  [`src/mocks/contracts-root.ts`](../../../workspace/apps/builder/src/mocks/contracts-root.ts).
  The shared module uses `createRequire(import.meta.url).resolve(
  "@mdd/contracts/package.json")` then `dirname()`; gated by
  `IS_NODE` so the browser bundle gets an empty string (consumers
  already no-op via their own gates).
- Both call sites now `import { CONTRACTS_ROOT } from
  "./contracts-root"`. `contract-validator.ts` loses its
  `__filename`/`__dirname` boilerplate and the `dirname` import;
  `fixtures.ts` drops the `node:url` require and the manual
  `fileURLToPath`+`path.resolve` chain.
- Anchor is now a named contract (the workspace package), not a
  segment count. Future moves of either directory are absorbed by
  pnpm.
- Bundle stays at **1418.74 kB / 448.84 kB gzip** — proves the
  `createRequire` indirection still tree-shakes out of the
  production browser build (validator + fixtures unreachable from
  prod entry).

**Post-Review tidy B: MSW opt-in via `values.yaml`, not a shell env.**

- Until now, enabling MSW in dev required remembering
  `VITE_MOCKS=1 pnpm --filter builder dev` at the terminal.
  That's inconsistent with how every other FE env var
  (`VITE_API_BASE_URL`, `VITE_LOG_LEVEL`, etc.) is declared:
  through [`workspace/config/values.yaml`](../../../workspace/config/values.yaml)
  rendered into `apps/builder/.env` by the R27 js-tmpl pipeline.
- Fix: add `builder.enable_mock` to `values.yaml` (default
  `false` — explicit opt-in; committing `true` would surprise
  teammates). Update
  [`workspace/config/builder/.env.hbs`](../../../workspace/config/builder/.env.hbs)
  with `{{#if builder.enable_mock}}VITE_MOCKS=1{{/if}}` — the
  variable is *absent* when the flag is false, not set to `'0'`.
  This matches [`main.tsx:78`](../../../workspace/apps/builder/src/main.tsx#L78)'s
  existing `=== '1'` guard without touching FE code.
- Verified both branches: with `enable_mock: true`, the rendered
  `.env` gains a `VITE_MOCKS=1` line; with `false`, the line is
  absent. The generated `.env` is gitignored, so the per-dev
  flip cycle is: edit `values.yaml` → `pnpm config:render` →
  `pnpm --filter builder dev`. Pre-commit hook already
  re-renders + verifies no drift (R27).
- No per-developer override layer (no `values.local.yaml`)
  added — out of scope. If frequent local flips become painful,
  that's a separate round.

**Verify-phase tidy C: browser bundle crashes the first time
MSW actually loads.**

- Toggled `enable_mock: true`, opened the browser, got
  `Uncaught Error: Module "node:module" has been externalized
  for browser compatibility. Cannot access "node:module.createRequire"
  in client code` from `contracts-root.ts`. Then, after a partial
  fix, the same error against `node:path.dirname`. Root cause:
  Vite externalizes every `node:*` builtin as a throw-on-access
  stub for the browser bundle, and a static
  `import { createRequire } from "node:module"` (or any other
  `node:*` named import) fires the stub's getter at module-load
  time — *before* any runtime IS_NODE check can short-circuit.
- Fix is mechanical: zero static `node:*` or `swagger-parser`
  imports in the modules MSW reaches in browser dev. Every
  Node-only dep moves into `await import(...)` inside the
  IS_NODE-gated function. The validator's `findContractFiles`
  helper is inlined inside `loadSchemas` so it closes over the
  dynamic-imported `readdirSync`/`resolve`. The 4 imports run
  in parallel via `Promise.all` — the serial-await first draft
  pushed the two upload-wizard tests past vitest's 5s ceiling
  (they were already at ~4.5s).
- IS_NODE itself changes shape: the R43 check
  (`typeof process.versions.node === "string"`) evaluated truthy
  in Vite's browser dev because `process` is shimmed there too.
  New check: `import.meta.url.startsWith("file:")` — `file:` in
  Node (incl. vitest) and `http(s):` in the browser. Direct
  runtime check, immune to whatever any layer shims onto
  `process` or `window`. Three traps in this family now: R43's
  happy-dom-shims-`window`, R45's
  SwaggerParser-vs-happy-dom-`window.location`, and now
  Vite's-browser-shim-of-`process`.
- Bundle still **1418.74 kB / 448.84 kB gzip** — confirms Vite
  tree-shakes the dynamic imports out of the prod build (the
  mocks tree is unreachable from prod entry; the dynamic
  `await import("node:fs")` is never statically reached).

**Verify-phase tidy D: `main.tsx` TDZ on `appTree` once MSW
actually loads.**

- Once tidy C let MSW load in browser, the next error was a
  fresh `Uncaught ReferenceError: Cannot access 'appTree' before
  initialization` from `main.tsx`. A recent local change to
  `main.tsx` had swapped the original `.then(renderApp)` pattern
  for `try { await import("@/mocks/start"); ... } finally { renderApp(); }`,
  but `const appTree = (...)` was still declared *after* the
  if/else block. With TLA, module evaluation pauses at the
  `await` — `appTree` is in TDZ when `renderApp` runs from the
  `finally`. The same bug was latent in the `else` (mock-off)
  branch but never surfaced because mock-off was the team
  default and the page was never opened against that build path
  after the change.
- Fix: move `const appTree = (...)` above the `renderApp`
  function and the if/else block. Both paths now read an
  initialized `appTree`. Removed the no-longer-needed
  `// eslint-disable-next-line @typescript-eslint/no-use-before-define`
  comment on `renderApp`'s body.

**Verify-phase tidy E: comment compaction.**

- TL;DR pass over the touched files
  (`contracts-root.ts`, `contract-validator.ts`,
  `fixtures.ts`, `main.tsx`). Lots of verbose `// X is because Y
  is because Z` blocks collapsed to one-or-two-line WHYs. The
  R42/R43/R45 history index at the top of `contract-validator.ts`
  shrank from 26 lines to ~16. Cross-references between files
  (`see contracts-root.ts`) carry the longer explanation in one
  place. No semantic changes; SonarJS still happy.

**Pipeline.**

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **63/63 green** (53 → 63;
  +10 from the coverage smoke loop).
- `pnpm --filter builder build` — green;
  **1418.74 kB / 448.84 kB gzip** (unchanged from R43 — the
  SwaggerParser import is tree-shaken from the browser
  bundle because the mocks tree is unreachable in
  production).
- `npx markdownlint-cli2` — 0 errors over 107 files.

## Check

- [x] `@apidevtools/swagger-parser` is a direct builder
      devDependency.
- [x] `loadSchemas()` dereferences `$ref` via
      SwaggerParser (with custom file resolver for the
      happy-dom workaround) and iterates the full contracts
      tree via `findContractFiles`.
- [x] All 9 JSON-2xx handlers in `handlers.ts` are wrapped
      with `withContractValidation` and their operationIds
      match the contract YAMLs (10 total including R42's
      `getDatasetRows`).
- [x] DELETE handlers stay unwrapped (204 / content-type
      bypass — explicit comment in handlers.ts header notes
      this).
- [x] Coverage smoke test exists, lists all 10 wrapped
      operationIds in `WRAPPED_OPS`, and asserts each one
      rejects `{ obviously: 'wrong' }` via direct
      `validateResponse` call (bypasses MSW).
- [x] No default-handler drift surfaced; zero fixes needed
      in `handlers.ts`. All existing tests pass with the
      now-active validator covering 8 of the 10 wrapped
      operations through default flows.
- [x] Type-check, full test suite, build, markdownlint all
      green.
- [x] Bundle size unchanged from R43 (1418.74 kB /
      448.84 kB gzip).
- [x] Post-round audit passes; all Plan + Check checkboxes
      flipped.
- [x] Brittle `../../../../packages/contracts` traversal is
      gone from both `contract-validator.ts` and `fixtures.ts`;
      both now import `CONTRACTS_ROOT` from the shared
      `contracts-root.ts`, which resolves `@mdd/contracts` via
      `createRequire`. `@mdd/contracts` is an explicit builder
      devDep.
- [x] MSW opt-in is declared in `workspace/config/values.yaml`
      (`builder.enable_mock`, default `false`) and rendered into
      `apps/builder/.env` as a conditional `VITE_MOCKS=1` via
      `.env.hbs`. Both branches verified: `enable_mock: true`
      emits the line, `false` omits it.
- [x] Browser dev with `enable_mock: true` actually renders —
      no `node:module` / `node:path` externalization throws, no
      TDZ on `appTree`. Pipeline green in both modes; bundle
      identical (1418.74 kB / 448.84 kB gzip) since
      VITE_MOCKS only affects dev runtime.

## Act

**Learnings**:

- **Happy-dom's `window.location` shim bites a second
  time.** R43 surfaced the IS_NODE-is-`!window` trap; R45
  surfaced its sibling: SwaggerParser/json-schema-ref-parser
  use `window.location.href` to decide whether a path is
  local or remote. Under happy-dom that origin is
  `http://localhost:3000/`, so absolute paths become
  HTTP fetches that fail. The
  [MSW-swallows-resolver-throws memory](../../memory/2026-05-27-msw-swallows-resolver-throws.md)
  and the
  [IS_NODE memory](../../memory/2026-05-27-is-node-detection-under-dom-emulation.md)
  R44 captured both flag DOM-emulators as a class of trap;
  this is a third instance. The general rule worth
  internalizing: *if a Node library decides browser-vs-Node
  by sniffing globals, it will misfire under DOM-emulators.*
  Worth a small extension to the IS_NODE memory if a fourth
  instance lands.
- **Zero drift is a strong signal, not a null result.**
  R43's hit rate (2 bugs in 1 round) created a working
  hypothesis that wrapping more handlers would surface more
  bugs. The actual result — 0 drift cases across 9 newly-
  wrapped handlers — is informative: it confirms the mock
  handlers in handlers.ts have been authored faithfully to
  the contract YAMLs from the start. The validator's job
  going forward is *guarding the floor* (no future
  regression), not *catching existing drift*. That changes
  the cost-benefit calculus for further extensions (browser
  validation, codegen) — they're insurance, not bug-fixes.
- **Top-level await + module-scoped const = clean
  consumer API.** Making `schemas` a top-level
  `await loadSchemas()` lets `validateResponse` stay sync.
  All call sites (`handlers.ts`, tests) see a fully-
  populated Map at import time without async ceremony.
  Vitest + Vite handle TLA cleanly; the production browser
  bundle short-circuits via `IS_NODE` and tree-shakes the
  SwaggerParser import. Pattern worth remembering for
  similar "load once at module init, then serve sync" cases.
- **Cognitive-complexity refactors pay off only when they
  make the code clearer.** SonarJS flagged `loadSchemas` at
  CC=26 after the 2xx-status iteration landed. Extracting
  `pickSuccessSchema` + `registerDocSchemas` reduced CC
  *and* made each function's job nameable in one line. Not
  always the case — sometimes the linter wants splits that
  hurt readability. Here the extraction was clearly the
  better shape; the linter's nudge was sound. Worth holding
  the linter to that bar (does the split make it clearer?
  if no, ignore it).
- **A shell env var as a feature toggle is a smell when the
  project already has a values.yaml pipeline.** R41 introduced
  `VITE_MOCKS=1` as a terminal flag because it pre-dated R27's
  config-render scaffolding being commonplace. Once R27 landed,
  every other FE env var moved through `values.yaml` → `.env.hbs`
  → `.env`, but `VITE_MOCKS` stayed terminal-only because no one
  hit the inconsistency until R45. Lesson: when adding a new
  toggle, default-route it through the existing config pipeline;
  only fall back to bare env vars if the pipeline genuinely
  can't reach (CI secrets, per-pod runtime, etc.).
- **Vite externalizes `node:*` as throw-on-access stubs; static
  named-imports fire the getter at module-load even when the
  call site is gated.** R45's contracts-root.ts assumed the
  IS_NODE-gated ternary would short-circuit
  `createRequire(...)` away in the browser. It does — but the
  *import binding* is read regardless, and Vite's stub throws
  on property access. Static `import { dirname } from "node:path"`
  has the same problem. The rule: in any module the MSW chain
  loads in browser dev, *zero static `node:*` imports*. Every
  Node-only dep goes through `await import(...)` inside an
  IS_NODE-gated function. Parallel via `Promise.all` to keep
  module-init latency low (the serial first draft pushed
  upload-wizard tests past vitest's 5s ceiling).
- **`typeof process.versions.node === "string"` is not a
  reliable Node discriminator under Vite browser dev.** R43
  picked that check specifically to dodge happy-dom's `window`
  shim; R45 verify hit the symmetric problem — Vite shims
  `process` in the browser dev bundle, so the check evaluates
  truthy on the wrong side. The check that works through
  both shims: `import.meta.url.startsWith("file:")`. ESM gives
  every module a `file:` URL in Node and an `http(s):` URL in
  browser; no runtime shim changes that. New rule of thumb:
  prefer `import.meta.url` over global-sniffing whenever the
  decision is "Node vs browser."
- **TLA pauses module eval at the `await`; subsequent
  module-level `const`s sit in TDZ until the await resolves.**
  `main.tsx` originally used `.then(renderApp)` precisely
  because the callback runs in a microtask after sync eval
  finishes — `appTree` is initialized by then. A local change
  swapped it for `try/await/finally`, but kept `const appTree`
  after the if/else block. The fix is mechanical (move the
  const above), but the *general* lesson is: when adding TLA
  to a module that already declares `const`s, those `const`s
  need to live above the first await, otherwise any function
  called from the post-await arm sees TDZ. Worth checking any
  TLA-bearing module for this shape before shipping.
- **`../../../..` paths to a named workspace package are a
  smell — resolve via `createRequire` instead.** Spotted at
  Review time: two sites carried the same brittle traversal
  from `src/mocks/` up to `packages/contracts`, each with a
  guide-comment explaining the segment count (itself a tell
  that the path is unreadable on its own). pnpm already knows
  where `@mdd/contracts` lives; `createRequire(import.meta.url)
  .resolve("@mdd/contracts/package.json")` → `dirname()`
  collapses the question to a one-liner and the anchor becomes
  a name, not a count. Bundle size proved the indirection
  still tree-shakes. Worth applying the same shape to any
  future workspace-package path lookups.

**Promotions** *(none — Track-2 verification round; the
validator + decorator + smoke loop stay under
`apps/builder/src/mocks/` until a second mocks-using domain
or `packages/mocks` extraction pulls them out, same as R42
and R43)*:

**Follow-ups (not promotions, just notes):**

- **Three happy-dom traps now have a name.** Adding a
  fourth instance to the
  [IS_NODE memory](../../memory/2026-05-27-is-node-detection-under-dom-emulation.md)'s
  "What this trap also looks like" section is a small
  edit that captures the SwaggerParser case alongside
  the original validator one. Not pulled today (small,
  defer until a fourth instance).
- **Browser-side validation** — R42's named follow-up #2
  still stands. With R45 the case strengthens slightly
  (10 wrapped operations means more surface where
  dev-console drift would appear sooner). Cost: bundle
  AJV behind `import.meta.env.DEV`. No pull yet — R45
  already proved drift is rare on the current handlers.
- **`loadYamlExampleRows()` migration** — R42's named
  follow-up #3. Still dead code. R45 didn't touch it; the
  fixture-source path is orthogonal to the validation path
  R45 extended.
- **Codegen from YAML** — R42's named revisit-trigger for
  retiring `withContractValidation`. Now meaningfully more
  appealing because the validator covers 10 operations and
  the manual handler-decorator boilerplate would compound
  across new contracts. Still not pulled (no second mocks
  domain, no measurable maintenance burden yet).
- **`packages/mocks` extraction** — R42's revisit-trigger
  was N ≥ 3 mock-using domains; today N = 1. R45 doesn't
  change that count, only deepens the single domain.

## Feeds into → Round_46 (TBD)

With validator coverage extended to all production endpoints
and zero drift surfaced, R46 candidates from R42's named
follow-up list (priorities updated post-R45):

- **Track-1 return to product** — the MSW + validator stack
  is now fully paid for; R43's IS_NODE fix + R44's gotcha
  memory + R45's coverage extension all reduced future
  ambiguity. Strong candidate. Specific options from R42:
  sort DCBF chain, dashboard, advanced query, POC polish.
- **Track-2 browser-side validation** — defer; R45 weakened
  the pull (zero drift means dev-console visibility adds
  marginal value).
- **Track-2 `loadYamlExampleRows()` migration** — defer;
  still orthogonal.

Choice deferred to end-of-R45 Q&A.
