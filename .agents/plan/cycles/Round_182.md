# Round 182: export a table widget's numbers — CSV / XLSX over the whole result

**Status**: Review — C, B, F and the download gate done; awaiting the human acceptance walk (W1–W3) and sign-off
**Flow**: DCFBI — one file endpoint + one button, contract-first, the file downloaded from a real browser and reopened.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — `POST /queries/{id}/export` writes a table widget's numbers as CSV (UTF-8 BOM) or
XLSX: **every** row of the same post-step, dashboard-filtered relation the table reads (R181's
`_final_relation`), typed cells (numbers are numbers, dates are dates, ratio columns formatted
`0.0%` under the widget's percent format), the R181 totals row last in bold, and a `Filters`
sheet naming the query, the widget, the export time, the row count and the active filters. Over
100 000 rows → 422 `export_too_large` with the count. The dashboard shows a download button on
each table widget (Excel / CSV); the browser receives the server-named file. Found and fixed on
the way: the metadata definition hash counted `null` fields, so a widget untouched since R179
read "may be out of date" after any dashboard re-save under R181's model. Backend 531 ·
builder 428 · contracts 45.

**Studied** _(predicted → saw → now believe)_ — **predicted** the export was "the rows endpoint,
unpaged, to a file". **Saw** that the rows the table shows are stringified for the UI, while a
file people compute on needs the typed values — so the export reads the typed relation
directly, and the totals row must be derived from the same sums the footer shows. **Now believe
(high confidence)** that `_final_relation` + `_totals_over` are the product's one definition of
"what this table is", and anything that leaves the product (export now; a frozen copy in rc.3)
must go through them rather than re-deriving the result.

**Watch** — the data sheet name is the widget title clipped to 31 characters (Excel's limit);
the file name is the title with unsafe characters replaced. The CSV carries no number
formats (a ratio is a plain `0.2917`). Export runs the result twice (count, then rows); fine at
the cap, measured on the gate at 4 rows only. The `Content-Disposition` header is now exposed
over CORS — the builder read `export.xlsx` until it was.

## Goal

**Inherits from ← [Round_181](Round_181.md)** — the numbers on a dashboard end up in Excel: a
reader pastes, recomputes, sends. Copying a paged table loses rows and types; the totals row
and the filters that produced the numbers are lost with them.

Let a table widget be downloaded as a file that Excel opens correctly, with its totals and its
filters recorded.

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-e (external feedback item F16 — "take the
widget's numbers away"), and purpose.md's key design decision #3 (Excel output first) — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: the file has as many rows as the full filtered result, not the page;
numbers open as numbers in Excel; the totals row equals the footer; the `Filters` sheet names
the active filter; a stepped query exports its shaped rows.
**Falsified if**: a cell has to be re-typed by the reader, or the totals in the file differ from
the footer.

- [x] **D** — the file is the table (rows + totals) plus provenance (the Filters sheet); the
      server writes it because only the server has the typed, unpaged relation.
- [x] **C** — `queries/export.contract.yaml` (`exportQuery`: `{format, filters, totals, percent,
    title}` → file); `_shared/api-error.yaml` + `values.yaml` + both constants templates gain
      `export_too_large`.
- [x] **B** — `ingest/export.py` (`build_csv`, `build_xlsx`, `EXPORT_MAX_ROWS`);
      `models.ExportBody` / `ApiErrorExportTooLarge`; `routers/queries.export_query` on
      `_final_relation` + `_totals_over` (extracted from R181's route); CORS exposes
      `Content-Disposition`; `tests/test_query_export.py` +4.
- [x] **F** — `queriesApi.exportFile`; `exportWidget.ts` (`exportRequest`, `downloadWidgetExport`);
      a download Dropdown (Excel / CSV) on table widgets in `DashboardDetailPage` with success /
      too-large / failed toasts; EN/VI i18n; `tests/widget-export.test.tsx` +3.
- [x] **I / download gate** — from the dashboard, Excel export of the R181 stepped table: the
      browser receives `By_region___totals__stepped_query_.xlsx`; reopened with openpyxl: 4 rows + `Total 193534 40` as ints, sheets `[<title>, Filters]`, the Filters sheet carries query,
      widget, time, rows and `no filter`.

## Risks / unknowns

- **Metadata hash vs `null` fields** (found at the gate): `definition_json` is a plain
  `model_dump()`, so each optional field the `Widget` model gains appears as `null` on the next
  save, and the R180 hash changed without the widget changing. Fixed by hashing with `None`
  members dropped; pinned by a test (re-save → fresh; sibling added → fresh; own config changed →
  stale). Entries written before the fix under the old hash would read stale once — none exist
  outside this branch's scratch runs.
- **Two queries per export** (count, rows). The cap keeps the second bounded.
- **Percent detection** is the table's own rule re-run on the exported rows (float, all values
  in [-1, 1]) plus every `ratio` total — the file and the screen agree by construction.

## Do

- 2026-10-15 — B first: `export.py`, body / error models, the route; `_final_relation` and
  `_totals_over` extracted from `totals_query` (one definition of the table's relation). Contract
  - error code through the generated constants. The first draft took `percent` as a column list
    the client could not know; switched to a flag with server-side detection. Backend 530, contracts
  1.
- 2026-10-15 — F: API, helper, button + toasts, i18n, 3 tests. Builder 428.
- 2026-10-15 — download gate on the cloud runner: the file arrived as `export.xlsx` — the builder
  could not read `Content-Disposition` cross-origin; exposed it in CORS, re-ran: server-named
  file, toast `Saved …`. The dashboard's metadata entries all read stale after the R181 re-save
  → the hash bug above; fixed in `app/metadata.py` + test. Backend 531. Nothing written under
  `workspace/apps/backend/data/`.

## Check

- [x] backend 531 · builder 428 · contracts 45 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Download gate: real browser download, file reopened and checked (types, totals, sheets)
- [x] Affordance check (`ux-design`, structural): Findability — a download icon in the table's
      header, next to filter; Usability — two choices, one click, a toast with the file name;
      Accessibility — labelled button, keyboard menu; Credibility — the file says which filters
      and which query it came from; Utility — numbers are numbers in Excel; Desirability — no
      dialog, no options to set.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 3`:
  - ⬜ W1 — on a table widget with totals and a filter active, download Excel. Open it: the row
    count equals the full filtered result (not the page), numbers are numbers, the last row is
    the bold totals row equal to the footer, and the `Filters` sheet names the filter.
  - ⬜ W2 — download CSV of the same. Excel opens it with the right characters (UTF-8) and the
    totals row last.
  - ⬜ W3 — on a widget whose result exceeds the cap (or with the cap lowered), the download is
    refused with a message that states the row count and the limit.

## Act

_(at close)_

## Feeds into → Round_183 (TBD)

R183 — relationship self-check: coverage left→right and right→left, unmatched counts, observed
vs declared cardinality (flag, never block), and a join-step warning when a join will multiply
rows; plus the relationship surface R180's metadata still lacks.
