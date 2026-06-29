# Round 106: Scoped, behavior-preserving backend refactor (before features)

**Status**: **Complete** (human Check passed 2026-06-29) — Plan gate PASSED, Backend gate green, human Check ✅
**Date started**: 2026-06-29
**Date completed**: 2026-06-29
**Flow**: Refactor (not a feature) — the DCFBI/DFCFBI feature chain does **not** apply. Guard = the
existing integration tests must stay green (behavior-preserving) **plus** new resolver unit tests. Gates
reduce to a **Backend gate** (suites green + behavior unchanged) and the human Check.

## Goal

**Inherits from ← [Round_105](Round_105.md) Feeds-into.** Pay down the **router-layer debt** with a
**scoped, behavior-preserving** refactor *before* the next features deepen it (fetch-once, date-range/saved
filters, per-widget cap override all touch the execution/persistence paths). The debt is **accepted** — it
comes from the R69 "raw-sqlite + Pydantic in the router, no SQLModel/ORM" decision, generalized across all
routers. We refactor **with a pull**, not speculatively.

_Track: 1 (product — backend compute seam). Pulled by ← R105 Feeds-into + human's 2026-06-29 "refactor
before features" call. Per the [Evolution Rule](../../AGENTS.md). Doctrine:
memory `2026-06-29-backend-router-layer-debt`._

## Code-sourced truth (verified 2026-06-29)

The routers **are** the application layer (HTTP + validation + inline raw-sqlite via `get_conn` +, for data
routers, orchestrating the only extracted layer, `app/ingest/`). The smell that proves the missing layer:
shared helpers have no home, so **routers import each other** —

- `queries.py:52-54` — `from app.routers.datasets import RowsPage`; `from app.routers.relationships import
  _compatible, _dtype_of`; `from app.routers.workspaces import _is_unique_violation`.
- `datasets.py:45-46` — `from app.routers.uploads import _load_meta`; `from app.routers.workspaces import
  _is_unique_violation`.

Severity gradient (LOC): `queries` **652**, `datasets` **530**, `uploads` **289** (data trio = fat);
`relationships` **223**, `dashboards` **215**, `workspaces` **168** (CRUD trio = thin-ish). Worst offender:
`queries` repeats the resolve/execute orchestration across **run / preview / create / update**.

## Scope (two targets — both behavior-preserving)

1. **Extract the query-execution orchestration** into a shared helper (e.g. `resolve_and_execute` /
   `validate_definition`) that the run / preview / create / update endpoints call. **DB access stays a
   passed `sqlite3.Connection`** — no repo abstraction yet. Add **resolver unit tests** for the extracted
   helper.
2. **Give the cross-router shared helpers a home** — relocate `_dtype_of` / `_compatible` /
   `_is_unique_violation` / `RowsPage` / `_load_meta` into a small shared module so routers **stop importing
   each other**. Pure move + re-point imports.

