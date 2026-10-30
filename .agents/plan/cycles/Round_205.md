# Round 205: the dataset page's context controls sit beside what they open (item 5.5)

**Status**: In progress
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
- [ ] **I** — visual gate (Playwright, real backend, 1536 × 730 + 1366 × 650 + 1920 × 1000, EN + VI,
      dock closed and open)
- [ ] Check — gates; code review; BA (after build); QA

## Check

_(filled at the gate)_

## Act

_(filled at close)_

## Feeds into → Round_206

- The same fold and toggle placement on the query and workflow pages opens only if a walk shows the
  need there.
