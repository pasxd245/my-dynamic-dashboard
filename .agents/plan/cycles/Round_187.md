# Round 187: workflow run stamps + stale flag (W-7) — and the G-wf evidence

**Status**: Review — B, F, C and the visual gate done; G-wf evidence assembled; awaiting the human acceptance walk (W1–W4), the G-wf call, and sign-off
**Flow**: DCFBI — one stamp written at run, one comparison on read, contract-first; each staleness cause reproduced and pinned.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — every workflow run is stamped by the server: `run.id` (`run_<8 hex>`, new each
run), `run.number` (1, 2, 3 … per workflow, never reset), `run.definitionHash` (the very value
a metadata entry anchors as `definitionVersion`), and per source what the run read — a query's
definition hash and the `dataVersion` (R185) of every dataset it reads, or a workflow source's
run id. On every read the stamp is compared with the database now (metadata lookups, no data
scanned) and `staleSources` names each source that moved: `source_missing`,
`definition_changed`, `data_refreshed`, `source_rerun`. A flag, never a block — the frozen output
stays readable, which is what R174 W-7 called the noun's real capability (an archive) — and a
re-run clears it. The workflow page shows **Run #N** and a warning listing each moved source above
the output. Migration `0007_workflow_runs`; workflows run before it carry no stamp until their
next run. Backend 565 · builder 444 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** one `dataVersion` per source would
do. **Saw** that a query source reads several datasets (its driving source plus every join hop),
and that a workflow source has no `dataVersion` at all — its identity is its last run. **Now
believe (high)** that "what a run read" is a small tree — query → definition + datasets;
workflow → run — and that the stamp must keep the leaves, because a refresh of a joined
dimension table moves the numbers as surely as one of the driving table.

**Watch** — staleness is computed per read (one small lookup per source and dataset) on the list
too; fine at tens of workflows. Two queries with identical definitions share a `definitionHash`
(it hashes the definition, not the id). A stamp records the datasets a query read _at run_; a
query edited to read a different dataset reads `definition_changed` first, which is the right
cause. Pre-0007 materialized workflows cannot be judged and show no flag.

## Goal

**Inherits from ← [Round_186](Round_186.md)** — the last T-b round. R174 W-7: delete a
workflow's source query and the workflow keeps serving its frozen rows with nothing to say so;
W-4: a 7× divergence between a workflow and its own source, with `materializedAt` the only clue
and nothing to compare it with. R185 gave datasets a version; this round makes a run record the
versions it read.

Stamp each run with what it read, and say when that is no longer what is there.

_Track: 1 (product). Pulled by: the rc.3 plan's T-b / W-7 ("at run, the workflow records
`definition_hash` + each source's `data_version` and `run_id`; a source changed after the run →
the output is flagged stale") and gate G-wf — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: first run → number 1 with a stamp naming the query's hash and `{ds: 1}`;
second run → number 2, new id; dataset refresh → `data_refreshed` on detail and list, output
unchanged, re-run clears it and stamps `{ds: 2}`; query edit → `definition_changed`; query
delete → `source_missing` with rows still served; a workflow source re-run → `source_rerun`;
workflow edit → stamp cleared, next run number 3; a body carrying `run` → 422.
**Falsified if**: a client can write a stamp, or a moved source goes unflagged.

- [x] **D** — the stamp is a tree of what was read; staleness is a comparison on read, never
      stored (it cannot go stale itself); counter survives definition changes.
- [x] **C** — `_shared/workflow.yaml`: `WorkflowRun` (readOnly) and `Workflow.run`,
      `Workflow.staleSources` (reasons enum, `name` when the source still exists).
- [x] **B** — `db_models.Workflow` (`run_id`, `run_number` DEFAULT 0, `run_json`);
      `alembic/versions/0007_workflow_runs.py`; `app/workflow_runs.py` (`stamp_sources`,
      `stale_sources`); `metadata.definition_version`; `models.WorkflowRun` /
      `WorkflowStaleSource`; run writes the stamp, PUT clears it, every read computes
      staleness; parity legacy + head pin; `tests/test_workflow_run_stamps.py` +8.
- [x] **F** — types; **Run #N** tag in the summary strip; the stale warning (one line per source,
      by reason); EN/VI; MSW fixture stamp + run counts up; `tests/workflow-run-stamps-r187.test.tsx`
      +3.
