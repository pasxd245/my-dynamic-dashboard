# Round 186: consolidation guards — same shape (W-2), provenance (W-3), validate on save (W-5)

**Status**: Complete — the owner walked it (walk pack session B, 2026-10-18: all items passed, no findings) and instructed the flip ("All 45 passed, flip them").
**Flow**: DCFBI — three guards on one function (`build_consolidated_relation`), refused on save, drift on run; reproduced on the R174 shapes.
**Date started**: 2026-10-15
**Date completed**: 2026-10-18

## ⟢ At a glance

**Shipped** — a workflow's consolidation stops trusting its comments. On **save** (create and
edit) every source must resolve now — a workflow source must have been run (**W-5**) — appear
once (**W-3**: a source listed twice can only double every row), and have the first source's
shape: the same column names in any order with equal dtypes, integer and float widening to float
(**W-2**). A refusal is 422 in the validation envelope with the source's index and a code-led
message naming the sources and the differing columns; the builder turns it into one sentence
("Source 3 doesn't have the same columns as source 1 … missing ['agent_clean']; extra
['agent']") and keeps the draft. At **run**, shapes that diverged after save are drift (409
`query_stale`, the last output kept). With two or more sources the output gains a final
`Source.Query` column (the source's name; suffixed off a collision), so a stacked total can be
split by source — the R174 double-count is visible and undoable. A one-source workflow's output
is unchanged. Backend 557 · builder 441 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** W-3 needed an overlap detector
(sources sharing a dataset). **Saw** that "overlap" is often the point — every order plus the won
orders is a legitimate comparison — and the harm in R174 was that the rows were
_indistinguishable_, not that they were stacked. **Now believe (medium-high)** that provenance +
refusing the one case that is always wrong (the same source twice) is the right line; a
shared-leaf warning would flag correct work more often than wrong work.

**Watch** — the multi-select picker cannot pick a source twice, so `duplicate_source` arrives
only from API-written definitions (an agent); the builder still explains it. Save now resolves
every source plan (metadata only, no row scan). A workflow-of-workflows whose inner output has
`Source.Query` stacked with a source that lacks it is a shape divergence by design. Numbers in a
workflow output still format integer sums as `15.0` in the API (pre-existing, unchanged).

## Goal

**Inherits from ← [Round_185](Round_185.md)** — T-b continues. R174 found three of the
noun's correctness gaps on consolidate: the output schema silently narrowed to the first source
(W-2, columns written then unreachable), stacked overlapping sources double-counted with nothing
to tell rows apart (W-3), and a source that never resolved was accepted and failed only at run
(W-5). Gate G-wf ("double-count, shape divergence and source change are all caught") needs them
closed before anything is published from a workflow.

Turn the v1 assumptions into guards, at the moment a person (or an agent) can still fix the
definition.

_Track: 1 (product). Pulled by: the rc.3 plan's T-b (W-2, W-3; W-5 "with the
workflow-earns-its-place plan"), program
[workflow-earns-its-place](../programs/workflow-earns-its-place.plan.md) items 2 and 3, and the
13/10 decision "workflow is mandatory" (item 1 settled) — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: R174's `[status, amount]` + `[status, month, amount]` → 422 naming
`month`; integer + float → saves, output float; integer + string → 422; the same source twice →
422; an unrun workflow source → 422; every order + the won orders → output split by
`Source.Query` into 35 and 30; one source → no new column; edited-after-save divergence → 409 at
run with the last output intact.
**Falsified if**: any of the R174 shapes still saves, or a one-source workflow's output changes.

- [x] **D** — refuse at save (the definition is in hand), drift at run (409, existing code), and
      provenance only when there is more than one source to tell apart.
- [x] **B** — `query_engine.build_consolidated_relation` returns `(None, {reason, index, msg})`
      for `duplicate_source` / `unresolved_source` / `sources_diverge`; `_shape_mismatch`;
      `Source.Query` via `_consolidation_provenance_name`; `routers/workflows._validate_consolidation`
      on create + update; `tests/test_workflow_consolidate_guards.py` +7;
      `tests/test_workflows_run.py` — `n2 == 2·n1` now over two distinct queries + provenance
      counts, same-source-twice → 422, unrun source → 422 on save, unrun-since-save → 409.
- [x] **C** — contract text only (no schema change): `_shared/workflow.yaml` sources;
      `workflows/post|put` 422 codes; `workflows/run-post` 409 drift wording.
- [x] **F** — `workflowsApi.WorkflowSourceError` (lifted from the 422 envelope);
      `sourceErrors.sourceErrorText`; create + edit pages; EN/VI; MSW refuses a duplicate source;
      `tests/workflow-source-errors-r186.test.tsx` +3.
- [x] **I / visual gate** — on the cloud runner: two same-shape trim queries consolidated → the
      output shows `Source.Query` per row; editing the workflow to add the raw-agent query →
      the toast names source 3 and the differing columns, the form stays open.

## Risks / unknowns

- **Existing saved multi-source workflows** — re-running one now adds `Source.Query`; a widget
  over it would gain a column, not lose one. Divergent ones (R174's) now 409 at run instead of
  silently narrowing — the honest outcome; they need their sources fixed.
- **Save cost** — resolves each source's plan; no data is read.
- **Started before G-start3** — as R184.

## Do

- 2026-10-15 — B: guards + provenance; three existing tests encoded the old behaviour (the
  same query twice, an unrun workflow accepted, a 2-column union) and were rewritten to the
  ruling. 7 new tests. Backend 557.
- 2026-10-15 — F: typed error, sentence, pages, MSW, 3 tests. Builder 441.
- 2026-10-15 — visual gate: the first message showed source ids (`qr_…`); switched the server
  messages to source names. Nothing written under `workspace/apps/backend/data/` by the gate; a
  local check script run outside the test harness had written scratch files there (gitignored,
  fake data) — moved out to the scratchpad.

## Check

- [x] backend 557 · builder 441 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, screenshots kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — the refusal appears on Save,
      where the definition is being made; Usability — names the source by its position and the
      columns that differ; Accessibility — an error message, the draft kept; Credibility — every
      stacked row says where it came from; Utility — a total can be split by source; Desirability
      — one sentence, no dialog.
- [x] ⟢ At a glance **Studied** line written
- [x] **Acceptance walk** (human reviewer) — `coverage: 4 of 4`, walked 2026-10-18 (walk
      pack session B); no findings:
  - ✅ W1 — make a workflow from two queries with different columns. Save is refused, and the
    message says which source and which columns differ.
  - ✅ W2 — make one from two same-shape queries and run it. Every row has `Source.Query` with
    the source's name; grouping by it splits the total.
  - ✅ W3 — pick a workflow that was never run as a source. Save is refused (run it first).
  - ✅ W4 — open an existing one-source workflow and re-run it: same columns and numbers as
    before.

## Act

- Walk: 4 of 4 passed (session B, 2026-10-18); no findings, so nothing new goes to the
  rolling log.
- Promotion: none this round.
- Prune check: none — the round added no gate or convention.

## Feeds into → [Round_187](Round_187.md)

R187 — run stamps (W-7): each run records `runId`, the workflow's `definitionHash` and each
source's `dataVersion` (R185); when a source moves after the run the output is flagged stale.
Then the G-wf evidence.
