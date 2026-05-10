# Research: Dashboard Streamlit Foundation Audit

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Decision 1: Dashboard-Only Structural Refactor Scope

- Decision: Constrain implementation strictly to `apps/dashboard/**` and directly related docs/contracts under `specs/014-...` and `docs/development/setup.md`.
- Rationale: Satisfies spec constraints and NFR-003 while minimizing regression risk and preserving backend runtime behavior.
- Alternatives considered:
  - Include backend-side helper refactors in same round: rejected as scope expansion and governance drift.
  - Shared package extraction now: rejected by Round 28 Gate A as premature monorepo complexity.

## Decision 2: Config-Manager Pattern via In-App Dashboard Modules

- Decision: Introduce dashboard-local config manager modules (`shared.py`, env helper, defaults resource) and route all dashboard runtime config reads through this layer.
- Rationale: Eliminates ad-hoc environment access patterns (`os.getenv`, `os.environ`) and creates deterministic configuration precedence for local, CI, and container runs.
- Alternatives considered:
  - Keep environment reads in each module: rejected due to auditability and maintainability risks.
  - Extract shared Python config package now: rejected (Gate A deferred) to avoid tooling/workspace packaging overhead in this round.

## Decision 3: Environment Governance Policy

- Decision: Enforce zero direct environment access in dashboard runtime modules by policy and verification command (`rg -n "os\.getenv|os\.environ" apps/dashboard`).
- Rationale: Directly maps FR-004, SC-001, and SC-002 and creates an objective governance gate.
- Alternatives considered:
  - Permit legacy exceptions in entrypoint: rejected because exceptions tend to persist and weaken policy.
  - Soft guidance without an explicit gate: rejected because it is not reproducible in CI/local checks.

## Decision 4: Packaging and Build Parity

- Decision: Add `apps/dashboard/pyproject.toml` with backend-style tooling conventions (hatchling/hatch-vcs, ruff, commitizen) and move dashboard Docker install path from requirements-based to package-based installation.
- Rationale: Aligns dashboard governance with backend release/tooling model and reduces duplicated dependency surfaces.
- Alternatives considered:
  - Retain `requirements.txt` as primary install artifact: rejected because it blocks parity and drifts from backend package governance.
  - Use mixed requirements + pyproject as equal sources: rejected due to ambiguity and drift risk.

## Decision 5: Test Layer Contract for This Round

- Decision: Dashboard tests are explicitly split into `unit` and `integration` only; contract/perf suites are out-of-scope in this round.
- Rationale: Matches FR-008/FR-009 and Round 28 gating for Streamlit-focused governance work.
- Alternatives considered:
  - Introduce contract tests now: rejected because dashboard is not the API server contract owner.
  - Introduce perf harness now: rejected to keep this round focused on foundation refactor/governance.

## Decision 6: Behavioral Equivalence Verification

- Decision: Require pre/post smoke parity checks (`streamlit run`, API connectivity, dashboard load/run/export pathways) to prove no user-visible feature additions or behavior drift.
- Rationale: Implements FR-011 and reconciliation requirements from constitution Principle IV and spec reconciliation section.
- Alternatives considered:
  - Code-review-only behavior validation: rejected because runtime verification evidence is required for release confidence.

## Clarification Resolution Summary

All technical context unknowns are resolved:

- Language/runtime/tooling baseline: Python 3.12 + Streamlit app under `apps/dashboard`.
- Configuration strategy: centralized dashboard config-manager pattern (no ad-hoc env reads).
- Packaging path: pyproject-driven install and Docker package install.
- Test strategy: unit/integration split only for this round.
- Scope guardrail: dashboard-only refactor/governance with zero production feature additions.
