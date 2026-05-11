# Tasks: Builder Upload UX Refresh

**Input**: Design documents from `/specs/016-builder-upload-ux/`
**Prerequisites**: spec.md (required), plan.md (present but template), checklists/requirements.md

**Tests**: Focused frontend tests are included because the feature spec defines mandatory independent testing per user story and acceptance gates.

**Organization**: Tasks are grouped by user story so each UX deliverable is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes concrete file path targets

## Phase 1: Setup (Shared Frontend Baseline)

**Purpose**: Prepare builder-only UX scaffolding targets and visual-direction baseline.

- [x] T001 Align upload UX visual tokens to moodboard direction in apps/builder/src/index.css
- [x] T002 [P] Document target upload-stage inventory and gate mapping notes in specs/016-builder-upload-ux/checklists/requirements.md
- [x] T003 [P] Create upload-flow component scaffold index in apps/builder/src/components/upload-flow/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core upload-flow state and shell primitives required before user-story work.

**⚠️ CRITICAL**: No user story implementation begins before this phase is complete.

- [x] T004 Extend upload stage/session state shape for guided flow + dependency resets in apps/builder/src/state/uploadFlowStore.ts
- [x] T005 [P] Add stage model + transition guard utilities in apps/builder/src/components/upload-flow/uploadStageModel.ts
- [x] T006 [P] Add reusable loading-mask and toast primitives in apps/builder/src/components/upload-flow/UploadLoadingMask.tsx
- [x] T007 [P] Add reusable toast stack component in apps/builder/src/components/upload-flow/UploadToastStack.tsx
- [x] T008 Wire foundational upload shell state into route entrypoint in apps/builder/src/App.tsx

**Checkpoint**: Upload UX foundation is ready; user-story delivery can proceed.

---

## Phase 3: User Story 1 - Navigate Upload Stages from Sidebar (Priority: P1) 🎯 MVP

**Goal**: Deliver sidebar-driven stage orientation with guarded navigation and preserved context.

**Independent Test**: User can view ordered stages, move to allowed stages, and receives blocked-stage guidance when prerequisites are unmet.

### Tests for User Story 1

- [x] T009 [P] [US1] Add sidebar stage rendering/active-state tests in apps/builder/src/pages/**tests**/UploadFlowPage.test.tsx
- [x] T010 [P] [US1] Add blocked-stage navigation guard tests in apps/builder/src/pages/**tests**/BuilderWorkflowPage.test.tsx

### Implementation for User Story 1

- [x] T011 [US1] Implement upload stage sidebar component with active/completed/blocked visuals in apps/builder/src/components/upload-flow/UploadStageSidebar.tsx
- [x] T012 [US1] Integrate sidebar selection and guard behavior in apps/builder/src/App.tsx
- [x] T013 [US1] Add blocked-stage inline guidance panel for unmet prerequisites in apps/builder/src/components/upload-flow/UploadValidationNotice.tsx

**Checkpoint**: Sidebar navigation UX is independently functional and testable.

---

## Phase 4: User Story 2 - Complete a Guided Multi-Step Upload Form (Priority: P1)

**Goal**: Deliver clear step-by-step form progression with required-field enforcement and dependency revalidation.

**Independent Test**: User completes workspace → source/file → sheet (when required) → submit flow with enforced required inputs and no stale dependent values.

### Tests for User Story 2

- [x] T014 [P] [US2] Add multi-step progression and required-input enforcement tests in apps/builder/src/pages/**tests**/UploadFlowPage.test.tsx
- [x] T015 [P] [US2] Add upstream-change dependency reset tests in apps/builder/src/state/**tests**/uploadFlowStore.test.ts

### Implementation for User Story 2

- [x] T016 [US2] Implement step content panels and next/back controls in apps/builder/src/App.tsx
- [x] T017 [US2] Enforce per-step validation and dependent field reset logic in apps/builder/src/state/uploadFlowStore.ts
- [x] T018 [US2] Keep upload request payload semantics unchanged while wiring step submit path in apps/builder/src/api/workspaceApi.ts

**Checkpoint**: Guided multi-step upload form is independently functional and testable.

---

## Phase 5: User Story 3 - See Blocking Loading Mask During Async Operations (Priority: P1)

**Goal**: Show a blocking mask during discovery/upload async work and prevent conflicting actions.

**Independent Test**: Trigger discovery/upload, verify mask appears, blocks conflicting controls, and clears on success/failure.

### Tests for User Story 3

- [x] T019 [P] [US3] Add loading-mask visibility and clear-on-settle tests in apps/builder/src/components/**tests**/UploadLoadingMask.test.tsx
- [x] T020 [P] [US3] Add conflicting-action blocking tests during in-flight states in apps/builder/src/pages/**tests**/UploadFlowPage.test.tsx

### Implementation for User Story 3

- [x] T021 [US3] Implement accessible blocking mask with async status messaging in apps/builder/src/components/upload-flow/UploadLoadingMask.tsx
- [x] T022 [US3] Bind mask lifecycle to validating/discovering/uploading states in apps/builder/src/App.tsx
- [x] T023 [US3] Disable duplicate submit/stage actions while masked in apps/builder/src/App.tsx

