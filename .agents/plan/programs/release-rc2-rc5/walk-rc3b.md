# Walk pack — rc.3 batch 2 (R191–R197)

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). About 2 hours 15 minutes in all, for
the human reviewer, in up to three sittings. It strings the seven rounds' acceptance walks (44 items;
R194 has none of its own — its engine is walked through R195) into one route over a throw-away dev
install with **fake data only**, so nothing touches a real data folder. Each item is copied from its
round's § Check with its id; the verdict goes back into that round (the agent records it).

**Session D** (R191–R193, about 60 min) walks the fix round, publishing a workflow's output and
saved copies. **Session E** (R194–R195, about 25 min) walks typed parameters: the R195 builder,
which drives R194's engine end to end. **Session F** (R196–R197, about 40 min) walks data versions
in reads and exports, and the metadata triple anchor. Each round works in its own workspace, so the
sessions do not depend on each other's data and can run on different days, in any order; the only
shared step is the setup below (about 10 min, once). Inside a session, walk the items in order —
later items build on earlier ones.

## Setup (Windows, PowerShell) — a separate worktree, its own data folder

Stop any MDD already running — the walk uses ports 8000 and 3000.

```powershell
cd <your-mdd-checkout>                                  # the everyday clone of this repo
git worktree add --detach ..\mdd-walk-rc3b release/v0.0.1-rc.3   # at f6f48f9 or later
cd ..\mdd-walk-rc3b
pnpm install
pnpm run config:render
cd workspace\apps\backend
uv sync --extra test
# Metadata writes ON (session F writes notes; session D does not need it, but it does no harm):
$env:MDD_BACKEND__METADATA_TOKENS = '[{"token":"walk-token-0123456789","author":"walker","source":"ai","namespaces":["aicowork"]}]'
Start-Process cmd -ArgumentList '/k uv run uvicorn app.main:app --host 127.0.0.1 --port 8000'
cd ..\..\..
Start-Process cmd -ArgumentList '/k pnpm --filter builder dev'
```

(`--detach` because the everyday clone may already have the release branch checked out; a worktree
left from the first walk pack, `..\mdd-walk`, can stay — this one is separate.)

The worktree's data lives in `..\mdd-walk-rc3b\workspace\apps\backend\data\` — its own folder,
never the everyday one. When done: close the two windows, then `git worktree remove ..\mdd-walk-rc3b`
(after copying anything you want to keep).

**Dark theme:** the app has none (`themeTokens.ts` uses the default algorithm only; R191, R195,
R196 and R197 recorded the same), so every dark-mode check is **N/A** — owner to confirm. The rc.3
exit-gate line "light and dark" waits on that call.

**Walk files** — save these as UTF-8 CSV in any folder (they are made up). The first three are the
same as in [walk-rc2-rc3a.md](walk-rc2-rc3a.md); reuse them if you kept them.

`walk_calls.csv` (6 rows; `calls` totals 23; North 3, East 14):

```text
agent,team,called_at,calls
Ly,North,2026-09-01,1
Ly ,North,2026-09-02,2
 Ly,East,2026-09-03,3
 Ly ,East,,4
Minh Anh,East,2026-09-05,7
   ,West,2026-09-06,6
```

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

`walk_calls_text.csv` (R191 W7 — `calls` as text, two cells not numbers; quote the `"1,200"`):

```text
agent,team,called_at,calls
Ly,North,2026-10-01,5
Minh Anh,East,2026-10-03,"1,200"
Ly,East,2026-10-04,n/a
```

`walk_deals.csv` and `walk_accounts.csv` (R196 — five deals on three accounts):

```text
deal_id,account_id,stage,amount,closed_on
D1,A1,Won,1200,2026-09-02
D2,A1,Lost,300,2026-09-04
D3,A2,Won,800,2026-09-05
D4,A3,Open,450,2026-09-08
D5,A2,Won,650,2026-09-09
```

```text
account_id,account_name,region
A1,Account One,North
A2,Account Two,East
A3,Account Three,South
```

`walk_accounts_v2.csv` and `walk_deals_more.csv` (R196 refreshes — Replace with these):

```text
account_id,account_name,region
A1,Account One,North
A2,Account Two,East
A3,Account Three,West
A4,Account Four,North
```

