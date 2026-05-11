# Spec 021: Readiness Validation

## Summary

Validate workspace completeness (sources, roles, relationships) before unlocking query builder stage. Acts as gate between Data Management and Query Building.

**Round type**: UI/UX revision atop existing backend. Testing surfaced UX gaps in the existing readiness gate; this round revises the UI. No new endpoints.

## Business Question

How does the system ensure users have done minimum setup (uploaded data, assigned roles) before allowing them to build queries?

## Requirements

### Functional

- FR-021-001: Fetch workspace readiness status
- FR-021-002: Check minimum requirements (≥1 source, roles assigned)
- FR-021-003: Return readiness=true/false + guidance
- FR-021-004: Block query builder stage until ready
- FR-021-005: Show actionable next steps for incomplete workspaces

### Non-Functional

- NFR-021-001: Readiness check completes in <500ms
- NFR-021-002: UI shows clear pass/fail indicator
- NFR-021-003: Error messages guide user to remediation

### Scope

- **In scope**: Builder UI readiness gate + status display + stage gating — revise to match expected UX (pass/fail clarity, actionable next-step guidance, lock/unlock transitions in workflow shell)
- **Out of scope**: New endpoints, readiness-rule changes, query-builder behavior beyond unlock

### Existing surface (do not recreate)

- Backend `GET /api/v1/workspaces/{id}/readiness` already exists in [apps/backend/app/api/upload.py](../../apps/backend/app/api/upload.py)
- Readiness validation service and workflow-shell stage gating already in place
- Backend changes only if testing surfaces a defect — bug-fix posture, not feature-add

## Acceptance Criteria

- [ ] Readiness endpoint returns ready=true/false + guidance
- [ ] Query builder stage locked until ready=true
- [ ] Readiness failures show clear next steps (e.g., "Assign roles to 3 columns")
- [ ] Manual unlock available for testing (if needed)
- [ ] Error cases (missing workspace, no sources) handled gracefully

## Next

Round 39 execution after Round 38 complete. Completes Data Management phase; transitions to Query Building.
