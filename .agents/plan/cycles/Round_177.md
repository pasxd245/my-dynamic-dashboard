# Round 177: widget height — `Widget.rows`

**Status**: Complete — the owner walked it (walk pack session A, 2026-10-18: all items passed, no findings) and instructed the flip ("All 45 passed, flip them").
**Flow**: DCFBI — one presentation field, contract-first, verified on a generic fixture dashboard in a real browser.
**Date started**: 2026-10-15
**Date completed**: 2026-10-18

## ⟢ At a glance

**Shipped** — `Widget.rows` (1–3; optional, absent = 1, never backfilled by the server). A widget
`rows` tall gets a body of `300 × rows + 109 × (rows − 1)` px, so a two-row widget is exactly as
tall as two one-row widgets stacked beside it (393 + 16 + 393 = 802, measured). A `table` widget
pages `8 × rows` rows. The builder gains a **Height** segmented control next to **Width**. The
dashboard grid moved from an AntD flex-wrap `Row`/`Col` to a CSS grid with sparse auto-placement,
so the widgets after a tall one flow into the space beside it. Backend 488 · builder 402 ·
contracts 40, all green; visual gate on a generic 40-row fixture at 1600 / 1000 / 600 px.

**Studied** _(predicted → saw → now believe)_ — **predicted** a height field was a one-constant
change in `ChartCard`. **Saw** that in a flex-wrap grid a tall widget only makes its flex line
taller — the one-row widgets beside it keep empty space underneath, so "height" was a bigger box,
not a layout. **Now believe (high confidence — three viewports measured)** that `rows` is only
worth having on a 2-D grid, and that CSS grid's sparse auto-placement gives an all-`rows: 1`
dashboard exactly the positions flex-wrap gave it, so the switch costs existing dashboards nothing.

**Watch** — the builder's live preview renders at the chosen height (a three-row preview makes the
modal long); on a one-column (phone) grid a tall widget stays tall; `CARD_CHROME` (93) is a
measured constant — an AntD theme change that moves the card header or padding would have to
update it (the grid self-corrects by growing the tracks, so the symptom is a few px, not overlap).

## Goal

**Inherits from ← [Round_176](Round_176.md)** — the first round of `release/v0.0.1-rc.2`, branched
from `5334c81`. The dogfood dashboards (kept outside this repo) have long tables and charts with
many groups that do not read in a fixed 300 px body; every widget had a width (`span`) and no
height.

Add an optional `Widget.rows` (1–3) and render it: a taller card body, more table rows per page, a
builder control, and a grid in which the taller widget actually sits among its neighbours.

_Track: 1 (product). Pulled by: the rc.2 roadmap's first presentation round (R-a, external feedback
item F13 — "a long table needs a taller widget"), and purpose.md's key design decision #2 (builder
first: arranging is part of building a dashboard) — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a widget with `rows: 3` renders three times as tall, a two-row widget lines up
with two stacked one-row widgets, and every dashboard saved before this round renders and re-fetches
unchanged (no `rows` on the wire; same positions).
**Falsified if**: a pre-R177 dashboard changes shape, or the alignment needs a per-widget pixel
override instead of one formula.

- [x] **D** — no dashboard design doc exists under `.agents/design/` (dashboards were built by
      feature rounds R100–R117); the design is the contract description + this round. Height is a
      presentation field like `numberFormat`, not data.
- [x] **C** — `_shared/dashboard.yaml`: `Widget.rows` (integer 1–3, optional); `put.contract.yaml`
      example carries `rows: 2`.
- [x] **B** — `app/models/common.py`: `Widget.rows: int | None` (ge 1, le 3), no default fill;
      `tests/test_dashboards.py` +5 (round-trip, 0 / 4 / 1.5 → 422, absent stays absent).
- [x] **F** — `types.ts` / `wire.ts` (`WidgetRows`); `ChartCard` `bodyHeight(rows)` with
      `ROW_HEIGHT` / `ROW_GAP`; `WidgetView` passes `rows` and `TableView` pages `8 × rows`;
      `WidgetBuilder` **Height** segmented + `draftToConfig` omits `rows` when 1; EN/VI i18n;
      `DashboardDetailPage` CSS grid (`gridColumns`, `gridCell`); `widget-config.test.ts` +2,
      `tests/widget-rows.test.tsx` +7.
- [x] **I / visual gate** — run the stack on the cloud runner, seed a generic fixture (40 random
      orders), a dashboard with `rows` 1 / 2 / 3, a `span: 2 × rows: 2` table and a widget with no
      `rows`; measure every card with Playwright at 1600 / 1000 / 600 px; exercise the builder's
      Height control and the JSON view.

## Risks / unknowns

- **Flex-wrap cannot stack.** Found at the first visual gate: a tall widget left empty space under
  its one-row neighbours. Resolved in-round by the human's call (2026-10-15): switch the grid to CSS
  grid. Sparse auto-placement (no `dense`) keeps reading order, so no existing dashboard moves.
