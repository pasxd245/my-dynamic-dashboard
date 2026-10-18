# Round 197: metadata triple anchor and cascade (item 3.8)

**Status**: Review — built and reviewed (BA ×2, code review ×2, QA + visual gate ×2: no open P0/P1); awaiting the human acceptance walk (W1–W6) and sign-off
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — a note knows what it was written for.

- Every metadata entry is stamped by the server with the triple anchor: the definition (and the
  queries behind a widget or dashboard), the data (dataset versions, a workflow's run) and the
  parameter values; a value the writer did not give is named (`assumedParams`).
- A read under the page's values says per entry: the same, data refreshed since, another period,
  an earlier definition. The panel and the widget popover show the flag or collapse the entry to
  "Written for As of 2026-10-11 · viewing As of 2026-10-17", opened on click.
- Deleting a noun moves its notes to an archive table (`metadata_entries_swept`); migration
  `0010` archives today's orphans and its downgrade restores them.
- A widget's footer says "Data: refreshed <when> · run #N" for the data it read.

**Studied** — "which period" is easy to get wrong in three directions. The BA contract-exit review
caught three ways a note would read `current` next to different numbers before any code existed
(query edits behind a widget, a dashboard's period taken from the wrong widget, copies forced
`current`). After the build, QA's live run caught a fourth (a parameter without a default hid the
data) and both reviewers caught an entry that could get stuck closed.

## Goal

**Inherits from ← [Round_196](Round_196.md)** — every read names its data (`dataVersions`) and its
values (`resolvedParams`); a definition has a hash. A metadata entry still anchors to the
definition only, so a note written about last week's numbers sits unmarked next to this week's.

Anchor each entry to the three things that make a number: the definition, the data and the
parameter values. On read, say how the reader's view relates to the writer's — the same, refreshed
since, another period, another definition — and show it. An entry never outlives its noun.

_Track: 1 (product). Pulled by: release program item 3.8 ([rc3.md § 3.8](../programs/release-rc2-rc5/rc3.md))
and the rolling-log row "metadata entries survive the deletion of their noun" (R180) — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Decisions** (judgement on rc3.md § 3.8; the contract-exit BA checks them):

- **D1 — the anchor.** `anchor {definitionVersion, dataVersions?, queryVersions?, runId?, params?,
assumedParams?}`, stamped by the
  server at write time from the noun's state now. Stored as `anchor_json` (migration `0010`); the
  `definition_version` column stays (rc.2 rows, schema parity). An rc.2 entry has no `anchor_json`
  and reads as `{definitionVersion}` only.
