# Round 201: definition pack — export and import by name (item 4.8)

**Status**: In Progress
**Flow**: **DFCFBI (triggers 1, 3, 4)** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## Goal

**Inherits from ← [Round_200](Round_200.md)** — every query, dashboard and workflow definition
now has a history (`seq`, the version hash, `change`, who), restore is the noun's own PUT, a
widget's notes follow the widget id, and `app.metadata.token_for` is the one writer-token lookup.
R200's `Feeds into →` named the next item: **4.8 — a definition pack**, not yet in `rc4.md`.

A second install (or a clean re-install) that should carry the same analysis as an existing one
re-creates its queries, dashboards and workflows by hand, or by scripting the create / update
routes one by one — and every id differs per install, so a script written against one install
does not run against the other. A previous round's parity check needed an ad-hoc probe built by
hand for the same reason. Wanted: **export the definitions of one workspace and import them into
another workspace (same or another install) by name, independent of ids** — datasets stay out
(data never travels in the pack); the pack names the datasets it needs and the import finds them
by name in the target workspace.

The owner's decisions (2026-10-19, relayed by the orchestrator): 4.8 is specified **and** built in
rc.4; **4.1 scheduled refresh is deferred** — "no deployment pull yet — the only active install
refreshes by hand on a weekly cadence and runs no scheduler; reopen when a deployment names a
watched source".

_Track: 1 (product). Pulled by: a named product gap — re-creating the same analysis in a second
workspace or install by hand, with ids that differ per install (R200 `Feeds into →`; the hand-built
parity probe of an earlier round) — per [Evolution Rule](../../AGENTS.md). The item is added to
rc.4 by the owner's call of 2026-10-19._

## Plan

**Expected outcome**:

- **Export** `GET /workspaces/{id}/definitions` → a `packVersion: 1` pack: the workspace's
  queries, workflows and dashboards, each list by name, every reference to a dataset, query or
  workflow written as its name; the datasets the queries read with their columns in order; no
  install id (`ds_ qr_ wf_ dsh_ rel_ ws_`) anywhere; intra-definition ids (`wdg_ ctl_ qrel_`)
  verbatim. A reference to a deleted noun refuses the export (`409 pack_unresolved`, listed).
- **Import** `POST /workspaces/{id}/definitions/import?dryRun=&onConflict=` (body = the pack):
  read the pack (`422 pack_invalid`: version, duplicate, reference, cycle, too large) → find the
  datasets by name and columns in the target → plan each noun (create / unchanged / replace /
  skip / conflict / invalid) → run every write through the noun's own create / update body (the
  six routes' bodies extracted into connection-taking functions) inside **one** `BEGIN IMMEDIATE`
  transaction → dry run: `ROLLBACK`, 200 plan; apply: `COMMIT` when ok (200 plan with ids), else
  `ROLLBACK` + `409 pack_refused {plan}`. History rows through the normal path; an optional writer
  token labels them; a saved workspace → `409 read_only_workspace`. No migration.
- **Builder**: **Export definitions** / **Import definitions…** on the workspace card; the import
  modal (file → dry run → datasets + plan → Import) with the conflict choice; EN / VI; MSW.
