# Round 09: Saved Queries & Dashboard Foundation

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 2
**DoD tasks**: 9.1–9.7

## Goal

Query configs can be saved from the builder and loaded in a Streamlit
dashboard. Report consumers can run pre-built queries without touching
the builder.

## Plan

- [ ] Add `query_configs` table to SQLite (name, description, config JSON, timestamps)
- [ ] Create CRUD endpoints: `POST/GET/PUT/DELETE /api/v1/configs`
- [ ] Add "Save Query" button to builder query page → name/describe modal → save
- [ ] Create `apps/dashboard` with Streamlit entry point
- [ ] Dashboard fetches saved queries from backend API
- [ ] User selects a query, clicks run, sees results table
- [ ] Excel/CSV export buttons in dashboard

## Do

_Progress log — update as work proceeds._

## Check

- [ ] Query config persists in SQLite and appears in GET list
- [ ] Builder "Save Query" works end-to-end
- [ ] Streamlit app starts and shows saved queries
- [ ] Running a saved query displays correct results
- [ ] Export from dashboard produces valid files
- [ ] User runs their weekly report from the dashboard

## Act

## **Learnings**

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
