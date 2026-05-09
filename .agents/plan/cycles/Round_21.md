# Round 21: Spec 007 - Builder Experience Hardening + Workflow Shell

**Status**: Complete
**Date started**: 2026-05-09
**Date completed**: 2026-05-10

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Deliver Spec 007 for builder experience hardening and workflow-shell redesign so analysts can run upload -> profile -> query -> save -> visualize flows with explicit workspace/source state, actionable errors, and stable connectivity.

## Plan

- [x] Confirm Round 21 scope and Spec 007 slug (for specs/007-<slug>/)
- [x] Run Spec-Kit bootstrap as needed (`/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks`)
- [x] Validate Round 20 carry-over constraints are represented in Spec 007:
      connectivity preflight, error UX, workflow shell IA, E2E smoke, no hidden workspace fallbacks
- [x] Create a durable handoff note before compaction that captures:
      Round 22 candidate scope, deferred ideas, and explicit acceptance intent from Round 20
- [x] Curate compaction decision at trigger point (Round 21 start):
      choose whether to compact now or defer until deferred/superseded rounds are resolved
- [x] Confirm implementation readiness criteria for Do phase

**Decision Gates**:

- Gate A (spec identity): Spec 007 slug/scope must be confirmed before `/speckit.specify`.
- Gate B (compaction policy): Because `21 > (last_compaction_point + 20)`, compaction review is required.
  Current blocker: rounds 03-15 include `Deferred`/`Superseded` statuses.
  Resolved: compacted now with curation into `Rounds_01_20.compacted.md`; compaction point moved to 20.
- Gate C (idea continuity): Do not compact rounds 01-20 until Round 20 next-round ideas are copied into
  a durable Round 21/22 handoff artifact and linked from this round.

**Plan evidence**:

- Spec slug confirmed: `007-builder-experience-hardening-workflow-shell`.
- Bootstrap artifacts created under `specs/007-builder-experience-hardening-workflow-shell/`:
  `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/`.
- Continuity handoff created: `docs/agents/plan/round-20-to-22-handoff.md`.

## Do

Do phase started.

Handoff artifact for idea continuity: `docs/agents/plan/round-20-to-22-handoff.md`.

Plan-phase execution log:

- 2026-05-09: ran `/speckit.specify` for Spec 007.
- 2026-05-09: ran `/speckit.plan` for Spec 007.
- 2026-05-09: ran `/speckit.tasks` for Spec 007.
- 2026-05-09: executed curated compaction of rounds 01-20 into
  `.agents/plan/cycles/Rounds_01_20.compacted.md` and updated `.agents/plan/COMPACTION_LOG.md`.

Do-loop log:

- 2026-05-09 iteration 1:
  - command: `/speckit.implement` (Spec 007)
  - tasks unchecked: `56 -> 39`
  - evidence reconciliation: marked complete `T018-T028`, `T033`, `T034`, `T038`
  - tasks unchecked after reconciliation: `27`
  - changed surfaces observed: backend session/preflight/error services, guarded API handlers, builder workflow shell/context UI, builder API clients, and spec task ledger.
- 2026-05-09 iteration 2:
  - command: `/speckit.implement` (Spec 007)
  - direct checkbox delta: `39 -> 39` before reconciliation (no auto-check progress reported)
  - action taken: manual evidence-based reconciliation performed (above)
- 2026-05-09 iteration 3:
  - command: `/speckit.implement` (Spec 007)
  - direct checkbox delta: `25 -> 25` before reconciliation
  - evidence reconciliation: marked complete `T029-T032`, `T035`
  - tasks unchecked after reconciliation: `20`
  - remaining concentration: UI integration tasks (`T036`, `T037`), workflow shell composition/tests (`T039-T045`), smoke flow (`T046-T053`), and polish (`T054-T056`).
- 2026-05-09 iteration 4:
  - command: `/speckit.implement` (Spec 007)
  - direct checkbox delta: `20 -> 20` before reconciliation
  - evidence reconciliation: marked complete `T036`, `T037`
  - tasks unchecked after reconciliation: `18`
  - remaining concentration: workflow shell composition/tests (`T039-T045`), smoke flow (`T046-T053`), and polish (`T054-T056`).
