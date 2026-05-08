# Round 15: Data Upload and Schema Detection (Round 02 DoD)

**Status**: Review
**Date started**: 2026-05-08
**Date completed**:
**MVP**: 1
**DoD tasks**: 2.1-2.8

## Goal

Implement backend upload and schema detection so source files can be ingested,
versioned, and listed with metadata for downstream relationship and query work.

## Plan

- [x] Add upload endpoint for CSV/XLSX
- [x] Parse files with Polars and infer schema
- [x] Persist parquet to versioned paths
- [x] Persist schema metadata in SQLite
- [x] Add list endpoint with schema summary
- [x] Verify re-upload creates v2 and flags schema changes
- [ ] Commit the round

## Do

- Added backend modules for data paths and SQLite metadata initialization.
- Implemented `/api/v1/tables/upload` for CSV/XLSX ingestion.
- Implemented parquet persistence to `data/parquet/{table_id}/v{version}.parquet`.
- Implemented metadata persistence in `files` and `file_schemas` tables.
- Implemented `/api/v1/tables` to return latest version per filename with schema.

## Check

- [x] Upload endpoint accepted CSV inputs and parsed schema.
- [x] Re-upload with same filename created version `2`.
- [x] Schema drift was detected (`schema_changed=True`).
- [x] Latest table list returned updated schema summary.
- [ ] 100k-row performance check under 30 seconds (not executed yet).
- [ ] User validation with real Sales.xlsx (pending user step).

## Act

**Learnings**:

- Storing one record per upload version in `files` keeps version tracking simple
  while `GET /api/v1/tables` still exposes a clean latest-state view.
- The current endpoint supports first-sheet Excel parsing; multi-sheet handling
  for MVP 1 Story 1 will need follow-up in the next rounds.
