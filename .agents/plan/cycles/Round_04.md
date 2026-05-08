# Round 04: SQL Translator & Query Execution

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 4.1–4.10
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete)

## Goal

A query config JSON (base table, columns, filters, group by,
aggregations) gets translated into DuckDB SQL, executed, and returned as
preview or downloadable Excel/CSV.

## Plan

- [ ] Create `sql_translator.py`: JSON config → SQL string with JOINs from relationship graph
- [ ] Support filters: `=`, `>`, `<`, `>=`, `<=`, `contains`
- [ ] Support GROUP BY + aggregations (SUM, AVG, COUNT, MIN, MAX)
- [ ] Create `duckdb_executor.py`: execute SQL, return pandas DataFrame
- [ ] Create `POST /api/v1/queries/build` — preview (LIMIT 100) + SQL string
- [ ] Create `POST /api/v1/queries/execute` — full result, save as Parquet
- [ ] Create `GET /api/v1/queries/download/{id}` — Excel export
- [ ] Add CSV download variant
- [ ] Use networkx for join path finding when tables are not directly related
- [ ] Performance test: 100k rows, 1 join, < 5 seconds

## Do

**Context**: Awaiting completion of US4 (Manifest export/import, T036-T043) and builder UI scaffolding (Round 05). SQL translator depends on relationship graph finalization. Will start after Round 03 relationships CRUD and Round 05 builder upload workflow complete.

**Status**: Not yet started. Planned to begin after US3 role assignment (done) and US4 manifest export (in progress).

## Check

- [ ] Translator produces valid DuckDB SQL for 1-join and 2-join cases
- [ ] Filters, GROUP BY, aggregations all appear in generated SQL
- [ ] Preview returns ≤ 100 rows
- [ ] Execute returns full result
- [ ] Excel and CSV downloads open correctly
- [ ] 100k-row query with 1 join < 5 seconds
- [ ] User runs "sales by agent this month" and downloads Excel

## Act

## **Learnings**

**Dependencies**: Blocked on Round 03 (relationship CRUD). Relationship graph must be finalized before JOIN path finding is implemented.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
