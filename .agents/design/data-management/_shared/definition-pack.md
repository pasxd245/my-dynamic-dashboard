# Definition pack — export a workspace's definitions, import them by name

**Concept**: a workspace's analysis lives in three kinds of **definitions** — queries, dashboards
and workflows — and every one of them points at the others and at datasets **by id** (`ds_`, `qr_`,
`wf_`), and ids are minted per install. A **definition pack** is the same definitions written
**by name**: one JSON file, `packVersion: 1`, that names the datasets it needs (with their columns)
and carries each query, workflow and dashboard with every cross-reference spelled as a name. A pack
is **exported** from one workspace and **imported** into another — in the same install or another
one. The import finds the named datasets in the target workspace (data never travels in a pack),
plans what it would do per noun (create, replace, leave unchanged, skip), and — after a dry run
that writes nothing — writes the whole pack or nothing, each noun through its ordinary create or
update. A pack is a **transport format, not a stored noun**: nothing in the database records that
a noun came from a pack.

**Status**: Draft (R201 design)
**Round introduced**: [`Round_201`](../../../plan/cycles/Round_201.md) — item 4.8,
[rc4.md § 4.8](../../../plan/programs/release-rc2-rc5/rc4.md).
**Domain folder**: `data-management/_shared/` — the pack spans the query, workflow and dashboard
nouns (beside [definition-history.md](definition-history.md)); its two actions are mounted on the
workspace card ([workspaces/workspaces.md](../workspaces/workspaces.md)), the workspace being the
unit a pack is cut from and applied to. The builder code lives in
`apps/builder/src/features/data-management/workspaces/definitionPack/`.

**Sibling docs**: [definition-history.md](definition-history.md) (an import writes history rows
through the normal write path; a replaced definition stays restorable),
[`../_noun-model.md`](../_noun-model.md) (ids, names, the definition hash),
[metadata.md](metadata.md) (writer tokens; notes stay out of the pack),
[queries/queries.md](../queries/queries.md), [workflows/workflows.md](../workflows/workflows.md),
[../../dashboards/dashboard-filters.md](../../dashboards/dashboard-filters.md) (control ids).

> **Why by name.** Within a workspace a dataset's, query's, dashboard's and workflow's name is
> already unique per kind (the `*_name_unique` indexes) and is what a person sees and types. An id
> is unique too, but it is minted per install, so a script or a file holding ids works against
> one install only. Names are the keys a second install shares with the first.
>
> **Why the dataset's columns travel with its name.** A query's filters address their column by
> **0-based index** into the source's columns (the R200 BA-C2 fragility). A same-named dataset
> whose columns sit in another order would let an imported query validate and read the wrong
> column. So the pack records each needed dataset's columns (`name`, `dtype`, in order) and the
> import refuses a dataset whose columns differ — a precise refusal instead of silently wrong
> numbers.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                         | Layer                                                                                       | Reusability  | Purity             | Allowed peer deps                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------- |
| `ImportDefinitionsModal` (file → plan → import)                                                 | `apps/builder/src/features/data-management/workspaces/definitionPack/ImportDefinitionsModal.tsx` | feature      | feature            | react, antd, @ant-design/icons, react-i18next |
| `useExportDefinitions` (download + toast + refusal modal)                                       | `apps/builder/src/features/data-management/workspaces/definitionPack/useExportDefinitions.tsx`   | feature      | glue (server-data) | antd, react-i18next                           |
| `readPackText` · `packFileName` · `packCounts` · `columnDifference` · `writeCount` · `canImport` · `nothingToImport` (pure rules); `downloadPack` | `apps/builder/src/features/data-management/workspaces/definitionPack/plan.ts` | feature | pure | none |
| `useImportPlanMutation` · `useApplyPackMutation` (`IMPORT_INVALIDATES` after apply) · `useExportPackMutation` | `apps/builder/src/features/data-management/workspaces/definitionPack/hooks.ts` | feature | glue (server-data) | @tanstack/react-query |
| `definitionsApi.export` / `.importPack`                                                         | `apps/builder/src/api/definitionsApi.ts`                                                    | builder-only | glue               | (fetch — no extra peer dep)                   |
| `DefinitionPack` / `ImportPlan` / `PlanItem` / `PlanDataset` types                              | `apps/builder/src/features/data-management/workspaces/definitionPack/types.ts`                   | feature      | data type          | none                                          |
| `GET /workspaces/{id}/definitions` · `POST /workspaces/{id}/definitions/import`                 | `apps/backend/app/routers/definitions.py`                                                   | backend      | feature            | (FastAPI — backend native)                    |
| `export_pack` · `plan_and_apply` (names ↔ ids, the plan, one transaction)                       | `apps/backend/app/definition_pack.py`                                                       | backend      | feature            | (stdlib `sqlite3`)                            |
| `write_query` · `write_workflow` · `write_dashboard` (the create / update bodies, on a connection) | `apps/backend/app/routers/{queries,workflows,dashboards}.py` (extracted from the routes)   | backend      | feature            | (stdlib `sqlite3`)                            |

