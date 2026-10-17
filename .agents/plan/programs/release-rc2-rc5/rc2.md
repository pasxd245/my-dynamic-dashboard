# rc.2 — display gaps

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md). Branch: `release/v0.0.1-rc.2`.
Every item is one round (one DCFBI slice) unless it says otherwise. Round numbers are assigned
when the round file is created (next free `Round_NN`); the item id (`2.3`) is the stable name.

**Why this rc first:** every item fills a gap that established BI tools already close (row height,
notes, totals, export, join checks), so design risk is low and user value is immediate. The one
item that creates a new surface with security weight is 2.6 (metadata).

**Order:** 2.0 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7. 2.2 lands the markdown sanitizer that
2.6 reuses; 2.4 (export) goes before 2.5 (decision 6).

**Shared conventions for all rc.2 rounds**

- Widget fields live in `DashboardDefinition` JSON (`dashboards.definition_json`) — **no migration**
  for widget additions. New tables need an Alembic revision after `0004_many_to_one_cardinality`
  with a working `downgrade()`.
- Every new widget field is optional and absent-by-default, so rc.1 dashboards load unchanged
  (add a fixture test: an rc.1 `definition_json` round-trips byte-identical through GET/PUT).
- `Widget` has `additionalProperties: false`: a field added to `_shared/dashboard.yaml` must also be
  added to the backend model and `builder/src/features/dashboard/types.ts` in the same Contract gate.
- Gate commands (run from repo root unless noted):
  - backend: `cd workspace/apps/backend && uv run pytest -q`
  - builder: `pnpm --filter builder test && pnpm --filter builder type-check`
  - contracts: `pnpm --filter ./workspace/packages/contracts test`
  - docs: `pnpm md:lint && pnpm design:lint && pnpm plan:lint && pnpm check:links`

---

## 2.0 Close R176 and fix the Workflow program drift

|       |                                                                 |
| ----- | --------------------------------------------------------------- |
| Track | 1 (close-out) + 2 (doc truth)                                   |
| Flow  | none — close-out, no new code                                   |
| Owner | **Human** walks W1–W3 and signs off; agent prepares and records |

- **Do:** agent writes a walk script for W1–W3 into `Round_176.md § Check` (steps, expected result
  per step, where to look), the human runs it, the agent records results and flips to `Review`
  evidence; only the human flips `Complete`.
- **Doc drift:** update [`workflow-earns-its-place.plan.md`](../workflow-earns-its-place.plan.md)
  item 1 to **ruled (a′) — publish as a derived dataset (R175, 2026-10-04)**; items 2–4 become
  "scheduled in rc.3 item 3.3". Status line → `Active — item 1 ruled`.
- **Done when:** `Round_176` = `Complete`; the Workflow program no longer says "open"; `pnpm
plan:lint` and `pnpm check:links` green.

## 2.1 Widget height (1–3 rows)

|          |                                                         |
| -------- | ------------------------------------------------------- |
| Track    | 1                                                       |
| Flow     | DCFBI (small, mirrors `span`)                           |
| Evidence | long tables (30–70 rows) clipped in a fixed 300 px body |

- **Design:** add § Widget size to a new `.agents/design/dashboards/dashboard-layout.md` (there is
  no dashboards design folder yet — create it from `data-management/_TEMPLATE.md`). Journey: editor
  sets height 1/2/3 next to width; viewer sees the taller card.
- **Contract** (`_shared/dashboard.yaml › Widget`): `rows: integer, minimum 1, maximum 3`,
  optional, absent = 1. Description mirrors `span`.
- **Backend:** accept + validate on `POST`/`PUT /dashboards` (out of range → 422 via existing
  validation path in `routers/dashboards.py`).
- **Builder:** `ChartCard.tsx` — replace the constant `BODY_HEIGHT = 300` with
  `bodyHeight(rows) = 300 * rows + 24 * (rows - 1)` (one function, exported, tested). Size control
  in `WidgetBuilder.tsx` next to `span`.
- **Tests:** contracts schema accepts 1–3, rejects 0/4; backend 422 on 4; builder unit test for
  `bodyHeight`; rc.1 fixture round-trip.
- **Walk:** create a table widget over a 40-row query, set rows = 3, reload, confirm height persists.
- **Done when:** gates green + walk logged.

## 2.2 Annotation widget (`note`)

|          |                                                                                       |
| -------- | ------------------------------------------------------------------------------------- |
| Track    | 1                                                                                     |
| Flow     | DCFBI                                                                                 |
| Evidence | explanation of a number must sit next to the number; today every widget needs a query |

- **Design:** `dashboard-layout.md § Notes`. A note has a title and a markdown body, no query.
  Allowed markdown: headings, emphasis, lists, links, inline code, tables. **Not allowed:** raw HTML,
  images, embedded media. Links open in a new tab with `rel="noopener noreferrer"`.
