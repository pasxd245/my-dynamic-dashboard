# Program plan: Release v0.0.1-rc.2 → rc.5

**Status**: Active — rc.2 built (R177–R183, all in Review, awaiting walk session A + tag); rc.3 batch 1 built
(R184–R187, in Review, walks pending; G-wf accepted 2026-10-17, walk B to confirm); 3.4 built (R188,
in Review); **next: 3.5** (`replace_period`)
**Opened**: 2026-10-17 (re-baselined the same day against what had already shipped)

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

## Re-baseline (2026-10-17)

This program was written after most of rc.2 and the first rc.3 batch had already been built from
the 2026-10-13 release plan. The detail files were therefore re-based on the code:

- **Shipped shape wins.** Where an item spec and the shipped contract differ, the spec now
  describes what shipped (§ "As built" in each item) and lists anything still owed as **Remaining**.
  Nothing shipped is re-opened by this re-baseline; changing a shipped shape is a new item.
- **Round numbers are real** where a round exists. The `Round_175` labels (R177 = compute,
  R178–R179 = refresh, R180 = publish) are names only — the real `Round_177`–`Round_183` are the
  rc.2 items, and `Round_184`–`Round_187` the first rc.3 batch.
- **One item was missing** from the first draft: **2.8 date coverage** (R-b of the 2026-10-13 plan),
  shipped as `Round_178`.
- **2.7 (design of the date range + shared filters) moves to rc.3**, before 3.7, as decided on
  2026-10-13 ("R-g moves to rc.3, where parameters are built"). rc.2 is the seven code items.

## Detail files

This program has graduated to a folder (PDCA § Program plans). Per-item specs — design doc to touch,
contract delta, backend/builder files, migration, tests, acceptance walk — live beside this file:

| File                                   | Holds                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| [`rc2.md`](rc2.md)                     | items 2.0–2.6, 2.8 (as built) + rc.2 exit gate                |
| [`rc3.md`](rc3.md)                     | items 3.1–3.8 + 2.7 (moved) + dependency order + rc.3 gates   |
| [`rc4.md`](rc4.md)                     | items 4.1–4.4, conditional 4.5–4.7 + rc.4 exit gate           |
| [`rc5.md`](rc5.md)                     | conditional tags                                              |
| [`claude-code.md`](claude-code.md)     | who does what, kickoff / per-gate / close prompts             |
| [`walk-rc2-rc3a.md`](walk-rc2-rc3a.md) | one-sitting walk pack for R177–R187 (fake data, own worktree) |

## Settled decisions (human, 2026-10-13, 2026-10-15 and 2026-10-17)

1. **Order + gates, not dates.** rc.N is tagged when its gate is met; no item is scheduled to a day.
2. **Workflow survives** — R175 ruled item 1 of [`workflow-earns-its-place`](../workflow-earns-its-place.plan.md)
   as **(a′) publish the output as a derived dataset** (R180 label = item 3.6). Workflow repairs
   W-2/3/4/5/7 and server-stamped data / run versions land **before** publish (gate G-wf).
3. **Release split:** rc.2 = display gaps (low risk); rc.3 = definitions over numbers (compute,
   refresh, workflow repairs + stamping, publish + saved copies, typed parameters, the metadata
   triple anchor, the date-range / shared-filter design); rc.4 = viewing by period (scheduled
   refresh, view-time date range, shared filters, definition history; conditional items); rc.5 =
   tags, conditional.
4. **Refresh (multi-file, `replace_period`) sits in rc.3, before publish** (2026-10-17), keeping
   R175's order. Scheduled refresh is a different item (4.1, rc.4).
5. **Branches:** `release/v0.0.1-rc.2` is cut from `release/v0.0.1-rc.1` (`5334c81`);
   `release/v0.0.1-rc.3` is cut from the rc.2 head (`6c679c5`). Fixes found while walking rc.2 are
   merged forward into rc.3.
6. **Export before relationship self-check** inside rc.2.
7. **Parameters are typed values** — `{"param": "as_of"}` placed exactly where a constant would be;
   no new step kind; type-checked on save.
8. **Saved copy** = publish into a dedicated read-only workspace named `<workspace>-saved`, one per
   main workspace (name confirmed 2026-10-17); deleting a workspace that still holds data stays
   blocked (`409 non_empty`).
