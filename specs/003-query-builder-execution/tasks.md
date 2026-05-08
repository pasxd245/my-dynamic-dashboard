# Tasks: Query Builder & Execution (Spec 003)

Input: design documents from `/specs/003-query-builder-execution/`
Prerequisites: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/query-builder-execution.openapi.yaml

Tests: Included per user story (contract + integration) and ordered before implementation tasks.
Organization: Tasks are grouped by user story so each story is independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare repository scaffolding and test harness for query-builder delivery.

- [ ] T001 Add query service module scaffold in apps/backend/app/services/query_service.py
- [ ] T002 Add query contract test module scaffold in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T003 [P] Add query integration test module scaffolds in apps/backend/tests/integration/test_query_builder_flows.py and apps/backend/tests/integration/test_query_execution_timeout.py
- [ ] T004 [P] Add builder query API client scaffold functions in apps/builder/src/api/queryApi.js
- [ ] T005 [P] Add builder query UI component scaffolds: QueryBuilder.tsx, FilterPanel.tsx, AggregationPanel.tsx, ResultsViewer.tsx, SavedQueriesList.tsx in apps/builder/src/components/

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared schema, storage, and API wiring required by all stories.

CRITICAL: Complete this phase before user story implementation.

- [ ] T006 Add saved_queries and query_execution_log table initialization in apps/backend/app/core/metadata_db.py
- [ ] T007 [P] Add metadata DB indexes for saved_queries workspace/created_at lookups and query_execution_log workspace/query_id/executed_at timeline reads in apps/backend/app/core/metadata_db.py
- [ ] T008 [P] Add shared Pydantic enums and base DTOs (QueryConfig, FilterSpec, AggregationSpec, JoinSpec, ExecutionState, LineageMetadata) in apps/backend/app/schemas.py
- [ ] T009 [P] Add CardinalityEstimator class with estimate() method in apps/backend/app/services/query_service.py
- [ ] T010 [P] Add JoinValidator class with validate_joins() method for circular dependency detection and approved-only enforcement in apps/backend/app/services/query_service.py
- [ ] T011 [P] Add QueryConfigValidator class with validate_columns(), validate_filters(), validate_aggregations(), validate_group_by() methods in apps/backend/app/services/query_service.py
- [ ] T012 Implement shared query error mapping (400/408/409/413) and response helpers in apps/backend/app/main.py
- [ ] T013 [P] Add foundational metadata schema verification assertions for new query tables in apps/backend/tests/integration/test_metadata_schema.py
- [ ] T014 [P] Extend API schema smoke coverage for query-builder contract surface in apps/backend/tests/contract/test_schema_contract_smoke.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Build Query Visually (Priority: P1) MVP

Goal: Allow analysts to select base table, columns, filters, aggregations, and see SQL preview without execution.
Independent Test: Build single-table query with filter and aggregation, verify SQL preview is valid and syntactically correct.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/validate request/response shape in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T016 [P] [US1] Add integration test for single-table query builder with filters, aggregations, and GROUP BY SQL generation in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T017 [P] [US1] Add integration test for query builder validation failures (orphaned filter columns, invalid aggregation types, GROUP BY without aggregations) in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 1

- [ ] T018 [US1] Implement QueryBuilder class with generate_sql() method for single-table queries in apps/backend/app/services/query_service.py
- [ ] T019 [US1] Implement parameterized filter binding (? placeholders) and get_parameters() method in QueryBuilder in apps/backend/app/services/query_service.py
- [ ] T020 [US1] Add QueryConfig and related Pydantic DTOs (SelectedColumn, FilterSpec, AggregationSpec) to apps/backend/app/schemas.py
- [ ] T021 [US1] Add POST /api/v1/workspaces/{workspaceId}/queries/validate endpoint wiring in apps/backend/app/main.py
- [ ] T022 [P] [US1] Build QueryBuilder React component with base-table selector, column picker checkboxes, filter/aggregation UI in apps/builder/src/components/QueryBuilder.tsx
- [ ] T023 [P] [US1] Build FilterPanel React component with operator selector (=, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL) in apps/builder/src/components/FilterPanel.tsx
- [ ] T024 [P] [US1] Build AggregationPanel React component with function selector (SUM, COUNT, AVG, MAX, MIN) in apps/builder/src/components/AggregationPanel.tsx
- [ ] T025 [US1] Implement QueryBuilder API client functions (validate) in apps/builder/src/api/queryApi.js
- [ ] T026 [US1] Connect QueryBuilder UI to backend validate endpoint and display SQL preview (read-only) in apps/builder/src/components/QueryBuilder.tsx

