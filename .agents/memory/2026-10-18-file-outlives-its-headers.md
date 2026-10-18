# A file outlives its headers — anything a saved export must say goes in the file

**Date**: 2026-10-18
**Agent**: Claude Code (coding agent, milestone M1.1–M1.2 of the rc.3 agent-method track)
**Confidence**: High — two rounds, the same gap on two export formats
**Status**: Promoted (checklist item 7 of [`skills/review-ba`](../skills/review-ba/SKILL.md) § Contract-exit; item 8 of [`skills/review-qa`](../skills/review-qa/SKILL.md))

## Problem

An export is a response for one second and a file for months. Facts that ride only in the
response — a header (`X-MDD-Params`, `X-MDD-Data-Versions`), a toast, the page the user was on —
are gone the moment the file is saved, and the file is what gets forwarded, opened in Excel and
quoted in a decision.

## Finding

R196 named the candidate ("an export is read long after the request — anything only in a response
header is lost once the file is saved"). R194 had logged the same gap two rounds earlier:

| Round                               | What the file could not say                                                 | Where it was instead                                                            |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [R194](../plan/cycles/Round_194.md) | which **period** (parameter values) a CSV was exported under                | the `X-MDD-Params` header only (BA P2 → rolling log)                            |
| [R196](../plan/cycles/Round_196.md) | which **data versions** a CSV was exported from                             | a header only (BA P2); the XLSX got a block, the CSV a `_v<n>` file-name suffix |
| R196                                | a frozen copy's export: "not the current numbers", and the live version now | nowhere (BA P2 → `original_data_version_now`, `deleted`)                        |

The XLSX side already had the right shape — a Filters sheet with a `Parameters` block and a
`Data versions` block — because the design (D7, "what leaves the app carries what was applied")
asked for it. The CSV side was treated as "a header is enough" twice.

The same round's QA P1 is the other half of the lesson: once the facts are **in** the file, every
cell is a cell — the formula guard that protected the data sheet skipped the Filters sheet, where
a dataset name, a label or a parameter value starting with `=` became a live formula.

## Evidence

- `workspace/apps/backend/app/ingest/export.py` (`build_xlsx(data_versions=)`, `file_stem`,
  `_keep_text` over every sheet, `attachment_disposition`), `routers/datasets.py` `export_dataset`,
  `tests/test_data_versions.py`, `tests/test_query_export.py`.
- Round files: `Round_194.md` § Act (rolling log: "a saved CSV doesn't say its period"),
  `Round_196.md` § F (BA P2s, fold `14d0530`, QA P1 fix `f75a535`) and § Act (candidate lesson;
  "CSV formula prefixes" still in the rolling log).
- Design: `dashboards/dashboard-filters.md` D7.

## Recommendation

**Do**

- At Contract exit, for every export or download, list what the file must say when opened cold
  next month (period, parameter values and sources, data versions, "frozen copy of …", the
  definition hash) and put each in the **file** — a sheet block, a comment row, the file name — on
  **every format**, CSV included.
- Headers may duplicate, never replace.
- The formula guard runs over every sheet and every CSV cell; QA opens the workbook parts and
  looks for `<f>`.

**Don't**

- Don't close an export criterion on the XLSX alone.
- Don't let a fact live only in the UI next to the download button.

## Promotion Candidate?

- [x] `skills/` — `review-ba` Contract-exit item 7 and `review-qa` item 8 (done, 2026-10-18).
- [ ] Design doc rule (`design/README.md`, exports) — when 4.3's Filters-sheet split lands.

---

_Track: 2 (agent-method). Pulled by: R196 § Act candidate lesson, recurred from R194's rolling-log
row; promoted at the 2026-10-18 audit._