**Boundary check**: no row lives in `@mdd/ui`. The import modal carries pack-specific copy and
plan rules, so it is feature code under the workspace feature that mounts it. **No parallel
writer**: each route's create / update body (validation, the `INSERT` / `UPDATE`, the R200 history
row, the R197 / R200 metadata sweep and unsweep, a workflow's output clear) moves into a function
that takes the caller's connection and does not commit; the six routes call it and commit, and the
import calls the same functions inside its one transaction.

---

## Token map

All surfaces are AntD primitives (`<Modal>`, `<Upload.Dragger>`, `<Radio.Group>`, `<Table>`,
`<Tag>`, `<Alert>`, `<Typography>`, `<Button>`, `<Dropdown>` menu items) styled by the
`<ConfigProvider>` tokens derived from the seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts). **No new token is
introduced.** `Value` is informational.

| Surface                                          | AntD token (themeTokens.ts)                                   | Value (informational) |
| ------------------------------------------------ | ------------------------------------------------------------- | --------------------- |
| Modal background                                 | `colorBgElevated`                                             | derived               |
| Drop zone border / hover                         | `colorBorder` / `colorPrimary`                                | derived / `#1677ff`   |
| _New_ tag                                        | `colorSuccess` (AntD `success` preset)                        | derived               |
| _Replace_ tag                                    | `colorWarning` (AntD `warning` preset)                        | derived               |
| _Unchanged_ / _Skip_ tags                        | `colorFillQuaternary` (default `<Tag>`)                       | derived               |
| _Conflict_ / _Can't import_ tags, missing dataset | `colorError` (AntD `error` preset)                           | derived               |
| Summary line, reasons, column lists              | `colorTextSecondary`                                          | derived               |
| Import button                                    | `colorPrimary`                                                | `#1677ff`             |
| Border radius (tags, drop zone)                  | `borderRadius`                                                | `6`                   |

Every tag carries its word (not colour alone).

---

## Layout — ASCII intent

The workspace card's overflow menu (⋯) gains two items: **Export definitions** (main and saved
workspaces — a read) and **Import definitions…** (main workspaces only — a saved workspace is
read-only, R193).

**Export** downloads `<workspace name>-definitions-<YYYY-MM-DD>.json` and toasts "Exported 4
queries, 1 dashboard and 2 workflows." A workspace with nothing to export downloads an empty pack
and says "This workspace has no queries, dashboards or workflows to export." A refusal opens a
modal listing what to fix (see § Export).

**Import** opens a modal (width 760):

