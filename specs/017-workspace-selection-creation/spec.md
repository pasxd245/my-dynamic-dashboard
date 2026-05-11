# Spec 017: Workspace Selection / Creation

## Summary

Enable users to select an existing workspace or create a new one before uploading data. This is the entry point to Data Management.

**Round type**: UI/UX revision atop existing backend. Testing surfaced UX gaps in the existing workspace picker flow; this round revises the UI to match user expectations. No new endpoints, no schema changes.

## Business Question

How do users manage multiple projects/data contexts within a single instance?

## Requirements

### Functional

- FR-017-001: User can view list of existing workspaces
- FR-017-002: User can create a new workspace with a name
- FR-017-003: User can select an existing workspace to become active
- FR-017-004: Active workspace_id is persisted and gates downstream upload operations

### Non-Functional

- NFR-017-001: Workspace list loads in <1s
- NFR-017-002: Create workspace succeeds within 500ms
- NFR-017-003: UI responsive on mobile + desktop

### Scope

- **In scope**: Builder UI workspace picker component — revise to match expected UX (clarity of active selection, create-workspace affordance, error feedback)
- **Out of scope**: New endpoints, schema migrations, multi-user/permissions

### Existing surface (do not recreate)

- Backend: `POST /api/v1/workspaces`, `PUT /api/v1/workspaces/active-context` in [apps/backend/app/api/workspaces.py](../../apps/backend/app/api/workspaces.py)
- Schema: `workspaces` table already exists in [apps/backend/app/core/metadata_db.py](../../apps/backend/app/core/metadata_db.py)
- Backend changes only if testing surfaces a defect — bug-fix posture, not feature-add

## Acceptance Criteria

- [ ] Workspace picker shows 5+ existing workspaces without lag
- [ ] User can create workspace with 1-50 character alphanumeric name
- [ ] User can select workspace and see it in header/context
- [ ] Create/select both persist to SQLite and app state
- [ ] Error messages are actionable (name too long, duplicate, etc.)
- [ ] Mobile viewport shows picker without horizontal scroll

## Schema Changes

None. The `workspaces` table already exists. Any schema change in this round is a regression and must be rejected.

## Next

Round 35 execution via `/pdca next`.
