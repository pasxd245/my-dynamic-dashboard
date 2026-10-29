# Round 204: fold the dataset page's context on short screens (item 5.4)

**Status**: In progress
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
- [ ] **I** — visual gate (Playwright, mocks, 1366 × 768 and 1536 × 730, EN + VI, before/after)
- [ ] Check — gates; code review; BA (after build); QA

## Check

_Filled at Check._

## Act

_Filled at Act._

## Feeds into → Round_205

- The same fold on the query and workflow pages opens only if a walk shows the need there.
