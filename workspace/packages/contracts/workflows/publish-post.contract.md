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
  workflow's name, trimmed). Later publishes target the dataset in the workflow's own workspace
  held by the internal `published_workflow_id` column (`UNIQUE (workspace_id,
published_workflow_id)` — a racing first publish becomes a re-publish) and replace its rows
  (`200`). A re-publish is a refresh to every reader: `dataVersion` + 1 and `refreshedAt` = now in
  the same update as the row swap, so a workflow reading the dataset flags `data_refreshed`; columns
  that keep their name keep `hidden`. Re-publishing the run already published changes nothing (`200`,
  same version). If the dataset was deleted, the next publish creates a new one.
- **First publish hides `Source.Name`** (an upload's file-name column passing through), as the
  upload does.
- **Refusals write nothing** (`409 not_publishable`): `never_run` (also for a run without a stamp,
  before R187), `stale` (also when the workflow ran again while the output was being copied; with the same
  `staleSources` the workflow shows — publishing out-of-date numbers would hide the warning
  behind a dataset), `reads_itself` (a source of the run reads the target dataset — a publish ↔
  run loop). A first publish onto a taken name → `409 name_taken`.
- **`lineage` is server-written only** (`readOnly`): no request can set it. Uploaded datasets
  never carry it.
- **Not refreshed by upload.** A refresh upload into a `workflow` dataset fails the existing
  source-format check (`422`) and its `refresh-settings` answer `available: false`; re-publishing is
  its refresh.

## Out of scope

Saved (frozen) copies — 3.6b (`Round_193`). Publishing into another workspace. Scheduled
publishing (scheduled refresh is item 4.1).
