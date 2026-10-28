# rc.5 — tags (conditional) and metadata read by layer

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md).

**Default: skip.** `tags` is a recorded deferral in `datasets.md`. rc.5 opens only if the rolling log
shows naming conventions + search failing to find things — e.g. saved copies (3.6) and
`adhoc-YYYY-MM-DD-<topic>` workspaces piling up so that a person cannot find "everything about
topic X" across workspaces.

If it opens:

- **Contract:** `tags: [string]` (lowercase, `^[a-z0-9][a-z0-9-]{0,31}$`, ≤ 10 per item) on dataset,
  query, dashboard, workflow; `GET /search?tag=…` across workspaces.
- **Migration:** a `tags` table `(kind, id, tag)`; downgrade drops it.
- **Builder:** tag chips on detail views; a tag filter on list pages.
- **Gate:** the logged finding that opened rc.5 is re-run and now succeeds.

If it does not open: rc.4's tag becomes **v0.0.1**, and this file folds into the program's closing
note.

_2026-10-28 (owner): rc.5 opens with item **5.2** below, independent of the tags condition; 5.1
stays conditional._

## 5.2 Metadata read by layer

|       |                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| Track | 1                                                                                                          |
| Flow  | **DCFBI** — UI-bearing; no API shape change                                                                |
| Added | by the owner, 2026-10-28 (design review 2026-10-23); opens rc.5 on `release/v0.0.1-rc.5`, cut at `7764148` |
| Round | `Round_202`                                                                                                |

Metadata written in volume reads as a wall of text: the dashboard panel lists every widget's
entries above the grid, tables do not render, and nothing says which note matters. Read **by
layer**, **beside the data**:

- **Viewer:** `SafeMarkdown` through `react-markdown` + `remark-gfm`; raw HTML, images and
  non-http(s) links still shown as their source text (R179 invariant); one renderer for `note`
  widgets and metadata.
- **Reserved frontmatter keys** read by the builder: `title`, `summary`, `severity`
  (`info | warn | error | decide`); invalid → shown as an ordinary pair; other keys uninterpreted.
- **Badges** on widgets (≤ 2 severity chips + `+N`) and dots on dataset column headers.
- **Dock** beside the page: Notes (cards) → Read (full note); `Esc` closes; `?note=` deep link;
  drawer on narrow screens.
- **At a glance** strip on dashboards: ≤ 3 summaries with severity ≥ `warn`, current or refreshed.
- The inline `MetadataPanel` is replaced on dashboard, dataset, query and workflow pages by a
  one-line Metadata bar + the dock (All notes on dashboards); the relationship drawer keeps it.
- **Gate:** builder tests green; hostile-markdown tests; visual gate at 1366 × 768 (EN + VI) on an
  install loaded with real-volume metadata; no route or query result changes.

**Step 2 (not in rc.5 unless pulled):** a typed `{props, md, data}` entry; structured `data` drawn
as a table with a raw-JSON toggle — opens when a writer has a real machine-read case.