9. **Metadata is view-only in the UI.** Free-string namespaces; written only via API with a
   per-namespace token (off by default); `author` / `writtenAt` / `definitionVersion` stamped by the
   server; ≤ 64 KB; sanitized markdown (no HTML, no external images); `source=ai` entries carry an AI
   label. MDD never interprets a namespace's content. Treat metadata as an output channel that can
   carry injected instructions — "it runs on localhost" is not an assumption.
10. **No fuzzy matching in MDD.** Weak keys (phone, plate, time windows, priority order) are resolved
    upstream; MDD accepts strong-key relationships only and checks its own (coverage, cardinality).
11. **No dataset classification.** Derived one-off datasets live in `adhoc-YYYY-MM-DD-<topic>`
    workspaces with a "not an official number" band.
12. **rc.3 opened before the rc.2 tag** (2026-10-15, the owner's call): code on
    `release/v0.0.1-rc.3`; G-start3 is satisfied retroactively when rc.2 is tagged.
13. **Compute catalog v1 = `trim` only; compute appends a new column**, never changes the source
    column (2026-10-15).
14. **Versions:** a definition's version is the 12-hex hash of its definition with `null` members
    dropped (shipped in rc.2 metadata, R180/R182) — not an integer counter. A dataset's data version
    is an integer counter (R185). A workflow run is `run_<8 hex>` + a per-workflow run number (R187).

## The repeatable unit (what each round does)

Each round is a **DCFBI slice** over one item:

1. **D** — update the design corpus in-round (`.agents/design/…`); run `ux-design` in design-spec
   mode for UI-bearing items. _(R177–R187 skipped it; paid by one `design-sync` pass on 2026-10-17 — see § Rolling log.)_
2. **C** — contract first (`_shared/*.yaml`); additive only inside an rc unless the item says
   otherwise. Every new persisted field gets a migration that runs both ways.
3. **F / B / I** — build and conformance tests; visual gate in a real browser for UI items.
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

## Work items + order

Status words: **review** = built, round in `Review`, walk pending; **partial** = part shipped, the
rest listed as Remaining in the detail file; **queued**; **conditional**.

### rc.2 — display gaps (built; order as executed)

| #   | Item                                                                                 | Status                                    | Round       | Commit    |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------- | ----------- | --------- |
| 2.0 | Close R176; fix the Workflow program drift                                           | R176 **Complete**; drift fixed 2026-10-17 | `Round_176` | `cc0f4fe` |
| 2.1 | Widget height 1–3 rows (`Widget.rows`)                                               | review                                    | `Round_177` | `935f748` |
| 2.8 | Date coverage per dataset (`Column.coverage`: min, max, blank share)                 | review                                    | `Round_178` | `1637fa7` |
| 2.2 | Annotation widget `note`: sanitized markdown, no query                               | review                                    | `Round_179` | `24b9939` |
| 2.6 | Metadata, view-only, written by token (decision 9)                                   | review                                    | `Round_180` | `67adfbc` |
| 2.3 | Table total row computed by the backend (`sum` / `ratio`)                            | review                                    | `Round_181` | `11f425a` |
| 2.4 | Export a table widget to CSV/XLSX (typed cells, totals row, Filters sheet)           | review                                    | `Round_182` | `d8061f0` |
| 2.5 | Relationship self-check: coverage, observed cardinality, join-multiplication warning | review                                    | `Round_183` | `cdc46da` |

2.6 ran before 2.3 (as the 2026-10-13 plan ordered) because it reuses 2.2's markdown sanitizer.
Dogfood parity rc.1 → rc.2: 119 / 119 items identical (logged in `Round_183`).

### rc.3 — definitions over numbers

| #   | Item                                                                                                                                | Status   | Round                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| 3.1 | `compute` step + closed function catalog (`trim` only)                                                                              | review   | `Round_184`              |
| 3.2 | Version stamps — dataset `dataVersion` + `refreshedAt` (R185), workflow `run` (R187); rest Remaining                                | partial  | `Round_185`, `Round_187` |
| 3.3 | Workflow repairs W-2, W-3, W-5 (R186); W-4, W-7 (R185 + R187) → gate **G-wf**                                                       | review   | `Round_186`, `Round_187` |
| 3.4 | Refresh with several files at once (label R178)                                                                                     | review   | `Round_188`              |
| 3.5 | `replace_period` refresh mode (label R179)                                                                                          | **next** | —                        |
| 3.6 | Publish a workflow output as a derived dataset with lineage; saved copies in `<workspace>-saved` (label R180) — **only after G-wf** | queued   | —                        |
| 2.7 | _Moved from rc.2:_ design only — parameter model, view-time date range, shared filters                                              | queued   | —                        |
| 3.7 | Typed parameters, starting with `as_of`                                                                                             | queued   | —                        |
| 3.8 | Metadata triple anchor {definitionVersion, dataVersions / runId, params}                                                            | queued   | —                        |

Dogfood parity rc.2 → rc.3 batch 1: 119 / 119 items identical; migrations 0004 → 0007 clean on a
copy of the real database (logged in `Round_187`).

### rc.4 — viewing by period

| #   | Item                                                                                                                               | Status      | Round |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| 4.1 | Scheduled refresh                                                                                                                  | queued      | —     |
| 4.2 | View-time date range, passed to queries as a parameter                                                                             | queued      | —     |
| 4.3 | Shared filters for a group of widgets: editor picks scope, saved, kept in the URL, each widget shows whether it is filtered        | queued      | —     |
| 4.4 | Definition history for queries and dashboards (who changed what, when)                                                             | queued      | —     |
| 4.5 | _Conditional:_ cohort ratios flag cohorts not yet observable for the full window                                                   | conditional | —     |
| 4.6 | _Conditional:_ previous/next row per entity step — opens only if a measured rebuild with existing steps succeeds on < 70% of cases | conditional | —     |
| 4.7 | _Conditional:_ default filters inherited from an official measure's definition                                                     | conditional | —     |

### rc.5 — tags (conditional)

| #   | Item                                                                                                                               | Status      | Round |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| 5.1 | Tags on data representations, filterable across workspaces — opens only with logged evidence that naming conventions + search fail | conditional | —     |

Forecast (in rounds, from here): rc.2 — 0 code rounds, plus the design-corpus pass and the tag
checklist; rc.3 — 6–8 rounds (3.4, 3.5, 3.6, 2.7, 3.7 likely ×2, 3.8, plus the 3.2 remainder);
rc.4 — 4–7 rounds.

## Exit gates

An rc is tagged only when every line of its gate is recorded as met (candidate for `gate-walker`'s
rc mode). The checklists live in the detail files; summary:

| Gate | Condition                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rc.2 | R176–R183 `Complete` · walks logged for every UI round · ratio total = SUM/SUM proven · metadata with HTML or external images rejected · tests green · migration 0005 downgrades cleanly on a real-database copy · design-corpus debt paid (done, on rc.3) · release note                                                                                                             |
| G-wf | (inside rc.3, before 3.6) double-count, shape divergence and source change are all caught; `dataVersion` / `run` written by the server only — evidence table in `Round_187`; **accepted by the owner 2026-10-17**, walk session B to confirm before 3.6                                                                                                                               |
| rc.3 | Dogfood dual-run against rc.2: 0 differing cells except declared changes · deleting a workflow source marks its output stale (W-7) · saved copy is read-only and its workspace delete returns `409` · an annotation written for another period renders collapsed · visual gate for a parameterised dashboard in light and dark · migrations 0006+ downgrade cleanly · repo scan clean |
| rc.4 | Shared filters survive a URL round trip · every conditional item that opened has its measurement in the rolling log                                                                                                                                                                                                                                                                   |
| rc.5 | Evidence row for tags present in the rolling log; otherwise rc.5 is skipped and rc.4 becomes v0.0.1                                                                                                                                                                                                                                                                                   |

## Rolling log

| Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Axis/Kind          | Seen in                | Disposition                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow-earns-its-place` still showed item 1 "open" after R175's ruling, and items 2–4 "conditional" after R186/R187 built them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | doc drift          | R175 · R187            | **fixed** 2026-10-17 (item 1 ruled; items 2–4 done)                                                                                                                                                                                                                                                                                                              |
| `updated_at` absent product-wide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | correctness        | R168 · R174            | **partly fixed** — dataset `refreshedAt` (R185); other nouns → 3.2 Remaining                                                                                                                                                                                                                                                                                     |
| **Design-corpus debt:** R177–R187 shipped without updating `.agents/design/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | doc gap            | R177–R187              | **fixed** 2026-10-17 (on `release/v0.0.1-rc.3`) — `design-sync` on datasets, queries, workflows, relationships, `_noun-model` (Versions); new `dashboards/` (`dashboard-layout.md`, `widgets.md`) and `_shared/metadata.md`; drift reports in `.agents/tmp/design-sync/`. Residual: `datasets/upload.md` slice wording (its surface table was completed in R188) |
| Item specs in this program were written after the code (2.x, 3.1–3.3) and disagreed with it in places                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | process            | 2026-10-17             | fixed — re-baselined; "As built" + "Remaining" per item                                                                                                                                                                                                                                                                                                          |
| Metadata entries survive the deletion of their noun (no cascade, no sweep)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | correctness        | R180                   | open → 3.8 (the anchor round touches the same rows)                                                                                                                                                                                                                                                                                                              |
| Export's Filters sheet has no data version (R182 predates R185)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | gap                | R182 · R185            | open → 3.2 Remaining                                                                                                                                                                                                                                                                                                                                             |
| Relationship check reads both parquets whole; not measured on a large pair                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | performance        | R183                   | open — measure before showing it on a list page                                                                                                                                                                                                                                                                                                                  |
| Workflow output integer sums read `15.0` through the API (pre-existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | presentation       | R186 gate              | open — log demand                                                                                                                                                                                                                                                                                                                                                |
| Overlap warning when two workflow sources read the same dataset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | scope              | R186                   | **declined** — flags correct comparisons more often than mistakes; provenance column instead                                                                                                                                                                                                                                                                     |
| Chart-widget export (aggregated series)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | scope              | 2.4 design             | deferred — log demand                                                                                                                                                                                                                                                                                                                                            |
| No release note / CHANGELOG for rc.2 yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | release            | rc.2 gate              | open — drafted at the tag checklist                                                                                                                                                                                                                                                                                                                              |
| **Table widget lost on save** — the builder sent `agg: 'sum'` without `measureCol` for a table → 422 after the modal closed (since R117; API-written tables never hit it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | correctness        | design sync 2026-10-17 | **fixed** `ff9647a` on rc.2 (a table saves as a `count`), merged forward; real-browser check: PUT 200                                                                                                                                                                                                                                                            |
| Small code findings from the design sync (no data impact): `ChartCard` "query unavailable" state never reached (`WidgetView` passes `false`); single-series charts show "empty" when the server aggregate is skipped; export's "Total" label cell can differ from the page's; `run-post.contract.yaml` omits the emitted 409 `step_invalid`; two builder strings still offer "saved query" as a base; the workflow steps editor cannot offer `Source.Query` (exists only at run); the join-warning direction assumes the modal's dataset is the query base; relationship declare 422 shows a generic message; dataset page with only an advanced query and no match shows the "empty dataset" state; `MetadataEntry` docstring claims cleanup on delete; stale comments (`wire.ts` slug uniqueness, `TableView` footer, filter drawer, `relationships.py`) | correctness · copy | design sync 2026-10-17 | open — one fix round after the walks (batch them; none blocks a walk item)                                                                                                                                                                                                                                                                                       |
| A `count` draft switched to scatter / combo keeps a measure the backend forbids with `count`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | correctness        | design sync 2026-10-17 | open — same fix round                                                                                                                                                                                                                                                                                                                                            |
| Market check (2026-10): table totals beyond pivot are a long-open request in a major OSS BI tool; parameter precedence and URL-held viewer values are an established pattern; OpenLineage separates run / job version / dataset version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | research           | —                      | informs 2.3, 3.2, 3.6, 3.7, 4.3                                                                                                                                                                                                                                                                                                                                  |

## Lifecycle

Active until rc.4 (or rc.5) is tagged as v0.0.1. At close, recurring rolling-log entries promote to
their own rounds or a decision artifact; this file folds into a closing note.
