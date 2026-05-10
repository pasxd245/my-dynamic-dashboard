# Tasks: Backend Packaging Tooling Adoption

**Input**: Design documents from `/specs/011-backend-packaging-tooling-adoption/`
**Prerequisites**: plan.md (template present), spec.md (required)

**Tests**: This feature explicitly requires install, test, lint, version-resolution, and changelog workflow validation with zero behavior change, so validation tasks are included.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish migration guardrails, evidence capture, and backend-only scope boundaries.

- [x] T001 Create migration evidence log in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-013, SC-002]
- [x] T002 Record pre-migration backend dependency and tooling baseline in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-004, FR-005]
- [x] T003 [P] Record pre-migration behavior baseline command outputs in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-013, SC-002]
- [x] T004 [P] Record pre-migration install/setup references inventory in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-011, SC-003]

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the packaging contract and locked tooling baseline before user-story work.

**CRITICAL**: No user story work starts before this phase is complete.

- [x] T005 Create apps/backend/pyproject.toml with [build-system] hatchling+hatch-vcs and [project] metadata skeleton [REQ: FR-001, FR-002]
- [x] T006 Populate runtime dependencies in apps/backend/pyproject.toml [project.dependencies] with parity to apps/backend/requirements.txt [REQ: FR-004]
- [x] T007 Add dev/test extras in apps/backend/pyproject.toml [project.optional-dependencies] for ruff/build/hatch/commitizen and pytest/coverage [REQ: FR-005]
- [x] T008 Configure versioning/build targets in apps/backend/pyproject.toml using [tool.hatch.version], [tool.hatch.build.hooks.vcs], and [tool.hatch.build.targets.wheel] [REQ: FR-002, FR-003]
- [x] T009 Configure pytest and coverage parity settings in apps/backend/pyproject.toml ([tool.pytest.ini_options], [tool.coverage.run], [tool.coverage.report]) [REQ: FR-008, FR-009]
- [x] T010 Configure Ruff and Commitizen policy in apps/backend/pyproject.toml ([tool.ruff], [tool.ruff.lint], [tool.commitizen]) [REQ: FR-006, FR-007]
- [x] T011 Add generated version artifact ignore rule for apps/backend/app/\_version.py in .gitignore [REQ: FR-014]
- [x] T012 Create apps/backend/CHANGELOG.md with initial header for commitizen changelog target [REQ: FR-015]
- [x] T013 Record foundational configuration decisions and parity notes in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-001, FR-006, FR-007, FR-008]

**Checkpoint**: Backend pyproject-based packaging and tooling baseline is defined and traceable.

---

## Phase 3: User Story 1 - Install Backend Consistently From Project Metadata (Priority: P1) 🎯 MVP

**Goal**: Ensure backend installation and setup flows use project metadata instead of requirements.txt.

**Independent Test**: In a fresh backend virtual environment, editable install with dev/test extras succeeds and setup docs match that flow.

### Tests for User Story 1

- [x] T014 [US1] Run editable install validation (pip install -e .[dev,test]) from apps/backend and record evidence in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: SC-001, FR-005]
- [x] T015 [US1] Run runtime install validation (pip install -e .) from apps/backend and record evidence in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-004]

### Implementation for User Story 1

- [x] T016 [US1] Update backend image install flow in apps/backend/Dockerfile to install from apps/backend/pyproject.toml instead of requirements.txt [REQ: FR-011, SC-003]
- [x] T017 [P] [US1] Update backend quick-start installation command in README.md to pyproject-based install [REQ: FR-011]
- [x] T018 [P] [US1] Update backend setup installation command in docs/development/setup.md to pyproject-based install [REQ: FR-011]
- [x] T019 [US1] Remove legacy dependency manifest apps/backend/requirements.txt after pyproject parity is confirmed [REQ: FR-010, SC-003]
- [x] T020 [US1] Record requirements retirement and setup path cleanup evidence in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-010, FR-011, SC-003]

**Checkpoint**: Backend installation is pyproject-driven and requirements.txt is retired from active backend setup.

---

## Phase 4: User Story 2 - Keep Existing Backend Behavior Stable (Priority: P1)

**Goal**: Prove zero behavior change and no backend code movement during packaging/tooling migration.

**Independent Test**: Compare pre/post migration backend test and smoke outputs and verify no behavior-affecting differences.

### Tests for User Story 2

- [x] T021 [US2] Run backend test suite from apps/backend and record post-migration results in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-013, SC-002]
- [x] T022 [US2] Run backend smoke checks (service start and module entrypoint invocation) from apps/backend and record results in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-013]
- [x] T023 [US2] Perform before/after test outcome comparison in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: SC-002]