Checkpoint: US1 is independently functional; analysts can build queries and see SQL previews.

---

## Phase 4: User Story 2 - Add Joins Using Approved Relationships (Priority: P1)

Goal: Allow safe multi-table queries via approved relationship rules from spec 002; reject unapproved joins.
Independent Test: Create and approve relationship rule in spec 002, then use in query builder, verify join clause appears in SQL and tables without approved relationships are not joinable.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add contract test for multi-table query validation with approved relationships in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T028 [P] [US2] Add integration test for join SQL generation with approved relationship rule in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T029 [P] [US2] Add integration test for unapproved relationship rejection (409 error) in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T030 [P] [US2] Add integration test for circular join detection and rejection in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 2

- [ ] T031 [US2] Extend JoinValidator with approved-status check against relationship_rules table in apps/backend/app/services/query_service.py
- [ ] T032 [US2] Extend JoinValidator with circular-dependency detection via DFS in apps/backend/app/services/query_service.py
- [ ] T033 [US2] Extend QueryBuilder.generate_sql() to add JOIN clauses using relationship rule join conditions in apps/backend/app/services/query_service.py
- [ ] T034 [US2] Add JoinSpec DTO to apps/backend/app/schemas.py
- [ ] T035 [US2] Update POST /api/v1/workspaces/{workspaceId}/queries/validate to enforce join validation in apps/backend/app/main.py
- [ ] T036 [P] [US2] Build join-builder UI with approved relationship selector and join-type toggle in apps/builder/src/components/QueryBuilder.tsx
- [ ] T037 [US2] Fetch approved relationships from backend and populate join builder dropdown in apps/builder/src/api/queryApi.js

Checkpoint: US2 is independently functional; analysts can safely join tables via approved relationships.

---

## Phase 5: User Story 3 - Preview Results Safely (Priority: P1)

Goal: Execute query with LIMIT 100, enforce 5-second timeout, display preview with row count metadata.
Independent Test: Build query with large result set, click preview, verify exactly 100 rows shown within 5 seconds and "Showing 100 of ~X rows" indicator appears.

### Tests for User Story 3

- [ ] T038 [P] [US3] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/preview request/response shape in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T039 [P] [US3] Add integration test for preview LIMIT 100 execution and cardinality estimation in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T040 [P] [US3] Add integration test for preview timeout (5-second hard limit triggers 408 response) in apps/backend/tests/integration/test_query_execution_timeout.py
- [ ] T041 [P] [US3] Add integration test for preview with empty result set (0 rows) in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 3

- [ ] T042 [US3] Implement QueryExecutor class with execute() method supporting timeout enforcement via signal.alarm() or threading.Timer() in apps/backend/app/services/query_service.py
- [ ] T043 [US3] Implement timeout cancellation logic (hard cancel, no graceful degradation) in QueryExecutor in apps/backend/app/services/query_service.py
- [ ] T044 [US3] Implement preview execution (LIMIT 100 + cardinality estimation) in QueryExecutor in apps/backend/app/services/query_service.py
- [ ] T045 [US3] Add PreviewResultsResponse DTO (rows, totalEstimated, sql, executionMs) to apps/backend/app/schemas.py
- [ ] T046 [US3] Add POST /api/v1/workspaces/{workspaceId}/queries/preview endpoint wiring in apps/backend/app/main.py
- [ ] T047 [P] [US3] Build ResultsViewer React component with paginated table, row-count metadata display in apps/builder/src/components/ResultsViewer.tsx
- [ ] T048 [P] [US3] Implement preview execution with spinner and timeout progress indicator in apps/builder/src/components/QueryBuilder.tsx
- [ ] T049 [US3] Implement preview client function in apps/builder/src/api/queryApi.js
- [ ] T050 [US3] Connect preview button to backend and display results in ResultsViewer in apps/builder/src/components/QueryBuilder.tsx

