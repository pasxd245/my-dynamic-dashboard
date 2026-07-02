# Round 139: Workflows FE — edit mode

**Status**: Complete — F2 signed off 2026-07-01
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **DFCFBI — F + I slice** (D in the [workflows design doc](../../design/data-management/workflows/workflows.md), authored FIRST this round; C+B were R138's `PUT`; **F2 hard-stops for the human**).

## Goal

**Inherits from ← [Round_138](Round_138.md)** — the `PUT /workflows/{id}` endpoint exists; wire the FE
edit affordance R137 deferred. The workflow detail page gains an inline **edit mode** (mirroring the
query detail's [Edit]) that reuses the builder over a working copy and saves via `PUT`.

_Track: 1. Pulled by ← R137's deferred edit + R138's endpoint. D-gate FIRST this round (design doc
updated before code — the [[d-gate-artifact-in-design-corpus]] lesson applied). Reuses the extracted
`WorkflowForm` (name + sources + `StepsEditor`) so create + edit share ONE builder body._

## Plan

- [x] **D-gate**: fold edit mode into the workflows design doc (surfaces row, behaviour, C9, scope IN).
- [x] Extract `WorkflowForm` (name + `WorkflowSourcePicker` + `StepsEditor`); `WorkflowCreatePage` reuses it.
- [x] `workflowsApi.update` + `useUpdateWorkflowMutation`.
- [x] `WorkflowDetailPage` inline edit mode: [Edit] → `WorkflowForm` over a working copy → [Save] `PUT`
      (409 name_taken message) / [Cancel]; `excludeWorkflowId` = self.
- [x] MSW `updateWorkflow` handler (contract-validated) + edit-mode i18n (en/vi) + smoke test.
- [x] **F2 — human ran the app** (edited a workflow, saved, confirmed the re-run cue); signed off 2026-07-01.

## Risks / unknowns

- **Working-copy edit, not live** — [Edit] snapshots the current definition into draft state; [Save]
  `PUT`s. After a definition change the backend clears the materialized output, so the view returns to
  the never-run state — the honest "re-run to refresh" cue (no silent stale output).
- **`WorkflowForm` extraction** — the create page's form body moved into a shared component so edit
  reuses the exact authoring surface (no drift). `WorkflowCreatePage` keeps only the workspace select
  and the save action; behaviour unchanged.

## Do

**Built:** the detail-page edit mode. Extracted `WorkflowForm` (name + sources + steps) now shared by
create and edit. `WorkflowDetailPage` gains [Edit] → renders `WorkflowForm` over a working copy →
[Save] via `useUpdateWorkflowMutation` (`PUT`) with a name_taken message, [Cancel] discards; a
workflow can't source itself (`excludeWorkflowId`). `workflowsApi.update` + hook + MSW
`updateWorkflow` handler + en/vi strings. Design doc updated FIRST (D-gate honoured).

**Verification:** `tsc` clean · vitest green — `workflows.test.tsx` gains an edit-mode test (open →
form appears → Save → exits) driving the contract-validated `updateWorkflow`; the contract-validator
suite and the i18n en/vi parity checks pass. **F2 not yet run.**

## Check

- [x] `tsc` clean; workflow edit-mode test green; `updateWorkflow` contract-validated on call.
- [x] Create + edit share `WorkflowForm` (no duplicated builder body); design doc reflects edit mode.
- [x] **F2 — human ran the app** (edit → save → re-run cue after a definition change) — signed off 2026-07-01.

## Act

**Learnings:**

- **D-gate-first felt different** — updating the design doc before code (the lesson from the prior
  exchange) made the edit-mode acceptance criterion (C9) the build target, not an afterthought.
- **Extract-on-second-use paid off** — create built the form inline (R137); edit's arrival is exactly
  when `WorkflowForm` earns extraction (one authoring surface, two entry points), not before.

**Promotions:** none.

**Prune check:** nothing pruned.

## Feeds into → Round_140

The Workflow surface is complete (create · run · view · **edit** · delete). The remaining named
candidate is the **value-out deliverable** (Excel/CSV download of the materialized output) — deferred
at R136, now decidable against a working, editable output.