```text
┌ Import definitions into Acme copy ──────────────────────────────────── ✕ ┐
│ Bring queries, dashboards and workflows exported from another workspace.  │
│ Data is not imported: the datasets they read must already be here, under   │
│ the same names and with the same columns.                                  │
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │   ⬆  Drop a definitions file (.json) here, or click to choose one     │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│ acme-demo-definitions-2026-10-19.json · from "Acme demo" · 2026-10-19     │
│                                                                            │
│ If a name already exists here: (•) Stop  ( ) Replace it  ( ) Keep mine     │
│ ────────────────────────────────────────────────────────────────────────── │
│ Datasets needed                                                            │
│   ✓ calls_demo                                                             │
│   ✗ agents_demo — not in this workspace                                    │
│   ✗ teams_demo — columns differ — column 1 is id (integer) in the pack,    │
│                  team (string) here                                        │
│ ────────────────────────────────────────────────────────────────────────── │
│ 2 new · 1 replace · 1 unchanged · 1 can't import                           │
│  Kind       Name              Action           Why                         │
│  Query      North calls       [New]                                        │
│  Query      Agent calls       [Can't import]   needs dataset agents_demo   │
│  Workflow   Calls rollup      [New]                                        │
│  Dashboard  Weekly            [Replace]                                    │
│  Dashboard  Daily             [Unchanged]                                  │
│ ────────────────────────────────────────────────────────────────────────── │
│ ⚠ Replacing saves the pack's definition as a new version; the current one  │
│   stays in its History, so it can be restored.                             │
│                                                       [Cancel] [Import]    │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Choosing a file** reads it in the browser; a file that is not JSON, or JSON without
  `packVersion`, shows "This file is not a definitions pack." and no plan. A readable file is
  checked at once (the dry run); the line under the drop zone names the file, the workspace it
  came from and when.
- **The conflict choice** (`Stop` = `refuse`, the default; `Replace it` = `replace`; `Keep mine` =
  `skip`) re-runs the dry run when changed. Help text under the radio: "Stop: nothing is imported
  while a name here holds a different definition. Replace: the pack's definition is saved over
  it. Keep mine: that name is left as it is here."
- **Datasets needed**: one line per dataset the pack names — found (✓), missing ("not in this
  workspace"), or columns differ, said at the **first place the two lists part**: "column 3 is
  amount (integer) in the pack, deal_id (string) here", "column 8, region (string), is not here",
  or "column 8 here, region (string), is not in the pack" (F1: two full lists were unreadable).
- **The plan table**: one row per noun — kind, name, action tag, why (the reason in words);
  queries first, then workflows, then dashboards (the order they are written), each by name. The
  summary line counts each action shown.
- **Import** is enabled only when the plan is `ok` and writes something (a _New_ or _Replace_);
  its label counts: "Import 3" — and, with replaces, the warning line above. When every row is
  _Unchanged_ (or _Skip_): "Nothing to import — everything here already matches the pack." and no
  Import button.
- **After Import**: the modal closes; a toast "Imported into Acme copy: 2 new, 1 replaced, 1
  unchanged."; every list and noun read the import changed is fetched again (queries, dashboards,
  workflows, the history drawers).
- **A refusal on Import** (the workspace changed between the check and the click — `409
  pack_refused`): the plan is replaced by the one the server returns, with an alert "This
  workspace changed since the check. Review the new plan." Nothing was written.
- **A pack the server cannot read** (`422 pack_invalid`): an error alert with one line per
  problem — "This pack was made by a newer version (pack version 2); this one reads version 1.",
  "Dashboard Weekly names query North calls, which is not in the pack.", "Two queries are named
  North calls.", "Workflows A and B read each other.", "The pack is larger than 10 MB." — and no
  plan.

**Interaction decisions (F1, frozen 2026-10-19 — the builder against MSW, screenshots in the
round's Do log):**

1. One conflict choice per import, a radio above the plan, default **Stop**; every change re-runs
   the dry run, so the plan on screen is the one Import applies.
2. The dry run starts on file choice; a file the browser can already reject (not JSON, no numeric
   `packVersion`, over 10 MB) shows its line and sends nothing.
3. Import counts what it writes ("Import 3"), is disabled unless the plan is ok, and is absent when
   nothing would be written ("Nothing to import"); a `Replace` row adds the History warning.
4. A refusal never closes the modal: `409 pack_refused` swaps in the server's plan with the "changed
   since the check" alert; `422 pack_invalid` replaces the plan with one line per problem.
5. Success closes the modal with one toast and re-reads every list, single read, widget read,
   workflow output, history and note an import can change (`IMPORT_INVALIDATES`), checked under
   the app's 60 s `staleTime`.
6. Export downloads at once and toasts the counts; an empty workspace downloads an empty pack and
   says so; `pack_unresolved` opens "Fix these before exporting" with one line per problem.

What F1 handed to the contract (shape questions, not answers): a plan item carries a **reason
code** plus a **detail** (a name or the save check's message) so the builder words it in EN / VI;
the 409 carries the **whole plan**; `counts` per action; a dataset's two column lists only when
they differ; `pack_invalid` problems name `kind`, `name`, `ref`, `refKind`; `pack_unresolved`
problems name `kind`, `name`, `reason` and — for a widget — its title as `ref`.

States: no file · reading · not a pack · checking (spinner over the plan area) · plan ok · plan
blocked (missing / differing datasets, conflicts, can't-import rows — Import disabled, the rows
say why) · nothing to import · importing (buttons disabled) · refused on import (new plan +
alert) · pack invalid (alert) · request failed (alert with the error text; the choice and file
stay).

---

## Behaviour

### The pack (`packVersion: 1`)

```json
{
  "packVersion": 1,
  "exportedAt": "2026-10-19T09:00:00Z",
  "exportedBy": "0.0.1.dev560",
  "workspace": "Acme demo",
  "datasets": [
    { "name": "calls_demo", "columns": [{ "name": "id", "dtype": "integer" }, { "name": "team", "dtype": "string" }] }
  ],
  "queries": [
    { "name": "North calls", "dataset": "calls_demo", "definition": { "filters": [], "advanced": [], "relationships": [], "joins": [], "steps": [] } }
  ],
  "workflows": [
    { "name": "Calls rollup", "definition": { "sources": [{ "query": "North calls" }], "steps": [] } }
  ],
  "dashboards": [
    { "name": "Weekly", "slug": "weekly", "definition": { "widgets": [{ "id": "wdg_0a1b2c3d", "query": "North calls", "title": "Calls", "chartType": "stat", "agg": "count", "span": 1 }] } }
  ]
}
```

- **What is rewritten** — only the references to another noun or a dataset; everything else is
  the stored definition as the app's own model reads it (a legacy shape normalized, `null`
  members dropped):
  - a query's `sourceId` → `dataset` (its name); in `definition.relationships[]`,
    `leftSourceId` / `rightSourceId` → `leftDataset` / `rightDataset` (names), and
    `originRelationshipId` (a governed relationship of the exporting workspace — provenance only,
    R88) is left out;
  - a workflow's `sources[]` → `{query: <name>}` or `{workflow: <name>}`;
  - a dashboard widget's `queryId` → `query` (absent on a `note` widget, as `queryId` is).
- **What keeps its id** — ids that live **inside one definition** and mean nothing outside it: a
  widget's `wdg_`, a control's `ctl_`, a query-owned relationship's `qrel_` (its joins point at
  it). They are kept verbatim, so a re-import matches widget for widget, a widget note in the
  target (keyed `<dsh>:<wdg>`) follows its widget across a replace (R200 CR-1), and a viewer link's
  `f.<ctl>` / `p.<name>` keeps naming the same control.
- **No install id anywhere**: no `ds_`, `qr_`, `wf_`, `dsh_`, `rel_`, `ws_` value appears in a pack.
- **Datasets** — exactly the datasets the pack's queries read (source and join ends), each with
  its columns `[{name, dtype}]` in stored order (hidden flags, coverage, row counts are not part of
  it). A workflow reads queries and workflows, never a dataset directly.
- **Order** — each list by `name` (then id, for a stable tie that cannot occur); two exports of
  an unchanged workspace differ only in `exportedAt`.
- **Envelope** — `packVersion` (integer), `exportedAt` (UTC), `exportedBy` (the exporting app's
  version, informational), `workspace` (the exporting workspace's name, informational). Unknown
  envelope fields are refused (`pack_invalid`).

### Export — `GET /workspaces/{id}/definitions`

- Returns the pack of every query, workflow and dashboard of the workspace (200). A saved
  workspace can be exported (a read).
- **A reference that names nothing is refused, not dropped** — `409 pack_unresolved` with
  `problems: [{kind, name, reason, detail}]`: a widget whose query was deleted
  (`query_missing`, `detail` = the widget title), a workflow source that was deleted
  (`source_missing`), a query join end whose dataset was deleted (`dataset_missing`). The
  exporting workspace shows these as unavailable already; exporting them would make a pack that
  imports as something else. The builder lists them as "Fix these before exporting".

### Import — `POST /workspaces/{id}/definitions/import?dryRun=&onConflict=`

Body: the pack. `dryRun` (`true` | `false`, default `false`); `onConflict` (`refuse` default |
`replace` | `skip`). An optional writer token (`Authorization: Bearer …`, R200) labels every
history row the import writes; it authorizes nothing (definition writes stay open, as the PUTs).

**1. Read the pack** — refused before anything else with `422 pack_invalid {reason, problems}`
when: `packVersion` is not one this install reads (`reason: version`, `supported: [1]`); the body
is over the size cap or holds more than the noun cap (`too_large`); a name appears twice in one
kind, or a slug twice (`duplicate`); a reference names a query or workflow that is not in the pack
(`reference` — a pack is **closed**: everything it references is in it, which an export always
is); workflows read each other in a loop (`cycle`). A body that is not a pack at all is FastAPI's
`422`.

**2. Resolve the datasets** — each named dataset in the **target** workspace, by name: `found`
(its columns equal the pack's, in order, by `name` and `dtype`), `missing`, or `columns_differ`
(both lists returned). A query reading a dataset that is not `found` cannot be imported
(`invalid`, its reason names the dataset), and neither can anything that reads that query.

**3. Plan each noun** — in write order: queries; workflows (a workflow after the workflows it
reads; otherwise by name); dashboards. Against the same-named noun of the same kind in the target:

| Target has …                                   | `refuse`                     | `replace`                     | `skip`             |
| ---------------------------------------------- | ---------------------------- | ----------------------------- | ------------------ |
| no noun of that name                           | `create`                     | `create`                      | `create`           |
| one whose pack form equals the pack's          | `unchanged`                  | `unchanged`                   | `unchanged`        |
| one whose pack form differs                    | `conflict` (`exists`)        | `replace`                     | `skip`             |
| a query of that name reading another dataset   | `conflict` (`source_differs`) | `conflict` (`source_differs`) | `skip`             |
| another dashboard holding the pack's slug      | `conflict` (`slug_taken`)    | `conflict` (`slug_taken`)     | `skip`             |

- **Pack form** = the noun as an export of the target would write it. Equal pack forms mean the
  target already holds exactly this definition: nothing is written and no history row appears —
  so **re-importing the same pack changes nothing**.
- `replace` goes through the noun's update: the target keeps its id (links, notes and history
  stay), the history gains one `update` row (R200), a workflow whose definition moves loses its
  output (R133), a dashboard's widget notes follow their widget ids. A query's update cannot move
  its source (R72), hence `source_differs`.
- `skip` leaves the target's noun as it is; pack nouns that reference it bind to it by name.
- `create` goes through the noun's create: a fresh id, history `#1 create`.
- Every written noun runs **every check its own route runs** (definition against the dataset's
  columns, parameters, steps, widget queries in the workspace, controls, workflow sources). A
  refusal there makes the noun `invalid` with the check's message as its reason, and the nouns
  that read it `invalid` (`needs: <name>`).