**Checkpoint**: Async loading protection UX is independently functional and testable.

---

## Phase 6: User Story 4 - Receive Inline and Toast Feedback (Priority: P1)

**Goal**: Provide deterministic inline guidance + toast feedback for validation, success, and failure outcomes.

**Independent Test**: Validation failures show inline guidance, successful operations show success toasts, and failures show error toasts plus recovery hints.

### Tests for User Story 4

- [x] T024 [P] [US4] Add inline validation guidance tests in apps/builder/src/components/**tests**/UploadValidationNotice.test.tsx
- [x] T025 [P] [US4] Add success/error/info toast behavior tests in apps/builder/src/components/**tests**/UploadToastStack.test.tsx
- [x] T026 [P] [US4] Add end-to-end feedback wiring tests for upload outcomes in apps/builder/src/pages/**tests**/UploadFlowFeedback.test.tsx

### Implementation for User Story 4

- [x] T027 [US4] Implement toast stack rendering + timed dismissal behavior in apps/builder/src/components/upload-flow/UploadToastStack.tsx
- [x] T028 [US4] Centralize inline and toast feedback dispatch in upload handlers in apps/builder/src/App.tsx
- [x] T029 [US4] Add stage-specific recovery copy for operation failures in apps/builder/src/components/errors/ActionableErrorPanel.tsx

**Checkpoint**: Inline + toast feedback UX is independently functional and testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Responsive behavior hardening plus minimal spec/round evidence updates.

- [x] T030 [P] Add responsive sidebar/form layout behavior for desktop+mobile in apps/builder/src/App.tsx
- [x] T031 [P] Add responsive and keyboard navigation styles/focus states in apps/builder/src/index.css
- [x] T032 [P] Add focused mobile/desktop viewport regression tests in apps/builder/src/pages/**tests**/UploadFlowResponsive.test.tsx
- [x] T033 Update UX validation quickstart with gate-based manual checks in specs/016-builder-upload-ux/quickstart.md
- [x] T034 Update feature requirement checklist statuses and traceability notes in specs/016-builder-upload-ux/checklists/requirements.md
- [x] T035 Update round evidence summary for this feature in .agents/plan/cycles/Round_33.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1; blocks all user stories
- **Phase 3 (US1 Sidebar)**: depends on Phase 2
- **Phase 4 (US2 Multi-step Form)**: depends on Phase 2 and reuses US1 sidebar flow controls
- **Phase 5 (US3 Loading Mask)**: depends on Phase 2; can proceed after US2 step orchestration is in place
- **Phase 6 (US4 Inline + Toast Feedback)**: depends on Phase 2; best after US2/US3 interaction states exist
- **Phase 7 (Polish)**: depends on completed user stories

### User Story Dependencies

- **US1 (Sidebar Navigation)**: first MVP slice after foundation
- **US2 (Multi-step Form)**: depends on foundational stage model and benefits from US1 shell integration
- **US3 (Loading Mask)**: depends on async state wiring introduced in US2
- **US4 (Inline + Toast Feedback)**: depends on user interaction and async outcome pathways from US2/US3

### Deliverable Mapping

- **Sidebar navigation**: T009-T013
- **Multi-step form flow**: T014-T018
- **Loading mask**: T019-T023
- **Inline + toast feedback**: T024-T029
- **Responsive behavior**: T030-T032
- **Focused tests**: T009, T010, T014, T015, T019, T020, T024, T025, T026, T032

### Parallel Opportunities

- Setup parallel: T002, T003
- Foundational parallel: T005, T006, T007
- US1 tests parallel: T009, T010
- US2 tests parallel: T014, T015
- US3 tests parallel: T019, T020
- US4 tests parallel: T024, T025, T026
- Polish parallel: T030, T031, T032

---

## Parallel Example: User Story 2

```bash
Task: "T014 [US2] Add multi-step progression and required-input enforcement tests in apps/builder/src/pages/__tests__/UploadFlowPage.test.tsx"
Task: "T015 [US2] Add upstream-change dependency reset tests in apps/builder/src/state/__tests__/uploadFlowStore.test.ts"

Task: "T016 [US2] Implement step content panels and next/back controls in apps/builder/src/App.tsx"
Task: "T017 [US2] Enforce per-step validation and dependent field reset logic in apps/builder/src/state/uploadFlowStore.ts"
```

---

## Implementation Strategy

### MVP First

1. Finish Phase 1 and Phase 2
2. Deliver Phase 3 (US1 Sidebar) as first user-visible increment
3. Deliver Phase 4 (US2 Multi-step Form) for complete guided flow
4. Validate Gate A and Gate B before proceeding

### Incremental Delivery

1. Add US3 loading-mask protections
2. Add US4 inline+toast reliability
3. Finish responsive hardening and minimal evidence/doc updates in Phase 7
4. Re-run focused test suite and gate checklist before merge

### Scope Discipline

- Limit implementation files to `apps/builder/src/**` and focused frontend tests
- Keep backend semantics untouched; only verify upload payload preservation through frontend wiring
- Keep documentation changes minimal and feature-scoped (`specs/016-builder-upload-ux/**` + single round evidence file)
