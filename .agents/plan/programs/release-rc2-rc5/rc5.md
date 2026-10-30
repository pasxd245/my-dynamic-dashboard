# rc.5 — tags (conditional) and metadata read by layer

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md).

**Default: skip.** `tags` is a recorded deferral in `datasets.md`. rc.5 opens only if the rolling log
shows naming conventions + search failing to find things — e.g. saved copies (3.6) and
`adhoc-YYYY-MM-DD-<topic>` workspaces piling up so that a person cannot find "everything about
topic X" across workspaces.

If it opens:

- **Contract:** `tags: [string]` (lowercase, `^[a-z0-9][a-z0-9-]{0,31}$`, ≤ 10 per item) on dataset,
  query, dashboard, workflow; `GET /search?tag=…` across workspaces.
- **Migration:** a `tags` table `(kind, id, tag)`; downgrade drops it.
- **Builder:** tag chips on detail views; a tag filter on list pages.
- **Gate:** the logged finding that opened rc.5 is re-run and now succeeds.

If it does not open: rc.4's tag becomes **v0.0.1**, and this file folds into the program's closing
note.

_2026-10-28 (owner): rc.5 opens with item **5.2** below, independent of the tags condition; 5.1
stays conditional._

## 5.2 Metadata read by layer

|       |                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                          |
| Flow  | **DCFBI** — UI-bearing; no API shape change                                                                |
| Added | by the owner, 2026-10-28 (design review 2026-10-23); opens rc.5 on `release/v0.0.1-rc.5`, cut at `7764148` |
| Round | `Round_202`                                                                                                |

Metadata written in volume reads as a wall of text: the dashboard panel lists every widget's
entries above the grid, tables do not render, and nothing says which note matters. Read **by
layer**, **beside the data**:

- **Viewer:** `SafeMarkdown` through `react-markdown` + `remark-gfm`; raw HTML, images and
  non-http(s) links still shown as their source text (R179 invariant); one renderer for `note`
  widgets and metadata.
- **Reserved frontmatter keys** read by the builder: `title`, `summary`, `severity`
  (`info | warn | error | decide`); invalid → shown as an ordinary pair; other keys uninterpreted.
- **Badges** on widgets (≤ 2 severity chips + `+N`) and dots on dataset column headers.
- **Dock** beside the page: Notes (cards) → Read (full note); `Esc` closes; `?note=` deep link;
  drawer on narrow screens.
- **At a glance** strip on dashboards: ≤ 3 summaries with severity ≥ `warn`, current or refreshed.
- The inline `MetadataPanel` is replaced on dashboard, dataset, query and workflow pages by a
  one-line Metadata bar + the dock (All notes on dashboards); the relationship drawer keeps it.
- **Gate:** builder tests green; hostile-markdown tests; visual gate at 1366 × 768 (EN + VI) on an
  install loaded with real-volume metadata; no route or query result changes.

**Step 2 (not in rc.5 unless pulled):** a typed `{props, md, data}` entry; structured `data` drawn
as a table with a raw-JSON toggle — opens when a writer has a real machine-read case.

## 5.3 Within N days of a start date — cohorts that cannot be read yet (pulls conditional 4.5)

|       |                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                                |
| Flow  | **DCFBI** — builder-only: a recipe that inserts five existing steps; no contract, route or engine change         |
| Added | by the owner, 2026-10-28 ("a general, adaptive feature, not tied to one user"); pulls rc.4's conditional **4.5** |
| Entry | 4.5's second condition — the first user still needs a workaround after rc.3 (rolling log, 2026-10-28)            |
| Round | `Round_203`                                                                                                      |

A rate **by start period** reads low for the newest periods because their rows have not had the full
window to reach the event — the newest month always "drops". The engine can already say it: five
existing steps (`group_column max(start)` across everything → two `date_diff` → two `case`) give an
**observed** and a **within** column, and `sum(within) ÷ sum(observed)` per period is the honest
rate. The first user did not find it, and rebuilt the rate outside the product. The gap is
**finding and assembling** the five steps right, not the engine (BA, Contract exit: a step kind is
a one-way door; the recipe is not).

- **Builder:** `Add a column` ends with **Within N days of a start date…** / VN **Trong N ngày kể từ
  ngày bắt đầu…** — a dialog (start · event · days · two names) that appends the five steps as
  ordinary cards; disabled with a reason when fewer than two date columns exist; names never
  collide.
- **Docs:** `queries.md` § the recipe (the five steps, calendar days, as-of = latest start, the rate,
  the 4.5 flag as data).
