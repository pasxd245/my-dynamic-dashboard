# Feature Specification: Builder Experience Hardening + Workflow Shell

**Feature Branch**: `[007-builder-experience-hardening-workflow-shell]`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Create a new spec for Round 21 from PDCA artifacts... Builder Experience Hardening + Workflow Shell"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trustworthy Workspace State Before Actions (Priority: P1)

As an analyst, I need to see and confirm the active workspace and active source before running profile, query validation, or saved-query actions so that I do not work against stale or hidden defaults.

**Why this priority**: Round 20 failures showed that hidden/default workspace references can make valid actions produce invalid outcomes and cascade into broken downstream flows.

**Independent Test**: Can be fully tested by creating/selecting a workspace and source, then navigating through profile/query/saved-query actions and verifying all actions use the same visible active state without fallback to hidden defaults.

**Acceptance Scenarios**:

1. **Given** a user opens the builder with no explicit active workspace selected, **When** the user attempts query or saved-query actions, **Then** the system blocks the action and prompts for explicit workspace/source selection.
2. **Given** a workspace and source are explicitly selected, **When** the user navigates across workflow areas, **Then** the same active state remains visible and is used consistently by all actions.
3. **Given** the previously active workspace or source is no longer available, **When** the user returns to the builder, **Then** the system shows the state as unresolved and requires a new explicit selection before action.

---

### User Story 2 - Actionable Connectivity and Error Guidance (Priority: P1)

As an analyst, I need continuous connection status and actionable error guidance so I can quickly recover from environment or request issues without guesswork.

**Why this priority**: Round 20 showed users discovered connectivity and routing issues late in workflow actions and received low-context errors.

**Independent Test**: Can be fully tested by simulating unavailable and degraded service states, then verifying preflight status, persistent connection indicators, and guidance-oriented error messaging at each action point.

**Acceptance Scenarios**:

1. **Given** the system cannot reach required services during preflight, **When** the user enters the builder workflow, **Then** the user sees a persistent not-ready status with clear recovery guidance.
2. **Given** an operation fails during upload, profiling, validation, or saved-query actions, **When** the error is shown, **Then** the user receives a clear next step and may optionally view technical detail.
3. **Given** connectivity recovers after a transient outage, **When** status is refreshed, **Then** the persistent indicator updates to healthy without requiring a full restart.

---

### User Story 3 - Workflow-Oriented Builder Shell (Priority: P2)

As an analyst, I need the builder organized around the real workflow (upload/source, schema/sheet, query, results/saved views) so I can progress step by step with confidence.

**Why this priority**: Round 20 feedback identified the current experience as operationally "debug-like" and high-friction for end-to-end tasks.

**Independent Test**: Can be fully tested by completing a start-to-finish workflow in the shell and confirming each stage provides the context needed for the next stage.

**Acceptance Scenarios**:

1. **Given** a first-time user enters the builder, **When** they follow the shell sequence, **Then** they can discover the next required action without relying on hidden system assumptions.
2. **Given** a user reaches query or saved views, **When** required upstream context is missing, **Then** the shell highlights the missing prerequisite and links the user back to the relevant stage.

---

### User Story 4 - MVP Smoke Flow for Release Confidence (Priority: P2)

As a release owner, I need a lightweight smoke flow that verifies the core user journey so regressions are detected before manual UX reviews.

**Why this priority**: Round 20 findings included integration-surface regressions that were only discovered manually and late.

**Independent Test**: Can be fully tested by running the smoke flow and confirming that the full sequence completes: create workspace -> upload -> validate query -> list saved queries.

**Acceptance Scenarios**:

1. **Given** a candidate build is prepared, **When** the smoke flow runs, **Then** the flow must complete all four stages successfully or fail with stage-specific diagnostics.
2. **Given** any smoke stage fails, **When** results are reported, **Then** the report identifies the failed stage and blocks release acceptance for this feature scope.

### Edge Cases

- What happens when connection preflight is partially healthy (for example, metadata available but query execution unavailable)?
- How does the system handle a user changing active workspace/source mid-workflow while unsaved query inputs exist?
- What happens when a saved query references a source that is no longer active or no longer available?
- How does the shell behave when upload succeeds but schema/sheet inspection returns no usable columns?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST perform a connectivity preflight before workflow actions and present a persistent connection status visible throughout the builder session.
- **FR-002**: System MUST represent connection status with at least ready, degraded, and unavailable states, each with user-understandable meaning.
- **FR-003**: System MUST provide user-facing error messages that include actionable guidance as the primary content.
- **FR-004**: System MUST allow users to optionally view technical error details without replacing the primary actionable guidance.
- **FR-005**: System MUST standardize error presentation across upload, profile, query validation, query execution, and saved-query interactions.
- **FR-006**: System MUST provide a workflow-oriented shell that organizes the builder into: upload/source, schema/sheet, query, and results/saved views.
- **FR-007**: System MUST show active workspace and active source context persistently in the workflow shell.
- **FR-008**: System MUST require explicit active workspace and source selection before allowing query validation or saved-query actions.
- **FR-009**: System MUST prevent hidden or implicit default workspace fallbacks for query and saved-query routes.
- **FR-010**: System MUST detect unresolved or stale active workspace/source state and block dependent actions until the state is corrected.
- **FR-011**: System MUST include a lightweight end-to-end smoke flow that validates: create workspace, upload data, validate query, and list saved queries.
- **FR-012**: System MUST report smoke flow outcomes by stage so failures are immediately attributable and actionable.
- **FR-013**: Users MUST be able to navigate backward and forward in the workflow shell without losing visibility of current active workspace/source state.

### Key Entities _(include if feature involves data)_

- **Connection Status**: The current readiness state of required services for builder actions, including overall status, last refresh time, and user-facing guidance.
- **Active Workspace Context**: The explicitly selected workspace in scope for profile/query/saved-query actions.
- **Active Source Context**: The explicitly selected data source within the active workspace used by schema and query actions.
- **Workflow Stage**: A user-facing step in the shell (upload/source, schema/sheet, query, results/saved) with prerequisites and completion indicators.
- **Actionable Error**: A structured error outcome containing user guidance, optional technical detail, and associated workflow stage.
- **Smoke Flow Result**: Stage-by-stage pass/fail outcomes for the release-confidence journey.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of query validation and saved-query actions in this feature scope are executed against an explicitly selected workspace and source.
- **SC-002**: In usability checks, at least 90% of participants can identify current connection health and active workspace/source state within 10 seconds.
- **SC-003**: At least 90% of sampled user-facing errors in scoped actions contain a clear next step that allows users to continue without external assistance.
- **SC-004**: The defined smoke flow (create workspace -> upload -> validate query -> list saved queries) passes end-to-end for release candidates or clearly reports the first failed stage.
- **SC-005**: At least 85% of participants can complete the workflow from upload to query validation in one guided pass without getting blocked by missing context.

## Assumptions

- Round 21 is MVP-scoped to builder hardening and shell workflow clarity, not to full multi-source or multi-sheet orchestration.
- Existing upload, profiling, query, and saved-query capabilities remain available and are hardened through clearer state handling and feedback.
- Round 22 will address deeper orchestration capabilities (multi-sheet controls, source registry depth, partial-failure workflows) beyond this scope.
- Release confidence for this feature is based on a lightweight smoke flow rather than exhaustive end-to-end test coverage.
- Layout direction can follow the moodboard intent from `docs/agents/design/Layout_A.png` while prioritizing workflow clarity over visual parity.
