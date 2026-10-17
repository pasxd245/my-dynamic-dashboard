# rc.4 — viewing by period

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Starts only after rc.3 is tagged.

**Order:** 4.2 → 4.3 → 4.4 → 4.1, then conditional items 4.5–4.7 only if their entry condition is
met in the rolling log. 4.1 (scheduled refresh) goes last because it depends on how the product is
deployed, which is the least settled question.

## 4.1 Scheduled refresh

|                                         |                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Track                                   | 1                                                                                                                                |
| Flow                                    | **DFCFBI** — the source location model is new                                                                                    |
| Open question (Design gate must answer) | where does a scheduled refresh read from? Options: a watched server folder; a URL; nothing (keep refresh manual and only remind) |

- **If a watched folder:** `refresh_source: {kind: folder, path, pattern, mode, periodColumn?}` on a
  dataset; a job in `app/jobs/` (pattern: `tmp_sweep.py`) runs on an interval from `app_config`,
  picks files newer than the last commit, applies 3.4/3.5 semantics, writes a run record
  `{startedAt, files, outcome, dataVersion}`.
- **Failure policy:** a failed run leaves the committed data untouched and surfaces on the dataset
  (`lastRefresh: failed, reason`). Never retry in a tight loop.
- **Tests:** job picks only new files; failure keeps data; disabled by default.

## 4.2 View-time date range

|            |                            |
| ---------- | -------------------------- |
| Track      | 1                          |
| Flow       | DCFBI                      |
| Depends on | 3.7 parameters, 2.7 design |

- A dashboard declares `dateRange: {from: {param}, to: {param}}` bound to two date parameters;
  the dashboard header shows a range picker with presets (this week, last week, this month, last
  month, custom). Values flow through 3.7 resolution and live in the URL.
- **Tests:** presets resolve against the configured time zone; widgets whose queries don't use the
  params show "not affected".

## 4.3 Shared filters for a group of widgets

|            |            |
| ---------- | ---------- |
| Track      | 1          |
| Flow       | DCFBI      |
| Depends on | 2.7 design |

- **Contract:** `DashboardDefinition.filters: [{id, column, op, values, scope: [widgetId] | "all"}]`.
  Saved by editors; viewers' temporary values in the URL (`?f.<id>=…`).
- **Behaviour:** a widget whose query lacks the column is skipped and shows a "filter not applied"
  badge — never an error. Each widget shows which shared filters reached it.
- **Backend:** shared filters are merged into the same filter path `/rows`, `/aggregate`, `/totals`,
  `/export` already accept (no second filter engine).
- **Tests:** scope respected; missing column skipped with badge; URL round trip; export carries the
  shared filter in its About sheet.

## 4.4 Definition history

|            |                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Track      | 1                                                                                                    |
| Flow       | DCFBI                                                                                                |
| Depends on | 3.2 — a definition's version is its hash (decision 14); history rows carry their own sequence number |

- **Migration** (next free number) `…_definition_history`: `(kind, id, version, definition_json, changed_at,
changed_by)`; written in the same transaction as the definition update.
- **Contract:** `GET /{kind}/{id}/history` (list), `GET /{kind}/{id}/history/{version}` (read-only
  definition). Restore = a normal PUT of an old definition (new version), no special endpoint.
- **Tests:** every definition change writes one row; rename writes none; restore creates a new
  version.

## Conditional items (open only with logged evidence)

| #   | Item                                                              | Entry condition (must be in the rolling log first)                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.5 | Cohort ratios flag cohorts not yet observable for the full window | a logged case where a ratio by creation period was misread because the newest cohort was incomplete, from a user other than the first, **or** the first user still needing a workaround after rc.3 |
| 4.6 | Previous/next row per entity step                                 | a measured attempt to rebuild the sequence with existing steps (window, `rank`, `prior_period`) succeeds on fewer than 70% of cases                                                                |
| 4.7 | Default filters inherited from an official measure                | logged cases of a drill-down query missing the official measure's filter, after 4.4 exists                                                                                                         |

## rc.4 exit gate

- [ ] 4.1–4.4 `Complete`, or 4.1 explicitly deferred by the human with the reason logged
- [ ] Shared filters and date range survive a URL round trip
- [ ] Every conditional item that opened has its measurement in the rolling log; those that didn't
      are listed as "not opened"
- [ ] The definition-history migration downgrades cleanly
