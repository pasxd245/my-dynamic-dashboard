# rc.3 — definitions over numbers

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Branch: `release/v0.0.1-rc.3`, cut from
the rc.2 head `6c679c5` and opened **before** the rc.2 tag on the owner's call (decision 12).
Built and walked: 3.1, most of 3.2, 3.3 (R184–R187), 3.4 (R188), 3.5 (R189) — all `Complete`
2026-10-18; 2.7 designed (R190, D1–D7 accepted 2026-10-18). **G-wf confirmed 2026-10-18 → 3.6 is
open.** Execution of the rest: § Execution (four-role loop) below.

**Why this rc is the careful one:** typed parameters, version stamps and the triple anchor are
**one-way doors** — once dashboards and external writers depend on their shape, changing it breaks
them. Borrow shapes that already work elsewhere: parameter precedence and URL-held viewer values
(as in established BI tools), and the run / job version / dataset version split from OpenLineage.
The version shapes are now partly fixed by what shipped (decision 14).

**Order (dependencies drive it):**

```text
done   3.1 compute (R184)
done   3.2a dataset dataVersion + refreshedAt (R185) ── 3.3 W-2/W-3/W-5 (R186) ── 3.2b + W-4/W-7 run stamps (R187)
passed G-wf (owner, confirmed after walk B 2026-10-18) ─────────────────────────────┐
done   3.4 multi-file refresh (R188) ── 3.5 replace_period (R189)
done   2.7 design: params, date range, shared filters (R190 — D1–D7 accepted 2026-10-18)
built  fix round for the rolling log's small findings (R191)
built  3.6a publish (R192) ─> 3.6b saved copies (R193) <───────────────────────────────┘
built  3.7a parameter engine (R194) ─> 3.7b builder (R195) ─> 3.2c read-path stamps (R196)
built  ─> 3.8 metadata triple anchor (R197)
now    rc.3 exit gate — owner walks (walk-rc3b.md), Complete flips, dual-run, tag
```

Labels from `Round_175 § Feeds into`: **R177** = 3.1, **R178–R179** = 3.4–3.5, **R180** = 3.6. They
are names; real round numbers are assigned when a round opens (next free: `Round_191`).

Gate commands as in [rc2.md](rc2.md); counts at the batch-1 head `a682f14`: backend 565 · builder
444 · contracts 46; at `45cae9f` (R189): backend 580 · builder 461 · contracts 46. Dogfood dual-run rc.2 → rc.3 batch 1: 119 / 119 identical; migrations
0004 → 0007 clean on a real-database copy (`Round_187` § Do).

## Execution — the four-role loop (from 2026-10-18)

_Track: 2. Pulled by: the owner's 2026-10-18 call to run the rest of rc.3 with a coding, a
code-review, a BA and a QA agent. Counters two named failure modes: claiming done without
verifying (the coder grading its own work) and building past the brief (a one-way-door contract
drifting from the accepted design). Prune it if two rounds pass with no finding from the
reviewers._

| Round | Item                                      | Flow   | Migration | UI  |
| ----- | ----------------------------------------- | ------ | --------- | --- |
| R191  | fix round — rolling-log small findings    | DCFBI  | —         | yes |
| R192  | 3.6a publish a workflow output (lineage)  | DCFBI  | `0008`    | yes |
| R193  | 3.6b saved copies (read-only workspace)   | DFCFBI | `0009`    | yes |
| R194  | 3.7a parameter engine                     | DCFBI  | —         | no  |
| R195  | 3.7b parameters in the builder            | DCFBI  | —         | yes |
| R196  | 3.2c data versions on read paths + export | DCFBI  | —         | no  |
| R197  | 3.8 metadata triple anchor + cascade      | DCFBI  | `0010`    | yes |

Then the rc.3 exit gate: release note ([`CHANGELOG.md`](../../../../CHANGELOG.md) § rc.3), gate
checklist (below), walk pack for R191–R197 ([walk-rc3b.md](walk-rc3b.md)). All seven rounds are
built and reviewed with no open P0/P1 (2026-10-18); each awaits its walk. _(3.6 split into
3.6a / 3.6b on 2026-10-18 — two features, two migrations; one feature per round.)_

