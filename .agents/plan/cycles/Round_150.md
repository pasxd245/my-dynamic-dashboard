# Round 150: UI / diagnosability batch (F3 · F4 · F7 · F12 · F13 + R140 list)

**Status**: Planning — triage + two round-shaping decisions open (2026-07-06)
**Date started**: 2026-07-06
**Flow**: TBD — batch round; triage first. The small fixes run as a DCFBI C+B/F slice; F7 (if
kept in scope) runs its own D-gate. Set per-item after triage.

## Goal

**Inherits from ← [Round_149](Round_149.md)** (F8 complete). Per the signed-off
[R142 dogfood ranking](../brainstorms/2026-07-03-r142-dogfood-findings.md) **rank 5** — the last
ranked bucket before the parked ④ export — this is the **UI / diagnosability batch**: the
continuous-background-friction items that don't each merit a round but have accrued. Per the
human's standing call — don't fix UI bugs piecemeal mid-feature; batch them into a dedicated
round — they land together here.

The loop is now bright end-to-end (month-1 ② closed R144; month-2 ⑥ closed R145+R147; F8
multi-range R149), so this round pays down the friction/diagnosability debt the dogfood probe
logged rather than adding a new capability.

_Track: 1. Pulled by ← [Round_149](Round_149.md) Feeds-into + the signed-off rank-5 bucket in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)._

## Members (from the R142 friction log — code-anchored)

| # | Sev | What | Home |
| - | --- | ---- | ---- |
| **F3** | Med (diagnosability) | Server errors invisible end-to-end: an unhandled 500 bypasses CORSMiddleware → response lacks `Access-Control-Allow-Origin` → browser mislabels it "CORS blocked" → FE shows only generic "Failed to fetch". `backend.log` captures startup lines only — no access logs, no tracebacks. | BE error-envelope + dev logging |
| **F4** | Low | Every abandoned wizard run orphans a temp upload in `data/uploads_tmp/` (6 accrued in one session) — no sweep. | BE sweep job / TTL |
| **F7** | **Med (UI/UX + model)** | Wide tables unreadable — `PagedRowsView` renders ALL columns in one scroll, no show/hide. Proposal: a **`hidden?` view-hint on column metadata** + **post-upload column-metadata `PATCH`** (doesn't exist today), honored as the row-preview DEFAULT. Open design Q: "default for WHOM" — an overridable row-preview default, NOT a hard projection (query-builder/join pickers still see all). Presentation-only hint (never touches parquet) → doctrine satisfied. | FE column-picker + BE column-metadata PATCH + **design gate** |
| **F12** | Low (modeling UX) | Relationship cardinality vocab lacks `many_to_one` — the commonest fact→dim join has no truthful label (probe used `many_to_many` untruthfully). | contract enum + BE + FE label |
| **F13** | Low (diag, F3-family) | Dashboard load fires two silent 422s in the console while rendering succeeds — invisible unless devtools open. | run down the two 422s; fix or silence truthfully |
| **R140 list** | ? | The human's UI/UX items — **never enumerated** (R142 Check-3 struck through). | **needs human enumeration at open** |

## Triage (proposed — for the human to confirm)

- **Quick, batch-able together**: **F4** (sweep/TTL), **F12** (enum add `many_to_one`), **F13**
  (chase the two dashboard 422s). Small, independent, low-risk.
- **Dev-infra**: **F3** — error-envelope + backend logging so a 500 surfaces truthfully (typed
  body + a traceback in `backend.log`), which also makes **F13**'s silent-422 class easier to see.
  R142 filed F3 as "dev-infra/error-envelope candidate."
- **The heavy one**: **F7** — R142's own note says it "**splits cleanly**": a transient FE
  column-picker is pure UI, but the *persistent* `hidden?` hint needs a **new column-metadata
  `PATCH`** endpoint AND has an open design Q ("default for whom"). This is a design-gated
  mini-feature, not a background-friction quick-fix.

## Round-shaping decisions (open — hard stop for the human)

1. **The R140 list** — enumerate it now (fold into this batch), or proceed without it and let it
   stay parked? It's never been written down; the batch can't include what isn't named.
2. **F7 scope** — keep F7 **in this batch** (accept a design gate mid-batch), or **split it to its
   own round** (R151) and keep R150 the clean quick-fix batch (F3/F4/F12/F13 + R140 items)? R142
   already flagged F7 splits cleanly; default lean = **split F7 out**, so this round stays a thin,
   low-risk diagnosability/UX sweep.

## Plan (draft — set after the two decisions)

- [ ] Confirm triage + the two decisions above (human).
- [ ] **F12**: add `many_to_one` to the cardinality enum (contract + `values.yaml` + BE validation
      + FE label + i18n); the truthful fact→dim label. Smallest, self-contained.
- [ ] **F4**: sweep orphaned `data/uploads_tmp/` dirs (a TTL/startup sweep or a commit-time
      cleanup); decide the mechanism, don't leak temp state.
- [ ] **F3**: ensure an unhandled 500 returns a CORS-safe typed envelope (so the browser stops
      mislabeling it "CORS blocked") + write tracebacks/access lines to `backend.log`.
- [ ] **F13**: identify the two dashboard-load 422s; fix the cause or make them non-silent
      (this rides on F3's envelope work).
- [ ] **F7** (only if kept in scope): D-gate first (the "default for whom" Q + the column-metadata
      `PATCH` shape), then C/B/F/I. Otherwise → R151.
- [ ] **R140 items** (only if enumerated): triage each into the batch or defer.
- [ ] Tests per item; gates green; design-sync any doc touched (F7 touches datasets/column model).

## Risks / unknowns

- **Batch scope creep** — heterogeneous items; the guard is the triage + keeping F7's design-gated
  work out unless explicitly pulled in. A batch round must not quietly become an F7 feature round.
- **F7 is a mini-feature, not a friction fix** — new PATCH capability + design Q. If kept, it needs
  its own D-gate; flag and gate it, don't absorb it into the quick-fix flow.
- **R140 list is unknown size** — could contain anything from a one-liner to another F7. Enumerate
  before committing to fold it in; re-rank if an item is worse than "background friction."
- **F3/F13 are diagnosability** — the fix is "surface the truth," not "hide the error"; a silenced
  422 that was masking a real bug would be a regression. Chase the cause first.
- **Carried, not this round**: R145 slice 1b (drift blast-radius preview); AI-propose-key (#2,
  parked). ④ export stays parked (no probe evidence moved its rank).

## Do

_(Triage + build land here.)_

## Check

- [ ] Round-shaping decisions recorded (R140 enumeration; F7 in-batch vs split).
- [ ] Each in-scope finding fixed with a test; no silent-error regressions (F3/F13 surface truth).
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human review of the batch.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_151 (TBD)

If F7 splits out, R151 = F7 (column-visibility hint + column-metadata PATCH). Otherwise the next
pull is re-ranked at open. **Carried**: R145 slice 1b + AI-propose-key. ④ export parked.