- **Workflow on workflow**: a workflow source that this import creates or replaces has no output
  yet, so the save's shape check (R186 "has the first source's shape") is deferred to that
  workflow's run for the reading workflow; every other check still runs. Imported workflows read
  "Not run yet" until run.

**4. One transaction** — the whole plan runs inside one `BEGIN IMMEDIATE` transaction on one
connection (the writes in step 3 happen there, so a later noun validates against an earlier one).
Then:

- **dry run** → `ROLLBACK`; 200 with the plan (`dryRun: true`, `applied: false`, `ok` true or
  false). Nothing is written — the dry run and the apply are the same code up to the last line.
- **apply, plan ok** → `COMMIT`; 200 with the plan (`applied: true`, each `create` with its new
  `id`).
- **apply, plan not ok** (a missing or differing dataset, a `conflict`, an `invalid`) →
  `ROLLBACK`; `409 pack_refused {plan}`. **Whole pack or nothing.**
- A saved workspace → `409 read_only_workspace` (R193); an unknown workspace → `404 not_found`.

**The plan** — `{dryRun, applied, onConflict, ok, datasets[], items[], counts}`:
`datasets[]` = `{name, status: found|missing|columns_differ, columns?: {expected, found}}` (columns
only when they differ); `items[]` = `{kind, name, action, id?, reason?}` in write order, `id` the
target noun's (absent for a `create` in a dry run); `counts` = per action. `ok` is true when no
dataset is missing or differs and no item is `conflict` or `invalid`.

