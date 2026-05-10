# Tasks: Dashboard Streamlit Foundation Audit

**Input**: Design documents from `/specs/014-dashboard-streamlit-foundation-audit/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include dashboard unit and integration tests because test-layer governance is explicitly required in spec.md (FR-008, FR-009).

**Organization**: Tasks are grouped by user story so each story can be implemented, validated, and reconciled independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label ([US1], [US2], [US3])
- Every task includes at least one concrete file path for implementation/evidence traceability

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish dashboard scaffolding and evidence surfaces used by all stories.

- [x] T001 [FR-001] Create dashboard package root and namespace files in `apps/dashboard/src/dashboard/__init__.py` and `apps/dashboard/src/dashboard/resources/__init__.py`
- [x] T002 [FR-008] Create dashboard pytest scaffolding in `apps/dashboard/pytest.ini`, `apps/dashboard/tests/unit/__init__.py`, and `apps/dashboard/tests/integration/__init__.py`
- [x] T003 [P] [FR-008] Create shared dashboard test fixtures shell in `apps/dashboard/tests/conftest.py`
- [x] T004 [P] [NFR-002] Create reconciliation evidence ledger in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- [x] T005 [NFR-002] Add dashboard command anchors for this feature in `specs/014-dashboard-streamlit-foundation-audit/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build common governance primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T006 [FR-001] Implement shared dashboard package exports in `apps/dashboard/src/dashboard/api/__init__.py`, `apps/dashboard/src/dashboard/core/__init__.py`, `apps/dashboard/src/dashboard/components/__init__.py`, and `apps/dashboard/src/dashboard/utils/__init__.py`
- [x] T007 [P] [FR-001] Add foundational core primitives in `apps/dashboard/src/dashboard/core/base.py` and `apps/dashboard/src/dashboard/core/errors.py`
- [x] T008 [P] [FR-001,FR-003] Add baseline backend client contract shell in `apps/dashboard/src/dashboard/api/backend_client.py`
- [x] T009 [FR-004,FR-005] Add environment governance helper shell in `apps/dashboard/src/dashboard/utils/env_helper.py`
- [x] T010 [FR-001] Add shared logging helper shell in `apps/dashboard/src/dashboard/utils/logger.py`
- [x] T011 [NFR-002] Record foundational completion evidence in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

**Checkpoint**: Foundation ready; user story implementation can proceed.

---

## Phase 3: User Story 1 - Establish Dashboard Structural Parity (Priority: P1) 🎯 MVP

**Goal**: Reorganize dashboard modules into canonical backend-parity package boundaries with entrypoint import integrity.

**Independent Test**: `streamlit_app.py` imports resolve through `dashboard.*` package paths and structural tests pass without relying on legacy module locations.

### Tests for User Story 1

- [x] T012 [P] [US1] [FR-001,SC-005] Add unit structure-governance test in `apps/dashboard/tests/unit/test_module_layout.py`
- [x] T013 [P] [US1] [FR-002,SC-005] Add integration entrypoint import smoke test in `apps/dashboard/tests/integration/test_streamlit_entrypoint_imports.py`

### Implementation for User Story 1

- [x] T014 [P] [US1] [FR-001] Migrate API module to canonical layer in `apps/dashboard/src/dashboard/api/backend_client.py` from `apps/dashboard/src/api/dashboard_api.py`
- [x] T015 [P] [US1] [FR-001] Migrate component modules to canonical layer in `apps/dashboard/src/dashboard/components/dashboard_header.py`, `apps/dashboard/src/dashboard/components/parameter_panel.py`, `apps/dashboard/src/dashboard/components/query_panel.py`, and `apps/dashboard/src/dashboard/components/export_controls.py`
- [x] T016 [P] [US1] [FR-001] Migrate chart renderer module to canonical layer in `apps/dashboard/src/dashboard/components/chart_viewer.py`
- [x] T017 [US1] [FR-002] Rewire entrypoint imports to canonical package paths in `apps/dashboard/streamlit_app.py`
- [x] T018 [US1] [FR-001,FR-002] Remove legacy duplicate module surfaces in `apps/dashboard/src/api/__init__.py`, `apps/dashboard/src/api/dashboard_api.py`, `apps/dashboard/src/components/__init__.py`, `apps/dashboard/src/components/dashboard_header.py`, `apps/dashboard/src/components/parameter_panel.py`, `apps/dashboard/src/components/query_panel.py`, `apps/dashboard/src/components/chart_viewer.py`, and `apps/dashboard/src/components/export_controls.py`
- [x] T019 [US1] [NFR-002] Record structural parity evidence in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

