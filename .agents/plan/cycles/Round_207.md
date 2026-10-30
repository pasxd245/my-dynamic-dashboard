# Round 207: the dashboard stays still on a note action, the dock fits the screen, the phone menu folds (item 5.7)

**Status**: Review
**Flow**: **DCFBI** — builder-only (plus one line in the shared shell): the dashboard's widget cards, the
dock's sticky height, the side menu's start state; no contract, route, engine or migration change.
**Date started**: 2026-10-30
**Date completed**: —

## Goal

**Inherits from ← [Round_206](Round_206.md)** — the owner accepted R206 with its perf limits partly met
and pinned the install to it (2026-10-30, `09_decisions/…nang-pin-mdd-r206`, outside this repo). R206's
probe: no chart re-renders on a note action, but the page still re-rendered every widget card on each
`?note=` change — read 283 ms, open / close 1 071 / 669 ms beside, 553 / 442 ms over (CPU × 4, 7
widgets; limits 250 / 600 / 400). Its QA also logged two layout gaps: beside, at scroll 0 the sticky
dock's bottom ~44 px sat below the fold; at 390 px the side menu did not fold and the page scrolled
sideways.

Cause of the card re-renders, found by counting: (1) the cards got new callbacks, a new menu element
and a new reach badge every render; (2) the drag-and-drop sensors were built from inline option
literals, so `useSensor` gave the drag context a new value every render and every sortable card
re-rendered through it — even with stable props.

_Track: 1 (product). Pulled by: R206 Feeds into + rolling log (R206 QA probe, QA-3, P2-2); owner,
2026-10-30 ("Còn lại cho Cowork: R207")._

## Plan

**Expected outcome**:

- **Builder — still cards** (`DashboardDetailPage`): the widget card is `React.memo`; its callbacks
  take the widget (or its id) and are one function each for the page's life, calling the page's latest
  handlers (`latest` ref) — Edit, Delete, the filter button, the notes badge; the ⋯ menu is built inside
  the card; the reach badge gets a `reach` value that keeps its identity while equal; the grid's id list
  keeps its identity while the order is the same; the parameter context value is memoised (viewer
  values and shared selections by content); the drag sensors' options are module constants.
- **Builder — the dock fits** (`dock.tsx`): beside and sticky, its max height is the viewport from
  where it sits (never above 16 px) to the bottom, re-measured on scroll and resize (one frame at a
  time); was a fixed `100svh − 120px`.
- **Builder — "Showing all" as a chip** (owner, mid-round 2026-10-30: loose grey text read as out of
  place): while All notes shows, the bar's element reads "Showing all" / "Đang xem tất cả" as a grey
  chip with an eye icon, the same size as the severity chips; still the one focusable element.
- **Builder — the phone menu** (`AppLayout`, `WorkspaceShell`): below 768 px the side menu starts
  collapsed; a menu that starts collapsed opens no group (antd would float each open group over the
  page). The viewer can still open it.
- **Docs**: `metadata.md` § Reading by layer ("Charts stay still" → the cards too; dock height); rc5.md
  5.7; program row; rolling log rows closed; this round file.
- **Tests** `dashboard-still-cards-r207.test.tsx`: S1 over the page (1024 px) open / read / back /
  close re-render no widget card; S2 beside (1440 px) reading inside the open dock re-renders no card
  (opening does — the grid gives up a column); S3 the card menu's Edit still opens the builder for that
  widget (latest handlers); S4 the beside dock's max height is the viewport from its top; S5 at 390 px
  the side menu starts collapsed with no group popped open; S6 a wide window keeps it open.

**Falsified if** any of these happens:

- S1 or S2 sees a widget card render on a note action that does not change the grid's columns;
- the QA probe (R206's: production build, CPU × 4, the synthetic 7-widget dashboard, median of 3)
  measures read > 250 ms, or open / close > 400 ms over the page (1024 × 768), or close > 600 ms beside
  (1440 × 810);
- a card action (Edit, Delete, filter, notes) acts on a stale widget or page state;
- at 1440 × 810 with the dock open at scroll 0 its bottom is below the viewport; at 390 px the page
  scrolls sideways.

Open beside (1440) keeps R206's 600 ms as a target, not a falsifier: it includes the grid's column
change, which re-lays out every card and chart by design (5.2 / 5.6: "the grid narrows").

## Risks / unknowns

- **Latest-handler callbacks** — a card that does not re-render calls the page's handlers through a ref
  set on every page render; the handlers read the page's current state at click time. S3 covers Edit;
  Delete goes through the same path (`confirmRemoveWidget`).
- **A scroll listener** on the beside dock — passive, one measurement per animation frame, only while
  the dock is beside and open.
- **The shared shell** (`packages/ui` `WorkspaceShell`) — one prop: no group open when the menu mounts
  collapsed; a wide window is unchanged (its tests stay green).

## Do

- [x] **D** — rc5.md 5.7; program row; this round file; `metadata.md`
- [x] **C** — no contract change
- [x] **F** — `DashboardDetailPage.tsx`, `dock.tsx`, `AppLayout.tsx`, `WorkspaceShell.tsx`, tests (6)
- [x] **B** — none (builder-only)
- [x] **I** — perf probe + visual check (1440 × 810 dock at scroll 0; 390 × 844 menu)
- [x] Check — gates; code review; BA (after build); QA

## Check

**Gates** (head of this round): builder **723 / 723** (717 + 6) — one full run under QA's parallel
load timed out five upload-wizard tests (15–18 s each); `datasets.test.tsx` alone 15 / 15 and the head
run green; `packages/ui` WorkspaceShell + PageHeader green; `tsc` clean; md / plan / design lints 0;
backend and contracts untouched.

**Perf probe** (QA; R206's probe, CPU × 4, 7 widgets, quiet machine, ≥ 6 samples):

| Viewport (placement) | Open           | Read          | Back | Close         | Card / chart renders per action |
| -------------------- | -------------- | ------------- | ---- | ------------- | ------------------------------- |
| R206, 1440 beside    | 1 071          | 283           | 315  | 669           | 7 cards / 0 charts              |
| R207, 1440 beside    | 1 016 (target) | **173**       | 290  | **521**       | read, back 0; open, close 7 / 0 |
| R206, 1024 over      | 553            | 298           | 407  | 442           | 7 cards / 0 charts              |
| R207, 1024 over      | **343**        | **184**       | 284  | **250**       | **0 / 0**                       |

All falsifiers met (read ≤ 250, over ≤ 400, close beside ≤ 600). Open beside stays ~1 s — the grid's
column change re-lays out all seven cards and charts (5.2's design); a target, not a falsifier,
logged for R208. Under load (QA's first runs, load 4–5 on 2 cores) the 1440 read and close medians were
263 / 637: the margins are thin on a busy machine.

**Visual + live** (QA, EN + VI): card actions on live data after note cycles and a filter change — Edit
opens the builder for the right widget, the filter button the right drawer (applied filter shows, only
that card's button on), the notes badge that widget's notes, Delete confirms the right widget (cancel
kept it). 1440 × 810 at scroll 0: dock bottom 794 of 810, follows scroll. 390 × 844: menu collapsed,
no popup; **QA-1** the content area still scrolled 216 px sideways (the page header's buttons did not
wrap, the title broke letter by letter) — fixed: the shared `PageHeader` wraps its actions under the
title (`flex-wrap`, title `flex: 1 1 240px`), the dashboard's action group wraps; content 326 / 326 px
after. "Showing all" chip checked at 1440 VI. Focus return after `Esc` at 1024 and 1440. No page
errors.

**Reviews**

- Code review — **PASS** (P2 only), folded: CR-1 the dock re-measures on layout changes too
  (`ResizeObserver` on the body); CR-2 first measurement in a layout effect (no frame at the wrong
  height); CR-4 S3 waits for the grid; CR-5 S4 stubs a 200 px top (684 px). Not changed: CR-3 (a test
  that edits A then deletes B) — QA exercised Edit / filter / notes / Delete live after note cycles and
  a filter change; CR-6 an expanded phone menu opens no group (one tap opens it).
- BA (after build; no contract-exit pass — the round adds no behaviour beyond 5.6's limits and two
  logged layout fixes, owner-pulled) — **PASS on condition** the probe numbers land here (done) and
  BA-1's wording: the rolling-log rows now point at this Check with its numbers; BA-2 the dock-height
  sentence in `metadata.md` rewritten.
- QA — **CHANGES** (QA-1 P1) → fixed as above. P2 logged: QA-2 at 390 px the expanded menu pushes the
  content (90 px wide) instead of floating and stays open after navigating; QA-3 = open beside (R208);
  QA-4 thin margins under load.

**Walk script** (owner; ~5 min; BA's):

1. ~1024 px, a dashboard with ~7 widgets: View all → open a note → Back → Esc — no card or chart
   flickers; a chart's hover stays.
2. 1440 × 810 at the top of the page: open the notes — the dock's bottom edge is visible; scroll, it
   stays fitted. The bar shows a grey "Đang xem tất cả" chip.
3. ⋯ → Edit on one card, change its title, save; ⋯ → Delete → confirm on another — the edited title
   is still there.
4. A card's filter button opens that widget's drawer; its notes badge opens that widget's notes.
5. Drag a card by its handle (and with the keyboard) — the order is saved.
6. 390 px: the menu starts folded, nothing floats, no sideways scroll; the header's buttons wrap under
   the title.

## Act

- **Rolling log**: the three R206 rows closed with this round's numbers; new P2 rows — QA-2 (the phone
  menu pushes content when expanded) and the open-beside time (R208).
- **Lesson (Track 2)**: a stable-props memo can still be defeated by a context its child reads — here
  `useSensor`'s inline options gave drag-and-drop a new context each render. Count renders before and
  after; when props are stable and renders continue, look at the contexts.
- **Prune check**: no new component; one hook (`useFitViewport`); `widgetMenu` moved into the card.
- **Promotion**: none yet.

## Feeds into → Round_208

- Open beside (1440) still re-lays out every card for the grid's column change — opens if a walk on the
  install's dashboards finds it slow (e.g. keep the column count and narrow the cards instead).
- Previous / next between notes in the Read view; a deleted widget's notes under its raw id (from R206).