- **Alignment is a measured constant.** The card chrome (header 56 + padding 12 / 24 + border 1 = 93) is baked into `ROW_GAP`. Measured, not derived from theme tokens. If it drifts the grid's auto
  rows absorb the difference (tracks grow), so the failure mode is a few px of misalignment.
- **Phone width.** On one column a `rows: 3` widget is 1118 px of body. Kept — the user chose the
  height; collapsing it on `xs` would be a second rule for the same field.

## Do

- 2026-10-15 — R176 flipped to Complete (human sign-off) and the hand-off re-sequenced: R177 is the
  first rc.2 round; the `compute` / `trim` program moves to rc.3.
- 2026-10-15 — C + B: contract field + example; pydantic field; 5 backend tests. One test fix: a
  string `"2"` coerces to 2 under pydantic's lax mode (same as `span`), so the 422 cases are 0, 4
  and 1.5. Backend 488, contracts 40.
- 2026-10-15 — F: types, `ChartCard.bodyHeight`, table page size, builder control, i18n, tests.
  `draftToConfig` omits `rows` when 1 so an edit that does not touch height saves back unchanged.
  Builder 400, type-check clean.
- 2026-10-15 — **visual gate 1** (flex-wrap): measured chrome 93 (estimate was 92). A `rows: 2`
  card beside two `rows: 1` cards left the space under them empty — a flex line is one row tall.
  Reported with a screenshot; the human chose CSS grid over keeping flex-wrap.
- 2026-10-15 — `DashboardDetailPage`: `Row`/`Col` → `display: grid`, `repeat(cols, minmax(0, 1fr))`,
  `gap 16`; each sortable cell gets `grid-column: span min(span, cols)` and `grid-row: span rows`;
  columns from `Grid.useBreakpoint()` (xl 3 · md 2 · else 1 · unknown 3) — the same collapse the
  `COL_SPANS` map gave. dnd-kit's `rectSortingStrategy` works on rects, so reorder is untouched.
  `CARD_CHROME` 92 → 93. +2 tests (`gridColumns`, `gridCell`). Builder 402.
- 2026-10-15 — **visual gate 2** (CSS grid), Playwright measurements:
  - 1600 px (3 cols): `rows: 2` card 164→966 (802 px) beside `rows: 1` cards at 164→557 and
    573→966 — flush at both edges; `rows: 3` card 1211 px; `span: 2 × rows: 2` table shows 16 rows;
    the widget with no `rows` renders at 393 px (body 300), exactly as at `5334c81`.
  - 1000 px (2 cols): the tall card with two one-row cards stacked beside it; the `span: 2` table is
    a full row.
  - 600 px (1 col): everything stacks; heights unchanged.
  - Builder: **Height** control shows the saved value (2), switching to 3 re-renders the preview at
    three rows and the JSON view carries `"rows": 3`.
  - The stack ran with `MDD_BACKEND__DATA_DIR` pointing at a scratch directory; nothing was written
    under `workspace/apps/backend/data/`.

## Check

- [x] backend 488 · builder 402 · contracts 40 green; `tsc --noEmit` clean; `plan:lint`,
      markdownlint 0
- [x] Visual gate (UI-bearing round): run in a real browser, measured, screenshots kept with the
      review (not in the repo)
- [x] Affordance check (`ux-design`, structural): Findability — Height sits directly under Width
      with the same 1 / 2 / 3 control; Usability — one click, live preview; Accessibility — AntD
      `Segmented` is keyboard-operable, label + help text; Credibility — the preview shows the real
      height; Utility — long tables page 16 / 24 rows; Desirability — a tall chart no longer wastes
      the space beside it.
- [x] ⟢ At a glance **Studied** line written
- [x] **Acceptance walk** (human reviewer) — `coverage: 4 of 4`, walked 2026-10-18 (walk
      pack session A); no findings:
  - ✅ W1 — open an existing dashboard (saved before this round). Nothing moved; every widget is
    the same size; the ⋯ › Edit form shows Height = 1.
  - ✅ W2 — set one widget's Height to 2 and save. It is as tall as two one-row widgets, and the
    widgets after it fill the space beside it.
  - ✅ W3 — set a `table` widget to Height 2. The page shows 16 rows; the pager counts match.
  - ✅ W4 — edit a widget without touching Height and save. The saved JSON has no `rows` key.

## Act

- Walk: 4 of 4 passed (session A, 2026-10-18); no findings, so nothing new goes to the
  rolling log.
- Promotion: none this round.
- Prune check: none — the round added no gate or convention (the grid layout is code, not process).

## Feeds into → [Round_178](Round_178.md)

R178 — dataset date coverage (the second rc.2 round): per `date` / `datetime` column, min, max and
blank share, computed on refresh and shown on the dataset page. Nothing from this round is a
dependency; the rc.2 order is presentation first, trust second.