**Checkpoint**: US1 is complete and independently testable.

---

## Phase 4: User Story 2 - Centralize Configuration and Environment Access (Priority: P1)

**Goal**: Route all runtime configuration and environment-dependent values through a single dashboard config-manager path.

**Independent Test**: Config precedence tests pass and governance scan proves zero ad-hoc `os.getenv`/`os.environ` reads in disallowed dashboard runtime modules.

### Tests for User Story 2

- [x] T020 [P] [US2] [FR-003,FR-005,SC-001] Add unit config precedence/validation tests in `apps/dashboard/tests/unit/test_app_config.py`
- [x] T021 [P] [US2] [FR-004,SC-002] Add integration env-governance scan test in `apps/dashboard/tests/integration/test_env_policy_scan.py`

### Implementation for User Story 2

- [x] T022 [US2] [FR-003,FR-005,SC-001] Implement centralized DashboardAppConfig and accessors in `apps/dashboard/src/dashboard/shared.py`
- [x] T023 [P] [US2] [FR-005] Add deterministic default configuration resource in `apps/dashboard/src/dashboard/resources/default.yaml`
- [x] T024 [US2] [FR-004] Implement approved environment read path in `apps/dashboard/src/dashboard/utils/env_helper.py`
- [x] T025 [US2] [FR-003,SC-001] Refactor backend client configuration usage to DashboardAppConfig in `apps/dashboard/src/dashboard/api/backend_client.py`
- [x] T026 [US2] [FR-003,FR-004,SC-001] Refactor entrypoint runtime configuration reads through DashboardAppConfig in `apps/dashboard/streamlit_app.py`
- [x] T027 [P] [US2] [FR-003,FR-004,SC-001] Refactor component configuration reads through DashboardAppConfig in `apps/dashboard/src/dashboard/components/parameter_panel.py`, `apps/dashboard/src/dashboard/components/query_panel.py`, and `apps/dashboard/src/dashboard/components/export_controls.py`
- [x] T028 [US2] [NFR-001,SC-002] Record environment-policy scan evidence and config parity notes in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

**Checkpoint**: US2 is complete and independently testable.

---

## Phase 5: User Story 3 - Align Tooling, Packaging, and Build Flow (Priority: P2)

**Goal**: Move dashboard packaging and build/test workflow to pyproject parity with explicit unit/integration test-layer governance.

**Independent Test**: Dashboard installs via pyproject workflow, Docker uses package-based install path, and layer-specific test commands are documented and runnable.

### Tests for User Story 3

- [x] T029 [P] [US3] [FR-006,SC-004] Add unit packaging metadata validation tests in `apps/dashboard/tests/unit/test_packaging_contract.py`
- [x] T030 [P] [US3] [FR-007,SC-004] Add integration Docker/install-flow verification test in `apps/dashboard/tests/integration/test_docker_install_contract.py`

### Implementation for User Story 3

