# Round 28: Spec 014 - Dashboard (Streamlit) Foundation Audit

**Status**: Planning (drafted ahead of Round 27 close — review-only until Round 27 completes)
**Date started**:
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Bring `apps/dashboard/` (Streamlit + Pandas) into the same layered
structure proven for the backend in Round 23. Because dashboard is
Python, it can **import the backend's config-manager directly** instead
of reinventing — the question is whether to extract the manager to a
shared package now (Decision Gate A) or copy it for one round and
extract later. Retire ad-hoc `os.getenv()` calls, formalize the
component layout, and ensure dashboard runs cleanly against the
post-Round-23 backend API. **Zero new visualization features.**

## Plan

- [ ] Wait for Round 27 Complete
- [ ] CRG audit on `apps/dashboard/src/` (rebuild graph; run
      `list_communities_tool` + `get_hub_nodes_tool`)
- [ ] Decision Gate A: shared-py package now or later? - Option 1 (extract now): create `packages/shared-py/` (or
      similar) containing `env_helper.py`, `shared.py` (AppConfig +
      load_config), `utils/logger.py`. Both `apps/backend/` and
      `apps/dashboard/` install it as a workspace dep. - Option 2 (copy + defer extraction): dashboard gets a copy
      of the relevant modules under `apps/dashboard/src/_shared/`;
      extraction round comes when a third Python app appears. - Recommended: **Option 2** — extracting a shared package is
      a real monorepo concern (uv vs. pip-tools workspace, Python
      package discovery, dual-install in CI). Defer until a third
      app (or until pain demands it). One clean reason to extract
      beats two speculative ones.
- [ ] Decide target dashboard layout. Provisional:
      ` apps/dashboard/
      streamlit_app.py         # entry (existing — keep at top level)
      Dockerfile               # existing
      pyproject.toml           # add (parallel to apps/backend/ in R25)
      src/dashboard/
        __init__.py
        shared.py              # AppConfig + load_config (copy from backend)
        resources/
          default.yaml
        api/                   # HTTP clients (existing — restructure)
          backend_client.py    # was dashboard_api.py
        pages/                 # if multi-page support added
        components/            # existing — review
          dashboard_header.py
          export_controls.py
          parameter_panel.py
          query_panel.py
        core/                  # framework primitives
          base.py              # PanelBase, ChartBase
          errors.py
        utils/
          env_helper.py        # copy from backend
          logger.py            # was app_logging.py
    `

**Decision Gates**:

- Gate A (shared-py extraction): defer. Copy this round; extract
  when the third Python app appears.
- Gate B (pyproject.toml parity): yes — `apps/dashboard/` gets the
  same Round-25 treatment (hatchling + ruff + commitizen,
  tag-pattern `apps/dashboard/v$version`).
- Gate C (test layer): adopt Round 26's three-layer split? Streamlit
  testing is awkward (st.session_state, st.runtime). Locked:
  `tests/unit/` for pure helpers, `tests/integration/` for API
  clients, **no contract tests** (Streamlit isn't an HTTP server we
  control), `tests/perf/` skipped this round.

**External references**:

- `apps/backend/app/shared.py` (Round 23) — copy AppConfig pattern
  into `apps/dashboard/src/dashboard/shared.py`.
- `apps/backend/app/utils/env_helper.py` (Round 22) — copy verbatim.
- `apps/backend/app/utils/logger.py` (Round 23) — copy + adapt for
  Streamlit (existing `app_logging.py` becomes the seed).
- `i18n-tool/core/src/i18n_tools/` — original pattern source.

## Do

(filled by `/speckit.implement` + agent reconciliation)

Provisional task outline:

1. Apply directory layout. Move `streamlit_app.py` imports to use
   `from dashboard.api.backend_client import ...` after moves.
