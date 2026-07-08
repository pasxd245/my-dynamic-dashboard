# Round 157: FM1–12 append dogfood — accumulate the real 12-month call logs

**Status**: **OPEN — Planning / D gate**. Goal set at open (sequenced by the human at R156's open:
provenance first, dogfood next). Flow not yet selected (flow-selector runs at D exit).
**Date started**: 2026-07-09
**Flow**: _TBD — set at the D gate via flow-selector._
**Design source**: [`.agents/design/data-management/datasets/upload.md`](../../design/data-management/datasets/upload.md)
§ Refresh append mode + § Provenance column (R156) — this round exercises them, it does not add to them.

## Goal

**Inherits from ← [Round_156](Round_156.md)** (provenance column shipped) and
**← [Round_155](Round_155.md)** (keyless Append shipped). The two capabilities were built so this
walk is possible: append unions periodic exports keep-all (R155), and each row self-labels its origin
month via `Source.Name` (R156).

**The walk (human, sequenced 2026-07-08):** take the real 2025 monthly call logs
(`tmp/test-data/Weekly - Report Call Full FM1..12.25.xlsx`, the `Worksheet` sheet — the payload
probed in R155) and **append FM1 → FM12 into one dataset in a single real pass**, then group a widget
by `Source.Name` to confirm per-month counts. This exercises append *with* provenance in one walk
(each row self-labels its month) rather than walking 12 months twice.

**Why it earns a round (not just a manual check):** R155/R156 gates were green on synthetic fixtures
and a 2-file walk. The flagship payload is 12 disjoint months with genuine within-month dup keys
(memory `2026-07-08-append-mode-call-log-evidence.md`). Driving the whole real corpus through is the
demand-pull probe that either **confirms the accumulation loop end-to-end** or **surfaces the next
gap** (schema drift across months, dtype reconciliation, provenance under 12-way union, widget
GROUP BY at real row counts). The gap it surfaces is the real deliverable.

_Track: 1 (product — dogfood the accumulation loop on the flagship real dataset). Pulled by: R156
open sequencing (human) — exercise append+provenance in one real 12-month walk._

## Plan

- [ ] Probe the FM1–12 `Worksheet` column sets for drift (before the walk).
- [ ] D — `design-sync --check` + flow-selector; decide validation-round vs build-round shape.
- [ ] Walk: append FM1 → FM12 into one dataset; confirm no null-provenance rows.
- [ ] `GROUP BY Source.Name` in a widget → per-month counts match each file's row count; total = Σ.
- [ ] Capture the gap it surfaces (or confirm the loop end-to-end) as the deliverable.

## D-gate open questions (to resolve at D)

1. **Is this a validation round or a build round?** Expected shape: primarily an Integration/dogfood
   walk that may surface a small build. If the 12-month append is clean, the round's product is the
   verified loop + captured evidence (thin/no code). If it breaks, the break defines the build.
2. **Schema drift across FM1–12** — do all 12 months share the `Worksheet` column set, or does
   append's name-based reconciliation (null-fill / cast / drop) fire? Probe before the walk.
3. **What to assert** — per-month row counts via `GROUP BY Source.Name` should match each file's row
   count; total = Σ months; no null-provenance rows.

## Do

_(D gate not yet run. Next: probe the 12 files' schemas, then run `design-sync --check` +
flow-selector at D exit.)_

## Risks / unknowns

- Schema drift across FM1–12 may fire append's name-based reconciliation (null-fill / cast / drop).
- Real row counts (12 disjoint months) may surface performance or provenance-under-12-way-union gaps.

## Check

- [ ] _(pending — filled at Check phase)_

## Act

**Learnings**: _(pending)_

**Promotions**: _(pending — likely none for a dogfood round unless a gap is found)_

**Follow-ups (not promotions, just notes):**

- _(pending)_

## Feeds into → Round_158 (TBD)

_(pending — either "accumulation loop confirmed end-to-end on the flagship dataset" or the specific
gap the walk surfaced, which would define R158.)_
