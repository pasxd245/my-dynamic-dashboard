# Definition history — every saved definition of a query, dashboard or workflow

**Concept**: a query, a dashboard and a workflow each store one **definition** (its
`definition_json`), and its **version** is the 12-hex hash of that definition (decision 14,
[`_noun-model.md` § Versions](../_noun-model.md#versions--what-each-noun-was-at-a-given-moment)).
Until now a save replaced the definition and the previous one was gone. The **definition
history** keeps one row per definition change — its own sequence number, the version, the
definition itself, when, and who when the change carried a writer token — written in the same
transaction as the change. A reader sees **which version, when, and who** (when known), and
**puts an earlier version back**; any past definition can also be opened read-only as its
technical definition (JSON). **Restore is an ordinary save of an old definition**, which becomes
a new version at the top of the list. Nothing is ever rewritten: restoring #3 over #5 leaves #5
in the list. _History does not explain in words what a version did_ — reading an old version by
its column and widget names is OUT (owner question 3).

**Status**: Draft (R200 design)
**Round introduced**: [`Round_200`](../../../plan/cycles/Round_200.md) — item 4.4,
[rc4.md § 4.4](../../../plan/programs/release-rc2-rc5/rc4.md).
**Domain folder**: `data-management/_shared/` — the drawer lives in
`apps/builder/src/features/history/` (a top-level feature, beside `metadata/`), because it is
mounted by two data-management clusters (queries, workflows) **and** the dashboard feature.
This doc owns the table, the wire shape, the write rule and the drawer; each host page owns
only where it mounts the button.

**Sibling docs**: [`../_noun-model.md`](../_noun-model.md) (§ Versions — the hash a row
records), [metadata.md](metadata.md) (the writer tokens reused for `changedBy`; notes anchored
to a version), [queries/queries.md](../queries/queries.md),
[workflows/workflows.md](../workflows/workflows.md),
[../../dashboards/dashboard-filters.md](../../dashboards/dashboard-filters.md) (control ids a
restored dashboard brings back).

> **Why restore is a save, not a rollback.** A rollback would make the list lie — the versions
> after the restored one would vanish, and a note or a link made in between would point at
> nothing. A save keeps the record append-only: the list says what was saved, in order, and
> "same as #3" says which past version a save brought back. The save runs every check a manual
> edit runs, so a version that can no longer work (a widget's query deleted, a filter's column
> index past the end) is refused for the same reason an edit would be.
>
> **What a save cannot catch (BA-C2).** A query's filters address their column by **0-based
> index** into the source's columns. A refresh that drops or adds a column only warns, so an old
> query definition can still validate after one — and its `col: 2` now points at another column:
> the numbers would be silently wrong. The server therefore flags a query version whose source
> datasets changed after it was saved (`sourceChangedSince`), and the restore confirm warns.
> It warns rather than refuses (BA decision; refusing is owner question 5).

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                    | Layer                                                           | Reusability  | Purity             | Allowed peer deps                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------- |
| `DefinitionHistoryButton` + `DefinitionHistoryDrawer` (list · view · restore)              | `apps/builder/src/features/history/DefinitionHistoryDrawer.tsx` | feature      | feature            | react, antd, @ant-design/icons, react-i18next |
| `sameAsOf` (each entry → the newest OLDER entry with its version)                          | `apps/builder/src/features/history/sameAs.ts`                   | feature      | pure               | none                                          |
| `useHistoryQuery` · `useHistoryVersionQuery`                                               | `apps/builder/src/features/history/hooks.ts`                    | feature      | glue (server-data) | @tanstack/react-query                         |
| `historyApi.list` / `historyApi.version` (read only — restore goes through the noun's PUT) | `apps/builder/src/api/historyApi.ts`                            | builder-only | glue               | (fetch — no extra peer dep)                   |
| `HistoryKind` / `HistoryEntry` / `HistoryList` / `HistoryVersion` types                    | `apps/builder/src/features/history/types.ts`                    | feature      | data type          | none                                          |
| `GET /{queries,dashboards,workflows}/{id}/history[/{version}]`                             | `apps/backend/app/routers/history.py`                           | backend      | feature            | (FastAPI — backend native)                    |
| `record` · `sweep` · `entries` · `version_row` · `writer_of` · `source_changed_since`      | `apps/backend/app/history.py`                                   | backend      | feature            | (stdlib `sqlite3`)                            |
| `DefinitionHistory` SQLModel table (`definition_history`, Alembic `0011`)                  | `apps/backend/app/db_models.py`                                 | backend      | data type          | sqlmodel                                      |

**Boundary check**: no row lives in `@mdd/ui`. The drawer carries history-specific copy and
the restore confirm per kind, so it is feature code; like `metadata/` it sits in its own
top-level folder because two feature trees mount it. Restore reuses each noun's existing
update mutation (`useUpdateQueryMutation`, `useUpdateDashboardMutation`,
`useUpdateWorkflowMutation`), so the cache invalidation a manual save does is the one a restore
does.

---

## Token map

All surfaces are AntD primitives (`<Drawer>`, `<List>`, `<Tag>`, `<Typography>`, `<Button>`,
`Modal.confirm`) styled by the `<ConfigProvider>` tokens derived from the seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts). **No new token is
introduced.** `Value` is informational.

| Surface                                  | AntD token (themeTokens.ts)                      | Value (informational) |
| ---------------------------------------- | ------------------------------------------------ | --------------------- |
| Drawer background                        | `colorBgElevated`                                | derived               |
| Row divider                              | `colorBorderSecondary`                           | derived               |
| `#seq`, time · writer line, version text | `colorTextSecondary`                             | derived               |
| _Current_ `<Tag>`                        | `colorPrimary` (AntD `processing` status preset) | `#1677ff`             |
| _Same as #k_ / _History started_ `<Tag>` | `colorFillQuaternary` (default `<Tag>`)          | derived               |
| Definition block (`<pre>`, read-only)    | `colorFillAlter` background, `fontFamilyCode`    | derived               |
| Restore button                           | `colorPrimary` (link button)                     | `#1677ff`             |
| Border radius (tags, definition block)   | `borderRadius`                                   | `6`                   |

---

## Layout — ASCII intent

The page header gains a **History** button (`HistoryOutlined`) beside the page's other
actions — on the query and workflow pages only in view mode (not while editing: a restore
would discard the working copy; BA-C7), on the dashboard page in the header actions.
It opens a right-hand `<Drawer>` (width 520).

```text
┌ History — Weekly ─────────────────────────────────────────────── ✕ ┐
│ Every saved change of this dashboard's definition, newest first.   │
│ Renaming is not a change. Restoring saves the old definition as a  │
│ new version; nothing is removed. Names appear only for changes     │
│ made through the API with a writer token.                          │
│ ────────────────────────────────────────────────────────────────── │
│ #5  [Current]                  Oct 19, 2026 14:02 · report-agent  │
│     Version 3f1c9a0b7d2e                                [JSON]     │
│ ────────────────────────────────────────────────────────────────── │
│ #4  [Same as #2]                    Oct 19, 2026 13:40             │
│     Version 9a0b7d2e3f1c                     [JSON] [Restore]      │
│ ────────────────────────────────────────────────────────────────── │
│ #3                                  Oct 19, 2026 11:15             │
│     Version 7d2e3f1c9a0b                     [JSON] [Restore]      │
│   ┌ #3 — technical definition (JSON), read-only ───────────────┐   │
│   │ {                                                          │   │
│   │   "widgets": [ … ],                                        │   │
│   │   "controls": [ … ]                                        │   │
│   │ }                                                          │   │
│   └────────────────────────────────────────────────────────────┘   │
│ ────────────────────────────────────────────────────────────────── │
│ #1  [History started]               Oct 19, 2026 09:00             │
│     The definition when history began; earlier changes were not    │
│     recorded.                                   [JSON] [Restore]   │
└────────────────────────────────────────────────────────────────────┘
```

- **One row**: `#seq`; the tags — _Current_ on the newest row whose version is the noun's
  current version, _Same as #k_ when an older row has the same version (a restore, or an edit
  undone by hand), _History started_ on a `baseline` row; then the local date-time and, when
  recorded, `· <writer>` (no placeholder when it is not); below, `Version <12 hex>`.
- **Technical definition (JSON)** (the View button, labelled so — BA-C3) expands the row in
  place with the stored definition as pretty-printed JSON in a read-only `<pre>` (one row open
  at a time; a second click closes it). It is the definition as it was saved — an older shape
  than today's model is shown as stored. It is for checking, not for reading a version in plain
  words (OUT, owner question 3).
- **Restore** is absent on **every row whose version is the noun's current version** — the
  _Current_ row and any older row with the same hash (BA-C1: restoring it would save nothing, and
  the toast would lie). It opens a confirm:

  ```text
  Restore version #3?
  The definition of #3 is saved as a new version. The current definition stays in the
  history; nothing is removed.
  <kind line>
  [⚠ source line — a query whose sources changed after #3 was saved]
                                                      [Cancel] [Restore]
  ```

  The kind line: **query** — "Dashboards and workflows that use this query will read the
  restored definition."; **dashboard** — "Viewer links that name filters added since #3 will
  open without those selections."; **workflow** — "The workflow's output is cleared; run it
  again to rebuild it." The **source line** (a warning `<Alert>`, queries only, when the version
  read answers `sourceChangedSince: true`): "The data source changed after this version was
  saved; column positions may differ — check the filters after restoring." On success: a toast
  "Restored #3 as #6", the list refreshes, the page shows the restored definition. On a refusal:
  an error toast with **one readable line** — "This version can no longer be saved: it does not
  fit the current data or queries." for a 422, the error's own message for a typed code — and
  nothing changes; the raw `detail[]` never reaches the toast (it goes to the console; BA-C9).