- **Tests**: the design's criteria 1–15
  ([definition-pack.md § Acceptance](../../design/data-management/_shared/definition-pack.md)),
  among them: the parity test (A → clean B with same-named fake datasets → every query's rows,
  widget's aggregate and workflow's output equal A's, also across two data roots); re-import
  writes nothing; a missing dataset refuses with the list; a dry run writes nothing.

**Falsified if** any of these happens:

- an imported query, widget or workflow reads a different row or cell than its original over the
  same data;
- a pack holds an install id, or importing it twice writes anything the second time;
- a dry run or a refused apply leaves any row changed, or an apply writes part of a pack;
- an imported or replaced noun skips a check its own route runs, or lands without its history row;
- an existing route's request or response changes a byte.

- [x] **D** — the 4.8 spec in `rc4.md` + the program-table row + the exit-gate line; design doc
      [`_shared/definition-pack.md`](../../design/data-management/_shared/definition-pack.md)
      (new, Draft); `workspaces.md` and `_noun-model.md` pointers; `flow-selector`
- [ ] **F1** — the builder against MSW before the contract (types, `definitionsApi`, hooks, the
      card actions, the import modal, MSW handlers, EN / VI, tests); interaction decisions frozen
- [ ] **C** — `_shared/definition-pack.yaml`, `workspaces/definitions-get` +
      `definitions-import` route contracts (+ rationale), the three error codes through the whole
      chain; MSW validated against the YAML. **BA pass 1 at Contract exit.**
- [ ] **F2** — the confirmation pass against the contract-derived MSW
- [ ] **B** — extract the six create / update bodies; `app/definition_pack.py`;
      `routers/definitions.py`; tests (criteria 1–13)
- [ ] **I** — the builder against the real backend; visual gate (light EN + VI; dark N/A — no theme)
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

The design calls the BA judges at Contract exit (each in
[definition-pack.md](../../design/data-management/_shared/definition-pack.md)):

1. **Conflict policy — one choice per import: `refuse` (default) / `replace` / `skip`.** A
   same-named noun whose pack form equals the pack's is `unchanged` under every choice (that is
   what makes a re-import write nothing). `replace` goes through the noun's update (id kept, one
   history row, so it is restorable from History — R200); `skip` keeps the target's noun and binds
   the pack's readers to it. Two conflicts no choice resolves: a query of that name reading
   another dataset (`source_differs` — a query's update cannot move its source, R72) and a slug
   held by another dashboard (`slug_taken`); both block under `refuse` / `replace`, skip under
   `skip`. A choice per noun is OUT with a trigger.
2. **Dry run — `?dryRun=true` runs the whole import in its transaction and rolls back.** The
   plan is produced by the same code that applies it, so "the dry run said X" and "the apply did
   X" cannot drift; it writes nothing because SQLite rolls it back (every write the six routes do
   is a SQLite row — no file is touched on create / update). A dry run with problems is a 200
   with `ok: false` (a report); an apply with problems is `409 pack_refused` carrying the plan.
3. **Atomicity — whole pack or nothing.** One `BEGIN IMMEDIATE` on one connection for the whole
   pack: later nouns validate against earlier ones (a workflow over a query created two lines
   above), and a failure anywhere rolls everything back. The cost: the six routes' bodies are
   extracted into functions taking a connection (no parallel writer), and the import holds the
   write lock for its duration (bounded by the caps).
4. **Key and id model — the name is the key, per kind.** Names are already unique per kind in a
   workspace (`*_name_unique`), so no new stored key and no migration. Ids are minted fresh on
   `create`, kept on `replace`. `wdg_` / `ctl_` / `qrel_` stay verbatim inside their definition
   (scoped: a widget note keys `<dsh>:<wdg>`, a viewer link names `ctl_` within its dashboard), so
   a replace keeps widget notes and links. Cost: a noun renamed in the target between imports is
   created again under the pack's name (a stored per-noun key is OUT with a trigger).
5. **Datasets by name — and by columns.** The pack carries each needed dataset's columns
   (`name`, `dtype`, in order) and the import refuses a dataset whose columns differ, because
   query filters address columns by 0-based index (R200 BA-C2): a same-named dataset with columns
   in another order would import queries that validate and read the wrong column. Remapping by
   name is OUT with a trigger.
6. **Metadata notes — OUT this round.** Notes are written by a namespace's token writer and
   stamped by the server (decision 9); an import would forge or re-stamp them, and their anchors
   (definition hashes over ids, data versions) do not cross installs. Trigger: a second install
   needs the notes.
7. **Versioning — `packVersion: 1`, exact.** An importer reads only the versions it knows (a
   higher one → `422 pack_invalid`, `version`, `supported: [1]`); the envelope is closed (unknown
   fields refused); the definitions inside follow the target app's own models, so an older install
   refuses a newer definition field by name (`invalid`) instead of dropping it.
8. **Caps — 10 MiB body, 1 000 nouns.** A real workspace's pack is tens of KB; the caps bound the
   write-lock time and the request. Export has no cap (a read) — named trigger.
9. **Who may import — as open as the PUTs today.** MDD has no user identity (multi-user is out of
   scope); definition writes are open; an optional writer token labels the history rows (R200),
   never authorizes. A saved workspace refuses (`read_only_workspace`, R193).
10. **Export refuses a dangling reference** (a widget's deleted query, a workflow's deleted source,
    a deleted join dataset) rather than dropping it — the target would otherwise differ from the
    source without saying so. Cost: one broken widget blocks the export until it is removed (it is
    already shown unavailable).
11. **Workflow on workflow** — a workflow source the same import creates or replaces has no output
    yet, so the save's shape check (R186) is deferred to the run for its readers; every other check
    runs. A closed pack (every reference inside it) is required — partial packs are OUT.

Other risks:

- **The extraction of six route bodies** is the largest code move: the existing create / update
  tests must pass unchanged (criterion 13); the history and sweep calls move with the bodies.
- **Validators that open their own connection** would not see the import's uncommitted rows — B
  must route every validation the import reaches through the import's connection.
