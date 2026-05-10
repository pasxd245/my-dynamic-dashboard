# Layout Contract Checklist (Spec 009)

## Frozen Move Sequence

- [x] Keep `apps/backend/app/main.py` as FastAPI entry and route registration hub during transition.
- [x] Add `apps/backend/app/__main__.py` as stable CLI/local entrypoint wrapper.
- [x] Add `apps/backend/app/shared.py` for unified config and shared bootstrap surfaces.
- [x] Introduce `apps/backend/app/api/` modules for domain route extraction.
- [x] Introduce `apps/backend/app/apps/` modules for use-case orchestration.
- [x] Preserve `apps/backend/app/core/` for framework/runtime primitives only.
- [x] Preserve `apps/backend/app/services/` public behavior while internals migrate.
- [x] Preserve `apps/backend/app/models/` location in this round.
- [x] Keep frontend and tooling changes out of scope.

## Verification Commands

```bash
find apps/backend/app -maxdepth 2 -type f | sort
```

```bash
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests/integration/test_backend_layout_realignment.py -q
```

## Approval

- [x] Structural move sequence reviewed and accepted.

## Current Slice Evidence

- Added the agreed scaffold targets under `app/__main__.py`, `app/shared.py`, `app/api/`, `app/apps/`, and `app/resources/default.yaml`.
- Focused layout regression check passed on 2026-05-10: `2 passed` in `test_backend_layout_realignment.py`.
