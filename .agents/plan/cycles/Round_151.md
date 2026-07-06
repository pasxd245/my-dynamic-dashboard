# Round 151: UI / diagnosability batch, continued (F3 · F4 · F13 + F7/R140 decisions)

**Status**: Planning — F3 recommended first; two decisions open (2026-07-06)
**Date started**: 2026-07-06
**Flow**: TBD — batch round. F3/F4/F13 are backend/diagnosability C+B slices (DCFBI, no F1);
F7 (if pulled in) runs its own D-gate. Set per-item after the decisions.

## Goal

**Inherits from ← [Round_150](Round_150.md)** — R150 shipped **F12** (many_to_one cardinality)
and, by human direction, completed after that one item; the rest of the rank-5 UI/diagnosability
batch rolls here. This round continues the batch, leading with its highest-value member.

The full member definitions + triage live in [R150 § Members / § Triage](Round_150.md) (the batch
was scoped there); this round carries them forward unchanged. Per the signed-off
[R142 dogfood ranking](../brainstorms/2026-07-03-r142-dogfood-findings.md) rank-5.

_Track: 1. Pulled by ← [Round_150](Round_150.md) Feeds-into (the F12 slice split off; this is the
remainder of the same signed-off rank-5 bucket)._

## In scope (this round)

| # | Sev | What | Home |
| - | --- | ---- | ---- |
| **F3** | Med (diagnosability) | An unhandled 500 bypasses CORSMiddleware → no `Access-Control-Allow-Origin` → browser mislabels it "CORS blocked" → FE shows only "Failed to fetch". `backend.log` captures startup lines only — no access logs, no tracebacks. | BE: CORS-safe typed 500 envelope + dev logging (tracebacks) |
| **F4** | Low | Abandoned wizard runs orphan temp uploads in `data/uploads_tmp/` — no sweep. | BE: TTL / startup or commit-time sweep |
| **F13** | Low (F3-family) | Dashboard load fires two silent 422s in the console while rendering succeeds — invisible unless devtools open. | Chase the two 422s; fix cause or surface truthfully (rides on F3's envelope) |

**Recommended order: F3 first** (highest value; and its envelope work makes F13 easier to see),
then F13, then F4.

## Decisions still open (carried from R150 — hard-stop before those items)

1. **The R140 UI/UX list** — never enumerated (R142 Check-3 struck through). Enumerate it now and
   fold in, or leave parked? The batch can't include what isn't named.
2. **F7** (wide-table column show/hide: a `hidden?` view-hint + a **new column-metadata `PATCH`**,
   with an open design Q "visible-by-default *for whom*") — keep in this batch, or split to its own
   round? **Lean: split** — F7 is a design-gated mini-feature, not a background-friction fix; folding
   it in would turn a thin diagnosability sweep into a feature round.

## Plan (draft — set after the two decisions)

- [ ] **F3**: an unhandled exception returns a typed JSON 500 **through** the CORS layer (so the
      browser reads a real status, not "CORS blocked") + backend logs the traceback to
      `backend.log`. Decide the seam (exception handler / middleware order). Don't swallow — surface.
- [ ] **F13**: identify the two dashboard-load 422s; fix the cause or make them non-silent (rides
      on F3). A silenced 422 that was masking a real bug is a regression — chase the cause first.
- [ ] **F4**: sweep orphaned `data/uploads_tmp/` (TTL/startup or commit-time); decide the mechanism.
- [ ] **F7** (only if kept): D-gate first ("default for whom" + the `PATCH` shape), then C/B/F/I.
      Otherwise → its own round.
- [ ] **R140 items** (only if enumerated): triage each into the batch or defer.
- [ ] Tests per item; gates green; design-sync any doc touched.

## Risks / unknowns

- **F3/F13 are "surface the truth," not "hide the error"** — a silenced 422 masking a real bug =
  regression. Chase the cause before quieting.
- **Middleware ordering (F3)** — the fix is that errors pass *through* CORS; getting handler/
  middleware order wrong could either not fix the mislabel or swallow the real status. Verify with
  a real 500 replay, not just a unit test.
- **Batch scope creep** — F7 is the pull risk; the guard is the split decision above.
- **R140 unknown size** — enumerate before folding in; re-rank if anything exceeds "background
  friction."
- **Carried, not this round**: R145 slice 1b (blast-radius preview); AI-propose-key (#2, parked);
  ④ export parked.

## Do

_(Decisions + build land here.)_

## Check

- [ ] R140 + F7 decisions recorded.
- [ ] Each in-scope finding fixed with a test; no silent-error regressions (F3/F13 surface truth).
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human review of the batch.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_152 (TBD)

Depends on the F7 decision: if split, a candidate next round is **F7** (column-visibility hint +
column-metadata PATCH). Otherwise re-rank at open. **Carried**: R145 slice 1b + AI-propose-key.
④ export parked.
