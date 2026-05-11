# Quickstart: Verify Builder Upload Flow Completion

**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Contract**: [contracts/builder-upload-flow-contract.md](contracts/builder-upload-flow-contract.md)

## Goal

Validate the complete Round 32 upload journey: source-type selection, sheet decisions for Excel, progress/error feedback, and success transition to workspace context.

## Prerequisites

- Install workspace dependencies.
- Builder and backend apps can run locally.
- Test files available:
  - one valid CSV file
  - one single-sheet Excel file
  - one multi-sheet Excel file
  - one malformed/unreadable upload file

## 1) Start Services

From repo root:

```bash
pnpm install
pnpm --filter builder dev
```

In another shell, start backend service with project standard command.

## 2) Run Automated Verification

From repo root:

```bash
# Builder tests
pnpm --filter builder test --run

# Backend regression checks for upload semantics
cd apps/backend && pytest tests -k "upload or source_registry" -q
```

## 3) Manual Acceptance Checklist

### Scenario A: Source-Type Selection and Compatibility

1. Open builder upload surface.
2. Choose source type and select matching file.
3. Confirm upload action is enabled.
4. Choose mismatched source type/file pair.
5. Confirm submit is blocked with actionable correction message.

Expected:

- FR-001 and FR-002 satisfied.

### Scenario B: Single-Sheet Excel

1. Select Excel source type.
2. Upload single-sheet workbook.
3. Confirm no unnecessary sheet picker appears.
4. Submit upload and observe progress states.

Expected:

- FR-005 and FR-007 satisfied.

### Scenario C: Multi-Sheet Excel

1. Select Excel source type.
2. Upload multi-sheet workbook.
3. Confirm sheet picker is shown and required.
4. Choose sheet and submit.

Expected:

- FR-004 satisfied.

### Scenario D: Upload Success Transition

1. Run a valid upload.
2. Confirm user transitions into expected workspace context after success.

Expected:

- FR-008 and SC-004 satisfied.

### Scenario E: Upload Failure Recovery

1. Trigger parse/upload failure with malformed input.
2. Confirm user remains in upload context.
3. Confirm actionable error + retry path shown.

Expected:

- FR-006, FR-009, and SC-005 satisfied.

## 4) Scope and Semantics Guardrails

Run from repo root:

```bash
git diff --name-only
```

Expected:

- Files changed only within planned Round 32 upload-flow scope.
- No unrelated backend dispatch refactor.

## 5) Stakeholder Observation Check (SC-006)

During 10 observed attempts (mixed success/failure), verify users can correctly identify current upload status in at least 9 attempts.

Record:

- Attempt number
- Displayed status
- User interpretation
- Correct/incorrect
