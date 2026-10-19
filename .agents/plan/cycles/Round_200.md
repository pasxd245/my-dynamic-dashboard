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
- [ ] **C** — `_shared/history.yaml`, three `history-get` route contracts, the writer token on
      six create / update contracts. **BA pass 1 at Contract exit.**
- [ ] **B** — migration 0011 + model + parity; `app/history.py` (record, sweep, list, read);
      the writes in the six routes; the sweep beside every metadata sweep; the six GET routes;
      tests (incl. upgrade → downgrade -1 → upgrade on a populated database)
- [ ] **F** — `historyApi`, hooks, `DefinitionHistoryDrawer`, the three pages, MSW, EN/VI; tests
- [ ] **I** — visual gate (light EN + VI; dark N/A — no theme)
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
  4. _(Text not in the relay to the coder — copy from the BA pass-1 report.)_
  5. Should restoring a query version whose source datasets changed since be **refused**
     rather than warned (BA-C2; built: a warning in the confirm)?

## Feeds into → Round_201 (TBD)

_At close-out._