- **Contract:**
  - `chartType` enum += `note`.
  - `queryId` leaves the schema's `required` list; the rule moves to the description + backend
    (same pattern as `measureCol`): required for every `chartType` except `note`, forbidden on
    `note`.
  - new `body: string, maxLength 8000` — required on `note`, forbidden elsewhere.
  - `agg` stays in `required` today → make it required-except-note the same way (no fake value).
- **Backend:** `routers/dashboards.py` validation: the per-chartType presence rules above → 422
  `widget_field_rule` with the field name. A shared `app/text_safety.py` with
  `check_markdown(text, max_bytes) -> list[Violation]` (rejects `<tag`, `![`, `javascript:` links,
  control chars). 2.6 reuses it.
- **Builder:** add a markdown renderer dependency (`react-markdown` with `skipHtml` and
  `disallowedElements={['img']}`; pin an exact version). `NoteView.tsx`; `WidgetBuilder` shows a
  textarea + preview instead of query pickers when `chartType === 'note'`.
- **Tests:** backend — note without body 422, note with queryId 422, body with `<script>` 422, body
  with `![x](y)` 422; builder — renderer drops HTML and images (snapshot), link has `rel`.
- **Walk:** add a note under a chart, include a link and a table; try pasting an `<img>` tag and see
  the 422 message.

## 2.3 Table total row (`sum` / `ratio` / `none`)

|          |                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                                         |
| Flow     | DCFBI                                                                                                                     |
| Evidence | a ratio column's total must be SUM(num) / SUM(den), never a sum of row ratios; a long-open request in a major OSS BI tool |

- **Design:** `dashboard-layout.md § Totals`. Only `table` widgets. Each column picks `sum`,
  `ratio` (pick numerator + denominator columns) or `none`. The total row is pinned under the page
  and covers **all rows matching the widget's filters**, not the visible page.
- **Contract:**
  - `Widget.totals` (optional, `table` only): object keyed by column name →
    `{kind: sum | ratio | none, num?: string, den?: string}`; `num`/`den` required iff `ratio`.
  - new endpoint `POST /queries/{id}/totals` (own `queries/totals.contract.yaml` + `.md`): body
    `{columns: {...same shape...}, filters?: <same filter shape the widget sends to /rows>}` →
    `200 {totals: {<col>: number | null}, rowCount: integer}`; `422` on unknown or non-numeric
    column; `404` on missing query.
- **Backend:** `routers/queries.py` + a helper in `query_engine.py` that wraps the query's
  resolved SQL as a subquery: `SELECT SUM(a) AS a, SUM(n)/NULLIF(SUM(d),0) AS r, COUNT(*) …`.
  Division by zero → `null`.
- **Builder:** footer row in the `table` branch of `WidgetView.tsx`; per-column total config in `WidgetBuilder` (only numeric
  columns offered).
- **Tests:** backend — ratio total equals SUM/SUM on a fixture where the mean of row ratios differs
  (assert both numbers so the test proves the difference); filters applied; zero denominator →
  null; non-numeric 422. Builder — footer renders formatted with the widget's `numberFormat`.
- **Walk:** a table with a conversion column; compare the footer to a hand computation.

## 2.4 Export widget rows (CSV / XLSX)

|          |                                                                                      |
| -------- | ------------------------------------------------------------------------------------ |
| Track    | 1                                                                                    |
| Flow     | DCFBI                                                                                |
| Evidence | design decision #3 "Excel output first"; users forward numbers to people without MDD |

- **Design:** `dashboard-layout.md § Export`. v1 scope: `table` widgets and the query detail page
  export the **query rows with the widget's filters**. Chart widgets: deferred (log it).
- **Contract:** `GET /queries/{id}/export?format=csv|xlsx` + the same filter parameters `/rows`
  accepts (own contract file). Response: file stream, `Content-Disposition` with
  `<query-slug>_<yyyymmdd-hhmm>.<ext>`. `413` when rows exceed 1,048,575.
- **Backend:** stream CSV (UTF-8 with BOM so Excel opens accented text correctly); XLSX via
  `openpyxl` write-only mode (already a dependency), typed cells (number stays number, dates as
  dates). Second sheet `About`: query id, query name, filters as text, exported_at, source dataset
  ids + row counts; leave `data_version` column present but empty until 3.2 fills it.
- **Builder:** "Export" menu on table `ChartCard` and on the query detail page.
- **Tests:** backend — XLSX numeric cell type is numeric; leading-zero text stays text (R175
  regression); filters reduce rows; About sheet present; 413 path with a monkeypatched cap.
- **Walk:** export a filtered table to XLSX, open in Excel, `SUM` a column.

## 2.5 Relationship self-check

|          |                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                          |
| Flow     | DCFBI                                                                                                      |
| Evidence | design decision #4 "relationships are central"; a declared 1-n that is really n-n silently multiplies rows |

