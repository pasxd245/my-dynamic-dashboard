# Walk pack — rc.2 (R177–R183) and rc.3 (R184–R189)

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). One sitting, about 75–90 minutes, for the
human reviewer. It strings the thirteen rounds' acceptance walks (45 items) into one route over a
throw-away dev install with **fake data only**, so nothing touches a real data folder. Each item is
copied from its round's § Check; the verdict goes back into that round (the agent records it).

**Session A** (R177–R183) closes rc.2: after it, the human flips those rounds `Complete` and tags
`v0.0.1-rc.2` (which also satisfies G-start3). **Session B** (R184–R187) closes rc.3 batch 1 and is
the evidence for gate **G-wf** (opens item 3.6). **Session C** (R188–R189) walks the two refresh
rounds; it needs B done first (it reuses workspace **Walk**). The sessions can run on different days;
A first.

## Setup (Windows, PowerShell) — a separate worktree, its own data folder

Stop any MDD already running — the walk uses ports 8000 and 3000.

```powershell
cd <your-mdd-checkout>                                  # the everyday clone of this repo
git worktree add ..\mdd-walk release/v0.0.1-rc.3      # rc.3 contains all of rc.2
cd ..\mdd-walk
pnpm install
pnpm run config:render
cd workspace\apps\backend
uv sync --extra test
# Session A item A4 needs metadata writes ON; leave this unset for A4's first step (401), then set it:
$env:MDD_BACKEND__METADATA_TOKENS = '[{"token":"walk-token-0123456789","author":"walker","source":"ai","namespaces":["aicowork"]}]'
Start-Process cmd -ArgumentList '/k uv run uvicorn app.main:app --host 127.0.0.1 --port 8000'
cd ..\..\..
Start-Process cmd -ArgumentList '/k pnpm --filter builder dev'
python scripts\dev\seed.py --light                     # the standard demo workspace "Sales demo (seed)"
```

The worktree's data lives in `..\mdd-walk\workspace\apps\backend\data\` — its own folder, never
the everyday one. When done: close the two windows, then `git worktree remove ..\mdd-walk`
(after copying anything you want to keep).

**Walk files** — save these three as UTF-8 CSV in any folder (they are made up):

`walk_calls.csv` (an agent typed four ways — trailing space, leading space, non-breaking spaces,
plain — one blank date, one all-space agent):

```text
agent,team,called_at,calls
Ly,North,2026-09-01,1
Ly ,North,2026-09-02,2
 Ly,East,2026-09-03,3
 Ly ,East,,4
Minh Anh,East,2026-09-05,7
   ,West,2026-09-06,6
```

(In the fourth row put a **non-breaking space** before and after `Ly` if your editor allows —
Alt+0160 on Windows; a normal space also works for the walk.)

`walk_calls_more.csv` (the same columns, later dates — for refreshes):

```text
agent,team,called_at,calls
Ly,North,2026-10-01,5
Minh Anh,East,2026-10-03,2
```

`walk_teams.csv` (`North` repeated on the "one" side; `South` never called; `East` matched):

```text
team,lead
North,An
North,Binh
East,Chi
South,Dung
```

Upload `walk_calls.csv` as dataset **calls** and `walk_teams.csv` as **teams** in a new workspace
**Walk** (Data Management › Upload).

## Session A — rc.2

Mark each ✅ / ❌ and write one line on anything surprising — the surprise is the finding.

