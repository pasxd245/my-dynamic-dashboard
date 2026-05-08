# Definition of Done (DoD)

> Master checklist across all PDCA rounds. Each task maps to a round and
> requires explicit verification before it can be marked complete.

---

## Verification Levels

| Tag    | Meaning                                        | Who verifies       |
| ------ | ---------------------------------------------- | ------------------ |
| `auto` | Passes automated check (test, lint, build)     | CI / agent         |
| `demo` | Demonstrated working in dev environment        | Agent or developer |
| `user` | Confirmed acceptable by the user / stakeholder | User               |

A task is **done** only when its verification column shows a pass.
Agents may mark `auto` and `demo` items. Only the user may mark `user` items.

---

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done and verified
- `[!]` — Blocked or needs attention

---

## Round 01 — Project Scaffolding

| #   | Task                                                                  | Verify | Status | Round |
| --- | --------------------------------------------------------------------- | ------ | ------ | ----- |
| 1.1 | pnpm monorepo with `apps/backend` and `apps/builder`                  | auto   | [ ]    | 01    |
| 1.2 | FastAPI skeleton returns `{"status":"ok"}` on `/health`               | demo   | [ ]    | 01    |
| 1.3 | React builder renders hello world on `localhost:3000`                 | demo   | [ ]    | 01    |
| 1.4 | Vite proxies `/api` to backend at `localhost:8000`                    | demo   | [ ]    | 01    |
| 1.5 | `docker-compose.yml` starts both services                             | demo   | [ ]    | 01    |
| 1.6 | `.gitignore` covers `data/`, `node_modules/`, `venv/`, `__pycache__/` | auto   | [ ]    | 01    |
| 1.7 | User confirms project boots cleanly                                   | user   | [ ]    | 01    |

---

## Round 02 — Data Upload & Schema Detection

| #   | Task                                                              | Verify | Status | Round |
| --- | ----------------------------------------------------------------- | ------ | ------ | ----- |
| 2.1 | `POST /api/v1/tables/upload` accepts Excel and CSV                | auto   | [ ]    | 02    |
| 2.2 | Polars reads file and detects column names, types, nullability    | auto   | [ ]    | 02    |
| 2.3 | Data saved as versioned Parquet (`data/parquet/{id}/v1.parquet`)  | auto   | [ ]    | 02    |
| 2.4 | Schema metadata stored in SQLite (`files`, `file_schemas` tables) | auto   | [ ]    | 02    |
| 2.5 | `GET /api/v1/tables` returns uploaded files with schema summary   | auto   | [ ]    | 02    |
| 2.6 | Re-upload same filename creates v2, detects schema changes        | auto   | [ ]    | 02    |
| 2.7 | Upload 100k-row file completes in < 30 seconds                    | demo   | [ ]    | 02    |
| 2.8 | User uploads their real Sales.xlsx successfully                   | user   | [ ]    | 02    |

---

## Round 03 — Relationship Management

| #   | Task                                                                     | Verify | Status | Round |
| --- | ------------------------------------------------------------------------ | ------ | ------ | ----- |
| 3.1 | SQLite `relationships` table with from/to file, column, join type        | auto   | [ ]    | 03    |
| 3.2 | `POST /api/v1/relationships` creates a relationship                      | auto   | [ ]    | 03    |
| 3.3 | `GET /api/v1/relationships` lists all active relationships               | auto   | [ ]    | 03    |
| 3.4 | `DELETE /api/v1/relationships/{id}` removes a relationship               | auto   | [ ]    | 03    |
| 3.5 | Validation rejects relationships referencing non-existent tables/columns | auto   | [ ]    | 03    |
| 3.6 | Schema change on re-upload flags broken relationships                    | auto   | [ ]    | 03    |
| 3.7 | User defines Sales → Agents relationship via API/UI                      | user   | [ ]    | 03    |

---

## Round 04 — SQL Translator & Query Execution

| #    | Task                                                           | Verify | Status | Round |
| ---- | -------------------------------------------------------------- | ------ | ------ | ----- |
| 4.1  | SQL translator converts query config JSON → DuckDB SQL string  | auto   | [ ]    | 04    |
| 4.2  | Generated SQL includes correct JOINs from relationship graph   | auto   | [ ]    | 04    |
| 4.3  | Filters translate: `=`, `>`, `<`, `>=`, `<=`, `contains`       | auto   | [ ]    | 04    |
| 4.4  | GROUP BY and aggregations (SUM, AVG, COUNT, MIN, MAX) work     | auto   | [ ]    | 04    |
| 4.5  | `POST /api/v1/queries/build` returns SQL + preview (100 rows)  | auto   | [ ]    | 04    |
| 4.6  | `POST /api/v1/queries/execute` returns full result + row count | auto   | [ ]    | 04    |
| 4.7  | `GET /api/v1/queries/download/{id}` returns Excel file         | auto   | [ ]    | 04    |
| 4.8  | CSV download endpoint works                                    | auto   | [ ]    | 04    |
| 4.9  | Query on 100k rows with 1 join completes in < 5 seconds        | demo   | [ ]    | 04    |
| 4.10 | User runs "sales by agent this month" and exports Excel        | user   | [ ]    | 04    |

