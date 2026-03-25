# Round 02: Data Upload & Schema Detection

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 2.1–2.8

## Goal

Users can upload Excel/CSV files through the API. Polars reads, cleans,
and stores them as versioned Parquet. Schema metadata lands in SQLite.
Re-uploads detect schema changes.

## Plan

- [ ] Create `polars_processor.py`: read Excel/CSV, detect schema, write Parquet (zstd)
- [ ] Create `metadata_db.py`: SQLite init with `files` and `file_schemas` tables
- [ ] Create `POST /api/v1/tables/upload` endpoint
- [ ] Create `GET /api/v1/tables` and `GET /api/v1/tables/{id}` endpoints
- [ ] Implement schema versioning: re-upload same filename → v2, diff schemas
- [ ] Log schema changes to `schema_changes` table
- [ ] Test with 100k-row file for performance

## Do

_Progress log — update as work proceeds._

## Check

- [ ] Upload .xlsx and .csv via curl → Parquet created
- [ ] SQLite has file + schema records
- [ ] Re-upload detects added/removed columns
- [ ] `GET /api/v1/tables` returns correct list
- [ ] 100k rows uploads in < 30 seconds
- [ ] User uploads their real Sales.xlsx

## Act

**Learnings**:
-

**Promotions**:
- [ ] → context/ :
- [ ] → skills/  :