**Natural starter (already in the working tree, uncommitted):** the `_SELECT_QUERY` dedup in
[queries.py](../../../workspace/apps/backend/app/routers/queries.py) — two remaining literal
`"SELECT * FROM queries WHERE id = ?"` strings (`get_query`, `run_query`) re-pointed to the existing
`_SELECT_QUERY` const (def'd at line 66). In scope; fold into commit 1.

## Explicitly deferred (default = don't add)

- The grand **repository + service/domain layer** — until a real pull (a second in-process consumer =
  workflow #2, or a persistence swap). Cold-reviewed call: do the **minimal** extraction, **not** a
  hexagonal rewrite. One time-boxed round, then **features resume** on the clean seam (fetch-once first — it
  wants the seam).
- The R101–105 enhancement backlog (date-range/drill, saved filters, per-widget cap override, ECharts, 2D
  arrange, dashboard settings, fetch-once page-size widening).

## Plan (finalize after human confirm)

1. **Plan gate** — human confirms scope + cap (this file). ← we are here.
2. **Target 2 first** (the home for shared helpers) — lowest-risk pure move; unblocks target 1 cleanly.
3. **Target 1** — extract `resolve_and_execute`; re-point the 4 endpoints; add resolver unit tests. Fold
   in the `_SELECT_QUERY` dedup. Commit per logical move (revert seams).
4. **Backend gate** — full backend suite green (integration tests prove behavior unchanged) + new unit
   tests; type-check/lint clean.

## Risks / unknowns

- **Behavior drift masquerading as refactor** — the whole point is behavior-preserving; the integration
  tests are the guard. If a test must change, that's a behavior change → stop and flag, don't "fix the test".
- **Import-cycle on relocation** — moving helpers must not create a new cycle; the shared module imports
  nothing from the routers.
- **Scope creep into the deferred service layer** — hard-stop at the two targets.

## Working-tree note (pre-existing, not yet triaged into this round)

`git status` shows two uncommitted edits carried in from R105's session:

- [queries.py](../../../workspace/apps/backend/app/routers/queries.py) — the `_SELECT_QUERY` dedup (in
  scope, see above).
- [values.yaml](../../../workspace/config/values.yaml) — `dashboard_max_rows` **10000 → 1000`. **Human's
  call (2026-06-29): keep it locally** to exercise the widget over-cap warning during hands-on testing.
  Stays **uncommitted / out of R106 scope** — a local test setting, not a refactor change.

## Do

### Plan-gate draft — opened from R105 Feeds-into (2026-06-29)

Opened R106 as a scoped behavior-preserving backend refactor. Verified the debt against the code (cross-
router imports at `queries.py:52-54`, `datasets.py:45-46`; LOC gradient confirmed).

### Plan gate PASSED — human confirmed (2026-06-29)

Human confirmed the two-target scope and chose to **keep `values.yaml` `dashboard_max_rows: 1000` locally**
(uncommitted) to test the widget over-cap warning. Sequence: **(1)** establish a green backend baseline,
**(2)** target 2 — relocate cross-router helpers to a shared module, **(3)** target 1 — extract
`resolve_and_execute` + resolver unit tests, folding in the `_SELECT_QUERY` dedup. Commit per logical move.

### Built (2026-06-29) — awaiting human Check

**Baseline:** backend suite **215 passed** before any edit (the behavior-preservation reference).

**Target 2 — cross-router helpers got a home.** New module
[`app/routers/_shared.py`](../../../workspace/apps/backend/app/routers/_shared.py) holds `_dtype_of`,
`_compatible` (+ its `_NUMERIC`), `_is_unique_violation`, `_load_meta`, and `RowsPage` — moved verbatim
(no logic change; names keep their leading underscore so call sites are unchanged). Re-pointed every
importer: `relationships`/`workspaces`/`uploads`/`datasets`/`queries` now import from `_shared` instead of
from each other. **The router→router import smell is gone** (verified: no remaining
`from app.routers.<peer> import` for these symbols). Suite **215 passed**.

**Target 1 — query-execution orchestration extracted.** New private
[`_resolve_plan`](../../../workspace/apps/backend/app/routers/queries.py) is the shared front half of
**create / update / run / preview**: it branches single-dataset vs multi-source, delegates the multi case
to `_resolve_chain`, and returns a uniform `{"kind", "payload"|"ds", "columns"}` plan + a normalized
`reason`. Each endpoint keeps its own **reason→HTTP mapping** (genuinely different: create/update reject a
bad definition 422; run/preview map drift to 409-stale) — only the duplicated resolve/branch/column-extract
mechanics were unified (~187 deletions / 144 insertions across the 5 routers). Folded in the **`_SELECT_QUERY`
dedup** (the two remaining literal selects → the const). Bonus: the SonarLint cognitive-complexity warnings
on `run_query` (22) and `preview_query` (24) drop below threshold.

**One intentional, unreachable micro-divergence (flagged):** `_resolve_plan` always checks single-source
workspace membership (`ds["workspace_id"] != workspace_id` → `source_missing`). For the trusted run/update
paths the original checked only `ds is None`. This is a **no-op on every reachable input** — a saved query's
`ds_` source is invariantly in the query's own workspace (datasets don't move; the source was validated
in-workspace at save time) — and strictly safer on unreachable ones. All integration tests still pass.

**Resolver unit tests:** new
[`tests/test_resolve_plan.py`](../../../workspace/apps/backend/tests/test_resolve_plan.py) (5 tests) pins
the helper's own contract directly: single-source plan shape, `source_missing` for absent **and**
cross-workspace datasets, the `qr_` → join-branch delegation, and `composition_cycle` surfacing unmapped.

**Verification (automated):** `ruff check app/ tests/` **clean** · `pytest` **220 passed** (215 pre-existing
unchanged = behavior-preserving + 5 new). No type-checker in the toolchain (ruff + pytest only).

**Pending human Check:** run the app and exercise the query surfaces — **save** a query (valid + bad-atom
422 + name-collision 409), **edit/PUT** it, **run** `/queries/{id}/rows`, and **preview** an unsaved
definition (single-dataset, joined, and a deliberately-stale join → 409). Behavior should be identical to
pre-R106.

### Folded-in consistency pass (human-directed, 2026-06-29) — raw HTTP codes → named constants

Human flagged raw numeric `status_code=NNN` and asked to use the `starlette`/`fastapi` named constants
(`status.HTTP_*`). Scope confirmed via question: **all routers** (a queries-only fix would leave a new
cross-file inconsistency). Mechanical sweep over `app/routers/*.py` — **93 sites** across all six routers
(dashboards 13, datasets 20, queries 30, relationships 8, uploads 14, workspaces 8), covering both
`status_code=` assignments (JSONResponse / HTTPException / Response / decorators) and the two
`exc.status_code == 422` comparisons. Added the missing `status` import to `uploads.py` (the only router
that lacked it). Verified the eight constant names resolve in `starlette.status`. Purely cosmetic /
behavior-preserving — **ruff clean · 220 passed** (unchanged). _Note: this touches files outside R106's
queries-only refactor scope; landed only because the human directed it (a one-line `status.HTTP_*`
convention adoption), not a structural change._

### Folded-in consistency pass (human-directed, 2026-06-29) — `_now_iso` dedup

Human flagged `_now_iso` as a refactor candidate. It was byte-identical across **5 routers**
(`relationships`/`datasets`/`workspaces`/`queries`/`dashboards`):
`datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. Moved it to
[`_shared.py`](../../../workspace/apps/backend/app/routers/_shared.py) (the target-2 home) and re-pointed
all 5 importers; dropped the now-dead `from datetime import datetime, timezone` from each router (it was used
only by `_now_iso` — the `datasets.py` `"datetime"` match is a dtype string literal). Same character as the
`status.HTTP_*` pass: a behavior-preserving dedup that fits target 2's "shared helpers get a home" theme.
**ruff clean · 220 passed** (unchanged).

## Check

Verification (2026-06-29):

| Item | Result |
| --- | --- |
| Backend baseline (pre-edit) | **215 passed** |
| `ruff check app/ tests/` | clean |
| Backend suite (post-refactor) | **220 passed** (215 unchanged + 5 new resolver tests) |
| Behavior-preserving | ✅ all 215 pre-existing tests pass unchanged |
| Router→router import smell | ✅ removed (helpers now in `_shared`) |
| **Check (human)** | ✅ **passed** — app-run of save / edit / run / preview, all OK (2026-06-29) |

## Act

**Round complete (2026-06-29).** Human ran the query surfaces (save / edit / run / preview, including the
422 / 409 paths and the stale-join case) and confirmed behavior is identical to pre-R106. Both targets
landed behavior-preserving: cross-router helpers now live in `_shared.py` (router→router import smell gone),
and the create/update/run/preview resolve mechanics are unified behind `_resolve_plan` with its own unit
tests. Folded-in consistency passes (`status.HTTP_*` constants, `_now_iso` dedup) rode along on the same
clean seam. Final: **220 passed · ruff clean**. The flagged single-source workspace-membership check is a
no-op on every reachable input (confirmed by the full integration suite + the live Check).

`values.yaml` (`dashboard_max_rows: 1000`) stays **uncommitted** — a local hands-on test setting, never in
R106's scope.

## Feeds into → Round_107

Features resume on the clean seam. Per the deferred backlog, **fetch-once first** — it wants the unified
`_resolve_plan`/execution path this round established. The grand repository/service layer stays deferred
(default = don't add) until a second in-process consumer (workflow #2) or a persistence swap pulls it.
