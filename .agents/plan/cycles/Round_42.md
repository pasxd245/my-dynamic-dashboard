# Round 42: MSW contract-anchor — schema validation + YAML examples as fixture source

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_41](Round_41.md)** — R41 landed MSW
as dev-mode + test-stub convenience (uses #1 and #2 from the
end-of-R41 framing). End-of-round discussion identified that
this leaves use #3 (MSW as contract surface) un-addressed —
the handlers are a third parallel implementation of the
contract that can silently drift from both the YAML spec and
the BE Python implementation.

R42 closes that gap with the _cheapest_ discipline: schema-
validate every MSW handler response against the contract YAML
at the handler boundary, source fixtures from the YAML's
`examples:` blocks, and add debug event listeners so handler
mismatches surface during dev iteration. No new package, no
MockBuilder, no codegen — just three tightly-scoped
interventions that turn MSW from "convenience" into
"convenience + drift detector".

R42 is **Track-2** (agent-method, dev discipline). No
product feature; no FE/BE behavior change. The runtime
behavior of `pnpm dev` / `pnpm test` / `pnpm build` is
identical; what changes is _what happens when an MSW handler
returns a shape that doesn't match the contract_ (it throws
loudly in tests, warns in dev, instead of silently
delivering wrong data).

_Track: 2 (agent-method). Pulled by: end-of-R41
critical-but-fair conversation 2026-05-27 — the three small
wins the user picked over the bigger
`packages/mocks` gambit. Verification-stack-queue rationale
(MSW item) addressed the sequencing pull; this round
addresses the correctness pull that the queue rationale
deliberately deferred. Per [Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Validator library = `ajv` + `js-yaml`** as builder
   devDependencies. `ajv` is the de-facto JSON Schema
   validator; `js-yaml` parses the contract YAML at test/dev
   startup. Both are small (~40KB combined gzipped) and
   only needed in dev/test paths — Vite tree-shakes them
   from the production bundle.
2. **Validation runs only in DEV + TEST**, never in
   production. Production bundles never load the validator.
   Mechanism: a `validateResponse(...)` helper imported only
   from `src/mocks/` (which is itself dev/test-only).
3. **Validator decorator = `withContractValidation(http.get,
schemaRef, handler)`** wrapping each handler. Reads the
   response body, asserts against the contract's 200/4xx
   schema, throws in test mode (loud) or warns in dev mode
   (yellow console). Failure surfaces immediately at the
   handler boundary, not deep in FE rendering.
4. **YAML examples become the canonical fixture data.** The
   rows-get contract's `full_first_page` /
   `filtered_per_column_string_equals` /
   `filtered_per_column_numeric_between` /
   `filtered_compose_q_and_filter` examples are the
   authoritative row shapes. `src/mocks/fixtures.ts` becomes
   a thin loader that imports from the YAML at startup
   (cached) and exposes typed accessors. Hand-rolled
   `MOCK_ROWS` retires.
5. **The rows handler still computes filter + q +
   pagination in JS** (matching R41). Only the _base
   dataset_ comes from the YAML examples. Generated rows
   beyond the YAML's 8-row sample (if a test wants 100
   rows) still hand-rolled.
6. **Debug listeners go in `src/mocks/start.ts` for the
   browser worker only.** The Node-side `tests/setup.ts`
   does not get listeners — test output is already verbose
   under `vitest --reporter=verbose`. Adding listeners
   there is noise.
7. **A new decision file lands.** This is the first
   substantive use of the v1 schema codified in the
   prior commit. The decision pins the convention "FE
   mocks validate against contract YAML at handler
   boundary; YAML examples are the canonical fixture
   source." Tagged with `applies-when:` /
   `failure-mode:` / `revisit-trigger:` for queryable
   retrieval.