---

## Round 05 — Builder UI: Upload & Schema

| #   | Task                                                                                   | Verify | Status | Round |
| --- | -------------------------------------------------------------------------------------- | ------ | ------ | ----- |
| 5.1 | TanStack Router with root layout and 4 routes (upload, schema, relationships, queries) | demo   | [ ]    | 05    |
| 5.2 | File upload component with drag-drop and progress indicator                            | demo   | [ ]    | 05    |
| 5.3 | TanStack Query integration: upload mutation invalidates table list                     | auto   | [ ]    | 05    |
| 5.4 | Tables list using TanStack Table with file name, rows, version                         | demo   | [ ]    | 05    |
| 5.5 | Schema viewer shows columns, types, nullability per table                              | demo   | [ ]    | 05    |
| 5.6 | Error and success toasts on upload                                                     | demo   | [ ]    | 05    |
| 5.7 | User uploads a file through the UI without confusion                                   | user   | [ ]    | 05    |

---

## Round 06 — Builder UI: Visual Relationship Builder

| #   | Task                                                                       | Verify | Status | Round |
| --- | -------------------------------------------------------------------------- | ------ | ------ | ----- |
| 6.1 | React Flow graph renders uploaded tables as nodes with column lists        | demo   | [ ]    | 06    |
| 6.2 | Drag edge between nodes opens connection modal (select columns, join type) | demo   | [ ]    | 06    |
| 6.3 | Saving connection calls backend and edge appears on graph                  | demo   | [ ]    | 06    |
| 6.4 | Existing relationships load as edges on page mount                         | auto   | [ ]    | 06    |
| 6.5 | Delete relationship from sidebar removes edge                              | demo   | [ ]    | 06    |
| 6.6 | Graph layout persists (positions saved)                                    | demo   | [ ]    | 06    |
| 6.7 | User builds Sales → Agents relationship visually                           | user   | [ ]    | 06    |

---

## Round 07 — Builder UI: Query Builder & Export

| #   | Task                                                                | Verify | Status | Round |
| --- | ------------------------------------------------------------------- | ------ | ------ | ----- |
| 7.1 | Base table selector dropdown                                        | demo   | [ ]    | 07    |
| 7.2 | Column multi-select showing columns from base + related tables      | demo   | [ ]    | 07    |
| 7.3 | Filter builder: add/remove filter rows with column, operator, value | demo   | [ ]    | 07    |
| 7.4 | Group-by and aggregation selectors                                  | demo   | [ ]    | 07    |
| 7.5 | SQL preview panel updates as user changes selections                | demo   | [ ]    | 07    |
| 7.6 | Preview button shows first 100 rows in TanStack Table               | demo   | [ ]    | 07    |
| 7.7 | Execute & Download buttons produce Excel and CSV files              | demo   | [ ]    | 07    |
| 7.8 | User builds a real query end-to-end and downloads result            | user   | [ ]    | 07    |

---

## Round 08 — MVP 1 Feedback Gate

| #   | Task                                                             | Verify | Status | Round |
| --- | ---------------------------------------------------------------- | ------ | ------ | ----- |
| 8.1 | Test full flow with real data: upload → relate → query → export  | user   | [ ]    | 08    |
| 8.2 | Measure time: weekly report generation < 5 minutes (was 3 hours) | user   | [ ]    | 08    |
| 8.3 | Demo to 1-2 colleagues, collect feedback                         | user   | [ ]    | 08    |
| 8.4 | Fix top 3 pain points from feedback                              | demo   | [ ]    | 08    |
| 8.5 | User rates MVP 1 usefulness ≥ 7/10                               | user   | [ ]    | 08    |
| 8.6 | Decision: proceed to MVP 2 or iterate more                       | user   | [ ]    | 08    |

---

## Round 09 — Saved Queries & Dashboard Foundation

| #   | Task                                                               | Verify | Status | Round |
| --- | ------------------------------------------------------------------ | ------ | ------ | ----- |
| 9.1 | `query_configs` table in SQLite (name, description, config JSON)   | auto   | [ ]    | 09    |
| 9.2 | CRUD endpoints for `/api/v1/configs`                               | auto   | [ ]    | 09    |
| 9.3 | "Save Query" button in builder stores current config               | demo   | [ ]    | 09    |
| 9.4 | Streamlit app starts and fetches saved queries from backend        | demo   | [ ]    | 09    |
| 9.5 | User selects saved query in dashboard, runs it, sees results table | demo   | [ ]    | 09    |
| 9.6 | Excel/CSV export from dashboard                                    | demo   | [ ]    | 09    |
| 9.7 | User runs their weekly report from the dashboard                   | user   | [ ]    | 09    |

