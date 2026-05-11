# Feature Specification: Builder Upload Flow Completion

**Feature Branch**: `[015-builder-upload-flow]`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "Complete the user-visible upload flow on top of existing backend source registry dispatch. Scope: builder upload UX for source-type selection, Excel sheet picker when needed, upload progress feedback, and successful workspace transition, integrated with current backend upload endpoint behavior. Constraints: complete one feature in this round, no unrelated refactors, preserve existing upload semantics and backend dispatch introduced in Round 31."

## Single Goal Narrative

Deliver one complete, user-visible upload journey in the builder so a user can select a source type, provide any required file details (including sheet selection for Excel), see clear upload progress, and land in the workspace ready to continue work, while preserving current backend upload behavior and dispatch semantics.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select source type and start upload confidently (Priority: P1)

A builder user starts an upload and can clearly choose the intended source type before submitting, with the interface enforcing valid combinations of source type and selected file.

**Why this priority**: If users cannot reliably choose a source type and submit correctly, the upload flow fails at the first step and no downstream value is delivered.

**Independent Test**: Can be fully tested by opening the upload screen, selecting each supported source type, selecting a valid file, and confirming the upload can be submitted with clear validation on invalid combinations.

**Acceptance Scenarios**:

1. **Given** the user is on the upload screen, **When** they choose a supported source type and a valid file, **Then** the upload action becomes available.
2. **Given** the user has chosen a source type that does not match the selected file, **When** they attempt to continue, **Then** the interface blocks submission and shows a clear correction message.
3. **Given** the user changes source type before submission, **When** they continue, **Then** the interface reflects the new type rules without stale values.

---

### User Story 2 - Choose Excel sheet when required (Priority: P1)

A builder user uploading an Excel file is prompted to choose the sheet when multiple sheets are available and can proceed with the selected sheet.

**Why this priority**: Multi-sheet Excel uploads are a common real workflow and must be resolved in-product to avoid failed uploads and ambiguity.

**Independent Test**: Can be fully tested by uploading a multi-sheet Excel file, selecting a sheet, submitting, and verifying the upload uses that sheet; single-sheet files should not require extra decisions.

**Acceptance Scenarios**:

1. **Given** a multi-sheet Excel file is selected, **When** the system reads available sheets, **Then** the user is prompted to choose one before upload submission.
2. **Given** a single-sheet Excel file is selected, **When** upload options are shown, **Then** no unnecessary sheet picker step is shown.
3. **Given** sheet metadata cannot be retrieved, **When** the user attempts to proceed, **Then** the flow fails gracefully with a clear retry or reselect path.

---

### User Story 3 - Track progress and reach workspace on success (Priority: P1)

A builder user sees upload progress and status updates, then is transitioned into the target workspace when upload succeeds.

**Why this priority**: Visible progress and a reliable success transition turn upload from a technical operation into a complete user journey.

**Independent Test**: Can be fully tested by submitting an upload and verifying progress states are shown through completion and that successful completion routes the user into the intended workspace context.

**Acceptance Scenarios**:

1. **Given** an upload is in progress, **When** status updates are available, **Then** the interface presents meaningful progress feedback until completion or failure.
2. **Given** an upload completes successfully, **When** completion is confirmed, **Then** the user is transitioned to the workspace tied to that upload.
3. **Given** an upload fails, **When** the failure is returned, **Then** the user remains in upload context with a clear error and a retry path.

### Edge Cases

