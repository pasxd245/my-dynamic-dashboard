# Round 138: Workflow update — `PUT /workflows/{id}`

**Status**: Review
**Date started**: 2026-07-01
**Date completed**:
**Flow**: **DCFBI** — Contract + Backend (no UI); the update endpoint the FE edit mode (R139) needs.

## Goal

**Inherits from ← [Round_137](Round_137.md)** — R137 shipped create/run/view/delete but found there is
no `PUT /workflows/{id}`, so editing a saved workflow wasn't wireable. Add it: edit name + definition,
re-validating sources + name-uniqueness, and **invalidate the materialized output when the definition
changes** (the frozen result no longer matches → must re-run).

_Track: 1. Pulled by ← R137's scope-correction gap. Mirrors the queries `PUT` shape + reuses the
workflow router's `_validate_sources` and name-unique handling — no new engine._

## Plan

- [x] `UpdateWorkflowBody` (name + definition) in `models/common.py`.
- [x] `PUT /workflows/{id}` — 404 absent · 422 bad source · 409 name_taken · 200 updated; clears
      `output_columns_json`/`materialized_at` iff the definition changed.
- [x] Contract `workflows/put.contract.yaml` (operationId `updateWorkflow`).
- [x] pytest (name+def change · def-change clears materialized · name-only keeps it · 404 · 409 · 422).

## Design note — YAML import/edit is PARKED (not in scope)

The user asked whether we support importing/editing a workflow as a **YAML spec**. **Today: no** — the
definition is JSON, authored/edited only through the UI builder. Decision: **keep edit UI-based; park
YAML import/edit.** A raw-spec editor cuts against the #1 value (ease — escape Excel, zero formulas):
per the product doctrine, _"if a screen makes the user write/read a formula to verify, we've become
Excel-with-extra-steps"_ — a YAML spec is exactly that. YAML import could later serve the **#2 AI-loop**
(an agent emits the spec) or power-user portability — additive-premium, adopt only on a real pull.
So R138/R139 edit = UI; YAML = parked behind a #2/power-user need.

## Risks / unknowns

- **Definition change invalidates the materialized output.** A PUT compares the new definition dict to
  the stored one; on change it NULLs `output_columns_json` + `materialized_at`, so `GET /rows` 404s
  until re-run (honest — the frozen output no longer matches). A name-only edit keeps the output.
- **No auto-re-materialize on edit** — run stays explicit (the frozen-output model). Consistent with
  R134/R137: editing defines, Run produces.

## Do

**Built:** `PUT /workflows/{id}` — edits name + definition, re-validates each source is a
query/workflow in the workspace (422), keeps names unique per workspace (409), and clears the
materialized output when the definition changes (a name-only edit preserves it). `UpdateWorkflowBody`
model + `put.contract.yaml`. Reuses `_validate_sources` + the create path's name-unique handling; no
engine change.

**Verification:** backend `pytest` **287 pass** (6 new: name+def change + contract, def-change clears
materialized (rows→404), name-only keeps materialized, 404, 409 name_taken, 422 bad-source) · `ruff`
clean · FE contract-validator green (the new YAML dereferences).

## Check

- [x] Backend 287 (6 new); ruff clean; no regression.
- [x] Update edits name + definition; def-change clears materialized (rows 404); name-only keeps it.
- [x] 404 / 409 name_taken / 422 bad-source map correctly; contract dereferences.

## Act

**Learnings:**

- **The materialize-freeze model makes "edit" have a consequence** — a live query needs no
  invalidation, but a workflow's frozen output must be dropped when its definition changes. The
  edit endpoint is where "materialized ≠ live" earns an explicit invalidation step.
- **The YAML fork is a doctrine call, not a feature toggle** — surfacing it at the endpoint round
  (before the FE edit UI) kept R139's design honest: UI-first, YAML parked.

**Promotions:** none.

**Prune check:** nothing pruned.

## Feeds into → Round_139

`PUT /workflows/{id}` exists. R139 = FE edit mode (DFCFBI): a `workflowsApi.update` + edit affordance
reusing the builder (source picker + `StepsEditor`) on a working copy, Save via PUT, with a "re-run to
refresh" cue when the definition changed. Feel-review (F2) runs the app.
