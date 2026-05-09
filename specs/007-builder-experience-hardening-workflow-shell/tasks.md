# Tasks: Builder Experience Hardening + Workflow Shell (Spec 007)

**Input**: design documents from `/specs/007-builder-experience-hardening-workflow-shell/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/builder-experience-hardening.openapi.yaml

Tests: Included because this feature explicitly requires contract/integration verification and docker smoke evidence.
Organization: Tasks are grouped by user story so each story is independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare scaffolding for feature-specific contracts, UI shell modules, and smoke tooling.

- [ ] T001 Create feature contract test module scaffold in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T002 [P] Create active-context integration test scaffold in apps/backend/tests/integration/test_builder_active_context_flow.py
- [ ] T003 [P] Create connectivity and actionable-error integration test scaffold in apps/backend/tests/integration/test_builder_connectivity_errors.py
- [ ] T004 [P] Create workflow shell UI module scaffolds in apps/builder/src/components/workflow-shell/WorkflowShell.tsx and apps/builder/src/pages/BuilderWorkflowPage.tsx
- [ ] T005 [P] Create builder session API/state scaffolds in apps/builder/src/api/builderSessionApi.ts and apps/builder/src/state/builderSessionStore.ts
- [ ] T006 [P] Create builder workflow smoke script scaffold in scripts/dev/builder-workflow-smoke.sh
- [ ] T007 [P] Add smoke command placeholder wiring in package.json and devops/README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared backend/frontend primitives required by all user stories.

CRITICAL: Complete this phase before user story implementation.

- [ ] T008 Add BuilderSessionState, workflow stage, connection status, and actionable error DTOs in apps/backend/app/schemas.py
- [ ] T009 [P] Add builder session-state and active-context service foundation in apps/backend/app/services/builder_session_service.py
- [ ] T010 [P] Add connection preflight service foundation with dependency checks in apps/backend/app/services/preflight_service.py
- [ ] T011 [P] Add actionable error envelope mapper and helper functions in apps/backend/app/services/actionable_error_service.py
- [ ] T012 Wire shared error/helper services and correlation propagation into API handlers in apps/backend/app/main.py
- [ ] T013 [P] Extend builder API types for session state, preflight, active context, and actionable errors in apps/builder/src/api/types.ts
- [ ] T014 [P] Implement builder session/preflight API client methods in apps/builder/src/api/builderSessionApi.ts
- [ ] T015 Implement global builder session store with refresh and guard selectors in apps/builder/src/state/builderSessionStore.ts
- [ ] T016 [P] Add shared ActionableErrorPanel component and rendering utilities in apps/builder/src/components/errors/ActionableErrorPanel.tsx
- [ ] T017 Add foundational contract assertions for preflight/session-state/error schemas in apps/backend/tests/contract/test_builder_experience_contract.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Trustworthy Workspace State Before Actions (Priority: P1) MVP

Goal: Enforce explicit active workspace/source state and remove hidden fallbacks for query and saved-query actions.
Independent Test: Start with unresolved context, confirm query/saved actions are blocked, then resolve context and confirm all actions run against visible active state.

### Tests for User Story 1

- [ ] T018 [P] [US1] Add contract test for PUT /api/v1/workspaces/active-context success and unresolved/stale error responses in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T019 [P] [US1] Add contract test for guarded /api/v1/query/validate and /api/v1/saved-queries 409 behavior in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T020 [P] [US1] Add integration test for explicit context requirement before query validate and saved-query list in apps/backend/tests/integration/test_builder_active_context_flow.py
- [ ] T021 [P] [US1] Add integration test for stale context detection and reselection recovery in apps/backend/tests/integration/test_builder_active_context_flow.py

### Implementation for User Story 1

- [ ] T022 [US1] Implement active workspace/source set and resolve flow for PUT /api/v1/workspaces/active-context in apps/backend/app/main.py and apps/backend/app/services/builder_session_service.py
- [ ] T023 [US1] Enforce explicit active context guards for query validate/execute handlers in apps/backend/app/main.py
- [ ] T024 [US1] Enforce explicit active context guards for saved-query list/search/load handlers in apps/backend/app/main.py
- [ ] T025 [US1] Remove implicit workspace/source fallback behavior from query API calls in apps/builder/src/api/queryBuilderApi.ts and apps/builder/src/components/query-builder/QueryBuilderPanel.tsx
- [ ] T026 [US1] Remove default workspace fallback from saved-query routing and API calls in apps/builder/src/App.tsx, apps/builder/src/api/queryApi.ts, and apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx
- [ ] T027 [US1] Render persistent active workspace/source state with unresolved and stale badges in apps/builder/src/components/workflow-shell/ActiveContextBar.tsx and apps/builder/src/components/workflow-shell/WorkflowShell.tsx
- [ ] T028 [US1] Block query and saved-query stage actions until context is resolved and provide reselection CTA in apps/builder/src/pages/BuilderWorkflowPage.tsx and apps/builder/src/components/workflow-shell/WorkflowShell.tsx

Checkpoint: US1 is independently functional and all scoped actions are explicit-context-only.

---

## Phase 4: User Story 2 - Actionable Connectivity and Error Guidance (Priority: P1)

Goal: Provide preflight readiness visibility and guidance-first error handling across upload/profile/query/saved actions.
Independent Test: Simulate unavailable/degraded dependencies and route failures; verify persistent status plus actionable next-step error guidance.

### Tests for User Story 2

- [ ] T029 [P] [US2] Add contract test for GET /api/v1/builder/preflight status taxonomy and dependency payload in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T030 [P] [US2] Add contract test for GET /api/v1/builder/session-state including connection status and stage prerequisites in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T031 [P] [US2] Add integration test for preflight unavailable/degraded/ready transitions and refresh recovery in apps/backend/tests/integration/test_builder_connectivity_errors.py
- [ ] T032 [P] [US2] Add integration test for standardized actionable errors across upload/profile/query/saved actions in apps/backend/tests/integration/test_builder_connectivity_errors.py

### Implementation for User Story 2

- [ ] T033 [US2] Implement GET /api/v1/builder/preflight endpoint and readiness aggregation in apps/backend/app/main.py and apps/backend/app/services/preflight_service.py
- [ ] T034 [US2] Implement GET /api/v1/builder/session-state endpoint including stage prerequisites and degraded capability projection in apps/backend/app/main.py and apps/backend/app/services/builder_session_service.py
- [ ] T035 [US2] Standardize backend error envelope to guidance-first ActionableError for upload/profile/query/saved routes in apps/backend/app/main.py and apps/backend/app/services/actionable_error_service.py
- [ ] T036 [US2] Add builder persistent connection status surface with manual refresh and last-checked timestamp in apps/builder/src/components/workflow-shell/ConnectionStatusBanner.tsx and apps/builder/src/components/workflow-shell/WorkflowShell.tsx
- [ ] T037 [US2] Integrate ActionableErrorPanel across upload/profile/query/saved UI action surfaces in apps/builder/src/App.tsx, apps/builder/src/components/query-builder/QueryBuilderPanel.tsx, and apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx
- [ ] T038 [US2] Add optional technical-detail expand/collapse while preserving guidance-first copy in apps/builder/src/components/errors/ActionableErrorPanel.tsx

Checkpoint: US2 is independently functional and users can recover from connectivity and request failures without guesswork.

---

## Phase 5: User Story 3 - Workflow-Oriented Builder Shell (Priority: P2)

Goal: Deliver a stage-based shell IA that guides users through upload/source, schema/sheet, query, and results/saved with prerequisite linking.
Independent Test: Complete the staged workflow as a first-time user and verify missing prerequisites route users back to the correct stage with context preserved.

### Tests for User Story 3

- [ ] T039 [P] [US3] Add integration test for shell stage ordering and prerequisite lock/unlock transitions in apps/backend/tests/integration/test_builder_active_context_flow.py
- [ ] T040 [P] [US3] Add UI integration test for stage navigation preserving active context and connection indicators in apps/builder/src/pages/**tests**/BuilderWorkflowPage.test.tsx

### Implementation for User Story 3

- [ ] T041 [US3] Implement workflow shell stage model (upload_source, schema_sheet, query, results_saved) with prerequisite metadata in apps/builder/src/components/workflow-shell/WorkflowShell.tsx
- [ ] T042 [US3] Implement BuilderWorkflowPage composition and stage-level route structure in apps/builder/src/pages/BuilderWorkflowPage.tsx and apps/builder/src/App.tsx
- [ ] T043 [US3] Add prerequisite callouts and route-back actions for blocked downstream stages in apps/builder/src/components/workflow-shell/WorkflowShell.tsx
- [ ] T044 [US3] Move existing upload/profile/query/saved panels into staged shell containers without losing existing behavior in apps/builder/src/App.tsx and apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx
- [ ] T045 [US3] Persist stage navigation state and preserve active context/status visibility on backward and forward movement in apps/builder/src/state/builderSessionStore.ts and apps/builder/src/pages/BuilderWorkflowPage.tsx

Checkpoint: US3 is independently functional and the builder is workflow-guided rather than page-fragmented.

---

## Phase 6: User Story 4 - MVP Smoke Flow for Release Confidence (Priority: P2)

Goal: Provide a docker-executable smoke flow that validates create workspace -> upload -> validate query -> list saved queries with stage-attributed diagnostics.
Independent Test: Run smoke in docker; verify full pass, then force a stage failure and confirm first failed stage and diagnostics are reported.

### Tests for User Story 4

- [ ] T046 [P] [US4] Add contract test for POST/GET smoke endpoints and SmokeFlowResult schema in apps/backend/tests/contract/test_builder_experience_contract.py
- [ ] T047 [P] [US4] Add integration test for smoke stage ordering and first-failure attribution in apps/backend/tests/integration/test_builder_workflow_smoke.py
- [ ] T048 [P] [US4] Add integration test for docker smoke command exit behavior on success vs failure in apps/backend/tests/integration/test_builder_workflow_smoke.py

### Implementation for User Story 4

- [ ] T049 [US4] Implement smoke run orchestrator and stage result persistence in apps/backend/app/services/builder_smoke_service.py
- [ ] T050 [US4] Implement POST /api/v1/ops/smoke/builder-workflow and GET /api/v1/ops/smoke/builder-workflow/{run_id} handlers in apps/backend/app/main.py
- [ ] T051 [US4] Implement docker-compatible smoke runner command sequence in scripts/dev/builder-workflow-smoke.sh
- [ ] T052 [US4] Wire smoke command into local and compose workflows in package.json and devops/compose.yaml
- [ ] T053 [US4] Emit stage-by-stage smoke diagnostics with first-failed-stage summary in scripts/dev/builder-workflow-smoke.sh and apps/backend/app/services/builder_smoke_service.py

Checkpoint: US4 is independently functional and provides deterministic release evidence for the MVP journey.

---

## Phase 7: Polish & Cross-Cutting Concerns

Purpose: Final hardening, traceability checks, and quickstart evidence refresh.

- [ ] T054 [P] Run full feature quickstart validation gates and record pass/fail notes in specs/007-builder-experience-hardening-workflow-shell/quickstart.md
- [ ] T055 [P] Add builder workflow shell and active-context UX usage notes in docs/development/setup.md
- [ ] T056 Validate FR-001 to FR-013 traceability against implemented tasks and update specs/007-builder-experience-hardening-workflow-shell/tasks.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user stories.
- User Story phases (Phase 3-6): Depend on Phase 2.
- Polish (Phase 7): Depends on completion of targeted user stories.

### User Story Dependencies

- US1 (P1): Starts after Phase 2 and establishes explicit active-state guarantees required by downstream UX.
- US2 (P1): Starts after Phase 2; can run in parallel with US1, but final merge should follow US1 guard contracts.
- US3 (P2): Depends on US1 and US2 session primitives and UI status/error surfaces.
- US4 (P2): Depends on US1-US3 endpoints and shell flow stability.

### Within-Story Ordering Rules

- Contract/integration tests before implementation tasks.
- Backend guards/contracts before frontend route and UI gating.
- Shell/state primitives before stage composition.
- Smoke orchestration service before CLI/docker wiring.
- Tasks marked [P] are parallelizable when no incomplete dependency exists.

---

## Parallel Execution Opportunities

### User Story 1 (US1)

```bash
# Contract and integration checks in parallel:
T018, T019, T020, T021

# Frontend fallback-removal tasks in parallel after backend guards:
T025, T026, T027
```

### User Story 2 (US2)

```bash
# API contract/integration checks in parallel:
T029, T030, T031, T032

# UI status and error rendering in parallel after shared API/store wiring:
T036, T037, T038
```

### User Story 3 (US3)

```bash
# Stage model and route composition split:
T041, T042

# Prerequisite linking and visibility persistence split:
T043, T045
```

### User Story 4 (US4)

```bash
# Smoke verification tests in parallel:
T046, T047, T048

# Runtime smoke wiring in parallel after backend handlers:
T051, T052, T053
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 explicit active-state gating and no-fallback enforcement.
3. Deliver US2 connectivity preflight and actionable error standardization.
4. Validate quickstart gates A-C before proceeding.

### Incremental Delivery

1. Foundation complete -> enable parallel US1/US2 execution.
2. Add US3 workflow shell IA after active-state and error/status primitives stabilize.
3. Add US4 docker smoke evidence gate.
4. Complete polish and traceability validation.

### Task Count Summary

- Total tasks: 56
- Setup: 7
- Foundational: 10
- US1: 11
- US2: 10
- US3: 7
- US4: 8
- Polish: 3
