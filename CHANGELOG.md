# Changelog

Release candidates of `v0.0.1`. Each entry lists every contract addition (OpenAPI files under
`workspace/packages/contracts/`), the database migrations, and what an upgrade has to know. Round
docs (`.agents/plan/cycles/Round_NNN.md`) hold the detail.

## v0.0.1-rc.2 — display gaps

Compared with `v0.0.1-rc.1` (`5334c81`). Rounds R177–R183, plus one fix.

### Added

- **Widget height** (R177) — `Widget.rows` (1–3, optional; absent = 1). The dashboard grid places a
  short widget beside a tall one.
- **Date coverage per column** (R178) — `Column.coverage {min, max, blankShare}` on committed
  `date` / `datetime` columns of a dataset (`GET /datasets/{id}`). Profiled by the server at commit
  and at every refresh; read-only. Absent on datasets committed earlier until their next refresh.
- **Note widget** (R179) — `chartType: note` with `md` (1–4000 characters of a safe markdown
  subset: headings, emphasis, code, lists, quotes, rules, http(s) links). Raw HTML, images and
  non-http(s) links are rejected with 422, never stripped. A note has no `queryId` and no `agg`.
- **Metadata, view-only in the app** (R180) — notes attached to a noun (`dataset`, `column`,
  `relationship`, `query`, `workflow`, `dashboard`, `widget`), one entry per namespace:
  - `GET /metadata/{kind}/{noun_id}`
  - `PUT /metadata/{kind}/{noun_id}/{namespace}` and `DELETE …` — bearer token required.
  - The server records author, source, time written and the definition version of the noun, and
    flags an entry as "may be out of date" when the definition changed since.
  - New errors: `unauthorized` (401), `forbidden` (403, including the reserved `system` namespace),
    `metadata_invalid` (422, `reason` one of `namespace`, `empty`, `too_large`,
    `markdown_unsafe`, `namespace_cap`).
- **Table total row** (R181) — `Widget.totals {agg: sum | ratio, num?, den?}` and
  `POST /queries/{id}/totals`, computed on the query result after its steps and under the active
  filters. A ratio total is SUM(num) / SUM(den), not an average of row ratios.
- **Export a table** (R182) — `POST /queries/{id}/export` to CSV or XLSX: typed cells, the total
  row, a Filters sheet (XLSX). Capped at 100,000 rows; over it → 422 `export_too_large {rows, max}`
  and nothing is written.
- **Relationship self-check** (R183) — `GET /relationships/{id}/check`: coverage both ways,
  observed vs declared cardinality, and a join-multiplication flag; shown in a drawer and as a
  warning in the join dialog.

### Changed

- `Widget` no longer requires `queryId` and `agg` (`required: [id, title, chartType, span]`): both
  stay required for every chart type except `note`, where they must be absent. A client that reads
  widgets must handle `chartType: note`.
- The API error `code` enum gains `unauthorized`, `forbidden`, `metadata_invalid`,
  `export_too_large`.

### Fixed

- A table widget created in the dashboard builder was rejected on save (422: `agg: sum` without a
  measure column) and lost when the dialog closed — present since R117. A table now saves as
  `count` (`ff9647a`).
- Editing a table or stat widget no longer resets it to a bar chart (found in R181).

### Database

- Migration `0005_metadata_entries` — new table `metadata_entries`. No change to existing tables.

### Upgrade notes

- **Metadata writes are off by default.** Until `backend.metadata_tokens` is configured (values
  file, `MDD_CONFIG_FILE`, or `MDD_BACKEND__METADATA_TOKENS` as JSON), every write answers 401.
  Each token is at least 16 characters and carries the closed list of namespaces it may write;
  `system` can never be granted.
- Datasets committed before this release show date coverage only after their next refresh.
