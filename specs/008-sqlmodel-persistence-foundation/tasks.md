# Tasks: SQLModel Persistence Foundation (Spec 008)

**Input**: Design documents from `/specs/008-sqlmodel-persistence-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/persistence-bootstrap.contract.yaml

Tests: Included because this feature requires explicit parity, migration safety, idempotence, and regression verification (SC-001 through SC-005).
Organization: Tasks are grouped by user story so each story is independently implementable and testable, while preserving Round 22 lock decisions.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare dependency and migration scaffolding for implementation.

- [x] T001 [FR-001] Pin sqlmodel, sqlalchemy, and alembic backend dependencies in apps/backend/requirements.txt
- [x] T002 [FR-008] Create Alembic configuration scaffold in apps/backend/alembic.ini
- [x] T003 [P] [FR-008] Create Alembic runtime scaffold in apps/backend/alembic/env.py and apps/backend/alembic/script.py.mako
- [x] T004 [P] [FR-002, FR-003] Create model package scaffold in apps/backend/app/models/**init**.py, apps/backend/app/models/workspace.py, apps/backend/app/models/source.py, apps/backend/app/models/legacy_files.py, apps/backend/app/models/relationship.py, apps/backend/app/models/saved_query.py, apps/backend/app/models/dashboard.py, apps/backend/app/models/deployment.py, and apps/backend/app/models/column_mappings.py
- [x] T005 [P] [SC-002, SC-004, SC-005] Create migration verification test scaffolds in apps/backend/tests/integration/test_metadata_schema_parity.py, apps/backend/tests/integration/test_metadata_startup_migrations.py, apps/backend/tests/integration/test_column_mappings_migration.py, and apps/backend/tests/integration/test_service_layer_scope_guards.py
- [x] T006 [P] [SC-002, SC-004] Add shared migration test fixtures for isolated metadata DB paths in apps/backend/tests/conftest.py

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared runtime foundations required before any user story.

CRITICAL: Complete this phase before starting user story phases.

- [x] T007 [FR-006] Add typed metadata DB environment helpers including METADATA_DB_PATH in apps/backend/app/utils/env_helper.py
- [x] T008 [FR-007] Implement SQLModel engine/session factory and get_session dependency in apps/backend/app/core/db.py
- [x] T009 [FR-006, FR-007] Route metadata DB path resolution through env helpers in apps/backend/app/core/metadata_db.py
- [x] T010 [FR-008] Configure Alembic target metadata and database URL wiring in apps/backend/alembic/env.py
- [x] T011 [FR-010, FR-012] Implement startup migration bootstrap orchestrator (detect, stamp, upgrade) in apps/backend/app/core/metadata_migrations.py
- [x] T012 [FR-010] Wire startup to call migration bootstrap entry point in apps/backend/app/main.py

Checkpoint: Foundation complete. User story implementation can begin.

---

## Phase 3: User Story 1 - Preserve Behavior While Migrating Schema Ownership (Priority: P1) MVP

Goal: Move legacy schema ownership to declarative models and baseline migration with parity guarantees.

Independent Test: Build a fresh migrated DB and compare schema parity against legacy definitions, allowing only alembic_version and column_mappings additions.

### Tests for User Story 1

- [x] T013 [P] [US1] [FR-004, SC-002] Implement schema parity integration test for legacy table and column coverage in apps/backend/tests/integration/test_metadata_schema_parity.py
- [x] T014 [P] [US1] [FR-004, SC-002] Add explicit saved-query additive-column parity assertions in apps/backend/tests/integration/test_metadata_schema_parity.py

### Implementation for User Story 1

- [x] T015 [P] [US1] [FR-002, FR-004] Implement workspace and source declarative models in apps/backend/app/models/workspace.py and apps/backend/app/models/source.py
- [x] T016 [P] [US1] [FR-002, FR-004] Implement legacy files and relationship declarative models in apps/backend/app/models/legacy_files.py and apps/backend/app/models/relationship.py
- [x] T017 [P] [US1] [FR-002, FR-004] Implement saved query, dashboard, and deployment declarative models in apps/backend/app/models/saved_query.py, apps/backend/app/models/dashboard.py, and apps/backend/app/models/deployment.py
- [x] T018 [US1] [FR-002, FR-004] Register all parity model metadata exports in apps/backend/app/models/**init**.py
- [x] T019 [US1] [FR-009, SC-002] Implement baseline Alembic revision using explicit per-model op.create_table operations for 26 legacy tables in apps/backend/alembic/versions/0001_baseline.py
- [x] T020 [US1] [FR-009, SC-002] Encode baseline indexes and constraints parity in apps/backend/alembic/versions/0001_baseline.py
- [x] T021 [US1] [FR-004, FR-019, SC-002] Record schema parity verification evidence and allowed additions in specs/008-sqlmodel-persistence-foundation/quickstart.md

Checkpoint: US1 is independently functional and validates parity-based schema ownership.

---

## Phase 4: User Story 2 - Safe Boot-Time Migration for New and Existing Databases (Priority: P1)

Goal: Ensure deterministic startup migration behavior for fresh, untracked-existing, and tracked-existing metadata DBs.

Independent Test: Execute startup on fresh and existing untracked DBs, verify auto-stamp then upgrade path, and confirm idempotence on repeated startup.

### Tests for User Story 2

- [x] T022 [P] [US2] [FR-010, SC-004] Add fresh DB startup migration integration test in apps/backend/tests/integration/test_metadata_startup_migrations.py
- [x] T023 [P] [US2] [FR-012, SC-004] Add existing untracked DB auto-stamp integration test in apps/backend/tests/integration/test_metadata_startup_migrations.py
- [x] T024 [P] [US2] [FR-012, SC-003] Add repeated startup idempotence integration test in apps/backend/tests/integration/test_metadata_startup_migrations.py

### Implementation for User Story 2

- [x] T025 [US2] [FR-012, SC-004] Implement detect-state and stamp-then-upgrade flow in apps/backend/app/core/metadata_migrations.py
- [x] T026 [US2] [FR-010] Replace normal startup-path reliance on init_metadata_db with migration upgrade flow in apps/backend/app/main.py
- [x] T027 [US2] [FR-011] Keep init_metadata_db present but rollback-only and non-primary in apps/backend/app/core/metadata_db.py
- [x] T028 [US2] [FR-006, FR-012] Wire METADATA_DB_PATH into Alembic runtime config and sqlite URL resolution in apps/backend/alembic/env.py and apps/backend/alembic.ini
- [x] T029 [US2] [FR-012] Add structured startup migration step logging (detect_state, stamp_head, upgrade_head) in apps/backend/app/core/metadata_migrations.py
- [x] T030 [US2] [FR-012, SC-003, SC-004] Record auto-stamp and idempotence verification outcomes in specs/008-sqlmodel-persistence-foundation/quickstart.md

Checkpoint: US2 is independently functional and startup migration behavior is deterministic.

---

## Phase 5: User Story 3 - Pre-Stage Column Rename Mapping Persistence (Priority: P2)

Goal: Add the column_mappings persistence foundation with required shape and constraints, without runtime dependency.

Independent Test: Validate column_mappings schema fields/constraints and confirm no current runtime workflow depends on this table.

### Tests for User Story 3

- [x] T031 [P] [US3] [FR-005, SC-002] Add column_mappings migration shape and constraint integration test in apps/backend/tests/integration/test_column_mappings_migration.py
- [x] T032 [P] [US3] [FR-018, SC-005] Add runtime non-dependency assertion test for column_mappings in apps/backend/tests/integration/test_column_mappings_migration.py

### Implementation for User Story 3

- [x] T033 [US3] [FR-003, FR-005] Implement column_mappings SQLModel (fields, FKs, nullability, confidence bounds) in apps/backend/app/models/column_mappings.py
- [x] T034 [US3] [FR-003] Register column_mappings metadata ownership in apps/backend/app/models/**init**.py
- [x] T035 [US3] [FR-009] Implement additive Alembic migration for column_mappings in apps/backend/alembic/versions/0002_column_mappings.py
- [x] T036 [US3] [FR-005, FR-009] Add column_mappings indexes and FK constraints in apps/backend/alembic/versions/0002_column_mappings.py
- [x] T037 [US3] [FR-005, FR-018] Document column_mappings future-use posture and current no-runtime-dependency boundary in specs/008-sqlmodel-persistence-foundation/quickstart.md

Checkpoint: US3 is independently functional and remains foundation-only.

---

## Phase 6: User Story 4 - Preserve Current Service Layer Contract (Priority: P2)

Goal: Keep raw sqlite3 service behavior unchanged while exposing future ORM hooks only as non-used foundations.

Independent Test: Verify existing service modules continue sqlite3 access patterns and no endpoint flow requires ORM session migration in this round.

### Tests for User Story 4

- [x] T038 [P] [US4] [FR-015, SC-005] Add guardrail test asserting sqlite3 usage remains active in backend services in apps/backend/tests/integration/test_service_layer_scope_guards.py
- [x] T039 [P] [US4] [FR-016, SC-005] Add guardrail test asserting startup and handlers do not require SQLModel session migration in apps/backend/tests/integration/test_service_layer_scope_guards.py

### Implementation for User Story 4

- [x] T040 [US4] [FR-007, FR-016] Keep get_session export available for future rounds without wiring service handlers to ORM sessions in apps/backend/app/core/db.py and apps/backend/app/main.py
- [x] T041 [US4] [FR-016, FR-017, FR-018, FR-019] Document explicit out-of-scope boundaries (no ORM service rewrite, no schema reshape) in specs/008-sqlmodel-persistence-foundation/quickstart.md
- [x] T042 [US4] [FR-013, FR-015] Document raw sqlite3 service-layer contract and migration boundary in docs/development/setup.md
- [x] T043 [US4] [FR-015, FR-016, FR-017, FR-018, SC-005] Record service-layer unchanged verification evidence in specs/008-sqlmodel-persistence-foundation/quickstart.md

Checkpoint: US4 is independently functional and scope boundaries are enforced.

---

## Phase 7: Polish & Cross-Cutting Concerns

Purpose: Finalize operational documentation and full verification evidence for Round 22 release gating.

- [x] T044 [P] [FR-014, SC-001] Capture unchanged backend test-suite execution evidence in specs/008-sqlmodel-persistence-foundation/quickstart.md
- [x] T045 [P] [SC-003] Capture migration idempotence evidence for upgrade -> downgrade -> upgrade in specs/008-sqlmodel-persistence-foundation/quickstart.md
- [x] T046 [P] [FR-019, SC-002] Capture legacy-vs-migrated schema diff evidence in specs/008-sqlmodel-persistence-foundation/quickstart.md
- [x] T047 [FR-006, FR-013] Update migration bootstrap, metadata reset flow, and METADATA_DB_PATH operator guidance in docs/development/setup.md and devops/README.md
- [x] T048 [FR-001, FR-019, SC-001, SC-005] Validate FR-001 through FR-019 task traceability and update requirement mapping notes in specs/008-sqlmodel-persistence-foundation/tasks.md
- [x] T049 [P] [FR-006, FR-013] Add METADATA_DB_PATH local/container usage examples in docs/development/setup.md
- [x] T050 [SC-001, SC-002, SC-003, SC-004, SC-005] Finalize Round 22 verification checklist and completion notes in specs/008-sqlmodel-persistence-foundation/tasks.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup and blocks all user stories.
- User Story phases (Phase 3 through Phase 6): Depend on Foundational completion.
- Polish (Phase 7): Depends on completion of all required user stories.

### User Story Dependencies

- US1 (P1): Starts after Foundational and delivers model parity plus baseline migration ownership.
- US2 (P1): Starts after Foundational and can run in parallel with US1, then integrates startup flow with migration artifacts from US1.
- US3 (P2): Depends on US1 baseline migration lineage and model registry.
- US4 (P2): Depends on Foundational wiring and validates scope guardrails after US1 and US2 integration.

### Within-Story Ordering Rules

- Write tests first for each story and confirm they fail before implementation.
- Implement models before migration revisions that depend on model metadata.
- Implement migration bootstrap orchestration before startup wiring changes.
- Complete story verification evidence before marking story checkpoint complete.
- Tasks marked [P] are parallelizable only when prerequisites are complete.

---

## Parallel Execution Opportunities

### User Story 1 (US1)

- T013 and T014 can be implemented in parallel.
- T015, T016, and T017 can be implemented in parallel.

### User Story 2 (US2)

- T022, T023, and T024 can be implemented in parallel.
- T028 and T029 can proceed in parallel after T025.

### User Story 3 (US3)

- T031 and T032 can be implemented in parallel.
- T035 and T036 can be implemented together once T033 and T034 are complete.

### User Story 4 (US4)

- T038 and T039 can be implemented in parallel.
- T041 and T042 can be implemented in parallel after T040.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 model parity and baseline migration ownership.
3. Deliver US2 startup migration bootstrap with auto-stamp and idempotence.
4. Validate parity + startup safety gates before continuing.

### Incremental Delivery

1. Foundation complete -> execute US1 and US2 in priority order.
2. Add US3 column_mappings foundation with no runtime dependency.
3. Add US4 guardrail verification and scope-boundary documentation.
4. Execute Polish phase evidence capture for release signoff.

### Round 22 Focus

- Gate A: Baseline migration is explicit per-model op.create_table.
- Gate B: Existing untracked DB path auto-stamps before upgrade.
- Gate C: Service-layer sqlite3 contract remains unchanged.

---

## Task Count Summary

- Total tasks: 50
- Setup: 6
- Foundational: 6
- US1: 9
- US2: 9
- US3: 7
- US4: 6
- Polish: 7

## Requirement Traceability Notes

- FR-001 -> T001
- FR-002 -> T004, T015, T016, T017, T018
- FR-003 -> T004, T033, T034
- FR-004 -> T013, T014, T019, T020, T021
- FR-005 -> T031, T033, T035, T036, T037
- FR-006 -> T007, T009, T047, T049
- FR-007 -> T008, T040
- FR-008 -> T002, T003, T010
- FR-009 -> T019, T020, T035, T036
- FR-010 -> T011, T012, T026
- FR-011 -> T027
- FR-012 -> T023, T025, T028, T029, T030
- FR-013 -> T042, T047, T049
- FR-014 -> T044
- FR-015 -> T038, T042, T043
- FR-016 -> T039, T040, T041, T043
- FR-017 -> T041, T043
- FR-018 -> T037, T041, T043
- FR-019 -> T021, T041, T046

## Round 22 Verification Checklist

- [x] Gate A locked: baseline migration remains explicit per-model `op.create_table()` lineage.
- [x] Gate B locked: existing untracked DB verification shows auto-stamp then upgrade to head.
- [x] Gate C locked: service-layer runtime contract remains raw `sqlite3` with no handler session migration.
- [x] SC-001 evidence captured: full backend suite ran unchanged and passed.
- [x] SC-002 evidence captured: legacy-vs-migrated schema diff is clean except for `alembic_version` and `column_mappings`.
- [x] SC-003 evidence captured: upgrade -> downgrade -> upgrade returns to `0002_column_mappings (head)`.
- [x] SC-004 evidence captured: startup auto-stamp path succeeds for existing untracked DBs.
- [x] SC-005 evidence captured: service-layer guard tests confirm unchanged runtime boundary.

## Completion Notes

- 2026-05-10: Remaining documentation/evidence tasks completed without changing backend runtime behavior.
- Validation artifacts recorded in `quickstart.md` cover focused migration tests, full backend regression, schema parity diff, and startup migration outcomes.
- Operator guidance now documents metadata reset flow and `METADATA_DB_PATH` usage for local shells and one-off container runs while preserving the locked migration strategy.
