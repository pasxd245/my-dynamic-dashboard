# Scope Guardrail (T034)

## Review command

- `git diff --name-only`
- `git status --short`

## Guardrail

- Spec 012 allows only backend tests/tooling/docs changes plus spec and governance artifacts required for PDCA/Spec-Kit execution.

## Result

- Changed files are confined to:
  - backend test/tooling/docs surfaces (`apps/backend/tests/**`, `apps/backend/pyproject.toml`, `apps/backend/pytest.ini`, `docs/development/setup.md`)
  - Spec 012 artifacts (`specs/012-test-scaffolding-and-mvp1-performance-harness/**`)
  - PDCA/governance pointers (`.agents/plan/cycles/Round_26.md`, `.github/copilot-instructions.md`, `.specify/feature.json`)
- No production runtime modules under `apps/backend/app/**` were modified in this round.
