# Quickstart: Validate Dashboard Streamlit Foundation Audit

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Goal

Validate dashboard-only structural/configuration governance refactor with zero production feature additions.

## Preconditions

- Run from repository root unless stated otherwise.
- Python 3.12+ is available.
- Backend service is reachable for dashboard smoke checks.
- Feature 014 implementation changes are present.

## 1. Install Dashboard Package and Tooling

```bash
cd apps/dashboard
pip install -e .[dev,test]
```

Expected result:

- Dashboard installs from `pyproject.toml` metadata.
- Dev/test tooling dependencies resolve cleanly.

## 2. Validate Canonical Dashboard Test Layers

```bash
cd apps/dashboard
test -d tests/unit && test -d tests/integration
```

Expected result:

- Only unit/integration layers are present for this round.

## 3. Run Dashboard Unit and Integration Suites

```bash
cd apps/dashboard
pytest tests/unit -q
pytest tests/integration -q
```

Expected result:

- Both suites pass independently.
- Failures are triaged by layer without cross-layer ambiguity.

## 4. Enforce Environment Access Governance

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
rg -n "os\.getenv|os\.environ" apps/dashboard
```

Expected result:

- Zero matches in dashboard runtime modules outside approved config-manager surfaces.
- Any match blocks completion.

## 5. Validate Streamlit Startup and Smoke Behavior

```bash
cd apps/dashboard
streamlit run streamlit_app.py --server.headless true
```

Expected result:

- App boots successfully.
- Existing dashboard flows remain behaviorally equivalent.
- No new user-facing capabilities are introduced.

## 6. Validate Docker Package Install Path

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
docker build -f apps/dashboard/Dockerfile -t mdd-dashboard:spec014 .
```

Expected result:

- Image build succeeds with package-based install path.
- Build does not rely on legacy requirements-only install flow.

## 7. Confirm Scope Guardrail

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
git diff --name-only
```

Expected result:

- Changes are confined to `apps/dashboard/**`, `specs/014-dashboard-streamlit-foundation-audit/**`, and required dashboard-related documentation updates.
- No backend production feature changes are present.

## Failure Handling

If any check fails:

- Treat feature as incomplete.
- Fix governance/layout/tooling defects without adding new dashboard features.
- Re-run checks 3 through 7 before accepting completion.
