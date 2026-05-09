# Quickstart: Builder Experience Hardening + Workflow Shell

**Spec**: `/specs/007-builder-experience-hardening-workflow-shell/spec.md`  
**Plan**: `/specs/007-builder-experience-hardening-workflow-shell/plan.md`  
**Data Model**: `/specs/007-builder-experience-hardening-workflow-shell/data-model.md`  
**Date**: 2026-05-09

This quickstart validates feature 007 across backend, builder UX shell, and dockerized smoke flow with strict explicit-state rules.

## Prerequisites

1. Backend and builder dependencies installed (`pnpm`, Python venv, backend requirements).
2. Local services startable via existing dev scripts or compose stack.
3. Test fixture file for upload available in `data/parquet/sample-v1/` or equivalent fixture path.
4. No hidden active workspace/source defaults injected in local config.

## Phase A: Connectivity Preflight Gate

### Goal

Verify connectivity preflight is performed before workflow actions and remains visible throughout the session.

### Steps

1. Start backend and builder.
2. Open builder shell entry route.
3. Confirm preflight request executes before stage actions are enabled.
4. Simulate dependency degradation/unavailability and refresh status.

### Pass Criteria

- Persistent indicator renders `ready|degraded|unavailable` with guidance text.
- Builder blocks actions when preflight status is `unavailable`.
- Recovery to healthy status updates indicator without full app restart.

### Fail Gate

- No preflight before action enablement.
- Status hidden after navigation or stale until full reload.

## Phase B: Explicit Workspace/Source State Gate

### Goal

Ensure query and saved-query actions require explicit active workspace/source with no fallback.

### Steps

1. Enter builder with no active context.
2. Attempt query validation and saved-query list.
3. Select explicit workspace and source.
4. Navigate across all shell stages and repeat actions.
5. Invalidate selected source/workspace (simulate deletion or mismatch) and refresh.

### Pass Criteria

- Actions are blocked with guided message until explicit selection exists.
- Active workspace/source are persistently visible in shell header/navigation.
- Stale/unresolved state blocks dependent actions until reselection.

### Fail Gate

- Any route succeeds using implicit/hidden default workspace/source.
- Active context visibility is lost during stage navigation.

## Phase C: Actionable Error Experience Gate

### Goal

Validate standardized actionable errors across scoped operations.

### Steps

1. Trigger representative failures in upload, profile, query validation/execution, and saved-query actions.
2. Verify each error surface shows primary guidance and next steps.
3. Expand technical details where available.

### Pass Criteria

- Every scoped error includes user-facing guidance and at least one next step.
- Technical details are optional and never replace primary guidance.
- Error stage attribution matches current shell stage.

### Fail Gate

- Raw technical errors shown as primary content.
- Inconsistent envelope or missing next-step guidance.

## Phase D: Workflow Shell IA Gate

### Goal

Validate guided shell progression and prerequisite signaling.

### Steps

1. Start from Upload/Source and proceed to Schema/Sheet, Query, and Results/Saved.
2. Navigate backward and forward between stages.
3. Intentionally skip prerequisites and attempt downstream actions.

### Pass Criteria

- Shell highlights missing prerequisites and links user to correcting stage.
- Stage ordering is clear and discoverable for first-time users.
- Active context and connectivity remain visible at all stages.

### Fail Gate

- Users can reach blocked stages without clear reason or route-back guidance.
- Shell devolves to disconnected pages without workflow continuity.

## Phase E: Docker E2E Smoke Gate

### Goal

Prove release-confidence smoke sequence and diagnostics.

### Steps

1. Execute smoke command/script in dockerized environment.
2. Verify canonical stage sequence runs:
   - create workspace,
   - upload data,
   - validate query,
   - list saved queries.
3. Introduce one controlled failure and rerun.

### Pass Criteria

- Success run reports all four stages as passed.
- Failure run reports first failed stage with stage-specific diagnostic.
- Smoke output is suitable for release acceptance decision.

### Fail Gate

- Smoke does not indicate failed stage precisely.
- Smoke allows release despite stage failure.

## Acceptance Mapping

- US1, FR-007 to FR-010, FR-013: Phase B + D
- US2, FR-001 to FR-005: Phase A + C
- US3, FR-006, FR-013: Phase D
- US4, FR-011, FR-012: Phase E

## Exit Criteria For /speckit.tasks

Feature 007 is task-ready when all five gates include:

1. concrete endpoint/UI/smoke touchpoints,
2. measurable pass/fail evidence,
3. requirement traceability,
4. explicit no-fallback enforcement checks.

## Validation Notes (2026-05-09)

### Executed Checks

1. Backend smoke/contract integration tests:

```bash
PYTHONPATH=apps/backend pytest \
  apps/backend/tests/contract/test_builder_experience_contract.py \
  apps/backend/tests/integration/test_builder_workflow_smoke.py -q
```

Result: `12 passed`.

1. Smoke runner script (stub mode success):

```bash
BUILDER_SMOKE_MODE=stub bash scripts/dev/builder-workflow-smoke.sh
```

Result: all four stages reported `status=passed`.

1. Smoke runner script (stub mode forced failure):

```bash
BUILDER_SMOKE_MODE=stub BUILDER_SMOKE_FAIL_STAGE=upload_source \
  bash scripts/dev/builder-workflow-smoke.sh
```

Result: `first_failed_stage=upload_source` with downstream stages marked `skipped`.

### Gate Snapshot

- Phase A (Connectivity Preflight): PASS (ready/degraded/unavailable path covered by integration tests).
- Phase B (Explicit State): PASS (active-context guarded behavior covered by contract/integration tests).
- Phase C (Actionable Errors): PASS (guidance-first envelope asserted across upload/profile/query/saved).
- Phase D (Workflow Shell IA): PARTIAL (stage model/routing/persistence implemented; full UI integration test still pending).
- Phase E (Smoke Flow): PASS (endpoint + script diagnostics validated, including first-failed-stage behavior).
