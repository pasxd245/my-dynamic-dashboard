# Round 191: fix round — the rolling log's small findings after the walks

**Status**: In Progress
**Flow**: DCFBI — no new capability; each fix pinned by a test, contracts brought in line with what the code emits.
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

_(at close)_

## Goal

**Inherits from ← [Round_190](Round_190.md)** and the walks of R177–R189 (2026-10-18, 45 of 45
passed, no findings). The release program held one fix round until after the walks so walk findings
would land with the design-sync findings; the walks added none, so the round is the rolling log's
open "small findings" rows plus the 2026-10-18 plan check's contract gap.

_Track: 1 (product). Pulled by: [release program](../programs/release-rc2-rc5/release-rc2-rc5.plan.md)
§ Rolling log ("one fix round after the walks") — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: every listed finding is either fixed with a test that fails before the fix, or
shown not to reproduce; no saved query's numbers change; no contract shape changes beyond documenting
what the backend already emits.
**Falsified if**: a fix changes a number on an unchanged definition, or a contract gains a field.

Findings (from the rolling log; located 2026-10-18):

- [x] F1 `ChartCard` "query unavailable" never reached — `WidgetView` passes `false`
- [x] F2 single-series chart reads "empty" when the server aggregate is skipped (string measure)
- [x] F3 export's "Total" label can overwrite a total / differ from the page
- [x] F4 `run-post.contract.yaml` omits 409 `step_invalid` (also query rows / preview)
- [x] F5 two strings offer "saved query" as a query base (EN + VI)
- [x] F6 workflow steps editor cannot offer `Source.Query`
- [x] F7 join-multiplication warning direction assumes the modal's dataset is the base
- [x] F8 relationship declare 422 shows a generic message
- [x] F9 dataset page: advanced-query-only no-match shows "empty dataset"
- [x] F10 `MetadataEntry` docstring claims a sweep on noun delete (none exists — 3.8 builds it)
- [x] F11 stale comments (`wire.ts`, `TableView` footer, filter drawer, `relationships.py`)
- [x] F12 a `count` draft switched to scatter / combo saves a measure the backend forbids
- [x] F13 refresh wizard Confirm footer reads "Creating 1 dataset in …"
- [x] F14 contracts cite moved design-doc paths (`query.yaml`, `dataset.yaml`, `rows-get`)
- [x] F15 `ComputeStep` contract does not name its 422 codes
- [ ] Reviews: BA, code review, QA (rc3.md § Execution)

## Risks / unknowns

- F2 restores a client roll-up the comments already claimed; it must give the numbers the server
  path gives on a numeric measure (test both paths on one fixture).
- F3 changes where the export writes its label; a workbook a user already built a lookup on could
  move by one cell — only when column 0 is itself totalled (then: no label, as on the page).

## Do

- 2026-10-18 — located all 15 findings (sub-agent survey, file:line each); all reproduced.
- Fixed with a test that fails before the fix where behaviour changed: F1 + F2
  (`widget-aggregate.test.tsx` +3), F3 (`test_query_export.py` +2; `widgets.md` § Export updated to
  the page's rule), F4 (`run-post` / `rows-get` / `preview` 409 `oneOf` + `step_invalid`; run and rows
  responses now contract-validated in tests), F6 (`withProvenanceColumn` +3), F7
  (`relationship-check.test.tsx` +1), F8 (`RelationshipDeclareError`, reasons EN/VI,
  `relationships.test.tsx` +1), F9 (`advanced-query.test.tsx` +1), F12 (`widget-config.test.ts` +2),
  F13 (`refresh-replace-period-r189.test.tsx` +1). Copy, comments and contract text only: F5, F10,
  F11, F14, F15.
- Gates: backend 583 · builder 473 · contracts 46; `tsc --noEmit` clean; `ruff check` clean.

## Check

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] Visual gate (UI-bearing round)
- [ ] BA · code review · QA — no open P0/P1

## Act

_(at close)_

## Feeds into → Round_192 (TBD)

Item 3.6 — publish a workflow output as a derived dataset with lineage; saved copies (DFCFBI,
migration `0008`).