### Implementation for User Story 2

- [x] T024 [US2] Reconcile pytest settings between apps/backend/pytest.ini and apps/backend/pyproject.toml to keep test discovery behavior unchanged [REQ: FR-009]
- [x] T025 [US2] Audit and record zero file-move evidence for backend code under apps/backend/app in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-012, SC-007]
- [x] T026 [US2] Document zero behavior change attestation tied to SC-002 and SC-007 in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-013, SC-002, SC-007]

**Checkpoint**: Migration is validated as behavior-neutral and structure-preserving.

---

## Phase 5: User Story 3 - Standardize Versioning, Linting, and Changelog Workflow (Priority: P2)

**Goal**: Operationalize tag-based versioning, lint policy, and conventional-commit changelog workflow for backend releases.

**Independent Test**: Version resolution, lint execution, and commitizen dry-run all produce valid outputs under backend scope.

### Tests for User Story 3

- [x] T027 [US3] Run backend version resolution check from apps/backend and record output in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-003, SC-005]
- [x] T028 [US3] Run Ruff check for backend scope from apps/backend and record output in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-006, SC-004]
- [x] T029 [US3] Run commitizen bump dry-run from apps/backend and record output in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-007, SC-006]

### Implementation for User Story 3

- [x] T030 [US3] Verify backend-scoped tag format and SCM version provider settings in apps/backend/pyproject.toml align with apps/backend/v$version policy [REQ: FR-003, FR-007]
- [x] T031 [US3] Verify Ruff line length and rule-family selections in apps/backend/pyproject.toml align with locked baseline [REQ: FR-006]
- [x] T032 [US3] Verify coverage exclude-lines parity and changelog target settings in apps/backend/pyproject.toml and apps/backend/CHANGELOG.md [REQ: FR-008, FR-015]
- [x] T033 [US3] Document release-tooling usage notes for backend maintainers in docs/development/setup.md [REQ: FR-007, FR-015]

**Checkpoint**: Backend release/version/lint/changelog workflows are standardized and reproducible.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final traceability, cleanup, and cross-story validation.

- [x] T034 [P] Run repo-wide reference scan for backend requirements.txt usage and log residual findings in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-010, SC-003]
- [x] T035 Consolidate final requirements-to-evidence traceability table in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-007]
- [x] T036 Validate feature completion checklist against spec acceptance criteria in specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md [REQ: SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-007]

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): Can start immediately.
- Foundational (Phase 2): Depends on Setup; blocks all user stories.
- User Story phases (Phase 3-5): Depend on Foundational completion.
- Polish (Phase 6): Depends on desired user stories being complete.

### User Story Dependencies

- User Story 1 (P1): Starts after Phase 2; independent of US2/US3.
- User Story 2 (P1): Starts after Phase 2; validates migration safety and can run after US1 packaging edits land.
- User Story 3 (P2): Starts after Phase 2; depends on pyproject tooling sections and changelog file being present.

### Task-Level Dependency Highlights

- T019 depends on T006-T007 and T016-T018.
- T021-T023 depend on T024 and completion of US1 migration edits.
- T027-T029 depend on T010, T012, and completion of US1 edits.
- T035 depends on completion of T020, T026, and T033.

---

## Parallel Execution Examples

### User Story 1

- Run T017 and T018 in parallel (different documentation files).

### User Story 2

- Run T021 and T022 in parallel once migration edits are complete.

### User Story 3

- Run T028 and T029 in parallel after tooling config is finalized.

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete US1 (Phase 3).
3. Validate editable/runtime install paths and requirements retirement.

### Incremental Delivery

1. Land packaging foundation.
2. Land install workflow migration and validate (US1).
3. Land behavior-stability validation and no-move attestation (US2).
4. Land release-tooling operationalization and validation (US3).
5. Finish traceability and final checks (Phase 6).

### Parallel Team Strategy

1. One maintainer finalizes pyproject baseline (Phase 2).
2. In parallel after Phase 2: docs/setup updates (US1), behavior evidence gathering (US2), tooling-run validations (US3).
3. Merge with final traceability pass in Phase 6.

---

## Notes

- Backend-only scope: all implementation edits are constrained to backend packaging/tooling files and shared docs that describe backend setup.
- Zero behavior change: all behavior checks must be evidence-backed in migration-evidence.md.
- No code moves: backend app layout under apps/backend/app remains untouched in this feature.
