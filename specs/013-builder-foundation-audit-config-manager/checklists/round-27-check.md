# Round 27 Check Evidence — Spec 013

**Date**: 2026-05-11  
**Phase**: Check (completed)

---

## 1. Zero `import.meta.env` reads outside `config/`

```bash
$ grep -rn "import.meta.env" apps/builder/src/ | grep -v "config/appConfig.ts"
[no output — PASS]
```

**Result**: ✅ Zero hits

---

## 2. Zero hardcoded `const API_BASE` strings

```bash
$ grep -rn "const API_BASE" apps/builder/src/
[no output — PASS]
```

**Result**: ✅ Zero hits — all four api modules use `appConfig.apiBaseUrl()`

---

## 3. Zero raw `fetch()` in components/pages/App.tsx

```bash
$ grep -rn "fetch(" apps/builder/src/components/ apps/builder/src/pages/ apps/builder/src/App.tsx
[no output — PASS]
```

**Result**: ✅ Gate B confirmed — all fetch calls in `api/` layer only

---

## 4. Build warnings count

```bash
$ pnpm --filter builder build
✓ built in 1.27s   [0 warnings]
```

**Result**: ✅ Zero warnings

---

## 5. Bundle size before vs. after

| Metric  | Phase 0 baseline | Round 27 result | Change                 |
| ------- | ---------------- | --------------- | ---------------------- |
| JS raw  | 335.61 kB        | 290.12 kB       | **-45.49 kB (-13.6%)** |
| JS gzip | 101.61 kB        | 87.72 kB        | **-13.89 kB (-13.7%)** |

**Result**: ✅ Bundle reduced from baseline

---

## 6. Vitest pass count

```bash
$ pnpm --filter builder test
Test Files  2 passed (2)
     Tests  12 passed (12)
```

**Breakdown**:

- `config/__tests__/appConfig.test.ts`: 7 tests (T020-T025 coverage)
- `pages/__tests__/BuilderWorkflowPage.test.tsx`: 5 tests

**Result**: ✅ All 12 tests pass, zero failures

---

## 7. CRG community re-audit

**Status**: Completed

**Command**:

```bash
$ bash scripts/crg apps apps --build
==> apps root: /home/ubuntu/pf/my-dynamic-dashboard/apps
---- builder ----
  build: builder
INFO: Progress: 209/209 files parsed
Full build: 209 files, 1336 nodes, 9491 edges (postprocess=none)
```

**Observation**:

- `config/` community is self-contained (AppConfig, Fields, Const, index)
- `api/hooks/` community is bounded (4 domain hook files)
- `state/` has clear export boundary with dedicated stores

---

## 8. State consolidation verification (T030)

```bash
$ rg -n "useState\(" apps/builder/src/components apps/builder/src/pages apps/builder/src/App.tsx | wc -l
0
```

**Result**: ✅ State consolidation target met for T030 scope.

---

## 9. Round 21 workflow smoke

```bash
$ pnpm dev:builder:smoke:stub
[builder-workflow-smoke] status=passed first_failed_stage=none
```

**Result**: ✅ Upload -> validate query -> saved query flow passes in deterministic smoke mode.

---

## 10. Dev server startup (NFR-001)

```bash
$ pnpm --filter builder dev
VITE v7.3.3 ready in 166 ms
Local: http://localhost:3000/
```

**Result**: ✅ Dev server starts cleanly and serves local endpoint.

---

## Summary

- **Phase 0 (Audit)**: ✅ Complete (8/8 tasks)
- **Phase 1 (Layout)**: ✅ Complete (3/3 tasks)
- **Phase 2 (AppConfig)**: ✅ Complete (8/8 tasks)
- **Phase 3 (Tests)**: ✅ Complete (6/6 tasks)
- **Phase 4 (State)**: ✅ Complete (5/5 tasks)
- **Phase 5 (API Layer)**: ✅ Complete (5/5 tasks)
- **Phase 6 (i18n)**: ✅ Complete (2/2 tasks)
- **Phase 7 (Verify)**: ✅ Complete (4/4 tasks)
- **Phase 8 (Docs)**: ✅ Complete (3/3 tasks)

**Tasks complete**: 44/44 (100%)
