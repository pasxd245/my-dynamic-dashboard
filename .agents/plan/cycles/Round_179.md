# Round 179: the `note` widget — markdown text on a dashboard

**Status**: Complete — the owner walked it (walk pack session A, 2026-10-18: all items passed, no findings) and instructed the flip ("All 45 passed, flip them").
**Flow**: DCFBI — one widget kind, contract-first, the safety rule enforced on both sides and verified in a browser.
**Date started**: 2026-10-15
**Date completed**: 2026-10-18

## ⟢ At a glance

**Shipped** — `chartType: note`: a widget with `md` (safe markdown subset, ≤ 4000 chars) and **no**
`queryId` / `agg`; every other kind still requires both. The server rejects (422, never strips)
raw HTML or anything tag-shaped, images, and links that are not http(s) — `app/markdown_safe.py`,
shared with R180's metadata. The builder renders the text with a hand-written parser into React
nodes (`SafeMarkdown`), so markup can never become HTML; the same rule runs in the widget form
before a save. Backend 506 · builder 412 · contracts 40, all green.

**Studied** _(predicted → saw → now believe)_ — **predicted** the hard part would be the sanitiser.
**Saw** that the sanitiser is a dozen lines; the real work was that `queryId` and `agg` were
required on `Widget` everywhere (contract `required`, pydantic, FE types, the dashboard router's
query check, the builder's `canSubmit`) and each had to learn one exception. **Now believe (high
confidence)** that "no query" is the only shape of widget that is not a chart, so one `note`
branch at each seam (`WidgetView` dispatch, `draftToConfig`, the validator) is the right cost, and
no second text-like kind should be added without reusing exactly those seams.

**Watch** — the product has no dark theme at this commit; the note uses AntD `Typography` and
`--ant-color-*` variables with light fallbacks, so it follows a theme when one lands, but only the
light rendering was walked. Tables in the subset render as the text they are (no table drawing).
The 4000-character cap is a constant in `markdown_safe.py` and `SafeMarkdown.tsx` (not in
`_generated/constants`); R180 reuses the sanitiser with its own 64 KB cap.

## Goal

**Inherits from ← [Round_178](Round_178.md)** — third rc.2 round, presentation. A dashboard that
is read by someone else needs a sentence next to the numbers: what changed, what to watch, where
the numbers come from. Today every widget is a chart over a query; there is nowhere to write.

Add a `note` widget: title + markdown text, no query, sized like any widget (`span`, `rows`).

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-c (external feedback item F19 — "a place to
write next to the chart"), and purpose.md's product goal that a dashboard is read, not just
built — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a note saves and re-renders without a query; a note containing `<script>`,
an image or a `javascript:` link is refused at save and, if it ever reached the renderer, would
show as literal text; every existing widget kind is unchanged.
**Falsified if**: making `queryId` optional lets a chart widget save without one, or a renderer
path injects HTML.

- [x] **D** — a widget kind, not a new noun: it lives in `definition.widgets`, is ordered,
      resized and removed like any widget, and shares the card shell (height from R177, states).
      The text is a safe SUBSET that is rejected, not cleaned — the writer should know.
- [x] **C** — `_shared/dashboard.yaml`: `chartType` + `note`; `Widget.required` →
      `[id, title, chartType, span]` with the per-field rule in the description; `md` (1–4000).
- [x] **B** — `app/markdown_safe.py` (`markdown_problems`, `MARKDOWN_MAX_CHARS`);
      `Widget.queryId` / `agg` optional, `md` added; `_check_measure` enforces the note / non-note
      rules; the dashboards router skips the query check for a widget with no `queryId`;
      `tests/test_dashboards.py` +14 (round-trip, 11 unsafe / empty / oversized inputs, the safe
      subset, forbidden fields both ways).
- [x] **F** — `SafeMarkdown.tsx` (parser + renderer + `markdownProblems`); `WidgetView` dispatches
      `note` → `NoteWidgetView` (no hooks, no fetch); `WidgetBuilder`: "Note" kind, text area with
      count and an inline error on an unsafe text, query / data fields hidden, `draftToConfig`
      emits title + md + size; `DashboardDetailPage` hides the filter button on a note; EN/VI
      i18n; `tests/widget-note.test.tsx` +7.
- [x] **I / visual gate** — a note with every block kind beside the R177 charts; a save with
      `<img onerror>` → 422; the rendered note has no `script` element and one http link; the
      builder's OK is disabled on `<b>` with the inline message.

## Risks / unknowns

- **Optional `queryId` on the FE type.** `useQueryQuery` / `useWidgetData` already accepted
  `undefined`; `useWidgetChartData` reads `agg` through a local default (`count`) and is never
  reached by a note. Type-check caught every site.
- **The subset is small by design** (no tables drawn, no nested lists, no images). The gap
  between "accepted by the server" and "drawn by the renderer" is: tables, nested lists, HTML
  entities — all shown as their text. Acceptable for a note; recorded.
- **Two implementations of one rule** (Python + TS). Both are three regexes and are pinned by
  the same test vectors on each side; drift would show as a 422 the builder did not predict.

## Do

- 2026-10-15 — C + B: contract, `markdown_safe.py`, model rules, router skip, 14 tests. The
  conformance check caught the contract's `required` list before any code did. Backend 506,
  contracts 40.
- 2026-10-15 — F: renderer, dispatch, builder form, i18n, 7 tests. The seams that had to learn
  `note`: `Widget.queryId?` / `agg?`, `draftToConfig`, `canSubmit` / `previewReady`, the aria-label
  map, the filter button. Inline code got a monospace style after the gate showed it as plain
  text. Builder 412, type-check clean.
- 2026-10-15 — visual gate: `Weekly notes` (`span 1 × rows 2`) renders heading, paragraph with
  bold / italic, bullets, quote, numbered list, rule, http link (`target=_blank`, `noopener`) and a
  fenced block; `PUT` with `<img src=x onerror=…>` → 422 `markdown_unsafe: html`; the card has no
  filter button; the edit form shows no query select, and typing `<b>` disables OK with the inline
  message. Nothing written under `workspace/apps/backend/data/`.

## Check

- [x] backend 506 · builder 412 · contracts 40 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, screenshots kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — "Note" sits in the same Chart
      select as every kind; Usability — one text area with a live count and a specific inline
      error; Accessibility — real headings / lists / links, keyboard-reachable; Credibility — the
      preview is the same renderer as the dashboard; Utility — a place to write next to numbers;
      Desirability — card chrome identical to the charts.
- [x] ⟢ At a glance **Studied** line written
- [x] **Acceptance walk** (human reviewer) — `coverage: 3 of 3`, walked 2026-10-18 (walk
      pack session A); no findings:
  - ✅ W1 — add a widget, choose Note, write a heading, a list and a link; save. It renders beside
    the charts, resizes with Width / Height, and has no filter icon.
  - ✅ W2 — edit the note and paste `<b>hi</b>`. OK is disabled and the form says why.
  - ✅ W3 — open a pre-R179 dashboard. Every chart unchanged; the Chart select now also lists Note.

## Act

- Walk: 3 of 3 passed (session A, 2026-10-18); no findings, so nothing new goes to the
  rolling log.
- Promotion: none this round.
- Prune check: none — the round added no gate or convention.

## Feeds into → [Round_180](Round_180.md)

R180 — read-only metadata on seven nouns (dataset, column, relationship, query, workflow,
dashboard, widget): namespaced markdown entries written through a token, author / time / source
stamped by the server, shown read-only with an **AI** badge for `source=ai`. It reuses this
round's `markdown_safe` (server) and `SafeMarkdown` (builder) with a 64 KB cap.