### Caps

- **Size**: a pack body over **10 MiB** is refused (`pack_invalid`, `too_large`); the builder
  checks the file size before reading it.
- **Nouns**: at most **1 000** queries + workflows + dashboards in one pack (`too_large`). The
  existing per-definition caps (≤ 8 parameters, ≤ 12 controls, steps …) apply as on any save.
- Export has no cap (a read); a workspace over the noun cap exports a pack its own install would
  refuse — named trigger in § OUT.

### What is not in a pack

Datasets and their rows; metadata notes; governed relationships (`rel_` — a query carries its own
copy, R88); workflow runs, outputs and the publish link; definition history; anything of the
workspace itself (its name is informational). See § Scope boundary.

---

## Data model

No new table, column or migration. The pack is computed on read and applied through the existing
tables; history rows are the R200 table's (`change: create | update`, `changed_by` from the
writer token).

## Data contract

Contracts: `workspace/packages/contracts/workspaces/definitions-get.contract.yaml`,
`workspaces/definitions-import.contract.yaml` (rationale: `workspaces/definitions-import.contract.md`)
\+ `_shared/definition-pack.yaml` (`DefinitionPack`, `PackDataset`, `PackQuery`, `PackWorkflow`,
`PackDashboard`, `ImportPlan`, `PlanDataset`, `PlanItem`) + three error shapes in
`_shared/api-error.yaml`.

