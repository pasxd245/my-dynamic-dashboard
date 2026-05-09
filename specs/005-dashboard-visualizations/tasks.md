# Tasks: Dashboard & Visualizations (Spec 005)

Input: design documents from /specs/005-dashboard-visualizations/
Prerequisites: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-visualizations.openapi.yaml, quickstart.md

Tests: Included per user story (contract + integration + performance) and ordered before implementation tasks.
Organization: Tasks are grouped by user story so each story is independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare backend and Streamlit scaffolding for dashboard delivery.

- [x] T001 Create dashboard service module scaffold in apps/backend/app/services/dashboard_service.py
- [x] T002 [P] Create panel executor service module scaffold in apps/backend/app/services/panel_executor_service.py
- [x] T003 [P] Create chart suggestion service module scaffold in apps/backend/app/services/chart_suggestion_service.py
- [x] T004 [P] Create dashboard contract test scaffold in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T005 [P] Create dashboard integration test scaffolds in apps/backend/tests/integration/test_dashboard_lifecycle.py, apps/backend/tests/integration/test_dashboard_run.py, and apps/backend/tests/integration/test_chart_suggestion.py
- [x] T006 Create Streamlit dashboard app skeleton and entrypoint in apps/dashboard/streamlit_app.py
- [x] T007 [P] Create Streamlit dashboard API client scaffold in apps/dashboard/src/api/dashboard_api.py
- [ ] T008 [P] Create Streamlit component scaffolds in apps/dashboard/src/components/dashboard_header.py, apps/dashboard/src/components/parameter_panel.py, apps/dashboard/src/components/query_panel.py, apps/dashboard/src/components/chart_viewer.py, and apps/dashboard/src/components/export_controls.py

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared schema, DTOs, orchestration primitives, and app wiring required by all stories.

CRITICAL: Complete this phase before user story implementation.

- [x] T009 Add dashboard metadata tables (dashboards, dashboard_panels, dashboard_runs, dashboard_run_panels, dashboard_run_events) in apps/backend/app/core/metadata_db.py
- [x] T010 [P] Add metadata DB indexes for dashboard list, panel order, run history, and active refresh lookups in apps/backend/app/core/metadata_db.py
- [x] T011 [P] Add shared dashboard enums and base DTOs (cadence, run status, panel status, chart type, error type) in apps/backend/app/schemas.py
- [x] T012 [P] Add dashboard request/response DTOs matching contract schemas in apps/backend/app/schemas.py
- [x] T013 [P] Add dashboard repository helpers for CRUD and ordered panel persistence in apps/backend/app/services/dashboard_service.py
- [ ] T014 [P] Add run state transition helpers and overlapping-run guard utilities in apps/backend/app/services/dashboard_service.py
- [ ] T015 [P] Add shared parameter schema merge/validation utilities in apps/backend/app/services/panel_executor_service.py
- [ ] T016 [P] Add shared panel result projection and pagination helpers in apps/backend/app/services/panel_executor_service.py
- [ ] T017 Implement shared dashboard error mapping (400/404/409/422/503) and response envelopes in apps/backend/app/main.py
- [x] T018 [P] Wire Streamlit app package dependencies and runtime requirements in apps/dashboard/requirements.txt
- [ ] T019 [P] Wire dashboard service base URL, retries, and timeout defaults in apps/dashboard/src/api/dashboard_api.py
- [x] T020 [P] Add foundational metadata schema verification for dashboard tables in apps/backend/tests/integration/test_metadata_schema.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Open Weekly Dashboard and Understand Status (Priority: P1) MVP

Goal: Managers open a dashboard URL and immediately see dashboard metadata, panel context, KPI/chart/table content, lineage, and export controls.
Independent Test: Open a dashboard with multiple panels and verify header + panel sections render with active refresh metadata and parameter summary.

### Tests for User Story 1

- [x] T021 [P] [US1] Add contract tests for dashboard list/get endpoints in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T022 [P] [US1] Add contract tests for panel run detail and panel data endpoints in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T023 [P] [US1] Add integration test for dashboard page load with header, panel metadata, lineage, and table preview in apps/backend/tests/integration/test_dashboard_lifecycle.py

### Implementation for User Story 1

