# My Dynamic Dashboard

**Version**: MVP 2 | **Status**: Specs 001–006 complete

A data discovery and analytics platform: upload data, profile it, govern multi-table joins, build queries visually, save and version them, and assemble dashboards — built specification-first with [Spec-Kit](docs/development/sdd.md).

## Quick start

```bash
# Backend
cd apps/backend
python -m venv venv && source venv/bin/activate
pip install -e .[dev,test]
python -m uvicorn app.main:app --reload

# Frontend (separate terminal)
cd apps/builder
pnpm install
pnpm run dev
```

- Backend: <http://localhost:8000>
- Frontend: <http://localhost:5173>

Tests:

```bash
cd apps/backend && python -m pytest tests/ -v
```

Full setup, architecture, and tooling notes: [docs/development/setup.md](docs/development/setup.md).

## Documentation

Start at the [Documentation Hub](docs/README.md). It points to feature summaries, ops runbooks, and development guides.

Common entry points:

- [Feature summaries](docs/features/) — one page per spec (001–006)
- [Spec source of truth](specs/) — full specs, plans, tasks, contracts
- [Operations runbooks](docs/operations/) — deployment, rollback, troubleshooting, on-call
- [DevOps compose files](devops/) — local and production container stacks
- [Governance principles](docs/governance.md) — the constitution we enforce

## License & transparency

AI-assisted development (Claude Code, Copilot) was used for scaffolding and iteration. See [docs/governance.md](docs/governance.md).
