# Round 200: definition history (item 4.4)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## ⟢ At a glance

_Written at close-out._

## Goal

**Inherits from ← [Round_199](Round_199.md)** (and [Round_197](Round_197.md), [Round_196](Round_196.md))
— a query's, dashboard's or workflow's definition has a version: the 12-hex hash of the
definition with `null` members dropped (decision 14, `app.metadata.definition_version`). A
metadata note anchors to that hash and reads "earlier definition" once it moves (R197). But
the previous definition itself is gone the moment a PUT lands: nobody can see what a dashboard
looked like last week, who changed it, or put it back. `updated_at` was skipped in R196 because
4.4 needs a history table, not a timestamp (rolling log).

Keep **every saved definition**: one history row per definition change, written in the same
transaction as the change, with its own sequence number, the version hash, when and — when the
change came through the API with a writer token — who. A reader lists a noun's history and
reads any past definition; **restore is a normal PUT of an old definition**, which saves a new
version. R199 hands over: a dashboard definition holds three control kinds and a re-bound
control takes a new id, so a restored old definition brings its old control ids back — viewer
links made since name controls that no longer exist and are dropped (BA-C1 path).

_Track: 1 (product). Pulled by: release program item 4.4
([rc4.md § 4.4](../programs/release-rc2-rc5/rc4.md)) — "definition history for queries and
dashboards (who changed what, when)" — and the R196 rolling-log row on `updated_at` — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- **Migration `0011_definition_history`** — table `definition_history (kind, noun_id, seq,
version, definition_json, change, changed_at, changed_by, changed_source)`, primary key
  `(kind, noun_id, seq)`. `kind ∈ {query, dashboard, workflow}`; `change ∈ {create, update,
baseline}`; `changed_by` / `changed_source` nullable (BA-C4). The upgrade seeds **one `baseline` row per existing query, dashboard
  and workflow** (its current definition, version computed exactly as the app does); the
  downgrade drops the table and leaves every noun as it is.
- **Writes** (same connection, same transaction as the noun's `INSERT` / `UPDATE`): create →
  `#1 create`; a PUT whose definition hash differs from the stored one → `#n+1 update`; a
  rename, or a re-save of an unchanged definition → nothing; a refused save → nothing. Deleting
  a noun (its route, a dataset delete's query cascade, a workspace delete) deletes its history
  in the same transaction.
- **Contract** (additive): `_shared/history.yaml` (`HistoryEntry`, `HistoryList`,
  `HistoryVersion`, the `WriterToken` header); `GET /queries|dashboards|workflows/{id}/history`
  → `{kind, id, current, entries}` newest first; `GET …/history/{version}` → one past
  definition, read-only, with `sourceChangedSince` for a query (BA-C2). The six create / update routes document the optional writer token that
  labels a change. No new error code (404 `not_found`, FastAPI 422 for a malformed id / version).
- **Builder**: a **History** drawer on the query, dashboard and workflow pages — rows newest
  first (`#seq`, time, writer, tags _Current_ / _Same as #k_ / _History started_), **Technical
  definition (JSON)** (read-only) and **Restore** (absent on every row with the current version;
  a confirm naming what happens, warning when a query's sources changed since; then the normal
  PUT with the current name); delete confirms name the saved versions; EN/VI; MSW handlers.
- **Tests**: every definition change writes one row; rename writes none; restore creates a new
  version (rc4.md § 4.4), plus the design's criteria C1–C13.

**Falsified if** any of these happens:

- a definition change lands without its row, or a row lands without its change (a refused or
  rolled-back save leaves a row);
- a history row's `version` differs from the hash a metadata note or a run stamp records for the
  same definition;
- restore needs anything but `PUT` (a special endpoint, a flag, a client-sent version);
- an existing read (`GET /queries/{id}`, `/dashboards/{id}`, `/workflows/{id}`, the lists)
  changes a byte;
- `alembic downgrade -1` on a populated 0011 database loses a noun or leaves the table.

- [x] **D** — `data-management/_shared/definition-history.md` (new, Draft), `_noun-model.md`
      § Versions (history line); `flow-selector`; `ux-design` design-spec on the drawer
- [x] **C** — `_shared/history.yaml`, three `history-get` route contracts, the writer token on
      six create / update contracts. **BA pass 1 at Contract exit.**
- [x] **B** — migration 0011 + model + parity; `app/history.py` (record, sweep, list, read);
      the writes in the six routes; the sweep beside every metadata sweep; the six GET routes;
      tests (incl. upgrade → downgrade -1 → upgrade on a populated database)
- [x] **F** — `historyApi`, hooks, `DefinitionHistoryDrawer`, the three pages, MSW, EN/VI; tests
- [x] **I** — visual gate (light EN + VI; dark N/A — no theme)
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

The spec ([rc4.md § 4.4](../programs/release-rc2-rc5/rc4.md)) is silent on five things. Each
is a design call for the BA to judge at contract exit:

1. **Kinds covered — query, dashboard, workflow.** The spec's `{kind}` is open; the plan row
   says "queries and dashboards". Every noun with a stored `definition_json` and a definition
   hash is covered — the workflow too — because a history can only start when its writes
   start: leaving workflows out now loses their changes until a later round. Datasets
   (schema, not a definition), relationships (two ends, no PUT) and widgets (part of their
   dashboard's definition) are not covered. The workflow UI costs one button on a page that
   shares the drawer.
2. **Backfill — one `baseline` row per existing noun at upgrade.** Without it, the first PUT
   after the upgrade records only the NEW definition and the one the noun had is lost for
   good; with it, "the newest row is the current definition" holds for every noun from the
   upgrade on, so the list is never empty and the pre-upgrade definition can be restored.
   Its time is the migration's (when it was recorded, not when it was written — unknown, there
   is no `updated_at`), and `change: baseline` says so on the wire and in the drawer ("History
   started"). The spec's columns gain `seq` (the spec's "own sequence number") and `change`
   (create / update / baseline); `id` is spelled `noun_id` as in `metadata_entries`.
3. **`changed_by` — server-stamped from a writer token, else `null`.** MDD has no user
   identity (multi-user is out of scope). The one identity it has is the R180 writer token
   (`backend.metadata_tokens`): a create / update request carrying `Authorization: Bearer
<token>` that matches a configured token is labelled with that token's `author` — the agent
   that writes notes is the same agent that edits definitions through the API. No token, an
   unknown token, or the builder (which never sends one) → `null`, shown as no name. The token
   only **labels**; it never authorizes or refuses a save (definition writes stay open, as
   today), and the body has no `changedBy` (a client cannot assert it — decision 9's rule).
   _BA pass 1: accepted; the token's `source` is stored too (`changed_source`, BA-C4)._
4. **Ordering — newest first by `seq`, an explicit `ORDER BY seq DESC`.** `seq` is per noun,
   from 1, `MAX(seq) + 1` inside the write transaction (the noun's `UPDATE` takes SQLite's
   write lock first; the primary key refuses a duplicate). Time is not the order (two saves in
   one second; a baseline's time is the upgrade's). `GET …/history/{version}` returns the
   newest row with that version — a restored version appears more than once, and every such row
   holds the same definition (same hash = same definition with `null` members dropped).
5. **Retention — unbounded while the noun lives; deleted with the noun.** A dashboard saves on
   each widget action (add, edit, remove, reorder), not per pixel, so a busy dashboard grows by
   tens of rows a day at a few KB each. No cap this round (named trigger: a noun past 1 000 rows
   or a database-size complaint). A deleted noun's history is deleted in the same transaction:
   no route can read it (every history route 404s on a missing noun), and keeping it would be a
   silent soft-delete the delete confirm does not mention. A "recently deleted" feature that
   wants it is a separate item. The downgrade drops the table — the history is lost, the nouns
   are not (the 0010 schema has nowhere to keep it).

Other risks:

- **Restore of a definition that no longer validates** (a column dropped by a refresh, a widget
  query deleted) is the normal PUT's 422 / 404 — the drawer shows the reason and nothing is
  written. Not a special case on the server.
- **Restore and other nouns.** A restored query changes every dashboard widget and workflow that
  reads it (as any edit does); a restored workflow clears its output (any definition change
  does — R133); a restored dashboard brings back old control ids, so a viewer link naming a
  control added since loses that key (BA-C1). Metadata notes anchored to the restored version
  read "current" again — the hash is the same; this is the intended consequence of decision 14.
- **The noun's GET does not change.** No `updatedAt` / `historyCount` on `Query`, `Dashboard`,
  `Workflow` — the drawer reads its own route.

## Do

- 2026-10-19 — round opened on `release/v0.0.1-rc.4` at `9b3ec3e` (R198 + R199 in Review).
- 2026-10-19 — **D**: new
  [`_shared/definition-history.md`](../../design/data-management/_shared/definition-history.md)
  (Draft — the write rule, the reads, restore through the noun's PUT, migration 0011 with a
  baseline backfill, the drawer, criteria C1–C12 (C1–C13 after BA pass 1), OUT with triggers); `_noun-model.md`
  § Versions gains the history line (the version stays the hash, not `seq`). Design lint,
  token parity, md lint 0.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                        |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | a read-only list with three tags; restore is the existing save with its existing refusals            |
| 2. New interaction pattern           | no     | a right drawer from a header button (the R183 relationship-check drawer) + `Modal.confirm`           |
| 3. High user-error risk              | no     | restore removes nothing — the current definition stays in the list and can be restored back          |
| 4. Contract depends on unresolved UI | no     | the routes and shapes are fixed by the item spec; the drawer only reads them and calls existing PUTs |
| 5. UX confidence below threshold     | no     | layout and copy are in the design doc's ASCII intent; every primitive is an AntD one already in use  |

Result: **Flow: DCFBI** — no condition fired (the rc4 spec's Flow line agrees).

**`ux-design` (design-spec, the History drawer)** — Findability: a "History" button with the
`HistoryOutlined` icon in the page header of each of the three detail pages, beside Edit /
Delete; Usability: newest first, the current row tagged, View expands in place, Restore one
confirm away and absent where it would do nothing; Accessibility: the tags carry text (not
colour alone), the definition block is selectable text, the confirm names its action
("Restore"), the drawer has a title naming the noun; Credibility: every row is server-written
(time, writer from a token, version = the same hash a note shows), a baseline row says it is
not a real change time, restore never rewrites the list; Utility: see what it was, who changed
it, put it back — the item's three questions; Desirability: AntD `Drawer` / `List` / `Tag`, no
new token. Gap noted, not blocking: View shows JSON, not a "what changed" summary — OUT with a
trigger.

### C

- **C** — `_shared/history.yaml` (new): `HistoryKind`, `HistoryChange` (`create | update |
baseline`), `HistoryEntry` `{seq, version, change, changedAt, changedBy}` (`changedBy`
  always present, `null` when unknown), `HistoryList` `{kind, id, current, entries}` (newest
  first by `seq`, not paged), `HistoryVersion` (an entry + the stored `definition`, a free
  object — an old shape is returned as saved); parameters `WriterToken` (optional
  `Authorization`, labels only) and `Version` (12 hex). Route files
  `queries|dashboards|workflows/history-get.contract.yaml` (two paths each; operationIds
  `<kind>History` / `<kind>HistoryVersion`; 404 `not_found` for a missing noun or version,
  FastAPI 422 for a malformed id / version) + one rationale `queries/history-get.contract.md`.
  The six create / update contracts (`queries|dashboards|workflows` `post` / `put`) reference
  `WriterToken` and say which saves write a row (create → #1; a changed version → #n+1; rename,
  unchanged re-save, refusal → none; restore = this PUT). No new error code, no change to any
  existing response shape. Contracts 53 green (50 + 3); the six new success schemas compile
  under the MSW validator's Ajv and refuse an extra property.
- **Contract exit** — handed to the orchestrator for **BA pass 1** (no sub-agent spawning in
  the coder session, as in R198 / R199). B / F wait for its findings.
- **BA pass 1 (contract exit, `9b3ec3e..7154ab7`, run by the orchestrator): CHANGES** — 0 P0,
  3 P1, 6 P2. All five design calls in § Risks accepted (workflows in; baseline backfill with
  `seq` + `change`; `changed_by` from the writer token; `seq DESC`; unbounded retention,
  deleted with the noun) and the restore semantics, with conditions (below).
  - **BA-C1 (P1)** — an older row can carry the current version (#4 = A, #2 = A); its Restore
    would PUT the same hash, write no row, and the toast "Restored #2 as #n" would lie. Folded:
    Restore is hidden on **every** row whose `version == current`; tested in F.
  - **BA-C2 (P1)** — query filters address columns by 0-based index and a refresh that drops or
    adds a column only warns, so a restored pre-refresh query can validate and read the wrong
    column. **Decided: warn, not refuse.** Folded: `HistoryVersion.sourceChangedSince` (queries
    only, server-computed from the source datasets' `refreshedAt` vs the row's `changedAt`;
    a `baseline` row counts any ever-refreshed source; a missing source counts); the confirm
    shows "The data source changed after this version was saved; column positions may differ —
    check the filters after restoring." (EN/VI). Refusal → owner question 5; the index
    fragility → rolling log (pre-existing).
  - **BA-C3 (P1)** — a JSON View cannot keep the journey's "see what it looked like before" for
    a non-technical owner. **Decided: option (a)** — the journey and the walk narrow to which
    version, when, who (when known) and put it back; View is labelled "Technical definition
    (JSON)"; a name-resolving view / diff is OUT with the trigger "the owner asks to read an old
    version" (owner question 3).
  - **P2 folded:** BA-C4 `changed_source` column + `changedSource` on the entry (stored and
    returned, no UI label — owner question 2); BA-C5 no `pattern` on `WriterToken`; BA-C6 a
    neutral example author (`report-agent`); BA-C7 the workflow page's History button in view
    mode only; BA-C8 delete confirms add "and its N saved versions"; BA-C9 a refused restore's
    422 maps to one readable line (detail to the console, never raw `detail[]` in a toast).
  - **Conditions:** View / Restore label by the CLICKED row's `#seq`, never the response's
    (call 4); the drawer intro says "Names appear only for changes made through the API with a
    writer token." (call 3); the program table row says "queries, dashboards and workflows —
    pending owner confirmation" (owner question 1).
  - **Logged (P2):** a restore sends the cached name / slug, so a rename made elsewhere since
    the page loaded is reverted by the restore (concurrent-rename revert) — rolling log.
- **Contract fold** — design doc (journey narrowed, Restore hidden on the current version, the
  JSON label, the source warning, the delete line, the one-line refusal, clicked-row labels,
  `changed_source`, criterion C9 `sourceChangedSince` → C1–C13, OUT rows); `_shared/history.yaml`
  (`changedSource` required on the entry and the version, `sourceChangedSince` on a query
  version, `WriterToken` without a pattern); the three route examples (`report-agent`,
  `changedSource`, `sourceChangedSince`); the rationale; the program table row and two
  rolling-log rows. Contracts 53 green.

### B

- **B** — `alembic/versions/0011_definition_history.py` (the table; one `baseline` per existing
  query / dashboard / workflow with the migration's own copy of the hash; the downgrade drops
  the table) + `db_models.DefinitionHistory` + the parity test's legacy schema, `_TABLES` and
  head (`0011`). New `app/history.py`: `record` (`seq = COALESCE(MAX(seq), 0) + 1` in one
  `INSERT … SELECT`), `record_if_changed` (by `definition_version`, so a rename or a re-save
  writes nothing), `writer_of` (author + source of the R180 token — the lookup moved to
  `app.metadata.token_for`, the metadata router calls it), `sweep` (orphan rows of the three
  kinds), `entries` (`ORDER BY seq DESC`), `version_row` (newest row with the hash),
  `source_changed_since` (BA-C2: the stored definition's `ds_` source and used join ends, a
  `qr_` through its current definition; `refreshed_at > changed_at`; a baseline counts any
  `data_version > 1`; a missing dataset counts). The six create / update routes record in the
  noun's own transaction — the three PUTs open `BEGIN IMMEDIATE` and re-read the stored
  definition under the write lock before comparing; every delete path that runs
  `metadata.sweep` (query, dashboard, workflow, dataset, workspace) runs `history.sweep` beside
  it. New `routers/history.py` (six GETs; 404 `not_found` for a missing noun / version; an id of
  another kind fails the path pattern → 422 — the design and the three contracts said 404 for
  that case and are corrected). `tests/_conformance.py` takes an optional `route` (the history
  contracts carry two paths). `tests/test_definition_history.py` (14): C1 create → #1 per kind;
  C2/C3 one row per change, none for a rename or an unchanged re-save; C4 a 422 / 409 / 404
  writes none; C5/C6 restore → #3 with #1's hash, the version read answers #3, a note anchored
  to #1 reads `other_definition` then `current` again; every row's version is its definition's
  hash; C7 order, 404s (unknown noun, unknown / another noun's version), 422 (wrong prefix,
  malformed version); C8 token → `report-agent` / `ai`, unknown or malformed token → null and
  the save lands, a body `changedBy` → 422; C9 `sourceChangedSince` false → true after a refresh,
  absent on dashboard / workflow versions, baseline + missing source, join ends; C10 every
  delete path sweeps exactly the removed nouns' rows; C11 0011 on a populated 0010 database
  (baselines with the app's hash, nouns byte-identical across downgrade and re-upgrade) and the
  migration's hash copy pinned to the app's. Backend **736** green (722 + 14), ruff clean.
- **Migration probe (QA's check, run by the coder)** — an isolated root
  (`scratchpad/r200/probe-0011`, asserted empty and used as the app's data dir): fake "Acme
  probe" data written through the real app (a dataset, a query edited 3×, a dashboard edited
  once, a workflow → 7 history rows), then the alembic CLI: `downgrade -1` → `0010`, table gone;
  `upgrade head` → `0011`, three `baseline` rows; the nouns' rows hash-identical across all three
  states; `PRAGMA foreign_key_check` empty.

### F

- **F** — new `features/history/` (`types.ts`; `hooks.ts` — `HISTORY_QUERY_KEY`,
  `useHistoryQuery`, `useHistoryVersionQuery`; `sameAs.ts` — `sameAsOf`, `currentSeqOf`,
  `canRestore` (BA-C1); `DefinitionHistoryDrawer.tsx` — `DefinitionHistoryButton`, the drawer,
  `SavedVersionsLine` (BA-C8), `restoreErrorText` (BA-C9)) and `api/historyApi.ts` (read only).
  The drawer: intro (the writer-token sentence), rows newest first with _Current_ / _Same as
  #k_ / _History started_, the time and `· <writer>` when recorded, "Technical definition
  (JSON)" expanding in place (BA-C3), Restore absent on every row with the current version
  (BA-C1); Restore reads the clicked row's version, confirms with the kind line and — a query
  with `sourceChangedSince` — the source warning (BA-C2), then calls the page's `restore`
  (the noun's own update mutation: query `{definition}`, dashboard `{name, slug, definition}`,
  workflow `{name, definition}`), re-reads the list and toasts "Restored #k as #n"; a refusal
  toasts one readable line and logs the error to the console (BA-C9). Mounted on the query page
  (every view-mode header, the stale / join-unavailable ones too — an earlier version may be the
  repair; gone while editing), the workflow page (view mode only, BA-C7) and the dashboard header.
  The three update mutations invalidate the history cache. `DeleteConfirmModal` takes an `extra`
  line; the query and workflow delete confirms and the dashboard list's delete confirm show "This
  also deletes its N saved versions." (BA-C8). MSW: an in-memory history per fixture noun (a
  baseline of the fixture's definition, an `update` appended by the PUT mocks when a mock hash
  moves), both reads contract-validated. EN / VI copy under `history.*`.
  `tests/definition-history-r200.test.tsx` (14): the pure rules (Same as, Current, BA-C1), the
  workflow drawer (rows, tags, writer, intro, Restore only off the current version; the JSON
  labelled by the clicked row and read with its `seq`; a restore's PUT body = current name + old
  definition, toast; no button while editing; the delete line), the query drawer (the source
  warning shown / not shown; a 422 restore → one readable line, no `detail`; no button while
  editing), the dashboard restore PUT (name + slug + old definition, the dashboard line), the MSW
  store (baseline, no row for a rename, 404) and the VI copy. Builder **595** green (581 + 14,
  detached full run), `tsc` clean.
- **Visual gate (light, EN + VI; dark N/A — no theme, rolling log):** real backend on an
  isolated root (`scratchpad/r200/vis-data`, the app's DB created there; the default
  `workspace/apps/backend/data/app.sqlite` untouched — mtime before the round) with a configured
  fake writer token (`report-agent`), vite on :3000; fake "Acme calls" data: a query edited 3×
  (one change through the token, one undone by hand), its dataset refreshed after, a dashboard
  edited through the token, a workflow edited once. Screenshots (`scratchpad/r200/shots/`, 13):
  the query drawer (Current + Same as #1, `· report-agent` on the agent's row, no Restore on the
  current-hash rows), the technical JSON of #2, the restore confirm with the source warning, the
  restored list + "Restored #2 as #5" toast with the page re-read (South rows), the delete
  confirm with "9 saved versions" (VI), the dashboard drawer, the workflow restore confirm (the
  output line). **Found at the gate and fixed here:** the version read was keyed by hash only, so
  for a definition saved before the refresh AND again after it (a restore) the confirm read the
  newer row and showed no warning for the older one. The version read now takes an optional
  `?seq=` (contract `Seq` parameter, additive; the drawer always sends the clicked row's) — the
  answer and `sourceChangedSince` are that row's; a `seq` without that version is 404. Backend
  test `test_seq_names_the_clicked_row_of_a_repeated_version` (backend **737**, ruff clean; commit
  `df970b7`); the builder tests assert the
  `seq` sent. Re-shot: the warning shows for the pre-refresh row in EN and VI. Browser console:
  only the pre-existing `WidgetFilterDrawer` `width` deprecation.

### Reviews after F

- **Run by the orchestrator on `9b3ec3e..8ce7ba3`.** Code review **CHANGES** (1 P1, 7 P2); QA
  **CHANGES** (1 P1, 2 P2). Green otherwise: QA's migration walk S0–S6 (upgrade; downgrade -1 with
  history rows present; re-upgrade; downgrade to 0010; the startup migration) — nouns and hashes
  identical, fk / integrity clean, the 76 shared GETs byte-identical; concurrent PUTs take
  contiguous `seq` in-process and over HTTP.
  - **CR-1 (P1)** — the R197 sweep inside a dashboard PUT archived the notes of a widget the
    restored version lacks; restoring back returned the widget without its notes, so "nothing is
    removed" was false (`scratchpad/r200/cr/probe3.py`).
  - **QA-1 = CR-3 (P1, QA's grade taken)** — the restore confirm's version read used
    `fetchQuery` with the app's 60 s `staleTime`, so the BA-C2 warning could come from a cache
    older than a refresh.
  - P2: CR-2 = QA-2 (a same-second refresh is not flagged), CR-4 (0011 not re-runnable after a
    half-failed backfill), CR-5 (the toast claims a restore that wrote no row), CR-6 (the
    workflow PUT clears the output on a dict difference the hash ignores), CR-7 (tests: key
    order / nulls in `record_if_changed`; concurrency), CR-8 (bare "token" in VI), QA-3 (more
    screenshots).
- **Fix (`fix(R200): …`)** —
  - **CR-1, the reversible path** (the hard-stop check passed: `metadata.md` calls the sweep
    "archived, not dropped" and already lets a returning column's entries reappear; nothing says
    a sweep is final). New `app.metadata.unsweep_widgets`, called in the dashboard PUT right after
    the sweep, same transaction: a widget id the new definition carries takes back its newest
    archived entry per namespace, anchor unchanged; a newer live entry for the same key would win
    and the other be archived. Copy: the confirm no longer says "nothing is removed" (EN/VI
    `confirmBody`, `intro`), the dashboard line adds "Notes on widgets this version lacks are set
    aside and come back with the widget." `metadata.md` § Lifecycle gains the as-built line.
    Tests: the round trip (note on W2 → restore #1 → 404 → restore #2 → the note is back exactly
    as read before, state `current`, nothing left archived) and the newer-live-entry guard; the
    round trip fails on `8ce7ba3`.
  - **QA-1** — `staleTime: 0` on the confirm's version read; the dataset commit (refresh) and the
    workflow publish mutations invalidate every history read. QA's builder file adopted as
    `tests/definition-history-r200-adversarial.test.tsx` (3; its fresh-read case fails on
    `8ce7ba3`).
  - **CR-2** — `>=` for a non-baseline row (a same-second tie warns). Two existing tests that
    created the dataset and the query in one second now date the upload first.
  - **CR-4** — 0011 `CREATE TABLE IF NOT EXISTS` and empties the table before seeding; test: a
    backfill that fails on a bad definition leaves the database at 0010, the re-run after the
    repair seeds every baseline once (fails on `8ce7ba3`).
  - **CR-5** — the toast compares the newest `seq` before and after: no new row → "#k is already
    the current definition; nothing was saved." (EN/VI); tested.
  - **CR-6** — the workflow PUT decides `definition_changed` by `definition_version`; test: a
    stored definition carrying a `null` member today's model does not dump, re-saved → the
    materialized output and the run stamp stay (fails on `8ce7ba3`).
  - **CR-7** — a direct `record_if_changed` test (reordered keys, omitted and spelled-out nulls
    write nothing; a value change writes `#1 update`); QA's backend file adopted as
    `tests/test_definition_history_adversarial.py` (14, incl. the 12-thread concurrency case and
    QA-2's same-second case; its "unchanged before the refresh" case dates the upload first).
  - **CR-8** — VI "token" → "mã ghi" ("… gửi qua API kèm mã ghi").
  - **QA-3** — new screenshots (`scratchpad/r200/shots2/`, isolated root `vis2-data`; a genuine
    baseline: data written at head, `alembic downgrade -1`, the app's startup upgrade): the
    query's _History started_ row; its restore confirm with the source warning (the refresh
    dropped `agent`, so #1's `col: 2` now names `Source.Name` — the BA-C2 case, live); a refused
    dashboard restore (#3's widget query deleted) → "This version can no longer be saved: it does
    not fit the current data or queries."; the dashboard confirm with the links line and the
    notes line; VI "Đã khôi phục #1 thành #5"; after restoring back, the widget's note in its
    popover (CR-1 live).
  - Gates: backend **756** (737 + 5 new + 14 adopted), ruff clean; builder **599** (595 + 1 new + 3 adopted;
    full suite detached, backend idle), `tsc` clean; contracts 53; md / plan / design lints 0.

## Check

_Gates, visual gate, reviewer verdicts and the walk script — at close-out._

## Act

_Rolling-log rows, promotion and prune check — at close-out._

- **Owner questions** (from BA pass 1, carried to close-out):
  1. Workflows are in the definition history (and its drawer) alongside queries and
     dashboards — the program row named only queries and dashboards. Confirm?
  2. Should a change made by an agent (`changedSource: ai`) carry an AI label in the history
     list, the way an agent's metadata note does? (Stored and returned; not shown.)
  3. Is a readable view of an old version (column and widget names instead of indices / ids,
     or a diff) wanted? The BA notes it is arguably already met for queries. Today: the JSON,
     labelled technical.
  4. Is an empty "who" acceptable for every in-app edit, given multi-user is out of scope (names
     appear only for writer-token changes)?
  5. Should restoring a query version whose source datasets changed since be **refused**
     rather than warned (BA-C2; built: a warning in the confirm)?

## Feeds into → Round_201 (TBD)

_At close-out._
