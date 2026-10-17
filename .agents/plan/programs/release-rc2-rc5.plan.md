# Program plan: Release v0.0.1-rc.2 → rc.5

**Status**: Draft — awaiting the human's review (opening round — close `cycles/Round_176.md`, then `Round_177`)
**Opened**: 2026-10-17

Take the product from `release/v0.0.1-rc.1` (`5334c81`) to rc.5 as four gated release candidates.
Each rc is defined by **order + exit gate, never by a date**: rounds run in bursts, a forecast is
given in rounds, and a date is written only when a tag lands. Cadence: one DCFBI slice per round,
pause at review; an rc is tagged only when its gate in § Exit gates is met. The goal is that a
manager who knows Excel can open a dashboard, read numbers that carry their own definition, period
and data version, and take the result back to Excel — without the numbers lying when the source
data or the definition moves.

_Track: 1 (product). Pulled by: the external weekly-report dogfood (R175, kept outside this repo),
R174's Workflow findings, R175's ordered program (R176 → R180), and the human's 2026-10-13 release
split. The dogfood is **one user's evidence**: every item below must also pass the second-user
test — "would a second user, with a different CRM export, want exactly this with no change?"_

## Settled decisions (human, 2026-10-13 and 2026-10-17)

1. **Order + gates, not dates.** rc.N is tagged when its gate is met; no item is scheduled to a day.
2. **Workflow survives** — R175 ruled item 1 of [`workflow-earns-its-place`](workflow-earns-its-place.plan.md)
   as **(a′) publish the output as a derived dataset** (R180). Workflow repairs W-2/3/4/5/7 and a
   server-stamped `data_version` / `run_id` land **before** R180.
3. **Release split:** rc.2 = display gaps (low risk); rc.3 = definitions over numbers (R177,
   R178–R179, workflow repairs + stamping, R180 + saved copies, typed parameters, the metadata
   triple anchor); rc.4 = viewing by period (scheduled refresh, view-time date range, shared filters,
   definition history; conditional items); rc.5 = tags, conditional.
4. **R178–R179 sit in rc.3, before R180** (2026-10-17), keeping R175's order.
5. **Branch:** `release/v0.0.1-rc.2` is cut from `release/v0.0.1-rc.1` (`5334c81`).
6. **Export before relationship self-check** inside rc.2.
7. **Parameters are typed values** — `{"param": "as_of"}` placed exactly where a constant would be.
8. **Saved copy** = R180 publish into a dedicated read-only workspace named `<workspace>-saved`, one
   per main workspace; deleting a workspace that still holds data stays blocked (`409 non_empty`).
9. **Metadata is view-only in the UI.** Free-string namespaces; written only via API with a
   per-namespace token (off by default); `author` / `written_at` stamped by the server; ≤ 64 KB;
   sanitized markdown (no HTML, no external images); `source=ai` entries carry an AI label. MDD
   never interprets a namespace's content. Treat metadata as an output channel that can carry
   injected instructions — "it runs on localhost" is not an assumption.
10. **No fuzzy matching in MDD.** Weak keys (phone, plate, time windows, priority order) are resolved
    upstream; MDD accepts strong-key relationships only and checks its own (coverage, cardinality).
11. **No dataset classification.** Derived one-off datasets live in `adhoc-YYYY-MM-DD-<topic>`
    workspaces with a "not an official number" band.

## The repeatable unit (what each round does)

Each round is a **DCFBI slice** over one item:

1. **D** — update the design corpus in-round (`.agents/design/…`); run `ux-design` in design-spec
   mode for UI-bearing items.
2. **C** — contract first (`_shared/*.yaml`); additive only inside an rc unless the item says
   otherwise. Every new persisted field gets a migration that runs both ways.
3. **F / B / I** — build and conformance tests.
4. **Check** — gates green **and** the acceptance walk for any user-exercisable surface (PDCA §
   Round Template). Re-run the dogfood numbers for any item that touches query results: rows must
   match the previous rc **cell for cell** unless the round declares the change.
5. **Act** — `Feeds into →` the next item; prune check.

## Scope + firewall

- **In:** the items in § Work items, in that order.
- **Deferred (unchanged):** Streamlit; docs-graph; BIZ exports of `@mdd/ui`; `tags` in
  `datasets.md` until rc.5's evidence condition; W-6 naming (parked theme).
- **Out:** fuzzy/record-linkage joins (ruled out at R175); multi-user scoping and row-level
  permissions; pulling from CRM APIs; any user's column names, rules, thresholds or numbers in this
  repo.
- **Firewall (anti-creep):**
  - A round may not open the next rc's items. Gaps found go to § Rolling log.
  - A conditional item (rc.4, rc.5) opens only when its stated evidence exists in the log.
  - Track 2/3 mechanism added during this program must name the LLM failure mode it counters.

