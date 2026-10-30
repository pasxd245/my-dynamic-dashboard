# Round 206: notes and insights — one block, a link not a toggle, cards you click, charts that stay still (item 5.6)

**Status**: Complete — accepted by the owner 2026-10-30 with the perf limits partly met (the rest → R207); pinned
**Flow**: **DCFBI** — builder-only: the metadata bar, At a glance, the dock's cards and Read view and its
breakpoints, and the dashboard widget's render path; no contract, route, engine or migration change.
**Date started**: 2026-10-30
**Date completed**: 2026-10-30

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

- [x] **D** — rc5.md 5.6; program row; this round file; `metadata.md` § Reading by layer + AC 11
- [x] **C** — no contract change
- [x] **F** — `dock.tsx` (bar, block, cards, Read heading, placement, Space), `badges.tsx` (glance
      rows inside the bar), `DashboardDetailPage.tsx` (block, breakpoint, stable filters),
      `WidgetView.tsx` + `hooks.ts` (memo), i18n EN/VI, tests
- [x] **B** — none (builder-only)
- [x] **I** — visual gate + probe (Playwright, real backend, synthetic data; 1440 × 810, 1024 × 768,
      390 × 844; EN + VI)
- [x] Check — gates; code review; BA (contract exit + after build); QA

## Check

**Gates** (head of this round): builder **717 / 717** (700 + 17 in `metadata-notes-r206`); `tsc` clean;
md / plan / design lints 0; backend and contracts untouched; guard (no user names, no `backend/data`)
empty. Negative controls: N5 fails on the pre-round code (a non-memo `BarView`: 7 renders vs 1);
N5b fails without R206's empty-list constants (15 vs 5); 14 of the first 15 tests fail on `f4e30c4`.

**Perf probe** (QA; production build, Playwright, CPU × 4, the synthetic 7-widget dashboard — a
series bar, a combo, line, pie, stat, table, bar; start = before the click, end = dock in / out of the
DOM + 2 frames; median of 3):

| Viewport (placement)        | Open    | Read   | Back   | Close  | Chart-view renders per action |
| --------------------------- | ------- | ------ | ------ | ------ | ----------------------------- |
| f4e30c4, 1536 × 730 beside  | 1.2–1.5 s | 0.54–0.61 s | — | 1.2–1.3 s | 14 / 7 / 7 / 14 |
| 2b3ae24, 1440 × 810 beside  | 1 404   | 425    | 463    | 892    | 2 / 1 / 1 / 2 (series bar, combo) |
| head, 1440 × 810 beside     | 1 071   | 283    | 315    | 669    | **0** |
| head, 1024 × 768 over       | 553     | 298    | 407    | 442    | **0** |

**Falsifier hit (partly met):** no chart view re-renders on a note action (N5, N5b, and counted live
through a React commit hook) — met. The timing limits are not: read 283 ms (limit 250), open / close
1 071 / 669 ms beside (600) and 553 / 442 ms over (400). Against `f4e30c4`: read −50 %, open −20 to
−30 %, close −45 %. What is left is the page itself re-rendering on the `?note=` change (every widget
card, its header and the drag-and-drop wrappers — not the charts) plus, beside, one re-layout of the
charts when the grid drops a column. The prototype that met the limits memoised the whole widget card
and skipped its header updates (stale menus) — not shippable as it was. Next step logged (Feeds into).

**Visual gate + live probe** (QA; EN + VI; screenshots inspected): 1440 × 810 block with two glance
rows and Collapse; All notes beside, the grid 3 → 2; Read of the insight — title printed once, table
renders, the row marked; sticky on scroll. 1024 × 768 right drawer over the grid (2 → 2 columns);
390 × 844 bottom sheet. Dataset page: plain bar + dot hint, dock as tall as its content. Empty cases:
no notes → no bar; no widgets → the empty card; info-only → header line, no Collapse; a title-less
note titled by its summary, never by its namespace. Link → "Showing all notes" (`aria-disabled`, a
second click keeps the dock); Esc / × / mask close; focus returns to the opener in all three
placements (after the QA-2 fix: traced at 1024 and 1440); card click anywhere; Tab to "View details"
and Enter; glance row `aria-current`; Collapse over a reload. No page errors.

**Reviews**

