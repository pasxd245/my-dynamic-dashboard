# Round 206: notes and insights — one block, a link not a toggle, cards you click, charts that stay still (item 5.6)

**Status**: In progress
**Flow**: **DCFBI** — builder-only: the metadata bar, At a glance, the dock's cards and Read view and its
breakpoints, and the dashboard widget's render path; no contract, route, engine or migration change.
**Date started**: 2026-10-30
**Date completed**: —

## Goal

**Inherits from ← [Round_205](Round_205.md)** — rc.5 is open on `release/v0.0.1-rc.5`; R204 and R205
were walked by the owner on 2026-10-30 (G6 passed) and are Done. The owner then used the metadata
reading surface on the first install's real notes (211 entries written by an AI agent) and logged four
problems:

1. **"Open" opens what?** The bar reads "Metadata · 11 entries · [Decide] [Warning] [Open]". The verb has
   no object; once open the button turns into a blue "Close" that repeats the dock's ×.
2. **Two layers say the same thing.** On a dashboard the bar and the At a glance strip sit one above the
   other, with two verb pairs (Open/Close, Hide/Show).
3. **Cards are hard to read.** A small "Read" button in a corner is the only way in; the namespace id
   (an agent's namespace id) sits on every card; a note without `title` shows the namespace as its title; the
   Read view prints the title twice when the body opens with the same heading (the agent's weekly
   insight does).
4. **It lags.** Measured on a synthetic dashboard (7 widgets, production build, CPU × 4 ≈ a laptop):
   opening the dock 1.1–1.9 s, reading one note 0.46–0.56 s, closing 1.0–1.3 s; dataset / query pages
   0.15–0.4 s. Cause, counted: every open / read / close re-renders **all 7 charts** (14 renders on
   open/close, 7 on read) — the `?note=` change re-renders the page, the widget's derived chart data is
   rebuilt every render and no chart view is memoised; open / close also changes the grid's columns.
   A prototype that kept chart views still: 0 chart renders, open 0.41–0.62 s, read 0.18–0.21 s, close
   0.29–0.47 s. (The install also ran the builder as the Vite dev server — 4–5 × slower again; that
   launcher is outside this repo.)

The owner compared three designs (A: one block + reading pane beside the data; B: expand in place;
C: one line + an overlay drawer) at 1440 / 1024 / 390 and chose **A on desktop with C's behaviour on
smaller screens**: beside the data where there is room, over it (never squeezing the grid) where there
is not.

_Track: 1 (product). Pulled by: owner, 2026-10-30 (use on the first install's real notes; design
canvas "MDD — Ghi chú & nhận định (R206)", option A + C responsive) + rolling log QA-2 (R205)._

## Plan

**Expected outcome**:

- **Builder — the bar** (`MetadataBar`): the label reads **Notes & insights** / **Ghi chú & nhận
  định**; count, AI count and up to two severity counts as before; **Open/Close becomes a link "View all
  ›" / "Xem tất cả ›"** (`MetadataBarOpen`) that opens All notes; while All notes is showing, the same
  element reads "Showing all notes" / "Đang xem tất cả ghi chú" and is `aria-disabled` (focus returns
  to it on close — BA-C1/C2); while one note is read it is "View all ›" again (BA-C10). The count reads
  "N notes" / "N ghi chú" (BA-C11). Closing is the dock's × or `Esc` only. No `aria-pressed` toggle.
  The renamed label also heads the dock and the relationship drawer's panel (BA-C12).
- **Builder — dashboard block**: At a glance moves **into** the bar: on a dashboard the bar is one
  bordered block — the header line, then up to three serious, current notes (same selection rule as
  R202) as rows — each one `button` (`AtAGlanceItem`): severity chip, title, the widget's name, a
  two-line summary, "Details ›" (`aria-hidden`); the list labelled "Most serious notes"; the row being
  read is marked (`aria-current`) (BA-C6). The header carries **Collapse / Expand** (`aria-expanded`)
  only when there is a row (BA-C5), the choice remembered per dashboard as before
  (`mdd.atAGlance.collapsed.<id>`). No qualifying note → the header line only. The separate At a glance section is removed.
- **Builder — cards** (`NoteCard`): the whole card opens the note (pointer click); the keyboard way in
  is the card's **"View details ›" / "Xem chi tiết ›"** link-button (`MetadataCardRead`, `aria-label`
  "View details: <title>"); a click on a link inside the card or one ending a text selection does not
  open it (BA-C13); the card's footer reads "author · when"; the namespace id is no longer on the card
  (the Read view keeps it as a tag). **Title fallback**: `title`, else the summary, else the body's
  first line — never the namespace unless the note has no text at all; the line used as the title is
  not printed again; one `displayTitle` / `displayLine` pair in `reserved.ts` serves cards, Read,
  glance rows and the widget / column tooltips (BA-C4).
- **Builder — Read view**: a leading markdown heading whose text equals the title (compared like
  `sameText`: marks and spacing aside, case-insensitive — BA-C14) is not rendered again; the rest of
  the body is unchanged.
- **Builder — dock placement (A + C)**: beside the content from the **`xl`** breakpoint (≥ 1200 px,
  was `lg`); from `md` to `xl` a 400 px drawer **over** the page from the right (the grid keeps its
  columns); below `md` a bottom sheet (85 % of the viewport height). Beside the content on a filling
  page (dataset, query, workflow) the dock is as tall as its content, up to the page height, not always
  full height. The dashboard's grid gives up a column only when the dock is beside it. Over the page
  (drawer, sheet) there is a light mask and a click on it closes; in all three placements focus goes
  to the dock heading on open, `Esc` closes and focus returns to the opener (BA-C3).
