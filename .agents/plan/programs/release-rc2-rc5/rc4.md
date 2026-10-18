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

|            |                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Track      | 1                                                                                                      |
| Flow       | DCFBI                                                                                                  |
| Depends on | 3.7 parameters                                                                                         |
| Design     | [`dashboards/dashboard-filters.md`](../../../design/dashboards/dashboard-filters.md) D4, D7 (Accepted) |

_Re-based on the accepted design 2026-10-18._

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

_Re-based on the accepted design 2026-10-18._

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
