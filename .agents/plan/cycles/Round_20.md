# Round 20: Feature Experience & Feedback

**Status**: Complete
**Date started**: 2026-05-09
**Date completed**: 2026-05-09

**Governance**: Exploratory PDCA (Bring-up → Experience → Feedback → Design Gate)

---

## Goal

Bring up all three apps (backend, builder UI, dashboard) in dev mode, experience the current feature set end-to-end, and collect structured feedback that drives Round 21 UX/design scope.

**Why now**: Specs 001–006 are all implemented. Before designing Round 21 (builder UX), we need ground truth on what works, what feels broken, and what's missing — not assumptions.

---

## Plan

- [x] Confirm backend Python deps installed (fastapi, uvicorn, polars, duckdb)
- [x] Confirm builder Node deps installed (vite, react, tanstack-query)
- [x] Confirm Streamlit dashboard deps installed
- [x] Identify dev startup commands for all three apps
- [x] Define feedback collection scope (upload → profile → query → save → visualize)

**Decision Gates**: none — this is an exploratory round. No new feature is introduced — only feedback collection, plus trivial bug fixes that unblock the experience.

**Risks & Unknowns**:

- Builder `App.tsx` is a single-page form, not a routed multi-page app — experience may feel rough
- CORS or `VITE_API_BASE_URL` env may need a quick `.env.local` fix to connect builder → backend
- Streamlit dashboard needs `DASHBOARD_API_BASE_URL` env pointing to local backend

---

## Do

### Dev server startup commands

**Recommended path — all three apps**

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
pnpm dev:docker:up
```

**Alternative local path — all three apps**

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
pnpm dev:local:up
```

The local helper starts the backend on `:8000`, builder on `:3000`, and
dashboard on `:8501`, and writes logs under `tmp/dev/`.

**Manual path — Backend (FastAPI :8000)**

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
source .venv/bin/activate
PYTHONPATH=apps/backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Manual path — Builder UI (Vite :3000)**

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard/apps/builder
pnpm dev
```

**Manual path — Dashboard (Streamlit :8501)**

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
source .venv/bin/activate
cd apps/dashboard
DASHBOARD_API_BASE_URL=http://localhost:8000 streamlit run streamlit_app.py
```

### Experience checklist (fill in during testing)

| Flow                                   | Expected | Actual | Notes                                                                                                                  |
| -------------------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Backend `/health` responds             | ✅       | ✅     |                                                                                                                        |
| Backend `/docs` (Swagger) reachable    | ✅       | ✅     |                                                                                                                        |
| Builder loads in browser               | ✅       | ✅     |                                                                                                                        |
| Upload Parquet/Excel file              | ✅       | ✅     |                                                                                                                        |
| Profile columns visible                | ✅       | ❌     | Some columns appear, but not the uploaded Excel columns; likely stale/default workspace state.                         |
| Assign column roles                    | ✅       | ❌     | Blocked by the profile/column mismatch above.                                                                          |
| Build a query (select cols + filter)   | ✅       | ❌     | Columns are not loaded properly, so the builder falls back to meaningless defaults.                                    |
| Execute query → preview results        | ✅       | ⚠️     | Request completes, but result is empty due to invalid/default query inputs.                                            |
| Save query                             | ✅       | ✅     |                                                                                                                        |
| Load saved query                       | ✅       | ❌     | Loading produces `Schema Changes Detected` because the saved query cannot reconcile with the current workspace schema. |
| Dashboard loads                        | ✅       | ⚠️     | App loads successfully, but data surface is empty.                                                                     |
| Dashboard shows query results / charts | ✅       | ❌     | Empty because upstream query/profile state is not valid.                                                               |

### Do log

- Round 20 was exercised through the intended integration path:
  backend health/docs, builder upload/profile/roles/query/save/load, and
  dashboard load/chart surfaces.
- No server crashes were observed during the session.
- The experience did not pass end-to-end: upload and basic runtime wiring
  worked, but profile/column state did not reflect the uploaded Excel source,
  which cascaded into role assignment, query building, saved-query loading,
  and dashboard result/chart failures.
- Resulting judgment: close Round 20 as an exploratory feedback round, not as
  feature acceptance. Round 21 must harden the experience before deeper
  multi-source or multi-sheet work.

---

## Check

- [x] All 12 experience checklist items filled in
- [x] Feedback notes written in Act below
- [x] No server crashes during testing session
- [x] Root-cause hypothesis identified (workspace state binding)

---

## Act

### Learnings