| Route                                                        | Success                       | Errors                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /workspaces/{id}/definitions`                           | `200` `DefinitionPack`        | `404 not_found` · `409 pack_unresolved {problems}` · `422` (malformed id)                                                                     |
| `POST /workspaces/{id}/definitions/import?dryRun&onConflict` | `200` `ImportPlan`            | `404 not_found` · `409 pack_refused {plan}` · `409 read_only_workspace` · `422 pack_invalid {reason, problems}` · `422` (not a pack / params) |

New error codes: `pack_unresolved` (409), `pack_invalid` (422), `pack_refused` (409) — through
the whole chain (`api-error.yaml` enum → `values.yaml` → the generated constants → the builder's
`ApiError` union and `isApiError` → MSW → EN / VI). The version and the caps are constants too
(`values.yaml` `constants.pack`: `version: 1`, `max_bytes: 10485760`, `max_nouns: 1000` →
`PACK` / `PACK_VERSION`, `PACK_MAX_BYTES`, `PACK_MAX_NOUNS`). The route takes the optional writer
token (`_shared/history.yaml#/WriterToken`).

---

## Acceptance criteria (Design gate exit)

**User journey** — as an analyst setting up a second workspace (or a fresh install) from the same
CRM exports, I export the definitions of the workspace that already works, upload the same data
under the same dataset names, choose **Import definitions…** on the new workspace, drop the file,
read that every dataset was found and every query, workflow and dashboard will be created, click
**Import**, run the workflows, and see the same numbers on every dashboard — without retyping a
filter. Next week I export again after a fix and import over it with **Replace it**: only the
changed definitions move, each keeping its history.

