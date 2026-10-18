# `POST /workflows/{id}/publish` — contract rationale

> **Authoritative shape**: [publish-post.contract.yaml](publish-post.contract.yaml). Design:
> [workflows.md § Publish](../../../../.agents/design/data-management/workflows/workflows.md).

## Purpose

A dashboard reads datasets and queries; a workflow's output was readable only on its own page.
Publishing copies the frozen output into a dataset (R192, item 3.6a — the program's ruling (a′)
on Workflow item 1), stamped by the server with its lineage, so the consolidated table feeds
widgets and every number on it can say which run it came from.

## Behavior

- **One dataset per workflow.** The first publish creates it (`201`, name from the body or the
  workflow's name); later publishes find it through `lineage.workflowId` and replace its rows
  (`200`). A re-publish is a refresh to every reader: `dataVersion` + 1, `refreshedAt` = now, so a
  workflow reading the dataset flags `data_refreshed`. If the dataset was deleted, the next
  publish creates a new one.
- **Refusals write nothing** (`409 not_publishable`): `never_run`, `stale` (with the same
  `staleSources` the workflow shows — publishing out-of-date numbers would hide the warning
  behind a dataset), `reads_itself` (a source of the run reads the target dataset — a publish ↔
  run loop). A first publish onto a taken name → `409 name_taken`.
- **`lineage` is server-written only** (`readOnly`): no request can set it. Uploaded datasets
  never carry it.
- **Not refreshed by upload.** A refresh upload into a `workflow` dataset fails the existing
  source-format check (`422`); re-publishing is its refresh.

## Out of scope

Saved (frozen) copies — 3.6b (`Round_193`). Publishing into another workspace. Scheduled
publishing (scheduled refresh is item 4.1).
