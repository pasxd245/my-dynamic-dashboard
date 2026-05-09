# Tasks: Upload + Profile + Field Roles (MVP 1)

Input: design documents from /specs/001-upload-profile-field-roles/
Prerequisites: plan.md, spec.md, research.md, data-model.md, contracts/upload-profile-roles.openapi.yaml, quickstart.md

Tests: Included per phase as requested.
Organization: Tasks are grouped by user story so each story remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare repo structure and test harness for backend + builder work.

- [x] T001 Add MVP 1 domain module stubs in apps/backend/app/services/profile_service.py and apps/backend/app/services/manifest_service.py
- [x] T002 Add backend test package scaffolding in apps/backend/tests/contract/**init**.py and apps/backend/tests/integration/**init**.py
- [x] T003 [P] Add builder API client scaffold in apps/builder/src/api/workspaceApi.js
- [x] T004 Add backend test configuration in apps/backend/pytest.ini
- [x] T005 Add setup smoke test for backend app boot in apps/backend/tests/integration/test_app_boot.py

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared persistence, schemas, and API wiring required by all stories.

CRITICAL: Complete this phase before any user story implementation.

- [x] T006 Add workspace/source/sheet/column/profile/role/override/manifest table creation in apps/backend/app/core/metadata_db.py
- [x] T007 [P] Add core request/response models (workspace, sheet, profile, role, readiness, manifest) in apps/backend/app/schemas.py
- [x] T008 [P] Add deterministic JSON and SHA-256 hash utilities in apps/backend/app/services/manifest_service.py
- [x] T009 Add shared API error mapping for validation/upload/hash mismatch flows in apps/backend/app/main.py
- [x] T010 Add foundational DB schema verification test in apps/backend/tests/integration/test_metadata_schema.py
- [x] T011 Add foundational API schema contract smoke test in apps/backend/tests/contract/test_schema_contract_smoke.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Upload and Parse Sources (Priority: P1) MVP

Goal: Upload one or more CSV/XLSX sources, detect sheet ranges/types, and support sheet override recompute.
Independent Test: Upload bundled sample files, verify all sheets and inferred types appear, then override one sheet and confirm only that sheet recomputes.

### Tests for User Story 1

- [x] T012 [P] [US1] Add contract test for create workspace and upload source endpoints in apps/backend/tests/contract/test_upload_parse_contract.py
- [x] T013 [P] [US1] Add integration test for sheet header/range override recompute isolation in apps/backend/tests/integration/test_sheet_override_reparse.py
- [x] T014 [P] [US1] Add integration test for ambiguous CSV delimiter/encoding confirmation behavior in apps/backend/tests/integration/test_csv_ambiguity_flow.py

### Implementation for User Story 1

- [x] T015 [US1] Implement create workspace endpoint POST /api/v1/workspaces in apps/backend/app/main.py
- [x] T016 [US1] Implement upload endpoint POST /api/v1/workspaces/{workspaceId}/sources/upload (xlsx/csv parse + encrypted rejection) in apps/backend/app/main.py and apps/backend/app/services/upload_service.py
- [x] T017 [US1] Implement sheet override endpoint PATCH /api/v1/workspaces/{workspaceId}/sheets/{sheetId}/override in apps/backend/app/main.py and apps/backend/app/services/upload_service.py
- [x] T018 [US1] Persist source/sheet/column parse results and override logs in apps/backend/app/core/metadata_db.py
- [x] T019 [US1] Implement builder upload + sheet parse inspector + override action wiring in apps/builder/src/App.jsx and apps/builder/src/api/workspaceApi.js

Checkpoint: US1 is independently functional.

---

## Phase 4: User Story 2 - Column Quality Profiles (Priority: P1)

Goal: Compute and present per-column quality profiles and warnings, including sampled profiling metadata.
Independent Test: Use mixed-type and duplicate-heavy columns; verify warnings, null/distinct/range/top-K, and sampled markers for oversized files.

### Tests for User Story 2

- [x] T020 [P] [US2] Add contract test for GET /api/v1/workspaces/{workspaceId}/profile in apps/backend/tests/contract/test_profile_contract.py
- [x] T021 [P] [US2] Add integration test for mixed-type, sentinel, and date-window warnings in apps/backend/tests/integration/test_profile_warnings.py
- [x] T022 [P] [US2] Add integration test for sampled profiling metadata (sampleSize/sampleSeed) in apps/backend/tests/integration/test_profile_sampling.py

### Implementation for User Story 2

- [x] T023 [US2] Implement profile computation (null/distinct/uniqueness/range/top-K/warnings) in apps/backend/app/services/profile_service.py
- [x] T024 [US2] Implement sampled profiling thresholds and deterministic sample seed persistence in apps/backend/app/services/profile_service.py
- [x] T025 [US2] Implement profile persistence/retrieval in apps/backend/app/core/metadata_db.py
- [x] T026 [US2] Implement profile endpoint GET /api/v1/workspaces/{workspaceId}/profile in apps/backend/app/main.py
- [x] T027 [US2] Implement builder profile panel for quality metrics and warnings in apps/builder/src/App.jsx

Checkpoint: US2 is independently functional.

---

## Phase 5: User Story 3 - Assign Business Field Roles (Priority: P1)

Goal: Assign controlled business roles with hard/soft compatibility rules, override auditing, readiness status, and traceable role summaries.
Independent Test: Assign all required roles, verify hard failures for invalid time anchor, soft override requirements for identity/measure, and persisted readiness status.

### Tests for User Story 3

- [x] T028 [P] [US3] Add contract test for PUT /api/v1/workspaces/{workspaceId}/columns/{columnId}/roles and GET /api/v1/workspaces/{workspaceId}/readiness in apps/backend/tests/contract/test_roles_readiness_contract.py
- [x] T029 [P] [US3] Add integration test for hard time-anchor rejection and soft override-required paths in apps/backend/tests/integration/test_role_compatibility.py
- [x] T030 [P] [US3] Add integration test for readiness blocking on unresolved CRITICAL warnings in apps/backend/tests/integration/test_readiness_critical_warnings.py

### Implementation for User Story 3

- [x] T031 [US3] Implement role compatibility engine (hard/soft constraints) in apps/backend/app/services/profile_service.py
- [x] T032 [US3] Implement role assignment persistence and override audit writes in apps/backend/app/core/metadata_db.py
- [x] T033 [US3] Implement role assignment endpoint and readiness endpoint in apps/backend/app/main.py
- [x] T034 [US3] Implement field-role summary with source-sheet-column traceability metadata in apps/backend/app/schemas.py
- [x] T035 [US3] Implement builder role assignment UX (override reason capture, readiness badge, traceability links) in apps/builder/src/App.jsx

Checkpoint: US3 is independently functional and provides MVP 1 readiness evaluation.

---

## Phase 6: User Story 4 - Reproducible Manifest Export/Import (Priority: P2)

Goal: Export versioned workspace manifest and import with hash verification for reproducible reconstruction.
Independent Test: Export manifest, import on fresh workspace with same files for zero diffs; modified file must block import with hash-diff report.

### Tests for User Story 4

- [x] T036 [P] [US4] Add contract test for POST /api/v1/workspaces/{workspaceId}/manifest/export and POST /api/v1/workspaces/manifest/import in apps/backend/tests/contract/test_manifest_contract.py
- [x] T037 [P] [US4] Add integration test for manifest round-trip reproducibility in apps/backend/tests/integration/test_manifest_roundtrip.py
- [x] T038 [P] [US4] Add integration test for hash mismatch blocking and diff response in apps/backend/tests/integration/test_manifest_hash_mismatch.py

### Implementation for User Story 4

- [x] T039 [US4] Implement manifest export serialization with deterministic ordering in apps/backend/app/services/manifest_service.py
- [x] T040 [US4] Implement manifest import reconstruction and hash verification in apps/backend/app/services/manifest_service.py
- [x] T041 [US4] Implement manifest export/import endpoints in apps/backend/app/main.py
- [x] T042 [US4] Persist manifest snapshots and hash-diff diagnostics in apps/backend/app/core/metadata_db.py
- [x] T043 [US4] Implement builder manifest export/import actions and mismatch feedback in apps/builder/src/App.jsx and apps/builder/src/api/workspaceApi.js

Checkpoint: US4 is independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

Purpose: Final quality gates against success criteria and quickstart validation.

- [x] T044 Add end-to-end MVP1 flow regression test (upload -> profile -> roles -> readiness -> manifest) in apps/backend/tests/integration/test_mvp1_flow.py
- [x] T045 [P] Add SC-005 latency guard test for malformed/encrypted upload error path in apps/backend/tests/integration/test_upload_error_latency.py
- [x] T046 [P] Add SC-001 execution-time benchmark harness for sample workspace setup in apps/backend/tests/integration/test_sample_workspace_timing.py
- [x] T047 Update execution and verification notes for implemented flow in specs/001-upload-profile-field-roles/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Phase 1 and blocks all story phases.
- User stories (Phase 3-6): depend on Phase 2; execute by priority order P1 (US1-US3) then P2 (US4).
- Polish (Phase 7): depends on completion of US1-US4.

### User Story Dependencies

- US1: starts after Phase 2.
- US2: starts after US1 parse/persist endpoints (T016-T018).
- US3: starts after US2 profile computation and retrieval (T023-T026).
- US4: starts after US1-US3 state persistence and readiness structures (T018, T025, T032-T034).

### Within-Story Ordering Rules

- Test tasks first, then service logic, then endpoint wiring, then UI integration.
- Tasks marked [P] are parallelizable when no incomplete dependency exists.

## Parallel Opportunities

- Phase 1: T003 can run with T001-T002.
- Phase 2: T007 and T008 can run in parallel after T006 starts.
- US1: T012-T014 parallel; then T015-T018; then T019.
- US2: T020-T022 parallel; then T023-T026; then T027.
- US3: T028-T030 parallel; then T031-T034; then T035.
- US4: T036-T038 parallel; then T039-T042; then T043.
- Phase 7: T045 and T046 parallel after T044.

## Requirement Traceability Matrix

### Functional Requirements -> Tasks

- FR-001: T016, T018, T019
- FR-002: T017, T018, T019
- FR-003: T007, T018, T034
- FR-004: T023, T025, T026, T027
- FR-005: T031, T032, T033, T035
- FR-006: T029, T031, T033
- FR-007: T008, T039, T042
- FR-008: T036, T037, T038, T040, T041
- FR-009: T030, T033, T035
- FR-010: T017, T018, T032
- FR-011: T034, T035
- FR-012: T014, T016, T045
- FR-013: T022, T024, T025, T027

### Success Criteria -> Tasks

- SC-001: T044, T046, T047
- SC-002: T029, T030, T031, T033
- SC-003: T037, T039, T040, T041
- SC-004: T034, T035, T044
- SC-005: T014, T016, T045

## Suggested MVP Scope

MVP delivery slice: complete through Phase 5 (US1-US3), validate readiness behavior, then ship Phase 6 (US4) for full reproducibility compliance.

## Format Validation

All tasks follow required checklist format:

- Checkbox: - [ ]
- Task IDs: T001-T047 in dependency order
- [P] marker used only for parallelizable tasks
- [USx] labels used only in user story phases
- Each task includes actionable description and concrete repository file path(s)
