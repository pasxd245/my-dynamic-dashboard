# Changelog

Release candidates of `v0.0.1`. Each entry lists every contract addition (OpenAPI files under
`workspace/packages/contracts/`), the database migrations, and what an upgrade has to know. Round
docs (`.agents/plan/cycles/Round_NNN.md`) hold the detail.

## v0.0.1-rc.3 — definitions over numbers

Compared with `v0.0.1-rc.2` (`origin/release/v0.0.1-rc.2`). Rounds R184–R197.

### Added

- **Clean text step** (R184) — `ComputeStep {kind: compute, name, fn, col}` appends a new column
  computed by one function from a closed catalog (`fn` is an enum). The catalog is `trim` only: edge
  whitespace including U+00A0 is stripped, inner spaces are kept, a blank cell becomes NULL; input
  and output are `string`. Runs in queries and workflows; the source column is never changed.
- **Dataset data identity** (R185) — `Dataset.refreshedAt` and `Dataset.dataVersion` (1 at commit,
  +1 on every successful refresh), written by the server in the same update that swaps the rows in;
  read-only. A rename or a column-visibility change leaves them alone.
- **Workflow run stamp** (R187) — `Workflow.run {id, number, definitionHash, sources}`, where each
  `WorkflowRunSource` records a query's definition hash and `dataVersions`, or a workflow source's
  `runId`. `Workflow.staleSources [{sourceId, name?, reason}]`, computed on every read, names each
  source that moved (`source_missing`, `definition_changed`, `data_refreshed`, `source_rerun`). A
  flag, never a block; a re-run clears it.
- **Several files in one refresh** (R188) — `POST /workspaces/{id}/datasets/batch` takes
  `extra_temp_ids` (1–19) beside `temp_id` on a refresh item: the files are stacked in order and the
  refresh mode applies to the stack, with one version bump. `ApiErrorCoercionFailed` gains an
  optional `file`.
- **Replace a period** (R189) — refresh mode `replace_period` with `period_column` (a date /
  datetime column on both sides): committed rows inside `[min, max]` of the incoming rows are
  replaced, the rest kept. The 201 is a fourth shape,
  `{datasets, period: {column, from?, to?, removed, inserted, kept}}`; `GET …/refresh-settings`
  remembers `period_column`.
- **Publish a workflow** (R192) — `POST /workflows/{id}/publish` (body `{name?}`): the frozen output
  becomes a dataset with `sourceFormat: workflow` and a server-written `Dataset.lineage`
  (`workflowId`, `workflowName`, `runId`, `runNumber`, `runAt`, `definitionHash`, `sources`,
  `publishedAt`). First publish 201, re-publish 200 and counts as a refresh. `Workflow.published`
  (`datasetId`, `datasetName`, `dataVersion`, `runId`, `runNumber`) names the dataset. Refused with
  409 `not_publishable` (`reason`: `never_run`, `stale` with `staleSources`, `reads_itself`).
- **Saved copies** (R193) — `POST /workspaces/{id}/saved-copies` (`{label, datasetIds}`, 1–20)
  freezes datasets into the workspace's saved workspace, created on first save. `Workspace.kind`
  (`main` | `saved`) and `parentWorkspaceId`; a copy carries `Dataset.savedFrom` (`datasetId`,
  `datasetName`, `workspaceId`, `dataVersion`, `refreshedAt`, `label`, `savedAt`) and keeps the
  original's version. Writes inside a saved workspace answer 409 `read_only_workspace`.
- **Query parameters** (R194):
  - `QueryDefinition.params [{name, type: date | number | string, label?, default?}]` (≤ 8); a date
    default may be `RelativeDate {kind: today, offsetDays}`, resolved in `backend.time_zone`.
  - `ParamRef {"param": name}` is accepted only as a filter atom / filter-step / `case` WHEN operand
    (`Operand`); never `refCol`, never in a workflow step.
  - Viewer values: `params` (`ParamValues`) in the body of preview, aggregate, totals and export,
    and `p.<name>=` on `GET /queries/{id}/rows`. `dashboard` (`DashboardRef {id, widgetId}`) in the
    body, or `dashboard=` + `widget=` on rows, applies that dashboard's saved values.
  - Precedence viewer → dashboard → default. Every read echoes
    `resolvedParams {name: {value, source}}`; a query without parameters answers exactly as
    before.
  - New errors: 422 `param_unbound` (`param`, `label?`, `sourceId?`, `missing[]?`) and 422
    `param_invalid` (`param`, `expected`, `source`, `reason?: range_reversed`).
  - Export: a Parameters block on the XLSX Filters sheet and the `X-MDD-Params` header (both
    formats). A workflow run uses defaults only and records them in `WorkflowRunSource.params`.
- **Dashboard controls** (R195) — `DashboardDefinition.controls` (≤ 12) of `DashboardControl`
  (`id`, `kind: param`, `label`, `param`, `targets: all | [widgetId]`, `saved?`). A control reaches a widget only
  when targeted and its query uses the parameter; otherwise the card is badged, never failed. Viewer
  values live in the URL (`?p.<name>=`); saving a value is a dashboard PUT.
