# rc.3 — definitions over numbers

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Starts only after rc.2 is tagged.

**Why this rc is the careful one:** typed parameters, version stamps and the triple anchor are
**one-way doors** — once dashboards and external writers depend on their shape, changing it breaks
them. Borrow shapes that already work elsewhere: parameter precedence and URL-held viewer values
(as in established BI tools), and the run / job version / dataset version split from OpenLineage.

**Order (dependencies drive it):**

```text
3.1 compute ──────────────┐
3.2 stamps (data_version, definition_version, run_id, updated_at)
   ├─> 3.3 workflow repairs (W-4 staleness needs 3.2)
   ├─> 3.4 multi-file refresh ─> 3.5 replace_period
   └─> 3.6 publish derived dataset + saved copies (needs 3.2, 3.3)
3.7 typed parameters (design from 2.7) ─> 3.8 metadata triple anchor (needs 3.2, 3.7, 2.6)
```

Labels from `Round_175 § Feeds into`: **R177** = 3.1, **R178–R179** = 3.4–3.5, **R180** = 3.6.
They are names, not round numbers; each round takes the next free number when it opens.

---

## 3.1 `compute` step + closed function catalog (R177, fork B)

|          |                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Track    | 1                                                                                                                                    |
| Flow     | DCFBI after a short lock decision                                                                                                    |
| Evidence | text values that differ only by trailing spaces group as two (R175); brainstorm `2026-07-01-step-model-extensibility` leans fork (B) |

- **Lock first:** a decision artifact `.agents/decisions/<date>-compute-catalog.md` locking fork (B)
  with the four bridge properties: namespaced ids (`core.trim`), self-describing registry, an
  executor slot per entry (`duckdb-sql`), trust tier (`core`).
- **Contract** (`_shared/query.yaml`): `ComputeStep {kind: compute, fn, args, as}`; `fn` is an enum
  generated from the registry; `GET /compute/catalog` returns entries `{id, label, args schema,
outputDtype, tier}`.
- **Backend:** `app/compute_catalog.py` (registry: id → args schema, output dtype, SQL template),
  one branch in `query_engine.py` that renders the template with **quoted identifiers only** (no
  string interpolation of user values; literals go through bound parameters). First entries:
  `core.trim` only, plus any other function with logged evidence — default is don't add.
- **Builder:** function picker; arg form rendered from the catalog schema (no per-function UI code).
- **Tests:** registry schema validation; trim removes leading/trailing whitespace incl. NBSP
  decision (document it); unknown fn 422; output dtype threads into later steps; SQL template
  injection attempt in a column name is quoted.
- **Walk:** group by a name column with trailing spaces before/after a `core.trim` step; counts merge.

## 3.2 Version stamps

|          |                                                                                     |
| -------- | ----------------------------------------------------------------------------------- |
| Track    | 1                                                                                   |
| Flow     | DCFBI                                                                               |
| Evidence | `updated_at` is absent product-wide (R168, R174); W-4 cannot be detected without it |

