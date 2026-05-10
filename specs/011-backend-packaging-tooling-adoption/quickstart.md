# Quickstart: Validate Backend Packaging/Tooling Migration

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Goal

Verify that `apps/backend` packaging/tooling migration is complete and behavior-neutral.

## Preconditions

- Python 3.12+ available.
- Working tree includes the migration changes for feature 011.
- Commands are run from repository root unless explicitly noted.

## 1. Create Fresh Environment

```bash
cd apps/backend
python -m venv .venv-plan-check
source .venv-plan-check/bin/activate
python -m pip install --upgrade pip
```

Expected result:

- Virtual environment is active.
- No dependency installation has used `requirements.txt`.

## 2. Install From Project Metadata Only

```bash
cd apps/backend
pip install -e .[dev,test]
```

Expected result:

- Install succeeds using `pyproject.toml` metadata.
- Runtime, dev, and test tools install without needing `requirements.txt`.

## 3. Verify Backend Runtime Command Path

```bash
cd apps/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Expected result:

- Backend starts successfully with no packaging-related import errors.

## 4. Verify Test Behavior Parity

```bash
cd apps/backend
pytest tests/ -v
```

Expected result:

- Test outcomes remain consistent with pre-migration baseline.
- No discovery-scope drift from existing backend tests.

## 5. Verify Ruff Baseline

```bash
cd apps/backend
ruff check app
```

Expected result:

- Ruff runs with configured baseline (line length 120; `E/F/B/SIM/I`).
- Any findings reflect code state, not missing config/tool installation.

## 6. Verify Version and Changelog Tooling

```bash
cd apps/backend
cz bump --dry-run
```

Expected result:

- Commitizen resolves next version logic using SCM provider and backend tag format.
- Changelog target is valid (`CHANGELOG.md`).

Optional version visibility check:

```bash
cd apps/backend
python -m app --version
```

Expected result:

- Version is tag-derived when matching backend tags exist.
- Development fallback version remains valid when no matching tag exists.

## 7. Confirm Requirements Retirement

```bash
test ! -f apps/backend/requirements.txt && echo "requirements retired"
rg -n "pip install -r requirements.txt|requirements\.txt" README.md docs scripts devops .github
```

Expected result:

- `apps/backend/requirements.txt` is absent.
- Active backend setup paths no longer require requirements-file install commands.

## 8. Confirm Generated Version Artifact Hygiene

```bash
git status --short
```

Expected result:

- Generated backend version artifact (`apps/backend/app/_version.py`) does not appear as tracked-change noise.

## Rollback Safety

If any verification fails:

- Treat migration as incomplete.
- Keep scope limited to packaging/tooling changes while correcting config or install-path gaps.
- Do not introduce code moves or behavior-affecting refactors while fixing migration parity issues.
