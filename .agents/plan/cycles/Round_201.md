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

- with no conflicts, or with Replace it, an imported query, widget or workflow reads a different
  row or cell than its original over the same data (BA-C1: Keep mine binds to the target's own
  noun by design, with a warning);
- a pack holds an install id, or importing it twice writes anything the second time;
- a dry run or a refused apply leaves any row changed, or an apply writes part of a pack;
- an imported or replaced noun skips a check its own route runs, or lands without its history row;
- an existing route's request or response changes a byte.

- [x] **D** — the 4.8 spec in `rc4.md` + the program-table row + the exit-gate line; design doc
      [`_shared/definition-pack.md`](../../design/data-management/_shared/definition-pack.md)
      (new, Draft); `workspaces.md` and `_noun-model.md` pointers; `flow-selector`
- [x] **F1** — the builder against MSW before the contract (types, `definitionsApi`, hooks, the
      card actions, the import modal, MSW handlers, EN / VI, tests); interaction decisions frozen
- [x] **C** — `_shared/definition-pack.yaml`, `workspaces/definitions-get` +
      `definitions-import` route contracts (+ rationale), the three error codes through the whole
      chain; MSW validated against the YAML. **BA pass 1 at Contract exit.**
- [x] **F2** — the confirmation pass against the contract-derived MSW
- [x] **B** — extract the six create / update bodies; `app/definition_pack.py`;
      `routers/definitions.py`; tests (criteria 1–13)
- [x] **I** — the builder against the real backend; visual gate (light EN + VI; dark N/A — no theme)
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

The design calls the BA judges at Contract exit (each in
[definition-pack.md](../../design/data-management/_shared/definition-pack.md)):

_BA pass 1 (Contract exit): calls 2–6 and 8–11 accepted; call 1 disputed in part (BA-C1) and call 7
in full (BA-C3) — both folded as the orchestrator decided (§ Do › Contract exit). The text below is
the call as made; the folds amend 1, 7 and 11 and add the deferral (BA-C2) and dataset closedness
(BA-C4)._

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

### F1

- 2026-10-19 — **F1** (the builder against MSW, before any contract; timebox ≤ 2 days — used part
  of one session). New `features/data-management/workspaces/definitionPack/`: `types.ts` (the
  pack, the plan, the three error bodies), `plan.ts` (`readPackText`, `packFileName`,
  `packCounts`, `columnDifference`, `writeCount`, `canImport`, `nothingToImport`, `downloadPack`),
  `hooks.ts` (`useImportPlanMutation` — the dry run, `useApplyPackMutation` with
  `IMPORT_INVALIDATES`, `useExportPackMutation`), `useExportDefinitions.tsx` (download, toast, the
  "Fix these before exporting" modal), `ImportDefinitionsModal.tsx` (drop zone, conflict radio,
  datasets, plan table, Import / nothing-to-import / refused-on-apply / pack-invalid states);
  `api/definitionsApi.ts` (`PackErrorThrown` carries the plan or the problems — the pack codes
  are read by the client itself, so F1 touches no shared error union); the two card-menu items in
  `WorkspacesPage.tsx` (Export on main and saved, Import on main only). MSW
  `mocks/definitionPack.ts` (the fixture workspace's pack by name; the plan rules of design
  § Import step 2–3 without the save checks; apply 409 when not ok; a saved workspace 409
  `read_only_workspace`), registered as `exportDefinitions` / `importDefinitions` (no contract
  yet → not validated until C). EN / VI under `workspaces.pack.*`.
  `tests/definition-pack-r201.test.tsx` (18): the pure rules; the card menus (main / saved);
  export download name + toast; the unresolved modal; not-a-pack sends nothing; a clean workspace
  (missing dataset, Can't import + needs, Import disabled); columns in another order (the first
  difference); the same pack again (nothing to import); conflict → Replace re-checks, warns,
  imports, and a cached queries list re-reads under the app's 60 s `staleTime` (review-qa item
  10); Keep mine; a 409 on Import shows the server's plan; pack version 2; a reference line; VI.
  `tsc` clean. Found and fixed in F1: an i18next interpolation value named `replace` (an i18next
  option) blanked every value of the import toast — renamed `created` / `replaced`.
