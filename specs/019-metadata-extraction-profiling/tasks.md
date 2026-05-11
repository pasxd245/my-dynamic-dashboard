# Implementation Tasks: Metadata Extraction & Profiling

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

- [ ] Implement GET /api/v1/workspaces/{workspace_id}/profile endpoint
- [ ] Add profile service (query SQLite, compute profiles, return JSON)
- [ ] Implement PATCH /api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override endpoint
- [ ] Add override service (header row, data range, recompute)
- [ ] Build ColumnProfileTable React component
- [ ] Build DataRangeEditor component
- [ ] Build HeaderRowEditor component
- [ ] Wire profile fetch to app state
- [ ] Wire override submission flow
- [ ] Add toast feedback
- [ ] Write backend unit tests (profile, overrides)
- [ ] Write builder component tests (table, editors)
- [ ] E2E tests: profile display, override + recompute
- [ ] Manual acceptance test checklist
