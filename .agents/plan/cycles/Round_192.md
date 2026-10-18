# Round 192: publish a workflow's output as a dataset, with lineage (item 3.6a)

**Status**: Review — built and reviewed (BA twice, code review, QA: no open P0/P1); awaiting the human acceptance walk (W1–W9) and sign-off
**Flow**: **DFCFBI (triggers 1, 3)** — set at the Design gate via `flow-selector`; re-run after the BA's Contract-exit review corrected condition 3 (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — `POST /workflows/{id}/publish`: a workflow's frozen output becomes a dataset in its
workspace (`sourceFormat: workflow`), stamped by the server with `lineage` (workflow, run, run time,
definition hash, what the run read). First publish 201, re-publish 200 = a refresh (`dataVersion`

- 1, `hidden` kept, swap + bump in one update); the same run again changes nothing. Refused —
  writing nothing — when never run / unstamped, out of date (or re-run mid-copy), or reading its own
  dataset. `Workflow.published` names the dataset. Builder: [Publish] / [Re-publish] with the reason
  when blocked, a name modal, a confirm that lists column changes, the published line; the dataset
  page shows where it came from and offers no Refresh. Migration `0008` rebuilds `datasets` (a parent
  table) without touching a child row.

**Studied** — _predicted_ the risk was the migration; _saw_ the migration hold on the first try
(QA reproduced it on an app-built database, both ways, through the boot path too) while the
reviewers found the real gaps in the **seams**: an error code the client did not know (the reason
never shown), a run finishing mid-copy, re-publishing an unchanged run as a "refresh", an upload's
file-name column surfacing; _now believe_ (high) the BA's Contract-exit pass is worth its cost —
four P1s fixed before a line of code — and a new error code needs its client union in the same
round, or the UI swallows it.

**Watch** — two microsecond windows (a re-publish racing a run's file write; two re-publishes
racing their swaps) want a per-dataset lock if publishing ever runs on a schedule (4.1); the
Datasets list still labels a published row "Uploaded".

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
- [x] **B** — migration `0008_dataset_lineage` (rebuild `datasets`: CHECK + `lineage_json`, foreign
      keys off, children intact); `db_models.py`; parity test; router `publish_workflow`;
      `_dataset_from_row` → `lineage`; tests
- [x] **F** — types, `workflowsApi.publish`, hooks; WorkflowDetailPage [Publish]/[Re-publish] + modal + published line; DatasetDetailPage lineage line, no Refresh for `workflow`; EN/VI; MSW
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

- 2026-10-18 — **F1** (builder against MSW, before the backend): `PublishControls.tsx`
  (`publishBlock`, `columnDiff`, `PublishButton` with the name modal and the re-publish confirm,
  `PublishedLine`), `usePublishWorkflowMutation`, `workflowsApi.publish`; dataset page lineage line
  (`PublishedFrom`, current workflow name or "(the workflow no longer exists)"), no Refresh for a
  published dataset on the detail page or the list row menu, a "Workflow" format label and icon;
  `UploadFormat` split from `SourceFormat` (an upload is never `workflow`); MSW `publishWorkflow`
  handler + `MOCK_PUBLISHED_DATASET`; EN/VI. `workflow-publish-r192.test.tsx` +8. Builder 495.
- 2026-10-18 — **B**: migration `0008_dataset_lineage` (rebuild via `_datasets_new` → drop →
  rename into place, so children keep referencing `datasets`; `test_migration_0008.py` proves
  relationships / queries / metadata survive both ways, `foreign_key_check` clean, cascade still
  works); `Dataset` model + parity schema; `POST /workflows/{id}/publish` (`_publish_new`,
  `_republish` with the R185 swap); `Workflow.published`; `_dataset_from_row` /
  `_carry_forward_hidden` moved to `routers/_shared` (R106 pattern — no router→router import);
  `not_publishable` in `values.yaml` + both templates. `test_workflow_publish.py` +12 (acceptance
  a–i). Backend 599 · builder 495 · contracts 47.

- 2026-10-18 — reviews after the build (rc3.md § Execution):
  - **Code review: CHANGES** — **R1 (P1)** the builder's `ApiError` union did not know
    `not_publishable`, so a server refusal showed the generic toast and the page kept the button
    enabled; P2: a run finishing while the output is copied (R2), shared staging / backup directory
    names (R3), widget caches not invalidated (R4), the 404 retry on the workflow (R5), keyboard
    access to the disabled reason (R6), a misplaced doc comment (R7), contract wording (R8).
  - **QA: PASS** — clean gates matched; migration `0008` reproduced on a database built through the
    pre-round app (two workspaces, uploads, relationship, queries, dashboard, run workflow, metadata)
    both through `alembic upgrade` and `run_startup_migrations`, up → down → up, every row and
    `foreign_key_check` intact; 13 adversarial tests kept (8 backend, 5 builder); visual gate in a
    real browser on a real backend (`/tmp/claude-0/qa-shots/r192/`, 14 screens incl. a widget over
    the published dataset matching the workflow rows). P2: the same R1, the title tag reading "CSV",
    a 500 when the dataset directory is missing, re-publishing an unchanged run bumping the
    version, "Uploaded" on a published dataset.
  - **BA (after build): PASS** — all 12 Contract-exit findings built as folded; P2: the confirm's OK
    before the columns load (F-1), `Source.Name` surfacing visible (F-2), raw type names in the
    retyped line (F-3), an untranslated tooltip (F-4), contract wording (F-5), a test that never
    opened the menu (F-6), VI copy (F-8), test gaps (F-9).