1. **Export shape** _(pytest)_ — the pack holds every query, workflow and dashboard of the
   workspace, each list ordered by name; the datasets list holds exactly the datasets the queries
   read, with their columns in order; references are names as § The pack says; no value matching
   `^(ds|qr|wf|dsh|rel|ws)_[0-9a-f]{8}$` appears anywhere in it; two exports of an unchanged
   workspace are equal except `exportedAt`.
2. **Export refuses a dangling reference** _(pytest)_ — a widget whose query was deleted, a
   workflow whose source was deleted, a query whose join dataset was deleted: `409
   pack_unresolved` naming each; nothing else changes.
3. **Parity** _(pytest, fake data)_ — export workspace A (datasets, joined and stepped queries
   with parameters, a dashboard with param / date_range / values controls and a note widget, a
   workflow over two queries and a workflow over that workflow) → import into a clean workspace B
   holding same-named datasets with the same rows → every B query's rows, every B widget's
   aggregate (with the dashboard's saved control values) and every B workflow's output after
   running in dependency order equal A's, row for row and cell for cell (the read envelopes'
   `dataVersions` keys are dataset ids and differ by design). Also with B in another install
   (a second data root).
4. **Re-import is idempotent** _(pytest)_ — importing the same pack into B again plans every noun
   `unchanged`, writes no row in any table (no history row), and B's nouns are byte-identical.
5. **Datasets by name** _(pytest)_ — a dataset missing in the target, or present with its columns
   in another order or another dtype, is listed (`missing` / `columns_differ` with both lists);
   the queries reading it and their readers are `invalid`; apply answers `409 pack_refused` and
   nothing is written.
6. **Dry run writes nothing** _(pytest)_ — a dry run of a pack that would create, replace and
   refuse leaves every table byte-identical (a dump before and after); its plan equals the apply's
   plan (except `dryRun`, `applied` and the new ids).
7. **Conflict rules** _(pytest)_ — `refuse`: a same-named, different noun → `conflict`, apply
   refused; `replace`: the target keeps its id, its history gains one `update` row, a replaced
   workflow's output is cleared, a widget note follows its widget; `skip`: the target's noun is
   untouched and a pack dashboard naming it binds to it; `source_differs` and `slug_taken` block
   under `refuse` and `replace` and skip under `skip`; a noun only in the target is never touched.
8. **Whole pack or nothing** _(pytest)_ — a pack whose last dashboard fails its control check
   writes nothing, earlier creates included.
9. **The pack is read first** _(pytest)_ — `packVersion: 2`, a widget naming a query not in the
   pack, two queries with one name, two workflows reading each other, a body over the size cap,
   and more than 1 000 nouns each answer `422 pack_invalid` with the reason; an unknown envelope
   field is `422`.
10. **History and who** _(pytest)_ — every created noun has `#1 create`, every replaced one a new
    `update` row whose `version` is the noun's new hash; with a writer token both carry its
    `author` / `source`; without, `null`.
