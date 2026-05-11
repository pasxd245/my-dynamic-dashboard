# Research: Structural Audit And Directory Realignment

**Spec**: `/specs/009-structural-audit-and-realignment/spec.md`  
**Plan**: `/specs/009-structural-audit-and-realignment/plan.md`  
**Date**: 2026-05-10

This research resolves the planning decisions for PDCA Round 23 with the user-locked scope preserved: backend-only structural audit and directory realignment, config-manager adoption in scope, service-layer rewrite absorbed into the round, `schemas.py` consolidation in scope, frontend and tooling adoption out of scope, and no intentional public behavior regression.

## 1. Structural Audit Method

### Decision

Use direct repository evidence as the primary audit source for Round 23, with CRG output treated as supplemental rather than authoritative.

### Rationale

- The repo memory recorded a current CRG ingestion gap for `apps/backend/app/models/`, so a CRG-only move plan would be incomplete.
- Direct file, import, and test evidence is sufficient to satisfy FR-001 and SC-001 while keeping the audit reviewable.
- The spec’s “CRG or equivalent” language permits equivalent structural analysis when tooling coverage is incomplete.

### Alternatives considered

- CRG-only community analysis: rejected because current graph coverage does not fully represent the backend package.
- Broad architectural brainstorming without file evidence: rejected because the move plan must be traceable and implementation-ready.

## 2. Current Backend Structure And Target Layout

### Decision

Plan Round 23 against the observed current state:

- Existing top level: `main.py`, `schemas.py`, `core/`, `models/`, `services/`, `utils/`
- Missing target items: `__main__.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`

Converge to the target layout by introducing the missing structure and re-homing modules according to the spec’s ownership rules rather than forcing a full package rename.

### Rationale

- The current package already has viable `core/`, `models/`, `services/`, and `utils/` anchors, so the smallest safe realignment is additive plus selective moves.
- `main.py` is currently overloaded with route wiring, config access, and service imports; this makes it the clearest central surface for splitting API and app orchestration responsibilities.
- The target layout can be reached without changing the repo boundary or involving frontend code.

### Alternatives considered

- Full backend package rename or deeper repo-wide relocation: rejected because the round is locked to backend structural realignment only and must preserve behavior.
- Keeping the current flat app package and only renaming files: rejected because it would not satisfy the target ownership contract.

### Current-to-target move checklist

- [x] Keep `apps/backend/app/main.py` as the FastAPI entry surface, but reduce it to app factory and router wiring.
- [x] Add `apps/backend/app/__main__.py` as the CLI and local-dev entry point.
- [x] Add `apps/backend/app/shared.py` for `AppConfig`, config loading, and shared bootstrap helpers.
- [x] Add `apps/backend/app/resources/default.yaml` as the shipped default configuration source.
- [x] Extract route handlers from `apps/backend/app/main.py` into `apps/backend/app/api/` modules grouped by domain.
- [x] Introduce `apps/backend/app/apps/` orchestrators for upload, workspace, relationship, query, dashboard, and deployment use cases.
- [x] Preserve `apps/backend/app/core/` for framework primitives only; remove remaining direct environment reads from that boundary.
- [x] Preserve `apps/backend/app/utils/` for cross-cutting helpers; keep domain logic out of `utils/`.
- [x] Replace the monolithic `apps/backend/app/schemas.py` ownership model with a package-backed schema surface while keeping a compatibility re-export path during migration.
- [x] Migrate services that still import `app.core.metadata_db` before deleting `apps/backend/app/core/metadata_db.py`.
- [x] Keep `apps/backend/app/models/` in place; no model-package relocation is required for this round.
- [x] Keep frontend directories, builder code, and tooling files out of scope for this round.

## 3. Configuration Manager Adoption

### Decision

Adopt a single configuration path centered on `AppConfig`, `Const`, `Fields`, and `EnvVar`, with layered precedence `.env < app/resources/default.yaml < MDD_CONFIG_FILE`, and ship the defaults inside `apps/backend/app/resources/default.yaml`.

### Rationale

- Current config handling is split between `app/core/config.py` and `app/utils/env_helper.py`, with direct `os.getenv()` usage still present.
- The spec explicitly locks `AppConfig` adoption, packaged defaults, and elimination of bare env reads into this round.
- An in-package `default.yaml` keeps the backend reproducible and consistent with the target pattern described in Round 23 planning notes.

### Alternatives considered

