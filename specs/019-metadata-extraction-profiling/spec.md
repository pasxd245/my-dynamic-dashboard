# Spec 019: Metadata Extraction & Profiling

## Summary

Post-upload, extract column metadata (names, types, nullability), compute data range, and display profiling UI for user review and optional overrides.

**Round type**: UI/UX revision atop existing backend. Testing surfaced UX gaps in the existing profile/override surface; this round revises the UI. No new endpoints.

## Business Question

How do users understand and validate the schema of their uploaded data before building relationships and queries?

## Requirements

### Functional

- FR-019-001: Fetch workspace profile (columns + types + nullability)
- FR-019-002: Display column list with inferred data types
- FR-019-003: Allow override of header row and data range
- FR-019-004: Show data range in Excel notation (A1:Z1000)
- FR-019-005: Persist overrides to SQLite

### Non-Functional

- NFR-019-001: Profile fetch completes in <500ms
- NFR-019-002: Type inference accurate for common formats (int, string, float, date)
- NFR-019-003: Responsive on all viewports

### Scope

- **In scope**: Builder UI profile viewer + override form — revise to match expected UX (column list readability, type-override affordance, header/range override clarity, post-override revalidation feedback)
- **Out of scope**: New endpoints, type-inference algorithm changes, column-table schema migrations

### Existing surface (do not recreate)

- Backend `GET /api/v1/workspaces/{id}/profile` and `PATCH /api/v1/workspaces/{id}/sheets/{id}/override` already exist in [apps/backend/app/api/upload.py](../../apps/backend/app/api/upload.py)
- Polars type inference and column table persistence already wired
- Backend changes only if testing surfaces a defect — bug-fix posture, not feature-add

## Acceptance Criteria

- [ ] Profile UI shows all columns with inferred types
- [ ] Header row override persists and recomputes profiles
- [ ] Data range can be adjusted (A1:Z1000)
- [ ] Nullability indicator shows for each column
- [ ] Type overrides available (string, int, float, date)
- [ ] Error cases handled gracefully

## Next

Round 37 execution after Round 36 complete.
