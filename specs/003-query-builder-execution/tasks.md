# Tasks: Query Builder & Execution (Spec 003)

**Input**: Design documents from `/specs/003-query-builder-execution/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/query-builder-execution.openapi.yaml

**Tests**: Included. The spec defines mandatory independent tests per user story and contract/integration verification.

**Organization**: Tasks are dependency-ordered and grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no unmet dependency)
- **[Story]**: User story label ([US1]...[US7])
- Every task includes concrete file path(s)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature scaffolding and test entry points.

- [ ] T001 Create backend query contract test module in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T002 [P] Create backend preview/execute integration test module in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T003 [P] Create backend saved-query integration test module in apps/backend/tests/integration/test_query_builder_saved_queries.py
- [ ] T004 [P] Create builder query API module in apps/builder/src/api/queryBuilderApi.ts and apps/builder/src/api/queryBuilderTypes.ts
- [ ] T005 [P] Create builder query UI module stubs in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx, apps/builder/src/components/query-builder/JoinPanel.tsx, apps/builder/src/components/query-builder/PreviewPanel.tsx, apps/builder/src/components/query-builder/ExecutionPanel.tsx, apps/builder/src/components/query-builder/ExportPanel.tsx, and apps/builder/src/components/query-builder/SavedQueriesPanel.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, persistence, validation, and route wiring required by all stories.

**CRITICAL**: Complete this phase before starting user story phases.

- [ ] T006 Add saved query and execution log table DDL in apps/backend/app/core/metadata_db.py
- [ ] T007 [P] Add saved query and execution log indexes in apps/backend/app/core/metadata_db.py
- [ ] T008 Add query DTOs and enums (QueryConfig, SelectedColumn, FilterSpec, AggregationSpec, JoinSpec, ValidationIssue, LineageMetadata, SavedQuery payloads) in apps/backend/app/schemas.py
- [ ] T009 [P] Add QueryConfigValidator skeleton in apps/backend/app/services/query_builder_service.py
- [ ] T010 [P] Add JoinGraphValidator skeleton (approved-only + acyclic checks) in apps/backend/app/services/query_builder_service.py
- [ ] T011 [P] Add SqlTranslator skeleton (DuckDB SQL + ordered parameters) in apps/backend/app/services/query_builder_service.py
- [ ] T012 [P] Add QueryExecutionService skeleton (preview/execute timeout wrapper) in apps/backend/app/services/query_execution_service.py
- [ ] T013 [P] Add QueryExportService skeleton (excel/csv generation with lineage metadata) in apps/backend/app/services/query_export_service.py
- [ ] T014 [P] Add QueryPersistenceService skeleton (save/load/update/delete/list/history + config hash) in apps/backend/app/services/query_persistence_service.py
- [ ] T015 Add shared query exception mapping for 400/408/409/413 in apps/backend/app/main.py

**Checkpoint**: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Build a Query Visually (Priority: P1)

**Goal**: Build valid single-table query configs and SQL preview from visual selections.

**Independent Test**: Build single-table query with filter + aggregation and verify SQL preview is valid and parameterized.

### Tests for User Story 1

- [ ] T016 [P] [US1] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/validate in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T017 [P] [US1] Add integration test for single-table SQL generation and parameter ordering in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T018 [P] [US1] Add integration test for invalid filter/operator/aggregation/group-by validation failures in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 1

- [ ] T019 [US1] Implement filter operator whitelist and type checks in QueryConfigValidator in apps/backend/app/services/query_builder_service.py
- [ ] T020 [US1] Implement GROUP BY consistency validation in QueryConfigValidator in apps/backend/app/services/query_builder_service.py
- [ ] T021 [US1] Implement single-table SQL translation with placeholders in SqlTranslator in apps/backend/app/services/query_builder_service.py
- [ ] T022 [US1] Add validate endpoint wiring for POST /api/v1/workspaces/{workspaceId}/queries/validate in apps/backend/app/main.py
- [ ] T023 [P] [US1] Implement validateQuery API client in apps/builder/src/api/queryBuilderApi.ts and types in apps/builder/src/api/queryBuilderTypes.ts
- [ ] T024 [P] [US1] Implement base table, columns, filters, aggregations, and SQL preview UI in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx
- [ ] T025 [US1] Integrate QueryBuilderPanel in apps/builder/src/App.tsx

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Add Joins Using Approved Relationships (Priority: P1)

**Goal**: Enable governed multi-table joins using only approved relationship rules from spec 002.

**Independent Test**: Join two tables using an approved rule and verify SQL preview includes correct JOIN clause; unapproved rules are rejected.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add contract coverage for validate errors on unapproved relationships in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T027 [P] [US2] Add integration test for approved-rule join SQL generation in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T028 [P] [US2] Add integration test for relationship status drift rejection (409) at execution-time validation in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T029 [P] [US2] Add integration test for circular join graph rejection in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 2

- [ ] T030 [US2] Implement approved-rule enforcement against relationship_rules status in JoinGraphValidator in apps/backend/app/services/query_builder_service.py
- [ ] T031 [US2] Implement acyclic join graph validation and join ordering in JoinGraphValidator in apps/backend/app/services/query_builder_service.py
- [ ] T032 [US2] Extend SQL translation for JOIN clauses based on approved relationship rules in SqlTranslator in apps/backend/app/services/query_builder_service.py
- [ ] T033 [P] [US2] Implement join builder UI and approved-relationship selection in apps/builder/src/components/query-builder/JoinPanel.tsx
- [ ] T034 [US2] Integrate JoinPanel with QueryBuilderPanel validation flow in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Preview Results Safely (Priority: P1)

**Goal**: Provide LIMIT 100 preview with 5-second hard timeout and metadata.

**Independent Test**: Preview query returning 10k+ rows and verify at most 100 rows plus "Showing 100 of ~X" metadata or timeout messaging.

### Tests for User Story 3

- [ ] T035 [P] [US3] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/preview response shape in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T036 [P] [US3] Add integration test for preview LIMIT 100 behavior and estimated total metadata in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T037 [P] [US3] Add integration test for 5-second preview timeout mapping to 408 in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T038 [P] [US3] Add integration test for preview empty result messaging payload in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 3

- [ ] T039 [US3] Implement preview execution path (LIMIT 100 + estimated total rows) in QueryExecutionService in apps/backend/app/services/query_execution_service.py
- [ ] T040 [US3] Implement hard timeout cancellation and TIMEOUT error mapping in QueryExecutionService in apps/backend/app/services/query_execution_service.py
- [ ] T041 [US3] Add preview endpoint wiring for POST /api/v1/workspaces/{workspaceId}/queries/preview in apps/backend/app/main.py
- [ ] T042 [P] [US3] Implement preview API client and DTOs in apps/builder/src/api/queryBuilderApi.ts and apps/builder/src/api/queryBuilderTypes.ts
- [ ] T043 [US3] Implement preview state, row metadata, and timeout messaging in apps/builder/src/components/query-builder/PreviewPanel.tsx

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: User Story 4 - Execute Full Query and Handle Large Result Sets (Priority: P1)

**Goal**: Execute full queries with runtime safeguards, clear failures, and large-result UX safety.

**Independent Test**: Execute on 100k+ rows and verify success or graceful timeout/memory rejection with user guidance.

### Tests for User Story 4

- [ ] T044 [P] [US4] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/execute response shape in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T045 [P] [US4] Add integration test for full execution success response and row counts in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T046 [P] [US4] Add integration test for execution timeout (408) and remediation message in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T047 [P] [US4] Add integration test for memory pre-check rejection (413) in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 4

- [ ] T048 [US4] Implement full execution path and result metadata in QueryExecutionService in apps/backend/app/services/query_execution_service.py
- [ ] T049 [US4] Implement memory/cardinality pre-check guardrails in QueryExecutionService in apps/backend/app/services/query_execution_service.py
- [ ] T050 [US4] Add execute endpoint wiring for POST /api/v1/workspaces/{workspaceId}/queries/execute in apps/backend/app/main.py
- [ ] T051 [P] [US4] Implement execute API client and DTOs in apps/builder/src/api/queryBuilderApi.ts and apps/builder/src/api/queryBuilderTypes.ts
- [ ] T052 [US4] Implement execution progress, result rendering, and user-friendly errors in apps/builder/src/components/query-builder/ExecutionPanel.tsx

**Checkpoint**: US4 is independently functional and testable.

---

## Phase 7: User Story 5 - Export Results to Excel or CSV (Priority: P1)

**Goal**: Export execution results to Excel/CSV with immutable lineage metadata for traceability.

**Independent Test**: Export same execution to Excel and CSV; verify both formats include full results and lineage fields required by spec/constitution.

### Tests for User Story 5

- [ ] T053 [P] [US5] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/export (format=excel|csv) in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T054 [P] [US5] Add integration test for Excel export with Results and Lineage sheets in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T055 [P] [US5] Add integration test for CSV export with lineage header comments in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T056 [P] [US5] Add integration test for null/special-character export handling in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 5

- [ ] T057 [US5] Implement immutable lineage snapshot builder (source tables, relationships with status, filters, aggregations, group-by, timestamp, config hash) in apps/backend/app/services/query_export_service.py
- [ ] T058 [US5] Implement Excel export writer with Results and Lineage sheets in apps/backend/app/services/query_export_service.py
- [ ] T059 [US5] Implement CSV export writer with lineage comment headers in apps/backend/app/services/query_export_service.py
- [ ] T060 [US5] Add export endpoint wiring for POST /api/v1/workspaces/{workspaceId}/queries/export in apps/backend/app/main.py
- [ ] T061 [US5] Implement export actions and download UX in apps/builder/src/components/query-builder/ExportPanel.tsx

**Checkpoint**: US5 is independently functional and testable.

---

## Phase 8: User Story 6 - Validate Query and Surface Errors Early (Priority: P2)

**Goal**: Continuously validate builder state and block invalid execution paths early.

**Independent Test**: Introduce orphaned filter/group-by config and verify inline validation appears and clears after correction.

### Tests for User Story 6

- [ ] T062 [P] [US6] Add integration test for orphaned column validation errors in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T063 [P] [US6] Add integration test for GROUP BY without aggregation warning/error semantics in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T064 [P] [US6] Add integration test for ambiguous multi-table column reference validation in apps/backend/tests/integration/test_query_builder_execution.py

### Implementation for User Story 6

- [ ] T065 [US6] Extend QueryConfigValidator for orphaned references and ambiguity checks in apps/backend/app/services/query_builder_service.py
- [ ] T066 [US6] Return structured warnings/errors from validate endpoint in apps/backend/app/main.py
- [ ] T067 [P] [US6] Implement debounced validation API calls in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx
- [ ] T068 [US6] Render inline validation badges/messages in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx

**Checkpoint**: US6 is independently functional and testable.

---

## Phase 9: User Story 7 - Save and Reuse Query Configurations (Priority: P2)

**Goal**: Persist, reload, duplicate, and audit saved query configurations with reproducibility metadata.

**Independent Test**: Save query, reload it after refresh, duplicate it, and view execution history for the saved query.

### Tests for User Story 7

- [ ] T069 [P] [US7] Add contract test coverage for POST/GET /saved-queries and GET/PUT/DELETE /saved-queries/{queryId} in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T070 [P] [US7] Add contract test for GET /api/v1/workspaces/{workspaceId}/saved-queries/{queryId}/executions in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T071 [P] [US7] Add integration test for save/load/update/delete lifecycle in apps/backend/tests/integration/test_query_builder_saved_queries.py
- [ ] T072 [P] [US7] Add integration test for schema-drift warning on saved query load in apps/backend/tests/integration/test_query_builder_saved_queries.py

### Implementation for User Story 7

- [ ] T073 [US7] Implement save/list/get/update/delete services and config hash generation in apps/backend/app/services/query_persistence_service.py
- [ ] T074 [US7] Implement saved-query execution history retrieval service in apps/backend/app/services/query_persistence_service.py
- [ ] T075 [US7] Add saved-query CRUD and history endpoint wiring in apps/backend/app/main.py
- [ ] T076 [P] [US7] Implement saved-query API client functions in apps/builder/src/api/queryBuilderApi.ts and apps/builder/src/api/queryBuilderTypes.ts
- [ ] T077 [P] [US7] Implement saved query list/load/duplicate/delete UI in apps/builder/src/components/query-builder/SavedQueriesPanel.tsx
- [ ] T078 [US7] Integrate saved-query flows into QueryBuilderPanel in apps/builder/src/components/query-builder/QueryBuilderPanel.tsx

**Checkpoint**: US7 is independently functional and testable.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final alignment to quickstart, constitution gates, and end-to-end stability.

- [ ] T079 Add end-to-end integration scenario coverage for build->preview->execute->export with approved joins in apps/backend/tests/integration/test_query_builder_execution.py
- [ ] T080 [P] Add end-to-end integration scenario coverage for save->reload->execute->history in apps/backend/tests/integration/test_query_builder_saved_queries.py
- [ ] T081 [P] Add query builder integration mount and user-flow wiring in apps/builder/src/App.tsx
- [ ] T082 Update feature quickstart verification steps in specs/003-query-builder-execution/quickstart.md
- [ ] T083 Add query builder capability notes to README.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup and blocks all user stories.
- User stories (Phases 3-9): depend on Foundational completion.
- Polish (Phase 10): depends on all targeted user stories.

### User Story Dependencies

- US1 (P1): starts after Phase 2; no story dependency.
- US2 (P1): starts after US1 SQL/validation foundations (T019-T022).
- US3 (P1): starts after US1 validation/translation foundations (T019-T022).
- US4 (P1): starts after US3 preview/runtime foundation (T039-T041).
- US5 (P1): starts after US4 execution foundation (T048-T050).
- US6 (P2): starts after US1/US2 foundations, enhances validation feedback.
- US7 (P2): starts after Phase 2; best integrated after US4 execution logging is available.

### Within Each User Story

- Tests first (contract/integration) before implementation.
- Backend service and schema updates before route wiring.
- API client before UI integration.

---

## Parallel Opportunities

### Setup

- T002-T005 can run in parallel after T001.

### Foundational

- T009-T014 can run in parallel after T008.

### Per Story

- Contract and integration test tasks marked [P] can run concurrently.
- Builder API client tasks and isolated UI panel tasks marked [P] can run concurrently after endpoint contracts are stable.

### Example: User Story 3 Parallel Batch

- T035, T036, T037, T038 in parallel (test authoring).
- T042 and T043 in parallel after T041 is implemented.

---

## Implementation Strategy

### MVP First (P1 scope)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 -> US2 -> US3 -> US4 -> US5.
3. Validate quickstart flow before moving to P2 stories.

### Incremental Delivery

1. Foundation complete (Phase 2).
2. Ship US1-2 (governed builder + approved joins).
3. Ship US3-4 (safe preview + full execution).
4. Ship US5 (traceable export).
5. Add US6-7 enhancements.

### Constitution Alignment Notes

- Principle III enforced by approved-only join tasks (T030-T032).
- Principle VI enforced by immutable lineage tasks (T057-T060).
- Principle VII enforced by config hash and execution snapshot tasks (T073-T075).
