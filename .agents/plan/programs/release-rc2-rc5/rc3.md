# rc.3 — definitions over numbers

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Branch: `release/v0.0.1-rc.3`, cut from
the rc.2 head `6c679c5` and opened **before** the rc.2 tag on the owner's call (decision 12).
Batch 1 (3.1, most of 3.2, 3.3) is built as R184–R187; **stop for review + gate G-wf before 3.6**.

**Why this rc is the careful one:** typed parameters, version stamps and the triple anchor are
**one-way doors** — once dashboards and external writers depend on their shape, changing it breaks
them. Borrow shapes that already work elsewhere: parameter precedence and URL-held viewer values
(as in established BI tools), and the run / job version / dataset version split from OpenLineage.
The version shapes are now partly fixed by what shipped (decision 14).

**Order (dependencies drive it):**

```text
done   3.1 compute (R184)
done   3.2a dataset dataVersion + refreshedAt (R185) ── 3.3 W-2/W-3/W-5 (R186) ── 3.2b + W-4/W-7 run stamps (R187)
gate   G-wf (owner) ──────────────────────────────────────────────────────────────┐
next   3.4 multi-file refresh ─> 3.5 replace_period ─> 3.6 publish + saved copies <┘
then   2.7 design (params, date range, shared filters) ─> 3.7 typed parameters
       ─> 3.2c remaining stamps on read paths ─> 3.8 metadata triple anchor
```

Labels from `Round_175 § Feeds into`: **R177** = 3.1, **R178–R179** = 3.4–3.5, **R180** = 3.6. They
are names; real round numbers are assigned when a round opens (next free: `Round_188`).

Gate commands as in [rc2.md](rc2.md); counts at the batch-1 head `a682f14`: backend 565 · builder
444 · contracts 46. Dogfood dual-run rc.2 → rc.3 batch 1: 119 / 119 identical; migrations
0004 → 0007 clean on a real-database copy (`Round_187` § Do).

---

## 3.1 `compute` step + closed function catalog — `Round_184`

|          |                                                                                             |
| -------- | ------------------------------------------------------------------------------------------- |
| Status   | review — walk W1–W3 pending                                                                 |
| Evidence | text values that differ only by edge spaces group as two (R175); fork (B) locked 2026-10-04 |

- **As built:** `ComputeStep {kind: compute, name, fn, col}` in `_shared/query.yaml` (mirrored in
  `workflow.yaml`), `fn` an enum = the closed, append-only catalog, today `trim` only (decision 13).
  `trim` strips edge whitespace **including U+00A0**, needs a string column, outputs string, a cell of
  only spaces becomes NULL; the result is a **new** column, the source is untouched. Runs in queries
  and workflows (shared `Step` union) as one DuckDB `regexp_replace` with quoted identifiers. 422s:
  `column_exists`, `unknown_function`, `unknown_column`, `wrong_dtype`. Builder card "Clean text" in
  the "Add a column" group; MSW mirrors the semantics.
- **Not built (deliberately, by "default = don't add"):** namespaced ids (`core.trim`), a
  `GET /compute/catalog` endpoint, a registry with per-entry arg schemas, a separate decision
  artifact. Each becomes worth building only when a second function arrives; record that in the
  round that adds it.

## 3.2 Version stamps — partial

|          |                                                                                     |
| -------- | ----------------------------------------------------------------------------------- |
| Evidence | `updated_at` is absent product-wide (R168, R174); W-4 cannot be detected without it |

**3.2a — dataset data identity, `Round_185` (review).** `Dataset.refreshedAt` + `Dataset.dataVersion`
(1 at commit, +1 on every successful refresh — replace, merge, append — in the same UPDATE that
swaps the rows in); read-only; rename, column visibility and a failed refresh leave both alone.
Migration `0006_dataset_data_version` (backfill `refreshedAt = createdAt`, every dataset v1). Shown
as "Data version · vN · when" on the dataset page.

