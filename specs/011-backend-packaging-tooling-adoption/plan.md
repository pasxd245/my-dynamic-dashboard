# Implementation Plan: Backend Packaging Tooling Adoption

**Branch**: `011-backend-packaging-tooling-adoption` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-backend-packaging-tooling-adoption/spec.md`

## Summary

Migrate `apps/backend` from `requirements.txt` to a single `pyproject.toml`-driven packaging and tooling workflow using hatchling + hatch-vcs, Ruff, Commitizen, and pytest/coverage metadata configuration. Preserve zero behavior change by retaining the same runtime dependency set, test discovery scope, and backend module layout while updating only packaging/tooling configuration and installation entry points.

## Technical Context

**Language/Version**: Python 3.12 runtime target (`python:3.12-slim` in backend Dockerfile; developer prerequisite `Python 3.12+`)  
**Primary Dependencies**: FastAPI `0.115.12`, Uvicorn `0.34.2`, SQLModel `0.0.22`, SQLAlchemy `2.0.38`, Alembic `1.14.1`, Polars `1.30.0`, OpenPyXL `3.1.5`, FastExcel `0.11.5`, python-multipart `0.0.20`, DuckDB `1.1.3`, PyYAML `>=6.0`, RecursiveNamespaceV2 `>=0.0.3`  
**Storage**: SQLite metadata + Parquet files (unchanged; out of scope for this feature)  
**Testing**: `pytest` with discovery rooted at `apps/backend/tests` and `python_files=test_*.py`; coverage via `coverage.py` config in project metadata  
**Target Platform**: Linux local dev and Linux container runtime
**Project Type**: Backend web service packaging/tooling migration (internal enablement)
**Performance Goals**: No measurable runtime/test performance regression introduced by packaging changes; installation workflow remains reproducible  
**Constraints**: Backend-only scope (`apps/backend`), zero behavior change, no code moves, locked tooling baseline (hatchling+hatch-vcs, Ruff, Commitizen, pytest/coverage parity with i18n-tool core)  
**Scale/Scope**: Configuration and workflow updates only: `apps/backend/pyproject.toml`, removal of `apps/backend/requirements.txt`, backend install references in docs/scripts/automation, and generated-version ignore handling

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Principle I (Business-question-first)**: PASS. The feature answers whether backend release/setup reliability can be improved via standardized packaging without runtime behavior changes.
2. **Principle II (Metric contract before visualization)**: PASS. No analytics metric or visualization changes are introduced.
3. **Principle III (Relationship rule before cross-table query)**: PASS. No relationship or cross-table query logic is modified.
4. **Principle IV (Reconciliation before recommendation)**: PASS. No recommendation or reconciliation outputs are in scope.
5. **Principle V (Challenge & sensitivity before decision-ready)**: PASS. No decision-ready surface changes are in scope.
6. **Principle VI (Traceability for every claim)**: PASS WITH REQUIREMENT. Packaging/tooling outcomes must be traceable to explicit config blocks in `pyproject.toml` and to updated setup commands in docs/scripts.
7. **Principle VII (Reproducibility from raw inputs)**: PASS WITH REQUIREMENT. Install/test workflows must remain reproducible from repository state and VCS tags, including deterministic fallback behavior when no backend tag exists.

Post-Phase 1 re-check:

1. **Principle I**: PASS. Design artifacts keep scope to backend packaging/tooling migration only.
2. **Principle II**: PASS. No metric contract introduced or altered.
3. **Principle III**: PASS. No relationship-rule behavior altered.
4. **Principle IV**: PASS. No recommendation logic touched.
5. **Principle V**: PASS. No challenge/sensitivity behavior touched.
6. **Principle VI**: PASS. Contracts and quickstart explicitly map each required check to a concrete command and file.
7. **Principle VII**: PASS. Versioning and install behavior are specified as reproducible command paths with documented fallback and verification.

## Project Structure

### Documentation (this feature)

```text
specs/011-backend-packaging-tooling-adoption/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/           # Phase 1 output (/speckit.plan)
│   └── backend-packaging-tooling-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks, not generated here)
```

### Source Code (repository root)

```text
apps/backend/
├── app/                    # Backend package code (must not move in this feature)
├── tests/                  # Existing pytest suite (behavior parity gate)
├── Dockerfile              # Backend container install path
├── pytest.ini              # Existing test discovery baseline
├── requirements.txt        # Removed by this feature after metadata parity
└── pyproject.toml          # New authoritative packaging/tooling metadata