- **Gate:** builder tests green; a backend test pins the recipe's numbers on a fixed table (so an
  engine change cannot silently break it); the real-volume install's same-age rate built with the
  recipe matches the outside computation month by month, with any difference listed and explained.

_Not in this item:_ a step kind of its own (opens on a logged case of a user breaking the rate by
editing one of the five); an as-of from a viewer parameter or a fixed date; a chart badge on young
periods.

## 5.4 Fold the dataset page's context on short screens

|       |                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                     |
| Flow  | **DCFBI** — builder-only: two toggles and a viewport default; no contract, route or engine change     |
| Added | by the owner, 2026-10-29 (first user's screen: 1920 × 1080 at 125 %); closes the R202 rolling-log row |
| Round | `Round_204`                                                                                           |

On a short viewport the dataset page's context — the metadata strip, the date coverage, the advanced
query — takes most of the height and the table shows one or two rows. The context folds:

- **Builder:** `▸ Details` and `▸ Advanced query` toggles in the toolbar row; folded by default below
  760 CSS px of viewport height, open above; the viewer's choice is remembered per browser; an active
  advanced query is never hidden.
- **Docs:** `dataset-detail.md` § Folding sections + AC 11.
- **Gate:** builder tests green; visual gate at 1366 × 650 (a 1366 × 768 laptop's viewport) and 1536 × 730 (EN + VI): the table shows
  at least five rows on a fixture dataset with Details and Advanced query folded.

_Not in this item:_ the query and workflow pages; a one-line digest of the folded strip.

## 5.5 Dataset page context: each control beside what it opens, nothing said twice

|       |                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                              |
| Flow  | **DCFBI** — builder-only: a toggle moves, the strip drops repeated fields, one hint line, one inline time form |
| Added | by the owner, 2026-10-30, from a review of R204 against the accepted metadata-reading design (5.2)             |
| Round | `Round_205`                                                                                                    |

R204's review against the accepted design found four small gaps on the dataset page:

- **Builder:** the `▸ Details` toggle moves from the toolbar to the end of the subtitle line, right
  above the section it opens (R204 put it two rows below, under the Metadata bar); the Details strip
  drops the fields the subtitle already shows (rows, columns, size, uploaded) — the Properties
  drawer keeps the full list; on the dataset page the Metadata bar adds one hint line when any column
  has notes ("Dots on column headers mark notes — colour = severity; click a dot to read"); the
  subtitle's relative time reads inline ("Uploaded just now", not "Uploaded Just now").
- **Docs:** `dataset-detail.md` § Layout (strip), § Folding sections, § Properties panel, AC 1 + AC 12;
  `metadata.md` § Notes & insights bar (was "Metadata bar", renamed by 5.6).
- **Gate:** builder tests green; visual gate at 1536 × 730 with the dock open (EN + VI): the toolbar
  stays one row and the table still shows at least five rows.

_Not in this item:_ the query and workflow pages; a severity legend with coloured samples.

## 5.6 Notes and insights: one block, a link not a toggle, cards you click, charts that stay still

|       |                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                          |
| Flow  | **DCFBI** — builder-only: the metadata bar and block, cards, Read view, dock placement, widget render path |
| Added | by the owner, 2026-10-30, after reading the first install's real notes; design A + C responsive chosen     |
| Round | `Round_206`                                                                                                |

Using 5.2's reading surface on real notes (211 entries by an agent), the owner logged: "Open" with no
object and a toggle that repeats the dock's ×; the bar and At a glance saying the same thing twice;
cards reachable only through a small button, showing the namespace id; and lag (every open, read and
close re-rendered every chart):

- **Builder:** the bar reads "Notes & insights" with a "View all ›" link (no toggle; × / `Esc`
  close); on a dashboard the bar is one block holding the ≤ 3 serious notes (At a glance merged,
  collapsible); a card opens on click and has a "View details ›" link, no namespace, a title from the
  summary when there is none; the Read view does not repeat a leading heading equal to the title; the
  dock sits beside the data from 1200 px, over it (right drawer, bottom sheet below 768 px) under that;
  chart views are memoised so a note never re-renders a chart.
- **Docs:** `metadata.md` § Reading by layer + AC 11.
- **Gate:** builder tests green; QA probe on a 7-widget dashboard (production build, CPU × 4): read
  ≤ 250 ms, open / close ≤ 600 ms, zero chart renders per note action; visual gate at 1440 × 810,
  1024 × 768 and 390 × 844 (EN + VI).

_Not in this item:_ previous / next between notes in the Read view; the query and workflow pages'
own layout; the launcher that runs the builder in dev mode (an install's script, outside this repo).