- **Data versions on reads** (R196) — `dataVersions {datasetId: n}` on `/queries/{id}/rows`,
  `/aggregate`, `/totals` and preview: every dataset the read touched. The query export gains a
  Data versions block on the Filters sheet and the `X-MDD-Data-Versions` header.
- **Export a dataset** (R196) — `POST /datasets/{id}/export` (`{format: csv | xlsx}`): every row,
  visible columns, typed cells, `X-MDD-Data-Versions`, `_v<n>` in the file name; a copy's Filters
  sheet says what it froze. Same 100,000-row cap (`export_too_large`).
- **Metadata anchor** (R197):
  - `MetadataEntry.anchor` (`MetadataAnchor`: `definitionVersion`, `dataVersions?`, `runId?`,
    `queryVersions?`, `params?`, `assumedParams?`), stamped by the server on every write.
  - `MetadataEntry.state`: `current`, `refreshed`, `other_period` or `other_definition`, computed
    against the reader's view.
  - `MetadataRead.current` (the reader's anchor) and `childrenCurrent` (per child).
  - `PUT /metadata/…` takes `params` (the values the writer read under); `GET /metadata/…` takes
    `p.<name>=`. A write answers 422 `param_unbound` / `param_invalid`; a read never refuses.
- The API error `code` enum gains `not_publishable`, `read_only_workspace`, `param_unbound`,
  `param_invalid`.

### Changed

- **New required fields a client must read:** `Dataset.refreshedAt` and `dataVersion`;
  `Workspace.kind`; `MetadataEntry.anchor` and `state`; `MetadataRead.current`.
- `Dataset.sourceFormat` gains `workflow`. A published dataset is refreshed by re-publishing only:
  an upload refresh into it is 422 and its refresh settings answer `available: false`.
- **Workflow save is stricter** (R186) — every source must resolve now (a workflow source must have
  been run), appear once and share the first source's columns and dtypes (integer and float widen to
  float); otherwise 422 with `unknown_source`, `unresolved_source`, `duplicate_source` or
  `sources_diverge` at the source's index. Shapes that diverge after save fail the run with 409
  `query_stale`. A step operand with a `ParamRef` is refused at save.
- **Workflow output with 2+ sources** gains a final `Source.Query` column (suffixed off a
  collision); a one-source output is unchanged.
- **Filter and `case` operands** (`val`, `lo`, `hi`, `in` items, WHEN operands) are now `Operand`:
  a literal or a `ParamRef`. A client that reads definitions must handle the object form.
- **Saved workspaces are read-only** — every write route (datasets, columns, queries, relationships,
  workflows, dashboards, metadata, workspace rename) answers 409 `read_only_workspace` there; only
  deleting a copy and the empty workspace work. A main workspace whose saved workspace holds copies
  is 409 `non_empty` on delete; an empty saved workspace is deleted with it.
- **Deletes now archive notes** (R197) — deleting a dataset, query, workflow, dashboard,
  relationship, workspace or saved copy, or removing a widget in a dashboard PUT, moves its
  metadata entries to `metadata_entries_swept` in the same transaction. A column that leaves its
  dataset in a refresh keeps its notes.
- `step_invalid` (409) is now listed on `POST /workflows/{id}/run`, `GET /queries/{id}/rows` and
  preview, which already emitted it (R191). A run also lists 422 `param_unbound`.
- A table widget whose measure is typed text but holds only numbers now shows the sum instead of the
  empty state; any non-number cell keeps the empty state (R191).

### Fixed

- The "too many rows" message of a widget export never showed: the builder's error guard did not
  know `export_too_large` and fell back to "Could not export" — present since R182 (R196).
- Text starting with `=` (a dataset name, a label, a parameter value or a data cell) opened as a live
  formula in XLSX exports; every text cell on every sheet is now kept as text (R196).
- R191 fix round: an export's totals-row label could overwrite a total; a deleted query's widget
  never read "query unavailable"; a `count` draft switched to scatter or combo saved a measure the
  server forbids; the join warning named the datasets in the wrong direction; the relationship
  declare refusal was generic; an advanced-query no-match read "empty dataset"; the refresh Confirm
  footer read "Creating 1 dataset in …"; the workflow steps editor could not offer `Source.Query`.
- A saved copy could freeze new rows under the old version during a refresh swap; the save now waits
  for the swap and re-checks the rows file (R193).
- A parameter value valid for its type but not for its column (a fraction on an integer column, a
  reversed range) answered 409 `query_stale`; it is now 422 `param_invalid` (R194).

### Database

- `0006_dataset_data_version` — `datasets.data_version` (default 1) and `refreshed_at` (backfilled
  from `created_at`).
- `0007_workflow_runs` — `workflows.run_id`, `run_number`, `run_json`.
- `0008_dataset_lineage` — rebuilds `datasets`: `source_format` CHECK adds `workflow`, plus
  `lineage_json` and `published_workflow_id` (unique per workspace). Child rows (relationships,
  queries, metadata) are untouched.
