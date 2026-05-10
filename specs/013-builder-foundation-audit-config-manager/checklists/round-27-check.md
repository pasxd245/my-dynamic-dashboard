# Round 27 Check Evidence — Spec 013

**Date**: 2026-05-11  
**Phase**: Check (in progress — state consolidation still pending)

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
| JS raw  | 335.61 kB        | 287.63 kB       | **-47.98 kB (-14.3%)** |
| JS gzip | 101.61 kB        | 86.95 kB        | **-14.66 kB (-14.4%)** |

**Result**: ✅ Bundle shrunk (i18next + react-i18next removed per Gate D retire decision)

---

## 6. Vitest pass count

```bash
$ pnpm --filter builder test
Test Files  2 passed (2)
     Tests  12 passed (12)
```

**Breakdown**:

- `config/__tests__/appConfig.test.ts`: 7 tests (T020-T025 coverage)
  - Layer 1 (build-time env): 1 test
  - Layer 2 (runtime fetch override): 1 test
  - Layer 2 (network failure fallback): 2 tests
  - Layer 3 (localStorage override): 1 test
  - `all()` source attribution: 1 test
  - init() idempotency: 1 test
- `pages/__tests__/BuilderWorkflowPage.test.tsx`: 5 tests (converted from exported functions to Vitest format)

**Result**: ✅ All 12 tests pass, zero failures

---

## 7. CRG community re-audit

**Status**: Deferred — CRG `list_communities_tool` requires MCP setup (T041).

**Manual observation**: Directory structure significantly cleaner post-Round 27:

- `config/` community is new and self-contained (AppConfig, Fields, Const, index)
- `api/hooks/` community is new and bounded (4 domain hook files)
- `state/` has clear index.ts export boundary

---

## Open Items (deferred to next PDCA pass)

| Task                               | Status   | Reason                                           |
| ---------------------------------- | -------- | ------------------------------------------------ |
| T027 (queryBuilderStore)           | Deferred | Requires zustand installation + App.tsx refactor |
| T028 (savedQueryStore)             | Deferred | Requires zustand installation + page refactor    |
| T030 (useState count verification) | Deferred | Depends on T027/T028 completion                  |
| T038 (retire util collisions)      | Deferred | Requires CRG tool                                |
| T041 (CRG re-audit)                | Deferred | Requires CRG tool setup                          |

---

## Summary

- **Phase 0 (Audit)**: ✅ Complete (8/8 tasks)
- **Phase 1 (Layout)**: ✅ Complete (3/3 tasks)
- **Phase 2 (AppConfig)**: ✅ Complete (8/8 tasks — including workspaceApi + queryApi URL migration)
- **Phase 3 (Tests)**: ✅ Complete (6/6 tasks)
- **Phase 4 (State)**: ⏳ 1/5 done (T026 done; T027-T030 deferred)
- **Phase 5 (API Layer)**: ✅ Complete (5/5 tasks — T031-T035)
- **Phase 6 (i18n)**: ✅ Complete (2/2 tasks — T036 removed i18n/, T037 README)
- **Phase 7 (Verify)**: ⏳ 2/4 done (T039-T040 done; T038, T041 deferred)
- **Phase 8 (Docs)**: ✅ Complete (3/3 tasks — T042 README, T043 setup.md, T044 this file)

**Tasks complete**: 34/38 (89%)
