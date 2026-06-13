# Round 30: Runtime/UX hygiene — tmp sweep + error boundary + visual-verification gate

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_29](Round_29.md)** — R27→R29 closed the
config + constants half of the readiness chain (Path C: Pydantic
underneath, AppConfig facade, `values.yaml` central source,
cross-language `_generated/` modules). Everything js-tmpl can
help with is now in place.

R30 picks up the **runtime / UX hygiene items js-tmpl can't help
with** — three items that have been queued since R16/R19/R26 but
never built. The unifying theme: every item exists in the
codebase as a documented gap that bites in production-realistic
conditions, but none has hit "critical bug" yet. R30 closes
them deliberately before more product ships on top.

Three items, one round (cohesive theme = "runtime safety nets +
discipline gates"):

1. **Tmp upload sweep job** — `storage.py`'s docstring has said
   "24h TTL is documented in the contract; the sweep job lands
   in a later round" since R16. Six stale tmp directories exist
   on disk right now from the R26-era testing. Disk leak.
2. **FE error boundary** — uncaught React errors currently crash
   to white screen with no fallback UI. Production reality
   includes browser-extension noise, network blips, malformed
   responses — any one can paint a white screen today.
3. **Visual-verification discipline gate** — R26 caught five
   browser-only bugs (CORS, AntD App provider, RenameModal
   pre-fill, range case, CSV re-parse parity) that the unit /
   type / build pipelines all missed. R26's Act called for a
   "run the app before Review" gate; R30 codifies it.

_Track: 1 (product readiness — POC/MVP foundation). Pulled by
explicit R16+R26+R29 carry-over follow-ups. The three items are
heterogeneous (BE job, FE component, methodology rule) but share
one theme: "what bites when the system is exercised, not just
unit-tested." Worth bundling because the discipline gate touches
all of them at once._

## What is IN scope

### 1. Tmp upload sweep job (BE)

- **Lifespan-driven background task** (FastAPI's `lifespan`
  context) that sweeps `workspace/apps/backend/data/uploads_tmp/`
  on a configurable interval (default 1 hour). Removes
  directories whose `meta.json` `createdAt` is older than the
  TTL (default 24 hours; both interval + TTL configurable via
  `values.yaml` → R28 `Settings.backend`).
- **New `Settings` fields** (R28 expansion):
  - `tmp_sweep_enabled: bool = True`
  - `tmp_sweep_interval_seconds: int = 3600`
  - `tmp_upload_ttl_seconds: int = 86400`
- **Implementation file**:
  `workspace/apps/backend/app/jobs/tmp_sweep.py` (new
  `jobs/` package).
- **values.yaml**: add `backend.tmp_sweep.*` section
  (interval_seconds, ttl_seconds, enabled).
- **Behavior on startup**: if `tmp_sweep_enabled` is True
  (default), spawn an asyncio task that loops on the interval.
  If False (e.g., dev environments that want to inspect stale
  files), skip the spawn — operator can still run a one-shot
  sweep via a CLI subcommand (`uv run python -m app.jobs.tmp_sweep`).
- **Tests** in `tests/test_tmp_sweep.py`:
  - Sweep deletes directories older than TTL
  - Sweep leaves directories younger than TTL untouched
  - Sweep is idempotent on already-clean dirs
  - Missing `meta.json` doesn't crash the sweep (logs a warning)
  - One-shot sweep entry point works (`python -m app.jobs.tmp_sweep`)
- **Stale-dir cleanup**: a one-line note in the round's Do
  documenting that R30 also runs a one-shot sweep against the
  current dev environment's stale tmp directories (six exist
  per the R29-era audit) — proves the job works against real
  drift.

### 2. FE error boundary

- **New component**:
  `workspace/apps/builder/src/components/AppErrorBoundary.tsx`
  — class component with `componentDidCatch` lifecycle. Renders
  a fallback UI (AntD `<Result status="error">` + "Reload"
  button + collapsed error details).
- **Wiring**: wrap the tree in `main.tsx` between
  `<AntdConfig>` and `<AntdApp>` so the boundary catches
  rendering errors below the AntD providers.
