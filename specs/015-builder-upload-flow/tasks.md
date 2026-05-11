# Tasks: Builder Upload Flow Completion

**Input**: Design documents from `/specs/015-builder-upload-flow/`
**Prerequisites**: `spec.md` (available), existing backend source-dispatch implementation from Spec 010, existing builder workflow shell/session-state wiring from Spec 013

**Tests**: Included, because acceptance evidence in this round requires independently verifiable UI and API behavior for each user story.

**Organization**: Tasks are grouped by user story so each story can be built and validated independently while preserving backend upload semantics.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependency on unfinished tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Every task includes concrete file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create acceptance-evidence scaffolding and upload-flow task anchors.

- [x] T001 Create acceptance evidence ledger in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`
- [x] T002 Add builder upload-flow test scaffolding in `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx` and `apps/builder/src/components/__tests__/UploadProgressPanel.test.tsx`
- [x] T003 [P] Add backend upload-flow test scaffolding in `apps/backend/tests/contract/test_upload_flow_contract.py` and `apps/backend/tests/integration/test_upload_flow_builder_transition.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared contracts and primitives used by all user stories.

**⚠️ CRITICAL**: No user story implementation should start until this phase is complete.

- [x] T004 Extend upload/source API types for source selection, sheet options, and progress-state compatibility in `apps/builder/src/api/types.ts`
- [x] T005 [P] Extend builder upload API client signatures for source type, optional sheet selection, and upload lifecycle callbacks in `apps/builder/src/api/workspaceApi.ts`
- [x] T006 Implement focused upload-flow local state model (selected source type, sheet options, progress, errors) in `apps/builder/src/state/uploadFlowStore.ts` and export in `apps/builder/src/state/index.ts`
- [x] T007 [P] Add backend request/response schemas for source-type selection and sheet-discovery payloads in `apps/backend/app/schemas.py`
- [x] T008 Implement backend upload-request parsing helpers (source-type compatibility, optional sheet target) in `apps/backend/app/api/upload.py`
- [x] T009 Record foundational contract evidence in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`

**Checkpoint**: Frontend and backend contracts are aligned; story implementation can proceed.

---

## Phase 3: User Story 1 - Source Selection and Valid Upload Start (Priority: P1) 🎯 MVP

**Goal**: User can explicitly choose source type, receive compatibility validation, and submit only valid combinations.

**Independent Test**: On upload UI, selecting supported source types enables valid file combinations and blocks invalid ones with clear correction messaging.

### Tests for User Story 1

- [x] T010 [P] [US1] Add source-type/file-compatibility unit tests in `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx`
- [x] T011 [P] [US1] Add backend contract tests for source-type-aware upload request validation in `apps/backend/tests/contract/test_upload_flow_contract.py`

### Implementation for User Story 1

- [x] T012 [P] [US1] Build source type selector UI and helper text component in `apps/builder/src/components/upload-flow/SourceTypeSelector.tsx`
- [x] T013 [P] [US1] Build upload validation banner for mismatched source/file combinations in `apps/builder/src/components/upload-flow/UploadValidationNotice.tsx`
- [x] T014 [US1] Integrate source selection + validation state into upload stage UI in `apps/builder/src/App.tsx`
- [x] T015 [US1] Wire source-type-aware upload request from builder to backend dispatch endpoint in `apps/builder/src/api/workspaceApi.ts` and `apps/backend/app/api/upload.py`
- [x] T016 [US1] Preserve existing non-Excel upload semantics while enforcing compatibility checks in `apps/backend/app/api/upload.py` and `apps/backend/tests/integration/test_upload_flow_with_sources.py`
- [x] T017 [US1] Capture US1 acceptance evidence (valid combinations, invalid blocks, source change reset behavior) in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`

**Checkpoint**: US1 is complete and independently testable.

---

## Phase 4: User Story 2 - Excel Sheet Picker When Required (Priority: P1)

**Goal**: Multi-sheet Excel uploads require explicit sheet choice; single-sheet uploads avoid unnecessary extra step.

**Independent Test**: Multi-sheet workbook triggers sheet picker and requires selection before submit; single-sheet workbook proceeds without sheet step.

### Tests for User Story 2

- [x] T018 [P] [US2] Add builder sheet-picker behavior tests (multi-sheet, single-sheet, metadata failure) in `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx`
- [x] T019 [P] [US2] Add backend integration tests for sheet metadata retrieval and selected-sheet upload dispatch in `apps/backend/tests/integration/test_upload_flow_builder_transition.py`

### Implementation for User Story 2

