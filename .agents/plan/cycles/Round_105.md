# Round 105: Bug-fix + enhancement batch (dashboard arc)

**Status**: Complete
**Date started**: 2026-06-29
**Date completed**: 2026-06-29
**Flow**: TBD — a batch round; flow assessed **per item** at triage (pure bug fixes skip the
`flow-selector`; each enhancement gets its own DCFBI/DFCFBI read if it's a feature).

## Goal

**Inherits from ← [Round_104](Round_104.md)** — the dashboard arc (R101 persist · R102 reorder · R103
per-widget filter · R104 row-cap) is shipped and hands-on tested. This is a **dedicated batch round** to
triage **accumulated bugs** from real use and fold in **selected enhancements** from the Feeds-into backlog
— batched deliberately rather than fixed piecemeal mid-feature ([[2026-06-18-r-ui-bug-fixing-round]]).

_Track: 1 (product). Pulled by ← the human's "next round = bug fix + enhancement" call. Per the
[Evolution Rule](../../AGENTS.md)._

## Triage (awaiting human input — bugs + enhancement picks)

**Bugs** _(human to report from hands-on use; I'll reproduce + scope each)_:

- **B1 — Sidebar static menu not i18n'd.** `DATA_MANAGEMENT_GROUP` in `AppLayout.tsx` is a **module-level
  const with hardcoded English** ("Data Management" / "Workspaces" / "Datasets" / "Queries"), so it never
  translates (the `Settings` + `Dashboards` groups build inside the component with `t()` and do). **Scope:**
  build the group inside the component with `t()` — the keys (`nav.dataManagement` / `workspaces` /
  `datasets` / `queries`) **already exist in en + vi**, so it's pure wiring, **no new strings**. FE-only,
  trivial, zero-risk. _Reproduced + scoped 2026-06-29._
- **B2 — Wide preview table scrolls the viewport, not its own box** (`/data-management/queries/:id` edit).
  **Root cause:** `PagedRowsView` (`_shared`) has two scroll modes — `contained` sets `overflow: auto`
  (contains both axes), but **`flow`** (used only by `QueryBuilderPanel`'s preview) applies **no overflow**,
  so a many-column table grows to its intrinsic width and overflows → the *page* gets a horizontal
  scrollbar instead of the table. **Fix:** flow mode gets **`overflowX: 'auto'`** (horizontal scroll
  contained to the table box; vertical stays natural / page-scrolls, as intended). `overflow:auto` also
  gives the wrapper flex-min-size 0, so it contains even under a flex ancestor. One-line; blast radius =
  the one `flow` consumer (the query-edit preview). FE-only, low-risk. _Reproduced + scoped 2026-06-29._
- **B3 — Viewport vertical scroll after the header 56→64 bump** (regression from the `chore(ui)` commit).
  **Root cause:** `PageContainer`'s `SHELL_CHROME_PX = 88` was a **hardcoded magic number** (= old header
  56 + content padding 16×2); the header is now 64, so the chrome is 96 and `calc(100svh − 88px)` is **8px
  too tall** → `fill`/`bounded` pages overflow the viewport. **Fix:** derive it from the tokens —
  `SHELL_CHROME_PX = layoutTokens.headerHeight + 2 × layoutTokens.contentPadding` — single-sourcing the
  content padding (16) into `layoutTokens` and reading it in both `WorkspaceShell`'s `Layout.Content` and
  `PageContainer`, so it can never drift from the header again. FE-only, low-risk. _Reproduced + scoped
  2026-06-29._

**Enhancement candidates** (carried in the R101–104 Feeds-into; human picks which land this round):

- Per-widget / -dashboard **cap override** — in-app "increase from properties" + over-default warning (R104).
- **Server-side pushdown** / the parked **"fetch-once"** strategy — request-count / scale (R103–104).
- **Date-range + drill** filters — extend the per-widget filter drawer (R103).
- **Saved / URL-encoded** filters — persist/share filter state; contract change (R103).
- **ECharts** advanced charts (chart-lib ladder); **2D widget arrange**; **dashboard settings** (R101–102).
- Nav nicety — same-named dashboards across projects share a nav leaf label (R101).

## Plan (finalize after triage)

1. **Triage gate** — human reports bugs + picks enhancements; I reproduce each bug, scope each item, and
   **cap the batch** (bugs first; enhancements as capacity allows — a batch round must not balloon).
2. **Fix / build** — per item, smallest-useful-change; commit per logical item (revert seams).
3. **Verify** — per-item tests + the suites; human app-run for any UI-bearing item.

## Risks / unknowns

- **Scope creep** — batch rounds balloon. Triage must rank + cap; defer the long tail to a later round.
- **Mixed flow** — bugs and enhancements have different rigor; assess per item, don't force one flow.
- **Bug reproduction** — some "feels off" reports need a repro before a fix; budget for that.

## Do

### Plan-gate draft — opened from R104 (2026-06-29)

R104 Complete + signed off; the human paused, then chose **bug-fix + enhancement** as R105. Opened the
batch round; pre-listed the enhancement backlog from the R101–104 Feeds-into. **Next: human reports the
bugs found in use + picks which enhancements to fold in → I triage, scope, and cap the batch.**

### Fixes applied (2026-06-29) — awaiting human Check

- **B1** — `AppLayout`: deleted the module-level `DATA_MANAGEMENT_GROUP` const; the group is now built
  **inside the component** with `t()` (`nav.dataManagement` / `workspaces` / `datasets` / `queries` —
  existing keys, no new strings), mirroring `systemGroup`/`dashboardGroup`.
- **B2** — `PagedRowsView`: `flow` mode now sets **`overflowX: 'auto'`** (was `{}`) — horizontal scroll is
  contained to the table box; vertical still flows (page scrolls), as intended.
- **B3** — header 56→64 regression: added `layoutTokens.contentPadding: 16`; `PageContainer.SHELL_CHROME_PX`
  now **= `headerHeight + 2 × contentPadding`** (derived, not a hardcoded 88); `WorkspaceShell`'s
  `Layout.Content` padding reads the same token. Fill/bounded pages now compute `100svh − 96px`, so the
  viewport no longer over-scrolls — and it can't drift from the header again.

Verification (automated): `@mdd/ui` **27/27** · builder **type-check clean · 216/216 tests · prod build
green**. **Pending human Check:** (B1) switch language to **vi** → the `Data Management` group + items
translate; (B2) open a many-column query preview (`/data-management/queries/:id` edit) → the **table**
scrolls horizontally, not the page; (B3) on a Full-HD screen, a normal list/catalog page has **no viewport
vertical scrollbar**.

## Check

Verification (2026-06-29):

| Item | Result |
| --- | --- |
| `@mdd/ui` tests | **27** |
| Builder type-check | clean |
| Builder tests (vitest) | **216** |
| Prod build | green |
| **Check (human)** | **PASS** — human reported B1–B3 and signed off ("complete and commit r105"). |

## Act

**Learnings**:

- **B3 is the headline lesson**: a layout dimension that *depends on* a token (`SHELL_CHROME_PX` = header +
  padding) must be **derived from** that token, never hardcoded — the literal `88` silently drifted the
  moment the header grew 56→64. Fixed by computing it from `layoutTokens`; single-sourced `contentPadding`
  too so it can't drift again.
- **B1**: nav groups must be built **inside** the component to be i18n'd — a module-level `const` can't
  call `t()`. The keys already existed; only the wiring was wrong.
- **Batching worked as intended**: B3 was a *regression from this session's own header tweak*, surfaced
  during the batch and swept in — exactly the case piecemeal fixing would have missed
  ([[2026-06-18-r-ui-bug-fixing-round]]).
- The "#3" turned out to be an architecture brainstorm, not a bug → scoped to **R106** (refactor before
  features) with the compute-pull-vs-surface-pull doctrine note recorded.

**Promotions**: none — the fixes live in the code; the derive-don't-hardcode lesson is captured here + in
the config-home heuristic memory.

**Follow-ups (not promotions, just notes):** R106 scoped refactor (Feeds-into); a small **uncommitted**
`_SELECT_QUERY` dedup in `queries.py` (human's edit, left out of R105) is a natural R106 starter; the
enhancement backlog stays deferred.

## Feeds into → Round_106 (scoped backend refactor — agreed 2026-06-29)

**Feeds into → Round_106 — scoped, behavior-preserving backend refactor BEFORE new features** (the
debt is accepted, from the R69 raw-sqlite-in-router convention; refactor with a pull rather than let the
next features deepen it). Two targets, integration-tests-guarded + new resolver unit tests:

1. **Extract query-execution orchestration** — one shared `resolve_and_execute` / `validate_definition`
   the run/preview/create/update endpoints call (DB access stays a passed `sqlite3.Connection`).
2. **Give the cross-router shared helpers a home** — relocate `_dtype_of`/`_compatible`/
   `_is_unique_violation`/`RowsPage`/`_load_meta` to a shared module so routers stop importing each other.

**Deferred (default = don't add):** the grand repository + service/domain layer — until a real pull
(workflow #2 in-process consumer, or a persistence swap). Then **features resume** on the clean seam
(fetch-once first — it wants the seam). See memory `2026-06-29-backend-router-layer-debt`.

Also still deferred from the enhancement backlog: the un-picked items (date-range/drill, saved filters,
per-widget cap override, ECharts, 2D arrange, dashboard settings) + the fetch-once page-size widening.