- **Design:** extend `data-management/workspaces/relationships.md § Self-check`.
- **Contract:** `GET /relationships/{id}/check` → `{leftRows, rightRows, leftKeysMatched,
rightKeysMatched, coverageLeft, coverageRight, observed: one_to_one | one_to_many | many_to_one |
many_to_many, declared, maxRightPerLeftKey, maxLeftPerRightKey, nullKeysLeft, nullKeysRight,
warning: none | coverage_low | fan_out | declared_mismatch}`. Computed on demand, not stored.
- **Backend:** DuckDB over both datasets' parquet: key counts per side, join counts. One query per
  side; no row materialization.
- **Builder:** relationships list shows a badge from `warning`; join step in the query builder
  shows a warning when `observed` fans out more than `declared`.
- **Tests:** fixtures for each of the four observed cardinalities; coverage with nulls; declared
  1-1 over real 1-n → `declared_mismatch`.
- **Walk:** declare a 1-n you know has duplicate keys; see the warning; fix by dedup upstream.

## 2.6 Metadata — view-only, written by token

|          |                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Track    | 1                                                                                                                                 |
| Flow     | **DFCFBI** recommended (new surface + security weight) — run `flow-selector`                                                      |
| Evidence | a pipeline or agent that loads data must leave a statement of where it came from and how it was matched, visible next to the data |

- **Design:** new `.agents/design/data-management/_shared/metadata.md`. Targets: dataset, column
  (`<datasetId>:<columnName>`), relationship, query, workflow, dashboard, widget. Each target has
  0..n entries, one per namespace. UI: read-only "About" panel; `source=ai` entries show an AI badge;
  YAML frontmatter shown collapsed, never interpreted. No edit control anywhere in the UI.
- **Contract** (`_shared/metadata.yaml` + `metadata/*.contract.yaml`):
  - `MetadataEntry {targetKind, targetId, namespace (^[a-z][a-z0-9_-]{0,31}$), body (markdown),
source: ai | human | system, author, writtenAt, bytes}`.
  - `GET /metadata/{targetKind}/{targetId}` → list.
  - `PUT /metadata/{targetKind}/{targetId}/{namespace}` header `X-MDD-Metadata-Token` → 200;
    `DELETE` same auth. `author` and `writtenAt` are set by the server (from the token's label and
    the clock), never from the body.
  - Errors: `403` bad/missing token or namespace disabled; `404` unknown target; `413` body > 64 KB;
    `422` sanitizer violation (reuse `text_safety.check_markdown` from 2.2).
- **Config:** `app_config` gains `metadata.namespaces: {<ns>: {token_sha256, label}}`; empty by
  default = feature off. Token compared with `hmac.compare_digest`.
- **Migration** `0005_metadata_entries`: table with unique `(target_kind, target_id, namespace)`;
  downgrade drops it. Deleting a target deletes its entries (same transaction as the target delete).
- **Builder:** `AboutPanel.tsx` in the detail views of each target kind; no write path.
- **Tests:** token required; wrong namespace token 403; author/writtenAt ignore client values; 64 KB
  boundary; HTML and image rejected; target delete cascades; UI has no edit affordance (test the
  panel renders no input).
- **Walk:** write two entries with `curl` (one `ai`, one `human`), view them on a dataset and a
  widget, then delete the dataset and confirm entries are gone.

## 2.7 Design only — view-time date range and shared filters

|        |                                                                             |
| ------ | --------------------------------------------------------------------------- |
| Track  | 1                                                                           |
| Flow   | Design gate only (no C/F/B/I)                                               |
| Output | `.agents/design/dashboards/dashboard-filters.md`, consumed by 3.7, 4.2, 4.3 |

- **Decide in the design doc:**
  1. Parameter model (shared with 3.7): typed values `{"param": "<name>"}` placed where a constant
     goes; precedence **viewer (URL) → dashboard saved value → parameter default → value saved in
     the query**; `default: today` resolved in a configured time zone.
  2. Shared filter: dashboard-level, editor chooses which widgets it reaches, saved with the
     dashboard, viewer changes live in the URL only, each widget shows whether a filter reached it.
  3. What happens when a filtered column is missing from a widget's query (skip + badge, never error).
- **Done when:** design gate criteria met (journeys + testable acceptance criteria), `ux-design`
  design-spec mode run and logged.

---

## rc.2 exit gate

- [ ] 2.0–2.7 rounds `Complete` (human flipped)
- [ ] Acceptance walk logged for 2.1–2.6
- [ ] Ratio total = SUM/SUM proven by a test whose fixture makes the two differ
- [ ] Metadata with HTML or an image is rejected (test + walk)
- [ ] All gate commands green on the branch head
- [ ] `alembic downgrade -1 && alembic upgrade head` clean on a copy of a real database
- [ ] An rc.1 dashboard JSON loads unchanged (fixture)
- [ ] `CHANGELOG` / release note lists every contract addition
