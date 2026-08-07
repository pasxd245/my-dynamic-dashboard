---
type: governance domain
title: Workspaces, relationships, and dashboards
description: Workspace scoping, governed dataset relationships, and persisted dashboard definitions with query-bound widgets.
tags: [backend, governance, dashboards]
---

# Workspaces, relationships, and dashboards

These three resources establish analytical scope and presentation ownership. Their routers are `workspaces.py`, `relationships.py`, and `dashboards.py`; durable metadata tables are in `db_models.py`.

## Workspaces

Workspaces are the outer scope for datasets, queries, relationships, dashboards, and workflows. `POST /workspaces`, `GET /workspaces`, `PATCH /workspaces/{id}`, and `DELETE /workspaces/{id}` are owned by `routers/workspaces.py`. Names are globally unique and bounded by generated name constants. Foreign keys cascade dependent metadata when a workspace is deleted; filesystem cleanup behavior is resource-specific.

## Governed relationships

A `rel_…` relationship stores left/right dataset IDs and columns, cardinality, and workspace. Create requires two distinct datasets in the same workspace, extant columns, and join-compatible dtypes. The ordered column pair is unique per workspace; duplicates return `relationship_exists`. Self joins are intentionally rejected.

Relationship `status` is computed at every read, not stored. `_compute_status()` reloads current dataset columns and reports `valid` only when both keys still exist and remain compatible; otherwise it returns `stale` without failing a list/detail read. This governance signal is separate from query execution: a query uses its own copied relationship snapshot, but it still rechecks current schema and can return `relationship_stale`. See [saved queries](queries.md).

## Persisted dashboards

A `dsh_…` dashboard stores `name`, workspace-local `slug`, opaque `definition_json`, and timestamp. Widgets live inside the definition, not a child table. Create/update validates each widget’s `queryId` belongs to the dashboard workspace; cross-workspace or unknown query references are 422. Name and slug are each unique per workspace and yield separate collision codes. Deleting a dashboard never deletes its queries. Deleting a query after a dashboard has been saved is tolerated: the frontend renders only that widget unavailable.

The builder routes configuration to `/settings/dashboard` and viewing to `/dashboards/:workspaceId/:slug`, while the API addresses dashboards by stable ID. The browser-side widget execution strategy is documented in [builder dashboards](../builder/dashboards.md).

## Tests and change guide

Use contracts in `packages/contracts/workspaces`, `relationships`, and `dashboards`, shared schema fragments, `models/common.py`, router logic, corresponding builder APIs/features, and conformance tests together. Focused tests are `test_workspaces.py`, `test_workspaces_patch.py`, `test_workspaces_delete.py`, `test_relationships.py`, and `test_dashboards.py`. Run the affected one with `uv run pytest tests/test_relationships.py`, for example.