---

## Round 10 — Dashboard Visualisations

| #    | Task                                                              | Verify | Status | Round |
| ---- | ----------------------------------------------------------------- | ------ | ------ | ----- |
| 10.1 | Auto-detect numeric, categorical, date columns in result          | auto   | [ ]    | 10    |
| 10.2 | Bar chart generated for categorical × numeric                     | demo   | [ ]    | 10    |
| 10.3 | Line chart generated for date × numeric                           | demo   | [ ]    | 10    |
| 10.4 | Metrics row (KPIs) at top of dashboard                            | demo   | [ ]    | 10    |
| 10.5 | Chart + table + export layout on single page                      | demo   | [ ]    | 10    |
| 10.6 | User finds the dashboard visually useful for their weekly meeting | user   | [ ]    | 10    |

---

## Round 11 — Polish & Production Hardening

| #    | Task                                                             | Verify | Status | Round |
| ---- | ---------------------------------------------------------------- | ------ | ------ | ----- |
| 11.1 | Comprehensive error messages (backend + frontend)                | demo   | [ ]    | 11    |
| 11.2 | Loading skeletons / spinners on all async operations             | demo   | [ ]    | 11    |
| 11.3 | Help tooltips on relationship builder and query builder          | demo   | [ ]    | 11    |
| 11.4 | Query templates (weekly sales by agent, monthly by product)      | demo   | [ ]    | 11    |
| 11.5 | No console errors in builder; no unhandled exceptions in backend | auto   | [ ]    | 11    |
| 11.6 | User completes full flow without asking for help                 | user   | [ ]    | 11    |

---

## Round 12 — Deployment

| #    | Task                                                                          | Verify | Status | Round |
| ---- | ----------------------------------------------------------------------------- | ------ | ------ | ----- |
| 12.1 | Production Dockerfiles (multi-stage builds) for backend, builder, dashboard   | auto   | [ ]    | 12    |
| 12.2 | `docker-compose.prod.yml` with health checks, restart policy, resource limits | auto   | [ ]    | 12    |
| 12.3 | Environment variables documented in `.env.example`                            | auto   | [ ]    | 12    |
| 12.4 | Data directory persists across container restarts                             | demo   | [ ]    | 12    |
| 12.5 | Backup script for `data/` directory                                           | demo   | [ ]    | 12    |
| 12.6 | All three services accessible via URL from another machine                    | demo   | [ ]    | 12    |
| 12.7 | User accesses dashboard from their browser, runs a report                     | user   | [ ]    | 12    |
| 12.8 | System runs 24 hours without manual intervention                              | user   | [ ]    | 12    |

---

## Round 13 — MVP 2 Launch & Feedback

| #    | Task                                                              | Verify | Status | Round |
| ---- | ----------------------------------------------------------------- | ------ | ------ | ----- |
| 13.1 | README and USER_GUIDE.md complete with screenshots                | demo   | [ ]    | 13    |
| 13.2 | Demo to 3-5 users                                                 | user   | [ ]    | 13    |
| 13.3 | Collect feedback survey (usefulness, confusion, missing features) | user   | [ ]    | 13    |
| 13.4 | Fix critical issues from first week of production                 | demo   | [ ]    | 13    |
| 13.5 | User satisfaction ≥ 7/10 from 3+ users                            | user   | [ ]    | 13    |
| 13.6 | Backlog created for post-MVP features (AI, scheduling, auth)      | user   | [ ]    | 13    |

---

## Summary

| Round | Title                                | MVP | Tasks  | User-verified |
| ----- | ------------------------------------ | --- | ------ | ------------- |
| 01    | Project Scaffolding                  | 1   | 7      | 1             |
| 02    | Data Upload & Schema Detection       | 1   | 8      | 1             |
| 03    | Relationship Management              | 1   | 7      | 1             |
| 04    | SQL Translator & Query Execution     | 1   | 10     | 1             |
| 05    | Builder UI: Upload & Schema          | 1   | 7      | 1             |
| 06    | Builder UI: Relationship Builder     | 1   | 7      | 1             |
| 07    | Builder UI: Query Builder & Export   | 1   | 8      | 1             |
| 08    | MVP 1 Feedback Gate                  | 1   | 6      | 6             |
| 09    | Saved Queries & Dashboard Foundation | 2   | 7      | 1             |
| 10    | Dashboard Visualisations             | 2   | 6      | 1             |
| 11    | Polish & Production Hardening        | 2   | 6      | 1             |
| 12    | Deployment                           | 2   | 8      | 2             |
| 13    | MVP 2 Launch & Feedback              | 2   | 6      | 5             |
|       | **Total**                            |     | **93** | **23**        |
