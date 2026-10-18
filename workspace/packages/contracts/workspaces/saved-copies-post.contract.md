# `POST /workspaces/{id}/saved-copies` — contract rationale

> **Authoritative shape**: [saved-copies-post.contract.yaml](saved-copies-post.contract.yaml).
> Design: [saved-copies.md](../../../../.agents/design/data-management/workspaces/saved-copies.md).

## Purpose

Datasets move — a refresh or a re-publish replaces their rows and dashboards follow. A saved copy
keeps "the numbers we decided on" inside the app, frozen and labelled (R193, item 3.6b; settled
decision 8: a dedicated read-only `<workspace>-saved` workspace, one per main workspace).

## Behavior

- **The saved workspace** is created on the first save (`kind: saved`, `parentWorkspaceId`), found
  by its parent afterwards; its name is `<workspace>-saved` (cut to 80; `-saved-2`… on a clash).
- **Copies** — `<name> @<label>`, `v2`/`v3`… on a repeated label (cut to 120, suffix kept); rows,
  columns (incl. `hidden`, coverage), `sourceFormat`, `sheetName`, `lineage` (display only — a copy
  is never a publish target), `dataVersion` and `refreshedAt` as the original's now, never moving;
  `savedFrom` server-written. The save re-checks the original's version after copying the rows (one
  snapshot). The original's metadata entries (dataset and columns) are copied as they are; their
  normal staleness check runs.
- **All or none.** A dataset outside the workspace (`422`, its index named), a blank label (`422`),
  or a saved workspace as the source (`409 read_only_workspace`) writes nothing.
- **Read-only afterwards.** Every write inside a saved workspace answers `409 read_only_workspace`
  — the guard checks every object a write touches, so a refresh of a copy through its main
  workspace's path is refused too — except deleting a copy and deleting the empty workspace. A main
  workspace with a saved workspace cannot be deleted (`409 non_empty`).

## Out of scope

Saving a dashboard; comparing a copy with the current dataset; un-freezing a copy.
