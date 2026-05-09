# Spec 003 — Query Builder & Execution

**Status**: ✅ Complete | **Source of truth**: [specs/003-query-builder-execution/](../../specs/003-query-builder-execution/)

## What it does

Compose multi-table queries visually, preview safely, execute fully, and export with full lineage.

## User stories

| ID  | Story                | Highlights                                                                                                             |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| US1 | Build query visually | Base table, columns, filters (`=, !=, <, >, IN, LIKE, IS [NOT] NULL`), aggregations, GROUP BY consistency, SQL preview |
| US2 | Add joins            | Approved-only relationship rules, INNER/LEFT/RIGHT/FULL, acyclic graph validation                                      |
| US3 | Preview results      | LIMIT 100, 5s timeout, lineage metadata captured                                                                       |
| US4 | Execute full query   | State tracking (QUEUED/RUNNING/COMPLETED/TIMEOUT/FAILED), memory pre-checks                                            |
| US5 | Export results       | Excel (Results + Lineage sheets) and CSV (lineage header), null handling                                               |
| US7 | Saved queries        | (extended in Spec 004)                                                                                                 |

## Backend services

- `QueryConfigValidator` — filter, aggregation, GROUP BY consistency
- `SqlTranslator` — parameterized SQL with operator whitelist
- `JoinGraphValidator` — approved-only and acyclic enforcement
- `QueryExecutionService` — timeout + memory checks, result handling
- `QueryExportService` — Excel/CSV export with lineage

## Endpoints

- `POST /api/v1/workspaces/{id}/queries/validate`
- `POST /api/v1/workspaces/{id}/queries/preview`
- `POST /api/v1/workspaces/{id}/queries/execute`
- `POST /api/v1/workspaces/{id}/queries/export`

## Where to look

- Spec: [spec.md](../../specs/003-query-builder-execution/spec.md)
- Contracts: [contracts/](../../specs/003-query-builder-execution/contracts/)
- Manual test guide: [quickstart.md](../../specs/003-query-builder-execution/quickstart.md)
