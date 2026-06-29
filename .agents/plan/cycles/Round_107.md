# Round 107: "Fetch-once" — reduce the per-query paged-request count

**Status**: **Complete** (human Check passed 2026-06-29) — Plan/Design/Contract/Backend gates green, human Check ✅
**Date started**: 2026-06-29
**Date completed**: 2026-06-29
**Flow**: **DCFBI** — set at the Design gate via flow-selector (no-UI round → DCFBI by construction;
recorded in the Do log). Has a **Contract gate** (public-API change to `GET /queries/{id}/rows`). F1/F2
skipped.

## Goal

**Inherits from ← [Round_106](Round_106.md) Feeds-into** ("features resume on the clean seam, fetch-once
first"). Carry forward the **"fetch-once"** strategy the human has been exploring since R104 — avoid the
paged-at-100 request count when a widget loads a query's rows.

_Track: 1 (product — the FE data-load path / compute seam). Pulled by ← R104 parked "fetch-once"
exploration + R106 Feeds-into. Per the [Evolution Rule](../../AGENTS.md)._

## Code-sourced truth (verified 2026-06-29)

A widget loads its data via `useWidgetData(queryId)` —
[`builder/src/features/dashboard/hooks.ts:111-127`](../../../workspace/apps/builder/src/features/dashboard/hooks.ts).

**Finding that reframes the round — cross-widget "fetch-once" is ALREADY done.** `useWidgetData` is a
React Query hook keyed `['dashboard-widget-data', queryId]`
([hooks.ts:107-109](../../../workspace/apps/builder/src/features/dashboard/hooks.ts)), with global
`staleTime: 60_000` ([main.tsx:68-75](../../../workspace/apps/builder/src/main.tsx)). So **N widgets bound
to the SAME query already share one fetch** — the second widget hits the cache, no extra request. The thing
the phrase "fetch-once" most naturally describes is **already true today.**

**What is NOT solved — the per-query paged-request count.** `fetchAllRows`
([hooks.ts:38-48](../../../workspace/apps/builder/src/features/dashboard/hooks.ts)) loops
`GET /queries/{id}/rows?page=N&page_size=100` because the contract caps `page_size` at **100**
(`PAGE_SIZES = (10, 25, 50, 100)` — [backend constants.py:57](../../../workspace/apps/backend/app/_generated/constants.py),
validated strictly at [queries.py:460-474](../../../workspace/apps/backend/app/routers/queries.py)). With
the R104 row-cap (`DASHBOARD_MAX_ROWS`, 10k default / 1000 local), **one distinct query** costs
`ceil(min(cap, total) / 100)` requests — up to **~100 requests at the 10k cap**, ~10 at the 1000 cap. That
serial loop is the real "fetch-once" target.

**The tension this surfaces.** `PAGE_SIZES` is **shared** between the interactive preview-table pager (the
user-facing page-size dropdown — wants small values) and the widget fetch-all loop (wants the largest
possible). Simply adding `10000` to the set would pollute the preview dropdown. So a single-request fetch
needs **either** a separate "fetch-all / unpaged" mechanism (e.g. a `?all=true` param or `page_size=0`) **or**
a widget-only large-page constant distinct from the UI pager set. **Both are contract + backend changes.**

## Reframe → the scoping fork (Plan gate)

The feature the human imagined ("fetch once, share across widgets") is **already free**. What remains is a
**scale optimization** (serial request count per query), whose pull is **gated on real data volume** — at
seed/demo volume the 10-request loop is invisible. Per accelerate⇌brake and "don't build speculatively,"
this round should NOT auto-build the contract change. Three honest options for the human:

- **A — Verify & document the existing dedup; close thin.** Confirm cross-widget sharing works (add a
  focused test + a one-line design-doc note), and park the request-count optimization until a real
  large-data pull. Cheapest; matches "default = don't add" if the imagined need is already met.
- **B — Single-request fetch (page-size widening / unpaged).** Replace the paged-at-100 loop with one
  request per query, capped at `DASHBOARD_MAX_ROWS`. Contract + backend change (new unpaged param or
  widget-only large page size), keeping the UI pager's `PAGE_SIZES` untouched. A real DCFBI-with-Contract
  round. Justified only if the request count is a felt problem now.
- **C — Defer to server-side pushdown.** Skip fetch-once entirely; the real large-data fix is DuckDB
  GROUP BY / filter pushdown (the deferred compute pull from R103-105), which retires fetch-all's cost
  rather than just batching it. Fetch-once becomes moot if pushdown is the next theme.

## Plan (finalize after human picks A / B / C)

1. **Plan gate** — human confirms which problem R107 solves (the fork above). ← we are here.
2. (then) Design / flow-selector / build per the chosen option.

## Risks / unknowns

- **Building an already-solved feature.** The strongest risk: A-vs-B hinges on whether the human's
  "fetch-once" meant cross-widget sharing (done) or single-request loads (not done). Confirm before building.
- **Contract-set pollution** (option B) — widening `PAGE_SIZES` would leak into the UI pager; the design
  must keep the widget fetch path's large size separate from the user-facing set.
- **Premature optimization** — at current volume the loop is invisible; option B without a real-data pull
  is the kind of speculative add the Evolution Rule brakes.

## Do

### Plan gate PASSED — human chose scope B (2026-06-29)

Presented the reframe (cross-widget dedup already works via React Query) and the A/B/C fork. **Human chose
B — single-request fetch:** replace the paged-at-100 loop with one request per query, capped at
`DASHBOARD_MAX_ROWS`. Confirms the request-count loop is a felt-enough problem to fix now (not deferred to
pushdown). Next: **Design gate** — lock the contract mechanism before building.

### Design-gate draft — open questions (2026-06-29)

The one load-bearing design decision is **how the contract expresses "one request, all rows up to the
cap"** without polluting the UI pager's `PAGE_SIZES`. Sub-questions:

- **D1 — mechanism:** an unpaged flag (`?all=true`) vs a special unbounded value (`page_size=0`) vs a
  widget-only large page-size constant separate from `PAGE_SIZES`. (See the Plan-gate question to the human.)
- **D2 — cap enforcement home:** the server caps the single response at `DASHBOARD_MAX_ROWS` (so the cap
  can't be bypassed by the unpaged path) and still returns the true `total`, preserving R104's over-cap
  warning (`capped = total > cap`). Confirm the cap lives server-side, not just FE-side as today.
- **D3 — response shape:** `RowsPage` keeps `{rows, page, pageSize, total}`; for the unpaged response,
  `page=1` and `pageSize` echoes the returned row count (or a sentinel). Confirm `additionalProperties:false`
  conformance is preserved.

### Design gate — decisions ratified (human, 2026-06-29)

- **D1 = unpaged flag** (human-ratified). `GET /queries/{id}/rows?unpaged=true` returns rows up to the cap
  in one response; `page`/`page_size` are ignored when set. Keeps the UI pager's `PAGE_SIZES` untouched —
  the cleanest seam between the widget-fetch path and the user-facing pager. **Renamed during build
  (human, 2026-06-29): `all` → `unpaged`.** `all` overpromised — the response is capped at
  `dashboard_max_rows`, so it is not "all" rows; `unpaged` names the mechanism (no paging) and makes no
  completeness claim. (See the Built log.)
- **D2 = server-side cap.** The server caps the `unpaged=true` response at `DASHBOARD_MAX_ROWS` (the unpaged
  path must not bypass R104's bound) and still returns the true `total` so the over-cap warning
  (`capped = total > cap`) keeps working. **Build wrinkle (code-verified):** the cap currently renders to
  the **FE only** ([builder constants.ts:71](../../../workspace/apps/builder/src/_generated/constants.ts));
  backend `constants.py` lacks it. So the config-render mapping must also emit `dashboard_max_rows` to the
  backend — a small `values.yaml`-routing change, in scope.
- **D3 = response shape unchanged.** `RowsPage` stays `{rows, page, pageSize, total}`; unpaged response uses
  `page=1`, `pageSize` = returned row count. `additionalProperties:false` conformance preserved (no new
  field on the response; `all` is a request-only query param).

**Build sequence (DCFBI — Contract first):** (C) add the `unpaged` query param to the rows-get contract +
surface `dashboard_max_rows` to the backend; (B) backend honors `unpaged=true` (cap server-side, true
total); (FE) `fetchAllRows` → a single `?unpaged=true` request; (I) integration test + the existing
over-cap warning still fires.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)) — **no-UI round**:
this round changes the contract/backend/data-load path but adds **no new UI surface**, so the five
UX-framed conditions read vacuously **no** (per the skill's no-UI branch). Evaluated for the audit trail:

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | No new state model; capped/uncapped is the existing R104 pair, unchanged. |
| 2. New interaction pattern           | no     | No UI — `?unpaged=true` is a wire param, no user-facing interaction. |
| 3. High user-error risk              | no     | Read-only data load; no destructive or irreversible action. |
| 4. Contract depends on unresolved UI | no     | D1 (the unpaged flag) is resolved; the schema is writable now without any UI answer. |
| 5. UX confidence below threshold     | no     | No UX surface; the mechanism is human-ratified. |

Result: **Flow: DCFBI** — no-UI round → DCFBI by construction. F1/F2 skipped.

### Built (2026-06-29) — awaiting human Check

**C — Contract.** Added the `unpaged` (boolean) query param to
[`queries/rows-get.contract.yaml`](../../../workspace/packages/contracts/queries/rows-get.contract.yaml)
(+ `.md` rationale): when `true`, paging is bypassed and the result is returned in one response, capped
server-side at `dashboard_max_rows`. **Naming (human, 2026-06-29):** the param was first written `all` but
renamed to `unpaged` — `all` overpromised (the response is capped, not complete); `unpaged` names the
mechanism (no paging) and the cap stays a documented server bound. **D3 fix:** relaxed the response `pageSize` from the `PageSize` enum to
a plain integer (the unpaged response echoes the returned row count, which exceeds the enum) — this matches
the BE `RowsPage` model, whose `pageSize` has been a plain `int` since R72/R106, so no behavior change for
paged responses. **Surfaced the cap to the backend (D2):** added `DASHBOARD_MAX_ROWS` to the backend
constants template ([constants.py.hbs](../../../workspace/config/templates/backend/app/_generated/constants.py.hbs)),
re-rendered, and updated the `values.yaml` comment (was "FE-only / no BE consumer"). Contract suite **29
passed**.

**B — Backend.** [`run_query`](../../../workspace/apps/backend/app/routers/queries.py) takes `all: bool =
False`; when set, it reads page 1 sized to `DASHBOARD_MAX_ROWS` and echoes `pageSize = len(rows)`, `page =
1`, with `total` = full matched count (so a partial result is `total > len(rows)`). The `page_size` enum
check is skipped on the unpaged path. Rides R106's `_resolve_plan` seam — single- and multi-source both
flow through unchanged. **3 new tests** in `test_queries.py` (unpaged shape; off-enum `page_size` ignored
under `all`; server-side cap via monkeypatched `DASHBOARD_MAX_ROWS=1` proving `len(rows)=1, total=2`).
Backend suite **223 passed** (220 unchanged + 3) · ruff clean.

**FE — Integration.** New `queriesApi.getUnpagedRows(id)` hits `?unpaged=true`;
[`fetchWidgetData`](../../../workspace/apps/builder/src/features/dashboard/hooks.ts) now makes **one**
request instead of the paged-at-100 loop (`fetchAllRows` + `MAX_PAGE_SIZE` deleted). `capped` is now
`total > rows.length` (server-cap-source-agnostic). The MSW handler honors `unpaged=true` via a shared
`pageOf` helper across all run branches. The R104 over-cap warning (`WidgetView`/`WidgetFilterDrawer`) is unchanged
and still keyed on `capped`. FE typecheck clean · **216 passed**.

### Human-Check finding + decisive test added (2026-06-29)

During the human Check, a widget showed "Showing the first 1,000 of 905 rows" — a contradiction (905 < the
1,000 cap), so the over-cap warning fired wrongly. **Root cause: a stale backend process** — the running
server predated R107, so it ignored the unknown `?unpaged=true` param and returned the default 50-row page;
the new FE then computed `capped = total(905) > rows(50)` → true, and the tooltip printed the cap constant
as the "first N". **Not a code bug** — restarting the backend resolved it (human confirmed "no issue").

This exposed a **test gap**: the three `unpaged` tests used a 2-row fixture (< the 50 default page), so they
could NOT distinguish a real unpaged fetch from a default-paged fallback — exactly the runtime failure.
Closed it with `test_run_unpaged_returns_all_rows_beyond_one_page` (120 rows > default page < cap): asserts
paged returns 50/total=120 while unpaged returns 120/total=120, so a silent paged-fallback regression now
fails the suite. Backend suite **224 passed** (223 + 1).

_Latent fragility noted, NOT changed (human: "no issue"): the cap tooltip prints `DASHBOARD_MAX_ROWS` as the
"first N" rather than the actual rows shown — accurate whenever the system works (a capped widget shows
exactly `cap` rows), misleading only in the stale/broken-fetch state that shouldn't occur. Left as-is._

## Check

| Item | Result |
| --- | --- |
| Contract suite | **29 passed** (`unpaged` param + relaxed `pageSize` valid) |
| Backend suite | **224 passed** (220 unchanged + 4 new `unpaged` tests) |
| FE typecheck | clean |
| FE suite (incl. MSW conformance) | **216 passed** |
| ruff `app/ tests/` | clean |
| Behavior-preserving (output) | ✅ same rows / cap / over-cap warning — only request count changed |
| **Check (human)** | ✅ **passed** — seed-app run; widget loads in one `?unpaged=true` request; the stale-backend false-warning resolved on restart (2026-06-29) |

## Act

**Round complete (2026-06-29).** A dashboard widget now loads its query in a SINGLE
`/queries/{id}/rows?unpaged=true` request, capped server-side at `dashboard_max_rows`, instead of the
paged-at-100 fetch-all loop. Cross-widget dedup was already free (React Query), so the request-count loop was
the only real target. The param was renamed `all` → `unpaged` mid-build (human) to avoid overpromising — the
response is capped, not complete. The human Check surfaced a stale-backend false-warning (not a code bug) and
a test gap, both addressed (decisive >default-page test added). Output behavior is unchanged — only the
per-query request count. `values.yaml` (`dashboard_max_rows`) stays uncommitted (local test setting).

## Feeds into → Round_108

The R101–105 enhancement backlog resumes on the clean seam: date-range/drill filters, saved/URL-encoded
filters, per-widget cap override, ECharts (advanced charts), 2D widget arrange, dashboard settings. The
heavier large-data fix — **server-side DuckDB pushdown** (GROUP BY / filter so the browser receives small
aggregates) — remains the deferred compute pull, now that the unpaged path has retired the request-count
cost for results within the cap.