**3.2b — workflow run stamp, `Round_187` (review).** `Workflow.run {id: run_<8 hex>, number,
definitionHash, sources[]}` — per source what the run read: a query's `definitionHash` + the
`dataVersion` of every dataset it reads, or a workflow source's `runId`. Migration
`0007_workflow_runs`. `definitionHash` is the same value metadata records as `definitionVersion`.

**3.2c — Remaining (one round, after 3.7, before 3.8):**

- `dataVersions: {<datasetId>: n}` on the `/rows`, `/aggregate`, `/totals` responses and in the
  export's Filters sheet (with the parameters from 3.7) — the "which data did I see" half of the
  anchor.
- `updatedAt` on query, dashboard, workflow (last definition change) — only if 3.8 or 4.4 needs it;
  otherwise log and skip.
- Not planned unless evidence appears: `dataHash` (content hash), an integer `definitionVersion`
  (decision 14 fixed the hash form).
- **Tests:** each read path reports the versions of exactly the datasets it read (join included);
  export sheet carries them.

## 3.3 Workflow repairs — `Round_186` + `Round_187`

|          |                                                                  |
| -------- | ---------------------------------------------------------------- |
| Status   | review — walks pending; evidence for G-wf assembled              |
| Evidence | `Round_174 § Do`; program `workflow-earns-its-place` (items 2–4) |

- **As built (R186):** save (create and edit) refuses in the 422 validation envelope, `loc` ending at
  the source index, `msg` led by the code:
  - **W-5** `unresolved_source` — a source that does not resolve now (a workflow source must have
    been run);
  - **W-3** `duplicate_source` — a source listed twice (it can only double every row); with ≥ 2
    sources every row carries a final string column **`Source.Query`** (the source's name; suffixed
    off a collision) so a stacked total can be split — chosen over a hidden `Source.Name`, which
    names files, not sources;
  - **W-2** `sources_diverge` — same column names (any order), equal dtypes, integer + float widen
    to float — "enforce", not widen.
  - Shapes that diverge after save → 409 `query_stale` at run, last output kept. A one-source
    workflow's output is unchanged. Builder lifts the 422 into one sentence naming the source.