- [x] T024 [US1] Implement list/create/get/update/delete dashboard endpoints in apps/backend/app/main.py
- [x] T025 [US1] Implement dashboard lifecycle service methods (create, get, list, update, soft-delete) in apps/backend/app/services/dashboard_service.py
- [ ] T026 [US1] Implement panel data retrieval endpoint with limit/offset pagination in apps/backend/app/main.py
- [ ] T027 [US1] Implement panel data retrieval service with row_count/has_more response mapping in apps/backend/app/services/panel_executor_service.py
- [ ] T028 [US1] Implement Streamlit page loader and dashboard route state in apps/dashboard/streamlit_app.py
- [ ] T029 [P] [US1] Implement dashboard header rendering (title, workspace, last refresh, cadence, health, parameter chips) in apps/dashboard/src/components/dashboard_header.py
- [ ] T030 [P] [US1] Implement panel frame rendering (name, description, version, status badges) in apps/dashboard/src/components/query_panel.py
- [ ] T031 [P] [US1] Implement KPI/table/lineage sections and table preview pagination controls in apps/dashboard/src/components/query_panel.py
- [ ] T032 [US1] Implement dashboard API client methods for list/get/run detail/panel data in apps/dashboard/src/api/dashboard_api.py
- [ ] T033 [US1] Integrate header and panel components with backend responses in apps/dashboard/streamlit_app.py

Checkpoint: US1 is independently functional.

---

## Phase 4: User Story 2 - Curate Panels and Parameters (Priority: P1)

Goal: Analysts can add/remove/reorder panels, persist composition, and run dashboards with validated saved-query parameters.
Independent Test: Build a 3-panel dashboard, reorder/remove one panel, apply parameters, save/reopen, and confirm composition + defaults persist.

### Tests for User Story 2

- [x] T034 [P] [US2] Add contract tests for add/update/delete panel endpoints and payload validation in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T035 [P] [US2] Add contract tests for run request parameter validation errors in apps/backend/tests/contract/test_dashboard_contract.py
- [x] T036 [P] [US2] Add integration test for add/remove/reorder persistence and parameter override persistence in apps/backend/tests/integration/test_dashboard_lifecycle.py

### Implementation for User Story 2

- [x] T037 [US2] Implement add panel endpoint and saved-query ownership/workspace validation in apps/backend/app/main.py
- [x] T038 [US2] Implement patch panel endpoint for order/visibility/name/chart/parameter updates in apps/backend/app/main.py
- [x] T039 [US2] Implement delete panel endpoint and order compaction logic in apps/backend/app/main.py
- [x] T040 [US2] Implement panel CRUD and reorder transaction logic in apps/backend/app/services/dashboard_service.py
- [ ] T041 [US2] Implement saved-query parameter schema fetch and strict declared-parameter validation in apps/backend/app/services/panel_executor_service.py
- [ ] T042 [US2] Implement run request parameter merge (dashboard-level + panel overrides) in apps/backend/app/services/panel_executor_service.py
- [ ] T043 [P] [US2] Implement dashboard controls row (add/remove/reorder interactions) in apps/dashboard/src/components/query_panel.py
- [ ] T044 [P] [US2] Implement dynamic parameter drawer with per-parameter validation feedback in apps/dashboard/src/components/parameter_panel.py
- [ ] T045 [US2] Integrate panel curation and parameter submission flows in apps/dashboard/streamlit_app.py

Checkpoint: US2 is independently functional.

---

## Phase 5: User Story 3 - Chart Suggestions with Analyst Overrides (Priority: P1)

Goal: System auto-suggests charts from result schema and analysts can override chart configuration without changing saved-query definitions.
Independent Test: Load panel with time/category/measure fields, verify suggestion, apply override (type/axes/colors), reload dashboard, and confirm override persists.

### Tests for User Story 3

- [ ] T046 [P] [US3] Add contract test for chart suggestion endpoint response shape in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T047 [P] [US3] Add integration tests for chart suggestion heuristics (line, bar, scatter, table_only fallback) in apps/backend/tests/integration/test_chart_suggestion.py
- [ ] T048 [P] [US3] Add integration test for persisted chart override reapplication on subsequent runs in apps/backend/tests/integration/test_dashboard_run.py

### Implementation for User Story 3

- [ ] T049 [US3] Implement column-role detection and heuristic chart selector in apps/backend/app/services/chart_suggestion_service.py
- [ ] T050 [US3] Implement chart suggestion endpoint and reason/axes payload mapping in apps/backend/app/main.py
- [ ] T051 [US3] Implement chart override persistence and retrieval on panel configuration in apps/backend/app/services/dashboard_service.py
- [ ] T052 [US3] Implement panel run chart suggestion storage (type + rationale) in apps/backend/app/services/panel_executor_service.py
- [ ] T053 [P] [US3] Implement chart viewer rendering for bar/line/scatter/pie/heatmap/table-only in apps/dashboard/src/components/chart_viewer.py
- [ ] T054 [P] [US3] Implement chart configuration editor (type, axes, labels, palette, visible fields, sort) in apps/dashboard/src/components/chart_viewer.py
- [ ] T055 [US3] Implement chart suggestion and panel patch API client methods in apps/dashboard/src/api/dashboard_api.py
- [ ] T056 [US3] Integrate chart suggestion display and override save/load flow in apps/dashboard/src/components/query_panel.py
- [ ] T057 [US3] Label KPI trust posture (exploratory vs decision-ready) from panel metadata in apps/dashboard/src/components/query_panel.py

