# Quickstart: Upload + Profile + Field Roles (MVP 1)

## Goal

Verify end-to-end MVP 1 behavior for upload parsing, profile quality, role assignment compatibility, readiness, and manifest reproducibility.

## Prerequisites

- Python virtual environment with backend dependencies installed.
- Node + pnpm available for builder.
- Run from repository root.

## 1. Start backend

```bash
cd apps/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl -s http://localhost:8000/api/health
```

Expected:

```json
{ "status": "ok" }
```

## 2. Start builder

```bash
cd apps/builder
pnpm install
pnpm dev
```

Open builder at <http://localhost:3000>.

## 3. Upload and parse files (Story 1)

- Create a workspace in the builder.
- Upload sample `.xlsx` and `.csv` files.
- Confirm each sheet shows detected header row, effective data range, and inferred column types.
- Override one sheet header row and verify only that sheet recomputes.

## 4. Review quality profile (Story 2)

- Open per-column profile panel.
- Verify null ratio, distinct count, top-K values, and warning list are visible.
- Use a dataset with mixed-type and duplicate examples; verify warnings are rendered.
- For oversized input, verify profile is marked as sampled and includes sample size + seed.

## 5. Assign field roles (Story 3)

- Assign `measure` to a numeric column and confirm accepted.
- Attempt assigning `time_anchor` to non-date column and confirm rejection.
- Attempt assigning `identity_key` to low-uniqueness column and verify override reason is required.
- Refresh page and verify assignments persist.

## 6. Verify readiness indicator (Story 3)

- Confirm readiness is `false` when required roles are missing.
- Assign at least one `identity_key`, `time_anchor`, `measure`, and `source_of_truth_outcome` with no unresolved critical warnings.
- Confirm readiness is `true` and surface role remains exploration/workbench.

## 7. Export and import manifest (Story 4)

- Export manifest for workspace.
- Re-import manifest with identical files and verify schema/profile/roles match.
- Re-import with modified file contents and confirm hash mismatch blocks reconstruction.

## 8. Verification commands

Backend tests (when added in implementation phase):

```bash
cd apps/backend
pytest
```

Builder smoke build:

```bash
cd apps/builder
pnpm build
```

## Exit Criteria

- FR-001 to FR-013 pass for manual and automated checks.
- SC-001 through SC-005 validated on bundled sample workspace.
- No recommendation language appears in MVP 1 surfaces.
