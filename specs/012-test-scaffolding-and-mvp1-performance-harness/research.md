# Research: Test Scaffolding and MVP-1 Performance Harness

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Decision 1: Test-Layer Taxonomy and Physical Boundaries

- Decision: Use directory-backed taxonomy under `apps/backend/tests` with canonical layers `unit`, `integration`, and `contract`.
- Rationale: Directory boundaries are observable in review and enforceable by convention/tooling; they align with FR-001/FR-002 and reduce triage ambiguity.
- Alternatives considered:
  - Marker-only taxonomy without directory structure: rejected because drift is harder to detect during code review.
  - Keep mixed historical layout: rejected because it fails explicit layer-governance requirements.

## Decision 2: Shared Factory Pattern (Hand-Rolled)

- Decision: Introduce deterministic hand-rolled factory helpers under `apps/backend/tests/factories` with explicit override points.
- Rationale: Meets FR-004/FR-005 while avoiding new runtime complexity and preserving transparent test setup behavior.
- Alternatives considered:
  - Adopt `factory-boy`: rejected due to unnecessary dependency and abstraction overhead for current backend domain shape.
  - Continue ad-hoc per-test fixtures: rejected because setup duplication and inconsistency already cause maintenance cost.

## Decision 3: Default Suite vs Perf Suite Execution Contract

- Decision: Default verification remains standard pytest suite (unit/integration/contract, no perf marker tests). Performance harness is opt-in via marker selection (`-m perf`) and explicit perf path targeting.
- Rationale: Preserves current default feedback loop speed and keeps performance checks intentional/reproducible.
- Alternatives considered:
  - Include perf tests in default `pytest` run: rejected because environment-sensitive timings would create unstable default quality gates.
  - Run perf tests via standalone scripts only: rejected because pytest marker integration provides better reporting/traceability.

## Decision 4: MVP-1 SLO Harness Scenarios

- Decision: Encode three required harness scenarios as pytest perf tests: upload 100k rows (<30s), preview (<5s), export (<30s), with per-scenario pass/fail assertions and run context.
- Rationale: Directly maps FR-008/FR-009 and success criteria SC-004/SC-005/SC-006 with auditable outputs.
- Alternatives considered:
  - One aggregate end-to-end timing test: rejected because failures would be non-localized and harder to remediate.
  - Manual benchmark scripts with no assertions: rejected because they cannot gate readiness automatically.

## Decision 5: Zero Production Behavior Guardrail

- Decision: Scope implementation to backend test tree, pytest configuration, and backend documentation only; no edits under `apps/backend/app` behavior paths.
- Rationale: Enforces FR-010 and reduces risk of accidental product regressions.
- Alternatives considered:
  - Opportunistic production refactors while reorganizing tests: rejected as scope creep and governance violation.

## Decision 6: Reproducibility and Evidence Contract

- Decision: Quickstart and contract define explicit command-level verification for default and perf runs and require capturing environment context for perf evidence.
- Rationale: Supports constitution principles VI and VII by making validation traceable and reproducible.
- Alternatives considered:
  - Informal verification narrative only: rejected because it is not audit-friendly for release gating.

## Clarification Resolution Summary

All planning unknowns are resolved:

- Test taxonomy mechanism: resolved to directory + documentation-backed boundaries.
- Factory approach: resolved to deterministic hand-rolled helpers in `tests/factories`.
- Perf execution mode: resolved to opt-in pytest marker contract.
- MVP-1 SLO verification: resolved to three explicit perf scenarios with pass/fail assertions.
- Behavior-preservation proof: resolved to mandatory default-suite regression expectation plus production-code no-change scope.
