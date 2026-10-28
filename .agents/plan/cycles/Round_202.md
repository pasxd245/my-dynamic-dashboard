# Round 202: metadata read by layer — badges, a side-by-side reading dock, a full markdown viewer (item 5.2)

**Status**: In Progress
**Flow**: **DCFBI** — UI-bearing; the contract's shape does not change (C = the reserved-key note
in `_shared/metadata.yaml`, documentation only).
**Date started**: 2026-10-28
**Date completed**: —

## Goal

**Inherits from ← [Round_201](Round_201.md)** — rc.4 is built and in Review (R198–R201); its
`Feeds into →` names the rc.4 exit gate, which is the owner's. This round opens rc.5 on its own
branch `release/v0.0.1-rc.5`, cut at the rc.4 head `7764148`, ahead of the rc.4 tag — the owner's
call, as for rc.3 and rc.4 (program decision 12).

Metadata (R180, anchored by R197) is now written in volume by an agent: on one install, 121 entries
in five namespaces across datasets, columns, queries, widgets and dashboards. Read in the shipped
panel, that volume does not work for the person it is written for:

- the dashboard panel lists **every** widget's entries in one inline collapse above the grid (24 on
  one dashboard) — a long page of text before the first chart;
- the safe-markdown renderer draws no tables, so a writer reaches for bullet lists, and an
  intraword `_` (`file_name_here`) turns italic;
- nothing tells a reader **which** note matters — an error, a decision to take, a mismatch — before
  they open it.

The owner's call (2026-10-23, confirmed 2026-10-28): **read by layer**, and read **side by side
with the data** — "insights matter more now; reading a note next to the numbers it talks about, to
check them against each other, is the point." Four layers: a severity badge on the noun → the
noun's notes as cards (title, one-line summary, a few properties) → the full note in a dock beside
the page → (later) structured data behind a "technical" toggle. Step 1 (this round) changes no API.

_Track: 1 (product). Pulled by: a named product gap — metadata written in volume reads as a wall of
text, unsorted by what matters, with tables lost (the external dogfood's pilot scored the dashboard
3 / 5 for "too much at once"; the owner's 2026-10-23 design review). Added to rc.5 by the owner,
2026-10-28._

## Plan

**Expected outcome**:

- **Markdown viewer** — `SafeMarkdown` renders through `react-markdown` + `remark-gfm` (tables, task
  lists, strikethrough, fenced code, nested lists), with the R179 invariant kept: **no element is
  ever produced from raw HTML**, and a construct outside the safe subset (raw HTML, an image, a
  non-http(s) link) is shown **as the text it is**, exactly as before (a small remark step turns
  those nodes back into their source text). `markdownProblems` and the server rule are unchanged.
  One renderer serves the `note` widget and metadata.
- **Three reserved frontmatter keys** read by the builder — `title` (≤ 80 chars), `summary`
  (≤ 200 chars), `severity` (`info` | `warn` | `error` | `decide`). An invalid value is ignored and
  shown as an ordinary pair; every other key stays an uninterpreted pair (R180 rule kept for them).
- **Badges** — a widget header shows up to two severity chips (`error` > `decide` > `warn`, one per
  severity) + `+N` for the rest, or the shipped info button when nothing carries a severity; a
  dataset column header shows a dot (red / orange / gold / grey) when the column has notes. Click
  opens the dock on that noun.
- **The dock** (`MetadataDock`) — a panel **beside** the page content (the content narrows; on a
  narrow screen it falls back to a full-width drawer). Two views: **Notes** (one card per namespace:
  title or namespace, severity chip, AI badge, R197 state, summary — or the body's first line — and
  up to three other pairs, "Read" button) and **Read** (the R197 banner, all pairs, the full body,
  author · when, back to Notes). `Esc` and × close it; it never blocks the page. The open note is in
  the URL (`?note=`), so a link opens it.
- **At a glance** (dashboard) — a strip above the grid with up to three summaries from entries that
  carry `severity` ≥ `warn` and read `current` or `refreshed` (another period's note is not this
  period's news); collapsible, remembered per viewer in this browser; click → the dock on that note.
- **The inline panel goes** — dashboard, dataset, query and workflow pages show a one-line
  **Metadata bar** (count, the top severities, "Open") instead of the inline collapse; the
  dashboard's dock has an **All notes** view (own + every widget, grouped). The relationship check
  drawer keeps its inline list (it is already a side panel).
- **Tests** — the reserved-key reader; the viewer (tables, task lists, intraword `_`, every hostile
  case of R179 kept as text, a 64 KiB note renders); badges and dots; the dock (open from a badge,
  Notes → Read → back, `Esc`, `?note=` deep link); At a glance (filter, order, cap, collapse); the
  shipped R180 / R197 tests re-pointed at the dock.

**Falsified if** any of these happens:

- any input produces a DOM element from raw HTML, an `<img>`, or a link whose `href` is not
  `http(s)`;
- a reserved key with an invalid value disappears instead of showing as a pair;
- the dock hides the numbers it explains on a desktop-width screen (it must sit beside them), or
  blocks interaction with the page;
- a note written for another period shows in At a glance;
- an existing route's request or response changes a byte; any query result changes a cell.

## Risks / unknowns

- **Dependency weight** — `react-markdown` + `remark-gfm` add ~59 packages (unified / micromark),
  MIT. Accepted by the owner over extending the hand parser (2026-10-23 plan). Counter: the safe
  subset stays enforced in two places (server rule; the remark step), with hostile-input tests.
- **Rendering change for `note` widgets** — a note that relied on the old parser's quirks (an
  intraword `_` read as italic) reads differently. Logged; no shipped fixture depends on it.
- **Width** — on a 1366-px screen the dock (400 px) leaves ~900 px for the grid; the grid keeps its
  breakpoint columns, so cards narrow. Visual gate at 1366 × 768 decides; fallback: the grid drops
  a column while the dock is open.

## Do

- [x] **D** — item 5.2 in `rc5.md`, the program row; design `_shared/metadata.md` § Reading by
      layer (R202); this round file
- [x] **C** — `_shared/metadata.yaml`: the reserved-key note (description only; no shape change)
- [ ] **F / B / I** — builder (no backend change); tests; visual gate on real data
- [ ] Check — gates; owner walk script

## Check

_(filled at the end of the round)_

## Act

_(filled at the end of the round)_

## Feeds into → Round_203

- Step 2 of the owner's plan — a typed `{props, md, data}` entry with structured `data` rendered as a
  table and a "raw JSON" toggle — opens only when a writer has a real machine-read case (named
  candidates: data-quality rows, a manual-vs-product reconciliation).
