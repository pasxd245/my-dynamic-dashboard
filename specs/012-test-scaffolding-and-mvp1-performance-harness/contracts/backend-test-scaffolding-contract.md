# Contract: Backend Test Scaffolding and MVP-1 Performance Harness

**Scope**: `apps/backend` testing and test-tooling surfaces only  
**Spec**: [../spec.md](../spec.md)

## Purpose

Define maintainer-facing contract for backend test taxonomy, factory usage, and performance harness execution while preserving production behavior.

## Contract Surface A: Test-Layer Taxonomy

- Canonical layers:
  - `unit`: pure logic checks with no external I/O dependency.
  - `integration`: in-process component interactions across backend boundaries.
  - `contract`: request/response and interface-shape behavior checks.
- Attribution contract:
  - Every backend test file belongs to exactly one canonical layer.
  - Layer intent and failure interpretation are documented for maintainers.

## Contract Surface B: Shared Factory Blueprint

- Location contract:
  - Shared deterministic factories exist under `apps/backend/tests/factories`.
- Behavior contract:
  - Factories provide deterministic defaults.
  - Factories expose explicit override points.
  - Factories are reusable across unit, integration, and contract layers.

## Contract Surface C: Pytest Execution Profiles

- Default profile contract:
  - Command baseline: `cd apps/backend && pytest tests/ -q`
  - Purpose: fast regression signal for normal development/CI.
  - Expectation: does not require opt-in perf marker selection.
- Perf profile contract:
  - Command baseline: `cd apps/backend && pytest -m perf tests/perf -q`
  - Purpose: explicit MVP-1 SLO conformance verification.
  - Expectation: opt-in execution only; run context must be captured with results.

## Contract Surface D: MVP-1 SLO Harness Requirements

- Required scenarios and thresholds:
  - Upload 100,000 rows: `<30s`
  - Preview workflow: `<5s`
  - Export workflow: `<30s`
- Reporting contract:
  - Pass/fail status is explicit per scenario.
  - Missing scenario output marks the run incomplete.

## Contract Surface E: Zero Behavior-Change Guardrail

- Allowed modifications:
  - Backend test assets, backend pytest/tooling configuration, and backend docs.
- Disallowed modifications in this feature:
  - Production API behavior changes.
  - Production business-rule or runtime semantic changes.
  - Feature work outside backend test/perf governance scope.

## Verification Matrix

- Taxonomy documentation and directory attribution check: required.
- Representative test usage of shared factories across all layers: required.
- Default pytest suite (`pytest tests/ -q`) pass expectation: required.
- Opt-in perf marker suite (`pytest -m perf tests/perf -q`) pass expectation: required for MVP-1 gate evidence.
- No production behavior changes introduced: required.