- **Builder — charts stay still**: `useWidgetChartData` derives its chart data inside a memo keyed by
  the fetched results, the widget and its filters (same values, same objects); `useChartPalette`
  memoises its list; every chart view (`BarView`, `MultiBarView`, `LineView`, `PieView`, `ComboView`,
  `ScatterView`, `StatView`, `TableView`, and the lazy `HeatmapView`, `GaugeView` — BA-C7) is
  `React.memo`; the page passes one stable empty filter list; the parameter context (a new object each
  render) reaches the chart data only through the fetched results.
  Opening, reading and closing a note re-render **no chart view**; only a width change re-lays a chart
  out (the chart library's resize).
- **Builder — hygiene**: `Space direction="vertical"` in `dock.tsx` → a flex column (rolling log QA-2).
- **i18n EN / VI**: `metadata.title`, `metadata.count` (notes), `metadata.bar.viewAll`,
  `metadata.bar.showing`, `metadata.card.details`, `metadata.card.detailsFor`,
  `metadata.glance.label`, `metadata.glance.details`, `metadata.glance.collapse` / `expand`;
  `widgetTooltip` / `columnTooltip` say "notes" (VI "ghi chú"); unused keys pruned (`bar.open`,
  `dock.read`, `glance.title`, `glance.hint`).
- **Docs**: `metadata.md` § Reading by layer (ASCII, bar, block, cards, dock placement, Read heading,
  title fallback) + mount table + AC 11; `dashboard-layout.md` (ASCII, block, widget notes, AC 10 —
  R180's panel and popover were stale, BA-C9); `dataset-detail.md` "Notes & insights bar" (BA-C16);
  rc5.md 5.6; program row; this round file.
- **Tests** `metadata-notes-r206.test.tsx`: N1 the bar's link opens All notes and gives way to
  "Showing all notes" (`aria-disabled`), no toggle; × and `Esc` close and focus returns to the bar's
  element; N2 a dashboard has one block holding the glance rows (no separate section), a row opens its
  note and is marked, Collapse is remembered and absent with no row; N3 a card opens on click anywhere,
  the details link is focusable and named, no namespace on the card, a title-less note is titled by its
  summary and a body-only note by its first line (each shown once), and a glance row uses the same
  title; N4 the Read view drops a leading heading equal to the title and keeps a different one; N5
  opening, reading and closing a note re-render no chart view (counted through a mocked
  `ResponsiveContainer`), a changed filter does; `useWidgetChartData` returns the same objects across
  renders with the same inputs; the heatmap and gauge views are memo components; N6 the dock is beside
  at ≥ 1200 px, a 400 px right drawer at 768–1199 px, a bottom sheet below 768 px, each with `Esc` and
  focus return. Existing tests keep their outcome; the ones asserting the
  old words or the separate glance section are updated with the change named in Check.

**Falsified if** any of these happens:

- opening, reading or closing a note on the fixture dashboard re-renders a chart view (N5);
- the QA probe (production build, Playwright with CPU × 4, the synthetic 7-widget dashboard; start =
  just before the click is dispatched, end = the dock (or its Read view) is in / out of the DOM plus two
  animation frames; median of 3) measures read > 250 ms or open / close > 600 ms at 1440 × 810 (beside:
  the grid drops a column), or open / close > 400 ms at 1024 × 768 (over: no re-flow) — the
  prototype's medians were 507 / 399 ms and 0.19 s (BA-C8);
- the bar still offers a control that closes the dock;
- a dashboard shows At a glance as a section separate from the bar;
- a card shows a namespace id where it has a title or text to show;
- at 1024 × 768 opening the dock changes the dashboard grid's column count;
- any metadata contract, route or stored entry changes.

## Risks / unknowns

- **Memo correctness** — a memoised chart view showing stale data. Keys are the fetched results'
  objects (React Query keeps them stable while the data is equal), the widget and its filters; a new
  read, filter or widget edit yields new objects. N5's companion asserts a changed filter re-renders.
- **Click on the whole card** — a pointer convenience; the keyboard path is the details link
  (a card is not a `<button>`: it holds a list and text). Clicks on a link inside the summary are not
  intercepted (the card handler ignores clicks that land on an `a` or `button`).
- **Overlay below `xl`** — a 1024–1199 px window now covers the right of the page while a note is open
  instead of narrowing it; the owner chose this (design C) so the grid never re-flows on small screens.
  This supersedes R202's walk item W6 ("below 992 px a full-width drawer") (BA-C17).
- **A deleted widget's notes** still list under the raw widget id (pre-existing since R202) — logged,
  not in scope.

## Do

- [ ] **D** — rc5.md 5.6; program row; this round file; `metadata.md` § Reading by layer + AC 11
- [ ] **C** — no contract change
- [ ] **F** — `dock.tsx` (bar, block, cards, Read heading, placement, Space), `badges.tsx` (glance
      rows inside the bar), `DashboardDetailPage.tsx` (block, breakpoint, stable filters),
      `WidgetView.tsx` + `hooks.ts` (memo), i18n EN/VI, tests
- [ ] **B** — none (builder-only)
- [ ] **I** — visual gate + probe (Playwright, real backend, synthetic data; 1440 × 810, 1024 × 768,
      390 × 844; EN + VI)
- [ ] Check — gates; code review; BA (contract exit + after build); QA

## Check

_(filled at the end of the round)_

## Act

_(filled at the end of the round)_

## Feeds into → Round_207

- Previous / next between notes in the Read view (shown in the owner's design A, left out of 5.6) —
  opens if a walk shows readers stepping through notes one by one.
- A deleted widget's notes listed under the raw widget id (pre-existing) — opens with a reader's
  report.