- Leave `core/config.py` as the primary long-term surface: rejected because it still centralizes bare env access and does not satisfy the config-manager adoption requirement.
- Use only environment variables without packaged defaults: rejected because it violates FR-005 and FR-006.

## 4. Service-Layer Rewrite Scope

### Decision

Absorb the service-layer rewrite into Round 23, but execute it incrementally and contract-first: public function signatures, route behavior, and API responses remain fixed while service internals may migrate from raw `sqlite3` patterns toward SQLModel `Session` usage slice by slice.

### Rationale

- The user explicitly locked this into the round, and the spec codifies it in FR-010.
- Current services still rely heavily on `app.core.metadata_db.get_connection()` and in some cases call `init_metadata_db()` directly, so the plan must sequence those conversions before shim removal.
- An incremental slice approach minimizes regression risk and keeps the round testable.

### Alternatives considered

- Defer the rewrite to another round: rejected by the user’s locked scope.
- Rewrite every backend service in one large step: rejected because it raises review and regression risk without adding planning clarity.

## 5. Schema Consolidation Strategy

### Decision

Treat the current monolithic `app/schemas.py` as the consolidation source and split or regroup schema definitions into a clearer schema surface as needed, but preserve all request and response payload shapes consumed by routes and tests.

### Rationale

- `main.py` currently imports a very large DTO surface from `app.schemas`, which is a strong indicator that schema ownership is too centralized.
- The user and spec both put `schemas.py` consolidation in scope, but only under a strict no-contract-regression boundary.
- A contract-preserving reorganization aligns with the target layout and reduces import coupling without changing API behavior.

### Alternatives considered

- Leave `schemas.py` intact and only note future cleanup: rejected because schema consolidation is explicitly in scope.
- Use consolidation as an opportunity to rename or reshape API fields: rejected because public behavior must remain unchanged.

## 6. Metadata Shim Removal Sequence

### Decision

Remove legacy metadata shims only after their remaining dependencies are eliminated in order: stop calling `init_metadata_db()`, remove imports of `metadata_db.py`, then delete `metadata_db.py` itself once grep-based verification is clean.

### Rationale

- Current services such as `audit_service.py`, `backup_service.py`, and `deployment_service.py` still import and call `init_metadata_db()`.
- `query_service.py` and other services still depend on `get_connection()` from `metadata_db.py`, so shim deletion cannot be treated as an early isolated cleanup.
- The spec locks deletion behind import cleanliness, making a staged removal sequence necessary.

### Alternatives considered

- Delete `metadata_db.py` immediately and fix breakages afterward: rejected because it would violate the round’s no-regression and traceability goals.
- Keep `metadata_db.py` indefinitely as a compatibility shim: rejected because FR-013 through FR-015 require complete removal.

### Current dependency evidence

- `apps/backend/app/services/audit_service.py` imports `get_connection` and `init_metadata_db`.
- `apps/backend/app/services/backup_service.py` imports `get_connection` and `init_metadata_db`.
- `apps/backend/app/services/deployment_service.py` imports `get_connection` and `init_metadata_db`.
- `apps/backend/app/services/dashboard_service.py` imports `get_connection`.
- `apps/backend/app/services/query_service.py` contains multiple local imports of `get_connection`.

This confirms the Round 23 deletion gate remains active: `metadata_db.py` is still a removal target, but it cannot be dropped until those imports are eliminated.

## 7. Verification Posture

### Decision

Use existing backend tests as the primary executable guardrail, supplemented by explicit structural, grep-based, and API-contract checks.

### Rationale

- The repo already has a backend pytest suite and the repo memory includes the correct execution environment.
- This round changes structure, imports, config access, and service internals; test coverage must be complemented with explicit layout, env-read, and shim-removal checks.
- The spec requires both behavior preservation and audit evidence, so executable and static verification are both needed.

### Alternatives considered

- Rely on only the existing tests: rejected because tests alone do not prove layout convergence or zero remaining env/shim references.
- Rely on only grep and static review: rejected because structural changes must still be behavior-safe.

## Final Research Outcome

All planning clarifications required for `/speckit.plan` are resolved:

1. Backend-only structural realignment remains the feature boundary.
2. Config-manager adoption, service rewrite, and schema consolidation stay in scope.
3. Frontend and tooling adoption remain out of scope.
4. Metadata shim removal is staged after dependency cleanup.
5. Existing backend behavior and tests remain the controlling release gate.
