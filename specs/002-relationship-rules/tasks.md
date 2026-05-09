# Tasks: Relationship Rules (Spec 002)

Input: design documents from /specs/002-relationship-rules/
Prerequisites: plan.md, spec.md, research.md, data-model.md, contracts/relationship-rules.openapi.yaml, quickstart.md

Tests: Included per user story (contract + integration) and ordered before implementation tasks.
Organization: Tasks are grouped by user story so each story is independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare repository scaffolding and test harness for relationship-rule delivery.

- [x] T001 Add relationship service module scaffold in apps/backend/app/services/relationship_service.py
- [x] T002 Add relationship contract test module scaffold in apps/backend/tests/contract/test_relationship_rules_contract.py
- [x] T003 [P] Add relationship integration test module scaffolds in apps/backend/tests/integration/test_relationship_lifecycle.py and apps/backend/tests/integration/test_relationship_broken_rules.py
- [x] T004 [P] Add builder relationship API client scaffold functions in apps/builder/src/api/workspaceApi.js

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared schema, storage, and API wiring required by all stories.

CRITICAL: Complete this phase before user story implementation.

- [x] T005 Replace legacy relationships stub with relationship_rules and relationship_audit table initialization in apps/backend/app/core/metadata_db.py
- [x] T006 [P] Add metadata DB indexes for relationship_rules workspace/status/columns lookups and relationship_audit timeline reads in apps/backend/app/core/metadata_db.py
- [x] T007 [P] Add shared Pydantic enums and base DTOs (join/rel/status/cardinality/audit/error) in apps/backend/app/schemas.py
- [x] T008 Implement shared relationship error mapping (400/404/409) and response helpers in apps/backend/app/main.py
- [x] T009 [P] Add foundational metadata schema verification assertions for new relationship tables in apps/backend/tests/integration/test_metadata_schema.py
- [x] T010 [P] Extend API schema smoke coverage for relationship-rules contract surface in apps/backend/tests/contract/test_schema_contract_smoke.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Create Relationship Rule (Priority: P1) MVP

Goal: Allow analysts to create relationship rules with computed overlap/cardinality and initial suggested status.
Independent Test: Create a relationship between two workspace columns and verify overlap_pct/cardinality are computed and status starts as suggested.

### Tests for User Story 1

- [x] T011 [P] [US1] Add contract test for POST /api/v1/workspaces/{workspaceId}/relationships request/response shape in apps/backend/tests/contract/test_relationship_rules_contract.py
- [x] T012 [P] [US1] Add integration test for DuckDB exact overlap_pct computation and cardinality mapping on create in apps/backend/tests/integration/test_relationship_lifecycle.py
- [x] T013 [P] [US1] Add integration test for create validation failures (missing columns, invalid types, low-overlap acknowledgement requirement) in apps/backend/tests/integration/test_relationship_lifecycle.py

### Implementation for User Story 1

- [x] T014 [US1] Implement overlap_pct computation using DuckDB distinct intersection/denominator logic in apps/backend/app/services/relationship_service.py
- [x] T015 [US1] Implement cardinality classification from uniqueness_ratio thresholds in apps/backend/app/services/relationship_service.py
- [x] T016 [US1] Implement create relationship workflow with suggested default status and created audit event in apps/backend/app/services/relationship_service.py
- [x] T017 [US1] Add create relationship request/response schemas including low_overlap_acknowledged in apps/backend/app/schemas.py
- [x] T018 [US1] Add POST /api/v1/workspaces/{workspaceId}/relationships endpoint wiring in apps/backend/app/main.py

Checkpoint: US1 is independently functional.

---

## Phase 4: User Story 2 - Review/Approve/Reject Relationship Rule (Priority: P1)

Goal: Enforce lifecycle governance with threshold controls, acknowledgements, and override reason requirements.
Independent Test: Move a rule through reviewed and approved/rejected, blocking <5% approvals without override_reason and requiring acknowledgement for <80% overlap.

### Tests for User Story 2

- [x] T019 [P] [US2] Add contract test for PATCH review endpoint lifecycle actions and error responses in apps/backend/tests/contract/test_relationship_rules_contract.py
- [x] T020 [P] [US2] Add integration test for reviewed->approved path, <80% warning gate, and <5% override_reason enforcement in apps/backend/tests/integration/test_relationship_lifecycle.py
- [x] T021 [P] [US2] Add integration test for reviewed->rejected transition and immutable audit event history in apps/backend/tests/integration/test_relationship_lifecycle.py

### Implementation for User Story 2

