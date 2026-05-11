# Quickstart: Verify Builder Upload UX Refresh

**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Contract**: [contracts/builder-upload-ux-contract.md](contracts/builder-upload-ux-contract.md)

## Goal

Verify the refreshed builder upload UX: sidebar stage navigation, guided steps, blocking loading mask, and inline plus toast feedback, while preserving existing backend upload semantics.

## Prerequisites

- Repository dependencies installed.
- Backend and builder runnable locally.
- Test files prepared:
  - valid CSV file
  - valid single-sheet Excel file
  - valid multi-sheet Excel file
  - malformed/unreadable file for failure scenario

## 1) Start Services

From repo root:

```bash
pnpm install
pnpm --filter builder dev
```

Start backend in another terminal using project standard backend startup workflow.

## 2) Run Automated Verification

From repo root:

```bash
# Builder tests (required)
pnpm --filter builder test --run

# Optional builder static check for changed surfaces
pnpm --filter builder type-check

# Backend regression checks for upload semantics preservation
cd apps/backend && pytest tests -k "upload or source_registry" -q
```

Focused evidence captured for Round 33 completion:

```bash
cd apps/builder && pnpm -s vitest run \
  src/pages/__tests__/UploadFlowPage.test.tsx \
  src/pages/__tests__/BuilderWorkflowPage.test.tsx \
  src/state/__tests__/uploadFlowStore.test.ts \
  src/components/__tests__/UploadLoadingMask.test.tsx \
  src/components/__tests__/UploadValidationNotice.test.tsx \
  src/components/__tests__/UploadToastStack.test.tsx \
  src/pages/__tests__/UploadFlowFeedback.test.tsx \
  src/pages/__tests__/UploadFlowResponsive.test.tsx \
  src/components/__tests__/UploadProgressPanel.test.tsx

cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend \
  pytest tests/contract/test_upload_flow_contract.py \
    tests/integration/test_upload_flow_with_sources.py \
    tests/integration/test_upload_flow_builder_transition.py -q
```

## 3) Manual Acceptance Checklist

### Scenario A: Sidebar Navigation and Stage Guards

1. Open builder upload flow.
2. Confirm sidebar stage order and active-stage highlight.
3. Attempt to jump to a blocked downstream stage.
4. Confirm navigation is prevented and guidance explains missing prerequisite.

Expected:

- FR-001 and FR-002 pass.
- Sidebar blocked-step guidance is rendered inline and via toast when prerequisites are missing.

### Scenario B: Guided Step Completion and Validation

1. Progress through stages in order.
2. Attempt to continue with required inputs missing.
3. Confirm inline validation appears near affected control.

Expected:

- FR-003 and FR-004 pass.
- Workspace -> source -> sheet -> submit routing stays deterministic as upstream inputs change.

### Scenario C: Upstream Change Revalidation

1. Complete later steps.
2. Change an upstream input (source type or file).
3. Confirm dependent downstream values are reset or revalidated.

Expected:

- FR-005 passes.

### Scenario D: Loading Mask + Async Protection

1. Trigger sheet discovery and upload operations.
2. Confirm loading mask appears and blocks conflicting actions.
3. Confirm mask is removed immediately at completion (success and failure paths).

Expected:

- FR-006 and FR-007 pass.

### Scenario E: Inline + Toast Feedback Reliability

1. Trigger validation errors and async operation success/failure.
2. Confirm validation guidance is inline at affected stage.
3. Confirm outcome notifications appear as success/error toasts.

Expected:

- FR-008 and FR-009 pass.
- Success/error outcomes are visible via toast feedback without losing upload-stage context on failure.

### Scenario F: Backend Semantics and Scope Discipline

1. Confirm existing supported upload paths still behave identically.
2. Verify no endpoint contract changes were introduced.

Expected:

- FR-010 and FR-011 pass.

## 4) Scope Audit

From repo root:

```bash
git diff --name-only
```

Expected:

- Changed files limited to builder upload UX surfaces, focused tests, and this spec bundle.

## 5) Success Criteria Spot-Check

- SC-003: Async operations consistently show/remove mask.
- SC-004: Validation failures consistently show inline corrective guidance.
- SC-005: Operation outcomes consistently emit correct toast type.
- SC-006: Regression checks show backend upload contract behavior preserved.
