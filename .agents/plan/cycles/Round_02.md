# Round 02: Data Upload & Schema Detection

**Status**: Review
**Date started**: 2026-05-08
**Date completed**:
**MVP**: 1
**DoD tasks**: 2.1–2.8

## Goal

Users can upload Excel/CSV files through the API. Polars reads, cleans,
and stores them as versioned Parquet. Schema metadata lands in SQLite.
Re-uploads detect schema changes.

## Plan

- [x] Create upload service: read Excel/CSV, detect schema, write Parquet (zstd)
- [x] Create metadata_db.py: SQLite init with `files` and `file_schemas` tables
- [x] Create `POST /api/v1/tables/upload` endpoint
- [x] Create `GET /api/v1/tables` endpoint
- [x] Implement schema versioning: re-upload same filename -> v2, diff schemas
- [ ] Add schema_changes table and endpoint-level diff history
- [ ] Test with 100k-row file for performance

## Do

- Added backend config and metadata storage modules.
- Added upload processing service using Polars for CSV/XLSX parsing.
- Persisted uploads as versioned Parquet under data/parquet/{table_id}/v{version}.parquet.
- Implemented schema metadata persistence in SQLite.
- Implemented `GET /api/v1/tables` latest-version summary endpoint.
- Verified re-upload increments version and detects schema changes.
- Initial DoD 2.x implementation commit: 7aedb10 (baseline branch).
- Current feature branch extends this scope with workspace-scoped upload/profile/roles:
  9aef8a3, cdb7a41, c35c30f, 4e639c9, 9997557, b1ed1b0.

## Check

- [x] Upload .csv via curl -> Parquet created
- [x] SQLite has file + schema records
- [x] Re-upload detects added/removed columns
- [x] `GET /api/v1/tables` returns correct list
- [ ] 100k rows uploads in < 30 seconds
- [ ] User uploads their real Sales.xlsx

## Act

## **Learnings**

- One-record-per-upload version in `files` plus latest-only list endpoint keeps
  history while presenting a simple current state.
- Multi-sheet Excel handling remains to be implemented for full MVP 1 story coverage.

**Current state snapshot (2026-05-08)**:

- Spec Kit phases for Setup + Foundational + US1 + US2 + US3 are implemented.
- Task checklist confirms T001-T031 and T033-T035 complete.
- T032 and US4/polish tasks remain open.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