Checkpoint: US3 is independently functional; safe preview prevents runaway queries.

---

## Phase 6: User Story 4 - Execute Full Query & Handle Large Result Sets (Priority: P1)

Goal: Execute full query without LIMIT, return all rows (with pagination UI support), handle timeouts and errors gracefully.
Independent Test: Execute query on 100k+ row dataset, confirm completion under 5 seconds or timeout message, verify all results available via pagination.

### Tests for User Story 4

- [ ] T051 [P] [US4] Add contract test for POST /api/v1/workspaces/{workspaceId}/queries/execute request/response shape in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T052 [P] [US4] Add integration test for full-query execution returning all rows in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T053 [P] [US4] Add integration test for execution timeout (5-second target with 408 response) in apps/backend/tests/integration/test_query_execution_timeout.py
- [ ] T054 [P] [US4] Add integration test for execution SQL error handling (400 with user-friendly message) in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T055 [P] [US4] Add integration test for memory estimation rejection (413 response for oversized result set) in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 4

- [ ] T056 [US4] Extend QueryExecutor.execute() for full-query execution (no LIMIT) in apps/backend/app/services/query_service.py
- [ ] T057 [US4] Implement result-set materialization and memory estimation in QueryExecutor in apps/backend/app/services/query_service.py
- [ ] T058 [US4] Implement error handling with user-friendly messages (no stack traces) in QueryExecutor in apps/backend/app/services/query_service.py
- [ ] T059 [US4] Add ExecutionResultResponse DTO (rows, totalCount, sql, executionMs, lineage) to apps/backend/app/schemas.py
- [ ] T060 [US4] Add POST /api/v1/workspaces/{workspaceId}/queries/execute endpoint wiring in apps/backend/app/main.py
- [ ] T061 [P] [US4] Extend ResultsViewer with pagination controls and lazy-load support for large result sets in apps/builder/src/components/ResultsViewer.tsx
- [ ] T062 [P] [US4] Add progress indicator and timeout countdown in ResultsViewer in apps/builder/src/components/ResultsViewer.tsx
- [ ] T063 [P] [US4] Add error display (user-friendly message formatting) in ResultsViewer in apps/builder/src/components/ResultsViewer.tsx
- [ ] T064 [US4] Implement execute client function in apps/builder/src/api/queryApi.js
- [ ] T065 [US4] Connect execute button to backend and display results with pagination in apps/builder/src/components/QueryBuilder.tsx

Checkpoint: US4 is independently functional; full-query execution with result materialization works end-to-end.

---

## Phase 7: User Story 5 - Export Results to Excel or CSV (Priority: P1)

Goal: Download query results as .xlsx or .csv with full lineage metadata (Excel includes "Lineage" sheet, CSV includes header comments).
Independent Test: Execute query, export as Excel and CSV, verify both files open correctly, contain all rows, and include lineage (table names, rules, filters, timestamp).

### Tests for User Story 5

- [ ] T066 [P] [US5] Add contract test for GET /api/v1/workspaces/{workspaceId}/queries/{queryId}/download?format=excel|csv in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T067 [P] [US5] Add integration test for Excel export with Lineage worksheet in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T068 [P] [US5] Add integration test for CSV export with lineage header comments in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T069 [P] [US5] Add integration test for export of large result set (1M+ rows) without browser/backend hang in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 5

- [ ] T070 [US5] Implement ResultsLineage class with capture() method for execution-time metadata in apps/backend/app/services/query_service.py
- [ ] T071 [US5] Implement Excel export with openpyxl (Results + Lineage worksheets) in apps/backend/app/services/query_service.py
- [ ] T072 [US5] Implement CSV export with lineage header comments in apps/backend/app/services/query_service.py
- [ ] T073 [US5] Add LineageMetadata, SourceTableMetadata, RelationshipRuleMetadata DTOs to apps/backend/app/schemas.py
- [ ] T074 [US5] Add GET /api/v1/workspaces/{workspaceId}/queries/{queryId}/download endpoint in apps/backend/app/main.py
- [ ] T075 [P] [US5] Add download buttons (Excel/CSV) to ResultsViewer in apps/builder/src/components/ResultsViewer.tsx
- [ ] T076 [P] [US5] Implement file download handling (browser download trigger) in apps/builder/src/components/ResultsViewer.tsx
- [ ] T077 [US5] Implement download client functions in apps/builder/src/api/queryApi.js
- [ ] T078 [US5] Connect download buttons to backend export endpoints in apps/builder/src/components/ResultsViewer.tsx