- **F1 against MSW in a real browser** (Vite dev with `VITE_MOCKS=1`, headless Chromium, light,
  EN + VI): `scratchpad/r201/f1shots/` — menu, export toast, nothing to import, conflict / Stop,
  Replace + warning, blocked (missing + columns differ), pack version 2, not a pack, imported
  toast. Read back: the two full column lists of a differing dataset were unreadable in one red
  line → changed to the first place the lists part (`columnDifference`, design § Layout); "that
  noun's History" was jargon → "its History, so it can be restored".
- **F1 gate closed** — the interaction decisions are frozen in
  [`definition-pack.md` § Layout › Interaction decisions (F1)](../../design/data-management/_shared/definition-pack.md)
  (six decisions + the shape questions handed to C); no open UX question is left for this round
  (a per-noun choice stays OUT with its trigger). Committed as `feat(R201): F1 — …`. The human
  feel-check the `dfcfbi-f1-needs-human-review` lesson asks for is not available in this session:
  the BA's Contract-exit pass reads the screenshots, and the owner's walk covers the rest.
- **`gate-walker F1`** (structural): the F1-closed line above cites the design section; the
  round file was clean after `332f4af` and `git log -- Round_201.md` shows the D and F1 commits —
  **gate F1 closed**, may advance to Contract.

### C

