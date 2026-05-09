# Specification-Driven Development (SDD)

This project uses **Spec-Kit** for feature specification and implementation.

## Workflow

1. **Specify** — Define feature requirements and business questions.
2. **Plan** — Generate implementation phases and technical context.
3. **Tasks** — Decompose into granular, parallelizable tasks.
4. **Implement** — Execute tasks with test-first discipline.
5. **Analyze** — Validate against original requirements.

## Feature artifacts

Each feature lives at `specs/{NUMBER}-{NAME}/` with:

- `spec.md` — Feature specification with user stories and acceptance criteria
- `plan.md` — Implementation phases and architecture decisions
- `tasks.md` — Granular, dependency-ordered task breakdown
- `data-model.md` — Database schema and data contract
- `quickstart.md` — Manual testing guide
- `contracts/*.openapi.yaml` — OpenAPI 3.0.3 REST contracts

## Current specs

| Spec | Title                      | Status      |
| ---- | -------------------------- | ----------- |
| 001  | Upload Profile Field Roles | ✅ Complete |
| 002  | Relationship Rules         | ✅ Complete |
| 003  | Query Builder & Execution  | ✅ Complete |
| 004  | Saved Queries              | ✅ Complete |
| 005  | Dashboard Visualizations   | ✅ Complete |
| 006  | Production Deployment      | ✅ Complete |

User-facing summaries live in [`docs/features/`](../features/).