- **Labels are the clicked row's.** The JSON panel title, the confirm and the toast name the
  `#seq` of the row the user clicked; the drawer reads the version **with that row's `seq`**
  (`?seq=`), so the answer — and a query's `sourceChangedSince` — is that row's, not the
  newest row with the same hash (found at the R200 visual gate: a version saved before a
  refresh and again after it read "no change since" from the later row).

**Delete confirms** (query, dashboard, workflow) say what goes with the noun: "… and its N
saved versions" (BA-C8), N from the history list (the line is left out while it loads or when
it fails).

States: loading (skeleton rows), error (an `<Alert>` with the error text; the page keeps
working), the list. An empty list is not reachable for a live noun (the upgrade seeds a
baseline, every create writes #1); if the server ever answers `entries: []` the drawer says
"No saved changes yet."

---

## Behaviour

### The write rule (server, inside the noun's own transaction)

```mermaid
stateDiagram-v2
    [*] --> Saved: POST creates the noun → #1 create
    Saved --> Saved: PUT, version(new) ≠ version(stored) → #n+1 update
    Saved --> Saved: PUT, same version (rename, re-save) → no row
    Saved --> Saved: PUT refused (404/409/422) → no row
    Saved --> [*]: the noun is deleted → its rows are deleted
```

- **Create** (`POST /workspaces/{id}/queries|dashboards|workflows`) inserts the noun and `#1`
  (`change: create`) on the same connection before the one `commit`. A create refused for a
  name collision rolls both back.
- **Update** (`PUT /queries|dashboards|workflows/{id}`) compares `definition_version` of the
  new definition with that of the stored one. Different → the `UPDATE` and `#n+1`
  (`change: update`, `seq = MAX(seq) + 1` for that noun) commit together. Equal → no row, even
  when the body renamed the noun (dashboard `name` / `slug`, workflow `name`; a query has no
  rename) or re-sent the same definition with `null` members spelled out.
- **What is stored** is exactly the `definition_json` written to the noun's table, and
  `version` is `definition_version` of it — the value a metadata note records as
  `definitionVersion` and a run stamp as `definitionHash`. One hash, three readers.
- **Who** — `changed_by` is the `author`, and `changed_source` the `source` (`ai | human |
system`, BA-C4), of the `backend.metadata_tokens` entry whose token the request carried as
  `Authorization: Bearer <token>`; no header, a malformed one, or an unknown token → both
  `null`. The source is stored and returned; the UI shows no label for it this round (owner
  question 2). The token labels; it never refuses or authorizes a definition save
  (those stay open, as before). The request body has no field for it.
- **When** — `changed_at` is the server's UTC time, ISO-8601 with `Z`.
- **Delete** — deleting a query, dashboard or workflow (its route), the queries a dataset
  delete removes, and every noun a workspace delete removes, delete their rows in the same
  transaction (one orphan sweep beside the metadata sweep: rows whose noun is gone).

### Reads

- `GET /{kinds}/{id}/history` → `{kind, id, current, entries}`: `current` is the noun's
  version now; `entries` newest first by `seq` (`ORDER BY seq DESC`), each
  `{seq, version, change, changedAt, changedBy, changedSource}` — both writer fields always
  present, `null` when not recorded. No definitions in the list (it stays light); no paging (named trigger below).
- `GET /{kinds}/{id}/history/{version}[?seq=]` → the newest row with that version — or, with
  `seq`, that row (404 when it does not carry the version) — plus its stored `definition`
  (parsed JSON, as stored). Read-only: there is no write route.
- **`sourceChangedSince`** (queries only; absent for the other kinds) — `true` when a dataset
  the version reads changed after the row was saved: its `refreshedAt` is later than the row's
  `changedAt` (the asked row's — `seq`). The datasets are those of the **stored** definition — the query's `ds_` source
  and the `ds_` ends of its joins; a `qr_` source or end counts through the leaf datasets of
  that query's current definition. For a `baseline` row the time the definition was written is
  unknown, so any source dataset ever refreshed (`dataVersion > 1`) counts. A source dataset
  that no longer exists counts as changed (the restore will be refused anyway). Computed on
  read, never stored.
- `404 not_found` when the noun does not exist (deleted, never existed), or when the version
  is not in its history. A malformed id — including an id of another kind (`dsh_…` under
  `/queries`) — or version (not 12 hex) is FastAPI's `422`.

### Restore (client)

The drawer reads `GET …/history/{version}` and sends the noun's ordinary update with the
**current** name (and slug) and the **old** definition: `PUT /queries/{id}` `{definition}`,
`PUT /dashboards/{id}` `{name, slug, definition}`, `PUT /workflows/{id}` `{name, definition}`.
The server writes `#n+1 update` with the restored version; the client never sends a version or
a "restore" flag. What follows is what any save of that definition does: dashboards and
workflows reading a restored query read it; a restored workflow's output is cleared (R133); a
restored dashboard's old control ids are back, so a link's `f.<id>` / `p.<name>` naming a
control added since is ignored and dropped from the URL (R199 BA-C1, R195); metadata notes
anchored to the restored version read _current_ again.

### The migration (`0011_definition_history`)

- **Upgrade** creates the table and seeds one row per existing query, dashboard and workflow:
  `seq 1`, `change: baseline`, its current `definition_json`, `version` computed by the
  migration's own copy of the hash (a migration does not import the app; a test pins the copy
  to `app.metadata.definition_version`), `changed_at` = the upgrade time, `changed_by` NULL.
- **Downgrade** drops the table. Every noun keeps its current definition; the history is lost
  (the 0010 schema has nowhere to keep it). Upgrading again seeds fresh baselines.

---

## Data model

```sql
CREATE TABLE definition_history (
    kind            TEXT NOT NULL CHECK (kind IN ('query', 'dashboard', 'workflow')),
    noun_id         TEXT NOT NULL,               -- qr_ / dsh_ / wf_ id
    seq             INTEGER NOT NULL CHECK (seq >= 1),   -- per noun, from 1
    version         TEXT NOT NULL,               -- 12 hex, definition_version(definition_json)
    definition_json TEXT NOT NULL,               -- as written to the noun's table
    change          TEXT NOT NULL CHECK (change IN ('create', 'update', 'baseline')),
    changed_at      TEXT NOT NULL,               -- ISO-8601 UTC
    changed_by      TEXT,                        -- a writer token's author, else NULL
    changed_source  TEXT CHECK (changed_source IN ('ai', 'human', 'system')),  -- its source, else NULL
    PRIMARY KEY (kind, noun_id, seq)
);
```

No foreign key — the three kinds live in three tables (as `metadata_entries`). The rc4 spec's
`id` column is spelled `noun_id` (the metadata table's name for the same thing); `seq` is the
spec's "own sequence number"; `change` says how the row came to be.

## Data contract

Contracts: `workspace/packages/contracts/{queries,dashboards,workflows}/history-get.contract.yaml`
(rationale: `queries/history-get.contract.md`) + `_shared/history.yaml` (schemas and the
`WriterToken` header the six create / update contracts reference).

| Route                                 | Success                                                             | Errors                                                       |
| ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /{kinds}/{id}/history`           | `200` `{kind, id, current, entries[]}`                              | `404 not_found` (noun absent) · `422` (malformed id)         |
| `GET /{kinds}/{id}/history/{version}` | `200` the entry + `definition` (+ `sourceChangedSince` for a query) | `404 not_found` (noun or version absent) · `422` (malformed) |

`{kinds}` ∈ `queries` (`qr_`), `dashboards` (`dsh_`), `workflows` (`wf_`). No new error code.

---

## Acceptance criteria (Design gate exit)

**User journey** — as an analyst I open a dashboard that reads differently from last week,
open **History**, see which version changed it, when, and that an agent made the change this
morning (a name appears when the change came with a writer token), and put the earlier version
back with one confirmed click — without losing what the agent saved, which stays in the list.
Reading what an old version did in plain words is not part of it (owner question 3).

1. **Create writes #1** _(pytest)_ — creating a query, a dashboard and a workflow each leaves
   exactly one row: `seq 1`, `change: create`, `version` = the noun's definition version.
2. **Every definition change writes one row** _(pytest)_ — a PUT that changes the definition of
   each kind adds exactly one row (`seq` + 1, `change: update`, the new version and definition).
3. **Rename writes none; an unchanged re-save writes none** _(pytest)_ — a dashboard name / slug
   change and a workflow name change with the same definition, and a query PUT of the same
   definition (also with `null` members spelled out), leave the history as it was.
4. **A refused save writes none** _(pytest)_ — a 422 (bad definition), a 404, and a 409
   (dashboard / workflow name taken) leave no row — the row and the change share one
   transaction.
5. **Restore creates a new version** _(pytest)_ — PUT of #1's definition after #2 adds #3 whose
   `version` equals #1's; the version read returns #3; the noun's GET returns that definition;
   a metadata note written against #1's version reads current again.
6. **One hash** _(pytest)_ — a row's `version` equals `definition_version` of its definition and
   the `definitionVersion` a metadata note written at that moment records.
7. **Reads** _(pytest)_ — the list is newest first by `seq` with `current` = the noun's version;
   the version read returns the stored definition; 404 for an unknown noun, a version not in
   this noun's history (including another noun's version); 422 for a malformed version and
   for a `dsh_` id under `/queries` (built: the id pattern refuses it before any lookup); the noun's own GET and the lists are byte-identical to before.
8. **Who** _(pytest)_ — a create / update carrying a configured writer token records its
   `author` as `changedBy` and its `source` as `changedSource`; no token or an unknown token
   records `null` for both, a body field cannot set them; the save itself is never refused for a
   token.
9. **Source changed since** _(pytest)_ — the version read of a query row answers
   `sourceChangedSince: false` when no source dataset was refreshed after the row, `true` after a
   refresh of its source or of a joined dataset (and for a `baseline` row over an
   ever-refreshed dataset); the dashboard and workflow version reads carry no such field.
10. **Delete takes the history** _(pytest)_ — deleting a query, a dashboard, a workflow, a
    dataset (with its queries) and a workspace leaves no row for any removed noun and every other
    noun's rows intact.
11. **Migration both ways** _(pytest)_ — on a populated 0010 database the upgrade seeds one
    `baseline` per query, dashboard and workflow with the app's hash; `downgrade -1` drops the
    table and keeps every noun byte-identical; upgrading again works; the schema matches the
    models (parity test).
12. **The drawer** _(FE)_ — the History button on the query (view mode), dashboard and
    workflow pages opens the drawer; rows show `#seq`, time, writer when present, _Current_,
    _Same as #k_ and _History started_ as defined above; View shows the stored definition
    read-only under the label "Technical definition (JSON)"; Restore is absent on every row
    whose version is the current version (the _Current_ row and any older row with the same
    hash); labels use the clicked row's `#seq`; the drawer intro names when a writer appears; the
    History button on the query and workflow pages is absent while editing.
13. **Restore in the UI** _(FE)_ — Restore asks with the kind's line, then sends the noun's
    normal PUT with the current name / slug and the old definition (nothing else); success shows
    "Restored #k as #n" and the refreshed list; a refusal shows one readable line (no raw
    `detail[]`) and changes nothing; a query version with `sourceChangedSince` shows the source
    warning in the confirm; the delete confirms name "N saved versions"; EN and VI.

---

## Scope boundary

### IN scope

- History of the three nouns that store a definition: queries, dashboards, workflows.
- The table, the write rule on create / update, the delete sweep, migration 0011 with a
  baseline backfill, two read routes per kind, the writer-token label.
- The History drawer (list, view, restore through the existing PUT) on the three detail pages.

### OUT of scope (deferred with named triggers)

- **A readable view of an old version / a diff between two versions** — names instead of column
  indices and widget ids, "what changed". The JSON view is labelled technical. _Trigger: the
  owner asks to read an old version (owner question 3 — arguably met for queries already)._
- **Refusing a query restore over changed sources** — it warns (BA-C2). _Trigger: owner question 5._
- **Paging or a cap on the list / retention** — unbounded while the noun lives. _Trigger: a noun
  past 1 000 rows, or a database-size complaint._
- **History of a deleted noun / undelete** — the rows go with the noun. _Trigger: a "recently
  deleted" request._
- **Names in the history** — a rename is not a definition change and is not listed. _Trigger: a
  user needs "who renamed it"._
- **An AI label on a change** — `changedSource` is stored and returned, not shown. _Trigger:
  owner question 2._
- **Workflows in the history** stay IN pending the owner's confirmation (owner question 1).
- **Datasets, relationships, widgets** — a dataset has a schema and data versions, not a
  definition; a relationship has no update; a widget is part of its dashboard's definition.
- **Notes per version** ("2 notes were written for #3") — the metadata panel already says
  "earlier definition". _Trigger: writers ask which version a note was about._

---

## Reference materials (read-only)

- [`_noun-model.md` § Versions](../_noun-model.md#versions--what-each-noun-was-at-a-given-moment)
  — the hash, shared with metadata notes and workflow run stamps.
- [metadata.md § Writers](metadata.md) — the tokens `changed_by` reads.
- [`Round_199.md` § Feeds into](../../../plan/cycles/Round_199.md) — control ids a restored
  dashboard brings back; R197 for the version a note anchors to.