Checkpoint: US5 is independently functional; analysts can export query results with full traceability.

---

## Phase 8: User Story 6 - Validate Query & Surface Errors Early (Priority: P2)

Goal: Run continuous validation as query is built, highlight orphaned columns, unapproved joins, GROUP BY issues before execution.
Independent Test: Build query with filter on non-existent column, verify validation error appears, remove filter, confirm error clears.

### Tests for User Story 6

- [ ] T079 [P] [US6] Add integration test for orphaned filter column detection and error messaging in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T080 [P] [US6] Add integration test for GROUP BY without aggregations warning in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T081 [P] [US6] Add integration test for ambiguous column names in multi-table queries in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 6

- [ ] T082 [US6] Extend QueryConfigValidator with orphaned-column detection for filters, aggregations, GROUP BY in apps/backend/app/services/query_service.py
- [ ] T083 [US6] Extend QueryConfigValidator with GROUP BY consistency checks (non-aggregated columns, existence validation) in apps/backend/app/services/query_service.py
- [ ] T084 [US6] Add ambiguous column-name detection in multi-table queries in apps/backend/app/services/query_service.py
- [ ] T085 [US6] Extend POST /api/v1/workspaces/{workspaceId}/queries/validate to return detailed validation warnings in apps/backend/app/main.py
- [ ] T086 [P] [US6] Add real-time validation feedback in QueryBuilder UI (error badges on invalid columns/filters) in apps/builder/src/components/QueryBuilder.tsx
- [ ] T087 [US6] Implement debounced validate() calls on query config changes in apps/builder/src/api/queryApi.js
- [ ] T088 [US6] Display validation errors inline in QueryBuilder (red highlights on problematic fields) in apps/builder/src/components/QueryBuilder.tsx

Checkpoint: US6 is independently functional; early validation prevents wasted compute time.

---

## Phase 9: User Story 7 - Save & Reuse Query Configurations (Priority: P2)

Goal: Save queries with name/description, retrieve from library, load, duplicate, and delete saved queries.
Independent Test: Build query, save with name, reload workspace, retrieve saved query, verify all settings restored; duplicate and verify copy created.

### Tests for User Story 7

- [ ] T089 [P] [US7] Add contract tests for POST/GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/saved-queries endpoints in apps/backend/tests/contract/test_query_builder_contract.py
- [ ] T090 [P] [US7] Add integration test for save query lifecycle (create, retrieve, update) in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T091 [P] [US7] Add integration test for orphaned saved query detection (table/column no longer exists) in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T092 [P] [US7] Add integration test for execution history retrieval in apps/backend/tests/integration/test_query_builder_flows.py

### Implementation for User Story 7

- [ ] T093 [US7] Implement SavedQuery service methods (create, read, update, delete, list) in apps/backend/app/services/query_service.py
- [ ] T094 [US7] Implement query config hash computation (SHA256) for reproducibility tracking in apps/backend/app/services/query_service.py
- [ ] T095 [US7] Implement orphaned-query detection (missing table/column) on load in apps/backend/app/services/query_service.py
- [ ] T096 [US7] Add SavedQueryResponse DTO to apps/backend/app/schemas.py
- [ ] T097 [US7] Add POST /api/v1/workspaces/{workspaceId}/saved-queries endpoint in apps/backend/app/main.py
- [ ] T098 [US7] Add GET /api/v1/workspaces/{workspaceId}/saved-queries (list) and GET /api/v1/workspaces/{workspaceId}/saved-queries/{queryId} (detail) endpoints in apps/backend/app/main.py
- [ ] T099 [US7] Add PUT /api/v1/workspaces/{workspaceId}/saved-queries/{queryId} (update) endpoint in apps/backend/app/main.py
- [ ] T100 [US7] Add DELETE /api/v1/workspaces/{workspaceId}/saved-queries/{queryId} endpoint in apps/backend/app/main.py
- [ ] T101 [P] [US7] Build SavedQueriesList React component with list table, load/duplicate/delete actions in apps/builder/src/components/SavedQueriesList.tsx
- [ ] T102 [P] [US7] Add orphaned-query warning display and re-validation prompt in SavedQueriesList in apps/builder/src/components/SavedQueriesList.tsx
- [ ] T103 [US7] Implement saved-query client functions (create, list, get, update, delete) in apps/builder/src/api/queryApi.js
- [ ] T104 [US7] Integrate SavedQueriesList into QueryBuilder UI (load from library, save current query) in apps/builder/src/components/QueryBuilder.tsx

