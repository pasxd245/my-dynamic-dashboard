# rc.4 — viewing by period

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Starts only after rc.3 is tagged —
opened 2026-10-19 on its own branch `release/v0.0.1-rc.4` (cut at the rc.3 head `458aabc`) ahead
of the tag, the owner's call as for rc.3 (decision 12); nothing of rc.4 lands on rc.3.

**Execution:** the four-role loop of
[rc3.md § Execution](rc3.md#execution--the-four-role-loop-from-2026-10-18) — agents under
`.claude/agents/`, checklists `review-ba` / `review-cr` / `review-qa`, one row per round in
`.agents/metrics/agents.csv`, the prune rule and "a lesson that recurs a second time is promoted in
that round".

**Order:** 4.2 → 4.3 → 4.4 → 4.1, then conditional items 4.5–4.7 only if their entry condition is
met in the rolling log. 4.1 (scheduled refresh) goes last because it depends on how the product is
deployed, which is the least settled question — and was **deferred** by the owner on 2026-10-19
(§ 4.1). **4.8** (definition pack) was added by the owner the same day and runs after 4.4
(`Round_201`).

## 4.1 Scheduled refresh

|                                         |                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Track                                   | 1                                                                                                                                |
| Flow                                    | **DFCFBI** — the source location model is new                                                                                    |
| Open question (Design gate must answer) | where does a scheduled refresh read from? Options: a watched server folder; a URL; nothing (keep refresh manual and only remind) |
| Status                                  | **Deferred** by the owner, 2026-10-19 (`Round_201`) — not built in rc.4                                                          |

_**Deferred (owner, 2026-10-19).** Reason: "no deployment pull yet — the only active install
refreshes by hand on a weekly cadence and runs no scheduler; reopen when a deployment names a
watched source." Logged in the program's rolling log. The spec below is kept as written, unbuilt;
the open question stays open until a deployment names its source._

- **If a watched folder:** `refresh_source: {kind: folder, path, pattern, mode, periodColumn?}` on a
  dataset; a job in `app/jobs/` (pattern: `tmp_sweep.py`) runs on an interval from `app_config`,
  picks files newer than the last commit, applies 3.4/3.5 semantics, writes a run record
  `{startedAt, files, outcome, dataVersion}`.
- **Failure policy:** a failed run leaves the committed data untouched and surfaces on the dataset
  (`lastRefresh: failed, reason`). Never retry in a tight loop.
- **Tests:** job picks only new files; failure keeps data; disabled by default.

## 4.2 View-time date range

|            |                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Track      | 1                                                                                                      |
| Flow       | DCFBI                                                                                                  |
| Depends on | 3.7 parameters                                                                                         |
| Design     | [`dashboards/dashboard-filters.md`](../../../design/dashboards/dashboard-filters.md) D4, D7 (Accepted) |

_Re-based on the accepted design 2026-10-18. Built `Round_198` (2026-10-19) — see
[`dashboard-filters.md` § As built (4.2)](../../../design/dashboards/dashboard-filters.md)._

- A `date_range` **control** (`DashboardDefinition.controls`, from 3.7b) binds **two date
  parameters** (`from`, `to`) the targeted queries declare and use (`between`, `gte` / `lte`).
  Presets (this week, last week, last 7 days, this month, last month, custom) are saved as
  relative values and resolved by the server in `backend.time_zone`; the URL always holds
  absolute dates (`?p.from=…&p.to=…`).
- **Incomplete window (D7):** when a resolved range end is later than the dataset's coverage
  `max` (R178) on the filtered column, the widget shows "Data only through <max>" — a note, not a
  block.
- **Tests:** design criterion 9; presets resolve in the configured zone; a targeted widget whose
  query lacks the parameters is skipped and badged (D5).

## 4.3 Shared filters for a group of widgets

|            |                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Track      | 1                                                                                                          |
| Flow       | DCFBI                                                                                                      |
| Depends on | 3.7b (controls bar)                                                                                        |
| Design     | [`dashboards/dashboard-filters.md`](../../../design/dashboards/dashboard-filters.md) D4, D5, D7 (Accepted) |

_Re-based on the accepted design 2026-10-18. Built `Round_199` (2026-10-19) — see
[`dashboard-filters.md` § As built (4.3)](../../../design/dashboards/dashboard-filters.md)._

- **Contract:** a `values` control (`kind: values`, `column`, `targets: "all" | [widgetId]`,
  `saved?`) in `DashboardDefinition.controls`; options from the new `GET
/queries/{id}/values?column=` (distinct, capped at 1 000, flagged partial). Viewer values in
  the URL (`?f.<controlId>=North,South`, `~blank` for `(blank)`).
- **Behaviour:** sent in the existing `filters` list (no second filter engine); ANDed with the
  per-widget drawer; a targeted widget whose result lacks the column is skipped and badged —
  never an error (D5).
- **Export (D7):** the Filters sheet splits `dashboard filter <label>` from `widget filter` rows.
- **Tests:** design criteria 6 and 7 (filters part); scope respected; URL round trip; values
  endpoint cap.

## 4.4 Definition history

|            |                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Track      | 1                                                                                                    |
| Flow       | DCFBI                                                                                                |
| Depends on | 3.2 — a definition's version is its hash (decision 14); history rows carry their own sequence number |

_Built `Round_200` (2026-10-19, review) — see
[`_shared/definition-history.md`](../../../design/data-management/_shared/definition-history.md):
queries, dashboards **and workflows** (owner to confirm), migration `0011` with a `baseline`
backfill, `seq` + `change` + `changed_source` beside the spec's columns, `?seq=` on the version
read, `sourceChangedSince` on a query version, the History drawer on the three pages; restore is
the noun's PUT, and a widget's notes return with the widget._

- **Migration** (next free number) `…_definition_history`: `(kind, id, version, definition_json, changed_at,
changed_by)`; written in the same transaction as the definition update.
- **Contract:** `GET /{kind}/{id}/history` (list), `GET /{kind}/{id}/history/{version}` (read-only
  definition). Restore = a normal PUT of an old definition (new version), no special endpoint.
- **Tests:** every definition change writes one row; rename writes none; restore creates a new
  version.

## 4.8 Definition pack

|            |                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track      | 1                                                                                                                                                    |
| Flow       | **DFCFBI (triggers 1, 3, 4)** — `flow-selector` at the R201 Design gate                                                                              |
| Depends on | 4.4 (an import writes history rows through the normal write path; a replaced definition stays restorable); 3.7 / 4.2 / 4.3 (controls travel as-is) |
| Design     | [`_shared/definition-pack.md`](../../../design/data-management/_shared/definition-pack.md) (Draft, R201)                                            |

_Added to rc.4 by the owner, 2026-10-19 (specified and built in rc.4). Track: 1. Pulled by: a named
product gap — a second install, or a clean re-install, that should carry the same analysis as an
existing one re-creates its queries, dashboards and workflows by hand or by scripting the create /
update routes one by one, with ids that differ per install; an earlier round's parity check needed
a probe built by hand for the same reason (`Round_200` § Feeds into)._

- **Export** `GET /workspaces/{id}/definitions` → a pack (`packVersion: 1`): every query, workflow
  and dashboard of the workspace, each list by name, with every reference to a dataset, query or
  workflow written as its **name** (a query's `dataset`, its relationships' `leftDataset` /
  `rightDataset`; a widget's `query`; a workflow source `{query}` / `{workflow}`), and the datasets
  the queries read with their columns (`name`, `dtype`, in order). Ids that live inside one
  definition (`wdg_`, `ctl_`, `qrel_`) travel verbatim; no install id appears. A reference to a
  deleted noun refuses the export (`409 pack_unresolved`, listed). Data never travels.
- **Import** `POST /workspaces/{id}/definitions/import?dryRun=&onConflict=` with the pack as body:
  the datasets are found **by name** in the target and must have the pack's columns (a missing or
  differing one is listed with both column lists); each noun is planned against its same-named
  noun — `create`, `unchanged` (the target already holds exactly this, so a re-import writes
  nothing), or by `onConflict`: `refuse` (default, `conflict`), `replace` (the noun's own update:
  the id kept, one history row), `skip`. Every noun runs every check its own create / update runs
  (the route bodies are extracted into functions that take a connection — no parallel writer).
- **One transaction:** the whole plan runs in one `BEGIN IMMEDIATE`; a dry run rolls back and
  returns the plan (200); an apply commits only when the plan is ok, else `409 pack_refused`
  with the plan — whole pack or nothing. A pack this install cannot read (another
  `packVersion`, a name not in the pack, a duplicate name, a workflow loop, over 10 MiB or
  1 000 nouns) → `422 pack_invalid`. A saved workspace → `409 read_only_workspace`. An optional
  writer token labels the history rows; import is as open as the PUTs.
- **Out:** metadata notes (server-stamped by their writers; anchors do not cross installs),
  governed relationships, runs / outputs / the publish link, history, partial export, a per-noun
  conflict choice, remapping columns by name — each with a trigger in the design doc.
- **Builder:** **Export definitions** (main and saved workspaces) and **Import definitions…**
  (main only) in the workspace card menu; the import modal reads the file, checks it at once
  (the dry run), shows the datasets and the plan, and imports on one click; EN / VI.
- **Tests:** export A → import into a clean workspace B with same-named fake datasets → every
  query's rows, every widget's aggregate and every workflow's output (after running) equal A's
  (a parity test over fake data, also across two data roots); re-import is idempotent (no row
  written); a missing dataset refuses with the list; a dry run writes nothing; the conflict
  rules; whole pack or nothing; design criteria 1–15.

## Conditional items (open only with logged evidence)

| #   | Item                                                              | Entry condition (must be in the rolling log first)                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.5 | Cohort ratios flag cohorts not yet observable for the full window | a logged case where a ratio by creation period was misread because the newest cohort was incomplete, from a user other than the first, **or** the first user still needing a workaround after rc.3 |
| 4.6 | Previous/next row per entity step                                 | a measured attempt to rebuild the sequence with existing steps (window, `rank`, `prior_period`) succeeds on fewer than 70% of cases                                                                |
| 4.7 | Default filters inherited from an official measure                | logged cases of a drill-down query missing the official measure's filter, after 4.4 exists                                                                                                         |

## rc.4 exit gate

- [ ] 4.1–4.4 `Complete`, or 4.1 explicitly deferred by the human with the reason logged — **4.1
      deferred** by the owner 2026-10-19, reason logged (§ 4.1, rolling log); 4.2–4.4 open
- [ ] 4.8 `Complete` — a pack exported from one workspace imports into a clean workspace with
      the same numbers (parity test), and a re-import writes nothing
- [ ] Shared filters and date range survive a URL round trip
- [ ] Every conditional item that opened has its measurement in the rolling log; those that didn't
      are listed as "not opened"
- [ ] The definition-history migration downgrades cleanly
