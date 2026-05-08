# Round 04: SQL Translator & Query Execution

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 4.1–4.10

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

_Progress log — update as work proceeds._

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

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
