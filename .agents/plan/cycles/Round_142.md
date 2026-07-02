# Round 142: Dogfood probe — one real CRM export through the whole loop, twice

**Status**: Planning
**Date started**: 2026-07-02
**Date completed**:
**Flow**: probe round — NOT a feature round, so the R47 flow-selector is skipped by its own
trigger rule (no new surface, no contract; the deliverable is evidence). Precedent: the R109
charts probe / R119 probe-the-producer pattern.

## Goal

Answer, with evidence instead of argument: **what keeps the loop from "working brightly"** —
before spending rounds on refresh (⑥), date_trunc (②), or export (④). Walk a REAL CRM export
through the full product loop (upload → join/clean → shape with steps → dashboard), then
**simulate month 2** (a new export for the same report), logging every friction, breakage, and
manual step. The deliverable is an **evidenced, ranked friction backlog** + the named R143 pull.

Known dim spots this probe must confirm/deny and rank (2026-07-02 assessment):

1. **No refresh path** — datasets are create/rename/delete only; a new month's export = a new
   `ds_` id = every downstream query/workflow/dashboard rebuilt (the doctrine's
   "report-maintenance treadmill", unsolved).
2. **No date bucketing** — monthly/quarterly rollups (THE CRM report) are inexpressible
   (no `date_trunc`; brainstorm ② rates it highest-value).
3. **The uncaptured R140 UI/UX list** — folded into this probe's friction log.

_Track: 1 (demand-pull probe — the product decides, the probe listens). Pulled by ←
[Round_141](Round_141.md) "Feeds into" + the human's 2026-07-02 call ("export is not urgent…
it only has value once others work brightly") + the dogfood-first mission resolution
([brainstorm](../brainstorms/2026-07-01-step-model-extensibility.md))._

## Plan

- [ ] **Protocol** — script the two passes: **month-1 build** (upload the export → join/clean →
      shape with R120–R141 steps → a dashboard a boss would read) and **month-2 refresh** (a
      second export, same schema + new rows, one renamed column to poke drift → attempt to get
      the SAME report current, logging every manual step).
- [ ] **Agent pre-pass** (seed/fixture data) — verify the protocol is runnable end-to-end,
      capture agent-visible friction, dry-run the friction-log template.
- [ ] **Human pass** (real CRM export) — the actual dogfood; the human drives, friction is
      logged inline (what was attempted · what happened · severity · workaround).
- [ ] **Fold in** the R140-noted UI/UX issues (from the human, now enumerated).
- [ ] **Synthesize** — findings doc in
      [`plan/brainstorms/`](../brainstorms/) (severity × monthly-frequency ranking); name the
      R143 pull and the order of ⑥/②/④/UI-batch behind it.

## Risks / unknowns

- **Probe honesty** — log what the product DOES, not what we hoped; a friction the human
  works around silently is still a friction (capture-inline discipline).
- **Seed ≠ real** — the agent pre-pass verifies the real implementation runs, but only the
  human pass with real data yields the ranking evidence (seed-vs-MSW lesson generalizes).
- **Scope brake** — the probe FIXES nothing (no piecemeal UI fixes mid-probe; the batch-round
  doctrine holds). Findings become rounds; the probe only ranks them.

## Do

_(pending — protocol first)_

## Check

- [ ] Both passes executed and logged (month-1 build + month-2 refresh simulation).
- [ ] Friction backlog is evidence-linked (each entry names what was attempted and observed).
- [ ] R140 UI/UX issues enumerated and folded in.
- [ ] Findings doc signed off; R143 pull named.

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_143

The probe's ranked backlog IS the handoff: expected candidates are the refresh/treadmill theme
(⑥ — the product surviving month 2), date_trunc via the compute fork (② — monthly rollups),
the UI/UX batch round, and the value-out export (④ — parked until the loop is bright).