Checkpoint: US3 is independently functional.

---

## Phase 6: User Story 4 - Refresh Cadence, Exports, and Run History (Priority: P2)

Goal: Users refresh manually or by cadence, export dashboard/panel artifacts with exact context, and inspect run history.
Independent Test: Trigger manual refresh, set 15-minute cadence, export PNG/PDF and XLSX/CSV, then verify run history includes parameters, query versions, and per-panel statuses.

### Tests for User Story 4

- [ ] T058 [P] [US4] Add contract tests for run trigger, cadence update, and run history endpoints in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T059 [P] [US4] Add contract tests for dashboard and panel export endpoints in apps/backend/tests/contract/test_dashboard_contract.py
- [ ] T060 [P] [US4] Add integration test for manual refresh and non-overlapping cadence enforcement in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T061 [P] [US4] Add integration test for PNG/PDF and XLSX/CSV export context fidelity in apps/backend/tests/integration/test_dashboard_run.py

### Implementation for User Story 4

- [ ] T062 [US4] Implement run trigger endpoint with 202 accepted semantics and running-state conflict response in apps/backend/app/main.py
- [ ] T063 [US4] Implement refresh cadence endpoint (manual, 15min, 60min) in apps/backend/app/main.py
- [ ] T064 [US4] Implement run history list/detail endpoints with per-panel status projections in apps/backend/app/main.py
- [ ] T065 [US4] Implement dashboard run orchestration and overlap guard in apps/backend/app/services/dashboard_service.py
- [ ] T066 [US4] Implement run history persistence (dashboard_runs, dashboard_run_panels, dashboard_run_events) in apps/backend/app/services/dashboard_service.py
- [ ] T067 [US4] Implement dashboard export endpoint/service flow (png/pdf) in apps/backend/app/main.py and apps/backend/app/services/dashboard_service.py
- [ ] T068 [US4] Implement panel export endpoint/service flow (xlsx/csv) with query version + parameter context in apps/backend/app/main.py and apps/backend/app/services/panel_executor_service.py
- [ ] T069 [P] [US4] Implement refresh controls (manual trigger + cadence selector + in-progress indicator) in apps/dashboard/src/components/dashboard_header.py
- [ ] T070 [P] [US4] Implement dashboard and panel export controls with completion/error state in apps/dashboard/src/components/export_controls.py
- [ ] T071 [P] [US4] Implement run history timeline UI and panel-status drilldown in apps/dashboard/src/components/dashboard_header.py
- [ ] T072 [US4] Integrate refresh/export/history API calls and notifications in apps/dashboard/streamlit_app.py

Checkpoint: US4 is independently functional.

---

## Phase 7: User Story 5 - Fail Safely on Broken or Slow Panels (Priority: P2)

Goal: Broken or slow panels fail in isolation while healthy panels remain visible, with bounded errors and retry guidance.
Independent Test: Break one panel query and induce one timeout; verify other panels render, failed panels show bounded states, and page-level health messaging appears only for backend outages.

### Tests for User Story 5

- [ ] T073 [P] [US5] Add integration test for single-panel validation failure isolation in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T074 [P] [US5] Add integration test for timeout panel delayed-state behavior and healthy-panel continuity in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T075 [P] [US5] Add integration test for backend-unavailable page-level health behavior in apps/backend/tests/integration/test_dashboard_lifecycle.py
- [ ] T076 [P] [US5] Add integration test for blocked export when panel run is partial or failed in apps/backend/tests/integration/test_dashboard_run.py

### Implementation for User Story 5