- The fastest stable developer path was Docker-first (`pnpm dev:docker:up`) with one-command lifecycle helpers; mixed local+docker runs created port and process confusion.
- Several failures were integration-surface issues (proxy/routing/timeouts/config), not business-logic bugs. E2E smoke coverage should catch these before manual testing.
- The current builder UX is feature-rich but operationally "debug-like" (single long page, weak state visibility) and needs a workflow-first information architecture.
- Error payloads existed but user feedback was low-context at interaction points; inline status + toast-style feedback is needed for confidence.
- Upload/profile/query/dashboard behavior is connected, but the visible data
  state is not trustworthy enough yet: stale/default workspace references and
  weak active-source visibility can make successful API calls produce invalid
  user outcomes.

### Feedback for Round 21 Design

**Design reference artifact**

- Initial layout/moodboard captured at `docs/design/Layout_A.png` (at repo-root).
- Treat Layout A as a moodboard for visual tone only. The builder shell still
  needs its own workflow-first information architecture, not a dashboard-style
  layout copied directly from the reference.

**What worked**

- Backend contract endpoints are broadly functional once runtime wiring is correct.
- CSV and Excel ingestion path is working for non-empty files.
- Query validation/saved-query flows are available, but Round 20 exposed that
  they can be exercised against stale/default workspace state and produce
  misleading results.

**What felt broken / high-friction during Round 20**

1. Connectivity and environment mismatches were detected late (runtime clicks), not preflight.
2. Builder proxy defaults were missing for API forwarding/body size/timeouts, causing 405/413/504 failures.
3. Builder used stale/default workspace references in some paths, causing 404 failures.
4. Saved Query page refetch loop caused repeated API calls.
5. Upload action feedback was too subtle; users perceived "nothing happened".
6. Profile/column state did not clearly bind to the uploaded Excel source,
   causing role assignment, query building, saved-query loading, and dashboard
   charts to fail downstream.

**Gaps in error experience**

- Technical API errors were visible but not always meaningful/actionable in-place.
- Empty Excel upload now reports `empty_sheet`, but similar structured guidance should be standardized across user actions.

**Data-source capability observations**

- CSV support is present but not clearly communicated in UX.
- Excel multi-sheet workflows remain underpowered: users need explicit per-sheet preview/select/skip decisions.
- Multi-source workspace behavior needs stronger source registry UX (active source, status, processing result).
- Active workspace/source selection must be explicit everywhere; hidden
  fallback IDs are now a known product risk, not just an implementation detail.

**Fixes completed during Round 20 (evidence of learning)**

- Added unified dev stack script and package commands for local/docker startup/stop/status.
- Added builder Nginx API proxy config and increased body size/timeouts for upload/processing workloads.
- Hardened backend path resolution for container layout.
- Replaced some hardcoded workspace defaults in query validation paths; remaining
  saved-query builder routes still need explicit workspace handling in Round 21.
- Stabilized Saved Query search callback to stop repeated list API calls.
- Improved upload UX with inline status/disabled states.
- Hardened Excel parsing with engine fallback and installed `fastexcel`; added explicit `empty_sheet` error.

### Next-round decision

**Round 21 (selected): Spec 007 — Builder Experience Hardening + Workflow Shell**

1. Add connectivity preflight and persistent connection status.
2. Introduce meaningful user-facing error system (toast + actionable guidance + optional technical details).
3. Redesign builder shell to a workflow-oriented layout (upload/source, schema/sheet, query, results/saved views), using `docs/design/Layout_A.png` (at repo-root) as baseline moodboard.
4. Add lightweight E2E smoke (docker) for create workspace → upload → validate query → list saved queries.
5. Remove hidden/default workspace fallbacks from builder routes and make active
   workspace/source state visible before query or saved-query actions run.

**Round 22 (proposed follow-on): Multi-source + Multi-sheet Orchestration**

1. Multi-sheet Excel picker with preview and include/skip controls.
2. Source registry per workspace with active source selection and processing history.
3. Per-sheet processing feedback and recoverable partial failures.

**Compaction note**: Creating Round 21 triggers the configured compaction
review point. Because several earlier rounds are `Deferred` or `Superseded`,
human curation is required before compacting rounds 01-20.

- [ ] Human curation of Rounds 01–20 before compaction (blocks Round 21 kickoff? or parallel?)

---

## Promotions

- [ ] → context/ : None yet — Round 20 produced project-local feedback, not a stable reusable rule.
- [ ] → skills/ : None yet — defer until Round 21 validates a repeatable UX hardening workflow.