```text
deal_id,account_id,stage,amount,closed_on
D1,A1,Won,1200,2026-09-02
D2,A1,Lost,300,2026-09-04
D3,A2,Won,800,2026-09-05
D4,A3,Won,450,2026-09-08
D5,A2,Won,650,2026-09-09
D6,A4,Won,500,2026-09-12
```

`walk_calls_demo.csv` and `walk_calls_demo_v2.csv` (R197 — the second is the first with **one row
changed**: id 4's amount 120 → 130):

```text
id,team,day,amount
1,North,2026-10-02,100
2,East,2026-10-03,250
3,North,2026-10-06,80
4,East,2026-10-09,120
5,North,2026-10-11,60
6,East,2026-10-13,90
7,North,2026-10-16,40
```

```text
id,team,day,amount
1,North,2026-10-02,100
2,East,2026-10-03,250
3,North,2026-10-06,80
4,East,2026-10-09,130
5,North,2026-10-11,60
6,East,2026-10-13,90
7,North,2026-10-16,40
```

**Metadata commands** (PowerShell; session F). Replace `<qr_id>` with the id in the query page's
URL (`/data-management/queries/<qr_id>`), `<ws_id>` with the one in the dashboard's URL
(`/dashboards/<ws_id>/<slug>`). Writing needs the bearer token; `params` names the values the note
was written under (leave it out to write under the saved / default values):

```powershell
$api = 'http://127.0.0.1:8000'
$u = "$api/metadata"
$h = @{ Authorization = 'Bearer walk-token-0123456789' }
# The dashboard and widget ids (a widget's metadata id is <dsh_id>:<wdg_id>):
Invoke-RestMethod "$api/workspaces/<ws_id>/dashboards" | ForEach-Object { $_.id; $_.definition.widgets | Select-Object id, title }
# A note on the query, written under as_of = 2026-10-11:
$b = @{ md = "Week to 2026-10-11: amounts look normal."; params = @{ as_of = '2026-10-11' } } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "$u/query/<qr_id>/aicowork" -Headers $h -ContentType 'application/json' -Body $b
# The same on a widget:
Invoke-RestMethod -Method Put -Uri "$u/widget/<dsh_id>:<wdg_id>/aicowork" -Headers $h -ContentType 'application/json' -Body $b
# A dashboard note with md only (no params):
$b2 = @{ md = "Dashboard note, no period given." } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "$u/dashboard/<dsh_id>/aicowork" -Headers $h -ContentType 'application/json' -Body $b2
```

Mark each ✅ / ❌ and write one line on anything surprising — the surprise is the finding.

## Session D — fixes, publish, saved copies (R191–R193)

### R191 — fix round (8 items)

**D0 (setup, no verdict):** a new workspace **Walk191**: upload `walk_calls.csv` as **calls**,
`walk_teams.csv` as **teams** and again as **teams2**; Relationships: declare `calls.team` →
`teams.team`, **many:1**; queries **calls all** (no filter) and **calls East** (`team = East`) on
**calls**; a dashboard **Walk191**.

| #   | Round · W           | Do                                                                                                                                                                                                                               | Expect                                                                                                                                                | Verdict |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D1  | R191 · W1 (F3)      | On **Walk191**: a Table widget over _calls all_, Totals Sum on `calls`; download CSV and Excel. Then a query **calls first** whose step keeps `calls`, `team` in that order, a Table over it with Sum on `calls`; download both. | First: footer and files end `Total \| \| \| 23`. Second: the page footer shows `23` with no label; the files end `23,Total`. 23 is never replaced.    | ⬜      |
| D2  | R191 · W2 (F9)      | Dataset **calls**, advanced query `calls:>100`; then switch to VI.                                                                                                                                                               | "No rows match the advanced query" + **Clear advanced query** (VI "Không có dòng nào khớp với truy vấn nâng cao"); the button brings the 6 rows back. | ⬜      |
| D3  | R191 · W3 (F7)      | From **teams**: Join with related, the `team ↔ team` edge, read the warning, Cancel. The same from **calls**; save as **calls+teams**.                                                                                           | Both: "Joining from calls to teams can multiply rows: a key has up to 2 rows on teams…"; the saved query starts from **calls**.                       | ⬜      |
| D4  | R191 · W4 (F8)      | Relationships › Declare `calls.team` → `teams2.team`, don't submit; delete **teams2** in a second tab; submit.                                                                                                                   | "Couldn't declare the relationship — One of the datasets is not in this workspace any more. Reload and pick again." — never "Request failed".         | ⬜      |
| D5  | R191 · W5 (F6, F5)  | A workflow with sources _calls all_ and _calls East_; group by `Source.Query`, Sum `calls`; save, run. Remove _calls East_ and reopen the step's column list. Read the query builder's canvas help.                              | `Source.Query` offered with two sources only; _calls all_ 23, _calls East_ 14; builder copy offers only a dataset as the base.                        | ⬜      |
| D6  | R191 · W6 (F12)     | A Bar widget over _calls all_, agg **Count**, dimension `team`; switch to **Combo**, measures `calls` / `calls`; Save; View as JSON.                                                                                             | The save works; `"agg": "sum"`.                                                                                                                       | ⬜      |
| D7  | R191 · W7 (F13, F2) | A Stat, Sum of `calls` over _calls+teams_ (note the value). Refresh **calls** with `walk_calls_text.csv` (Replace, acknowledge the type change); read the Confirm footer; commit; reopen the dashboard.                          | "Refreshing **calls** in **Walk191**." and the stat card in its empty state — never 10.                                                               | ⬜      |
| D8  | R191 · W8 (F1)      | Delete _calls first_; reload the dashboard.                                                                                                                                                                                      | Its card at once: "Saved query unavailable — The query this widget used was deleted. Edit the widget to pick another query."; other cards unchanged.  | ⬜      |

### R192 — publish a workflow's output (9 items)

**D9 (setup, no verdict):** a new workspace **Pub**: upload `walk_calls.csv` as **calls**; queries
**North** (`team = North`) and **East** (`team = East`) on it; workflow **Calls by team** with
sources North and East, no steps, **not run**; a dashboard (any name) for W4.

| #   | Round · W | Do                                                                                                                                                          | Expect                                                                                                                                                                                                                                                                                                                         | Verdict |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| D10 | R192 · W1 | Open **Calls by team**, hover (or Tab to) **Publish**.                                                                                                      | Disabled, "Run this workflow first."; the Datasets list has only **calls**.                                                                                                                                                                                                                                                    | ⬜      |
| D11 | R192 · W2 | **Run**; **Publish**, type `calls`, OK; then type `Calls by team`, OK.                                                                                      | First OK: the modal stays open, "A dataset with this name already exists in this workspace." Second: toast "Published as dataset “Calls by team”."; under the summary "Published as dataset **Calls by team** · data version 1 · from run #1"; the button now reads **Re-publish**, disabled: "This run is already published." | ⬜      |
| D12 | R192 · W3 | Follow the link. Then hide `team` in Properties.                                                                                                            | 5 rows; Data version v1; Format **Workflow** (title tag too); "Published from workflow **Calls by team** · run #1 · <time>"; `Source.Query` North (2) / East (3); `Source.Name` hidden; Actions menu without **Refresh**.                                                                                                      | ⬜      |
| D13 | R192 · W4 | Save the dataset as query **Published calls**; on a dashboard add a Table over it with Totals › Sum of `calls`, and a bar of Sum `calls` by `Source.Query`. | Footer 17; North 3, East 14.                                                                                                                                                                                                                                                                                                   | ⬜      |
| D14 | R192 · W5 | Refresh **calls** with `walk_calls_more.csv` (Add rows); open **Calls by team**.                                                                            | The out-of-date warning; **Re-publish** disabled, "The results are out of date — re-run first."; the dataset still v1.                                                                                                                                                                                                         | ⬜      |
| D15 | R192 · W6 | Edit the workflow: a step that drops `agent`, a step that adds a column (e.g. a date part of `called_at`); save. Then **Run**.                              | After save: "The workflow was edited after this was published — run it, then re-publish." After Run: "The workflow was re-run after this was published. Re-publish to update Calls by team."                                                                                                                                   | ⬜      |
| D16 | R192 · W7 | **Re-publish**; confirm. Reload the dataset and the dashboard.                                                                                              | The confirm reads "Replace the data in Calls by team (data version 1, run #1) with run #N? …" and lists `agent — removed…`, `<new column> — new`; then "…updated — data version 2". After reload: v2, 7 rows, lineage run #N, `team` still hidden; footer 24; North 8, East 16.                                                | ⬜      |
| D17 | R192 · W8 | Delete the workflow; open the dataset.                                                                                                                      | "Published from workflow **Calls by team** (the workflow no longer exists) · run #N"; the dashboard still 24.                                                                                                                                                                                                                  | ⬜      |
| D18 | R192 · W9 | Datasets list.                                                                                                                                              | **Calls by team** has the workflow icon (tooltip "Workflow" / VI "Quy trình") and its row menu has Rename / Delete, no Refresh; **calls** keeps Refresh.                                                                                                                                                                       | ⬜      |

### R193 — saved copies (8 items)

**D19 (setup, no verdict):** a new workspace **Freeze**: upload `walk_calls.csv` as **calls** (a
note on it is optional).

| #   | Round · W | Do                                                                                                   | Expect                                                                                                                                                                                                                                 | Verdict |
| --- | --------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D20 | R193 · W1 | Open **calls** › Actions › **Save frozen copy…**; Save.                                              | The item is there; the modal's label is today's date and the preview reads "calls @<today>"; toast "Saved “calls @<today>”." with **Open the copy**.                                                                                   | ⬜      |
| D21 | R193 · W2 | Open the copy.                                                                                       | The band "Not the current numbers — frozen copy of “calls”: data version 1, rows as of …; saved … (label <today>)" and **Open the current dataset**; subtitle "Saved …"; Actions = Properties (no toggles) + Delete; no Save as query. | ⬜      |
| D22 | R193 · W3 | Workspaces; open **Freeze-saved**; its Relationships page.                                           | A **Freeze-saved** card tagged "Saved copies" · "of Freeze", menu Delete only; inside: no Upload; its Relationships page has no Declare.                                                                                               | ⬜      |
| D23 | R193 · W4 | Refresh **calls** with `walk_calls_more.csv` (Add rows). Then save a copy again with the same label. | **calls** is v2 with more rows; the copy still v1, same rows. The new copy is "calls @<today> v2", with v2's rows.                                                                                                                     | ⬜      |
| D24 | R193 · W5 | Upload, new query, new workflow, new dashboard: open each one's workspace picker.                    | The pickers list **Freeze**, not **Freeze-saved**.                                                                                                                                                                                     | ⬜      |
| D25 | R193 · W6 | Workspaces › delete **Freeze**.                                                                      | Refused ("has N datasets…", N counting the copies).                                                                                                                                                                                    | ⬜      |
| D26 | R193 · W7 | Delete **calls** (the original); open a copy.                                                        | The copy's band now says "The original dataset no longer exists"; its rows still open.                                                                                                                                                 | ⬜      |
| D27 | R193 · W8 | Switch to VI; open a copy and Workspaces.                                                            | The band reads "Không phải số liệu hiện tại — bản sao cố định của “calls”: …"; the card tag "Bản sao đã lưu" · "của Freeze".                                                                                                           | ⬜      |

**After session D:** report the verdicts; the agent records them in R191, R192 and R193
(`coverage: n of 8 / 9 / 8`).

## Session E — typed parameters (R194 engine, R195 builder)

R194 has no walk of its own ([Round_194](../../cycles/Round_194.md) § Check points here): its
engine — viewer → dashboard → default, `param_unbound`, `param_invalid`, `resolvedParams`, the
export's Parameters block — is exercised by the R195 items below. Record R194 as walked when E
passes.

**E0 (setup, no verdict):** a new workspace **Params**: upload `walk_calls.csv` as **calls**; query
**Calls as of** over it (no filter yet); query **All calls** (no parameter); a dashboard **Weekly**
with a table widget on each query. (The data's dates are September 2026, so a default of
"yesterday" keeps every dated row; pick dates like 2026-09-03 to see rows change.)

| #   | Round · W | Do                                                                                                                                                                                                             | Expect                                                                                                                                                                                                      | Verdict |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| E1  | R195 · W1 | **Calls as of** › Edit › Parameters › Add: `as_of`, date, label "As of", default "Today ± days" −1. On a date column's filter (`called_at`), choose `lte`, turn on **Use parameter**, pick As of, Apply. Save. | The chip reads `as_of (parameter)`; the save works.                                                                                                                                                         | ⬜      |
| E2  | R195 · W2 | Open the view. Type another date. Reload. Then change the default to "No default" and save.                                                                                                                    | The view shows "as_of = <yesterday> (default)"; typing puts `p.as_of` in the URL and the rows change; reload keeps the value. With no default: "Pick a value for As of." with no count and no table.        | ⬜      |
| E3  | R195 · W3 | **Weekly** › **Parameters** › Add a control for… as_of; applies to all widgets; saved value a fixed date. Save.                                                                                                | The bar shows that date. Badges: "As of" on **Calls as of**, and "As of skipped" on **All calls** (hover gives the reason).                                                                                 | ⬜      |
| E4  | R195 · W4 | Change As of in the bar. Reload without the `p.`. Change it again; Copy link, open it in a new tab. Reset to saved.                                                                                            | The bound card moves, the input is outlined, **Reset to saved** appears, and nothing is saved (reload without the `p.` keeps the saved value). The link: same value, same numbers. Reset: the URL is clean. | ⬜      |
| E5  | R195 · W5 | Edit the URL to `p.as_of=2026-13-45`.                                                                                                                                                                          | The bound card says "As of: not a valid date."                                                                                                                                                              | ⬜      |
| E6  | R195 · W6 | Export the bound table (XLSX).                                                                                                                                                                                 | The Filters sheet has a Parameters block with as_of, its value and its source.                                                                                                                              | ⬜      |
| E7  | R195 · W7 | Rename **Weekly** from the dashboard list, reopen it. Then remove the **Calls as of** widget while the control targets it; save.                                                                               | The bar and its saved value are still there; the save works.                                                                                                                                                | ⬜      |
| E8  | R195 · W8 | Switch to VI.                                                                                                                                                                                                  | The bar, the badges and the editor read in Vietnamese ("Về giá trị đã lưu", "Bỏ qua As of", "Dùng tham số").                                                                                                | ⬜      |

**After session E:** report the verdicts; the agent records them in R195 (`coverage: n of 8`) and
notes R194's walk as covered by it.

## Session F — data versions and the metadata anchor (R196, R197)

### R196 — data versions on reads and exports (5 items)

**F0 (setup, no verdict):** a new workspace **Versions**: upload `walk_deals.csv` as **deals** and
`walk_accounts.csv` as **accounts**; Relationships: declare `deals.account_id` →
`accounts.account_id`, many:1; a joined query **Deals × accounts** (from **deals**, Join with
related › that edge).

| #   | Round · W | Do                                                                                                               | Expect                                                                                                                                                       | Verdict |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| F1  | R196 · W1 | Refresh **accounts** once (Replace with `walk_accounts_v2.csv`). Export **Deals × accounts** (XLSX).             | The Filters sheet has a Data versions block — deals v1, accounts v2.                                                                                         | ⬜      |
| F2  | R196 · W2 | On **deals**, hide one column (e.g. `stage`), then Actions › **Export all rows (.csv)**.                         | The file is `deals_v1.csv`, without the hidden column.                                                                                                       | ⬜      |
| F3  | R196 · W3 | Save a frozen copy of **deals**; refresh **deals** (Replace with `walk_deals_more.csv`); export the copy (XLSX). | The Filters sheet says "frozen; the live dataset may have been refreshed since", `original_data_version_now` 2, and the rows are the frozen ones (5, no D6). | ⬜      |
| F4  | R196 · W4 | Rename **deals** to `=SUM(1,2)` and export it (XLSX); open in Excel. Rename it back.                             | Excel shows the text `=SUM(1,2)`, not 3.                                                                                                                     | ⬜      |
| F5  | R196 · W5 | Switch to VI; open **deals** › Actions.                                                                          | The menu reads "Xuất toàn bộ dòng (.xlsx)" / "(.csv)".                                                                                                       | ⬜      |

### R197 — metadata triple anchor and cascade (6 items)

**F6 (setup, no verdict):** a new workspace **Anchor**: upload `walk_calls_demo.csv` as
**calls_demo** (id, team, day, amount); query **Calls by week** on it with a date parameter `as_of`
(label "As of", default 2026-10-10) filtering `day ≤ as_of` (as in E1, `lte` + Use parameter); a
dashboard **Demo** with two table widgets over **Calls by week**, and an As of control targeting the
**first widget only**, saved value 2026-10-04. The backend runs with the metadata token (Setup).
Notes are written with the `PUT /metadata/...` commands above.

| #   | Round · W | Do                                                                                                                                                                               | Expect                                                                                                                                                      | Verdict |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| F7  | R197 · W1 | Current: write a note on the query with `params {as_of: 2026-10-11}`. Open the query page with `?p.as_of=2026-10-11`. Switch to VI and back.                                     | The note is open, no flag (in VI too).                                                                                                                      | ⬜      |
| F8  | R197 · W2 | Another period: change the URL to `p.as_of=2026-10-17`. Show, then Hide.                                                                                                         | The note collapses: "Written for As of 2026-10-11 · viewing As of 2026-10-17"; Show opens it, Hide closes it.                                               | ⬜      |
| F9  | R197 · W3 | On **Demo**, write a note on the first widget under 2026-10-11. Switch the control to 10-04 and back to 10-11 within 30 s; open the widget info popover.                         | The note is open again.                                                                                                                                     | ⬜      |
| F10 | R197 · W4 | Refreshed: re-upload **calls_demo** with one row changed (Refresh › Replace with `walk_calls_demo_v2.csv`). Open the query at 10-11 and **Demo**.                                | The query note at 10-11 shows the blue flag and stays open; the widget footer reads "Data: refreshed <now>".                                                | ⬜      |
| F11 | R197 · W5 | Earlier definition: add a filter to the query (e.g. `team = North`); save. Open the query's, the widget's and the dashboard's notes. Then write a dashboard note with `md` only. | The query, widget and dashboard notes collapse; opening one warns. The `md`-only dashboard note reads "Written under the saved or default value of: As of". | ⬜      |
| F12 | R197 · W6 | Delete **Demo**, then the query. On a copy of the database, list the swept table (command below).                                                                                | Their notes are gone from the app; `metadata_entries_swept` holds them with `swept_at`.                                                                     | ⬜      |

F11 as written collapses a dashboard note that the walk only writes in the same step. To see a
dashboard note collapse, write one (the `$b2` command) at F9, before the filter change; the
`md`-only check then still applies to the note written in F11 (it overwrites the same namespace).

F12's database check (from the worktree root; the copy keeps the walk's database untouched):

