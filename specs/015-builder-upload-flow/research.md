# Research: Builder Upload Flow Completion

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Decision 1: Source-Type Selection Uses Explicit UI Choice + Existing File Extension Validation

**Decision**: Keep source-type selection explicit in builder UI and validate against selected file extension before enabling submit, while preserving backend-side parse validation as final authority.

**Rationale**:

- Meets FR-001/FR-002 without changing Round 31 backend dispatch semantics (FR-003).
- Prevents avoidable user mistakes early in UI.
- Maintains defense-in-depth: frontend validation plus backend validation.

**Alternatives considered**:

- Infer source type only from file extension with no explicit selector.
- Allow submission and rely only on backend errors.

## Decision 2: Excel Sheet Picker Is Conditional and Blocking Only for Multi-Sheet Workbooks

**Decision**: Show and require sheet selection only when workbook discovery returns multiple usable sheets; bypass picker for single-sheet workbooks.

**Rationale**:

- Satisfies FR-004/FR-005 and Gate C directly.
- Avoids unnecessary interaction for common single-sheet uploads.
- Makes multi-sheet choice explicit and auditable.

**Alternatives considered**:

- Always show picker (adds friction to single-sheet path).
- Auto-pick first sheet for multi-sheet files (ambiguous and error-prone).

## Decision 3: Sheet Discovery Failure Uses Controlled Error State with Retry/Reselect

**Decision**: If sheet metadata cannot be resolved, remain in upload context and show actionable error with retry and file/source reselect options.

**Rationale**:

- Satisfies FR-006 and FR-009.
- Aligns with existing actionable error posture in builder APIs.
- Prevents ambiguous partial state.

**Alternatives considered**:

- Silent fallback to first sheet.
- Hard fail without guidance.

## Decision 4: Progress Feedback Uses Explicit Upload Lifecycle States in UI

**Decision**: Represent upload lifecycle with explicit states: idle, validating, uploading, resolving_sheet, success, failed.

**Rationale**:

- Satisfies FR-007 and SC-006.
- Supports user confidence during variable-duration uploads.
- Allows controlled handling of temporary stalls without false completion.

**Alternatives considered**:

- Spinner-only UI without stage labels.
- Backend polling requirement for percentage progress (out of scope for this round).

## Decision 5: Success Transition Uses Existing Workspace/Workflow Navigation Surfaces

**Decision**: On successful upload, transition user into existing workflow/workspace context surfaces and set active context using existing APIs; on failure, do not navigate.

**Rationale**:

- Satisfies FR-008 and FR-009 while avoiding new navigation architecture.
- Reuses existing builder session and active-context pathways.
- Preserves Round 32 single-feature scope.

**Alternatives considered**:

- Introduce a new success landing route (unnecessary scope expansion).
- Keep user on upload panel after success and require manual navigation.

## Decision 6: Round 32 Scope Guardrail Enforced by Changed-File and Contract Audits

**Decision**: Enforce single-feature objective through explicit allowed-path scope checks and regression checks proving backend semantics are unchanged.

**Rationale**:

- Satisfies FR-011, NFR-004, and Gate A/B.
- Keeps implementation focused and reviewable.

**Alternatives considered**:

- Broad cleanup/refactor while touching upload flow.
- Introducing new source types or endpoint variants in same round.
