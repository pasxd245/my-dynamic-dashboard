# Spec 020: Column Role Assignment

## Summary

Allow users to assign semantic roles (identity_key, dimension, measure) to columns, enabling relationship definition and query building downstream.

**Round type**: UI/UX revision atop existing backend. Testing surfaced UX gaps in the existing role-assignment surface; this round revises the UI. No new endpoints.

## Business Question

How do users communicate the semantic meaning of their columns (which identify records, which are dimensions, which are measures) so the system can guide relationship and query building?

## Requirements

### Functional

- FR-020-001: Display columns with role selector UI
- FR-020-002: User can assign roles: identity_key, dimension, measure
- FR-020-003: Persist role assignments to SQLite
- FR-020-004: Show validation guidance (at least one identity_key recommended)
- FR-020-005: Support role override with reason text

### Non-Functional

- NFR-020-001: Role assignment persists immediately
- NFR-020-002: UI responsive on all viewports
- NFR-020-003: Validation feedback is clear and actionable

### Scope

- **In scope**: Builder UI role-assignment panel — revise to match expected UX (role selector clarity, validation-guidance visibility, override-reason capture, persistence feedback)
- **Out of scope**: New endpoints, role-storage schema changes, validation-rule additions beyond what already ships

### Existing surface (do not recreate)

- Backend `PUT /api/v1/workspaces/{id}/columns/{id}/roles` already exists in [apps/backend/app/api/upload.py](../../apps/backend/app/api/upload.py)
- Column role storage and validation service already in place
- Backend changes only if testing surfaces a defect — bug-fix posture, not feature-add

## Acceptance Criteria

- [ ] All columns from profile shown with role selector dropdown
- [ ] User can assign identity_key, dimension, measure, or unassigned
- [ ] Role persists on submit
- [ ] Validation warns if no identity_key assigned
- [ ] Role override form accepts reason text
- [ ] Error cases (invalid column, permission denied) handled

## Next

Round 38 execution after Round 37 complete.
