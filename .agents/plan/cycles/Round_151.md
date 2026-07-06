# Round 151: UI / diagnosability batch, continued (F3 · F4 · F13 + F7/R140 decisions)

**Status**: Complete — F3/F4/F13 done; F7 + R140 deferred to [R152](Round_152.md) (2026-07-06)
**Date started**: 2026-07-06
**Date completed**: 2026-07-06
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

### F13 — diagnosed live + fixed (2026-07-06)

Human picked "run the app + catch them." Reproduced against the **running seeded backend**: the
seeded queries are joined (LEFT joins) and their `POST /queries/{id}/aggregate` calls work for
valid bodies (200), but `sum` over a **string** column returns **422 `measure_not_numeric`**
(confirmed on `qr_e5b5d436`: `sum(country)` → 422). Root cause: the dashboard's `aggregateEnabled`
gate ([WidgetView.tsx](../../../workspace/apps/builder/src/features/dashboard/WidgetView.tsx))
checked only that `measureCol` was PRESENT, not numeric. So a `sum`/`avg` widget over a numeric
column that **ingested as string** (the F1/F2 CRM reality) fires a server aggregate that 422s, then
silently falls back to the client roll-up and renders — a doomed 422 in the console per such widget.
The probe's `dsh_b41da51f` (gone) had two; the mechanism reproduces on any such widget.

**Fix:** a pure `serverAggregateSupportsMeasure(agg, measureCol, resolvedColumns)` gate — `count`
always runs; `sum` needs a numeric measure (checked against the bound query's `resolvedColumns`
dtypes). A KNOWN non-numeric measure now skips the server aggregate and takes the raw-rows client
path directly (identical rendered result, no 422). **Conservative:** an unknown dtype (measure
absent from `resolvedColumns` — a single-source query resolving columns from its dataset) still
attempts it, so only provably-doomed requests are removed (no regression). Covers the finding's
case (dashboards bind to joined queries → `resolvedColumns` present); single-source string-measure
widgets remain a named residual (unknown-dtype → attempt).

- Test: `server-aggregate-measure.test.ts` (4 — count / numeric / known-non-numeric-skip /
  unknown-allowed); `widget-aggregate.test.tsx` unregressed. **Gates:** FE `tsc` 0 · `vitest` 304 (+4).

## Check

- [x] R140 + F7 decisions recorded: **both deferred to [R152](Round_152.md)** (human, 2026-07-06
      — "defer to next round"). F7 splits to its own design-gated round; R140 stays an open
      enumerate-or-drop input.
- [x] Each in-scope finding fixed with a test (or found already-resolved): F3 test-verified; F13
      diagnosed live + test; F4 already-resolved (R30 sweep, no test needed). No silent-error
      regressions — F3 surfaces the real 500, F13 removes the doomed request rather than hiding it.
- [x] Backend pytest 352 + ruff green; FE tsc 0 + vitest 304 green; design/plan/markdown lints clean.
- [x] Human review — human-directed completion; F13 was reproduced **live** on the seeded backend
      (the sum-on-string 422) and F3 verified through the real middleware stack.

## Act

**Learnings:**

1. **Re-verify a logged finding is still real before building it.** F4 ("no temp sweep") was
   already solved by R30's `tmp_sweep`; the R142 observation was intra-session accumulation before
   the 24h TTL. A batch round is where stale findings surface — check each against the current code
   first, don't build what already exists. (Instance of verify-against-the-real-repo.)
2. **Some findings can only be pinned by running the app.** F13's two 422s were invisible in code —
   the mechanism (server `sum` on a string-typed numeric column → 422 → silent client-rollup
   fallback) only showed once I reproduced it against the **running seeded backend**. Static
   analysis narrowed the candidates; the live replay confirmed the exact class. The `verify`/run-live
   discipline isn't only for UI feel — it's how a "silent error" finding gets a real diagnosis.
3. **CORS ordering is the fix for the "CORS blocked" mislabel.** An unhandled 500 must be caught by
   a middleware INNER to CORS so the error response still flows out through the CORS layer;
   otherwise Starlette's outermost `ServerErrorMiddleware` emits a header-less 500 the browser
   mislabels. A one-middleware fix that makes every future 500 debuggable — high diagnosability
   leverage for low cost.

**Promotions:** none — applies existing doctrine (verify-against-repo, dfcfbi-f1/live-verify).

**Prune check:** nothing added to the agent OS. `UnhandledErrorMiddleware` + the
`serverAggregateSupportsMeasure` gate are product code earning their place (diagnosability +
removing a doomed request); F4 added nothing (already-resolved); the F13 fix REMOVED a network
request rather than adding surface. No new skill/process.

## Feeds into → Round_152 (F7 + the R140 decision)

[R152](Round_152.md) = **F7** — wide-table column show/hide: a `hidden?` view-hint on column
metadata + a new column-metadata `PATCH` (design-gated: the "visible-by-default *for whom*" Q →
D-gate first). **Carried into R152 as an open input:** the never-enumerated **R140 UI/UX list**
(enumerate-and-fold or formally drop). **Also carried:** R145 slice 1b (blast-radius preview) +
AI-propose-key (parked, #2). ④ export parked.