- `0009_saved_copies` — `workspaces.kind`, `parent_workspace_id` (unique), `datasets.saved_from_json`.
  Additive.
- `0010_metadata_anchor` — `metadata_entries.anchor_json` and the archive table
  `metadata_entries_swept`.

### Upgrade notes

- **Migrations run at startup** (0006 → 0010). Every downgrade keeps the rows: a published dataset
  becomes a plain `csv` dataset, a saved workspace an ordinary one.
- **0010 archives orphan metadata** — entries whose noun is already gone move to
  `metadata_entries_swept`; nothing is dropped, and `downgrade` puts every swept row back.
- **Existing data starts unstamped.** Every dataset reads `dataVersion` 1 at its creation time;
  materialized workflows show no run number or stale flag until their next run; rc.2 metadata
  entries carry `{definitionVersion}` only and compare on the definition alone.
- **`backend.time_zone`** (IANA, default `UTC`; `MDD_BACKEND__TIME_ZONE`) decides "today" for
  relative date defaults only; stored data stays naive.
- **Metadata writers may now send `params`.** A writer that sends only `md` is stamped with the
  saved or default values (`anchor.assumedParams`); on a query with a used parameter and no default,
  a write without `params` answers 422 `param_unbound`.
- **Known limit.** A read that lands in the instant a refresh swaps the files in can report a data
  version one off from the rows it read (labels only; the numbers are right). Closing it needs
  version-tagged storage; logged in the program's rolling log.

## v0.0.1-rc.2 — display gaps

Compared with `v0.0.1-rc.1` (`5334c81`). Rounds R177–R183, plus one fix.

### Added

- **Widget height** (R177) — `Widget.rows` (1–3, optional; absent = 1). The dashboard grid places a
  short widget beside a tall one.
- **Date coverage per column** (R178) — `Column.coverage {min, max, blankShare}` on committed
  `date` / `datetime` columns of a dataset (`GET /datasets/{id}`). Profiled by the server at commit
  and at every refresh; read-only. Absent on datasets committed earlier until their next refresh.
- **Note widget** (R179) — `chartType: note` with `md` (1–4000 characters of a safe markdown
  subset: headings, emphasis, code, lists, quotes, rules, http(s) links). Raw HTML, images and
  non-http(s) links are rejected with 422, never stripped. A note has no `queryId` and no `agg`.
- **Metadata, view-only in the app** (R180) — notes attached to a noun (`dataset`, `column`,
  `relationship`, `query`, `workflow`, `dashboard`, `widget`), one entry per namespace:
  - `GET /metadata/{kind}/{noun_id}`
  - `PUT /metadata/{kind}/{noun_id}/{namespace}` and `DELETE …` — bearer token required.
  - The server records author, source, time written and the definition version of the noun, and
    flags an entry as "may be out of date" when the definition changed since.
  - New errors: `unauthorized` (401), `forbidden` (403, including the reserved `system` namespace),
    `metadata_invalid` (422, `reason` one of `namespace`, `empty`, `too_large`,
    `markdown_unsafe`, `namespace_cap`).
- **Table total row** (R181) — `Widget.totals {agg: sum | ratio, num?, den?}` and
  `POST /queries/{id}/totals`, computed on the query result after its steps and under the active
  filters. A ratio total is SUM(num) / SUM(den), not an average of row ratios.
- **Export a table** (R182) — `POST /queries/{id}/export` to CSV or XLSX: typed cells, the total
  row, a Filters sheet (XLSX). Capped at 100,000 rows; over it → 422 `export_too_large {rows, max}`
  and nothing is written.
- **Relationship self-check** (R183) — `GET /relationships/{id}/check`: coverage both ways,
  observed vs declared cardinality, and a join-multiplication flag; shown in a drawer and as a
  warning in the join dialog.

### Changed

- `Widget` no longer requires `queryId` and `agg` (`required: [id, title, chartType, span]`): both
  stay required for every chart type except `note`, where they must be absent. A client that reads
  widgets must handle `chartType: note`.
- The API error `code` enum gains `unauthorized`, `forbidden`, `metadata_invalid`,
  `export_too_large`.

### Fixed

- A table widget created in the dashboard builder was rejected on save (422: `agg: sum` without a
  measure column) and lost when the dialog closed — present since R117. A table now saves as
  `count` (`ff9647a`).
- Editing a table or stat widget no longer resets it to a bar chart (found in R181).

### Database

- Migration `0005_metadata_entries` — new table `metadata_entries`. No change to existing tables.

### Upgrade notes

- **Metadata writes are off by default.** Until `backend.metadata_tokens` is configured (values
  file, `MDD_CONFIG_FILE`, or `MDD_BACKEND__METADATA_TOKENS` as JSON), every write answers 401.
  Each token is at least 16 characters and carries the closed list of namespaces it may write;
  `system` can never be granted.
- Datasets committed before this release show date coverage only after their next refresh.