| #   | Round · W | Do                                                                                                                                                                | Expect                                                                                                                                                      | Verdict |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| A1  | R177 · W1 | Open the seed's dashboard (Settings › Dashboard, any seeded one). Open a widget's ⋯ › Edit.                                                                       | Nothing moved; every widget the same size; Height = 1.                                                                                                      | ✅      |
| A2  | R177 · W2 | Set one widget's Height to 2, save.                                                                                                                               | As tall as two one-row widgets; the next widgets fill the space beside it.                                                                                  | ✅      |
| A3  | R177 · W3 | Add a **Table** widget over a seeded query with many rows; set Height 2.                                                                                          | Save works (no error); the table shows 16 rows; the pager counts match.                                                                                     | ✅      |
| A4  | R177 · W4 | Edit a widget without touching Height, save; open ⋯ › Edit › View as JSON.                                                                                        | No `rows` key.                                                                                                                                              | ✅      |
| A5  | R178 · W1 | Open dataset **calls**.                                                                                                                                           | Coverage strip: `called_at` 2026-09-01 → 2026-09-06 with a blank share (1 of 6); the Properties drawer repeats it under the column.                         | ✅      |
| A6  | R178 · W2 | Refresh **calls** with `walk_calls_more.csv` (mode **append**).                                                                                                   | `max` moves to 2026-10-03; the blank share drops (1 of 8).                                                                                                  | ✅      |
| A7  | R178 · W3 | Open a seeded dataset (uploaded by the seed, i.e. before any refresh).                                                                                            | Strip present only if it has date columns; nothing else changed. _(The "uploaded before R178" case was proven on the dogfood copy — 8 datasets unchanged.)_ | ✅      |
| A8  | R179 · W1 | On your dashboard: Add widget › Chart **Note**; write a heading, a list and a link; save.                                                                         | Renders beside the charts; resizes with Width / Height; no filter icon.                                                                                     | ✅      |
| A9  | R179 · W2 | Edit the note, paste `<b>hi</b>`.                                                                                                                                 | OK disabled; the form says why.                                                                                                                             | ✅      |
| A10 | R179 · W3 | Open another seeded dashboard.                                                                                                                                    | Charts unchanged; the Chart select also lists Note.                                                                                                         | ✅      |
| A11 | R180 · W1 | **Before** setting the token env var: run the PUT below.                                                                                                          | 401; the dataset page shows no Metadata panel.                                                                                                              | ✅      |
| A12 | R180 · W2 | Restart the backend with the token set; PUT on dataset **calls** and on its column `calls:agent` (see commands). Open the dataset page.                           | Both entries under **Metadata**, AI badge on each, frontmatter as a table; nothing to edit.                                                                 | ✅      |
| A13 | R180 · W3 | PUT on a seeded **query**; change that query's filter; reload its page.                                                                                           | The entry shows **May be out of date**; writing it again clears the flag.                                                                                   | ✅      |
| A14 | R180 · W4 | PUT to namespace `other` → ; PUT with `"author":"me"` in the body.                                                                                                | 403; 422.                                                                                                                                                   | ✅      |
| A15 | R181 · W1 | On the A3 table: Edit › Totals › Sum on a numeric column.                                                                                                         | Footer = the column's total over **all** rows (compare with an aggregate / the query's rows), not the page.                                                 | ✅      |
| A16 | R181 · W2 | Set Ratio with numerator / denominator on two numeric columns; Number format Percent.                                                                             | Footer = Σnum / Σden (not the average of row ratios), shown as a percent.                                                                                   | ✅      |
| A17 | R181 · W3 | Filter the widget (funnel icon).                                                                                                                                  | The footer changes with the filter.                                                                                                                         | ✅      |
| A18 | R182 · W1 | With totals and the filter active: download › Excel. Open the file.                                                                                               | Rows = the full filtered result; numbers are numbers; bold totals row last = the footer; `Filters` sheet names the filter.                                  | ✅      |
| A19 | R182 · W2 | Download › CSV; open in Excel.                                                                                                                                    | Accented text correct (UTF-8); totals row last.                                                                                                             | ✅      |
| A20 | R182 · W3 | _Covered by test_ (`tests/test_query_export.py`, cap lowered): over 100 000 rows → refused with the count and the limit. Mark ✅ if you accept the test, or skip. | —                                                                                                                                                           | ✅      |
| A21 | R183 · W1 | Workspace **Walk** › Relationships: declare `calls.team` → `teams.team`, **many:1**. Press **Check**.                                                             | Coverage of both sides; observed many:many flagged against declared many:1; "joining … can multiply rows" in the direction of `teams`.                      | ✅      |
| A22 | R183 · W2 | New query on **calls** › Join with related › that edge.                                                                                                           | A warning names the multiplication before you save; save still works.                                                                                       | ✅      |
| A23 | R183 · W3 | Check a clean seeded edge (e.g. customers ↔ regions).                                                                                                             | "As declared", no warning.                                                                                                                                  | ✅      |

**Metadata commands** (PowerShell; replace `<ds_id>` / `<qr_id>` with ids from the page URLs):