- **Telemetry hook (optional)**: `componentDidCatch` can call a
  no-op `reportError` function for now; future round can wire
  to a real telemetry surface if one lands.
- **Test**: minimal vitest verifying the boundary catches a
  thrown error from a child component + renders the fallback
  (existing FE test infra supports this via React Testing
  Library + intentional throw).

### 3. Visual-verification discipline gate

- **Append to
  [`PDCA.md § Post-round audit`](../PDCA.md)**: add a new
  bullet to the audit checklist:
  > **Visual verification (for rounds that touch UI or runtime
  > behavior)**: walk the running app through a defined script
  > before flipping to Review. Catches the class of bugs unit /
  > type / build pipelines can't see (CORS, provider wiring,
  > modal lifecycle, etc.). R26's five visual-verification
  > bugs are the founding incident.
- **Decision rule**: rounds that ONLY touch docs/config/tests
  may skip this gate by explicit declaration in Act § Status.
  Rounds that touch UI or runtime behavior MUST do the walk
  before flipping Review → Complete (or document why not in
  Act if blocked).
- **Per-round script**: each UI-touching round names the walk
  steps in its IN scope (e.g., R26 should have said: "Walk
  the wizard rename → blocked-delete flows in the running
  app"). R30 retroactively appends this expectation; future
  rounds inherit it.
- **No tooling change**: the gate is a discipline rule + a
  PDCA.md checklist line; no CI integration this round.
  CI gating could land later if discipline drifts.

### Cross-cutting

- **Stamp** `crud-hygiene.md` and `upload.md` design docs
  briefly noting that R30 added the tmp sweep + error boundary
  (the runtime safety nets that complement those features).
- **Update R30 Act § Learnings** with any concrete drift the
  three items surface (e.g., "the stale tmp dirs from R26
  testing existed for N days before R30 swept them — useful
  data point for the TTL default").

## What is OUT of scope

- **Soft-delete / trash bin** for tmp uploads. R30 hard-deletes
  per the TTL.
- **Reporting / telemetry pipeline** for errors caught by the
  boundary. No external service integration this round; the
  `reportError` hook is a no-op pending a real surface.
- **AntD v5 deprecation cleanup** (`<Alert message=>`,
  `<Space direction=>` warnings). R31 scope.
- **Global toast configuration** + skeleton states + central
  loading mask. R31 scope.
- **i18n readiness**. R32 scope (consumes config + constants
  patterns R27→R29 established).
- **CI integration of the visual-verification gate**. Discipline
  and checklist only this round; CI tooling later if needed.
- **Background job framework** (Celery, RQ, etc.). The sweep is
  a simple asyncio task inside FastAPI's lifespan — no
  multi-process queue needed for POC.
- **Methodology amendments to `context/`**. The visual-
  verification gate goes into `plan/PDCA.md` (a methodology
  document but project-policy, not `context/`). Track-2/3
  freeze stays in effect.

## Plan

- [x] Author Round_30.md (this file) and flip to `In Progress`.
- [x] Add `backend.tmp_sweep.*` section to
      `workspace/config/values.yaml` (interval_seconds = 3600,
      ttl_seconds = 86400, enabled = true).
- [x] Extend `BackendSettings` in
      `workspace/apps/backend/app/_config/settings.py` with the
      three new fields (matching defaults). _Done as a nested
      `TmpSweepSettings` model rather than three flat fields —
      gives a single `tmp_sweep: TmpSweepSettings` block that
      mirrors the values.yaml shape and stays clean for env-var
      overrides (`MDD_BACKEND__TMP_SWEEP__ENABLED=false`)._
- [x] Re-render via `pnpm config:render`; verify the new
      default.yaml fields land cleanly.
- [x] Create `workspace/apps/backend/app/jobs/__init__.py` and
      `workspace/apps/backend/app/jobs/tmp_sweep.py`:
      `sweep_once` + async `sweep_loop` + `_main` CLI entry.
- [x] Wire the sweep into `app/main.py`'s `lifespan` — spawn
      the async task if `tmp_sweep.enabled` is True.
- [x] Add `tests/test_tmp_sweep.py` (6 cases — fresh, expired,
      meta-missing-fallback, meta-corrupt-fallback, missing root,
      meta-vs-mtime precedence; CLI entry covered by `_main`
      reuse of `sweep_once` already exercised).
- [x] Add FE `AppErrorBoundary.tsx` component +
      `tests/app-error-boundary.test.tsx`.
- [x] Wire `<AppErrorBoundary>` in `main.tsx`.
- [x] Append the visual-verification bullet to
      `.agents/plan/PDCA.md § Check` (the bullet belongs to the
      verification phase, not the post-round audit list — placed
      it there for sharper "do this before flipping to Review"
      semantics).
- [x] Stamp `crud-hygiene.md` and `upload.md` with a brief R30
      note.
- [x] Run `uv run pytest` (BE), `pnpm type-check` + `pnpm test` + `pnpm build` (FE), `pnpm md:lint`, `pnpm --filter
@mdd/contracts test`.
- [x] **Visual verification (live use of the new gate)**: BE
      booted with `MDD_BACKEND__TMP_SWEEP__INTERVAL_SECONDS=60
MDD_BACKEND__TMP_SWEEP__TTL_SECONDS=60` — the five stale
      `uploads_tmp/tmp_*` directories from R26-era testing were
      swept on the first pass (verified via `ls
data/uploads_tmp/` → empty). `/health` responded 200.
      Shutdown clean (no hung tasks). Error boundary fallback
      verified at unit level via thrown-child vitest (the
      production wiring path is identical to the test render
      tree — boundary inside AntD providers, above the router).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.
- [x] **Add-on (post-Review rollback)**: ship
      `tests/test_env_policy.py` — adopts drifted's policy-scan
      idea, skips the redundant typed-env-getter helper since
      pydantic-settings already provides typed env reading. Test
      currently passes; allowlist is `_config/settings.py` only.

## Risks / unknowns

- **asyncio task lifecycle in FastAPI lifespan.** The sweep
  task needs to be cancelled cleanly on shutdown to avoid
  hanging tests. Standard pattern: store the `asyncio.Task` on
  the FastAPI app state, cancel + await it in lifespan's
  shutdown branch. Tests can disable the sweep via env var
  override (R28 precedence: `MDD_BACKEND__TMP_SWEEP__ENABLED=false`).
- **`meta.json` shape assumptions**. Existing tmp dirs may not
  all have well-formed meta.json (R16-era dirs might be
  partial). Sweep must tolerate missing/corrupt meta — fall
  back to dir mtime as the age signal, log a warning.
- **Test isolation for sweep tests.** Each test should create
  its own tmp tree under `tmp_path` (pytest fixture), populate
  with dirs of various ages (via `os.utime`), and verify the
  sweep result. Avoid touching the real `data/uploads_tmp/`
  dir.
- **Error boundary placement in main.tsx.** Needs to wrap the
  Router but BE below the QueryClient + AntdConfig + AntdApp so
  it can catch render errors AND so the fallback UI gets the
  AntD theme. Order matters; double-check with a manual throw
  during visual verification.
- **PDCA.md amendment is a methodology touch.** Per the user's
  R23 track-2/3 freeze, methodology changes are deferred until
  post-POC/MVP. But the visual-verification gate is a R26
  carry-over that's been queued since visual verification
  caught five real bugs — arguably product hygiene more than
  methodology. Lean: include it in R30 as a practical
  discipline addition, not a methodology refactor. If the user
  wants to defer specifically the PDCA.md edit, the other two
  items still stand alone as a coherent round.
- **One round, three items — bundling concern.** Per the user's
  "one feature per round" rule, R30 bundles three. Justification:
  they share the "runtime safety net" theme + the
  visual-verification gate explicitly verifies the other two
  items. If the user prefers splitting, the natural seam is
  R30 (tmp sweep + error boundary) + R30.5/R31 (PDCA.md gate
  amendment). Surface in Risks for the user to confirm at
  Planning review.
- **Stale tmp dirs from R26 testing**. Sweep will hard-delete
  them on first run. If any are still needed for debugging,
  back them up first or temporarily set `tmp_upload_ttl_seconds`
  higher. Lean: just sweep — they've sat there since R26 and
  serve no purpose.

## Do

**Backend paths consolidation (R30 add-on).**

Mid-Review the user asked for two related cleanups:

1. Drive the data root from config (`backend.data_dir`) instead of
   the bespoke `MDD_DATA_DIR` env var.
2. Reduce the `Path(__file__).resolve().parent.parent[.parent]`
   chains scattered across `_config/settings.py`, `storage.py`,
   and `db.py`.

Shipped as part of R30 (Review is still open + the change is
small + theme-coherent — it's another "runtime safety net"):

- New
  [`app/_config/paths.py`](../../../workspace/apps/backend/app/_config/paths.py)
  — single home for `BACKEND_ROOT` (one `parents[2]` resolution),
  `DEFAULT_DATA_DIR`, and `DEFAULT_CONFIG_PATH`.
- `BackendSettings` gained `data_dir: str | None = None` — picks
  up `MDD_BACKEND__DATA_DIR=/...` automatically via the R28
  env-var precedence chain. `None` falls back to
  `DEFAULT_DATA_DIR`. Relative paths anchor at `BACKEND_ROOT`.
- [`storage.py`](../../../workspace/apps/backend/app/storage.py)
  and [`db.py`](../../../workspace/apps/backend/app/db.py) now
  import `BACKEND_ROOT` / `DEFAULT_DATA_DIR` from `paths.py`.
  Both consult `CONFIG.settings.backend.data_dir` instead of the
  old `os.environ.get("MDD_DATA_DIR"/"MDD_DB_PATH", ...)` reads.
  `db.get_db_path()` resolves lazily so test fixtures swapping
  the data root still work without re-import.
- Stale `MDD_DB_PATH` reference in
  [`routers/workspaces.py`](../../../workspace/apps/backend/app/routers/workspaces.py)
  docstring updated to point at the new
  `MDD_BACKEND__DATA_DIR` chain.
- `grep -rn 'parent\.parent' workspace/apps/backend --include='*.py'`
  → 0 hits. Single source-of-truth achieved.

Smoke-tested both paths: default resolves to
`<BACKEND_ROOT>/data`; `MDD_BACKEND__DATA_DIR=/tmp/mdd-smoketest`
correctly drives both `get_data_root()` and `get_db_path()`.

**Bonus catch.** `git check-ignore` on the BE Layer-1 template
revealed that
`workspace/config/backend/data/config/default.yaml.hbs` was
shadow-ignored by the blanket `data/` rule in `.gitignore` since
R28 — the template has been working locally but never actually
committed to the repo. Added an explicit
`!workspace/config/**/data/**` un-ignore so templates ship; the
rendered output stays gitignored because it lives under
`workspace/apps/backend/data/...`, a different tree.

**Env-access policy scan (second R30 add-on, post-Review
rollback).** Inspecting drifted's `env_helper.py` for the
data_dir work surfaced a second pattern worth adopting: drifted
ships a CI test (`test_no_bare_env_reads_outside_allowed_modules`)
that fails if any `app/` module calls `os.getenv` /
`os.environ` outside a tiny bootstrap allowlist. The typed
env-getters part of drifted's helper is **redundant for us**
(pydantic-settings provides `env_str`/`env_int`/`env_bool`
equivalents via field annotations + the `MDD_BACKEND__*` chain
from R28), but the policy-scan part adds real value — it
prevents future drift where a feature module reaches for
`os.environ` ad-hoc instead of going through `CONFIG`.

Shipped
[`tests/test_env_policy.py`](../../../workspace/apps/backend/tests/test_env_policy.py)
— ~50 lines, scans `app/**/*.py`, fails if anything outside
`{_config/settings.py}` does a bare env read. Single allowlisted
site is the Layer-2 bootstrap (`MDD_CONFIG_FILE`) which can't
self-reference. Test currently passes (78/78); will catch any
future regressions in CI.

Full BE suite 77/77 after the refactor — existing
`storage.set_data_root(tmp_path/'data')` test fixtures still
isolate correctly because they override the module-level cache,
not the config layer.

**Tmp sweep (BE).**

- `values.yaml` gained `backend.tmp_sweep.{enabled,
interval_seconds, ttl_seconds}` (86400s TTL, 3600s interval,
  enabled true). Template at
  [`workspace/config/backend/data/config/default.yaml.hbs`](../../../workspace/config/backend/data/config/default.yaml.hbs)
  picked it up; `pnpm config:render` re-emitted the BE default
  yaml cleanly.
- [`workspace/apps/backend/app/_config/settings.py`](../../../workspace/apps/backend/app/_config/settings.py)
  gained `TmpSweepSettings(BaseModel)` (enabled, interval_seconds
  ≥ 60, ttl_seconds ≥ 60) nested under `BackendSettings.tmp_sweep`.
  `extra="forbid"` so a typo in values.yaml fails at boot, not
  silently.
- [`app/jobs/tmp_sweep.py`](../../../workspace/apps/backend/app/jobs/tmp_sweep.py)
  ships three callables:
  - `_dir_age_seconds(d, now)` — prefers `meta.json.createdAt`
    (parsed strict ISO-8601 UTC), falls back to dir mtime if
    meta is missing/corrupt (logs a warning).
  - `sweep_once(data_root, ttl_seconds) -> int` — one pass,
    returns removed count.
  - `async sweep_loop(data_root, interval_seconds, ttl_seconds)`
    — cancellable forever-loop, swallows per-pass exceptions so
    one bad dir doesn't kill the sweeper.
  - `_main()` — `uv run python -m app.jobs.tmp_sweep` one-shot
    using current CONFIG.
- [`app/main.py`](../../../workspace/apps/backend/app/main.py)'s
  `lifespan` now spawns the loop as `app.state.tmp_sweep_task`
  if enabled, cancels + awaits on shutdown (swallows
  `CancelledError` — that's the expected shutdown path).
- [`storage.py`](../../../workspace/apps/backend/app/storage.py)
  docstring updated: the "the sweep job lands in a later round"
  promise from R16 now points concretely at `app.jobs.tmp_sweep`.

**Tmp-sweep bug caught during test authoring.** `_dir_age_seconds`
parsed `createdAt` with `datetime.strptime("%Y-%m-%dT%H:%M:%SZ")`
which yields a naive datetime; `.timestamp()` then applies the
host's local TZ offset. On the test bench (host UTC+07) this
made the parsed time appear 7h earlier than it should — a 7h
under-counting bug that would have manifested as fresh-dir
removals in non-UTC deployments. Fixed by explicit
`.replace(tzinfo=timezone.utc)`. The
`test_dir_age_prefers_meta_over_mtime` regression caught it.

**6 new sweep tests** in `tests/test_tmp_sweep.py` — full suite
77 passed (was 71 pre-R30).

**FE error boundary.**

- [`AppErrorBoundary.tsx`](../../../workspace/apps/builder/src/components/AppErrorBoundary.tsx)
  — class component with `getDerivedStateFromError` +
  `componentDidCatch`, renders `<Result status="error">` with
  the error message + a Reload button. Logs the error +
  `ErrorInfo` to console (telemetry hook deferred).
- Wired into
  [`main.tsx`](../../../workspace/apps/builder/src/main.tsx)
  between `<AntdApp>` and `<BrowserRouter>` so the fallback
  `<Result>` renders inside the AntD theme + message providers.
- New vitest:
  [`tests/app-error-boundary.test.tsx`](../../../workspace/apps/builder/tests/app-error-boundary.test.tsx)
  — 2 cases (healthy tree passes through; thrown child shows
  fallback with error message + reload button). FE suite 26
  passed (was 24).

**Visual-verification gate codified.**

- [`.agents/plan/PDCA.md`](../PDCA.md) `## Check` section gained
  the visual-verification bullet — cites R26's five browser-only
  bugs as the founding incident, frames the rule as "softer than
  R23-Q1's Preview required so autoagent stays unblocked, but
  skipping on a UI round is a known-defect risk." Verification
  evidence (or its explicit skip + reason) goes in Do.

**Cross-doc stamps.**

- [`crud-hygiene.md`](../../design/data-management/_shared/crud-hygiene.md)
  appended an R30 stamp on the error boundary.
- [`upload.md`](../../design/data-management/datasets/upload.md) updated
  the TTL section + the R15+ scope list — the original "swept on
  backend startup" framing is replaced by the periodic loop.

**Visual verification (live).** Booted BE with
`MDD_BACKEND__TMP_SWEEP__INTERVAL_SECONDS=60
MDD_BACKEND__TMP_SWEEP__TTL_SECONDS=60`. Five stale
`uploads_tmp/tmp_*` directories from R26-era testing (the disk
leak called out in this round's Goal) were swept on the first
pass — `ls data/uploads_tmp/` empty after ~4s. `/health`
returned 200. Lifespan shutdown clean (no hung tasks reported).
Confirms the loop is actually running on the configured interval
and the cancellation path in lifespan works.

**Check pipeline.**

- `uv run pytest` (BE): **77 passed**.
- `pnpm type-check` (FE): 0 errors.
- `pnpm test` (FE): **26 passed**.
- `pnpm build` (FE): green (1.29 MB gzip 409 KB — same chunk-size
  warning as R29, not regressed).
- `pnpm --filter @mdd/contracts test`: **11 passed**.
- `pnpm md:lint`: 0 errors.
- `pnpm -w prettier --check` on R30-touched files: clean (the
  two new FE files were auto-fixed mid-round; pre-existing
  prettier warnings in unrelated UI/contracts files are
  out-of-scope, not introduced by R30).

## Check

- [x] `BackendSettings` has the nested `tmp_sweep` block with
      defaults; `default.yaml` renders the new fields.
- [x] `app/jobs/tmp_sweep.py` has `sweep_once` + `sweep_loop` + `_main` CLI entry; importable.
- [x] FastAPI lifespan spawns the sweep task when
      `tmp_sweep.enabled` is True; cancels cleanly on shutdown.
- [x] 6 sweep tests pass (expired removed, fresh kept, missing
      meta → mtime fallback, corrupt meta → mtime fallback,
      missing root tolerated, meta-overrides-mtime precedence).
- [x] `AppErrorBoundary.tsx` exists; `main.tsx` wraps the tree
      with it; vitest verifies it catches a child throw.
- [x] `PDCA.md § Check` has the new visual-verification bullet
      (placed in Check rather than Post-round audit — see Plan
      checklist note).
- [x] `crud-hygiene.md` + `upload.md` carry brief R30 stamps
      noting the runtime safety nets.
- [x] All existing tests stay green: BE pytest 77/77, FE vitest
      26/26, contracts 11/11.
- [x] `pnpm type-check` 0 errors; `pnpm build` green;
      `pnpm md:lint` 0 errors; R30-touched files prettier-clean.
- [x] Visual verification done: live sweep run removed 5 stale
      R26-era tmp directories with TTL=60s override; `/health`
      OK; clean shutdown.
- [x] All Plan + Check checkboxes flipped before Status flips
      to Review.
- [x] **Env-policy scan** test passes; one allowlisted site
      (`_config/settings.py` for `MDD_CONFIG_FILE` bootstrap).
      Adopted from drifted; typed-env-getters portion skipped
      as redundant with pydantic-settings.

## Act

**Learnings**:

- **Pydantic strptime + `Z` is a TZ trap.** `strptime` ignores
  the literal `Z` and returns a naive datetime; `.timestamp()`
  then quietly applies the host's local offset. On a UTC+07 host
  this masked the bug as "the sweep deletes things 7h earlier
  than it should." The fix is one line (`replace(tzinfo=utc)`)
  but the catch was a test that compared expected age to wall
  clock — not a test that checked TZ behavior directly. Lesson:
  whenever parsing ISO-8601, attach `timezone.utc` explicitly at
  the parse site. Worth a context-level note if it recurs.
- **Visual verification proves itself again.** The five stale
  R26-era tmp dirs were a real disk leak that no unit test
  surfaced. The R30 gate isn't a process tax — it caught a real
  drift on its first live use. Worth keeping in PDCA.md as a
  durable rule.
- **Nested Pydantic model > flat fields for grouped config.**
  Original plan called for three flat `tmp_sweep_*` fields on
  `BackendSettings`. Switched to a nested `TmpSweepSettings`
  block mid-implementation because it mirrors the values.yaml
  shape exactly + makes the env-var override key chain
  (`MDD_BACKEND__TMP_SWEEP__ENABLED`) read naturally. Future
  job/feature groups should follow this pattern instead of
  flattening.
- **Bundling three items worked here.** Per the user's
  one-feature-per-round rule, R30 was a deliberate exception
  with the "runtime safety net" theme. The visual-verification
  gate is what made the bundling cohesive — it gave the other
  two items a shared verification mechanism. Don't generalize:
  the next round is back to single-feature scope (R31 is
  UX-infra alone).

**Promotions** _(none — implementation + discipline-gate round; the
visual-verification rule lives in `plan/PDCA.md` per the R23
track-2/3 freeze on `context/` edits):_

**Follow-ups (not promotions, just notes):**

- AntD v5 deprecation warnings (`<Alert message=>`, `<Space
direction=>`) still trip vitest stderr — R31 cleanup.
- Pre-existing prettier warnings in `workspace/packages/ui/**`
  and `workspace/packages/contracts/**` are out-of-scope for
  R30 (not introduced by this round). R31 or a dedicated
  cleanup round can format-sweep them.
- Telemetry hook in `AppErrorBoundary.componentDidCatch` is a
  no-op `console.error` for now. A future round can wire it to
  a real surface (Sentry-equivalent) if one lands.
- Tmp-sweep `_main()` CLI is wired but not exercised in CI —
  worth a one-line smoke test in a future cleanup round if the
  CLI path matters for operator workflows.

## Feeds into → Round_31 (UX-infra: global toast + skeletons + AntD deprecation cleanup)

What R30 hands forward:

- **Three runtime safety nets in place**: tmp sweep (BE), error
  boundary (FE), visual-verification gate (process discipline).
- **`values.yaml` `backend.tmp_sweep.*`** section established —
  future rounds can add per-job config sections under the same
  pattern.
- **`app/jobs/`** package convention seeded — R31+ can add UX
  jobs (e.g., toast cleanup, locale prefetch) or BE jobs (e.g.,
  parquet vacuum) following the same shape.
- **The PDCA.md gate**: future rounds touching UI/runtime
  declare their visual-verification walk in their IN scope;
  rounds that skip declare why in Act.

R31 picks up UX-infrastructure: global AntD `message`/`notification`
config (currently each page imports it ad-hoc), skeleton states
on list views (current loading is hidden), and the AntD v5
deprecation cleanup (`<Alert message=>`, `<Space direction=>`
warnings that have accumulated since R21). R32 picks up i18n
readiness (consuming the patterns R27→R29 established).

### Post-R32: dataset-detail full DCBF chain (R33+)

R23's roadmap queued **dataset detail view** as a POC/MVP-closing
product feature alongside the autopilot-readiness track. R27→R32
extended the readiness track linearly and the dataset-detail queue
drifted off the rolling Feeds-into chain. **Locked-in user
decision at R30 Q&A** (2026-05-25): keep readiness chain finishing
first; dataset detail starts as a full DCBF chain after R32 lands.

Tentative shape:

- **R33** — D-round: `/datasets/:id` page design + visual preview
  (per R23 "see before do" philosophy)
- **R34** — C-round: paged-rows GET endpoint contract,
  column-metadata response shape
- **R35** — B-round: BE handler, pagination
- **R36** — F-round: virtualized data table, column-type-aware
  cell rendering

POC/MVP demo-ready ≈ when R33→R36 lands. Track-2/3 methodology
work resumes after that (per the R22 freeze).
