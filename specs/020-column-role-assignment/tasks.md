# Implementation Tasks: Column Role Assignment

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Task List

- [ ] Implement PUT /api/v1/workspaces/{workspace_id}/columns/{column_id}/roles endpoint
- [ ] Add role validation service (allowed roles, type compatibility)
- [ ] Add role override reason capture + storage
- [ ] Build RoleAssignmentPanel React component
- [ ] Build RoleSelector dropdown component
- [ ] Build RoleOverrideForm component
- [ ] Build ValidationSummary component (warnings, guidance)
- [ ] Wire role assignment state + submission flow
- [ ] Add toast feedback
- [ ] Implement validation logic (at least one identity_key, type checks)
- [ ] Write backend unit tests (role validation, persistence)
- [ ] Write builder component tests (panel, selector, override form)
- [ ] E2E tests: assign roles, validate, override
- [ ] Manual acceptance test checklist