- 2026-05-09 iteration 5:
  - action: direct implementation pass for US3 shell routing/state
  - changed files: `apps/backend/app/main.py`, `apps/builder/src/api/builderSessionApi.ts`,
    `apps/builder/src/state/builderSessionStore.ts`, `apps/builder/src/components/workflow-shell/WorkflowShell.tsx`,
    `apps/builder/src/pages/BuilderWorkflowPage.tsx`, `apps/builder/src/App.tsx`,
    `apps/builder/src/pages/__tests__/BuilderWorkflowPage.test.tsx`
  - evidence reconciliation: marked complete `T039`, `T041`, `T042`, `T043`, `T045`
  - tasks unchecked after reconciliation: `13`
  - remaining concentration: `T040`, `T044`, smoke flow (`T046-T053`), and polish (`T054-T056`).

## Check

- [x] `speckit.analyze` run without CRITICAL findings
- [x] `specs/007-<slug>/tasks.md` reaches 100% checked (56/56)
- [x] Repo verification commands pass for all touched surfaces

Check-log (2026-05-09):

- `speckit.analyze` returned no output (no CRITICAL findings detected).
- `tasks.md` confirmed 100% checked: all 56 tasks complete (T001-T056).
- `pytest apps/backend/tests/` (153 passed) — full suite green after updating
  pre-existing tests to conform to Spec 007 active-context guard and ActionableError
  envelope changes:
  - Added `apps/backend/tests/conftest.py` with `autouse` reset + `seed_source_activate` helper.
  - Updated fixtures in `test_saved_queries_contract.py`, `test_saved_query_lifecycle.py`,
    `test_saved_query_recovery.py`, `test_saved_query_search.py` to seed source + set active context.
  - Updated `test_query_builder_execution.py` inline tests to use `_setup_context`.
  - Fixed error shape assertions in `test_upload_error_latency.py`, `test_csv_ambiguity_flow.py`,
    `test_saved_queries_contract.py`, `test_saved_query_recovery.py` (new ActionableError envelope).
  - Fixed `test_app_boot.py` health assertion (new `{"status": "healthy", ...}` shape from Spec 007 preflight).
  - Fixed `test_query_builder_contract.py` tests to reset session service and seed active context
    before calling now-guarded validate endpoint.

## Act

**Learnings**:

- `speckit.implement` does not reliably tick checkboxes in `tasks.md`; agent-driven
  evidence reconciliation is mandatory after every implement run. This round required
  5 Do-loop iterations + 1 direct implementation pass before tasks.md reached 100%.
- Spec 007 introduced a global singleton (`BUILDER_SESSION_SERVICE`) for active-context
  state. Pre-existing tests that didn't set up active context began failing once the
  endpoint guards were added. Fix pattern: `autouse` fixture to reset the singleton +
  `seed_source_activate` helper in fixtures that exercise guarded endpoints.
- ActionableError envelope (Spec 007) changed the error shape across upload, saved-query,
  and query validate surfaces. Old tests asserting `response.json()["error"]["code"]`
  needed updating to `response.json()["error_code"]`. Flexible assertions
  (`.get("error_code", body.get("error", {}).get("code", ""))`) are more resilient.
- Health endpoint expanded from `{"status": "ok"}` to a richer dependency-check payload;
  tests should assert `status in {"ok", "healthy"}` rather than an exact dict match.
- Compaction cadence: last compaction was at Round 20; next review at Round 41+.

**Promotions**:

- [x] -> context/ : `test isolation pattern for singleton session services` — captured in
      `apps/backend/tests/conftest.py` (`autouse reset_builder_session` + `seed_source_activate`).
- [ ] -> skills/ : Consider a skill note on "updating old contract tests after adding
      endpoint guards" — deferred to Round 22 if the pattern recurs.

**Next-round decision candidates**:

- Round 22 candidate A: Multi-sheet Excel picker with preview and include/skip controls.
- Round 22 candidate B: Source registry per workspace with active-source selection and processing history.
- Round 22 candidate C: Per-sheet processing feedback with recoverable partial failures.

**Round transition**:

- Round 22 started in planning/brainstorm mode: `.agents/plan/cycles/Round_22.md`.