- **Design:** `data-management/_noun-model.md § Versions`. Terms:
  - `dataVersion` on a dataset: integer, +1 on every committed write (upload, refresh in any mode,
    append-overlap, columns patch that changes data), plus `dataHash` (hash of the committed
    parquet files' content hashes).
  - `definitionVersion` on query, dashboard, workflow: integer, +1 when `definition` changes; a
    rename does not bump it.
  - `runId` on a workflow run: `run_<yyyymmddhhmmss>_<6 hex>`.
  - `updatedAt` on every noun.
- **Contract:** add the fields to `Dataset`, `Query`, `Dashboard`, `Workflow` responses (read-only).
  `/rows`, `/aggregate`, `/totals` responses gain `dataVersions: {<datasetId>: n}` for the datasets
  they read.
- **Migration** `0006_versions`: columns with defaults (`1`, `created_at`) so existing rows are
  valid; downgrade drops them.
- **Backend:** bump in the one place each write commits (find them via the existing staging→commit
  swap in `routers/datasets.py`); a test per write path asserts the bump.
- **Export (2.4) and About sheet:** fill `data_version`.
- **Tests:** every write path bumps once; rename doesn't bump; failed refresh (staging discarded)
  doesn't bump.

## 3.3 Workflow repairs (W-2, W-3, W-4, W-5, W-7)

|          |                                                                                 |
| -------- | ------------------------------------------------------------------------------- |
| Track    | 1                                                                               |
| Flow     | DCFBI, may split into two rounds (correctness: W-2/W-3; lifecycle: W-4/W-5/W-7) |
| Evidence | `Round_174 § Do`; program `workflow-earns-its-place` rolling log                |

- **W-2 same shape:** **enforce** — `422 workflow_sources_shape_mismatch` listing the differing
  columns (stacking different shapes is Dataset Append's job). Record the choice in `workflows.md`.
- **W-3 provenance:** consolidate adds a hidden `Source.Name` column (source dataset name), the R156
  `Source.Name` pattern; double-count test: two identical sources produce 2× rows **with** distinct
  `Source.Name`, never silently merged.
- **W-4 staleness:** a run stores `{definitionVersion, sources: {id: dataVersion}}`; `GET
/workflows/{id}` returns `freshness: current | stale_definition | stale_sources` by comparing to now.
- **W-5:** creating a workflow over a query that has never resolved → `422`.
- **W-7 outlives sources:** deleting a source dataset marks dependent workflows
  `freshness: source_missing`; `/rows` still serves the last output but with that flag; the UI shows
  it as unhealthy.
- **Tests:** one per finding, each reproducing the R174 measurement first (red), then green.
- **After this round:** update `workflow-earns-its-place.plan.md` rolling log dispositions → fixed.

## 3.4 Refresh with several files at once (R178)

|          |                                                                        |
| -------- | ---------------------------------------------------------------------- |
| Track    | 1                                                                      |
| Flow     | DCFBI                                                                  |
| Evidence | monthly exports arrive as several files that together form one refresh |

- **Contract:** the refresh request accepts `tempUploadIds: [..]` (1–20) instead of one id; files
  are stacked (same-shape rule as W-2) and then the chosen `refresh_mode` applies to the stack.
- **Backend:** reuse `ingest/merge.py` and the staging→commit swap; the stack happens in staging.
  One `dataVersion` bump for the whole refresh.
- **Tests:** two files stacked = one refresh; one bad file fails the whole refresh with nothing
  committed; shape mismatch 422 names the file.

## 3.5 `replace_period` refresh mode (R179)

|          |                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------ |
| Track    | 1                                                                                                |
| Flow     | DCFBI                                                                                            |
| Evidence | a weekly export re-covers the last N days; rows in that window must be replaced, older rows kept |

- **Contract:** `refresh_mode += replace_period`, with `periodColumn` (date/datetime). The period =
  `[min, max]` of `periodColumn` in the incoming file(s), inclusive.
- **Semantics:** committed rows inside the period are deleted; incoming rows inserted; committed rows
  outside kept. Response reports `{replacedFrom, replacedTo, removedRows, insertedRows}`.
- **Guards:** period column missing on either side or not a date → 422; incoming rows with null
  period → 422 (no silent drop).
- **Tests:** overlap window replaced; rows before the window kept; a gap inside the window removes
  committed rows there (document — that is what "replace the period" means); null period 422.

## 3.6 Publish a workflow output as a derived dataset + saved copies (R180)

|          |                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                                                     |
| Flow     | **DFCFBI** recommended — run `flow-selector`                                                                                          |
| Evidence | Workflow item 1 ruled (a′); a dashboard needs to read a workflow's result; "what numbers was a decision based on" needs a frozen copy |

- **Publish:** `POST /workflows/{id}/publish` → creates or updates a dataset with
  `source_format: workflow` and `lineage: {workflowId, runId, definitionVersion, sources: {id:
dataVersion}}`. Queries and widgets read it like any dataset. Re-publish bumps its `dataVersion`.
  Refuse publish when `freshness != current` (409 with the reason).
- **Saved copies:** a workspace has `kind: main | saved`. `POST /workspaces/{id}/saved-copies` with
  `{label}` copies chosen datasets (parquet copied, immutable) into the workspace
  `<workspace>-saved` (created on first use, one per main workspace). Names: `<name> @<label>`; a
  second save with the same label → `v2`. Everything in a `saved` workspace is read-only (writes →
  `409 read_only_workspace`). Deleting a workspace that still has data stays `409 non_empty`.
- **Migration** `0007_lineage_saved`: `datasets.lineage_json`, `workspaces.kind`.
- **Tests:** publish → dataset row count equals workflow rows; lineage fields; stale workflow refuses
  publish; saved copy immune to later refresh of the original; write to saved workspace 409.
- **Walk:** build a workflow, publish, put a widget on it, save a copy labelled with a week, refresh
  the source, confirm the copy did not change.

## 3.7 Typed parameters

|          |                                                                             |
| -------- | --------------------------------------------------------------------------- |
| Track    | 1                                                                           |
| Flow     | DCFBI (design already done in 2.7)                                          |
| Evidence | the same report is re-read for a different period without rewriting queries |

- **Contract** (`_shared/query.yaml`): `QueryDefinition.params: [{name, type: date | number |
string, default?}]`; anywhere a literal operand is accepted, `{"param": "<name>"}` is accepted too
  (filter values, `in` lists, `date_diff` anchors, `case` WHEN values). `/rows`, `/aggregate`,
  `/totals`, `/export` accept `params: {name: value}`.
- **Resolution:** request value → dashboard saved value → `default` (`today` resolved in a
  configured time zone) → error `422 param_unbound`. Values type-checked.
- **Builder:** a parameter bar on the dashboard, viewer values in the URL (`?p.as_of=2026-10-12`),
  saving requires edit mode.
- **Tests:** precedence order (4 cases); type mismatch 422; unbound 422; URL round trip.

## 3.8 Metadata triple anchor

|          |                                                                                      |
| -------- | ------------------------------------------------------------------------------------ |
| Track    | 1                                                                                    |
| Flow     | DCFBI                                                                                |
| Evidence | a note written for one period must not sit unmarked next to another period's numbers |

- **Contract:** `MetadataEntry.anchor {definitionVersion?, dataVersions?: {id: n}, runId?, params?}`
  stamped **by the server** at write time from the target's current state (plus `params` supplied by
  the writer). `GET /metadata/...?params=...` returns `state: current | refreshed | other_period |
other_definition` per entry.
- **Rules:** different `definitionVersion` → `other_definition`; different `params` →
  `other_period`; only `dataVersions` moved → `refreshed`.
- **Builder:** `other_*` entries render collapsed: "Written for <params, v<n>>, viewing <…>";
  `refreshed` shows a small flag.
- **Tests:** each state; anchor ignores client-sent versions.

---

## rc.3 exit gate

- [ ] 3.1–3.8 rounds `Complete`
- [ ] Dual-run against rc.2 on a real dogfood export: rows of every saved query identical cell for
      cell, except changes a round declared
- [ ] Deleting a workflow source marks the workflow `source_missing` (W-7)
- [ ] A saved copy is read-only; deleting its workspace while it has data returns 409
- [ ] An annotation written for another period renders collapsed
- [ ] Migrations 0006–0007 downgrade cleanly
- [ ] `workflow-earns-its-place` closed or its remaining rows re-homed
