# Round 204: fold the dataset page's context on short screens (item 5.4)

**Status**: Review
**Flow**: **DCFBI** — builder-only: two toggles and a viewport default on the dataset page; no
contract, route, engine or migration change.
**Date started**: 2026-10-29
**Date completed**: —

## Goal

**Inherits from ← [Round_203](Round_203.md)** — rc.5 is open on `release/v0.0.1-rc.5` (R202, R203
in Review). R203's `Feeds into →` items stay conditional; this round takes a layout gap that the
rolling log has carried since R202's visual gate and that the first user hit on a real screen.

On a short viewport the dataset page reads as context, not data. At 1366 × 768 — or a 1920 × 1080
screen at 125 % scale, which leaves ~620–740 CSS px of viewport — the metadata strip, the date
coverage, the Metadata bar, the toolbar and the advanced query input (label, field, hint) stack
~230 px above the table, and the table shows one or two rows (fixture at 1536 × 730: **one** row).
A dataset with many date columns wraps the coverage strip and closes the table further. The
subtitle already carries rows · columns · size · uploaded, so the strip mostly repeats it.

_Track: 1 (product). Pulled by: rolling log (R202 visual gate, "header strips leave almost no height
for rows") + owner, 2026-10-29 (first user's screen at 125 %)._

## Plan

**Expected outcome**:

- **Builder** — `foldable.ts`: `useFoldable(section)` → `[open, toggle]`; open = the viewer's
  recorded choice (`localStorage` `mdd.datasetDetail.open.<section>` = `1` / `0`), otherwise the
  viewport (`matchMedia('(max-height: 759px)')` → folded; follows resizes). `DatasetDetailPage`:
  **Details** (strip + published-from + coverage) and **Advanced query** render only when open;
  two text toggles (`▸` / `▾`, `aria-expanded`) left of `[Columns N/M]`; an active `?aq=` keeps
  the input shown and hides its toggle. Frozen-copy band, Metadata bar, search, chips: unchanged.
  i18n: `datasets.detail.details` = Details / **Thông tin thêm**; the AQ toggle reuses
  `datasets.advancedQuery.label`.
- **Docs** — `dataset-detail.md` § Folding sections + AC 11; rc5.md 5.4; program row; the R202
  rolling-log row → opened.
- **Tests** — `dataset-fold-r204.test.tsx`: short → both folded, table rendered; tall → both open
  (unchanged behaviour); toggles + remembered choice (both directions, over the viewport default);
  a remembered fold wins on a tall viewport; active `?aq=` shown with its toggle absent; VI labels.

**Falsified if** any of these happens:

- an active advanced query (`?aq=` set) is hidden, or its rows are filtered with no visible input;
- a tall viewport with no recorded choice opens with either section folded (a behaviour change for
  every existing user);
- a recorded choice is ignored on the next visit, or blocked storage throws;
- at 1536 × 730 with both folded the fixture table shows fewer than five rows;
- any existing builder test changes outcome.

## Risks / unknowns

- **Threshold** — 760 CSS px is chosen from the two screens in the pull (laptop 768 high; 1080p at
  125 % ≈ 864 minus browser chrome). A 1080p screen at 100 % (~940) keeps today's layout. A browser
  in full screen at 125 % (864) also keeps it — acceptable: the table has the height there.
- **Discoverability** — a folded Details hides Data version and coverage; the toggle sits in the
  toolbar row the user already reads, and the choice sticks once opened.

## Do

- [x] **D** — rc5.md 5.4; program row + rolling-log disposition; this round file;
      `dataset-detail.md` § Folding sections + AC 11
- [x] **C** — no contract change
- [x] **F** — `foldable.ts`; `DatasetDetailPage.tsx` toggles + conditional sections; i18n EN/VI;
      `tests/dataset-fold-r204.test.tsx` (6)
- [x] **B** — none (builder-only)
- [x] **I** — visual gate (Playwright, mocks, viewports 1366 × 650 and 1536 × 730 + tall 1536 × 940, EN + VI, before/after)
- [x] Check — gates; code review; BA (after build); QA (see Check)

## Check

**Gates** (head of this round): builder **695 / 695** (685 + 10); `tsc` clean; `vite build` clean
(chunk-size warning as before); backend and contracts untouched (no file changed); md / plan / design
lints 0; guard (no user names, no `backend/data`) empty.

**Visual gate** (Playwright, mocks, `tmp/r204vis` not committed): rows of the fixture table fully in
view — 1366 × 650 EN: **5** folded (1 with Details open); 1536 × 730 VI: **7** folded (before R204:
**1**); 1536 × 940 EN: opens as before (6 rows; 8 with Details folded). Toggles, `aria-expanded`,
persistence over reload and across datasets; VI toolbar stays one row at 1366; no console or page
errors. Clear-while-folded probe: Esc on a deep-linked query keeps the field shown and focused,
retyping `stage:lost` + Enter writes the new `?aq=`.

**Reviews**

- After-build BA — **PASS** (P2 only). Fixed: BA-F1 the design said a folded Details "hides no
  headline number" — now names what is one click away; BA-F2 the gate viewport reads 1366 × 650 in
  both files; BA-F3 clearing a query while folded is now defined (stays open for the visit); BA-F4
  `aria-controls` (= CR-3), "VN" → "VI". Test gaps (blocked storage, resize) closed by F9–F10.
- Code review — **CHANGES** (one P1), folded. CR-1 clearing an active query while folded unmounted
  the field in the same commit that refocused it (focus to `<body>`, R54 broken) — the field now
  stays open for the visit once shown for an active query (F7). P2 fixed: CR-2 folding unmounted a
  typed-but-unapplied draft — the section is hidden, not unmounted (F8); CR-3 `aria-controls` with
  ids kept while folded; CR-4 `addListener` fallback for Safari < 14; CR-5 resize and blocked
  storage tests (F9, F10).
- QA — **CHANGES** (one P1 = CR-1), folded; re-probed live after the fix (above). QA-2 (test for
  clear while folded) = F7. QA-3 discoverability — by design, in Risks. Passed on the first probe:
  759 → folded / 760 → open; a stored choice wins both ways; deep link with a stored `0` on a tall
  screen; keyboard Tab / Enter / Space; storage blocked for the round's keys.

**Walk script** (owner; ~5 min; BA's):

- W1 Browser window about 1366 × 650 (or a 1080p screen at 125 %), storage cleared; open a dataset:
  the toolbar shows `▸ Details` and `▸ Advanced query`, no strips, at least 5 table rows.
- W2 `▸ Details` → strip, coverage (and published-from on a published dataset) appear, `▾`; reload:
  still open; another dataset: open there too.
- W3 Window taller than 760 px, storage cleared: both sections start open, as before R204.
- W4 Short window: open Advanced query, apply `col:value`, try to fold it: the toggle is gone while
  the query is active. Press Esc: the query clears, the field stays with the cursor in it; type a
  new query + Enter; clear again and fold with the toggle.
- W5 VI: **Thông tin thêm** and **Truy vấn nâng cao**.
- W6 Keyboard only: Tab to each toggle, Enter / Space opens and folds.

## Act

- **Rolling log**: the R202 row is opened as 5.4 (this round); nothing new logged.
- **Lesson (Track 2, for promotion review)**: a visibility guard tied to _state_ ("an active query is
  shown") must also hold through the _transition_ out of that state — the user is inside the field
  when the state flips. Two reviewers found it independently from the code and the live probe.
- **Prune check**: one hook file and two toggles; reversible (remove the toggles, render as before).
- **Promotion**: none yet — one round of evidence.

## Feeds into → Round_205

- The same fold on the query and workflow pages opens only if a walk shows the need there.