Checkpoint: US7 is independently functional; query reuse and configuration management works end-to-end.

---

## Phase 10: Query Execution Audit & History

Purpose: Logging and reproducibility tracking across all user stories.

- [ ] T105 [US1-US7] Implement execution log persistence (log all query runs to query_execution_log table) in apps/backend/app/services/query_service.py
- [ ] T106 [US1-US7] Add GET /api/v1/workspaces/{workspaceId}/queries/{queryId}/executions endpoint to retrieve execution history in apps/backend/app/main.py
- [ ] T107 [P] [US1-US7] Add execution history viewer (optional in UI, shows past runs with timestamps/errors) in apps/builder/src/components/QueryBuilder.tsx

---

## Phase 11: Builder UI + Polish & Integration

Purpose: End-to-end validation, integration, and quickstart alignment.

- [ ] T108 [P] Integrate all query API functions in apps/builder/src/api/queryApi.js (validate, preview, execute, export, save/load/delete)
- [ ] T109 Implement complete QueryBuilder page layout with all panels (table selector, column picker, filter, aggregation, join, GROUP BY, SQL preview) in apps/builder/src/App.tsx
- [ ] T110 [P] Add end-to-end regression scenarios: build single-table → preview → execute → export; build multi-table with join → preview → execute → export in apps/backend/tests/integration/test_query_builder_flows.py
- [ ] T111 [P] Add builder smoke test: pnpm --filter builder build completes without errors; manual flow check for query building, preview, execute in apps/builder/
- [ ] T112 Update execution and verification steps in specs/003-query-builder-execution/quickstart.md
- [ ] T113 [P] Extend repository documentation: README.md add query builder usage section

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies - can start immediately.
- Foundational (Phase 2): Depends on Setup; **BLOCKS all user story work**.
- User Story phases (Phases 3–9): All depend on Phase 2; execute in priority order P1 (US1–US5) then P2 (US6–US7).
- Query Execution Audit (Phase 10): Depends on foundational + at least US1 core logic; can be integrated throughout.
- Builder/Polish (Phase 11): Depends on all user story phases; final integration and validation.

### User Story Dependencies

- **US1** (Build Query): Can begin after Phase 2; no dependencies on other stories.
- **US2** (Joins): Depends on US1 query config structure; can begin after Phase 2 since join handling is independent.
- **US3** (Preview): Depends on US1 query builder; can begin after Phase 2.
- **US4** (Execute): Depends on US3 query execution foundation; can begin after Phase 2.
- **US5** (Export): Depends on US4 execution results; can begin after Phase 2.
- **US6** (Validation): Cross-cutting; enhances all previous stories; can begin after Phase 2.
- **US7** (Save/Reuse): Depends on US1 query config structure; can begin after Phase 2.

### Within-Story Ordering Rules

- **Tests FIRST**: Write and verify tests fail before implementing.
- **Backend then Frontend**: Service/endpoint implementation before UI.
- **Models before Services**: Define DTOs/schemas before business logic.
- **Services before Endpoints**: Implement query logic before REST wiring.
- **Core before Integration**: Single-table before multi-table; execute before export.

---

## Parallel Execution Opportunities

### Phase 1 (Setup) - All tasks can run in parallel

```
T001, T002, T003, T004, T005 → simultaneous scaffolding
```