```powershell
Copy-Item workspace\apps\backend\data\app.sqlite "$env:TEMP\walk-rc3b-copy.sqlite"
python -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); [print(r) for r in c.execute('SELECT kind, noun_id, namespace, swept_at FROM metadata_entries_swept')]" "$env:TEMP\walk-rc3b-copy.sqlite"
```

**After session F:** report the verdicts; the agent records them in R196 (`coverage: n of 5`) and
R197 (`coverage: n of 6`).

## Recording the verdicts, and what follows

- Report each item's ✅ / ❌ with its id (e.g. `D7 ❌ — the card showed 5`) and any one-line
  surprise. The agent writes each verdict into its own round's § Check (the ⬜ under that W becomes
  ✅ or ❌) with `coverage: n of N`; a ❌ becomes a finding in that round, not a note here.
- After all three sessions pass: the owner flips R191–R197 `Complete` (R194 with R195's walk), then
  runs the **dogfood dual-run** against rc.2 on the real export, on the owner's machine — the
  [rc3.md § rc.3 exit gate](rc3.md#rc3-exit-gate) line "every saved query identical cell for cell,
  except changes a round declared" — and ticks the rest of that gate before the tag.

## What to watch beyond the script

- Any wording that made you hesitate — a label, a warning, an error — is a finding even if the item
  passes.
- Anything that needed a reload to show up.
- Dark mode: N/A — no dark theme exists (owner to confirm).
