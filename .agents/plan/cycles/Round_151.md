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

### F3 — built (2026-07-06)

**CORS-safe 500 + traceback logging.** Root cause confirmed: an unhandled exception propagates
past `CORSMiddleware` to Starlette's outermost `ServerErrorMiddleware`, whose bare 500 carries no
`Access-Control-Allow-Origin` → the browser mislabels it a CORS failure → the FE shows only
"Failed to fetch" (R142-F3). Fix: a `UnhandledErrorMiddleware` (`BaseHTTPMiddleware`) registered
**INNER to CORS** (added BEFORE it, so CORS is the outer wrapper) that catches the exception,
`logger.exception(...)`s the traceback, and returns a typed `{"detail": "internal_error"}` JSON
500 — which flows back out through CORS and gets decorated. Ordering is load-bearing (flagged in
the code comment). The two other parts of F3 were **already handled**: the alembic `fileConfig`
logger-kill was fixed in R144 (`disable_existing_loggers=False`), and access logs + tracebacks
reach `backend.log` via uvicorn's default logging → `local-up.sh`'s `2>&1` redirect.

- Test: `test_app_errors.py::test_unhandled_exception_returns_cors_safe_typed_500` — hits a temp
  route that raises through the **real app middleware stack** (`TestClient`,
  `raise_server_exceptions=False`), asserts 500 + `{"detail":"internal_error"}` + the
  `access-control-allow-origin` header echoes the configured origin + the traceback is logged. The
  test IS the middleware-ordering verification (it fails if CORS is inner / the status is swallowed).
- **Gates:** BE `pytest` 352 (+1) · `ruff` clean. FE untouched (the browser already renders a
  `detail` body, so no FE change needed for the core fix).

### F4 — assessed: already resolved (no code) (2026-07-06)

The orphaned-temp-upload sweep the R142 finding asked for **already exists** (R30):
`app/jobs/tmp_sweep.py`'s `sweep_loop`, spawned in the lifespan, `enabled: true`,
`interval_seconds: 3600` (1h), `ttl_seconds: 86400` (24h) ([settings.py](../../../workspace/apps/backend/app/_config/settings.py) +
[values.yaml](../../../workspace/config/values.yaml)). The R142 observation — 6 dirs in one
session — is **intra-session accumulation before the 24h TTL elapses**, i.e. working as designed
(the sweep is TTL-based, not immediate). No change; F4 closed as already-handled. (If a shorter TTL
is ever wanted it's a one-line config tune, not a code gap.)

### F13 — needs a live dashboard repro (2026-07-06)

F13 ("two silent 422s on dashboard load") is a **runtime-observation** finding: the two 422s were
seen on the R142 probe's dashboard `dsh_b41da51f` load (headless console). That dashboard is probe
data, **not in the repo**, and the dashboard-load fetch fan-out (per-widget `useWidgetAggregate`
POST + `useWidgetData` rows) 422s depend on the specific widget configs — so the two specific 422s
can't be pinned from static code. F3's envelope work doesn't change 422s (those are already typed;
"silent" = the FE fires-and-ignores them in the console). **Options:** run the seeded app + load a
dashboard to catch them live, or defer to the human's in-app review. **Pending a repro / decision.**

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