- **As built (R185 + R187):** **W-4 / W-7** — on every read, the run stamp is compared with the
  database now and `staleSources: [{sourceId, name?, reason}]` names each source that moved:
  `source_missing`, `definition_changed`, `data_refreshed`, `source_rerun`. A flag, never a block —
  the output stays readable (an archive); a re-run clears it. The page shows "Run #N" and a warning.
  (Shape differs from the first draft's `freshness` enum: a list says _which_ source and _why_.)
- **Declined:** a warning when two sources read the same dataset (flags legitimate comparisons more
  often than mistakes).

### Gate G-wf — before 3.6 opens

Double-count, shape divergence and source change are all caught; `dataVersion` / `run` written by
the server only. Evidence table: `Round_187` § G-wf (two close-out tests added 2026-10-17: a
joined-in dataset refreshed, the source dataset deleted). **Agent recommends pass; the owner's
call**, together with [walk pack](walk-rc2-rc3a.md) session B.

## 3.4 Refresh with several files at once (label R178) — next

|          |                                                                        |
| -------- | ---------------------------------------------------------------------- |
| Track    | 1                                                                      |
| Flow     | DCFBI                                                                  |
| Evidence | monthly exports arrive as several files that together form one refresh |

- **Contract:** a refresh item (`POST /workspaces/{id}/datasets/batch` with `target_dataset_id`)
  accepts several uploads (1–20) instead of one `temp_id` — exact field name settled at the Contract
  gate; files are stacked (every file must have the same columns; a mismatch names the file), then
  the chosen `refresh_mode` applies to the stack.
- **Backend:** stack in staging, then the existing staging → commit swap (`routers/datasets.py`);
  **one** `dataVersion` bump and one `refreshedAt` for the whole refresh (R185); coverage re-profiled
  once (R178); provenance `Source.Name` per row = its own file (R156).
- **Tests:** two files stacked = one refresh, version +1; one bad file fails the whole refresh with
  nothing committed and the version unchanged; mismatch 422 names the file; a workflow over the
  dataset reads `data_refreshed` afterwards (R187).
- **Walk:** refresh a dataset with two monthly files; the row count is their sum, the version moved
  once.

## 3.5 `replace_period` refresh mode (label R179)

|          |                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------ |
| Track    | 1                                                                                                |
| Flow     | DCFBI                                                                                            |
| Evidence | a weekly export re-covers the last N days; rows in that window must be replaced, older rows kept |

- **Contract:** `refresh_mode += replace_period`, with `periodColumn` (date / datetime). The period
  = `[min, max]` of `periodColumn` in the incoming file(s), inclusive. Remembered in the refresh
  settings like `merge_key` (R147).
- **Semantics:** committed rows inside the period are deleted; incoming rows inserted; committed rows
  outside kept. Response reports `{replacedFrom, replacedTo, removedRows, insertedRows}` (a fourth
  201 shape beside replace / merge / append).
- **Guards:** period column missing on either side or not a date → 422; incoming rows with a null
  period → 422 (no silent drop). The append-overlap advisory (R155) suggests this mode when it fires.
- **Tests:** overlap window replaced; rows before the window kept; a gap inside the window removes
  committed rows there (documented — that is what "replace the period" means); null period 422;
  version +1 once.

## 3.6 Publish a derived dataset + saved copies (label R180) — only after G-wf

|          |                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                                                           |
| Flow     | **DFCFBI** recommended — run `flow-selector`                                                                                                |
| Evidence | Workflow item 1 ruled (a′); a dashboard needs to read a workflow's result (W-1); "what numbers was a decision based on" needs a frozen copy |

- **Publish:** `POST /workflows/{id}/publish` → creates or updates a dataset whose lineage MDD writes
  itself: `{workflowId, runId, runNumber, definitionHash, sources}` copied from the run stamp (R187).
  Queries and widgets read it like any dataset; re-publish bumps its `dataVersion`. Refuse with 409
  when the workflow was never run or `staleSources` is non-empty (reasons in the body).
- **Saved copies (decision 8):** `POST /workspaces/{id}/saved-copies {label}` copies chosen datasets
  (parquet copied, immutable) into `<workspace>-saved` (created on first use, one per main
  workspace). Names `<name> @<label>`; a second save with the same label → `v2`. Everything in a
  saved workspace is read-only (writes → `409 read_only_workspace`): no refresh, no re-run. A band on
  every saved item: "Frozen at run #N on <date> — not the current numbers". Deleting a workspace
  that still holds data stays `409 non_empty`. Metadata on a saved item never shows "may be out of
  date".
- **Migration** (next free, `0008_…`): `datasets.lineage_json`, `workspaces.kind (main | saved)`;
  `datasets.source_format` gains `workflow` — SQLite needs a table rebuild for the CHECK (pattern:
  `0004`); parity test updated.
- **Tests:** publish twice → two dataset versions, lineage = the right run; a stale workflow refuses
  publish; a saved copy is immune to a later refresh of the original; write to a saved workspace 409;
  deleting the saved workspace while it has data 409.
- **Walk:** build a workflow, publish, put a widget on it, save a copy labelled with a week, refresh
  the source, confirm the copy did not change and carries the band.

## 2.7 Design only — parameter model, view-time date range, shared filters _(moved from rc.2)_

|        |                                                                                  |
| ------ | -------------------------------------------------------------------------------- |
| Track  | 1                                                                                |
| Flow   | Design gate only (no C/F/B/I)                                                    |
| Output | `.agents/design/dashboards/dashboard-filters.md`, consumed by 3.7, 3.8, 4.2, 4.3 |

- **Decide in the design doc:**
  1. Parameter model (decision 7): typed values `{"param": "<name>"}` placed where a constant goes;
     precedence **viewer (URL) → dashboard saved value → parameter default → value saved in the
     query**; `default: today` resolved in a configured time zone; values never written into a
     query's definition.
  2. Where parameters reach: filter values, `in` lists, column-vs-column anchors, `case` WHEN
     values; whether a workflow run takes parameters (and records them in its stamp).
  3. Shared filter: dashboard-level, editor chooses which widgets it reaches, saved with the
     dashboard, viewer changes live in the URL only, each widget shows whether a filter reached it.
  4. A filtered column missing from a widget's query: skip + badge, never an error.
  5. How totals (2.3) and export (2.4) record active parameters and shared filters; how a cohort that
     cannot yet be observed for its full window is flagged (input to 4.5).
- **Done when:** design gate criteria met (journeys + testable acceptance criteria), `ux-design`
  design-spec mode run and logged.

## 3.7 Typed parameters

|          |                                                                             |
| -------- | --------------------------------------------------------------------------- |
| Track    | 1                                                                           |
| Flow     | DCFBI (design from 2.7); may take two rounds (engine, then dashboard bar)   |
| Evidence | the same report is re-read for a different period without rewriting queries |

- **Contract** (`_shared/query.yaml`): `QueryDefinition.params: [{name, type: date | number |
string, default?}]`; wherever a literal operand is accepted, `{"param": "<name>"}` is accepted too
  (per 2.7). `/rows`, `/aggregate`, `/totals`, `/export` accept `params: {name: value}`.
- **Resolution:** per 2.7's precedence → else `422 param_unbound` naming the parameter. Values
  type-checked at save (declared type) and at read (supplied value).
- **Builder:** a parameter bar on the dashboard, viewer values in the URL (`?p.as_of=2026-10-12`),
  saving a value requires edit mode.
- **Tests:** precedence order (4 cases); type mismatch 422; unbound 422 names it; URL round trip;
  same query with two `as_of` values → different numbers and an unchanged `definitionHash`; a query
  without parameters returns exactly what it did in rc.2.

## 3.8 Metadata triple anchor

|          |                                                                                      |
| -------- | ------------------------------------------------------------------------------------ |
| Track    | 1                                                                                    |
| Flow     | DCFBI                                                                                |
| Evidence | a note written for one period must not sit unmarked next to another period's numbers |

- **Contract:** `MetadataEntry.anchor {definitionVersion, dataVersions?: {id: n}, runId?, params?}`
  stamped **by the server** at write time from the target's current state (R185 / R187 / 3.2c) plus
  the `params` the writer read under. `GET /metadata/...?params=...` returns per entry `state:
current | refreshed | other_period | other_definition`. Entries written in rc.2 (definition
  version only) keep rendering correctly.
- **Rules:** different definition → `other_definition`; different `params` → `other_period`; only
  data versions / run moved → `refreshed`; entries on saved copies (3.6) are always `current`.
- **Builder:** `other_*` render collapsed — "Written for <params, definition>, viewing <…>", click to
  open (definition change adds a warning); `refreshed` shows a small flag; widget footer "Data:
  refreshed <date> · run #N".
- **Also (pulled from the rolling log):** delete a noun → its metadata entries go with it (or a
  sweep), so an entry never outlives its target.
- **Tests:** one per state; the anchor ignores client-sent versions; rc.2 entries unchanged; noun
  delete removes entries.

---

## rc.3 exit gate

- [ ] 3.1–3.8 and 2.7 rounds `Complete`, walks logged (no round closes without its walk)
- [ ] G-wf recorded as passed before 3.6 opened
- [ ] Dual-run against rc.2 on a real dogfood export: every saved query identical cell for cell,
      except changes a round declared (batch 1: 119 / 119 ✓)
- [ ] Deleting a workflow source marks the workflow `source_missing` (W-7) — built in R187, walk pending
- [ ] A saved copy is read-only; deleting its workspace while it has data returns 409
- [ ] An annotation written for another period renders collapsed
- [ ] Visual gate for a parameterised dashboard in light and dark themes
- [ ] Migrations 0006 → latest downgrade cleanly on a real-database copy
- [ ] Repo boundary scan clean; release note lists every contract addition
- [ ] `workflow-earns-its-place` closed or its remaining rows re-homed