- [ ] T077 [US5] Implement panel preflight revalidation against saved query availability and relationship/query readiness in apps/backend/app/services/panel_executor_service.py
- [ ] T078 [US5] Implement per-panel timeout and delayed-state transitions with bounded error typing in apps/backend/app/services/panel_executor_service.py
- [ ] T079 [US5] Implement panel isolation in run orchestrator so one panel failure does not fail the dashboard run in apps/backend/app/services/dashboard_service.py
- [ ] T080 [US5] Implement service-health endpoint checks and stale-data guard in apps/backend/app/main.py
- [ ] T081 [P] [US5] Implement bounded panel error container with retry action in apps/dashboard/src/components/query_panel.py
- [ ] T082 [P] [US5] Implement delayed panel loading/skeleton and non-blocking completion behavior in apps/dashboard/src/components/query_panel.py
- [ ] T083 [P] [US5] Implement page-level service-health banner for backend outages in apps/dashboard/src/components/dashboard_header.py
- [ ] T084 [US5] Implement export eligibility guard (completed panel only or explicit partial label) in apps/backend/app/services/panel_executor_service.py
- [ ] T085 [US5] Integrate panel retry actions and health polling in apps/dashboard/streamlit_app.py
- [ ] T086 [US5] Add user-facing error message mapping for validation/schema_drift/broken_relationship/timeout/unexpected in apps/dashboard/src/api/dashboard_api.py

Checkpoint: US5 is independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

Purpose: Final hardening, performance verification, and documentation alignment.

- [ ] T087 [P] Add performance regression test for panel render target (<3s with 100k+ rows via aggregation/sampling) in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T088 [P] Add performance regression test for paginated panel data retrieval and lazy table rendering budget in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T089 [P] Add performance regression tests for export duration targets (PNG/PDF under 5s, XLSX/CSV under 10s) in apps/backend/tests/integration/test_dashboard_run.py
- [ ] T090 Add visualization safety guard for high-cardinality/mixed/null-heavy datasets with explicit fallback rationale in apps/backend/app/services/chart_suggestion_service.py
- [ ] T091 [P] Add Streamlit smoke startup and minimal navigation checks in apps/dashboard/streamlit_app.py and apps/dashboard/requirements.txt
- [ ] T092 Update quickstart execution/verification steps for completed dashboard behavior in specs/005-dashboard-visualizations/quickstart.md
- [ ] T093 [P] Update dashboard API contract examples and error payload examples in specs/005-dashboard-visualizations/contracts/dashboard-visualizations.openapi.yaml
- [ ] T094 [P] Update feature documentation summary and delivery notes in specs/005-dashboard-visualizations/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user story work.
- User Story phases (Phase 3-7): Depend on Phase 2 and run in priority order P1 (US1-US3) then P2 (US4-US5).
- Polish (Phase 8): Depends on all targeted user stories.

### User Story Dependencies

- US1: Can begin after Phase 2.
- US2: Depends on US1 dashboard and panel retrieval flows.
- US3: Depends on US1 panel rendering and US2 panel update persistence.
- US4: Depends on US1 panel data and US2 parameter validation.
- US5: Depends on US4 run orchestration/history state and export eligibility logic.

### Within-Story Ordering Rules

- Tests first.
- Backend schemas/services before endpoint wiring.
- Backend APIs before Streamlit integration.
- Streamlit component implementation before end-to-end app wiring.
- Tasks marked [P] are parallelizable when no incomplete dependency exists.

---

## Parallel Execution Opportunities

### Phase 1 (Setup)

- T002, T003, T004, T005, T007, and T008 can run in parallel after T001.

### Phase 2 (Foundational)

- T010, T011, T012, T013, T014, T015, T016, T018, T019, and T020 can run in parallel after T009 where file dependencies do not overlap.

### User Story Parallel Examples

- US1: Run T021-T023 in parallel, then T029-T031 in parallel, then T033.
- US2: Run T034-T036 in parallel, then T043 and T044 in parallel.
- US3: Run T046-T048 in parallel, then T053 and T054 in parallel.
- US4: Run T058-T061 in parallel, then T069-T071 in parallel.
- US5: Run T073-T076 in parallel, then T081-T083 in parallel.

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (open/read dashboard).
3. Deliver US2 (panel curation + parameter validation).
4. Deliver US3 (chart suggestion + override persistence).
5. Validate AC-001 through AC-006 before moving to P2.

### Incremental Delivery

1. Add US4 for refresh cadence, exports, and run history.
2. Add US5 for failure isolation and bounded health/error states.
3. Complete Phase 8 performance and hardening checks.

### Suggested MVP Scope

- Recommended MVP scope for earliest manager-facing value: US1 + US2 + US3.

---

## Task Count Summary

- Total tasks: 94
- Setup (Phase 1): 8
- Foundational (Phase 2): 12
- US1: 13
- US2: 12
- US3: 12
- US4: 15
- US5: 14
- Polish (Phase 8): 8