```powershell
$u = 'http://127.0.0.1:8000/metadata'
$h = @{ Authorization = 'Bearer walk-token-0123456789' }
$b = '{"md":"---\nsource: walk_calls.csv\nexported: 2026-10-17\n---\n\n## Calls\n\nOne row per call."}'
Invoke-RestMethod -Method Put -Uri "$u/dataset/<ds_id>/aicowork" -Headers $h -ContentType 'application/json' -Body $b
Invoke-RestMethod -Method Put -Uri "$u/column/<ds_id>:agent/aicowork" -Headers $h -ContentType 'application/json' -Body $b
Invoke-RestMethod -Method Put -Uri "$u/query/<qr_id>/aicowork" -Headers $h -ContentType 'application/json' -Body $b
Invoke-RestMethod -Method Put -Uri "$u/dataset/<ds_id>/other" -Headers $h -ContentType 'application/json' -Body $b            # A14 → 403
Invoke-RestMethod -Method Put -Uri "$u/dataset/<ds_id>/aicowork" -Headers $h -ContentType 'application/json' -Body '{"md":"x","author":"me"}'   # A14 → 422
```

**After session A:** report the verdicts; the agent records them in R177–R183. Then the human flips
R177–R183 `Complete`, and runs the rc.2 tag checklist in [rc2.md](rc2.md) § exit gate
(`sync.ps1 -TagRelease` when every box is ticked).

## Session B — rc.3 batch 1 (evidence for G-wf)