- **No human F1 feel-check in this session** — the coder session has no human; F1 is closed on
  the coder's frozen interaction decisions and the BA's Contract-exit pass judges them (the
  `2026-06-14-dfcfbi-f1-needs-human-review` lesson is named here, not met).

## Do

- 2026-10-19 — round opened on `release/v0.0.1-rc.4` at `2f8b34c` (R198–R200 in Review).
- 2026-10-19 — **4.1 deferred** (owner, relayed by the orchestrator): `rc4.md` § 4.1 carries the
  deferral and its reason, the rc.4 exit-gate line names it, the program table reads `deferred`,
  and a rolling-log row records it with its reopen trigger.
- 2026-10-19 — **D**: the 4.8 spec in [`rc4.md` § 4.8](../programs/release-rc2-rc5/rc4.md)
  (Track / Flow / Depends on / Design rows, bullets, tests; the Evolution-Rule line "Track: 1.
  Pulled by: …"), the order note, the exit-gate line; the program-table row and the gate summary
  in `release-rc2-rc5.plan.md`. New
  [`_shared/definition-pack.md`](../../design/data-management/_shared/definition-pack.md) (Draft —
  the pack, export, import in four steps, the plan, caps, the modal, criteria 1–15, OUT with
  triggers); `workspaces/workspaces.md` (the two card-menu items) and `_noun-model.md` (ids stay,
  names travel) point at it. Design lint, token parity, md lint 0.
- **Design gate closed** — the user journey and criteria 1–15 in
  [`definition-pack.md` § Acceptance](../../design/data-management/_shared/definition-pack.md);
  the model check below; committed as `docs(R201): D — …`.

**Model check** (Design gate):

- Noun-vs-mode: mode of the existing create / update writes — a pack is a transport file, not a
  stored noun (no table, no id, no migration); the import is the six existing writes run under one
  transaction, the export a read of existing rows.
- Discovered-vs-imposed: evidence found independent of this design — names are already unique
  per kind per workspace (the `*_name_unique` indexes), ids are minted per install (`secrets`
  tokens in every create), query filters address columns by 0-based index (R200 BA-C2), widget
  notes key on `<dsh>:<wdg>` (`app/metadata.py`); the pull is the R200 hand-over and an earlier
  hand-built parity probe. Imposed and not yet proven: that one global conflict choice is enough
  (a per-noun choice is OUT with a trigger).

**`ux-design` (design-spec, the two card actions and the import modal)** — Findability: both
actions in the workspace card's ⋯ menu beside Relationships / Rename (the workspace is the unit
a pack is cut from and applied to); Usability: the dry run runs on file choice and on every
conflict-choice change, so the plan on screen is always the one Import applies; Import counts
what it writes and is disabled with the reasons visible in the rows; Accessibility: every action
tag carries its word, the dataset lines say "not in this workspace" / "columns differ" in text,
the radio has help text, the modal title names the target workspace; Credibility: the plan comes
from the server's own dry run (same code as the apply), a refusal on Import shows the server's
new plan, nothing is written on any refusal; Utility: bring a working analysis into a second
workspace or install without retyping it, and re-apply a fixed version later; Desirability: AntD
`Modal` / `Upload.Dragger` / `Radio` / `Table` / `Tag` / `Alert`, no new token. Gap noted, not
blocking: no per-noun choice (OUT with a trigger).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                                                                                                                   |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | the modal: not a pack · plan ok · plan blocked (missing / differing dataset, conflict, can't import) · nothing to import · refused on import · pack invalid; per noun six actions under three conflict choices (§ Import step 3) |
| 2. New interaction pattern           | no     | file in → server check → confirm is the dataset upload / refresh wizard's shape; the plan is an AntD table of tagged rows                                                                                                      |
| 3. High user-error risk              | yes    | one click writes many nouns; `replace` overwrites definitions that dashboards and workflows read (restorable only one noun at a time from History); a pack into the wrong workspace leaves many nouns to delete by hand       |
| 4. Contract depends on unresolved UI | yes    | the request shape follows UI calls the spec leaves open: one conflict choice per import vs per noun, dry run as a flag on one route vs a separate route, whether a refusal returns the plan for the modal to show             |
| 5. UX confidence below threshold     | no     | the layout and copy are in the design's ASCII intent; every primitive is an AntD one already in use                                                                                                                            |

Result: **Flow: DFCFBI (triggers 1, 3, 4)** — F1 (the builder against MSW) before the contract;
F2 against the contract-derived MSW after it.

## Check

_Open._

## Act

_Open._

## Feeds into → Round_202

_Written at close-out._
