# Round 205: the dataset page's context controls sit beside what they open (item 5.5)

**Status**: Review
**Flow**: **DCFBI** — builder-only: a toggle moves to the subtitle line, the Details strip drops
repeated fields, the Metadata bar gains an optional hint line, one inline time form; no contract,
route, engine or migration change.
**Date started**: 2026-10-30
**Date completed**: —

## Goal

**Inherits from ← [Round_204](Round_204.md)** — rc.5 is open on `release/v0.0.1-rc.5` (R202–R204
in Review). R204 folded the dataset page's context; the owner then reviewed it on a running build
against the accepted metadata-reading design (item 5.2: the table first, notes one click away,
column dots as the entry point) and logged four small gaps:

1. **The Details toggle is far from what it opens.** R204 put `▸ Details` in the toolbar row, but
   the section opens at the top of the card — above the Metadata bar, two rows above the toggle.
   On a tall screen the section is open by default and the link between control and content is
   lost.
2. **The strip says the subtitle again.** The subtitle reads rows · columns · size · uploaded; the
   open strip repeats all four (seven fields, four of them twice).
3. **The column dots have no key.** The accepted design puts a one-line key next to the dots
   ("errors / warnings / has notes · click to read"); the built page shows a grey or coloured dot
   with nothing explaining it.
4. **"Uploaded Just now".** The relative time is a standalone label (list column, strip) and keeps
   its capital inside the subtitle sentence ("Uploaded Just now", VI "Tải lên Vừa xong").

With the dock open at 1536 × 730 the toolbar also wrapped to two rows (one table row lost); moving
the Details toggle out of the toolbar removes the cause.

_Track: 1 (product). Pulled by: owner, 2026-10-30 (review of R204 against item 5.2's accepted
design, live build at 1536 × 730 with the dock open)._

## Plan

**Expected outcome**:

- **Builder** — `DatasetDetailPage`: the subtitle is the existing text, then `·` and a link-style
  `▸ Details` toggle (same `data-component`, `aria-expanded`, `aria-controls`, remembered choice);
  the toolbar keeps `▸ Advanced query` and `[Columns N/M]`. `datasetMetaItems` returns a `key` per
  field; the inline strip leaves out `rows`, `cols`, `size`, `created` (the Properties drawer keeps
  all seven). `inline()` lower-cases the first letter of the subtitle's relative time
  (locale-aware). `MetadataBar` takes an optional `hint` (one secondary line under the bar); the
  dataset page passes the dot key when any column has entries. i18n EN/VI:
  `datasets.detail.columnNoteHint`.
- **Docs** — `dataset-detail.md`: ASCII intent, § Folding sections (toggles, nothing said twice,
  inline time), AC 12; `metadata.md` § Metadata bar (the hint); rc5.md 5.5; program row.
- **Tests** — `dataset-context-r205.test.tsx`: C1 the toggle is in the subtitle line, not the
  toolbar, and still folds; C2 the strip has Workspace / Data version / Format only; C3 "Uploaded
  just now" / "Tải lên vừa xong" with the strip's value still capitalised; C4 hint with column notes,
  none with dataset notes only. R204's F1–F10 and R153's drawer test stay green unchanged.

**Falsified if** any of these happens:

- the Properties drawer's Dataset section shows fewer than seven fields;
- the Details toggle stops folding, loses `aria-expanded` / `aria-controls`, or forgets the choice;
- the hint shows on a dataset with no column notes, or on another page;
- at 1536 × 730 with the dock open the toolbar wraps, or the table shows fewer than five rows;
- any existing builder test changes outcome.

## Risks / unknowns

- **A link inside the subtitle** — the subtitle is a paragraph; a small link-style button keeps it
  one line at the widths checked (1280–1920). A very long dataset name does not affect it (the name
  is the title, not the subtitle).
- **Lower-casing** — only the first letter of the relative-time string, so numbers and clock times
  are untouched; a locale whose relative words are proper nouns would be wrong — none shipped.

## Do

- [x] **D** — rc5.md 5.5; program row; this round file; `dataset-detail.md` (ASCII, § Folding
      sections, AC 12); `metadata.md` § Metadata bar
- [x] **C** — no contract change
- [x] **F** — `DatasetDetailPage.tsx` (subtitle toggle, keyed meta items, strip filter, `inline()`,
      hint); `dock.tsx` `MetadataBar` `hint`; i18n EN/VI; `tests/dataset-context-r205.test.tsx` (4)
- [x] **B** — none (builder-only)
- [x] **I** — visual gate (Playwright, real backend, synthetic data, 1536 × 730 + 1366 × 650 +
      1920 × 1000, EN + VI, dock closed and open) — see Check
- [x] Check — gates; code review; BA (after build); QA (see Check)