- BA at Contract exit — **CHANGES** (9 P1), all folded before the build: BA-C1/C2 one bar element,
  "Showing all notes"; C3 mask, Esc, focus in every placement; C4 one title rule on every surface; C5
  no Collapse without rows; C6 glance rows as single buttons in a labelled list; C7 heatmap / gauge
  memo; C8 a measurable probe; C9/C16 stale docs (`dashboard-layout.md`, `dataset-detail.md`); P2s
  C10–C17 folded (count reads "notes", label reaches the dock and the relationship panel, card click
  rules, heading comparison, neutral examples, W6 superseded).
- Code review — **PASS** (P2 only), folded: CR-1 a read that has not run returned a new empty list each
  render, so the chart-data memo broke on a warm cache (= QA-1) — module constants + N5b; CR-2 a
  title from the body's first line was printed again, setext and closed ATX headings not stripped —
  `withoutLeadingTitle(…, fromBody)`, `firstLine` drops closing `#`s; CR-3 the block's glance config
  memoised; CR-4 a doc comment moved back to its function.
- After-build BA — **CHANGES** (3 P1), folded: BA-F1 focus on open in the drawer (antd's own autofocus
  / trap) — `autoFocus={false}`, no trap; BA-F2/F3 AC 11, rc5.md and the dataset ASCII said "View all N"
  / "Showing on the right" / "Metadata … Open" — rewritten; P2: BA-F4 (= CR-2), F5 a light mask
  (15 %), F6 `role="list"`, F7 the rc5.md pointer and a list indent.
- QA — **CHANGES** (2 P1): QA-1 the series bar and the combo still re-rendered (= CR-1) — fixed, 0
  renders live; QA-2 focus fell to `<body>` when the drawer / sheet closed (antd's trap pulled it back
  into the closing drawer) — fixed, traced live. P2 logged: QA-3 beside, at scroll 0, the sticky dock's
  last ~44 px sit below the fold until the page scrolls; P2-2 (pre-existing) at 390 px the app sidebar
  does not collapse, so the page scrolls sideways.

**Walk script** (owner; ~5 min; production build; BA's):

- W1 1440 × 810, a dashboard with notes: one block — "Notes & insights · N notes · N by AI", up to two
  severity chips, "View all ›", "⌃ Collapse", up to three rows; no separate At a glance.
- W2 "View all ›": the pane opens beside, the grid drops a column, the charts do not flicker; the link
  reads "Showing all notes" (grey), clicking it does nothing.
- W3 Click anywhere on a card: Read opens; no namespace on the card; the title is not printed twice; a
  note without a title is titled by its summary. Back, Tab to "View details ›", Enter: the same note.
- W4 Click a glance row: it is marked; Esc closes and focus is back. Collapse, reload: still collapsed.
- W5 1024 × 768: "View all ›" — a 400 px drawer over the page, the grid keeps its columns, a light
  mask; a click on the mask closes and focus returns to "View all ›".
- W6 390 × 844: tap a row — a bottom sheet at ~85 %; × closes.
- W7 Dataset page: the plain bar with the dot hint; query and workflow pages: the plain bar.
- W8 VI: "Ghi chú & nhận định · N ghi chú · N do AI", "Xem tất cả ›" → "Đang xem tất cả ghi chú",
  "Thu gọn" / "Mở rộng", "Chi tiết ›", cards "Xem chi tiết ›", widget tooltip "Ghi chú của widget
  này" — every phrase reads naturally.

## Act

- **Owner decision needed:** the perf falsifier is partly met (charts still, timings above the limits).
  Accept the round as it is and take the rest in R207, or hold R206 until R207 lands.
- **Rolling log**: the remaining page re-render on a note action (perf, R206); QA-3 sticky dock below
  the fold at scroll 0; P2-2 (pre-existing) the sidebar at 390 px.
- **Lesson (Track 2, for promotion review)**: a memo test must cover every data path the memo keys on —
  the fixture's one widget read the server aggregate, so the raw-row widgets' fresh empty lists went
  unseen until QA counted renders live on a mixed dashboard. Count renders on a fixture with one widget
  of each read path.
- **Prune check**: `AtAGlance` removed (its rows live in the bar); no new hook; the title rule is one
  function pair.
- **Promotion**: none yet.

## Feeds into → Round_207

- **The page does not re-render on a note action** (the rest of 5.6's perf limit): the dock's `note`
  state read by the dock and the bar only, or the widget card memoised with stable header props
  (menu, badges, filter button) — measure against the same probe.
- Previous / next between notes in the Read view (shown in the owner's design A, left out of 5.6) —
  opens if a walk shows readers stepping through notes one by one.
- A deleted widget's notes listed under the raw widget id (pre-existing) — opens with a reader's
  report.
