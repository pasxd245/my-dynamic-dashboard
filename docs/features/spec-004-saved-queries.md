# Spec 004 — Saved Queries

**Status**: ✅ Complete | **Source of truth**: [specs/004-saved-queries/](../../specs/004-saved-queries/)

## What it does

Persist, version, search, and reuse ad-hoc queries with full audit trail and soft-delete recovery.

## User stories

| ID  | Story                     | Highlights                                                                                                               |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| US1 | Save a query              | Name + description + tags, normalized tags, immutable builder/SQL snapshot, duplicate-name detection, v1 auto-created    |
| US2 | Browse and search library | Pagination (50/page), keyword search (name/description/tags), tag filter, soft-deleted excluded                          |
| US3 | Load and inspect          | Revalidation on load (column existence, relationship status), warnings non-blocking, version-pinned load                 |
| US4 | Duplicate and version     | Independent copy with `source_query_id` lineage, metadata update, immutable version on snapshot change with parent chain |
| US5 | Soft delete and recovery  | 24-hour recovery window, restore endpoint, 409 on expired restore, history preserved across delete                       |

## Backend

- Service: `SavedQueryService`
- Tables: `saved_queries`, `saved_query_versions`, `saved_query_events`, `saved_query_executions`
- Errors: 404 (not found), 409 (conflict/expired), 400 (validation)

## Endpoints

- `POST /api/v1/workspaces/{id}/saved-queries`
- `GET /api/v1/workspaces/{id}/saved-queries`
- `GET /api/v1/workspaces/{id}/saved-queries/search`
- `GET /api/v1/workspaces/{id}/saved-queries/{queryId}`
- `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/load`
- `PATCH /api/v1/workspaces/{id}/saved-queries/{queryId}`
- `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/duplicate`
- `DELETE /api/v1/workspaces/{id}/saved-queries/{queryId}` (soft, 24h)
- `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/restore`
- `GET /api/v1/workspaces/{id}/saved-queries/{queryId}/executions`

## Frontend

`SaveQueryDialog`, `SavedQueryLibraryPage`, `SavedQueryDetail`, `VersionTimeline`, `ExecutionHistoryTable`, `UpdateQueryDialog`.

## Where to look

- Spec: [spec.md](../../specs/004-saved-queries/spec.md)
- Contracts: [contracts/](../../specs/004-saved-queries/contracts/)
