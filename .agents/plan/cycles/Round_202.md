# Round 202: metadata read by layer — badges, a side-by-side reading dock, a full markdown viewer (item 5.2)

**Status**: Review
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
- [x] **F / B / I** — builder only (no backend change):
  - `SafeMarkdown` → `react-markdown@10.1.0` + `remark-gfm@4.0.1` + `literalUnsafe` (remark step:
    raw HTML / image / non-http(s) link → its source text; non-http(s) definitions dropped);
    `urlTransform` http(s)-only, `skipHtml`; task boxes are marks, not inputs; tables scroll.
  - `features/metadata/`: `reserved.ts` (keys, order, first line), `severity.tsx`, `dock.tsx`
    (`useMetadataDock`, `MetadataDockRow`, Notes / Read, `?note=`, `MetadataBar`), `badges.tsx`
    (`WidgetMetadataBadges`, `ColumnNoteDot`, `AtAGlance`); `MetadataPanel.tsx` split into reusable
    parts (`anchorNotes`, `AnchorLines`, `PairsTable`) — the relationship drawer keeps it.
  - `frontmatter.ts`: keys in any script with inner spaces (≤ 40 chars).
  - Pages: dashboard (badges, bar, At a glance, dock; the grid drops one column while docked),
    dataset (bar, column dots, dock beside the card), query and workflow (bar, dock).
  - Fixture: a dashboard note (`warn`) and a widget note (`decide`, a table) using the reserved keys.
  - Tests: `markdown-viewer-r202` (21: GFM, 14 hostile inputs, source text kept, 64 KiB),
    `metadata-dock-r202` (12: keys, order, first line, badges, At a glance, `?note=` round trip,
    the dashboard page end to end), R180 dataset-page test re-pointed at bar + dot + dock, R179
    block test re-pointed at the new renderer.
- [x] Check — gates below; visual gate on a fresh install loaded with real-volume metadata

## Check

**Gates** (head of this round): builder **669 / 669** (636 + 33; one full run with nothing else
running), `tsc` clean, `vite build` clean (chunk-size warning as before; the size delta of the two
packages is not measured); contracts **55 / 55**; backend untouched (no backend file changed);
md / plan / design lints 0; guard (no user names, no `backend/data`) empty.

**Real-volume run (fresh install, from zero).** A clean data root, this branch's backend, the
external dogfood's weekly export standardized from scratch, loaded by its own loader (8 datasets,
40 queries, 5 dashboards / 51 widgets created on the empty install), then 186 metadata entries in
five namespaces written by token. The week the dogfood had already reported was re-run on this
install: **123 / 123 report cells identical** to the same week read on the rc.4 install
(only timestamps differ) — no query result changed.

**Visual gate** (`scratchpad/r202vis2/`, 1366 × 768 and 1920 × 1080, VI + EN, 800 × 900 narrow):
badges, bar, At a glance (two columns when docked), dock Notes / Read / All notes, a GFM table in
Read, the narrow drawer; no page errors. Rows of customer data were hidden before every dataset
shot.

Findings logged, not fixed here:

- **F1 (pre-existing)** — at 1366 × 768 the dataset page's header strips (summary, coverage, bar)
  leave almost no height for rows; with the dock open the strips wrap and the rows area closes.
  Candidate: collapse the coverage strip by default on short viewports.
- **F2 (pre-existing, pack-side)** — a combo widget over an ISO-week axis draws its bars sorted by
  value (W37, W34, W39 …), so the axis reads out of order. The engine orders grouped rows since R201;
  this is the widget's own sort in the dogfood's pack, not an MDD change.
- **F3** — an entry whose body repeats its `title` as a heading reads twice; writers that target
  ≥ rc.5 should drop the heading (the dogfood's writer does with its rc.5 flag).

**Walk script** (owner, on the real-volume install; ~10 min):

- W1 Lead funnel dashboard: the bar shows the count and the two most serious severities; At a
  glance shows ≤ 3 cards, most serious first; Hide/Show is remembered after a reload.
- W2 Click a widget's badge: the dock opens beside the grid (the grid drops a column, nothing is
  covered); the URL carries `?note=`; copy the URL into a new tab — the same note opens.
- W3 Read a note with a table; Back returns to the list it came from (All notes when opened from
  the bar); Esc closes; focus returns to the badge.
- W4 Dataset `crm_leads`: a dot on the columns with notes; click → the column's notes; the
  data-quality note reads as a table.
- W5 Switch to EN: every label translates; severity chips read Error / Decide / Warning / Info.
- W6 Narrow the window below 992 px: the dock becomes a full-width drawer.
- W7 A note widget with a table renders the table (R179 note widgets share the viewer).
- W8 Paste `<b>x</b>` into a note widget's text: the builder refuses it before save, as before.

- [ ] BA · code review · QA

## Act

- **Rolling log**: F1 and F2 above go to the program's rolling log; F3 is a writer convention, noted
  in `_shared/metadata.md` § Reading by layer by example.
- **Prune check**: the hand-written block parser (R179) is gone — replaced, not kept beside the new
  renderer; `markdownProblems` stays as the save-time rule.
- **Promotion**: none yet — one round of evidence.

## Feeds into → Round_203

- Step 2 of the owner's plan — a typed `{props, md, data}` entry with structured `data` rendered as a
  table and a "raw JSON" toggle — opens only when a writer has a real machine-read case (named
  candidates: data-quality rows, a manual-vs-product reconciliation).
