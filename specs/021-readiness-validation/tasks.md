# Implementation Tasks: Readiness Validation

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

- [ ] Implement GET /api/v1/workspaces/{workspace_id}/readiness endpoint
- [ ] Add readiness validation service (checks sources, roles, relationships)
- [ ] Generate actionable guidance messages for incomplete workspaces
- [ ] Implement readiness override flag (testing/admin)
- [ ] Build ReadinessGate React component (status display)
- [ ] Build ReadinessGuidance component (next steps)
- [ ] Wire readiness fetch to app state
- [ ] Implement stage gating logic (block query builder until ready)
- [ ] Add manual bypass button (testing mode)
- [ ] Write backend unit tests (readiness checks, guidance)
- [ ] Write builder component tests (gate render, guidance display)
- [ ] E2E tests: incomplete → guidance → complete → unlock
- [ ] Manual acceptance test checklist (test fail and pass scenarios)
