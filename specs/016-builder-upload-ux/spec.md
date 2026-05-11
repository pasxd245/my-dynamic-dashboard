# Feature Specification: Builder Upload UX Refresh

**Feature Branch**: `[016-builder-upload-ux]`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "Fix poor builder UI/UX for upload flow using moodboard reference docs/design/Layout_A.png, deliver sidebar + guided multi-step upload + loading mask + inline/toast messaging, preserve backend/upload semantics, and keep scope on builder surfaces only."

## Goal Narrative

Improve the builder upload experience so users can confidently move from file selection to a ready workspace through a clear, guided, and responsive flow that matches the intended visual direction, while preserving existing backend upload behavior and API contracts.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Navigate Upload Stages from Sidebar (Priority: P1)

As a builder user, I can use a sidebar menu to understand where I am in the upload journey and move between allowed stages without losing context.

**Why this priority**: Navigation clarity is required before users can reliably complete any upload journey.

**Independent Test**: Can be fully tested by opening the upload flow, using sidebar navigation across available stages, and confirming stage state and context remain accurate.

**Acceptance Scenarios**:

1. **Given** a user starts a new upload journey, **When** the page loads, **Then** a sidebar shows the upload stages in order with the current stage visibly highlighted.
2. **Given** a user has completed a prior stage, **When** they select an allowed stage from the sidebar, **Then** the form context for completed inputs remains available and the selected stage content is shown.
3. **Given** a user attempts to open a stage that depends on incomplete required inputs, **When** they select that stage, **Then** the system keeps them on the required stage and shows clear guidance on what must be completed first.

---

### User Story 2 - Complete a Guided Multi-Step Upload Form (Priority: P1)

As a builder user, I can complete the upload journey through a step-by-step form that presents only the inputs needed at each stage.

**Why this priority**: Guided progression reduces confusion and directly impacts completion rate of the primary upload task.

**Independent Test**: Can be fully tested by completing the full multi-step path from source selection through upload confirmation and verifying required-field enforcement at each step.

**Acceptance Scenarios**:

1. **Given** a user starts the upload flow, **When** they progress through each step, **Then** each step enforces required inputs before allowing progression.
2. **Given** a user changes a previous choice that affects downstream inputs, **When** they return to later steps, **Then** dependent inputs are reset or revalidated and no stale values are submitted.

---

### User Story 3 - See Blocking Loading Mask During Async Operations (Priority: P1)

As a builder user, I can clearly see when the system is processing upload or sheet discovery work so I do not perform conflicting actions.

**Why this priority**: Async visibility prevents accidental duplicate actions and makes system status understandable.

**Independent Test**: Can be fully tested by triggering upload and discovery operations and confirming a loading mask appears, blocks conflicting inputs, and clears when processing completes.

**Acceptance Scenarios**:

1. **Given** a user initiates an async upload-related operation, **When** processing begins, **Then** a visible loading mask appears and blocks conflicting actions.
2. **Given** processing completes successfully or fails, **When** the operation finishes, **Then** the loading mask is removed and the next relevant UI state is shown.

---

### User Story 4 - Receive Inline and Toast Feedback (Priority: P1)

As a builder user, I can receive immediate inline guidance and toast notifications for success and failure events so I know what happened and what to do next.

**Why this priority**: Feedback quality is essential for recovery from errors and confidence in successful uploads.

**Independent Test**: Can be fully tested by exercising success, validation error, and operation failure paths and verifying both inline and toast messaging behavior.

**Acceptance Scenarios**:

1. **Given** a required input is missing or invalid, **When** the user attempts to proceed, **Then** inline validation messaging appears near the relevant input and includes corrective guidance.
2. **Given** an upload operation succeeds, **When** success is confirmed, **Then** a success toast appears with completion context and next-step direction.
3. **Given** an upload or discovery operation fails, **When** failure is detected, **Then** an error toast appears and inline messaging identifies the affected step and recovery action.

### Edge Cases