- 2026-10-19 — **C**: new `_shared/definition-pack.yaml` — `PackColumn`, `PackDataset`,
  `PackQuery` / `PackWorkflow` (+ `PackWorkflowSource`, `{query}` | `{workflow}`) /
  `PackDashboard` (definitions free objects with the renamed reference fields documented — the pack
  does not copy the three definition schemas; the target's own models read them), `DefinitionPack`
  (closed envelope, `packVersion` integer ≥ 1, lists ≤ 1 000), `OnConflict`, `PlanKind`,
  `PlanAction`, `PlanReason`, `PlanItem` (`id` only `qr_ / wf_ / dsh_`, `reason` + `detail`),
  `PlanDataset` (both column lists only on `columns_differ`), `ImportPlan` (`counts` per action),
  `PackProblem`, `UnresolvedProblem`. Route files `workspaces/definitions-get.contract.yaml`
  (`exportDefinitions`; 200 pack, 404, 409 `pack_unresolved`, 422) and
  `workspaces/definitions-import.contract.yaml` (`importDefinitions`; `dryRun`, `onConflict`,
  `WriterToken`; body the pack; 200 plan, 404, 409 `pack_refused` | `read_only_workspace`, 422
  `pack_invalid` | FastAPI) + one rationale `definitions-import.contract.md`. `_shared/api-error.yaml`:
  three codes in the enum + `ApiErrorPackUnresolved`, `ApiErrorPackInvalid`, `ApiErrorPackRefused`.
  The error-code chain in this one commit: `values.yaml` (`error_codes` + `constants.pack`: version
  1, 10 MiB, 1 000 nouns) → both constants templates (rendered) → the builder's `ApiError` union +
  `isApiError` → `definitionsApi` reads `ERROR_CODES`, `PACK_MAX_BYTES` reads `PACK.MAX_BYTES` → the
  MSW mock's ids now match `PlanItem.id`'s pattern. No existing response shape changes. Contracts
  **55** green (53 + 2); every example in the two route files validates against its schema (an
  Ajv pass over the dereferenced files, scratch); the MSW export and plans (dry run ok / blocked,
  apply) validate under the contract validator and an extra field does not (2 new builder tests →
  20 in the file). Builder **621** green (601 + 20; detached full run), `tsc` clean. No backend
  code yet (B): only the generated constants moved (`test_generated_constants` green).
- **Contract gate closed** — request / response / error shapes frozen in the files above; the MSW
  handlers `exportDefinitions` / `importDefinitions` validated against them; YAML committed as
  `docs(R201): C — …`. **Halt for BA pass 1 (Contract exit)** — handed to the orchestrator (the
  coder session cannot spawn reviewers, as in R198–R200); F2 / B wait for its findings.

### Contract exit — BA pass 1 and the folds

- **BA pass 1 (Contract exit, `2f8b34c..0b65575`, run by the orchestrator): CHANGES** — 0 P0,
  4 P1, 8 P2. Nine of the eleven design calls accepted; call 1 disputed in part, call 7 in full.
  Firewall, neutral wording, the Evolution-Rule line and the 4.1 deferral clean. F1 feel-check:
  the modal reads as understandable for a non-technical owner apart from the copy points below;
  six checks (a–f) go to the owner's walk. Decisions on the P1s by the orchestrator; folded here
  before any backend code:
  - **BA-C1 (P1)** — `source_differs` now blocks under **all three** choices. Under Keep mine a
    kept noun whose definition differs still binds the pack's readers, but each such reader row
    carries `binds` and the visible reason "uses the query X here, which differs from the pack —
    numbers may differ", and the plan counts them (`warnings`). Falsification line 1 scoped to "no
    conflicts, or Replace it". Owner question 3.
  - **BA-C2 (P1)** — a dataset published by a workflow in the same pack: the pack marks it
    `publishedBy: <workflow>`; missing in the target it is `awaits_publish`, the workflow is
    created as usual, its readers (queries, and the nouns that need them) are `deferred` with
    "needs <dataset>, which workflow <W> publishes — run and publish it, then import this pack
    again" (the orchestrator's wording said "run"; a run does not create the dataset — publishing
    does, R192 — so the copy says "run and publish"); the rest applies in the one transaction;
    re-import is idempotent, so the second import adds what was deferred. "Whole pack or nothing"
    stays true for failures; `deferred` is a planned, named state, counted in the plan and the
    toast. The parity fixture gains a published dataset (import → run + publish → re-import →
    parity). Owner question 1, with this as the built answer.
  - **BA-C3 (P1)** — the read order is size (10 MiB, before parsing) → JSON → `packVersion` →
    the one total cap (1 000) → the closed shape, validated by the route itself; a shape error is
    `pack_invalid` `reason: shape` with the field `path`; a newer version answers `version` even
    when its shape differs; the per-list `maxItems` are gone. The design's contradiction (its
    "unknown envelope fields are refused (`pack_invalid`)" vs criterion 9's "an unknown envelope
    field is `422`") resolved: both now say `pack_invalid` `shape`.
  - **BA-C4 (P1)** — closedness covers datasets: a query's `dataset` or a join end naming a dataset
    absent from `datasets[]` → `pack_invalid` `reference` (`refKind: dataset`); a `datasets[]`
    entry nothing reads → `unused`, ignored; two datasets with one name → `duplicate`.
  - **P2 folded:** C5 a blocked plan keeps a disabled "Import into <workspace>" without a count and
    the alert names the next step per cause; the enabled button reads "Import N into <workspace>".
    C6 "Keep mine" the one word for `skip` (radio, tag, counts, toast); "Stop" → "Don't import if
    anything conflicts"; the replace warning adds the slug (old links break) and the readers outside
    the pack. C7 an empty pack says so once; zero counts left out of both toasts. C8 the
    workflow-on-workflow shape check is deferred for any source without an output (not only those
    this import writes) + criterion 14 (the deferred check failing at run: the existing `409
    query_stale`). C9 errors and concurrency stated (an exception → the app's `500
    internal_error`, nothing written; a writer holding the lock past the 5 s busy timeout → the
    same 500 — today's behaviour of every write route — tested in criterion 8; a typed 409 is OUT
    with a trigger). C10 `planHash` on every plan, `expectedPlan` on apply, `pack_refused`
    `reason: plan_changed` | `not_ok`. C11 the owner's addition recorded against decision 3, the
    program row's status a listed word (`queued`), the parity pull named (`Round_183`, the G-rc2
    dogfood probe). C12 mapping a pack dataset to a differently named target dataset → OUT, trigger
    "a second user whose dataset names differ per install".
- **Fold** — design (§ Layout, interaction decisions amended, § The pack `publishedBy`, § Import
  read order + dataset statuses + the rule table + deferred + binds, § Errors and concurrency,
  § The plan, criteria 1–16, OUT), `rc4.md` § 4.8, the program plan (decision 3 note, the row's
  status); contract (`PackDataset.publishedBy`; `PlanAction` + `deferred`; `PlanReason` +
  `awaits_publish`; `PlanItem` `via` / `binds`; `PlanDataset` `awaits_publish` / `unused`;
  `ImportPlan` `planHash` / `warnings` / `counts.deferred`; `PackProblem` `path` / `detail` /
  `refKind: dataset`; one total cap; `ApiErrorPackInvalid` `shape`; `ApiErrorPackRefused`
  `reason`; the route's `expectedPlan`; examples re-validated against their schemas); F1 (types,
  `blockCauses` / `emptyPack` / `nonZero`, the modal's dataset lines, deferred tag, binds warning,
  next steps, button labels, toasts, `expectedPlan` on apply; the MSW mock's rules, hash and 409
  reasons; EN / VI). Builder **626** green (621 + 5 in the pack file, now 25; detached full run),
  `tsc` clean; contracts 55; every route example re-validated against its schema. `exportedAt`
  lost its `format: date-time` (the repo's timestamps are plain strings; Ajv logged it as unknown).

### F2

- 2026-10-19 — **F2** (the confirmation pass against the contract-derived MSW): the folded builder
  runs against `exportDefinitions` / `importDefinitions` handlers that the contract validator now
  checks (the 2xx bodies — the pack, the dry-run plan ok / blocked / with deferred rows / with
  `binds`, the applied plan — validate; an extra field does not); the 409 / 422 bodies follow the
  YAML's error shapes (`reason` on `pack_refused`, `path` on `shape`). The modal needed no shape the
  contract does not hold — no contract v2. Builder 626 at `f533100`.
- **F2 gate closed** — confirmation complete, no shape change re-routed; committed as
  `docs(R201): F2 — …`.

### B

- 2026-10-19 — **B**: the six create / update route bodies extracted into connection-taking
  functions that never commit — `write_query_create` / `write_query_update`
  (`routers/queries.py`), `write_dashboard_create` / `write_dashboard_update`
  (`routers/dashboards.py`), `write_workflow_create` / `write_workflow_update` + `_check_sources`
  (`routers/workflows.py`; `defer_unrun` for the import only — the routes keep R186's save check);
  `NounGone` in `routers/_shared.py` for an update whose noun is gone. The routes call them and
  commit; the PUTs take `BEGIN IMMEDIATE` first, so validation now runs under the write lock (the
  answers are unchanged — the routes' suites and criterion 13's test). New `app/definition_pack.py`:
  `read_pack` (size → JSON → version → the one total cap → the closed pydantic shape → the renamed
  reference fields → duplicates → references, datasets included → cycles; `PackInvalid`),
  `export_pack` (every listing `ORDER BY name, id` — review-cr item 13; definitions normalized by
  the app's models, `null` members dropped; `publishedBy` from `published_workflow_id`;
  `PackUnresolved`), `plan_import` (the dataset statuses; queries, workflows in Kahn order with a
  name heap, dashboards; each write in a `SAVEPOINT` so a refused noun is undone and the plan goes
  on; "unchanged" by `definition_version` of the candidate install form against the stored one —
  for a query without its `originRelationshipId`; `binds` / `warnings`; `deferred`), `plan_hash`.
  New `routers/definitions.py`: the export GET; the import POST reads the raw body itself
  (`Content-Length` over the cap → `too_large` before reading), runs in the threadpool, one
  `BEGIN IMMEDIATE` → dry run rollback / `plan_changed` / `not_ok` rollback / commit; a rolled-back
  plan names no id it minted. `tests/test_definition_pack.py` (19): criteria 1–14 — export shape
  (no install id, order, `publishedBy`, re-export equal), dangling references, **parity** into a
  clean workspace and into a second install (a second database + data root): import → the
  published dataset's readers deferred → run + publish → re-import → every query's rows, widget
  aggregate (with the saved controls) and workflow output equal A's; re-import writes nothing (a
  whole-database dump); datasets missing / columns differ / unused; dry run writes nothing, equals
  the apply, a stale `expectedPlan` refused; refuse / Keep mine (`binds`, `warnings`) / replace
  (id kept, one history row, a changed workflow's output cleared, a widget note kept, the slug
  taken); `source_differs` under all three, `slug_taken`; a failing last dashboard writes nothing;
  an exception half-way → 500, nothing written; a writer holding the lock past the 5 s busy
  timeout → 500, nothing written, the retry works; the read order (each `pack_invalid` reason
  and path); history + writer token; saved / unknown workspace; same install two workspaces
  (widget ids repeat, notes and deletes stay apart); a workflow over never-run workflows imports
  and its run refuses diverging shapes; the six routes' answers after the extraction. Every
  response checked against the contracts. Backend **775** green (756 + 19), `ruff check` clean.
- **Backend gate closed** — conformance (every route response validated against the two
  contracts) and behaviour tests green; committed as `feat(R201): B — …`.

### I

- 2026-10-19 — **I + visual gate (light, EN + VI; dark N/A — no theme, rolling log)**: the real
  backend (uvicorn :8000) on an **isolated root** (`scratchpad/r201/vis/data`, asserted empty and
  asserted as the app's DB and data root before seeding; the default
  `workspace/apps/backend/data/app.sqlite` untouched — mtime 11:51, before the round), seeded
  through the app with the parity fixture (`_build_a`: "Acme demo") plus "Acme copy" (the same
  two uploads, no definitions) and "Acme empty"; Vite :3000 without mocks; headless Chromium.
  Walked: export from Acme demo (downloads `Acme demo-definitions-2026-10-19.json`, toast) →
  import into Acme copy (two datasets found, `team_totals` awaiting publish, 6 new · 2 deferred,
  "Import 6 into Acme copy") → toast "Imported into Acme copy: 6 new, 2 deferred." → the Queries
  list shows the new queries without a reload (the cache re-read, review-qa item 10) → run + publish
  in Acme copy → import again (2 new · 6 unchanged) → the copy's dashboard **Weekly** reads as the
  original (the date range, the Team filter, the note, the region bars, the totals table); a
  changed pack into Acme demo: Don't import (conflict), Keep mine (the warning on the reader rows,
  "2 with a warning"), Replace it (the History / slug / outside-readers warning, "Import 1 into Acme
  demo"); the pack into Acme empty: blocked, the next step named, the disabled "Import into Acme
  empty"; VI for the blocked and Keep-mine screens. Screenshots `scratchpad/r201/vis/shots/` (25).
  **Found at the gate and fixed here:** under Keep mine with nothing to write the alert said
  "everything here already matches the pack" — false for the kept rows → "the rest already
  matches the pack; the rows marked Keep mine stay as they are here" (EN / VI, test); the modal's
  `maskClosable` (deprecated in AntD 6) → `mask.closable`; the next-step lines lost their trailing
  punctuation. Browser console: only the pre-existing `Drawer` `width` deprecation.
- **Integration gate closed** — the builder against the real backend end to end (above); the
  shared truth: the builder's MSW answers validate against the two contracts (builder tests) and
  every backend answer does too (`tests/test_definition_pack.py`); committed as `feat(R201): I — …`.

### Reviews after F

- **Code review (`2f8b34c..78e0474`): CHANGES** — 1 P1, 4 P2.
  - **CR-1 (P1)** — `_check_sources` with `defer_unrun` returned at the first source without an
    output and so skipped ALL of R186's save check: a workflow listing the same source twice
    ("Dup") or two diverging queries beside an unrun workflow ("Mixed") imported where the route
    refuses (`scratchpad/r201/cr/probe2.py`, `probe2b.py`). **Fixed:** the duplicate check runs over
    the whole list; resolution, parameters without a default and `sources_diverge` run over every
    source checkable now (the queries and the workflows with an output); only the comparison with a
    source that has no output waits for the run. Tests: Dup → `invalid` `check_failed`
    `duplicate_source…`, Mixed → `sources_diverge…`; the parity fixture still passes.
  - **CR-2 (P2)** — deeply nested JSON raised `RecursionError` → 500. **Fixed:** `pack_invalid`
    `shape` ("nested too deeply"); test with 100 000 levels.
  - **CR-3 (P2)** — the body was buffered whole when it carried no `Content-Length`. **Fixed:** read
    in chunks from `request.stream()`, refused as soon as it passes the cap; QA's chunked over-cap
    test adopted; the docstring now says so.
  - **CR-4 (P2)** — the export's reads ran in autocommit (several snapshots). **Fixed:** one `BEGIN`
    … `ROLLBACK` around `export_pack`.
  - **CR-5 (P2)** — the file name took the UTC date. **Fixed:** the local date; test at a fixed
    zone (UTC+7, 20:00 UTC → the next day's date).
- **QA: PASS** — 3 P2; clean gates matched; a two-install parity probe (78 checks) passed every
  acceptance item on both installs.
  - **QA-1 (P2)** — under `refuse`, a noun that differs itself but reads a conflicting noun was
    reported `invalid · needs X`, so the plan under-counted conflicts. **Fixed:** its own conflict
    takes precedence (`conflict` `exists`, `detail` = the conflicting noun it also reads, shown as
    a second line "also reads X, which conflicts too"); the rule is in the design's rule table;
    QA's strict-xfail `test_qa_refuse_names_every_conflicting_noun` now passes (xfail removed).
  - **QA-2 (P2)** — the visual-gate evidence: 24 shots on disk, `03b` a duplicate, 10 / 14 / 20 /
    23 with pre-fix copy. **Re-shot at the fix head** on a fresh isolated root
    (`scratchpad/r201/vis2/data`, asserted; default `app.sqlite` mtime 11:51 unchanged):
    `scratchpad/r201/vis2/shots/` (22) — export toast; the first plan top and its lower rows with
    the workflow rows and the deferred dashboard (the table body scrolled); the imported toast; the
    after-state lists (queries, workflows, dashboards before and after the publish); the second plan
    and toast; the copy's dashboard; conflict / Keep mine (the corrected copy) / Replace; **refused
    on import** (a query the plan replaced was deleted between the check and the click →
    `plan_changed`, the new plan and the alert); a Replace import into the copy and the replaced
    query's **History** (#2 Current over #1); blocked with the next steps; the **pack-version
    error**; the **unresolved export**; VI Keep mine and blocked. QA's own HEAD shots
    (`scratchpad/r201/qa/shots/`, EN + VI lists, history, toasts, refused, v2, unresolved) stand as
    independent evidence. The earlier `scratchpad/r201/vis/shots/` set is superseded.
  - **QA-3 = CR-3.**
  - **Adopted:** QA's `test_definition_pack_r201_qa.py` → `tests/test_definition_pack_adversarial.py`
    (+ the CR-1 / CR-2 tests).
- **Gates after the fold:** backend **792** (775 + 17: QA's 15 + CR-1 + CR-2), `ruff check` clean;
  builder **628** (626 + 2: CR-5, QA-1's second line; one detached full run with the backend idle),
  `tsc` clean; contracts 55; md / plan / design lints 0; M3 guard empty.
- **Rolling log:** QA found `/queries/{id}/aggregate` groups without an `ORDER BY` — a widget's
  aggregate rows came back in two orders over 40 reads of one workspace (pre-existing path, not
  R201's); logged as a P2 candidate, the 4th occurrence of the explicit-order class.

## Check

_Open._ Carried to the owner's walk — the F1 feel-check items the owner must still check by hand
(no human at F1; BA pass 1, verbatim):

- ⬜ (a) whether Stop / Replace it / Keep mine (now "Don't import if anything conflicts" / "Replace
  it" / "Keep mine") and the help line make clear what Keep mine does to the pack's dashboards;
- ⬜ (b) whether the column-difference line is enough to know what to fix in the export;
- ⬜ (c) whether "Import into <workspace>" plus the title is enough confirmation before writing many
  definitions into the right workspace;
- ⬜ (d) whether the raw dtype words (integer, string) are acceptable in VI;
- ⬜ (e) whether Export should appear on saved workspaces;
- ⬜ (f) the modal's height with a long plan — the blocked alert fell below the fold in
  `06_blocked_*`.

## Act

_Open._ Owner questions (BA pass 1, verbatim):

1. For a dataset that a workflow in the pack publishes (BA-C2): should the import create the
   workflow and leave its readers for a second import (breaks "whole pack or nothing"), or must the
   user upload that dataset first? — built: readers deferred, second import adds them.
2. Should a target dataset whose columns *extend* the pack's columns at the end (a newer export
   with one more column) be accepted? Index-addressed filters stay correct, but query outputs gain
   a column.
3. Under Keep mine, should the pack's readers bind to the user's own different definition at all,
   or be refused? — built: they bind, with a "numbers may differ" warning.

## Feeds into → Round_202

_Written at close-out._
