# Round 198: view-time date range (item 4.2)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## ⟢ At a glance

**Shipped** — (written at close-out)

**Studied** — (written at close-out)

**Watch** — (written at close-out)

## Goal

**Inherits from ← [Round_195](Round_195.md)** (and [Round_194](Round_194.md)) — a dashboard
control sets one date parameter at a time; a viewer changes "As of" and every bound widget moves.
A period still needs two controls, and "last week" needs someone to type two dates every Monday.

Give a dashboard **one period control**: a `date_range` control binds two date parameters
(`from`, `to`) that the targeted queries declare and use. Its saved value is a preset ("this
week", "last 7 days", …) the **server** resolves in `backend.time_zone` on every read, or a fixed
pair; a viewer's change lives in the URL as absolute dates (`?p.from=…&p.to=…`). When the period
runs past the data (D7), the widget says "Data only through <max>" — a note, not a block.

_Track: 1 (product). Pulled by: release program item 4.2
([rc4.md § 4.2](../programs/release-rc2-rc5/rc4.md)) and the accepted design
`dashboards/dashboard-filters.md` D4, D5, D7 — per [Evolution Rule](../../AGENTS.md)._

rc.4 opened on its own branch `release/v0.0.1-rc.4` at `458aabc` (the rc.3 head) **before** the
rc.3 tag, so nothing of rc.4 lands on rc.3 (rolling-log row; same pattern as decision 12).

## Plan

**Expected outcome**:

- **Contract** (`_shared/dashboard.yaml`, additive): `DashboardControl` becomes a `kind`-keyed
  union — the R195 `param` control unchanged, plus `date_range` `{id, kind, label, from, to,
targets, saved?}` where `from` / `to` are the names of two date parameters and `saved` is
  either `{preset}` (`this_week | last_week | last_7_days | this_month | last_month`) or
  `{from, to}` (each an absolute `YYYY-MM-DD` or `RelativeDate`). `_shared/query.yaml`:
  `ResolvedParams[name].dataThrough?` — the coverage `max` of the filtered column when the value
  is an upper bound past it (D7).
- **Server** resolves a saved preset in `backend.time_zone` at read time (weeks start Monday;
  `last_7_days` = today − 6 … today; months are calendar months) and applies the two values as
  the dashboard level (D3 level 2) to the targeted widgets whose queries USE them; a query that
  uses neither gets nothing (D5). Save checks (422 naming the field): `from` ≠ `to`; one control
  per parameter name across all controls; each targeted query that uses the name declares it as a
  `date`; a fixed pair must not be reversed.
- **Reads**: when a resolved date value is an upper bound (`lte`, `lt`, `before`, `between.max`)
  on a dataset column whose coverage `max` (R178) is earlier, the read echoes
  `resolvedParams[name].dataThrough = <max>`; the widget shows "Data only through <max>".
- **Builder**: the bar shows a date-range control as a preset select + two date inputs; a change
  writes both `p.<from>` and `p.<to>` as absolute dates (a viewer preset is computed in the
  browser; the saved preset by the server); Reset to saved and Copy link work as in R195 (the link
  pins both). The controls editor adds a "Date range" control (bind `from` / `to`, targets, saved
  preset or fixed dates). The reach badge treats the pair as one control: reached when the query
  uses `from` or `to`, skipped (with both names) when it uses neither.
- **Tests**: design criterion 9 (a `date_range` preset saved as "last 7 days" resolves
  server-side; the URL shows absolute dates); presets resolve in the configured zone at a fixed
  clock; a targeted widget whose query lacks the parameters is skipped and badged (D5); D7 note.

**Falsified if** any of these happens:

- a preset is resolved by the client for a saved value (the server must own "today");
- a viewer's period is saved;
- a `param` control saved before this round reads differently (byte-identical dashboard GET);
- a widget whose query uses neither parameter gets a value or a badge saying it was reached;
- a date past the coverage `max` blocks a read instead of noting it.

- [x] **D** — no new design doc (`dashboard-filters.md` Accepted); preset semantics recorded in
      Do and in the contract; `flow-selector`; `ux-design` facet check on the bar control
- [x] **C** — `_shared/dashboard.yaml` (`DateRangeControl`, `DateRangeValue`), `_shared/query.yaml`
      (`dataThrough`). **BA pass 1 at Contract exit.**
- [x] **B** — model union + save checks; `params.resolve_range` / presets in the zone;
      `dashboard_values` for a range; `dataThrough` at bind; the metadata anchor (R197) reads
      range controls; tests
- [x] **F** — types, bar control, editor, reach, share link, D7 note, MSW, EN/VI; tests
- [x] **I** — visual gate (light EN + VI; dark N/A — no theme)
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

- **"This week" semantics.** Market tools read "this week" as the whole calendar week (Mon–Sun),
  which on a Wednesday ends in the future — that is exactly the D7 case ("Data only through
  Tuesday"). Alternative: Monday–today. Built as the whole week; **owner's call** if the dogfood
  wants Monday–today (one function, `params.resolve_range`).
- **A viewer's preset is resolved in the browser's zone** (there is no endpoint for "today"); a
  saved preset in the server's. They can differ by a day around midnight for a viewer in another
  zone. Logged, not built around: the link always carries the absolute dates the viewer saw.
- **Coverage is per dataset column.** A joined query's effective columns carry no coverage (R178
  profiles datasets), so a widget over a join shows no note. Defined, logged.
- **The R195 bar keys resolved values by control id.** A range control reports two values; the
  page now keys them by parameter name (one control per name is already a save rule).

## Do

- 2026-10-19 — D: none new; `dashboard-filters.md` D4, D5, D7 (Accepted 2026-10-18). Preset
  semantics (recorded here and in the contract): weeks start on Monday (ISO); `this_week` =
  Mon–Sun of the current week; `last_week` = Mon–Sun of the previous week; `last_7_days` =
  today − 6 … today (seven days, today included); `this_month` / `last_month` = the calendar
  month. All in `backend.time_zone`.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                   |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | saved preset / saved fixed / viewer preset / viewer custom / reversed / past coverage / skipped |
| 2. New interaction pattern           | no     | a preset select + two date inputs, the R195 bar's inputs; URL state as `p.*`                    |
| 3. High user-error risk              | no     | a viewer change is never saved; Reset to saved restores                                         |
| 4. Contract depends on unresolved UI | no     | the control shape is fixed by D4 (two date parameters, presets as relative values)              |
| 5. UX confidence below threshold     | no     | layout in the accepted design ("Period [2026-10-05 → 2026-10-11 ▾]")                            |

Result: **Flow: DCFBI** — one condition fired (below the 2-of-5 threshold).

**`ux-design` (design-spec, the bar's period control)** — Findability: the control sits in the
R195 bar with its label; Usability: a preset select for the common periods, two date inputs for a
custom one, a reversed pair outlined as a warning; Accessibility: every input labelled
(`aria-label` = control label + from / to); Credibility: the shown dates are the server's
resolution, the note says when data ends; Utility: one gesture moves every targeted widget;
Desirability: no new token, AntD inputs. No gap.

### Revisit of the R194 rolling-log row (a `today` default past a literal `between` bound)

With a `date_range` control both bounds come from parameters and move together, so a preset
never crosses a literal. The remaining case — one bound a literal the query author wrote, the
other a relative default that moved past it — stays a refusal (`param_invalid`,
`range_reversed`, `source: default`): the author set a floor or ceiling and the day crossed it;
saying so beats an empty table that looks like "no calls". Row updated; the BA may dispute.

### C, B, F

- **C (`1f66291`)** — `_shared/dashboard.yaml`: `DashboardControl` = `ParamControl | DateRangeControl`
  (discriminator `kind`), `ControlTargets`, `DateRangeValue` (preset table or `{from, to}`),
  `DateOrRelative`; `_shared/query.yaml`: `ResolvedParams[name].dataThrough`. Contracts 49 green.
  **BA pass 1 (contract exit): not run by the coder** — this session had no sub-agent spawning; the
  orchestrator was asked to run it on `458aabc..1f66291` (its findings fold in the fix commit).
- **B (`37e6804`)** — `models/common.py` union (`from` serialised from `from_`); `params.py`:
  `PRESETS`, `resolve_range`, `control_params`, `control_bindings`, `saved_for_widget`,
  `site_columns` (dtype + coverage), `_note_data_through` in `bind`; `dashboards.py`
  `_validate_range_control`; `metadata.py` reads both control kinds through the same helpers.
  `tests/test_date_range.py` (7): presets at a fixed clock in two zones across a Sunday midnight,
  leap-year month end, criterion 9 (saved preset → `source: dashboard`, dates move with the clock,
  viewer dates override, aggregate shares it), D5 (a query using neither is untouched), D7
  (`dataThrough` on `lte` / `between.max`, on a datetime column, not on a lower bound, on
  totals), the save checks, the R197 anchor (a note stamps the two dates). Backend 677 green.
- **F** — `types.ts` (`ParamControl | DateRangeControl`, `DateRangeValue`, `controlParams`),
  `dateRange.ts` (the presets' calendar, `presetOf`), `DashboardParams.tsx` (`DateRangeInput` in
  the bar: preset select + two date inputs, a reversed pair warns; reach / routing / share link
  over `controlParams`; the editor adds "Date range (two date parameters)", binds `from` → `to`,
  saves a preset or fixed dates, refuses a reversed pair), `DashboardDetailPage.tsx` (resolved
  values keyed by parameter name, `withParams` writes both URL dates in one history entry),
  `WidgetView.tsx` + `ChartCard.tsx` ("Data only through <max>" note under the badge),
  `params.ts` `withParams`, EN/VI (`dashboard.params.range.*`; the editor hint says a period sets
  two). `tests/date-range-r198.test.tsx` (10, incl. MSW contract parity for the new control); R195 tests follow the per-name keying. Builder 550
  green, `tsc` clean.
- **Visual gate (light, EN + VI; dark N/A — no theme):** real backend on an isolated data dir,
  fake `calls_demo` (Acme, 14 days), a **Weekly** dashboard with a `Period` control saved
  `this_week`. Screenshots (`scratchpad/r198/shots/`): the bar with viewer dates (outlined,
  "Custom", Reset to saved), the saved preset resolved server-side ("This week", 10-19 → 10-25)
  with "Data only through 2026-10-14" on both bound widgets and "Period skipped" on **All
  calls**, the preset menu, the editor (EN + VI). Browser probe: picking "Last week" wrote
  `?p.from=2026-10-12&p.to=2026-10-18`; the editor's Save is disabled on a reversed pair and a
  fixed pair saves (`PUT` 200, GET returns `{from, to}`).
- Design doc § As built (4.2); rc4.md § 4.2 and the program table → `review`; rolling-log rows
  (the R194 row revisited; rc.4 before the tag; "this week" semantics; the viewer-side preset
  zone; coverage on joins).

## Check

- [x] backend 677 · builder 550 · contracts 49 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Visual gate: light (EN + VI); dark N/A (no dark theme — owner)
- [ ] BA (contract exit + after build) · code review · QA — no open P0/P1
- [ ] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of N` (walk script from the
      BA's pass 2)

## Act

(written at close-out)

## Feeds into → Round_199

Item 4.3 — `values` controls (shared filters), the `GET /queries/{id}/values` endpoint, the
Filters sheet split (D4, D5, D7).