- User refreshes or revisits the upload route mid-journey and prior staged inputs are partially present.
- User switches source or file type after completing later steps, causing dependent selections to become invalid.
- Multi-sheet discovery returns no selectable sheets or returns an unreadable sheet list.
- Upload operation times out or returns a recoverable failure after the loading mask has appeared.
- User triggers repeated actions quickly (double submit, repeated next-click) during in-flight operations.
- Viewport changes from desktop to mobile mid-flow and stage navigation or required controls become compressed.
- Screen-reader user encounters simultaneous inline and toast messages and needs a deterministic announcement order.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a sidebar menu that displays upload stages, indicates current stage, and reflects completion or blocked state for each stage.
- **FR-002**: The system MUST enforce stage ordering rules so users cannot bypass required inputs needed by downstream steps.
- **FR-003**: The system MUST provide a guided multi-step upload form with clearly scoped inputs per stage.
- **FR-004**: The system MUST validate required inputs at each stage before progression and present inline corrective guidance.
- **FR-005**: The system MUST revalidate or clear downstream dependent inputs when an upstream selection changes.
- **FR-006**: The system MUST display a loading mask during asynchronous upload and discovery operations and prevent conflicting user actions while active.
- **FR-007**: The system MUST remove the loading mask immediately after async operation completion and restore interactive controls appropriate to the resulting state.
- **FR-008**: The system MUST provide success and error toast notifications for upload and discovery outcomes.
- **FR-009**: The system MUST provide inline error messaging at the affected stage when validation or operation failures occur.
- **FR-010**: The system MUST preserve existing backend upload semantics and request/response contract behavior for current supported upload paths.
- **FR-011**: The system MUST keep this feature scope constrained to builder upload flow surfaces and related UX states only.
- **FR-012**: The system MUST follow the visual direction from `docs/design/Layout_A.png` for information hierarchy and stage orientation while remaining functionally consistent with existing upload behavior.

### Non-Functional Requirements

- **NFR-001 (Responsiveness)**: The upload flow experience MUST remain usable across standard desktop and mobile viewport sizes without loss of critical controls or required guidance.
- **NFR-002 (Accessibility)**: Stage navigation, form controls, loading states, and feedback messaging MUST be operable and understandable via keyboard and assistive technologies.
- **NFR-003 (Feedback Clarity)**: User-facing status and error messaging MUST be concise, actionable, and unambiguous.
- **NFR-004 (Scope Control)**: Delivery MUST avoid unrelated refactors outside builder upload flow UX surfaces.

### Acceptance Gates

- **Gate A - Navigation & Progression**: Sidebar stage model is visible, current stage is identifiable, and progression rules prevent skipping required steps.
- **Gate B - Guided Form Completion**: Multi-step form enforces required inputs and correctly handles dependency resets when upstream choices change.
- **Gate C - Async State Protection**: Loading mask appears for upload/discovery operations, blocks conflicting actions, and clears on completion.
- **Gate D - Feedback Reliability**: Inline validation, error messages, and success/error toasts appear for the correct conditions with recovery direction.
- **Gate E - Contract Preservation**: Existing backend upload semantics and API contract behavior remain unchanged for supported flows.
- **Gate F - Scope Discipline**: Changes are limited to builder upload UX surfaces and directly related integration touchpoints.

### Key Entities _(include if feature involves data)_

- **Upload Journey Stage**: A user-visible step in the upload process, with attributes for order, completion state, blocked state, and active state.
- **Upload Session Input Set**: The cumulative user-provided selections and file metadata used to drive validation and progression across stages.
- **Async Operation State**: The processing state for discovery or upload work, including in-progress, success, failure, and associated user-visible messaging.
- **User Feedback Message**: Structured user notification content, either inline or toast, including message type, context stage, and recommended next action.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 90% of users in acceptance testing complete the upload journey without external assistance on first attempt.
- **SC-002**: At least 95% of valid upload attempts in acceptance runs reach completion without user re-submission due to UI confusion.
- **SC-003**: 100% of tested asynchronous upload/discovery operations show a loading mask while in progress and remove it on completion.
- **SC-004**: 100% of tested validation failures present inline corrective guidance at the relevant stage.
- **SC-005**: 100% of tested operation outcomes (success and failure) generate the correct toast type with actionable text.
- **SC-006**: 100% of verified regression scenarios preserve existing backend upload contract behavior for previously supported flows.
- **SC-007**: All defined acceptance gates (A-F) pass in feature validation before implementation is considered complete.

## Out of Scope

- Adding new upload source types, parsing behaviors, or backend workflow semantics.
- Redesigning or rewriting backend API contracts, payload structures, or endpoint responsibilities.
- Refactoring unrelated builder pages, global application shell architecture, or non-upload feature workflows.
- Introducing unrelated visual redesign initiatives outside the targeted upload journey surfaces.

## Assumptions

- The existing upload endpoint behavior and supported upload paths are functionally correct and should be preserved.
- Users require a clear staged flow and feedback model more than additional upload capabilities in this increment.
- The moodboard artifact `docs/design/Layout_A.png` is an approved visual direction reference for this feature.
- Standard product accessibility expectations apply for keyboard use, readable feedback, and assistive technology announcements.