- [x] T031 [US3] [FR-006,SC-004] Author dashboard package/tooling contract in `apps/dashboard/pyproject.toml`
- [x] T032 [US3] [FR-007,SC-004] Migrate dashboard container install flow in `apps/dashboard/Dockerfile`
- [x] T033 [US3] [FR-007] Scope requirements fallback usage and migration note in `apps/dashboard/requirements.txt`
- [x] T034 [US3] [FR-010,NFR-002] Document dashboard layout/config/tooling/test matrix in `apps/dashboard/README.md`
- [x] T035 [US3] [FR-010,NFR-002] Update workspace setup guide for dashboard pyproject and layer commands in `docs/development/setup.md`
- [x] T036 [US3] [SC-004,NFR-002] Record package-install and Docker build evidence in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

**Checkpoint**: US3 is complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final reconciliation, governance verification, and release-readiness evidence.

- [x] T037 [P] [FR-008,SC-003,NFR-001] Run full dashboard unit and integration command matrix and record outputs in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- [x] T038 [P] [FR-004,SC-002,NFR-001] Run environment-access governance scan and record zero-violation evidence in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- [x] T039 [FR-011,SC-005] Execute dashboard smoke parity walkthrough and record pre/post observations in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- [x] T040 [NFR-003] Validate feature scope guardrail with changed-file audit and record results in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 and uses canonical structure from US1 for lowest-risk migration.
- **Phase 5 (US3)**: Depends on Phase 2; can start after US1 if ownership is split, but should merge after US2 to avoid packaging stale paths.
- **Phase 6 (Polish)**: Depends on completion of selected user stories (minimum MVP = US1 + US2).

### User Story Dependencies

- **US1 (P1)**: Foundation for canonical module layout; no dependency on other stories.
- **US2 (P1)**: Independent from US3, but structurally safer after US1 migration.
- **US3 (P2)**: Independent business value, but operationally best after US1/US2 path stabilization.

### Within-Story Ordering Rules

- Tests are authored before implementation tasks in each user story.
- Package/layout migration precedes entrypoint rewiring for US1.
- AppConfig/default resource and env helper precede module refactors for US2.
- `pyproject.toml` authoring precedes Docker/build/doc updates for US3.

---

## Parallel Execution Examples

### US1 Parallel Block

- Run T012 and T013 together (different test files).
- Run T014, T015, and T016 together (different implementation files).

### US2 Parallel Block

- Run T020 and T021 together (different test files).
- Run T023 and T027 together after T022 (resource + component refactors).

### US3 Parallel Block

- Run T029 and T030 together (different test files).
- Run T034 and T035 together after T031/T032 (docs in different paths).

---

## Reconciliation Evidence Map

- **FR-001 / FR-002 / SC-005**: T012-T019 with evidence captured in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- **FR-003 / FR-004 / FR-005 / SC-001 / SC-002**: T020-T028 with evidence captured in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- **FR-006 / FR-007 / FR-008 / FR-009 / FR-010 / SC-003 / SC-004**: T029-T036 with evidence captured in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`
- **NFR-001 / NFR-002 / NFR-003**: T037-T040 with evidence captured in `specs/014-dashboard-streamlit-foundation-audit/checklists/reconciliation.md`

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 structural parity and validate imports.
3. Deliver US2 config/env centralization and validate zero ad-hoc env access.
4. Pause for reconciliation sign-off using `checklists/reconciliation.md`.

### Incremental Delivery

1. Foundation complete.
2. US1 complete and validated.
3. US2 complete and validated.
4. US3 packaging/build parity complete and validated.
5. Polish phase finalizes repeatable evidence and scope guardrail proof.

### Parallel Team Strategy

1. One maintainer executes foundational package/test scaffold (Phase 1-2).
2. Structural refactor owner executes US1 while config owner prepares US2 tests.
3. Release/tooling owner executes US3 once module paths stabilize.
4. Shared final pass completes Phase 6 reconciliation evidence.

---

## Notes

- `[P]` tasks are scoped to different files and can run in parallel.
- Story labels map implementation and evidence directly to spec user stories.
- Each phase checkpoint is designed for independent verification and reconciliation.
- Contract/perf tests are intentionally excluded for this round by spec policy.