## Work items + order (suggestive, not binding)

### rc.2 — display gaps

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 2.0 | Close R176: walk W1–W3, sign-off | **review — walk pending** | `Round_176` |
| 2.1 | Widget height 1–3 rows (mirrors horizontal `span`) | queued | — |
| 2.2 | Annotation widget: sanitized markdown, no query | queued | — |
| 2.3 | Table total row computed in the backend; each column declares `sum` / `ratio` / `none` (a ratio total is SUM(num)/SUM(den), never a sum of row ratios) | queued | — |
| 2.4 | Export a widget's rows to CSV/XLSX: numeric types kept; a side sheet records filters, parameters, query id and data version | queued | — |
| 2.5 | Relationship self-check: observed coverage and cardinality, a warning when a join multiplies rows | queued | — |
| 2.6 | Metadata, view-only, written by token (decision 9) | queued | — |
| 2.7 | Design only: view-time date range + shared filters (built in rc.4) | queued | — |

### rc.3 — definitions over numbers

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 3.1 | R177 — fork (B) `compute` step + first string catalog (`trim` first) | queued | `Round_177` |
| 3.2 | Workflow repairs W-2 (same shape), W-3 (provenance), W-4 (staleness), W-5 (validation), W-7 (outlives sources) | queued | — |
| 3.3 | Server stamps `data_version` and `run_id` (shape aligned with OpenLineage: run / job version / dataset version) | queued | — |
| 3.4 | R178–R179 — refresh: multi-file merge, `replace_period` | queued | `Round_178`–`179` |
| 3.5 | R180 — publish a workflow output as a derived dataset with lineage; saved read-only copies (decision 8) | queued | `Round_180` |
| 3.6 | Typed parameters, starting with `as_of` (decision 7); precedence dashboard → default → saved | queued | — |
| 3.7 | Metadata triple anchor {definition_version, data_version/run_id, params}, server-written; collapse an entry when period or definition differs from what is viewed ("written for …, viewing …"), flag when only refreshed | queued | — |

### rc.4 — viewing by period

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 4.1 | Scheduled refresh | queued | — |
| 4.2 | View-time date range, passed to queries as a parameter | queued | — |
| 4.3 | Shared filters for a group of widgets: editor picks scope, saved, kept in the URL, each widget shows whether it is filtered | queued | — |
| 4.4 | Definition history for queries and dashboards (who changed what, when) | queued | — |
| 4.5 | _Conditional:_ cohort ratios flag cohorts not yet observable for the full window | conditional | — |
| 4.6 | _Conditional:_ previous/next row per entity step — opens only if a measured rebuild with existing steps succeeds on < 70% of cases | conditional | — |
| 4.7 | _Conditional:_ default filters inherited from an official measure's definition | conditional | — |

### rc.5 — tags (conditional)

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 5.1 | Tags on data representations, filterable across workspaces — opens only with logged evidence that naming conventions + search fail | conditional | — |

Forecast: rc.2 ≈ 7–9 rounds, rc.3 ≈ 10–12 rounds, one burst each.

## Exit gates

An rc is tagged only when every line of its gate is recorded as met (candidate for `gate-walker`'s
rc mode).

| rc | Gate |
| -- | ---- |
| rc.2 | All its rounds `Complete` (R176 included) · acceptance walk logged for every UI round · a ratio total equals SUM/SUM on the dogfood · metadata with HTML or external images is rejected · tests green · every migration downgrades cleanly |
| rc.3 | Dogfood dual-run against rc.2: 0 differing cells except declared changes · deleting a workflow source marks its output stale (W-7) · saved copy is read-only and its workspace delete returns `409` · an annotation written for another period renders collapsed |
| rc.4 | Shared filters survive a URL round trip · every conditional item that opened has its measurement in the rolling log |
| rc.5 | Evidence row for tags present in the rolling log; otherwise rc.5 is skipped and rc.4 becomes v0.0.1 |

## Rolling log

| Entry | Axis/Kind | Seen in | Disposition |
| ----- | --------- | ------- | ----------- |
| `workflow-earns-its-place` still shows item 1 "open" after R175's ruling | doc drift | R175 | open — update that program to (a′) in the first rc.2 round |
| `updated_at` absent product-wide | correctness | R168 · R174 | pulled → 3.3 |
| Market check (2026-10): table totals beyond pivot are a long-open request in a major OSS BI tool; parameter precedence and URL-held viewer values are an established pattern; OpenLineage separates run / job version / dataset version | research | — | informs 2.3, 3.3, 3.6, 4.3 |

## Lifecycle

Active until rc.4 (or rc.5) is tagged as v0.0.1. At close, recurring rolling-log entries promote to
their own rounds or a decision artifact; this file folds into a closing note.