11. **Where import is allowed** _(pytest)_ — into a saved workspace: `409 read_only_workspace`,
    nothing written; exporting a saved workspace works; an unknown workspace is `404`.
12. **Same install, two workspaces** _(pytest)_ — A → B in one install: B's nouns get fresh ids,
    widget ids repeat across the two dashboards, a note on a widget of A's dashboard does not
    show on B's, and deleting A's dashboard leaves B's widgets and notes alone.
13. **Existing routes unchanged** _(pytest)_ — the six create / update routes answer as before
    (their conformance and behaviour tests pass unchanged after the extraction).
14. **Export in the UI** _(FE)_ — the card menu of a main and of a saved workspace has **Export
    definitions**; it downloads `<name>-definitions-<date>.json` (the file name made safe) and
    toasts the counts; a `pack_unresolved` refusal opens "Fix these before exporting" with one
    line per problem.
15. **Import in the UI** _(FE)_ — **Import definitions…** only on a main workspace; a file that
    is not a pack says so; a pack is checked at once and on every conflict-choice change; the
    datasets and the plan rows render with their tags and reasons; Import is disabled unless the
    plan is ok and writes something, counts what it writes, and warns when it replaces; "Nothing
    to import" when all match; a `409` on Import shows the server's new plan and the alert; a
    `422 pack_invalid` shows its lines; after Import the query, dashboard and workflow lists and
    the history drawers read fresh with the app's `QueryClient` defaults (review-qa item 10); EN
    and VI.

---

## Scope boundary

### IN scope

- Export of a whole workspace's queries, workflows and dashboards as one `packVersion: 1` file;
  import into a main workspace of the same or another install, by name.
- The dataset check by name and columns; the plan; the dry run; the three conflict rules; one
  transaction; history rows and the writer-token label through the normal writes.
- The two card-menu actions and the import modal; EN / VI.

### OUT of scope (deferred with named triggers)

- **Metadata notes in the pack** — a note is written by a namespace's token writer and stamped by
  the server (decision 9: author, time, the definition version and data versions it was written
  against); an import would forge those stamps or re-stamp every note as the importer's, and its
  anchors (definition hashes over install ids, data versions) do not carry across installs.
  _Trigger: a second install needs the notes of the first — then design "notes travel" with the
  importer's token re-stamping them and the anchor recomputed._
- **Exporting part of a workspace** (chosen nouns, one dashboard and what it reads). _Trigger: a
  user needs to move one dashboard without the rest._
- **A conflict choice per noun** (replace this one, keep that one). _Trigger: a user replaces with
  `skip` / `replace` and then fixes nouns by hand twice._
- **A stored per-noun pack key** (so a renamed noun still matches). Names are the keys: a noun
  renamed in the target between imports is created again under its pack name. _Trigger: a rename
  in a target produces a duplicate that someone reports._
- **Remapping columns by name** when a dataset's columns are in another order (rewriting the
  0-based indices). _Trigger: a target whose export has the same columns in another order — the
  refusal lists it today._
- **Governed relationships, datasets, runs, the publish link, history, the workspace itself.**
  _Trigger: a target needs its relationships page filled from the pack._
- **Deleting nouns that are not in the pack** ("make B match A exactly"). Import never deletes.
  _Trigger: a user asks for a mirror._
- **A pack over the caps** (10 MiB, 1 000 nouns). _Trigger: a workspace that exports past them._
- **Importing from a URL or another install's API directly** — the pack is a file.

---

## Reference materials (read-only)

- [`_noun-model.md`](../_noun-model.md) — ids, names unique per workspace, the definition hash.
- [definition-history.md](definition-history.md) — the write rule an import goes through; restore
  of a replaced definition.
- [`Round_200.md` § Feeds into](../../../plan/cycles/Round_200.md) — the hand-over that names
  this item; BA-C2 for the 0-based column index.
