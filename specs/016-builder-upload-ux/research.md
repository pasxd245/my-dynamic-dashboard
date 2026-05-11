# Research: Builder Upload UX Refresh

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Decision 1: Sidebar Uses Guarded Stage Navigation Over Existing Upload State

**Decision**: Implement a sidebar stage model with explicit active/completed/blocked states and guarded navigation that prevents bypassing prerequisite steps.

**Rationale**:

- Directly satisfies FR-001 and FR-002.
- Reduces user confusion by making current position and allowed moves visible.
- Preserves existing backend behavior because the stage model is frontend state only.

**Alternatives considered**:

- Free navigation to all stages regardless of prerequisites.
- Next/Back-only flow with no persistent stage overview.

## Decision 2: Guided Step Layout Keeps Inputs Scoped Per Stage

**Decision**: Use a guided multi-step form that only renders inputs relevant to the current stage and enforces progression checks before step advance.

**Rationale**:

- Satisfies FR-003 and FR-004.
- Improves task focus and makes corrective guidance context-specific.
- Aligns with Layout_A hierarchy without backend contract changes.

**Alternatives considered**:

- Single long form with section anchors.
- Auto-advance without explicit validation gate.

## Decision 3: Upstream Changes Trigger Deterministic Downstream Reset/Revalidation

**Decision**: When upstream choices (source type, selected file, sheet choice) change, reset or revalidate dependent downstream values before submission is allowed.

**Rationale**:

- Satisfies FR-005 and prevents stale submissions.
- Keeps error recovery predictable and auditable in tests.

**Alternatives considered**:

- Keep downstream values and rely only on backend rejection.
- Silent auto-mutation of downstream values.

## Decision 4: Async Upload/Discovery Use Blocking Loading Mask

**Decision**: Show a blocking loading mask for in-flight discovery and upload operations, disable conflicting actions, and clear mask immediately on completion (success or failure).

**Rationale**:

- Satisfies FR-006 and FR-007.
- Prevents double-submit and race-condition user actions.
- Requires no backend API changes.

**Alternatives considered**:

- Non-blocking spinner only.
- Blocking the submit button only while leaving other conflicting controls active.

## Decision 5: Feedback Model Splits Inline Validation and Toast Outcomes

**Decision**: Keep validation and step-specific errors inline, and use toast notifications for operation-level success/failure outcomes.

**Rationale**:

- Satisfies FR-008 and FR-009.
- Provides immediate local correction plus global operation confirmation.
- Supports accessibility announcement ordering (inline first, then toast).

**Alternatives considered**:

- Toast-only feedback.
- Inline-only feedback with no operation-level status signal.

## Decision 6: Backend Semantics Are Regression-Protected, Not Changed

**Decision**: Preserve existing upload endpoint path, payload shape, and response behavior; verify preservation through targeted backend regression checks.

**Rationale**:

- Satisfies FR-010 and out-of-scope constraints.
- Keeps implementation limited to UX refresh on builder surfaces.

**Alternatives considered**:

- Expanding upload payload/response to include new UX-only metadata.
- Introducing new backend endpoints for staged flow support.

## Decision 7: Verification Focuses on Builder UX With Explicit Test Commands

**Decision**: Define builder-first automated verification plus backend regression command checks and manual acceptance scenarios for all UX gates.

**Rationale**:

- Satisfies user request for clear builder test verification commands.
- Keeps scope disciplined to UX behavior evidence and contract preservation.

**Alternatives considered**:

- Manual-only verification.
- Full end-to-end framework setup expansion in this planning increment.