- Fixed in-round: R1 (union + `isApiError` + reload on refusal, test), R2 (`_run_moved` after
  staging → `stale`, test), R3 (per-request suffixes), R4, R5, R6 (focusable span, focus trigger),
  R7, R8 / F-5; the same run re-published → `200` unchanged + the builder's `up_to_date` block
  (tests); `Source.Name` hidden on first publish (test); a lost dataset directory re-published into
  place (test); title tag and icon "Workflow"; "Published" labels on the dataset page; OK waits for
  the columns; type names in words (EN / VI); tooltip translated; VI copy. Code review re-check:
  **PASS** (R6 tooltip-on-focus closed after).
- Gates (final): backend 611 · builder 502 · contracts 47; `tsc --noEmit`, `ruff check`, lints 0.

## Check

- [x] backend 611 · builder 502 · contracts 47 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] migration `0008` up → down → up on a seeded database with relationships, queries, metadata
      (`test_migration_0008.py` + QA on an app-built database, both migration paths)
- [x] Visual gate (UI-bearing round): QA, real backend + headless Chromium, 14 screens
- [x] BA · code review · QA — no open P0/P1 (code review R1 fixed and re-checked)
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 9`. Setup: a new
      workspace **Pub**; `walk_calls.csv` uploaded as **calls**; queries **North** (`team = North`)
      and **East** (`team = East`) on it; workflow **Calls by team** with sources North and East, no
      steps, not run.
  - ⬜ W1 — open **Calls by team**, hover (or Tab to) **Publish**: disabled, "Run this workflow
    first."; the Datasets list has only **calls**.
  - ⬜ W2 — **Run**; **Publish**, type `calls`, OK → the modal stays open: "A dataset with this name
    already exists in this workspace."; type `Calls by team`, OK → toast "Published as dataset
    “Calls by team”."; under the summary "Published as dataset **Calls by team** · data version 1 ·
    from run #1"; the button now reads **Re-publish**, disabled: "This run is already published."
  - ⬜ W3 — follow the link: 5 rows; Data version v1; Format **Workflow** (title tag too); "Published
    from workflow **Calls by team** · run #1 · <time>"; `Source.Query` North (2) / East (3);
    `Source.Name` hidden; Actions menu without **Refresh**. Hide `team` in Properties.
  - ⬜ W4 — save the dataset as query **Published calls**; on a dashboard add a Table over it with
    Totals › Sum of `calls`, and a bar of Sum `calls` by `Source.Query`: footer 17; North 3, East 14.
  - ⬜ W5 — refresh **calls** with `walk_calls_more.csv` (Add rows); open **Calls by team**: the
    out-of-date warning; **Re-publish** disabled, "The results are out of date — re-run first.";
    the dataset still v1.
  - ⬜ W6 — edit the workflow: a step that drops `agent`, a step that adds a column (e.g. a date part
    of `called_at`); save → "The workflow was edited after this was published — run it, then
    re-publish."; **Run** → "The workflow was re-run after this was published. Re-publish to update
    Calls by team."
  - ⬜ W7 — **Re-publish**: the confirm reads "Replace the data in Calls by team (data version 1, run
    #1) with run #N? …" and lists `agent — removed…`, `<new column> — new`; confirm → "…updated —
    data version 2". Reload the dataset and the dashboard: v2, 7 rows, lineage run #N, `team` still
    hidden; footer 24; North 8, East 16.
  - ⬜ W8 — delete the workflow; open the dataset: "Published from workflow **Calls by team** (the
    workflow no longer exists) · run #N"; the dashboard still 24.
  - ⬜ W9 — Datasets list: **Calls by team** has the workflow icon (tooltip "Workflow" / VI "Quy
    trình") and its row menu has Rename / Delete, no Refresh; **calls** keeps Refresh.

## Act

- Rolling log: four P2 rows (list "Uploaded" label for a published dataset; the two race windows →
  a per-dataset lock with 4.1; widget caches up to 60 s after a refresh or re-publish —
  pre-existing; `SourceIcon` title not reactive to a language switch).
- Promotion: none this round. Candidate lesson (memory, if it recurs): a new API error code ships
  with its client union in the same round.
- Prune check: none — the BA's Contract-exit pass found four P1s before code; it earns its place.

## Feeds into → Round_193 (TBD)

Item 3.6b — saved copies: frozen, read-only copies in a `<workspace>-saved` workspace.
