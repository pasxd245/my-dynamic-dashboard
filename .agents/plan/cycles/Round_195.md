# Round 195: typed parameters — the builder (item 3.7b)

**Status**: Review — built and reviewed (BA, code review ×3, QA + visual gate ×2: no open P0/P1); awaiting the human acceptance walk (W1–W8, which also walks R194's engine) and sign-off
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — parameters reach the builder.

- **Query page:**
  - a **Parameters** section (name, type, label, default — "today ± n days" for dates);
  - **Use parameter** on the column-filter popover and on filter-step / `case` WHEN values;
  - chips read `as_of (parameter)`;
  - the view and the preview ask "Pick a value for …" and keep the value in the URL (`p.<name>`);
  - the view shows what the run used.
- **Dashboard:**
  - `controls` (`kind: param`) are saved with the dashboard;
  - the **Parameters** editor is the only place a value is saved;
  - a bar above the grid where a viewer value lives in the URL only (outlined, **Reset to saved**,
    **Copy link** pinning absolute values);
  - every widget read sends the values of the controls that target it, plus its dashboard and
    widget, and so do export and totals;
  - each card carries a reach badge (reached / skipped with the reason);
  - a card that needs a value says so.

**Studied** — what decides "dashboard" vs "viewer" vs "default" lives in the server. The builder's
job turned out to be routing, and every routing slip was a wrong-numbers bug the reviewers caught:

- a rename that dropped the controls;
- a viewer value reaching an untargeted widget;
- a link pinning another widget's default;
- cards showing old numbers after a saved value changed.

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
- [x] **F** — query page panel + switch + values; dashboard bar, URL, controls editor, badge;
      MSW; EN/VI; tests
- [x] **I** — visual gate (light; dark N/A — no dark theme exists, owner to confirm)
- [x] Reviews: code review, QA, BA after build

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

### F, the reviews and the fixes

- F (`aaaeb11`): `queries/params.ts`, `QueryParamsPanel.tsx`, the operand-switch in `FilterPopover`
  and `StepsEditor`, view and preview values, `DashboardParams.tsx` (context, reach, bar, editor,
  badge), widget hooks carrying the parameter context, EN/VI; 8 vitest.
- **Reviews after build:**
  - code review **CHANGES** — P0: list rename wiped the controls; P1: cards stale after saving a
    value; P1: viewer values ignored targets; P2 ×10.
  - QA **CHANGES** — P1: the filter drawer had no parameter context; P1: the widget builder lost a
    query's columns when its parameter had no value; P1: dark half of the visual gate impossible.
    QA confirmed all viewer behaviours in light and in VI.
  - BA **CHANGES** — P0: the same rename; P1: Copy link did not pin a relative saved value; P2 ×8.
- **Fix 1 (`25980bc`):**
  - `widgetsToDefinition` takes the controls as a required argument;
  - viewer values go only to targeted widgets;
  - widget reads are invalidated after a dashboard update;
  - drawer context;
  - `useWidgetColumns` for the builder;
  - Copy link pins absolute values;
  - the bar shows the server-resolved value;
  - no retry on a 4xx;
  - strict date check;
  - badge wording;
  - VI uses "dashboard";
  - backend refuses duplicate targets and a non-whole saved number on an integer column.

  Code-review re-check found **N-1**, P1: values were mixed across widgets.

- **Fix 2 (`fb77dd1`)** — reported values are stored per widget and derived per control (only
  targeted widgets, only viewer/dashboard sources); preview values; 5xx retry; decimal typing. Code
  review **PASS**; QA browser re-check **PASS** (6/6); its P2 (query rows retry) fixed at close.
- **Dark theme:** none exists (`themeTokens.ts` uses the default algorithm only; R191 recorded the
  same). The rc.3 exit-gate line "light and dark" is marked N/A pending the owner.

## Check

- [x] backend 648 · builder 524 · contracts 48 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Visual gate: light (EN + VI) passed twice; dark N/A (no dark theme — owner to confirm)
- [x] BA · code review · QA — no open P0/P1
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 8`. Setup: a workspace;
      `walk_calls.csv` as **calls**; query **Calls as of** over it; query **All calls** (no
      parameter); a dashboard **Weekly** with a table widget on each.
  - ⬜ W1 — **Calls as of** › Edit › Parameters › Add: `as_of`, date, label "As of", default
    "Today ± days" −1. On a date column's filter, choose `lte`, turn on **Use parameter**, pick As
    of, Apply. The chip reads `as_of (parameter)`. Save.
  - ⬜ W2 — The view shows "as_of = <yesterday> (default)". Type another date: the URL gets
    `p.as_of` and the rows change. Reload: the value is kept. Change the default to "No default"
    and save: the view asks "Pick a value for As of." with no count and no table.
  - ⬜ W3 — **Weekly** › **Parameters** › Add a control for… as_of; applies to all widgets; saved
    value a fixed date. Save. The bar shows that date. Badges: "As of" on **Calls as of**, and
    "As of skipped" on **All calls** (hover gives the reason).
  - ⬜ W4 — Change As of in the bar: the bound card moves, the input is outlined, **Reset to
    saved** appears, and nothing is saved (reload without the `p.` keeps the saved value). Copy
    link, open it in a new tab: same value, same numbers. Reset to saved: the URL is clean.
  - ⬜ W5 — Edit the URL to `p.as_of=2026-13-45`: the bound card says "As of: not a valid date."
  - ⬜ W6 — Export the bound table (XLSX): the Filters sheet has a Parameters block with as_of,
    its value and its source.
  - ⬜ W7 — Rename **Weekly** from the dashboard list, reopen it: the bar and its saved value are
    still there. Remove the **Calls as of** widget while the control targets it: the save works.
  - ⬜ W8 — VI: the bar, the badges and the editor read in Vietnamese ("Về giá trị đã lưu",
    "Bỏ qua As of", "Dùng tham số").

## Act

- **Rolling log:** P2 rows for
  - MSW params;
  - renaming or removing a parameter leaving references;
  - a column change stranding a reference;
  - the advanced (DNF) text and `{name}`;
  - `between` / list items with a parameter in steps;
  - debounce typing in the bar and on the query page;
  - a viewer-state label;
  - silent removals and the editor's disabled Save;
  - the filter drawer's double fetch;
  - the edit-widget preview context;
  - a saved number stored as a string before the queries load;
  - the dark theme (owner).
- **Promotion:** none. Candidate lesson (memory, if it recurs): when the server resolves and the
  client only routes, test the routing itself: who sends which value to which read, and what a link
  pins.
- **Prune check:** each of the three reviewers found a P0 or P1 the others did not. The loop earns
  its place.

## Feeds into → Round_196

Item 3.2c — data versions on the read paths and in exports (a dataset's or copy's rows too).
