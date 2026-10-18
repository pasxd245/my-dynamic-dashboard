# Round 192: publish a workflow's output as a dataset, with lineage (item 3.6a)

**Status**: In Progress
**Flow**: **DFCFBI (triggers 1, 3)** — set at the Design gate via `flow-selector`; re-run after the BA's Contract-exit review corrected condition 3 (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

_(at close)_

## Goal

**Inherits from ← [Round_191](Round_191.md)** — the fix round cleared the rolling log; G-wf was
confirmed after walk session B (2026-10-18), which opens item 3.6.

A dashboard reads datasets and queries, not workflows: publish copies a workflow's frozen output
into a dataset the server stamps with where it came from (workflow, run, what the run read), so the
consolidated table can feed widgets, and "which run is this" has an answer.

**Split.** Item 3.6 is two features — publish (3.6a) and saved copies (3.6b) — with different
migrations, surfaces and failure modes; one feature per round (AGENTS.md), so 3.6b is `Round_193`
and the rest of rc.3 shifts by one (rc3.md § Execution).

_Track: 1 (product). Pulled by: release program item 3.6 (label R180), opened by G-wf; Workflow item
1 ruled (a′) at R175 — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: `POST /workflows/{id}/publish` creates (201) then updates (200) one dataset per
workflow, `sourceFormat: workflow`, `dataVersion` 1 → 2, `lineage` = the run published; never-run,
stale and self-reading workflows refuse with `409 not_publishable` and write nothing; a query and a
widget read the dataset; a workflow over it flags `data_refreshed` after a re-publish; migration
`0008` adds `lineage_json` and widens the `source_format` CHECK, both ways, without touching any
other table's rows.
**Falsified if**: a re-publish creates a second dataset, a refused publish writes anything, the
migration loses a relationship / query / metadata row, or a client can write `lineage`.

- [x] **D** — `workflows/workflows.md` § Publish (+ routes row, scope), `datasets/datasets.md`
      (`sourceFormat: workflow`, `lineage`, persistence); `flow-selector`
- [x] **C** — `workflows/publish-post.contract.yaml` (+ `.md`); `_shared/dataset.yaml`
      (`SourceFormat += workflow`, `DatasetLineage`, `Dataset.lineage` read-only);
      `_shared/api-error.yaml` (`not_publishable`); BA review at Contract exit
- [ ] **B** — migration `0008_dataset_lineage` (rebuild `datasets`: CHECK + `lineage_json`, foreign
      keys off, children intact); `db_models.py`; parity test; router `publish_workflow`;
      `_dataset_from_row` → `lineage`; tests
- [ ] **F** — types, `workflowsApi.publish`, hooks; WorkflowDetailPage [Publish]/[Re-publish] + modal + published line; DatasetDetailPage lineage line, no Refresh for `workflow`; EN/VI; MSW
- [ ] **I** — visual gate in a real browser
- [ ] Reviews: code review, QA (BA twice) — rc3.md § Execution

## Risks / unknowns

- **The `datasets` rebuild** — `datasets` is a parent (relationships FK to it with `ON DELETE
CASCADE`, queries reference it by id); renaming or dropping it with foreign keys on would delete
  or re-point children. The migration must run with `PRAGMA foreign_keys=OFF` and keep the table's
  name for every child; a test proves relationships, queries and metadata survive both ways.
- **Publish ↔ run loop** — a workflow whose source query reads its own published dataset; refused as
  `reads_itself` rather than left to oscillate between stale and published.
- **Re-publish changes numbers under dashboards** — by design (it is a refresh); the dataset's
  `dataVersion` and `refreshedAt` say so, and a saved copy (3.6b) is the way to keep the old ones.

## Do

- 2026-10-18 — D: `workflows.md` § Publish (route, refusals, what the dataset carries, surfaces,
  acceptance a–g) + routes row + scope; `datasets.md` (`sourceFormat: workflow`, `DatasetLineage`,
  § Published datasets, persistence + CHECK).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired?  | Justification                                                                                                                                                                                                        |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes     | first publish, re-publish, three refusals (`never_run` / `stale` / `reads_itself`), "has run since" — six                                                                                                            |
| 2. New interaction pattern           | no      | a header action + a name modal + an info line, all patterns the workflow and dataset pages already use                                                                                                               |
| 3. High user-error risk              | **yes** | _(corrected after the BA review — first read "no")_ a re-publish replaces rows that cannot be recovered (the re-run already overwrote the output; saved copies are 3.6b) and can change the columns under dashboards |
| 4. Contract depends on unresolved UI | no      | the request is `{name?}` and the response a `Dataset`; no UI choice changes the shape                                                                                                                                |
| 5. UX confidence below threshold     | no      | the journey is "run, then publish" on a page users already know                                                                                                                                                      |

Result: first run **Flow: DCFBI** (1 of 5); corrected to **Flow: DFCFBI (triggers 1, 3)** after the BA review — the builder (F1) is built against MSW before the backend.

- 2026-10-18 — C: `workflows/publish-post.contract.yaml` (+ `.md`), `operationId: publishWorkflow`;
  `_shared/dataset.yaml` `SourceFormat += workflow`, `Dataset.lineage` → `DatasetLineage`
  (read-only); `_shared/workflow.yaml` extracts `WorkflowRunSource` and `WorkflowStaleSource` (no
  shape change) so lineage and the refusal reuse them; `_shared/api-error.yaml`
  `ApiErrorNotPublishable {code, reason, staleSources?}`. Contracts 47.
- 2026-10-18 — **BA review at Contract exit: CHANGES** (P1 ×4, P2 ×8). Folded in before any code:
  P1-1 an unstamped (pre-R187) run → `never_run`; P1-2 a re-publish keeps `hidden` on surviving
  columns, re-profiles coverage, and the builder confirms with the column differences (and the flow
  selector's condition 3 was wrong — corrected, flow → DFCFBI); P1-3 the target is the dataset in
  the workflow's own workspace, held by an internal `published_workflow_id` with
  `UNIQUE (workspace_id, published_workflow_id)`; P1-4 Refresh hidden in the list row menu too,
  `refresh-settings` `available: false`, a "Workflow" format label. P2: `lineage.runAt` (a one-way
  door — the next run overwrites it); `Workflow.published` (read-only) so the builder does not scan
  datasets; indirect loops declared (shown as out of date, not refused); the swap and the version
  bump in one update; `sizeBytes` = parquet size; the dataset page uses the workflow's current name;
  copy for tooltips, the confirm and the edited-since line. Contracts still 47.

## Check

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] migration `0008` up → down → up on a seeded database with relationships, queries, metadata
- [ ] Visual gate (UI-bearing round)
- [ ] BA · code review · QA — no open P0/P1

## Act

_(at close)_

## Feeds into → Round_193 (TBD)

Item 3.6b — saved copies: frozen, read-only copies in a `<workspace>-saved` workspace.
