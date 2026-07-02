# Round 132: Workflow noun — backend + CRUD

**Status**: Complete
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **DCFBI arc — C+B slice** (D at [Round_131](Round_131.md) + the [workflows design doc](../../design/data-management/workflows/workflows.md); F+I at R137). No UI this round — the noun's first real code.

## Goal

**Inherits from ← [Round_131](Round_131.md)** — build the `wf_` Workflow noun's CRUD (the first real
noun this arc adds): a workspace-scoped entity `{ sources: [qr_…], steps }` that will consolidate +
transform saved queries. This round is create/list/get/delete; run→materialize is R133.

_Track: 1. Pulled by ← R131 (the locked Workflow-noun design). DuckDB-first; reuses the query `Step`
union + `resolve_source` seam — the noun is identity + storage, not a new engine._

## Plan

- [x] `wf_` id pattern (values.yaml + both `.hbs` templates → regenerated constants py/ts).
- [x] `Workflow` SQLModel + `0003_workflows` migration + schema-parity `_LEGACY_SCHEMA`/`_TABLES`.
- [x] Wire models (`WorkflowDefinition`/`Workflow`/`CreateWorkflowBody`) reusing `Step`/`QueryId`/`Column`.
- [x] `routers/workflows.py` CRUD (source-exists validation via direct DB lookup — no router→router coupling).
- [x] Contract: `_shared/workflow.yaml` + post/get/detail-get/delete (steps `$ref` the query union).
- [x] pytest + register router.

## Risks / unknowns

- **First real migration this arc** — additive `workflows` table; schema-parity triple (legacy ==
  models == migrated) re-verified green.
- **Step-vs-columns validation deferred to run (R133)** — create validates sources exist; since the
  output materializes on run (not live), a bad step surfaces there. Noted deviation from R131 AC#1
  (which said validate steps at save) — kept CRUD decoupled from the query engine.
- **Materialized-output columns pre-added** (`output_columns_json` / `materialized_at`, nullable) so
  R133 needs no second migration.

## Do

**Built:** the `wf_` noun end-to-end (config-regen · `Workflow` model · `0003_workflows` migration ·
schema-parity updated · wire models · CRUD router · 5 contract files · router registered). A workflow
= `{ sources: [qr_…], steps }`; create validates each source is a query in-workspace (422), names
unique per workspace (409). No run/materialize yet (R133) — `resolvedColumns`/`materializedAt` stay
absent until then.

**Verification:** backend `pytest` **271 pass** (6 new in `test_workflows.py`: create+contract, list/
get+contract, 404, 409 name_taken, 422 bad-source, delete→404) · schema-parity + generated-constants
green · `ruff` clean · FE contract-validator green (workflow YAMLs dereference; step `$ref`s resolve)
· FE `tsc` clean.

## Check

- [x] Backend 271 (6 new) + no regression; ruff clean; schema-parity triple green.
- [x] CRUD works; source-exists 422; name-unique 409; contracts validate.
- [x] `wf_` id generated in both constants (py + ts); FE contract loader dereferences the new YAMLs.

## Act

**Learnings:**

- **The deferral paid off — the noun is mostly plumbing.** Reusing the `Step` union + `Column` +
  `resolve_source`-style DB lookups, the new noun added *no engine* — id + table + models + CRUD. The
  cost was the noun's *identity/storage* (config-regen, migration, schema-parity), exactly as R131
  predicted.
- **The config-render is template-hard-coded**, not a loop — a new id pattern needs the `.hbs`
  templates edited, not just `values.yaml`. (Caught when the first regen no-op'd.)

**Promotions:** none — applies the R131 design.

**Prune check:** nothing pruned.

## Feeds into → Round_133

The `wf_` entity exists (CRUD). R133 adds `POST /workflows/{id}/run` → resolve the source query,
apply the steps (reuse `run_steps`), **materialize to parquet + capture the output schema**; +
`GET /workflows/{id}/rows` reading the materialized output.