## Check

**Gates** (head of this round): builder **700 / 700** (699 at the feat commit + C5); `tsc` clean;
md / plan / design lints 0; prettier clean on the round's files; backend and contracts untouched (no
file changed); guard (no user names, no `backend/data`) empty.

**Visual gate + live probe** (QA; real backend, synthetic data, Playwright; light EN + VI, same
numbers): rows of the table fully in view —

| Viewport / state        | With the dot hint | Without (dataset-only note) | Toolbar one row | Details |
| ----------------------- | ----------------- | --------------------------- | --------------- | ------- |
| 1536 × 730, dock closed | 6                 | 7                           | yes             | folded  |
| 1536 × 730, dock open   | **6**             | 7                           | yes             | folded  |
| 1366 × 650, dock closed | 4                 | 5                           | yes             | folded  |
| 1366 × 650, dock open   | 2                 | 3                           | no (wraps)      | folded  |
| 1920 × 1000, dock open  | 7                 | 8                           | yes             | open    |

Before this round the toolbar wrapped at 1536 × 730 with the dock open (R204 review). The subtitle
stays one line everywhere; the pager stays in view; no page errors. The hint costs one row (27 px).
Probed live: toggle in the subtitle (aria, Tab / Enter / Space, focus kept, remembered over reload);
strip = Workspace / Data version / Format, drawer = all seven; "Uploaded just now" / "Tải lên vừa
xong" with the strip's "Vừa xong" capitalised; hint with a column note, none with dataset-only notes,
none when the noted column is hidden (back with Show all); a query page with notes: no hint.

**Reviews**

- Code review — **PASS** (P2 only). Fixed: CR-2 C2 asserted the absent label "Columns" (the strip's is
  "Cols") — now "Cols"; CR-3 the hint counted notes on hidden or dropped columns, which draw no dot —
  only columns on screen count now (C5). Not changed: CR-1 (the drawer's seven fields are asserted in
  `column-visibility.test.tsx`, the BA confirmed); CR-4 the format reads in the title tag and in the
  strip — kept by design (the strip's Format names the sheet), owner may revisit.
- After-build BA — **CHANGES** (one P1), folded. BA-F1 the docs still described a seven-field strip
  (§ Layout, § Properties panel "intentionally repeated", AC 1) and rc5.md pointed at the wrong
  sections — all four rewritten. P2 fixed: BA-F2 VI and EN hint wording; BA-F3 = CR-2; BA-F4 = CR-3.
  BA-F5 (should the hint fold on short screens?) measured by QA: one row, ≥ 5 rows kept at 1536 × 730
  with the dock open — left as is.
- QA — **PASS** (P2 only, logged): QA-1 at 1366 × 650 with the dock open the toolbar still wraps (2
  rows of table); QA-2 antd `Space direction` deprecation warning in `dock.tsx` / `StepsEditor.tsx`
  (pre-existing); QA-3 the hint cannot occur on other pages by construction (none passes `hint`).

**Walk script** (owner; ~5 min; BA's, a dataset with at least one column note):

- W1 At 1536 × 730: the subtitle ends "· Uploaded … · ▸ Details" (a fresh upload reads "just now",
  lower case); the toolbar is Search · Matched · `▸ Advanced query` · `[Columns N/M]` on one row.
- W2 `▸ Details` in the subtitle → `▾`, the section opens right under the header: the strip shows
  WORKSPACE · DATA VERSION · FORMAT, then the date coverage.
- W3 Fold, reload: stays folded; open, reload: stays open.
- W4 Under the Metadata bar the grey line explains the dots; click a header dot: the dock opens on
  that column.
- W5 Actions ▾ → Properties: the Dataset section lists all seven fields.
- W6 Metadata → Open: the toolbar stays one row and the table shows at least five rows.
- W7 VI: "… · Tải lên vừa xong · ▸ Thông tin thêm"; the hint line reads naturally.
- W8 Hide the noted column (Columns): the dot and the hint go; a dataset with only a dataset-level
  note shows no hint.

## Act

- **Rolling log**: QA-1 (1366 × 650 with the dock open: the toolbar wraps, two table rows) and QA-2
  (antd `Space direction` deprecation) go to the program's rolling log.
- **Lesson (Track 2, for promotion review)**: a "nothing said twice" change has to sweep every doc
  that lists the fields (layout bullet, the other surface's note, the first AC), not only the section
  the round opened — the BA found three stale passages the round's own AC contradicted.
- **Prune check**: no new component or hook; the hint is one optional prop; reversible.
- **Promotion**: none yet — one round of evidence.

## Feeds into → Round_206

- The same fold and toggle placement on the query and workflow pages opens only if a walk shows the
  need there.