| #   | Round · W | Do                                                                                                                                                                                       | Expect                                                                                                                               | Verdict |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| B1  | R184 · W1 | New query on **calls**: Add step › **Clean text** on `agent` (→ `agent_clean`), then Group & aggregate by `agent_clean`, Sum of `calls`.                                                 | The Ly variants are **one** row with their total; `Minh Anh` separate; the all-space agent is a blank row.                           | ✅      |
| B2  | R184 · W2 | Remove the aggregate step.                                                                                                                                                               | `agent` is still there, unchanged, beside `agent_clean`.                                                                             | ✅      |
| B3  | R184 · W3 | Open the Clean text card's column picker.                                                                                                                                                | Only text columns offered.                                                                                                           | ✅      |
| B4  | R185 · W1 | Open a dataset that has not been refreshed.                                                                                                                                              | `Data version · v1 · <when uploaded>`. **calls** (refreshed in A6) reads v2. Refresh it again (any mode): v3 and a fresh time.       | ✅      |
| B5  | R185 · W2 | Rename **teams**; hide one of its columns (Properties).                                                                                                                                  | The version does not move.                                                                                                           | ✅      |
| B6  | R185 · W3 | _Evidence:_ the rc.3 dogfood parity started on a copy of the real database — every dataset v1, every number unchanged (`Round_187` § Do). Mark ✅ if you accept it, or repeat on a copy. | —                                                                                                                                    | ✅      |
| B7  | R186 · W1 | Workflows › New: sources = your B1 query and a seeded query with different columns; save.                                                                                                | Refused; the message names the source and the differing columns.                                                                     | ✅      |
| B8  | R186 · W2 | Save two **same-shape** queries over **calls** (e.g. B1's query and a copy filtered `team = East`) as one workflow; run.                                                                 | Every row has `Source.Query` with its query's name; grouping by it splits the total.                                                 | ✅      |
| B9  | R186 · W3 | Create a workflow, don't run it; start another with the first as a source.                                                                                                               | Save refused ("run it first").                                                                                                       | ✅      |
| B10 | R186 · W4 | Re-run the seed's existing one-source workflow.                                                                                                                                          | Same columns and numbers as before; no `Source.Query`.                                                                               | ✅      |
| B11 | R187 · W1 | Run your B8 workflow, then run it again.                                                                                                                                                 | Summary shows Run #1, then Run #2.                                                                                                   | ✅      |
| B12 | R187 · W2 | Refresh **calls** with `walk_calls_more.csv`; open the workflow.                                                                                                                         | Warning names the source(s) ("Data behind … was refreshed"); the table still shows the last run's numbers. Re-run: the warning goes. | ✅      |
| B13 | R187 · W3 | Edit one source query's filter → open the workflow; then delete that query → open again.                                                                                                 | "was edited after this run", then "no longer exists"; the output still readable.                                                     | ✅      |
| B14 | R187 · W4 | Workflow C with the B10 workflow as its only source; run C; re-run the B10 workflow; open C.                                                                                             | C warns: the source "was run again after this run".                                                                                  | ✅      |

**After session B:** report the verdicts; the agent records them in R184–R187. Then the owner's call on
**G-wf** (evidence table in `Round_187` § G-wf); passing it opens item 3.6.

## Session C — rc.3 refresh (R188, R189)

Runs after session B, in the same workspace **Walk**. It uses its own dataset **weekly**, so the
versions of **calls** from sessions A–B are not touched.

**Walk files for C** — save these six beside the others (made up; same columns as `walk_calls.csv`
unless said):

`walk_week_1.csv` and `walk_week_2.csv` (two weeks, no overlap):

```text
agent,team,called_at,calls
Ly,North,2026-09-01,1
Minh Anh,East,2026-09-03,2
Ly,East,2026-09-05,3
```

```text
agent,team,called_at,calls
Ly,North,2026-09-08,4
Minh Anh,East,2026-09-10,5
```

`walk_week_3.csv` (a later week, for Add rows):

```text
agent,team,called_at,calls
Ly,North,2026-09-15,6
Minh Anh,East,2026-09-17,7
```

`walk_week_bad.csv` (one extra column, `channel`):

```text
agent,team,called_at,calls,channel
Ly,North,2026-09-02,1,phone
```

`walk_week_2_redo.csv` (re-covers the second week: 2026-09-08 → 2026-09-14) and
`walk_week_blank.csv` (one row with no date):

```text
agent,team,called_at,calls
Ly,North,2026-09-08,9
Minh Anh,East,2026-09-12,8
Ly,East,2026-09-14,7
```

```text
agent,team,called_at,calls
Ly,North,2026-09-09,1
Minh Anh,East,,2
```

**C0 (setup, no verdict):** upload `walk_week_1.csv` as dataset **weekly** in **Walk** → 3 rows,
`Data version · v1`.

| #   | Round · W | Do                                                                                                                                                                                                         | Expect                                                                                                                                    | Verdict |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| C1  | R188 · W1 | Refresh **weekly** › **Replace** with `walk_week_1.csv`; on Confirm › "More files in this refresh" add `walk_week_2.csv`; commit.                                                                          | 5 rows (3 + 2); `v2` — moved by one; the `Source.Name` column (hidden by default — un-hide it in Properties) names each row's file.       | ✅      |
| C2  | R188 · W2 | Refresh **weekly** › **Add rows** with `walk_week_3.csv` + more files `walk_calls_more.csv`; check repeated periods by `called_at`.                                                                        | No overlap reported; 9 rows (5 kept + 2 + 2); `v3`.                                                                                       | ✅      |
| C3  | R188 · W3 | Refresh **weekly** (Replace) with `walk_week_1.csv` + more files `walk_week_bad.csv`.                                                                                                                      | Refused, naming `walk_week_bad.csv`; still 9 rows, still `v3`.                                                                            | ✅      |
| C4  | R188 · W4 | Refresh the **teams** dataset (renamed in B5) with Replace and `walk_teams.csv` alone — no "More files".                                                                                                   | Looks and behaves as a refresh did before R188; the version moves by one.                                                                 | ✅      |
| C5  | R189 · W1 | Refresh **weekly** › **Replace a period**, column `called_at`, file `walk_week_2_redo.csv`.                                                                                                                | Toast: window 2026-09-08 → 2026-09-14, 2 removed, 3 inserted, 7 kept; 10 rows; the rows before 09-08 and after 09-14 are untouched; `v4`. | ✅      |
| C6  | R189 · W2 | Open Refresh on **weekly** again (cancel after looking).                                                                                                                                                   | "Replace a period" and `called_at` are pre-selected.                                                                                      | ✅      |
| C7  | R189 · W3 | Refresh **weekly** › Replace a period (`called_at`) with `walk_week_blank.csv`.                                                                                                                            | Refused with the count of rows with no date (1); still 10 rows, `v4`.                                                                     | ✅      |
| C8  | R189 · W4 | Refresh **weekly** › **Add rows** with `walk_week_2_redo.csv` (overlaps the committed 09-08 → 09-14), checking repeated periods by `called_at`; click the warning's "Replace this period instead"; cancel. | The overlap warning offers "Replace this period instead"; clicking it switches the mode to Replace a period with `called_at` picked.      | ✅      |

**After session C:** report the verdicts; the agent records them in R188–R189 (`coverage: n of 4`).

## What to watch beyond the script

- Any wording that made you hesitate — a label, a warning, an error — is a finding even if the item
  passes.
- Anything that needed a reload to show up.
- Dark mode (Settings): one look at A5, A8, A21's drawer, B12's warning and C1's "More files" block.