- [x] T022 [US2] Implement lifecycle transition guardrail logic (suggested->reviewed->approved/rejected) in apps/backend/app/services/relationship_service.py
- [x] T023 [US2] Implement low-overlap policy checks (<80% acknowledgement and <5% override requirement) in apps/backend/app/services/relationship_service.py
- [x] T024 [US2] Implement review action audit persistence with actor/reason/timestamp fields in apps/backend/app/services/relationship_service.py
- [x] T025 [US2] Add review request/response schemas and PATCH /api/v1/workspaces/{workspaceId}/relationships/{relationshipId}/review endpoint in apps/backend/app/schemas.py and apps/backend/app/main.py

Checkpoint: US2 is independently functional and enforces governance controls.

---

## Phase 5: User Story 3 - List Workspace Relationships (Priority: P2)

Goal: Provide relationship listing and detail views with status, overlap, cardinality, and broken flag.
Independent Test: List and retrieve relationships, simulate schema drift/column removal, verify broken flags surface correctly.

### Tests for User Story 3

- [x] T026 [P] [US3] Add contract tests for GET list and GET detail relationship endpoint response shapes in apps/backend/tests/contract/test_relationship_rules_contract.py
- [x] T027 [P] [US3] Add integration test for broken detection when referenced column is missing or effective_type changes in apps/backend/tests/integration/test_relationship_broken_rules.py

### Implementation for User Story 3

- [x] T028 [US3] Implement broken-rule detection (missing column and effective_type incompatibility) in apps/backend/app/services/relationship_service.py
- [x] T029 [US3] Implement list/get service queries returning status, overlap_pct, cardinality, broken, actor, updated_at in apps/backend/app/services/relationship_service.py
- [x] T030 [US3] Add GET /api/v1/workspaces/{workspaceId}/relationships and GET /api/v1/workspaces/{workspaceId}/relationships/{relationshipId} endpoints in apps/backend/app/main.py and apps/backend/app/schemas.py

Checkpoint: US3 is independently functional.

---

## Phase 6: User Story 4 - Edit/Delete Relationship Rule (Priority: P2)

Goal: Support safe edits and deletes with recomputation, lifecycle reset, and retained audit traceability.
Independent Test: Edit an approved rule and verify recompute + reset to suggested; delete another rule and verify removal from active list while audit history remains.

### Tests for User Story 4

- [x] T031 [P] [US4] Add contract tests for PUT edit and DELETE relationship endpoints in apps/backend/tests/contract/test_relationship_rules_contract.py
- [x] T032 [P] [US4] Add integration test for edit recompute/reset and delete audit trace persistence in apps/backend/tests/integration/test_relationship_lifecycle.py

### Implementation for User Story 4

- [x] T033 [US4] Implement edit workflow: recompute overlap/cardinality, reset status to suggested, append edited audit event in apps/backend/app/services/relationship_service.py
- [x] T034 [US4] Implement delete workflow: append deleted audit event then remove active rule row in apps/backend/app/services/relationship_service.py
- [x] T035 [US4] Add PUT /api/v1/workspaces/{workspaceId}/relationships/{relationshipId} and DELETE endpoints in apps/backend/app/main.py and apps/backend/app/schemas.py

Checkpoint: US4 is independently functional.

---

## Phase 7: Builder UI + Polish

Purpose: Finalize builder integration, end-to-end validation, and quickstart alignment.

- [ ] T036 [P] Implement builder relationship API functions (create/list/get/review/update/delete) in apps/builder/src/api/workspaceApi.js
- [ ] T037 Implement relationship panel UI (create/review/list/edit/delete with overlap/cardinality/broken indicators) in apps/builder/src/App.jsx
- [ ] T038 [P] Add end-to-end regression scenario for create->review->approve->edit->delete flow in apps/backend/tests/integration/test_relationship_lifecycle.py
- [ ] T039 Update execution and verification steps in specs/002-relationship-rules/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user story work.
- User Story phases (Phase 3–6): Depend on Phase 2; execute in priority order P1 (US1, US2) then P2 (US3, US4).
- Builder/Polish (Phase 7): Depends on core backend story phases.

### User Story Dependencies

- US1: Can begin after Phase 2.
- US2: Depends on US1 create path and computed overlap/cardinality.
- US3: Depends on US1/US2 stored lifecycle state.
- US4: Depends on US1/US2/US3 persistence and lifecycle behavior.

### Within-Story Ordering Rules

- Tests first (TDD).
- Service logic before endpoint wiring.
- Endpoint wiring before UI integration.
- Tasks marked [P] are parallelizable when no incomplete dependency exists.