- User selects an Excel file with hidden or duplicate-like sheet names; sheet choices must remain unambiguous to the user.
- User changes source type after previously selecting a sheet; incompatible prior selections must be cleared.
- Upload progress updates stall temporarily; UI must avoid showing false success or indefinite silent waiting.
- User navigates back/refreshes during upload; resumed state must not incorrectly mark upload as completed.
- Backend accepts the upload but workspace transition metadata is missing; user must receive a controlled failure path rather than a broken navigation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The builder upload flow MUST provide a required source-type selection step before final upload submission.
- **FR-002**: The upload flow MUST enforce compatibility between chosen source type and selected file before allowing submission.
- **FR-003**: The upload flow MUST preserve current backend upload request semantics and source-dispatch behavior from Round 31.
- **FR-004**: For Excel uploads with multiple sheets, the flow MUST require explicit sheet selection before upload submission.
- **FR-005**: For Excel uploads with a single usable sheet, the flow MUST allow submission without unnecessary sheet-selection interaction.
- **FR-006**: If Excel sheet discovery fails, the flow MUST provide a user-facing recovery path without ambiguous state.
- **FR-007**: During upload execution, the UI MUST display status feedback that clearly communicates in-progress, success, and failure states.
- **FR-008**: On successful upload completion, the flow MUST transition the user to the related workspace context.
- **FR-009**: On upload failure, the flow MUST keep the user in the upload context and provide clear retry guidance.
- **FR-010**: Source-type selection, sheet selection, and progress states MUST remain consistent if a user revises choices before submission.
- **FR-011**: The feature MUST be delivered as a single focused round outcome and MUST NOT introduce unrelated UI or backend refactors.
- **FR-012**: Existing non-Excel upload behavior supported in Round 31 MUST remain unchanged in user-visible outcome.

### Non-Functional Requirements

- **NFR-001**: The upload interaction flow MUST be understandable to a first-time user without external documentation.
- **NFR-002**: Progress and state changes MUST be presented quickly enough that users can track upload status in real time during normal operation.
- **NFR-003**: Error messages in this flow MUST be clear, actionable, and consistent with existing builder language.
- **NFR-004**: The round implementation MUST remain scoped to the builder upload UX and required integration touchpoints only.

### Out of Scope

- Adding new backend source types or changing source registry dispatch logic.
- Introducing new upload endpoint contracts or altering persisted upload data semantics.
- Redesigning broader builder navigation outside the successful upload transition.
- Bulk-upload orchestration, background queue redesign, or parallel upload management.
- New analytics instrumentation unrelated to validating this feature's acceptance criteria.

### Acceptance Gates

- **Gate A - Round Focus**: All delivered changes are required to complete the single upload-flow goal; unrelated refactors are excluded.
- **Gate B - Semantics Preservation**: Existing backend dispatch and upload semantics from Round 31 are unchanged.
- **Gate C - Excel Decision Completion**: Multi-sheet uploads require sheet choice; single-sheet uploads do not force extra steps.
- **Gate D - Progress Visibility**: Upload lifecycle states are visible to users from start through completion/failure.
- **Gate E - Success Transition**: Successful uploads reliably transition users into the corresponding workspace.
- **Gate F - Failure Recovery**: Failed uploads keep users in upload context with a clear and testable retry route.

### Key Entities _(include if feature involves data)_

- **Upload Session**: A single user-initiated upload attempt with current state, selected source type, and outcome.
- **Source Type Selection**: The user choice that determines applicable upload rules and validation behavior.
- **Excel Sheet Option**: A selectable worksheet candidate for Excel uploads when more than one sheet is available.
- **Upload Progress State**: User-visible lifecycle state that communicates whether the upload is pending, running, successful, or failed.
- **Workspace Transition Target**: The destination workspace context associated with a successfully completed upload.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 95% of valid upload attempts in acceptance testing complete without users needing to restart the flow.
- **SC-002**: 100% of tested multi-sheet Excel uploads require explicit sheet selection before submission.
- **SC-003**: 100% of tested single-sheet Excel uploads proceed without unnecessary sheet-selection prompts.
- **SC-004**: 100% of successful upload test runs land the user in the correct workspace context.
- **SC-005**: 100% of failed upload test runs keep the user in upload context and present an actionable retry path.
- **SC-006**: In stakeholder validation, users can correctly identify current upload state (in progress/success/failure) in at least 9 out of 10 observed attempts.

## Assumptions

- Round 31 backend source registry dispatch and upload endpoint behavior are stable and available for reuse.
- Supported source types for this round are already recognized by the existing backend upload behavior.
- Builder users have permissions to upload and enter the target workspace on successful completion.
- Upload processing may have variable duration, so status communication must tolerate short-lived delays.
- This round prioritizes completion of one end-to-end upload flow over broader UI modernization.