### Phase 2 (Foundational) - Parallelizable by subsystem

```
[Database] T006 → T007 (index creation depends on table creation)
[Schemas] T008 (first, all DTOs)
[Services] T009, T010, T011 (can run parallel after T008)
[API] T012 (after T008, T009, T010, T011)
[Tests] T013, T014 (after all above)
```

### Phase 3–9 (User Stories) - Each story is independently parallelizable

```
Phase 3 (US1):
  [Tests] T015, T016, T017 → [Implementation] T018–T026 → [UI] T022, T023, T024 → [Integration] T025, T026

Phase 4 (US2) [can start after Phase 2]:
  [Tests] T027, T028, T029, T030 → [Implementation] T031–T035 → [UI] T036, T037

Phase 5 (US3) [can start after Phase 2]:
  [Tests] T038–T041 → [Implementation] T042–T046 → [UI] T047, T048 → [Integration] T049, T050
```

### Phase 11 (Polish) - Parallelizable tests and documentation

```
T110, T111, T112, T113 → simultaneous validation and docs
```

---

## MVP Scope (Minimum Viable Phase)

**Phase 1–5 deliverables constitute the MVP**:

- ✅ Phase 1: Scaffolding
- ✅ Phase 2: Data model + shared validation
- ✅ Phase 3: Single-table query building
- ✅ Phase 4: Multi-table joins via approved relationships
- ✅ Phase 5: Safe preview (LIMIT 100, 5-second timeout)
- ✅ Phase 6: Full execution with results
- ✅ Phase 7: Export to Excel/CSV with lineage

**Optional enhancements (P2)**:

- Early validation (Phase 8 / US6)
- Query save/reuse library (Phase 9 / US7)
- Execution audit trail (Phase 10)

---

## Task Count Summary

| Phase     | User Story             | Count   | Status  |
| --------- | ---------------------- | ------- | ------- |
| Phase 1   | Setup                  | 5       | ✓ Ready |
| Phase 2   | Foundational           | 9       | ✓ Ready |
| Phase 3   | US1 (Build Query)      | 12      | ✓ Ready |
| Phase 4   | US2 (Joins)            | 11      | ✓ Ready |
| Phase 5   | US3 (Preview Safe)     | 13      | ✓ Ready |
| Phase 6   | US4 (Execute Full)     | 15      | ✓ Ready |
| Phase 7   | US5 (Export Excel/CSV) | 14      | ✓ Ready |
| Phase 8   | US6 (Validate Early)   | 9       | ✓ Ready |
| Phase 9   | US7 (Save/Reuse)       | 16      | ✓ Ready |
| Phase 10  | Audit & History        | 3       | ✓ Ready |
| Phase 11  | Polish & Integration   | 6       | ✓ Ready |
| **TOTAL** |                        | **113** | ✓ Ready |

---

## Implementation Strategy

### MVP First (Phases 1–7: 72 tasks)

Deliver core query building, execution, and export within MVP 1 timeline:

- Week 1: Phases 1–2 (scaffolding + foundation)
- Week 2–3: Phases 3–7 (user stories P1, core delivery)

### Iterative Enhancement (Phases 8–11: 41 tasks)

Add validation, reusability, and polish:

- Week 4+: Phases 8–9 (validation, save/load)
- Week 5+: Phase 10–11 (audit, integration)

---

## Format Reference

Each task follows strict checklist format:

```
- [ ] [TaskID] [P?] [Story?] Description with file path
```

- **Checkbox**: `- [ ]` (unchecked during planning)
- **Task ID**: Sequential (T001, T002, ..., T113)
- **[P] marker**: Parallelizable (different files, no ordering dependency)
- **[Story] label**: User story marker (US1, US2, ..., US7) for story-phase tasks
- **Description**: Clear action + exact file path

**Examples**:

- ✅ `- [ ] T001 Add query service module scaffold in apps/backend/app/services/query_service.py`
- ✅ `- [ ] T015 [P] [US1] Add contract test for POST /api/.../queries/validate in apps/backend/tests/contract/test_query_builder_contract.py`
- ✅ `- [ ] T042 [US3] Implement QueryExecutor class with execute() method in apps/backend/app/services/query_service.py`
