# Round 207: the dashboard stays still on a note action, the dock fits the screen, the phone menu folds (item 5.7)

**Status**: In progress
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
- [ ] **I** — perf probe + visual check (1440 × 810 dock at scroll 0; 390 × 844 menu)
- [ ] Check — gates; code review; BA (after build); QA

## Check

_(filled at the end of the round)_

## Act

_(filled at the end of the round)_

## Feeds into → Round_208

- Open beside (1440) still re-lays out every card for the grid's column change — opens if a walk on the
  install's dashboards finds it slow (e.g. keep the column count and narrow the cards instead).
- Previous / next between notes in the Read view; a deleted widget's notes under its raw id (from R206).