**Roles per round** (the coder is the main session; the three others are fresh sub-agents that
see only the repo and the round file, never the coder's reasoning):

1. **Coding agent** — opens `Round_NN.md` from the item spec, runs `flow-selector`, then D → C →
   B → F gates, committing per gate (`<type>(R<NN>): …`), each gate's commands green before the
   next.
2. **BA agent** (business review) — twice: at **Contract exit** (before B) it reviews the spec,
   design and contract diff for business fit — the second-user test, the settled decisions 1–14,
   the firewall (nothing from the next rc), the accepted design's D-points, no user data or names
   (M3 words); after **F** it reviews the built behaviour against the acceptance criteria and
   writes the walk script.
3. **Code-review agent** — after F, on `git diff <round base>..HEAD`: correctness, SQL identifier
   quoting and injection, file paths (parquet copies), migration both ways, contract ↔ backend ↔
   MSW ↔ types parity, error envelopes, test quality.
4. **QA agent** — after F, in parallel with the review: re-runs every gate command from a clean
   state, migrations `upgrade head → downgrade -1 → upgrade head` on a seeded database, writes
   adversarial tests for the acceptance criteria (kept only when they pass on the fixed code), and
   the visual gate in a headless browser, light and dark, for UI rounds.

Findings are graded **P0** (wrong numbers, data loss, security, contract off the accepted design)
· **P1** (a criterion unmet, a broken state) · **P2** (copy, polish, debt). P0 and P1 are fixed in
the round and re-reviewed by the agent that raised them; P2 go to the rolling log. The round
moves to `Review` only when every reviewer reports no open P0/P1. Each round ends with a bundle
(`.archive/_transfer/` → sha256 → `99_git_bundles/`).

**Hard stops** (the run halts and reports): a gate that stays red after one fix attempt; a P0 the
round cannot fix inside its item; any change to an accepted shape (design D1–D7, decisions 1–14);
an M3 word or a file under `workspace/apps/backend/data/`; a migration that does not downgrade.
**The owner's steps stay the owner's:** walks, `Complete` flips, the dogfood dual-run on the real
export (data never leaves the owner's machine), push and tags.

---

## 3.1 `compute` step + closed function catalog — `Round_184`

|          |                                                                                             |
| -------- | ------------------------------------------------------------------------------------------- |
| Status   | **done** — `Complete` 2026-10-18 (walk 3 of 3)                                              |
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

**3.2a — dataset data identity, `Round_185` (complete).** `Dataset.refreshedAt` + `Dataset.dataVersion`
(1 at commit, +1 on every successful refresh — replace, merge, append — in the same UPDATE that
swaps the rows in); read-only; rename, column visibility and a failed refresh leave both alone.
Migration `0006_dataset_data_version` (backfill `refreshedAt = createdAt`, every dataset v1). Shown
as "Data version · vN · when" on the dataset page.

**3.2b — workflow run stamp, `Round_187` (complete).** `Workflow.run {id: run_<8 hex>, number,
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
| Status   | **done** — `Complete` 2026-10-18; G-wf confirmed                 |
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
joined-in dataset refreshed, the source dataset deleted). **Accepted by the owner on 2026-10-17**
on the agent's recommendation; **confirmed 2026-10-18** after [walk pack](walk-rc2-rc3a.md) session B
(14 of 14 passed). 3.6 is open.

## 3.4 Refresh with several files at once (label R178) — `Round_188`

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
- **As built (R188, complete):** `extra_temp_ids` (1–19) beside `temp_id` on the batch request,
  refresh-only (422 on a create); the first file's settings and committed dtypes apply to every
  file; other columns → 422 naming the file; a value that does not fit → `coercion_failed` with the
  new optional `file`; parts stacked by file index + in-file row number (`stack_parquets`); one
  version bump; Confirm-step "More files in this refresh" block. A key repeated across files under
  merge → `merge_duplicate_keys`.

## 3.5 `replace_period` refresh mode (label R179) — `Round_189`

|          |                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------ |
| Track    | 1                                                                                                |
| Flow     | DCFBI                                                                                            |
| Evidence | a weekly export re-covers the last N days; rows in that window must be replaced, older rows kept |

- **Contract:** `refresh_mode += replace_period`, with `periodColumn` (date / datetime). The period
  = `[min, max]` of `periodColumn` in the incoming file(s) — the whole stack when 3.4's several files
  arrive — inclusive. Remembered in the refresh
  settings like `merge_key` (R147).
- **Semantics:** committed rows inside the period are deleted; incoming rows inserted; committed rows
  outside kept. Response reports `{replacedFrom, replacedTo, removedRows, insertedRows}` (a fourth
  201 shape beside replace / merge / append).
- **Guards:** period column missing on either side or not a date → 422; incoming rows with a null
  period → 422 (no silent drop). The append-overlap advisory (R155) suggests this mode when it fires.
- **Tests:** overlap window replaced; rows before the window kept; a gap inside the window removes
  committed rows there (documented — that is what "replace the period" means); null period 422;
  version +1 once.
- **As built (R189, complete):** item fields `refresh_mode: replace_period` + `period_column` (snake
  case, like `merge_key`); 201 shape 4 `{datasets, period: {column, from, to, removed, inserted,
kept}}` (named like the merge / append reports, with `kept` so it sums to the row count) instead of
  the sketched `replacedFrom…insertedRows`; committed rows with no period value are kept; an empty
  incoming stack replaces nothing. Confirm-step "Replace a period" with a date-column picker (a date
  on both sides; commit disabled until picked); append's overlap warning offers "Replace this period
  instead". Remembered as `commitSettings.period_column`.

## 3.6 Publish a derived dataset + saved copies (label R180) — G-wf passed

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

> **3.6 as built (2026-10-18).** Split into **3.6a** publish (`Round_192`, migration `0008`) and
> **3.6b** saved copies (`Round_193`, migration `0009`). 3.6b deviates from the sketch above: the body
> is `{label, datasetIds}`; a copy keeps the original's `dataVersion` and `refreshedAt` (one version
> for one set of rows) and carries `savedFrom`; deleting a copy and the empty saved workspace are
> allowed; a main workspace with a saved workspace cannot be deleted. Design:
> [`workspaces/saved-copies.md`](../../../design/data-management/workspaces/saved-copies.md).

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
- **As built (R190 — design only, accepted 2026-10-18):**
  [`dashboards/dashboard-filters.md`](../../../design/dashboards/dashboard-filters.md) (Accepted 2026-10-18).
  Scalar typed params with a server-resolved relative `today` (`backend.time_zone`). Allowed only in
  filter operands. Three precedence levels (viewer → dashboard saved → query default) then
  `422 param_unbound`; the program's "parameter default" and "value saved in the query" are one
  field. Every read echoes `resolvedParams`. Dashboard `controls` (`param` / `date_range` /
  `values`) carry editor-picked targets; viewer values live in the URL (`p.*`, `f.*`). A control
  that cannot apply is skipped and badged. Workflow sources run on defaults and the stamp records
  them. Totals and export record what was applied. Criteria 1–10 are each tagged with the round
  that builds them. **Waits for the owner's decisions D1–D7.**

## 3.7 Typed parameters

|          |                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                                 |
| Flow     | DCFBI, two rounds: **3.7a** engine (contract + backend + MSW), **3.7b** builder (query page + dashboard bar)      |
| Design   | [`dashboards/dashboard-filters.md`](../../../design/dashboards/dashboard-filters.md) — D1–D7, Accepted 2026-10-18 |
| Evidence | the same report is re-read for a different period without rewriting queries                                       |

_Re-based on the accepted design 2026-10-18; the design doc wins where this summary is shorter._

**3.7a — engine.**

- **Contract** (`_shared/query.yaml`): `QueryDefinition.params: [{name, type: date | number |
string, label?, default?}]`, ≤ 8, name `^[a-z][a-z0-9_]{0,31}$`; a date default may be
  `{"kind": "today", "offsetDays": n}` (−366…366). `{"param": "<name>"}` is accepted **only** in
  the D2 places: filter atom `val` / `min` / `max`, one item of `vals`, filter-step predicates,
  `case` WHEN predicates — never `refCol`, never an output constant, never in a workflow step.
- **Resolution (D3):** request value → dashboard saved value → query default → `422
param_unbound`; a wrong-typed value → `422 param_invalid`. `GET /rows` takes `p.<name>=`; `POST
/aggregate`, `/totals`, `/export` take `params: {}` beside `filters`. A read that resolved any
  parameter answers `resolvedParams: {name: {value, source}}`; a query without params answers
  exactly as in rc.2. An undeclared `params` entry is ignored.
- **Config:** `backend.time_zone` (IANA, default `UTC`) resolves `today`.
- **Save checks (D1):** undeclared name, type vs column family, a reference on a no-operand
  operator, a reference outside D2 → 422 naming the field; a workflow step with a reference → 422.
- **Workflows (D6):** sources run on defaults only; no default → the run refuses, naming source
  and parameter; the run stamp gains `sources[].params`.
- **What leaves the app (D7, this part):** totals echo `resolvedParams`; the XLSX Filters sheet
  gains a `Parameters` block (`name | value | source`); CSV gets `X-MDD-Params` (CORS-exposed).
- **Tests:** design criteria 1–4, 7 (params part) and 8.

**3.7b — builder.**

- Query page: a **Parameters** panel (declare name, type, label, default; "today ± n days" for
  dates) and a **Use parameter** switch on every D2-allowed value field; preview asks for values
  without a default; chips read `as_of (parameter)`.
- Dashboard: `DashboardDefinition.controls` with `kind: param` only (≤ 12; `date_range` is 4.2,
  `values` is 4.3); a bar above the grid; viewer values in the URL (`?p.<name>=`), **Reset to
  saved**, **Copy link**; saving a value only in edit mode; `FilterReachBadge` on each card lists
  the parameters that reached it and the ones skipped with the reason (D5). MSW mirrors.
- **Tests:** design criterion 5 (FE), the D5 skip-and-badge case, URL round trip; visual gate in
  light and dark (rc.3 exit gate line).

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

Status 2026-10-18 (agent): everything an agent can verify is green; the open lines need the owner.

- [ ] 3.1–3.8 and 2.7 rounds `Complete`, walks logged (no round closes without its walk) —
      R184–R190 `Complete`; **R191–R197 built, reviewed, in Review** — walk pack
      [walk-rc3b.md](walk-rc3b.md) (Sessions D–F, 44 items, about 2 h 15 min)
- [x] G-wf recorded as passed before 3.6 opened (confirmed 2026-10-18, `Round_187` § Act)
- [ ] Dual-run against rc.2 on a real dogfood export: every saved query identical cell for cell,
      except changes a round declared (batch 1: 119 / 119 ✓) — **owner**, batch 2 after the walks
- [x] Deleting a workflow source marks the workflow `source_missing` (W-7) — built in R187, walked B13
- [ ] A saved copy is read-only; deleting its workspace while it has data returns 409 — built R193
      (pytest `test_saved_copies.py`); walk D20–D25
- [ ] An annotation written for another period renders collapsed — built R197 (pytest + vitest; QA
      live run PASS); walk F8
- [ ] Visual gate for a parameterised dashboard in light and dark themes — light PASS (R195, R197
      QA, EN + VI); **dark N/A: the app has no dark theme — owner to confirm N/A or schedule one**
- [ ] Migrations 0006 → latest downgrade cleanly on a real-database copy — on a populated fake DB
      head → `0005` → head keeps every row (2026-10-18, agent); **owner: the real-database copy**
- [x] Repo boundary scan clean; release note lists every contract addition — no customer name in
      the tree (one test fixture neutralised, 2026-10-18); `CHANGELOG.md` § rc.3
- [x] `workflow-earns-its-place` closed or its remaining rows re-homed — W-1 built (R192), W-6
      re-homed to the parked naming theme; the program closes with R192's walk
