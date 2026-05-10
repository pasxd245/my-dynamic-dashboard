# Research: Backend Packaging Tooling Adoption

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Decision 1: Authoritative Packaging Metadata Location

- Decision: Use `apps/backend/pyproject.toml` as the sole authoritative backend packaging/tooling definition.
- Rationale: Removes split-brain dependency management between `requirements.txt`, ad-hoc tool configs, and docs; enables standards-based metadata for build/version/test/lint tooling.
- Alternatives considered:
  - Keep `requirements.txt` as primary and add partial tooling configs elsewhere: rejected because it preserves drift and does not satisfy FR-001/FR-010.
  - Introduce monorepo root Python `pyproject.toml`: rejected for this feature due to strict backend-only scope.

## Decision 2: Build Backend and Version Source

- Decision: Adopt hatchling as PEP 517 build backend and hatch-vcs as dynamic version source for backend package.
- Rationale: Matches locked Round 25 baseline and enables tag-derived backend versions without manual file edits; supports deterministic fallback behavior in non-tagged dev trees.
- Alternatives considered:
  - Static version in `pyproject.toml`: rejected due to manual drift risk and FR-007/SC-006 expectations.
  - setuptools + setuptools_scm: rejected because round baseline explicitly locks hatchling + hatch-vcs.

## Decision 3: Backend Tag Pattern and Monorepo Root Resolution

- Decision: Use tag format `apps/backend/v$version` with hatch-vcs pattern `apps/backend/v(?P<version>.*)` and `raw-options.root = ".."` from `apps/backend`.
- Rationale: Backend-scoped tags avoid cross-app version collisions and align with existing monorepo path semantics.
- Alternatives considered:
  - Shared global tag prefix (e.g., `v$version`): rejected because backend release lineage would be ambiguous across apps.
  - No backend-specific tag namespace: rejected for multi-application repository safety.

## Decision 4: Tooling Baseline Parity Source

- Decision: Use `tmp/apps/i18n-tool/core/pyproject.toml` as the parity template for pytest/coverage, Ruff baseline, and Commitizen schema.
- Rationale: Round guidance and spec assumptions identify this template as proven reference behavior for locked tooling policy.
- Alternatives considered:
  - Invent backend-specific lint/test policy from scratch: rejected because it violates locked baseline and increases migration risk.
  - Expand rules beyond baseline in same round: rejected due to zero behavior-change requirement.

## Decision 5: Dependency Mapping Strategy

- Decision: Migrate every runtime dependency from `apps/backend/requirements.txt` into `[project.dependencies]` with equivalent pins/constraints; place non-runtime developer tools in optional dependency groups (`dev`, `test`).
- Rationale: Preserves runtime behavior while making developer and CI setup explicit and reproducible through extras.
- Alternatives considered:
  - Flatten all tools into runtime dependencies: rejected because it inflates production install footprint.
  - Keep separate dev requirements files: rejected due to FR-001 single-source requirement.

## Decision 6: Test and Coverage Configuration Location

- Decision: Define pytest and coverage configuration under `[tool.pytest.ini_options]` and `[tool.coverage.*]` in `pyproject.toml`, preserving current backend discovery behavior (`tests`, `test_*.py`) and parity exclusion lines.
- Rationale: Keeps behavior stable while consolidating config to project metadata; simplifies CI invocation consistency.
- Alternatives considered:
  - Keep `pytest.ini` as source of truth: accepted only as transitional coexistence if needed during implementation, but final contract source is `pyproject.toml`.
  - Change test paths/options while migrating: rejected as behavior-change risk.

## Decision 7: Install Workflow Update Scope

- Decision: Update active backend setup/install references from `pip install -r requirements.txt` to editable install with extras, expected command `pip install -e .[dev,test]` from `apps/backend`.
- Rationale: Aligns docs and automation to authoritative metadata and validates extras contract in real workflows.
- Alternatives considered:
  - Leave docs/scripts unchanged temporarily: rejected because FR-011 and SC-003 require active-path migration.
  - Use non-editable install only: rejected for poorer local developer ergonomics.

## Decision 8: Behavior-Parity Verification Contract

- Decision: Treat migration as config-only and verify parity with existing backend tests and command-level smoke checks without moving code under `apps/backend/app`.
- Rationale: Enforces non-goals and FR-012/FR-013 guardrails while still enabling packaging modernization.
- Alternatives considered:
  - Bundle style fixes/refactors in same round: rejected because it obscures packaging-only risk and violates zero behavior-change intent.

## Clarification Resolution Summary

All prior planning unknowns are resolved:

- Python/runtime target: resolved to Python 3.12.
- Packaging/version backend: resolved to hatchling + hatch-vcs.
- Tag policy: resolved to backend-scoped format/pattern.
- Lint policy: resolved to Ruff, line-length 120, `E/F/B/SIM/I`.
- Commit/changelog tooling: resolved to Commitizen with SCM version provider and backend tag format.
- Coverage exclusion baseline: resolved to i18n-tool template parity.
- Active install touchpoints: resolved to top-level README and docs/development setup, with backend scripts/automation verification included.