README.md                   # Update top-level quickstart backend install commands

docs/
└── development/setup.md    # Update backend install/test setup commands

scripts/
└── dev/stack.sh            # Verify backend launch path remains compatible
```

**Structure Decision**: Keep existing backend package and test layout unchanged; only packaging/tooling configuration files and install references are modified. No source code relocation under `apps/backend/app` or test layout restructuring is allowed.

## Requirement Mapping Matrix

| Requirement | Data Layer                     | Metric Contract              | Relationship Rule | Surface Role       | Gate                                                      | Test / Evidence        |
| ----------- | ------------------------------ | ---------------------------- | ----------------- | ------------------ | --------------------------------------------------------- | ---------------------- |
| FR-001      | N/A (packaging metadata only)  | N/A                          | N/A               | Backend maintainer | `apps/backend/pyproject.toml` exists and is authoritative | T005, T013, T035       |
| FR-002      | N/A                            | N/A                          | N/A               | Backend maintainer | hatchling + hatch-vcs configured                          | T005, T008             |
| FR-003      | N/A                            | N/A                          | N/A               | Release owner      | backend tag pattern aligned                               | T030, T027             |
| FR-004      | N/A                            | N/A                          | N/A               | Backend maintainer | runtime deps parity retained                              | T006, T015             |
| FR-005      | N/A                            | N/A                          | N/A               | Backend maintainer | dev/test extras defined                                   | T007, T014             |
| FR-006      | N/A                            | N/A                          | N/A               | Release owner      | Ruff policy locked to baseline                            | T010, T031, T028       |
| FR-007      | N/A                            | N/A                          | N/A               | Release owner      | Commitizen SCM provider + tag format set                  | T010, T030, T029       |
| FR-008      | N/A                            | N/A                          | N/A               | Release owner      | pytest/coverage parity configured                         | T009, T032             |
| FR-009      | Existing backend tests only    | N/A                          | N/A               | Release owner      | test discovery unchanged                                  | T009, T024             |
| FR-010      | N/A                            | N/A                          | N/A               | Backend maintainer | `requirements.txt` retired                                | T019, T020             |
| FR-011      | N/A                            | N/A                          | N/A               | Backend maintainer | active setup paths migrated                               | T016, T017, T018       |
| FR-012      | Existing backend module layout | N/A                          | N/A               | Release owner      | zero file moves under `apps/backend/app`                  | T025                   |
| FR-013      | Existing runtime behavior only | N/A                          | N/A               | Release owner      | zero behavior regression                                  | T021, T022, T023, T026 |
| FR-014      | N/A                            | N/A                          | N/A               | Backend maintainer | generated version file ignored                            | T011                   |
| FR-015      | N/A                            | N/A                          | N/A               | Release owner      | changelog target exists                                   | T012, T032, T033       |
| SC-001      | N/A                            | Install reproducibility      | N/A               | Backend maintainer | editable install success                                  | T014                   |
| SC-002      | Existing tests/smoke           | Regression parity            | N/A               | Release owner      | pre/post behavior parity                                  | T021, T023             |
| SC-003      | N/A                            | Setup hygiene                | N/A               | Backend maintainer | no active backend requirements path                       | T019, T020, T034       |
| SC-004      | N/A                            | Lint policy execution        | N/A               | Release owner      | Ruff command executes under locked policy                 | T028, T031             |
| SC-005      | N/A                            | Version reproducibility      | N/A               | Release owner      | tag-derived version resolves                              | T027, T030             |
| SC-006      | N/A                            | Release bump reproducibility | N/A               | Release owner      | commitizen dry-run valid                                  | T029                   |
| SC-007      | Existing backend layout        | Structural invariance        | N/A               | Release owner      | file move count under backend app is zero                 | T025                   |

## Complexity Tracking

No constitution violations are intentionally accepted for this feature.
