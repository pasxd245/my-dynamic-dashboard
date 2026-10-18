# Round 195: typed parameters — the builder (item 3.7b)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

_(at close)_

## Goal

**Inherits from ← [Round_194](Round_194.md)** — the engine resolves parameter values (viewer, then
dashboard, then default), binds them and reports what it used. Nothing in the UI uses it yet.

Give a manager the controls: declare a parameter on the query page and use it where a value would
go; on a dashboard, change **As of** once, see every bound widget move, and copy a link that
reopens the same view.

_Track: 1 (product). Pulled by: release program item 3.7 (3.7b) and the accepted design
`dashboards/dashboard-filters.md` D1, D4, D5 — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- **Query page**:
  - a **Parameters** panel (name, type, label, default, with "today ± n days" for dates);
  - a **Use parameter** switch on the source-filter and filter-step value fields;
  - the view asks for a value for each parameter without one (`param_unbound`) and keeps it in the
    URL (`p.<name>`);
  - the summary reads `as_of (parameter)`.
- **Dashboard**:
  - `controls` (`kind: param`, ≤ 12) are saved with the dashboard;
  - a bar above the grid, with viewer values held in the URL only (`?p.<name>=`), **Reset to
    saved** and **Copy link**;
  - the saved value is changed only in the controls editor (a dashboard PUT);
  - every widget read names the dashboard + widget so the server applies the saved value;
  - a reach badge on each card lists the parameters that reached it, and the ones skipped with the
    reason (D5);
  - a widget without a value says "Pick a value for <label>".

**Falsified if** any of these happens:

- a viewer change is saved;
- a reload loses the URL value;
- a control silently fails to reach a widget whose query uses it;
- a skipped control shows no badge.

- [x] **D** — none new (`dashboard-filters.md` Accepted); flow-selector in Do
- [x] **C** — `_shared/dashboard.yaml` `DashboardDefinition.controls` + `DashboardControl`
- [x] **B** — model + save checks (unique id / param, targets are widgets, saved value of the
      parameter's type); tests
- [ ] **F** — query page panel + switch + values; dashboard bar, URL, controls editor, badge;
      MSW; EN/VI; tests
- [ ] **I** — visual gate (light + dark)
- [ ] Reviews: code review, QA, BA after build

## Risks / unknowns

- **"Used" is a backend rule.** The badge mirrors it in the builder: the parameter names
  referenced by a query's definition. A query detail read already carries the definition, so the
  check stays cheap.
- **Removing a widget** must drop it from control targets, or the next save would be refused.

## Do

- 2026-10-18 — D: none new.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                 |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | saved / viewer / reset / unbound / invalid / skipped per control and widget                   |
| 2. New interaction pattern           | no     | the bar reuses AntD inputs; URL state follows the existing `?page=` pattern of the query page |
| 3. High user-error risk              | no     | a viewer change is never saved; Reset to saved restores                                       |
| 4. Contract depends on unresolved UI | no     | the control shape is fixed by D4                                                              |
| 5. UX confidence below threshold     | no     | the layout is in the accepted design                                                          |

Result: **Flow: DCFBI** — one condition fired (below the 2-of-5 threshold).

- C + B: `controls` (≤ 12) on the dashboard definition, stored `null` when absent (the hash drops
  it); save checks with 422 naming the field; `tests/test_dashboard_controls.py` (3).

## Check

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] Visual gate light + dark
- [ ] BA · code review · QA — no open P0/P1

## Act

_(at close)_

## Feeds into → Round_196

Item 3.2c — data versions on the read paths and in exports (a dataset's or copy's rows too).