- **D2 — what each kind stamps.**

  | Kind         | `dataVersions`                                        | `runId`         | `params`                                                                |
  | ------------ | ----------------------------------------------------- | --------------- | ----------------------------------------------------------------------- |
  | dataset      | itself                                                | —               | —                                                                       |
  | column       | its dataset                                           | —               | —                                                                       |
  | relationship | both ends                                             | —               | —                                                                       |
  | query        | every dataset its plan reads                          | —               | the resolved values of its USED parameters                              |
  | widget       | its query's (+ `queryVersions` of that query)         | —               | as the widget reads: viewer (if a control targets it) → saved → default |
  | dashboard    | union over its widgets (+ every widget's query hash)  | —               | its param controls as the bar shows them: viewer → saved → default      |
  | workflow     | — (the run stamp already holds its sources' versions) | the current run | —                                                                       |

  A relative default ("today − 1") is stamped as the absolute date it resolved to: a note written
  for yesterday is about that date, not about "yesterday".

- **D3 — writing under values.** `PUT` takes an optional `params: {name: value}` — the values the
  writer read under, the same as the `p.<name>` a reader sends. The server resolves them like a
  read (viewer → dashboard → default); a value of the wrong type → 422 `param_invalid`; a used
  parameter with no value at any level → 422 `param_unbound` (a note must say which period it is
  about). Versions and run ids are never accepted from the client (`extra=forbid`).
- **D4 — reading.** `GET` takes `p.<name>=<value>` like `/rows`. The server builds the reader's
  anchor the same way (D2), returns it as `current` (children: `childrenCurrent`), and gives each
  entry a `state`, first rule that applies:
  1. `definitionVersion` or a `queryVersions` hash differs → `other_definition`;
  2. a parameter both anchors carry differs → `other_period`;
  3. a dataset version both carry, or the run id, differs → `refreshed`;
  4. else `current`.

  A saved copy is not special-cased: its entries are copied with their anchors (data version keyed
  to the copy) and compare like any other.

  A parameter the reader has no value for (`param_unbound` on read) is not compared — the view
  itself is asking for a value. An rc.2 entry compares the definition only. `stale` stays, with
  its rc.2 meaning (definition differs), so older readers keep working.

- **D5 — cascade.** One `sweep(con)` moves every entry whose noun is gone to
  `metadata_entries_swept` (archived, not dropped): a deleted dataset (with its columns' entries),
  query, workflow, dashboard, relationship, workspace or saved copy; a widget removed from its
  dashboard. A column that leaves its dataset in a refresh is NOT swept (it may come back next
  week). Called in the same transaction by every delete and by a dashboard update. Migration
  `0010` sweeps today's orphans once; its downgrade restores every swept row.
- **D6 — builder.** In `MetadataPanel` and the widget info popover:
  - `refreshed` — a small flag "Data refreshed since this was written";
  - `other_period` — collapsed: "Written for as_of 2026-10-04 · viewing as_of 2026-10-17", open on
    click;
  - `other_definition` — collapsed: "Written for an earlier definition", a warning when opened;
  - the panel sends the page's parameter values (query page URL `p.*`; dashboard viewer values).
  - widget footer "Data: refreshed <date> · run #N" — from the widget read's `dataVersions`, the
    datasets' `refreshedAt` and, for a published dataset, its lineage run number.
- **D3a — what a writer did not say.** A write without a value for a parameter takes the saved or
  default value and names it in `anchor.assumedParams`; the builder says "written under the saved
  or default value of …". A dashboard note needs no value for a control nothing sets.
- **D7 — shared helper.** `app/data_versions.py`: the dataset ids of a plan and their versions,
  used by the reads (R196), the run stamp (R187) and the anchor.

**Out**:

- The version/rows race in the refresh window (R196 rolling log). Closing it needs version-tagged
  storage (a reader cannot tell which version a swapped file belongs to; an in-process lock fails
  with `workers > 1`). Label-only, a few milliseconds wide; logged with that trigger.
- Editing entries in the UI (out by design, R180).

**Acceptance** (rc3.md): one test per state; the anchor ignores client-sent versions; rc.2 entries
unchanged; deleting a noun removes its entries.

## Risks / unknowns

- **Anchor cost on a dashboard read** — one plan per widget; metadata reads are per page, not per
  widget. Measure on the dogfood dashboard.
- **Migration sweep deletes rows** — only rows nobody can read today; the dogfood dual-run counts
  them before and after.

## Do

- 2026-10-18 — D: the decisions above.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                |
| ------------------------------------ | ------ | ------------------------------------------------------------ |
| 1. >3 independent states/branches    | yes    | four states, each rendered differently                       |
| 2. New interaction pattern           | no     | the panel already uses AntD `Collapse` and tags              |
| 3. High user-error risk              | no     | read-only; the anchor only labels                            |
| 4. Contract depends on unresolved UI | no     | the states and the `current` anchor are fixed by D4          |
| 5. UX confidence below threshold     | no     | rc3.md and `dashboard-filters.md` § Metadata fix the wording |

Result: **Flow: DCFBI** — one condition fired (below the 2-of-5 threshold).

- **C — contract-exit BA: CHANGES**, all folded into the decisions above before code:
  - P0-1 — a widget or dashboard note ignored edits to its query → `queryVersions`;
  - P0-2 — "first widget wins" hid a dashboard period change → the controls as the bar shows them;
  - P0-3 — "saved workspace → current" overrode `other_definition` (contradicted R193 BA P1-2) →
    dropped; copies carry anchors keyed to the copy;
  - P1-1 — sweeping a column that left in a refresh lost notes for good → columns go only with
    their dataset; swept rows are archived and the migration's downgrade restores them;
  - P1-2 — a writer sending only `md` silently stamped the defaults → `assumedParams`;
  - P2s: dashboard writes skip a control nothing sets (folded); daily ageing of evergreen notes,
    a workflow's source params, footer cost (logged).
- B: `app/data_versions.py` (reads, run stamps and anchors share it); `app/metadata.py`
  (`anchor_for`, `state_of`, `sweep`); `params.resolve(strict=False)` for reads; router `p.*` /
  `params`; sweep in six deletes and the dashboard update; copies remap anchors; migration `0010`
  - `metadata_entries_swept`; `tests/test_metadata_anchor.py` (12).
- F: entry rendering by state (`MetadataEntryView`), panel and popover read under the page values,
  `WidgetDataFooter`, EN/VI; `tests/metadata-anchor-r197.test.tsx` (9).

### F, the reviews and the fixes

- Build `4de665f`.
- **Reviews after build:**
  - code review **CHANGES** — P1: an entry back to `current` stayed collapsed with no toggle; P1: a
    workflow note written before the first run never read `refreshed`; P2: a vanished query read
    `current`, uncapped param values, race lookups, footer from a newer version;
  - BA **CHANGES** — the same stuck-closed P1; contract-exit findings all resolved as built; P2:
    dashboard layout edits read "earlier definition", labels, footer, filters not anchored,
    wording; proposed the walk below.
- **Fix 1 (`d7e298f`)** — entries keyed by namespace + state; R197 entries compare the run (rc.2
  ones do not); a vanished query → `other_definition`; values ≤ 256; guards; the footer speaks only
  for datasets at the version read; labels; wording.
- QA **CHANGES** — P1: `query_versions` planned the query as a composed base, which fails on a
  parameter without a default, so such a note never read `refreshed`. P2: a reader's invalid
  value fell back to the default; VI wording.
- **Fix 2 (`5cac7fd`)** — plan from the query's own source, joins and relationships (as `/rows`;
  the run stamp shares it); a reader's bad value is left out. QA re-check **PASS**; code review
  re-check **PASS**.

## Check

- [x] backend 670 · builder 540 · contracts 49 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Visual gate: light (EN + VI) twice; dark N/A (no dark theme — owner)
- [x] BA (contract exit + after build) · code review · QA — no open P0/P1
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 6`. Setup (fake data):
      dataset `calls_demo` (id, team, day, amount); query **Calls by week** with a date parameter
      `as_of` (label "As of", default 2026-10-10) filtering `day ≤ as_of`; dashboard **Demo** with
      two table widgets on it and an As of control targeting the first only, saved 2026-10-04; a
      metadata token in the settings. Notes are written with `PUT /metadata/...` and the token.
  - ⬜ W1 — current: write a note on the query with `params {as_of: 2026-10-11}`. Open the query
    page with `?p.as_of=2026-10-11`: the note is open, no flag. Switch to VI and back.
  - ⬜ W2 — another period: change the URL to 2026-10-17. The note collapses: "Written for As of
    2026-10-11 · viewing As of 2026-10-17". Show, then Hide.
  - ⬜ W3 — on **Demo**, write a note on the first widget under 2026-10-11. Switch the control to
    10-04 and back to 10-11 within 30 s: the note (widget info popover) is open again.
  - ⬜ W4 — refreshed: re-upload `calls_demo` with one row changed. The query note at 10-11 shows
    the blue flag and stays open; the widget footer reads "Data: refreshed <now>".
  - ⬜ W5 — earlier definition: add a filter to the query. The query, widget and dashboard notes
    collapse; opening one warns. Write a dashboard note with `md` only: it reads "Written under
    the saved or default value of: As of".
  - ⬜ W6 — delete **Demo**, then the query: their notes are gone from the app. On a copy of the
    database, `metadata_entries_swept` holds them with `swept_at`.

## Act

- **Rolling log:** closed — metadata entries surviving their noun (R180). New P2 rows: dashboard
  layout or saved-value edits read "earlier definition"; dashboard filters not anchored; evergreen
  notes ageing with a relative default; a workflow note not carrying its sources' params; widget
  footer cost (one dataset read per dataset, cached).
- **Promotion:** none. Candidate lesson (memory, if it recurs): a label that compares two states
  needs a test for every way one side can be missing — rc.2 rows, no run yet, no default, a
  deleted query; each one surfaced here as "current" by default.
- **Prune check:** the contract-exit BA review earned its place — three P0s fixed before code.

## Feeds into → rc.3 exit gate

Release note, gate checklist, walk pack R191–R197.
