# rc.2 — display gaps

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Branch: `release/v0.0.1-rc.2` (cut from
`5334c81`). **All seven code items are built** (R177–R183, each round in `Review` with its walk
pending). This file records, per item, what shipped (**As built**) and anything still owed
(**Remaining**); the original intent is kept only where it still guides a walk or a follow-up.

**Why this rc first:** every item fills a gap that established BI tools already close (row height,
notes, totals, export, join checks), so design risk is low and user value is immediate. The item
with security weight is 2.6 (metadata).

**Order as executed:** 2.0 → 2.1 → 2.8 → 2.2 → 2.6 → 2.3 → 2.4 → 2.5 (the 2026-10-13 order:
2.6 reuses 2.2's sanitizer; export before relationship check, decision 6). 2.7 (design) moved to
rc.3.

**Shared conventions for all rc.2 rounds**

- Widget fields live in `DashboardDefinition` JSON (`dashboards.definition_json`) — **no migration**
  for widget additions. The one new table is `metadata_entries` (`0005_metadata_entries`).
- Every new widget field is optional and absent-by-default, so rc.1 dashboards load unchanged
  (proven on the dogfood: 5 dashboards byte-identical rc.1 → rc.2, `Round_183` § Do).
- `Widget` has `additionalProperties: false`: a field added to `_shared/dashboard.yaml` is added to
  the backend model and `builder/src/features/dashboard/types.ts` in the same Contract gate.
- Gate commands (run from repo root unless noted):
  - backend: `cd workspace/apps/backend && uv run pytest -q` (534 at the rc.2 head)
  - builder: `pnpm --filter builder test && pnpm --filter builder type-check` (432)
  - contracts: `pnpm --filter contracts test` (46)
  - docs: `pnpm md:lint && pnpm design:lint && pnpm plan:lint && pnpm check:links`

---

## 2.0 Close R176 and fix the Workflow program drift

|        |                                                                        |
| ------ | ---------------------------------------------------------------------- |
| Track  | 1 (close-out) + 2 (doc truth)                                          |
| Status | **done** — R176 `Complete` (human, 2026-10-15, `cc0f4fe`); drift fixed |

- **As built:** the human flipped R176 to `Complete` before R177 opened. The Workflow program drift
  was fixed on 2026-10-17: [`workflow-earns-its-place.plan.md`](../workflow-earns-its-place.plan.md)
  item 1 → ruled (a′); items 2–4 → done in R186 / R187.

## 2.1 Widget height (1–3 rows) — `Round_177`

|          |                                                         |
| -------- | ------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                            |
| Evidence | long tables (30–70 rows) clipped in a fixed 300 px body |

- **As built:** `Widget.rows` 1–3, optional, absent = 1, mirrors `span`. The dashboard became a
  **CSS grid** (the human's call at the visual gate: a flex-wrap row could not stack two short
  widgets beside a tall one); a taller widget is exactly as tall as the widgets stacked beside it
  (card chrome measured at 93 px). Tables page more rows per page with height. Size select next to
  width in `WidgetBuilder.tsx`.
- **Design doc:** `dashboards/dashboard-layout.md` § grid (synced 2026-10-17).

## 2.8 Date coverage per dataset — `Round_178` _(R-b; missing from the first draft)_

|          |                                                                                           |
| -------- | ----------------------------------------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                                                              |
| Evidence | a reader cannot tell which period an export covers, or how much of a date column is blank |

- **As built:** `Column.coverage {min, max, blankShare}` on every `date` / `datetime` column,
  profiled by the server on commit and on every refresh mode (replace, merge, append); a coverage
  strip on the dataset page and a line per column in the Properties drawer. Datasets committed
  before R178 carry none until their next refresh (by design). On the dogfood: 18 temporal columns
  profiled across 8 datasets.
- **Design doc:** `data-management/datasets/datasets.md`, `dataset-detail.md` (synced 2026-10-17).

## 2.2 Annotation widget (`note`) — `Round_179`

|          |                                                                                       |
| -------- | ------------------------------------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                                                          |
| Evidence | explanation of a number must sit next to the number; today every widget needs a query |

- **As built:**
  - Contract: `chartType` += `note`; new `md` (≤ 4 000 chars) required on `note`, forbidden
    elsewhere; `queryId` and `agg` left the schema's `required` list — required for every other
    chartType, absent on `note` (enforced as 422 by the backend, like `measureCol`).
  - Backend: `app/markdown_safe.py` — rejects raw HTML, images, and links that are not http(s).
    2.6 reuses it.
  - Builder: `SafeMarkdown.tsx` renders the allowed subset to React nodes (headings, emphasis,
    lists, links with `rel="noopener noreferrer"`, inline code with a monospace style, tables) —
    **no markdown dependency was added**.
- **Design doc:** `dashboards/widgets.md` § Notes (2026-10-17).

## 2.6 Metadata — view-only, written by token — `Round_180`

|          |                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                                                                                                      |
| Evidence | a pipeline or agent that loads data must leave a statement of where it came from and how it was matched, visible next to the data |

- **As built:**
  - Targets: dataset, column, relationship, query, workflow, dashboard, widget; one entry per
    namespace per target.
  - `GET /metadata/{kind}/{nounId}`, `PUT` and `DELETE /metadata/{kind}/{nounId}/{namespace}`
    (`metadata/*.contract.yaml`). Writes need a bearer token configured in
    `backend.metadata_tokens` (`[{token, author, source, namespaces}]`, token ≥ 16 chars, empty = writes off; `system` can never be granted): no or
    unknown token → 401; namespace not granted → 403; > 64 KiB, unsafe markdown or too many namespaces on one noun → 422.
  - The server stamps `author`, `source`, `writtenAt` and `definitionVersion` (12-hex hash of the
    target's definition, `null` members dropped — fixed in R182); a later definition change shows
    "may be out of date".
  - Migration `0005_metadata_entries` (composite key kind × noun × namespace).
  - Builder: `MetadataPanel` on the detail views, view-only, AI badge for `source=ai`, frontmatter
    shown as a key/value table, never interpreted.
- **Remaining:**
  - Entries are **not** removed when their noun is deleted (no cascade, no sweep) → logged; pulled
    into 3.8.
  - `alembic downgrade` of 0005 on a copy of a real database (only `upgrade` was run on the copy).
  - Design doc: `data-management/_shared/metadata.md` (written 2026-10-17).

## 2.3 Table total row — `Round_181`

|          |                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                                                                                              |
| Evidence | a ratio column's total must be SUM(num) / SUM(den), never a sum of row ratios; a long-open request in a major OSS BI tool |

- **As built:**
  - `Widget.totals` (table only): column → `{agg: sum | ratio, num?, den?}`, ≤ 64 entries; a column
    absent from the map has no total (no explicit `none`).
  - `POST /queries/{id}/totals` (`queries/totals.contract.yaml`): `{columns, filters}` → sums +
    `rowCount`, over the query's **post-step** relation under the active dashboard filters, no row
    cap. The client derives ratios from the sums; a zero denominator shows blank.
  - Builder: bold footer row (`TableView`), Totals editor per numeric column in `WidgetBuilder`.
  - Found and fixed on the way: editing a table / stat / gauge / scatter widget no longer resets it
    to a bar chart.
  - Dogfood: 133 / 133 numeric columns of 27 table widgets equal a Python sum of the same rows.

## 2.4 Export a table widget (CSV / XLSX) — `Round_182`

|          |                                                                                      |
| -------- | ------------------------------------------------------------------------------------ |
| Status   | done — `Complete` 2026-10-18                                                         |
| Evidence | design decision #3 "Excel output first"; users forward numbers to people without MDD |

- **As built:**
  - `POST /queries/{id}/export` (`queries/export.contract.yaml`): body `{format, filters, totals,
percent, title}` → file with a server-chosen name in `Content-Disposition` (exposed over CORS).
  - **Every** row of the same post-step, filtered relation the table reads; typed cells (numbers,
    dates; ratio columns formatted `0.0%` under the widget's percent format); the totals row last in
    bold; a `Filters` sheet with query, widget, export time, row count and the active filters. CSV is
    UTF-8 with BOM.
  - Over 100 000 rows → 422 `export_too_large` with the count.
  - Builder: download menu (Excel / CSV) on table widgets with toasts. Query-detail export: not built.
- **Remaining:** `dataVersion` of the datasets read, in the Filters sheet (→ 3.2 Remaining);
  parameters (→ 3.7). Chart-widget export deferred (log demand).

## 2.5 Relationship self-check — `Round_183`

|          |                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Status   | done — `Complete` 2026-10-18                                                                               |
| Evidence | design decision #4 "relationships are central"; a declared 1-n that is really n-n silently multiplies rows |

- **As built:** `GET /relationships/{id}/check` (computed on demand, never stored): rows and matched
  rows per side, coverage per side (blank keys count as unmatched), distinct keys and the most rows
  per key, the **observed** cardinality beside the declared one, `multipliesLeft` / `multipliesRight`;
  409 `relationship_stale`. A **Check** button per edge opens a read-only drawer (with the edge's
  metadata panel); the join modal warns before saving a hop that will multiply rows. A flag, never a
  block.
- **Remaining:** measure on a large pair before showing it on a list page; design doc
  `data-management/workspaces/relationships.md` (synced 2026-10-17). Not exercised on
  the dogfood (no relationship declared there yet).

---

## rc.2 exit gate

- [x] All gate commands green on the branch head (backend 534 · builder 432 · contracts 46)
- [x] Ratio total = SUM/SUM proven by a test whose fixture makes the two differ (R181)
- [x] Metadata with HTML or an image is rejected (test, R180; walked A9, A14)
- [x] An rc.1 dashboard JSON loads unchanged (dogfood parity, 5 dashboards byte-identical)
- [x] Dogfood dual-run rc.1 → rc.2: 119 / 119 items identical (R183 § Do)
- [x] Acceptance walk logged for R177–R183 (human) — [walk pack](walk-rc2-rc3a.md) session A, 23 of 23, 2026-10-18
- [x] R177–R183 `Complete` (flipped 2026-10-18 on the owner's instruction)
- [ ] `alembic downgrade -1 && alembic upgrade head` clean on a copy of a real database (0005)
- [x] Design-corpus debt paid — `design-sync` 2026-10-17 (landed on `release/v0.0.1-rc.3`; the rc.2 tag carries the pre-sync docs)
- [x] Walk blocker fixed before the walk: table widget save (`ff9647a`)
- [x] Release note lists every contract addition — drafted in `CHANGELOG.md` (`82a95c3`, on rc.2); owner reviews at the tag
- [ ] Boundary scan clean (`sync.ps1` M3) and tag `v0.0.1-rc.2` (human)