- [x] **I / visual gate** — on the cloud runner: 0007 ran on the scratch database; the R186
      workflow (materialized before 0007) showed no stamp; run → Run #1 with both sources at
      `{ds: 3}`; refreshing their dataset → the warning names both sources ("Data behind … was
      refreshed after this run") above the unchanged output; Re-run → Run #2, warning gone.

## G-wf — evidence for opening T-c (publish)

The gate: _"double-count, shape divergence and source change are all caught; `data_version` /
`run_id` written by the server, not writable by a client. No pass, no publish."_

| Condition                                    | Caught by                                                                                                                                             | Round     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Double-count — the same source twice         | 422 `duplicate_source` — `test_the_same_source_twice_is_refused_on_save`                                                                              | R186      |
| Double-count — overlapping sources           | `Source.Query` splits the total (35 / 30) — `test_overlapping_sources_are_separable_by_provenance`                                                    | R186      |
| Shape divergence on save                     | 422 `sources_diverge` — `test_divergent_sources_are_refused_on_save_instead_of_narrowing`, `test_a_type_clash_is_refused_but_integer_and_float_widen` | R186      |
| Shape divergence after save                  | 409 at run, last output kept — `test_shapes_that_diverge_after_save_make_the_run_stale`                                                               | R186      |
| Source never resolved                        | 422 `unresolved_source` — `test_create_over_an_unrun_workflow_source_returns_422`                                                                     | R186      |
| Source refreshed / edited / deleted / re-run | `staleSources` reasons — the four `test_workflow_run_stamps.py` cases                                                                                 | R187      |
| `dataVersion` server-only                    | `test_no_request_body_can_set_the_data_identity`, `test_every_refresh_mode_bumps_the_version_and_restamps`                                            | R185      |
| `run` stamp server-only                      | `test_no_request_body_can_write_a_stamp`                                                                                                              | R187      |
| A joined dimension refreshed                 | `data_refreshed` — `test_refreshing_a_joined_dimension_flags_the_workflow` (the stamp keeps every leaf dataset)                                       | close-out |
| The source **dataset** deleted               | `source_missing`, rows still served — `test_deleting_the_source_dataset_flags_missing_and_the_output_survives`                                        | close-out |

**Agent's recommendation (2026-10-17): pass.** Every condition has a test that fails without the
guard; the dogfood parity (below, § Do) shows nothing else moved; the two gaps a pre-lock read
found — a refresh of a joined-in dataset and the deletion of the dataset under a source query — are
pinned by the two close-out tests and passed without a code change. Still the owner's call, taken
together with walk session B ([walk pack](../programs/release-rc2-rc5/walk-rc2-rc3a.md)).

## Risks / unknowns

- **Read cost on the list** — a stamp check per workflow per list call; bounded by source and
  dataset counts. Measure on the dogfood copy at the parity step.
- **Archive semantics** — a stale output is still served to anything reading it; T-c's frozen
  copies will rely on exactly that, with the banner the plan specifies.
- **Started before G-start3** — as R184.

## Do

- 2026-10-15 — C + B: migration, module, models, router; the run response already conformed
  except for the new fields, so the two existing contract-validated run tests failed until the
  schema landed (as they should). 8 tests. Backend 565.
- 2026-10-15 — F: types, tag, warning, i18n, MSW, 3 tests. Builder 444.
- 2026-10-15 — visual gate (above). Nothing written under `workspace/apps/backend/data/`.
- 2026-10-15 — **rc.3 batch-1 evidence: dogfood before / after parity** (release-level, logged on
  the last round of the batch). On the owner's machine, against two COPIES of the external
  dogfood data (kept outside this repo; never left the machine; deleted after), the rc.2 code
  (`5649834`) and `release/v0.0.1-rc.3` (`93e18c2`, from the transfer bundle) each ran the G-rc2
  probe, recording only sha256 prefixes and counts:
  - **119 / 119 items identical** — workspaces, 8 datasets × (meta without the new
    `refreshedAt` / `dataVersion`, schema, every row), 40 saved queries × (definition + resolved
    columns, unpaged result), 5 dashboards, 9 widget aggregates.
  - **Migrations on the real database copy**: `0004 → 0005 → 0006 → 0007` applied cleanly (the
    dogfood database is still at the rc.1 pin's head).
  - **R185 on real data**: all 8 datasets read `dataVersion` 1 with `refreshedAt = createdAt`.
  - Not exercised: R184 (no saved definition uses `compute`), R186 / R187 (the dogfood workspace
    has no workflows).

## Check

- [x] backend 565 · builder 444 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Migration up on a database with workflows; up + down through 0007 in a test
- [x] Visual gate (UI-bearing round): real browser, screenshot kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — the warning sits between the
      summary and the output it qualifies; Usability — says which source and why, and the
      remedy (re-run) is the primary button; Accessibility — an alert with a list; Credibility —
      the numbers below are labelled as the last run's; Utility — "can I trust this table?";
      Desirability — one warning, gone after a re-run.
- [x] ⟢ At a glance **Studied** line written
- [ ] **G-wf** (owner) — the evidence table above
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 4`:
  - ⬜ W1 — run a workflow: the summary shows Run #1; run again: Run #2.
  - ⬜ W2 — refresh a dataset one of its source queries reads: the workflow page warns, naming
    that source; the table below still shows the last run's numbers. Re-run: the warning goes.
  - ⬜ W3 — edit, then delete, a source query: the warning names the cause each time; after the
    delete the output is still readable.
  - ⬜ W4 — a workflow built on another workflow: re-run the inner one; the outer one warns.

## Act

_(at close)_

## Feeds into → Round_188 (TBD)

**Stop for review.** Re-baselined 2026-10-17 by the program
[release-rc2-rc5](../programs/release-rc2-rc5/rc3.md): R188 is item **3.4 — refresh with several
files at once** (then 3.5 `replace_period`), which the 2026-10-17 decision places before publish.
Publish + saved copies in `<workspace>-saved` (item 3.6: lineage from this round's run stamp, no
refresh, no re-run, read-only, banner "frozen at run #N on …, not the current numbers") opens only
after G-wf.
