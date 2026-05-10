# Implementation Plan: Test Scaffolding and MVP-1 Performance Harness

**Branch**: `feat/enhance-ui-ux` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-test-scaffolding-and-mvp1-performance-harness/spec.md`

## Summary

Establish a backend-only testing governance baseline before MVP-1 feature rounds by formalizing unit/integration/contract suite boundaries, introducing shared deterministic test factories, and defining an opt-in performance harness for MVP-1 SLO checks. The implementation remains strictly non-production: only test assets and supporting backend test/tooling/docs surfaces are in scope, with explicit behavior-preservation verification.

## Technical Context

**Language/Version**: Python 3.12
**Primary Dependencies**: FastAPI, SQLModel/SQLAlchemy, pytest, httpx/TestClient, optional `pytest-benchmark` for perf harness
**Storage**: SQLite and filesystem/parquet via existing backend runtime paths (test-only usage)
**Testing**: pytest discovery rooted at `apps/backend/tests`, layered execution (`unit`, `integration`, `contract`) plus opt-in marker-based perf suite
**Target Platform**: Linux local development and CI runners
**Project Type**: Backend service internal quality-infrastructure change
**Performance Goals**: Harness validates MVP-1 SLOs: upload 100k rows <30s, preview <5s, export <30s
**Constraints**: Backend-only scope, zero production behavior change, no API/business-rule/runtime behavior edits, default pytest suite excludes perf tests
**Scale/Scope**: `apps/backend/tests/**`, backend pytest/tooling configuration, and backend-focused docs updates only

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Principle I (Business-question-first)**: PASS. Feature directly serves release-readiness decision for MVP-1 development velocity with low regression risk.
2. **Principle II (Metric contract before visualization)**: PASS. No metric-definition or visualization behavior is added/changed.
3. **Principle III (Relationship rule before cross-table query)**: PASS. No relationship-rule behavior changes are in scope.
4. **Principle IV (Reconciliation before recommendation)**: PASS. No recommendation surfaces are modified.
5. **Principle V (Challenge & sensitivity before decision-ready)**: PASS. No decision-ready findings are introduced.
6. **Principle VI (Traceability for every claim)**: PASS WITH REQUIREMENT. Test-layer boundaries, factory usage, and perf pass/fail evidence must map to concrete commands and files.
7. **Principle VII (Reproducibility from raw inputs)**: PASS WITH REQUIREMENT. Default and perf runs must be reproducible with explicit invocation contracts and environment assumptions.

Post-Phase 1 re-check:

1. **Principle I**: PASS. Artifacts remain backend quality-governance only.
2. **Principle II**: PASS. No KPI/metric-contract surface was introduced.
3. **Principle III**: PASS. No relationship data semantics changed.
4. **Principle IV**: PASS. No recommendation behavior introduced.
5. **Principle V**: PASS. Challenge labeling is unchanged and out of scope.
6. **Principle VI**: PASS. Contracts + quickstart specify exact verification commands and evidence.
7. **Principle VII**: PASS. Verification paths define deterministic default-suite and opt-in perf-suite execution expectations.

## Project Structure

### Documentation (this feature)

```text
specs/012-test-scaffolding-and-mvp1-performance-harness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── backend-test-scaffolding-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/backend/
├── app/                        # Production runtime code (must remain behavior-identical)
├── pyproject.toml              # Backend tooling config updates (pytest marker policy)
└── tests/
    ├── conftest.py
    ├── factories/              # New shared deterministic factory helpers
    ├── unit/                   # Pure logic tests, no external I/O
    ├── integration/            # In-process component interactions
    ├── contract/               # API/contract shape checks
    └── perf/                   # Opt-in perf marker suite for MVP-1 SLO checks

docs/
└── development/setup.md        # Backend test execution documentation updates
```

**Structure Decision**: Keep all production backend modules unchanged under `apps/backend/app` and limit implementation to backend test organization, supporting test-tooling configuration, and backend-focused documentation.

## Requirement Mapping Matrix

| Requirement | Data Layer                      | Metric Contract | Relationship Rule | Surface Role       | Gate                                       | Test / Evidence                                   |
| ----------- | ------------------------------- | --------------- | ----------------- | ------------------ | ------------------------------------------ | ------------------------------------------------- |
| FR-001      | N/A (test governance)           | N/A             | N/A               | Backend maintainer | taxonomy explicit and documented           | `apps/backend/tests/README.md`, T-layer inventory |
| FR-002      | N/A                             | N/A             | N/A               | Backend maintainer | each test maps to one layer                | directory audit + suite mapping check             |
| FR-003      | N/A                             | N/A             | N/A               | Release owner      | scope/ownership/failure guidance present   | documentation verification                        |
| FR-004      | Test fixture domain entities    | N/A             | N/A               | Backend maintainer | factories exist under `tests/factories`    | factory module smoke usage tests                  |
| FR-005      | Test fixture defaults/overrides | N/A             | N/A               | Backend maintainer | deterministic defaults + override API      | representative tests using overrides              |
| FR-006      | Shared factory reuse surface    | N/A             | N/A               | Backend maintainer | all layers consume without hidden coupling | unit/integration/contract sample conversions      |
| FR-007      | Perf harness run artifact       | N/A             | N/A               | Release owner      | repeatable harness exists                  | `pytest -m perf apps/backend/tests/perf -q`       |
| FR-008      | SLO threshold set               | N/A             | N/A               | Release owner      | all 3 SLO checks encoded                   | perf suite assertions/report                      |
| FR-009      | Perf evidence record            | N/A             | N/A               | Release owner      | pass/fail + context recorded               | benchmark output artifact + metadata              |
| FR-010      | Production behavior baseline    | N/A             | N/A               | Release owner      | no runtime/API/business-rule diff          | full default pytest regression run                |
| FR-011      | MVP-1 alignment scope           | N/A             | N/A               | Product owner      | backend tests + MVP-1 flow targets only    | spec/plan scope audit                             |
| SC-001      | N/A                             | N/A             | N/A               | Backend maintainer | 100% test-layer attribution                | scripted test inventory check                     |
| SC-002      | Factory blueprint reuse         | N/A             | N/A               | Backend maintainer | no repeated setup boilerplate in samples   | review of migrated representative tests           |
| SC-003      | Perf harness completeness       | N/A             | N/A               | Release owner      | single run reports all flow statuses       | perf summary output                               |
| SC-004      | Upload perf scenario            | N/A             | N/A               | Release owner      | 100k upload <30s                           | perf upload assertion                             |
| SC-005      | Preview perf scenario           | N/A             | N/A               | Release owner      | preview <5s                                | perf preview assertion                            |
| SC-006      | Export perf scenario            | N/A             | N/A               | Release owner      | export <30s                                | perf export assertion                             |
| SC-007      | Behavior preservation           | N/A             | N/A               | Release owner      | no production regressions                  | default pytest suite pass                         |

## Complexity Tracking

No constitution violations are accepted. Feature complexity is constrained to test architecture and verification instrumentation with zero production behavior drift.

## Status Summary (2026-05-10)

- Execution status: implemented and verified for backend test/tooling/docs scope.
- Regression gate: `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q` -> `221 passed, 6 skipped`.
- Perf gate: `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q` -> `3 passed`.
- Runtime guardrail: no production module changes under `apps/backend/app/**`.

## Traceability Update

- Task evidence lives under `specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/`.
- Layer governance and inventory are documented in `apps/backend/tests/README.md`.
- Tooling command matrix is documented in `docs/development/setup.md` and `specs/012-test-scaffolding-and-mvp1-performance-harness/quickstart.md`.