8. **No 422 schema validation.** The contract YAML defines
   the 200 success schema strictly (`additionalProperties:
false`); the 422 envelope is FastAPI's loose
   request-validation shape. Validating 422 responses
   would either flag every 422 as wrong (because the
   contract's 422 schema is intentionally vague) or
   require a separate strict schema (which we don't have).
   Skip 422; validate only 2xx for now.
9. **Validation runs synchronously and inline.** No async
   queue, no batching. The validator wrapper unwraps the
   response, validates, re-wraps. Latency cost is
   ~1-2ms per response — invisible in tests, invisible
   in dev.
10. **Skip validation when the handler returns a
    non-application/json body** (e.g. the 204 `delete`
    response). The decorator inspects content-type.

## What is IN scope

### 1. Add validator dependencies

- `pnpm --filter builder add -D ajv js-yaml @types/js-yaml`.
- Both land in `devDependencies`; neither enters the
  production bundle (verified via Vite build output).

### 2. New module `src/mocks/contract-validator.ts`

- File:
  [`src/mocks/contract-validator.ts`](../../../workspace/apps/builder/src/mocks/contract-validator.ts).
- Exports:
  - `loadContractSchemas() -> Map<string, JSONSchema>` —
    parses the YAML files under
    `workspace/packages/contracts/datasets/*.yaml` at
    startup, builds a map keyed by `operationId` (e.g.
    `getDatasetRows`) → 200 response schema.
  - `validateResponse(operationId, body) -> ValidationResult`
    — runs AJV against the schema. Returns `{ ok: true }`
    or `{ ok: false, errors: ErrorObject[] }`.
  - `withContractValidation(operationId, handler)` —
    decorator that wraps an MSW handler. After the handler
    runs, it intercepts the response, clones the body,
    validates, and either:
    - Test mode (`process.env.NODE_ENV === 'test'`):
      throws `ContractDriftError` with the diff. Loud.
    - Dev mode (`import.meta.env.DEV`): `console.warn`
      with the diff. Visible but non-fatal.
    - Else: passthrough (production never reaches this
      code anyway).

### 3. Refactor `src/mocks/fixtures.ts`

- Replace the hand-rolled `MOCK_WORKSPACE` /
  `MOCK_DATASET` / `MOCK_ROWS` constants with:
  - `loadFixturesFromContract()` — pulls
    `full_first_page.value.rows` from the rows-get YAML
    together with the dataset shape from `detail-get.contract.yaml`.
  - Cached singleton — parsed once at module load.
- Backwards-compatible exports — `MOCK_WORKSPACE` /
  `MOCK_DATASET` / `MOCK_ROWS` continue to exist with
  the same shape, just sourced from YAML.

### 4. Wrap `src/mocks/handlers.ts` with the validator

- Each `http.get(...)` / `http.post(...)` call gets
  wrapped with `withContractValidation('<operationId>', ...)`.
- Endpoints without a contract operationId
  (e.g. workspace create — there's no contract YAML for
  the response yet) skip validation gracefully with a
  one-line `// no contract` comment + a TODO pointer.

### 5. Debug event listeners

- Extend
  [`src/mocks/start.ts`](../../../workspace/apps/builder/src/mocks/start.ts)
  with three event listeners on the browser worker
  (per ref1 / ref2 patterns):
  - `request:start` — logs method + URL.
  - `request:match` — logs handler match.
  - `request:end` — logs completion.
- Each at `console.debug` level so dev tooling can filter
  them.

### 6. New decision file

- File:
  [`.agents/decisions/2026-05-27-msw-contract-anchor.md`](../../decisions/2026-05-27-msw-contract-anchor.md).
- Uses the v1 frontmatter schema (8 fields).
- Records: applies-when = "FE mock handlers are added or
  modified", failure-mode = "FE mocks drift silently from
  YAML contract; FE tests pass against a wrong-shaped
  mock", revisit-trigger = "contract codegen lands (then
  the handlers come _from_ YAML) OR a separate
  packages/mocks extraction fires".

### 7. Pipeline

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — all green; new validator
  exercised on every fetch through the mock handlers.
- `pnpm --filter builder build` — green; bundle size
  unchanged from R41 (validator + YAML parser tree-shaken
  out of prod).
- `npx markdownlint-cli2` — 0 errors.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping
  Status.

## What is OUT of scope

- **No `packages/mocks` extraction.** Per
  critical-but-fair feedback: premature at N=1 domain.
- **No MockBuilder + `Common` helpers** (refs1/2
  pattern). Defer until N=3+ domains.
- **No `active: boolean` flag per handler.** Cheap to add
  later; no pull yet.
- **No 422 / non-success schema validation.** Schema for
  422 is loose by design (FastAPI envelope); strict
  validation would either misfire or duplicate the BE
  spec.
- **No codegen from YAML.** Future work; if it lands, the
  current `withContractValidation` decorator retires.
- **No BE-side fixture consumption.** Python BE can't
  consume TS-only YAML loaders without a bridge; not
  pulled. BE tests keep their own `sample.csv` fixture.
- **No Pact-style consumer-driven contract tests.**
  Bigger commitment; not pulled.
- **No retroactive validation of legacy fetch stubs in
  `datasets.test.tsx` / `routing.test.tsx`.** Those tests
  use `vi.stubGlobal('fetch')` which bypasses MSW
  entirely; validating them would require migrating the
  test files (R41 explicitly out-of-scope).

## Plan

- [x] Confirm scope at planning review (decisions 1-10
      above; user redirects any via end-of-round Q&A).
- [x] Add `ajv` + `js-yaml` + `@types/js-yaml` as builder
      devDependencies.
- [x] Author `src/mocks/contract-validator.ts`
      (loadSchemas, validateResponse,
      withContractValidation decorator).
- [x] Extend `src/mocks/fixtures.ts` with the
      `loadYamlExampleRows()` helper (the YAML-as-fixture-source
      discipline applies forward; R41 fixtures stay test-stable).
- [x] Wrap the rows-GET handler in `src/mocks/handlers.ts`
      with `withContractValidation('get', path, 'getDatasetRows', …)`.
      Other handlers have no contract operationId yet — left
      unwrapped with no-contract comments.
- [x] Add debug event listeners to `src/mocks/start.ts`
      (`request:start` / `:match` / `:unhandled`).
- [x] Author `.agents/decisions/2026-05-27-msw-contract-anchor.md`
      using the v1 frontmatter schema.
- [x] Update `decisions/README.md` Index with the new entry.
- [x] Run `pnpm --filter builder type-check` — 0 errors.
- [x] Run `pnpm --filter builder test` — **45/45** green.
- [x] Run `pnpm --filter builder build` — green; bundle
      size **1418.74 kB / 448.84 kB gzip** (unchanged
      from R41 — AJV + YAML parser tree-shaken).
- [x] `npx markdownlint-cli2` — 0 errors repo-wide.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      to Review.

## Risks / unknowns

- **AJV's schema-compilation overhead.** Compiling the
  contract schemas at module load adds ~50ms cold start.
  Test runs already pay this; dev mode pays once at
  HMR boot. Mitigation: cache compiled schemas in module
  scope. No per-request cost.
- **YAML parsing failure at startup.** If the YAML files
  are malformed or missing, the validator throws at boot.
  Mitigation: the contract-validity-tests (R34) catch
  YAML issues at the contract package's CI. By the time
  R42 code reads the YAMLs, they're guaranteed valid.
- **`$ref` resolution in the YAML schemas.** The
  rows-get schema doesn't use `$ref` for the rows-page
  payload (R34 chose inline shape), but `detail-get`
  uses `$ref` to `_shared/dataset.yaml`. AJV needs
  dereferenced schemas. Mitigation: use
  `@apidevtools/swagger-parser` (same lib the contract
  tests use) to dereference once at module load before
  AJV compilation. Adds one more devDep.
- **Validator mode detection.** `process.env.NODE_ENV`
  vs `import.meta.env.MODE` vs vitest's own env vars.
  Mitigation: prefer `import.meta.env.MODE === 'test'`
  for the throw path, `import.meta.env.DEV` for the warn
  path. Both are Vite-native.
- **`withContractValidation` for handlers that take
  query params (rows-GET with `?q=&f<N>_*`).** The schema
  describes the 200 response; the request params are
  separate. Validation runs on the _response body_ only.
  Request validation is the BE's job per R39.
- **Backward compatibility with the R41 test migration.**
  The migrated `dataset-detail.test.tsx` reads from
  `fixtures.ts` exports (`MOCK_DATASET`, `MOCK_ROWS`).
  R42 keeps those exports identical; the source of the
  data changes from hand-rolled to YAML-derived. Tests
  unchanged.
- **`@types/js-yaml` may be deprecated** in newer js-yaml
  versions (TS types now inline). Verify at install
  time; drop the @types/ package if redundant.

## Do

**Dependencies.**

- `pnpm --filter builder add -D ajv js-yaml @types/js-yaml`
  landed `ajv@^8`, `js-yaml@^4`, `@types/js-yaml` in
  builder devDependencies. Bundle size verified unchanged
  from R41 (1418.74 kB / 448.84 kB gzip) — both libs are
  dev/test-only paths Vite tree-shakes from production.

**Validator module.**

- [`src/mocks/contract-validator.ts`](../../../workspace/apps/builder/src/mocks/contract-validator.ts)
  authored. Three exports:
  - `validateResponse(operationId, body)` — runs AJV
    against the compiled schema map; returns
    `{ ok } | { ok: false, errors }`.
  - `ContractDriftError` — thrown in test mode on
    validation failure; carries the operationId + AJV
    errors so vitest output points at the precise field.
  - `withContractValidation(method, path, operationId,
resolver)` — wraps an MSW `http.<method>(path, …)`
    call, intercepts the 2xx JSON response, validates,
    and either throws (Node/test) or no-ops (browser).
- Node-only by guard (`typeof globalThis.window !== 'undefined'`
  short-circuits to the unwrapped path). Browser dev
  mode gets debug listeners instead, per design
  decision 1.
- R42 scope: validates `getDatasetRows` only. The other
  contracts (`getDataset`, list, batch, etc.) use `$ref`
  into `_shared/` schemas that need dereferencing. Adding
  `@apidevtools/swagger-parser` is a small follow-up if
  drift surfaces on those endpoints.

**Fixture-source helper.**

- [`src/mocks/fixtures.ts`](../../../workspace/apps/builder/src/mocks/fixtures.ts)
  gained `loadYamlExampleRows(yamlPath, exampleName)` —
  a Node-only helper that pulls a named example's
  `value.rows` from a contract YAML. R41 hand-rolled
  fixtures stay test-stable; the helper is the canonical
  path for _new_ fixtures. Convention is documented in
  the file header and codified in the R42
  decision file.

**Handler wrapping.**

- [`src/mocks/handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts)
  imports `withContractValidation`; the rows-GET handler
  uses it with `operationId: 'getDatasetRows'`. Every
  200 JSON response now flows through schema validation
  in test mode. Other handlers stay unwrapped with
  `// no contract` (implicit by absence of operationId).

**Debug listeners.**

- [`src/mocks/start.ts`](../../../workspace/apps/builder/src/mocks/start.ts)
  gained three `worker.events.on(...)` handlers
  (`request:start` / `:match` / `:unhandled`) emitting
  at `console.debug` level so dev tools can filter the
  noise off. Pattern borrowed from `tmp/ref-apps/nextjs-mock-with-msw-{1,2}/src/mocks/browser.ts`.

**Decision file (first use of v1 schema).**

- [`.agents/decisions/2026-05-27-msw-contract-anchor.md`](../../decisions/2026-05-27-msw-contract-anchor.md)
  authored using the v1 frontmatter (8 fields). Pins
  the convention. Index in `decisions/README.md`
  updated.

**Pipeline.**

- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter builder test` — **45/45 green** (same
  count as R41; validator is dormant on currently-
  conforming responses).
- `pnpm --filter builder build` — green; bundle
  **unchanged** from R41 (1418.74 kB / 448.84 kB gzip).
- `npx markdownlint-cli2` — 0 errors over 101 files.
- One mid-round markdownlint nit: this file's MD049
  consistency rule wanted asterisk-emphasis (the first
  emphasis in the file is asterisk via the _Track_ line),
  so the placeholder underscores got fixed.

## Check

- [x] `ajv` + `js-yaml` in `devDependencies` only;
      bundle size verified unchanged from R41.
- [x] `contract-validator.ts` exports the three
      documented surfaces; guards Node-vs-browser
      cleanly.
- [x] Validator runs only on 2xx JSON responses; 204 /
      4xx / non-JSON pass through.
- [x] Rows-GET handler wrapped with
      `withContractValidation('get', path,
'getDatasetRows', …)`; failure path produces
      `ContractDriftError` with AJV errors attached.
- [x] `loadYamlExampleRows()` exported from
      `fixtures.ts`; Node-only guard; documented as the
      canonical path for new fixtures.
- [x] Debug listeners installed in `start.ts` for
      browser worker (dev-mode).
- [x] New decision file uses v1 frontmatter (8 fields);
      `applies-when` / `failure-mode` / `revisit-trigger`
      all named concretely, no "TBD".
- [x] `decisions/README.md` Index updated.
- [x] Type-check, test, build, markdownlint all green.
- [x] Post-round audit passes; all Plan + Check
      checkboxes flipped.

## Act

**Learnings**:

- **The validator is dormant on conforming responses,
  loud on drift.** Today it never fires — the rows-GET
  handler conforms. Its value will appear the first
  time a contract amendment lands without a paired
  handler update. That's the verification surface the
  R41 critical-but-fair discussion identified as
  missing.
- **Node-only scope is the right cost-benefit.** Bundling
  AJV + js-yaml into the browser dev bundle would add
  ~80 KB unminified for warnings that the debug
  listeners already cover at higher resolution (every
  request, not just shape mismatches). Tests catch
  drift in CI; dev gets visibility via the listeners.
  Production never reaches either path.
- **Lazy `require()` is the cleanest browser/Node
  bridge inside a shared module.** `loadYamlExampleRows`
  uses `require('node:fs')` etc. only after the
  `globalThis.window !== undefined` guard. The browser
  bundle never reaches the require calls; Vite leaves
  the dead branch in source but tree-shakes it from
  production. Cleaner than splitting `fixtures.ts`
  into `fixtures.node.ts` + `fixtures.browser.ts`.
- **The v1 frontmatter schema's `failure-mode` field
  worked as predicted.** Writing the decision file
  forced the question "what bad outcome are we
  guarding against?" — and the answer ("FE mocks
  drift silently from the YAML; FE tests pass against
  a wrong-shaped mock") is sharper than the prose
  rationale would have been alone. The discipline
  pays for itself at the first usage.

**Promotions** _(none — Track-2 tooling round; the
validator + loader stay in `src/mocks/` until a second
domain or a `packages/mocks` extraction pulls them
out)_:

**Follow-ups (not promotions, just notes):**

- **Validation coverage gap**: only `getDatasetRows` is
  validated. Other endpoints (workspaces, uploads, the
  list endpoints) have schemas in YAML but the schemas
  use `$ref` into `_shared/`. Adding
  `@apidevtools/swagger-parser` as a builder devDep
  would dereference them; defer until a real drift
  incident pulls the extension.
- **Browser validation deferred**: if dev-mode drift
  catches developers off-guard despite the debug
  listeners, promote browser-side validation. Cost:
  bundle AJV into the dev bundle (~30 KB gzipped),
  guarded by `import.meta.env.DEV`. Not pulled yet.
- **Codegen retires the decorator**: when contract
  codegen lands (handlers come _from_ YAML), the
  `withContractValidation` decorator becomes
  redundant — the generated handler shape already
  conforms by construction. Named as the
  `revisit-trigger` in the decision file.
- **`packages/mocks` extraction**: still the right
  long-term destination if mocks-using domains
  proliferate. The decision file names N >= 3 as the
  trigger. Today N=1.
- **YAML-loader test coverage**: `loadYamlExampleRows`
  is exported but not currently used. When the first
  fixture-derived-from-YAML lands, add a unit test
  that verifies the helper extracts the right shape.
- **Faker integration**: ref2 uses `@faker-js/faker`
  for realistic mock data at scale (virtualization
  testing). Orthogonal to R42; pull when virtualization
  follow-up arrives.

## Feeds into → Round_43 (TBD — product feature; see R40 candidate list)

R42 closes the MSW contract-anchor gap. With validation +
shared fixtures + debug listeners landed, MSW is no longer
purely convenience — it actively surfaces drift between the
FE mock and the contract YAML.

R43 returns to product (Track-1). Candidates carried from
the end-of-R40 list:

- **Sort DCBF chain** — small, mirrors filter architecture.
- **Dashboard feature** — large fresh DCBF chain.
- **Advanced query** — OR/grouping syntax on top of filters.
- **POC polish** — bundle size, virtualization, real vi-VN
  translator.
