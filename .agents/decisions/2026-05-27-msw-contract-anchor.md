---
# Identity
decided: 2026-05-27
source-round: R42

# Classification
track: 2
status: active

# Substance
applies-when: an FE MSW handler is added or modified in src/mocks/handlers.ts
failure-mode: FE mocks drift silently from the contract YAML; FE tests pass against a wrong-shaped mock while the real BE response shape diverges

# Lifecycle
revisit-trigger: contract codegen lands (handlers come from YAML directly, decorator retires); OR a separate packages/mocks extraction fires (N >= 3 mock-using domains); OR a contract drift incident surfaces despite this discipline (then strengthen)
promoted-to: null
---

# Decision: FE MSW handlers are contract-anchored, not parallel

**Commitment**: Every FE MSW handler whose endpoint has a contract
YAML schema is wrapped with `withContractValidation(...)` so the 200
response body is schema-validated at the handler boundary. Handler
drift from the YAML throws `ContractDriftError` in tests (loud) and
warns in dev (visible). The contract YAML — not the handler code —
is the authoritative response-shape spec.

YAML `examples:` blocks are the canonical reference for fixture
shape. New fixtures derive from / conform to them via the
`loadYamlExampleRows()` helper. Existing R41 hand-rolled fixtures
stay test-stable but are documented as conforming to the same shape.

## Why

R41 landed MSW as dev/test convenience but left the contract surface
open: three parallel implementations (YAML / Python BE / TS mock),
any of which could drift. The R41 end-of-round critical-but-fair
discussion (see [Round_41.md § Feeds into](../plan/cycles/Round_41.md))
identified that MSW *could* be load-bearing as a drift detector — at
the cost of a small validator decorator (~150 LOC total) — without
extracting `packages/mocks` or adopting MockBuilder.

R42 closes the gap. The discipline is *cheaper* than a `packages/mocks`
extraction (no new package, no TS↔Python bridge, no MockBuilder
ceremony at N=1 domain) but delivers the contract-verification value
the earlier critical-but-fair discussion identified as the actual
unmet pull.

## What this allows

- New `src/mocks/handlers.ts` additions WITHOUT validation
  (operationId = null) when the endpoint has no contract YAML yet.
  Marked inline with a `// no contract` comment + a pointer to where
  the contract would land.
- Per-test handler overrides via `server.use(...)` — unchanged from
  R41. Overrides can opt into validation by wrapping with the
  decorator, or skip it for negative-path tests.
- Future strengthening: the validator decorator is the natural
  anchor for codegen (when a TS handler stub is generated from
  YAML, validation lives in the same place).

## What this forbids

- Adding a mock handler for an endpoint with a contract YAML
  *without* `withContractValidation(...)`. If the contract exists,
  the mock conforms.
- Hand-editing the YAML schemas to match a divergent mock. The
  YAML is the spec; the mock is the consumer.
- Duplicating fixture data when an existing YAML `examples:`
  block already encodes the shape. New fixtures derive via
  `loadYamlExampleRows()` (or document why they can't).

## Trade-off accepted

- **Validation overhead**: ~1-2ms per response in tests; invisible
  in dev (debug listeners only). Acceptable.
- **Node-only scope**: the validator runs only in vitest, not in
  the browser dev bundle. Drift surfaces in CI, not at the dev
  console. Acceptable because browser dev gets debug listeners
  (R42's third intervention) which surface every match/mismatch.
- **R42 validates only `getDatasetRows`** today; other endpoints
  use `$ref` to shared schemas that need dereferencing. Future-
  extension cost (adding `@apidevtools/swagger-parser` or a small
  ref resolver) is small but unjustified until a second contract
  is worth validating.
- **No mocks/handlers BE-side**: Python BE doesn't consume the TS
  validator. BE conformance is enforced by R39's pytest +
  `validate_response()` helper. Two independent verifiers; same
  YAML; no cross-language bridge.

*Track: 2. Pulled by: end-of-R41 critical-but-fair conversation
2026-05-27; the three small wins explicitly chosen over the bigger
`packages/mocks` gambit; the verification-stack-queue's correctness
gap (queue framed parallelization, not verification).*