2. Copy `apps/backend/app/utils/env_helper.py` ->
   `apps/dashboard/src/dashboard/utils/env_helper.py`. Update the
   `EnvVar` constants to dashboard-specific names
   (`DASHBOARD_API_BASE_URL`, `DASHBOARD_REFRESH_INTERVAL`, ...).
3. Copy `apps/backend/app/shared.py` -> `apps/dashboard/src/dashboard/shared.py`.
   Adapt: dashboard `Const` / `Fields` / `AppConfig` reflect dashboard
   concerns (no `metadata_db_path`; instead `api_base_url`,
   `refresh_cadence`, `default_chart_type`).
4. Copy `apps/backend/app/utils/logger.py` ->
   `apps/dashboard/src/dashboard/utils/logger.py`. Replace
   `app_logging.py::configure_dashboard_logging` with the shared
   logger.
5. Replace every `os.getenv()` call in `apps/dashboard/`. The
   `validate_dashboard_environment()` function in `streamlit_app.py`
   is the largest offender; rewrite to use `AppConfig` + `EnvVar`.
   `grep -rn "os.getenv\|os.environ" apps/dashboard/` returns zero
   hits.
6. Create `apps/dashboard/src/dashboard/resources/default.yaml`
   with sections `app`, `log`, `api`, `dashboard`, `panels`. Move
   any hard-coded defaults from components into this file.
7. Add `apps/dashboard/pyproject.toml` mirroring Round-25's backend
   template:
   - `[project]` name `mdd-dashboard`, deps from existing
     `requirements.txt` (streamlit, pandas, plotly, requests, ...).
   - `[tool.hatch.version]` tag-pattern `apps/dashboard/v$version`.
   - Same ruff / commitizen / coverage config.
   - Delete `apps/dashboard/requirements.txt` after parity.
8. Update `apps/dashboard/Dockerfile` to install via `pip install -e .`
   instead of `pip install -r requirements.txt`.
9. Add `apps/dashboard/tests/` with the three-layer split
   (`unit/`, `integration/`); migrate any existing dashboard tests.
10. Update [apps/dashboard/README.md](apps/dashboard/README.md) with
    new layout, config precedence, and dev-run instructions.

Scope OUT:

- New chart types, new panel kinds, multi-page navigation.
- Auth / multi-user (analysis/08 forbids it pre-MVP-2 evidence).
- Shared-py package extraction (Gate A: deferred).
- Visual redesign.

## Check

- [ ] `cd apps/dashboard && pip install -e .[dev,test]` installs cleanly
- [ ] `streamlit run streamlit_app.py` boots cleanly; smoke flow
      (load saved query -> render panel -> export) works against the
      running backend
- [ ] `grep -rn "os.getenv\|os.environ" apps/dashboard/` returns zero
      hits
- [ ] `apps/dashboard/requirements.txt` no longer exists; Dockerfile
      installs from `pyproject.toml`
- [ ] `apps/dashboard/Dockerfile` builds and the resulting image runs
      identically to current
- [ ] CRG community map shows tighter, name-aligned communities for
      `apps/dashboard/`; cross-community edges to `apps/backend/` are
      via `api/backend_client.py` only
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ : "dashboard config + structure parity with backend"
      — when the third Python app appears, this triggers shared-py
      extraction
- [ ] -> skills/ :

## Questions for user before Round 29

1. Did copying the config-manager twice (backend + dashboard) feel
   bad enough to extract `packages/shared-py/` now, or hold the line?
2. Streamlit testing layer — was the unit/integration split workable,
   or is Streamlit too stateful for clean unit tests?
3. Are there any user-visible regressions vs. the Round-21 end-state
   that need fixing before the Round 29 evaluation walkthrough?

**Round transition**:

- On Complete: foundation chain (Rounds 22-28) is closed. Round 29
  is an evaluation round (mirrors Round 20) — full end-to-end
  MVP-1 demo, CRG before/after diff, colleague walkthrough,
  Round-30 candidate selection. **No feature work until Round 30.**
  Draft already prepared at `.agents/plan/cycles/Round_29.md`.
