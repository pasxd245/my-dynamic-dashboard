# Spec 018: File Upload & Sheet Discovery

## Summary

Accept file uploads (Excel/CSV), detect source type, and optionally discover sheets in Excel workbooks before upload confirmation.

**Round type**: UI/UX revision atop existing backend. Testing surfaced UX gaps in the existing upload + sheet discovery flow; this round revises the UI. No new endpoints.

## Business Question

How do users handle Excel files with multiple sheets and ensure they're uploading the correct data?

## Requirements

### Functional

- FR-018-001: Accept .xlsx, .xlsm, .xlsb, .xls, .csv files
- FR-018-002: Detect source type from file extension
- FR-018-003: For Excel files, discover sheet options before upload
- FR-018-004: User can select a sheet if multiple exist
- FR-018-005: Show loading mask during async operations
- FR-018-006: On success, set active source_id in context

### Non-Functional

- NFR-018-001: Sheet discovery completes in <2s
- NFR-018-002: Upload blocks conflicting actions with loading mask
- NFR-018-003: Responsive on all viewport sizes

### Scope

- **In scope**: Builder UI file picker + sheet selector — revise to match expected UX (clear file-type cues, sheet-selection clarity, loading-mask behavior, post-upload navigation)
- **Out of scope**: New endpoints, parsing/persistence changes, source-registry additions

### Existing surface (do not recreate)

- Backend upload + sheet discovery endpoints already exist in [apps/backend/app/api/upload.py](../../apps/backend/app/api/upload.py)
- Polars + source registry parsing path already wired; Parquet persistence already in place
- Backend changes only if testing surfaces a defect — bug-fix posture, not feature-add

## Acceptance Criteria

- [ ] File picker accepts CSV and Excel formats
- [ ] Excel sheet discovery returns list in <2s
- [ ] Multi-sheet Excel shows sheet selector UI
- [ ] Single-sheet Excel auto-selects sheet
- [ ] CSV upload skips sheet discovery
- [ ] Loading mask blocks UI during upload
- [ ] Success redirects to metadata extraction stage
- [ ] Error messages are actionable (encrypted file, malformed, etc.)

## Next

Round 36 execution after Round 35 complete.