- [x] T020 [P] [US2] Extend Excel source config and parser support for explicit sheet selection in `apps/backend/app/sources/excel_source.py`
- [x] T021 [US2] Add backend sheet discovery endpoint for Excel uploads in `apps/backend/app/api/upload.py` and schema contracts in `apps/backend/app/schemas.py`
- [x] T022 [US2] Add builder API client methods for sheet discovery and selected-sheet upload in `apps/builder/src/api/workspaceApi.ts`
- [x] T023 [P] [US2] Build sheet picker component with clear option labels and reset behavior in `apps/builder/src/components/upload-flow/ExcelSheetPicker.tsx`
- [x] T024 [US2] Integrate sheet discovery + selection flow into upload stage UI (including reselect/retry path) in `apps/builder/src/App.tsx`
- [x] T025 [US2] Add actionable error mapping for sheet discovery failures in `apps/builder/src/api/httpErrors.ts` and UI rendering in `apps/builder/src/components/errors/ActionableErrorPanel.tsx`
- [x] T026 [US2] Capture US2 acceptance evidence (multi-sheet required, single-sheet bypass, failure recovery) in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`

**Checkpoint**: US2 is complete and independently testable.

---

## Phase 5: User Story 3 - Upload Progress and Workspace Transition (Priority: P1)

**Goal**: User sees clear upload lifecycle feedback and is transitioned to workspace workflow context on success.

**Independent Test**: Submit upload and observe progress states through completion; successful run transitions to workspace stage, failed run stays in upload context with retry guidance.

### Tests for User Story 3

- [x] T027 [P] [US3] Add builder progress-state and transition tests in `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx` and `apps/builder/src/pages/__tests__/BuilderWorkflowPage.test.tsx`
- [x] T028 [P] [US3] Add backend integration test verifying transition metadata is present on successful upload response in `apps/backend/tests/integration/test_upload_flow_builder_transition.py`

### Implementation for User Story 3

- [x] T029 [P] [US3] Build upload progress/status panel component for pending/running/success/failure states in `apps/builder/src/components/upload-flow/UploadProgressPanel.tsx`
- [x] T030 [US3] Wire progress lifecycle updates and disable/enable behavior during upload in `apps/builder/src/App.tsx` and `apps/builder/src/state/uploadFlowStore.ts`
- [x] T031 [US3] Set active workspace/source context after successful upload and navigate to workflow stage in `apps/builder/src/api/builderSessionApi.ts`, `apps/builder/src/pages/BuilderWorkflowPage.tsx`, and `apps/builder/src/App.tsx`
- [x] T032 [US3] Ensure failed uploads remain in upload context with clear retry guidance in `apps/builder/src/App.tsx` and `apps/builder/src/components/errors/ActionableErrorPanel.tsx`
- [x] T033 [US3] Keep backend upload dispatch semantics stable while returning transition-safe identifiers in `apps/backend/app/api/upload.py` and `apps/backend/app/schemas.py`
- [x] T034 [US3] Capture US3 acceptance evidence (progress visibility, success transition, failure retry path) in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`

**Checkpoint**: US3 is complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate round focus, behavior preservation, and end-to-end acceptance evidence.

- [x] T035 [P] Run focused builder test suite for upload flow UI and workflow transition in `apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx`, `apps/builder/src/components/__tests__/UploadProgressPanel.test.tsx`, and `apps/builder/src/pages/__tests__/BuilderWorkflowPage.test.tsx`
- [x] T036 [P] Run focused backend contract/integration suite for upload dispatch + sheet handling in `apps/backend/tests/contract/test_upload_flow_contract.py`, `apps/backend/tests/integration/test_upload_flow_builder_transition.py`, and `apps/backend/tests/integration/test_upload_flow_with_sources.py`
- [x] T037 Verify unchanged non-Excel behavior and source registry dispatch semantics in `apps/backend/app/api/upload.py`, `apps/backend/app/services/source_registry.py`, and `apps/backend/tests/integration/test_upload_flow_with_sources.py`
- [x] T038 Finalize round acceptance record and changed-file scope audit in `specs/015-builder-upload-flow/checklists/acceptance-evidence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 and reuses US1 source-selection state.
- **Phase 5 (US3)**: Depends on Phase 2 and completed US1/US2 upload state wiring.
- **Phase 6 (Polish)**: Depends on completion of US1-US3.

### User Story Dependency Graph

- **US1 (P1)**: Starts after Foundational; no dependence on other stories.
- **US2 (P1)**: Starts after Foundational and should layer on US1 upload state shape.
- **US3 (P1)**: Starts after US1/US2 integration to avoid transition logic on incomplete upload states.

Story order: **US1 → US2 → US3**

### Within Each User Story

- Tests first (author and run red/green checks).
- API/contracts before UI wiring when both are required.
- Core implementation before acceptance evidence capture.

---

## Parallel Opportunities

- **Setup**: T002 and T003 can run concurrently.
- **Foundational**: T005 and T007 can run concurrently; T006 can proceed after T004.
- **US1**: T012 and T013 can run concurrently after T010/T011 exist.
- **US2**: T020 and T023 can run concurrently after T018/T019 establish expected behavior.
- **US3**: T029 and backend test task T028 can run concurrently before final wiring tasks.
- **Polish**: T035 and T036 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel UI component work after tests exist:
Task: "T012 [US1] Build source type selector UI in apps/builder/src/components/upload-flow/SourceTypeSelector.tsx"
Task: "T013 [US1] Build upload validation banner in apps/builder/src/components/upload-flow/UploadValidationNotice.tsx"

# Parallel validation tracks:
Task: "T010 [US1] Builder compatibility tests"
Task: "T011 [US1] Backend upload contract tests"
```

## Parallel Example: User Story 2

```bash
# Parallel backend/frontend building blocks:
Task: "T020 [US2] Extend Excel parser for explicit sheet selection"
Task: "T023 [US2] Build Excel sheet picker UI"

# Parallel verification:
Task: "T018 [US2] Builder sheet-picker behavior tests"
Task: "T019 [US2] Backend sheet metadata integration tests"
```

## Parallel Example: User Story 3

```bash
# Parallel progress and transition work:
Task: "T029 [US3] Build upload progress panel"
Task: "T028 [US3] Add backend transition-metadata integration test"

# Parallel polish validation:
Task: "T035 Run focused builder tests"
Task: "T036 Run focused backend tests"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 source selection + compatibility enforcement.
3. Validate US1 independently and record evidence in `checklists/acceptance-evidence.md`.

### Incremental Delivery

1. Add US2 Excel sheet picker and failure recovery path.
2. Add US3 progress feedback and workspace transition.
3. Finish with Phase 6 evidence and scope checks.

### Scope Guardrail For This Round

- Keep changes limited to builder upload UI, Excel sheet decision flow, progress feedback, transition behavior, and required backend upload dispatch integration.
- Do not introduce unrelated navigation redesign, new source types, or backend dispatch refactors beyond feature-required request/response support.
