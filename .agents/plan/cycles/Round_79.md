# Round 79: `datasetId → sourceId` rename cleanup — finish the R76 widening

**Status**: **Complete** — all gates green (D → C → B → F → I) and **human-signed-off**
on the real backend (create/edit/delete both source kinds + dataset-delete cascade + `pnpm dev:seed`).
**Date started**: 2026-06-16
**Date completed**: 2026-06-16
**Flow**: **DCFBI** (set at the Design gate via `flow-selector` — no-UI/refactor branch, 0/5
conditions; recorded in the Do log). Unlike R78, this round **re-opens the wire contract** (the
query schema's source-of-record field) and touches **BE + FE**, so it is a full feature-flow
round — gates **D → C → B → F → I** (F1/F2 skipped on DCFBI). It is also the **first real feature
migration on the R78 foundation** — a backfill + column drop shipped as an Alembic revision.

## Goal

R76 designed a **rename** `datasetId → sourceId` (unify a Query's driving source — a `ds_`
dataset or a `qr_` query — under one polymorphic field) but the build chose an **additive
widening** instead: `sourceId` landed as an *optional* field alongside the still-required
`datasetId`, so FE and BE stayed conformance-green incrementally (the F1-precedes-Contract
ordering and the deviation from the designed rename were both flagged at [Round_76](Round_76.md)).
The legacy `datasetId` has carried back-compat ever since, with the rename named as **its own
cleanup round "once all queries carry `sourceId`."**

R79 is that round. It **completes the rename**: `sourceId` becomes the single canonical
driving-source field across the **DB, contract, backend, and FE**, and the legacy `datasetId`
is retired. The trigger ("all queries carry `sourceId`") is satisfied by **backfilling**
`source_id = dataset_id` for the dataset-rooted queries that currently store `NULL` (NULL today
means "source is `dataset_id`").

_Track: 1 (product data-model hygiene). Pulled by ← the named R76/R77 deferral
([round-roadmap-deferrals](../../memory/2026-05-22-round-roadmap-deferrals.md)); chosen over the
canvas theme for R79 because the canvas's own "until the hop-list stops scaling" trigger has not
clearly fired, while this cleanup is well-bounded, removes real debt, and **exercises the R78
migration foundation on its first live feature change** (a backfill + a SQLite column drop via the
`render_as_batch=True` we configured in R78)._

## Judgment calls

### Ratified at the Plan gate (2026-06-16)

| #   | Question        | Resolution                                                                                                                                                                                                                                                                                                            |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J-0 | **Round topic** | **Complete the `datasetId → sourceId` rename** (ratified). `sourceId` (pattern `^(ds_\|qr_)[0-9a-f]{8}$`) becomes the **required, canonical** driving-source field; the legacy `datasetId` is **retired** from the contract, BE, and FE; the DB backfills `source_id` from `dataset_id` and the round ships as an Alembic revision. The R78 foundation makes the DB change a versioned migration, not a hand edit. |

### Resolved at the Design gate (2026-06-16)

| #   | Question                                          | Resolution                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-1 | **Preserve the dataset-delete → query cascade** (the central catch) | **Resolved → app-level cascade in the dataset-delete handler.** Grounding: [datasets.py](../../../workspace/apps/backend/app/routers/datasets.py) `delete_dataset` does **only** `DELETE FROM datasets WHERE id = ?` — the query cleanup is 100% the DB FK. Since `source_id` is **polymorphic** (`ds_`/`qr_`), a DB FK can't express it, so the cascade **must** move to the app: the handler also runs `DELETE FROM queries WHERE source_id = <ds_id>` (same connection, `PRAGMA foreign_keys=ON` already set). **Exactly one level**, matching today's FK precisely — a `qr_` query built on a now-deleted `ds_`-query is left dangling exactly as today (no new transitive cascade; the resolver already handles a missing source). Considered + rejected: a SQLite `AFTER DELETE` trigger (works, but app-level is testable and all dataset deletes funnel through this handler — workspace-delete 409s while datasets exist). Existing dataset-delete tests are the guard. |
| J-2 | **DB change shape + does the ORM port ride along** | **Resolved.** One Alembic revision `0002_*`, ordered: **(1)** backfill `UPDATE queries SET source_id = dataset_id WHERE source_id IS NULL`; **(2)** `batch_alter_table` → drop `idx_queries_dataset_id`, drop the `dataset_id` column (+ its FK), and **set `source_id` NOT NULL**. SQLite needs batch mode — **already enabled** by R78's `render_as_batch=True`. **ORM port stays OUT** (confirmed lean): the queries router keeps its raw SQL, just reading `source_id` instead of `dataset_id or source_id`; the 71-site port remains R78's separate incremental deferral. The R78 schema-parity test updates to the new schema (drops `dataset_id`, `source_id` NOT NULL). |

## Plan (by gate)

1. **Plan gate** — ratify J-0; record J-1/J-2 held open. Commit the round file (Plan seam). _(This step.)_
2. **Design gate** — resolve J-1 (cascade preservation) + J-2 (migration shape; ORM port in/out);
   restate the contract delta (`sourceId` required, `datasetId` removed) and the FE call-site
   change; update the query design docs + `_shared/query.yaml` intent. Run `flow-selector`.
   `ui-design` is **N/A** unless a visible surface changes (a field-id rename should be
   UX-invisible — confirm at Design).
3. **Contract gate (C)** — edit `_shared/query.yaml` + the queries `{post, put, get, detail-get,
   preview}` contracts: `sourceId` required, `datasetId` removed. Regenerate/realign. This is a
   **breaking** contract change — both FE and BE conform to the new shape within the round.
4. **Backend gate** — the Alembic revision (backfill + drop `dataset_id`, J-2) + the cascade
   preservation (J-1); queries router uses `source_id` only; the R78 **schema-parity test** and
   `create_all()` path updated to the new schema. pytest green; dual conformance against the
   **new** contract.
5. **FE gate** — builder create/edit query flows send/read `sourceId` (drop `datasetId`); MSW
   fixtures + FE conformance updated to the new contract.
6. **Integration** — end-to-end create/edit/delete a query (dataset-rooted **and** query-rooted);
   confirm the dataset-delete cascade still removes dataset-rooted queries.

## Acceptance criteria

+ [ ] **J-0 ratified**; **J-1, J-2 resolved** at the Design gate.
+ [ ] **Contract**: `sourceId` is **required** and canonical across the query contracts;
      **`datasetId` is removed**; OpenAPI regenerated; dual conformance green against the new shape.
+ [ ] **DB migration** (Alembic revision on the R78 foundation): backfills `source_id` from
      `dataset_id`, then drops `dataset_id` (batch mode); the R78 schema-parity test reflects the
      new schema; **fresh + existing seeded DBs migrate without data loss**.
+ [ ] **Dataset-delete → query cascade preserved** (J-1): deleting a dataset still removes its
      dataset-rooted queries; existing delete tests stay green.
+ [ ] **BE + FE** use `sourceId` only; no `datasetId` references remain in app code or fixtures.
+ [ ] **Tests green**: backend pytest + FE conformance; per-gate commits (revert seams).
+ [ ] Gates green: `plan:lint` 0, `markdown-check-link` 0, `markdownlint` 0; `flow-selector` +
      `gate-walker` run/recorded. **Complete = human-signed-off** (create/edit/delete a query of
      both source kinds in the real app; dataset-delete cascade verified; `pnpm dev:seed` works).

## What is OUT of scope

+ **The raw-SQL → ORM data-access port** (queries router and the other 70 sites) — stays
  incremental (R78 deferral); this round renames a field, it does not rewrite the data layer.
+ **A `qr_` on the RIGHT of a join hop** (generalize `rel_` endpoints) — deferred (own trigger).
+ **The free-form visual join canvas / standalone "New query"** — the canvas theme, deferred
  until its trigger ([query-builder.md](../../design/data-management/queries/queries.md) —
  built right, not MVP-rushed).
+ **Any new query capability** — this is a rename + backfill, behaviour-preserving for the user.

## Risks / unknowns

+ **Lost cascade (J-1).** The headline risk — see J-1. _Mitigation: resolve cascade preservation
  at Design before touching the schema; keep the dataset-delete tests as the guard._
+ **Breaking contract mid-round.** A hard rename breaks FE **and** BE conformance until both are
  updated — exactly why R76 widened additively. _Mitigation: the DCFBI gate ordering (C → B → F → I)
  updates each layer within one round; commit per gate so a half-renamed state is never the tip._
+ **Backfill correctness.** Any query with `source_id IS NULL` must map to its `dataset_id`;
  a missed row would carry a null canonical source. _Mitigation: the migration backfills in-place
  and a test asserts zero `NULL` `source_id` post-migration on a seeded DB._
+ **`pattern` mismatch.** `sourceId` requires `^(ds_|qr_)…`; the backfilled `dataset_id` values
  are `ds_…`, which satisfy it — confirm no legacy id violates the pattern.

## Do

### Plan-gate ratification (2026-06-16)

+ **J-0 → complete the rename** — `sourceId` canonical/required, `datasetId` retired across DB +
  contract + BE + FE; DB change ships as an Alembic revision (first real feature migration on R78).
+ **J-1 → cascade preservation** held open for Design (the central catch — `dataset_id`'s
  `ON DELETE CASCADE` must not be silently lost when the column is dropped).
+ **J-2 → migration shape + ORM-port boundary** held open for Design (lean: rename only; ORM port
  stays a separate incremental call).
+ **Topic chosen over canvas** for R79 — canvas trigger unfired; this cleanup is bounded, removes
  named debt, and is a real first exercise of the R78 migration path.

### Design-gate close (2026-06-16)

+ **J-1, J-2 resolved** (see the table above): app-level cascade in the dataset-delete handler;
  one ordered Alembic `0002_*` revision (backfill → drop `dataset_id` + index, set `source_id`
  NOT NULL); ORM port stays out.
+ **Contract delta** (for the C gate): in `_shared/query.yaml` + queries `{post, put, get,
  detail-get, preview}` — `sourceId` becomes **required** (pattern `^(ds_|qr_)[0-9a-f]{8}$`),
  `datasetId` **removed** from request bodies and the `Query` response `required` list.
+ **BE delta** (B gate): `delete_dataset` adds the app-level query cascade; the queries router
  reads `source_id` (drop the `or dataset_id` fallback + the `body.datasetId` create path);
  schema-parity test updated.
+ **FE delta** (F gate): builder create/edit flows send/read `sourceId` only; MSW fixtures
  updated to the new contract.
+ **Model check** (Design gate). **Noun-vs-mode:** mode of an existing surface — no new noun; a
  wire-field rename on the existing Query noun + builder surfaces, mode unchanged.
+ **Discovered-vs-imposed:** evidence found, independent of this design — this *completes* R76's
  already-shipped polymorphic `sourceId` model; the canonical value is **derived from existing
  data** (`source_id` backfilled from `dataset_id`), not imposed anew.
+ **`ui-design` → N/A** — a field-id rename is **UX-invisible** (no surface, copy, or affordance
  changes); the design-spec facet review does not apply.

### Contract-gate close (2026-06-16)

+ **Contract delta landed** — `sourceId` (pattern `^(ds_|qr_)[0-9a-f]{8}$`) is now
  **required + canonical** and `datasetId` is **removed** across `_shared/query.yaml`
  (the `Query` response: removed from `required` + properties) and the request bodies of
  `queries/{post, preview}`; the `{get, detail-get, put}` response examples now carry
  `sourceId`. Companion `.md` rationale docs (`post`, `preview`) updated to the new shape.
+ **No codegen step** — the contract YAMLs *are* the OpenAPI (validated by
  `packages/contracts/tests/openapi-validity.test.ts`, 24/24 green); FE/BE hand-mirror them,
  so "OpenAPI regenerated" = the YAML edits above. `put` carries `{ definition }` only (no
  source field in its request), so its request body is unchanged.
+ **Expected red after this seam**: BE pytest + FE conformance now fail against the new
  required shape until the **B** and **F** gates make each layer conform — exactly the
  DCFBI C → B → F ordering (commit per gate; the contract is the locked source-of-record).

### Backend-gate close (2026-06-16)

+ **Migration** — new revision `0002_query_source_id` (down_revision `0001_baseline`): (1) backfills
  `UPDATE queries SET source_id = dataset_id WHERE source_id IS NULL`; (2) batch-recreates `queries`
  dropping `idx_queries_dataset_id` + the `dataset_id` column (+ its FK) and setting `source_id`
  NOT NULL. **`copy_from`** gives batch the exact pre-R79 table — SQLite reflection silently drops
  the unnamed `name` CHECK and downgrades the `workspace_id` FK `ON DELETE` to NO ACTION, so we
  recreate from an explicit table, not reflection (caught by the parity test).
+ **`db_models.Query`** — `dataset_id` (col + FK + `idx_queries_dataset_id`) retired; `source_id`
  now `nullable=False`. **`models/common.py`** — `Query.sourceId` / `CreateQueryBody.sourceId` /
  `PreviewQueryBody.sourceId` are now required (no `Optional`); `datasetId` removed everywhere.
+ **Queries router** — reads `source_id` only (dropped every `… or dataset_id` fallback + the
  `body.datasetId` create/preview paths); a bare dataset source 422s on `["body","sourceId"]`.
+ **Cascade (J-1)** — `delete_dataset` now runs `DELETE FROM queries WHERE source_id = ?` before
  deleting the dataset (same connection, FK pragma on); exactly one level. The existing
  `test_deleting_source_dataset_cascades_queries_away` is the guard (now exercises the app cascade,
  not the dropped FK).
+ **Schema-parity test (J-2)** — `_LEGACY_SCHEMA` advanced to the head shape (no `dataset_id`,
  `source_id` NOT NULL); a new `_PRE_R79_SCHEMA` + seeded query drives
  `test_existing_db_adopted_without_data_loss` through 0002 and **asserts the backfill** (zero NULL
  `source_id`, `dataset_id` column gone, head = `0002_query_source_id`).
+ **Test-DB ↔ migration seam** — `create_all_for_tests()` now also **stamps head** (it's the
  `upgrade head` equivalent): a models-built DB is current, so the app lifespan's
  `run_startup_migrations()` takes the versioned no-op branch instead of mis-adopting it as a
  pre-Alembic baseline DB and replaying 0002 (which assumes the dropped `dataset_id`).
+ **Green**: 196 pytest pass; `ruff check` clean; dual conformance against the new contract
  (`validate_response` on the queries endpoints).

### FE-gate close (2026-06-16)

+ **Types** — `Query.sourceId` / `CreateQueryRequest.sourceId` / `PreviewQueryRequest.sourceId`
  are now required; `datasetId` removed from all three (mirrors the contract).
+ **Wire calls** — the preview hook sends `{ sourceId, definition }` (driving source = the
  builder's `baseSourceId`, a `ds_` or `qr_`); "Save filters as Query" (DatasetDetailPage),
  "Join with related" (JoinWithRelatedModal), and "Build on this query" (create mode) all POST
  `{ name, sourceId, definition }`. MSW fixtures + create handler carry `sourceId` only.
+ **Reads** — QueryDetailPage resolves a source **Dataset** only when `sourceId` is a `ds_`;
  a composed (`qr_`) query shows its BASE QUERY as the source (the existing composition summary),
  so the redundant root-leaf "Source: dataset" line no longer shows for composed queries. The
  QueriesPage source column resolves a `ds_`→dataset name (link to the dataset) or a
  `qr_`→base-query name (link to the base query).
+ **Builder join root** — the JoinEditor's graph-root DATASET is the `ds_` driving source;
  for a composed (`qr_`) base there is no single root dataset on the wire, so first-hop-from-root
  isn't offered (joins onto a composed base extend from already-joined datasets; the backend
  validates provenance regardless). **Dataset-rooted queries — every R69→R75 query + "Save filters
  as Query" — are pixel-identical.** A first-class composed-join affordance is left to the canvas
  theme (deferred, with its trigger).
+ **Green**: `tsc --noEmit` clean; the 31 queries FE tests pass (composition + create + build-on
  included); the R77 create test now asserts the POST carries the canonical `sourceId` (no
  `datasetId`). (The relationships-suite timeouts under the full parallel run are machine-load
  flakiness — the file passes 5/5 in isolation; unrelated to this rename.)

### Integration-gate close (2026-06-16)

+ **Functional integration (automated) green** — the BE suite exercises end-to-end create → run →
  delete for both source kinds (dataset-rooted in `test_queries.py`; composed `qr_` in
  `test_composition.py`), and `test_deleting_source_dataset_cascades_queries_away` is the J-1
  cascade guard (now driven by the app-level cascade, not the dropped FK). The FE suite covers the
  composition / "Build on this query" create + the detail/list source surfaces. The repo doc gates
  are clean: **`plan:lint` 0**, **`markdownlint` 0** (193 files), **`markdown-check-link` 0** broken.
+ **`gate-walker`** — each gate's exit criterion is documented as met above (Design → Contract →
  Backend → FE → Integration); per the DCFBI branch, F1/F2 are skipped (`flow-selector` → DCFBI).
+ **Human sign-off (the real boundary)** — pytest/MSW can't see CORS/preflight, real DuckDB parquet
  reads, the first live Alembic `0002` upgrade on an actual `app.sqlite`, or layout/feel
  ([DFCFBI-F1-needs-human-review doctrine](../../memory/2026-06-14-dfcfbi-f1-needs-human-review.md)).
  **Complete = signed-off**, not gates-green. Hand-off checklist below.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md) — no-UI /
refactor branch, [§ Amendment 2026-06-16](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                       |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | No UI state model — a field-id rename adds no interactive states; the `ds_`/`qr_` polymorphism already exists and isn't user-facing. |
| 2. New interaction pattern           | no     | Builder create/edit flows are behaviourally unchanged; only the wire field name changes.            |
| 3. High user-error risk              | no     | UX-invisible rename; the dataset-delete cascade is preserved identically (J-1), so no new error path. |
| 4. Contract depends on unresolved UI | no     | The contract shape is fully determined (`sourceId` required, `datasetId` removed) — no open UI question gates it. |
| 5. UX confidence below threshold     | no     | No UX change to be unsure about; the `sourceId` model was designed at R76 and is merely completed.  |

Result: **Flow: DCFBI** (no-UI round → 0/5 by construction). F1/F2 gates skipped; gates are
**D → C → B → F → I**.

## Check

+ [x] **J-0 ratified** (Plan gate); **J-1, J-2 resolved** (Design gate).
+ [x] **Design gate closed** — J-1/J-2 resolved + contract/BE/FE deltas + model check recorded
      (see `## Do` Design-gate close); `flow-selector` → **DCFBI** (no-UI branch, recorded);
      `ui-design` N/A; committed as the Design seam.
+ [x] **Contract gate closed** — `sourceId` required + canonical, `datasetId` removed across
      `_shared/query.yaml` + `queries/{post, preview}` bodies + `{get, detail-get, put}`
      examples + `.md` companions; `openapi-validity` 24/24 green; committed as the Contract seam.
+ [x] **Backend gate closed** — Alembic `0002_query_source_id` (backfill → drop `dataset_id`,
      `source_id` NOT NULL via `copy_from` batch); router reads `source_id` only; app-level
      dataset-delete cascade (J-1); schema-parity test updated + asserts the backfill on a seeded
      pre-R79 DB (J-2); 196 pytest green, ruff clean; committed as the Backend seam.
+ [x] **FE gate closed** — types + builder + preview/create/join flows send & read `sourceId`
      only; composed queries show their base query as the source; MSW fixtures/handlers updated;
      `tsc` clean + 31 queries tests green; committed as the FE seam.
+ [x] **Integration gate (automated) green** — end-to-end create/run/delete for both source kinds
      covered by the BE suite; the dataset-delete cascade guard passes; doc gates clean
      (`plan:lint` 0, `markdownlint` 0, `markdown-check-link` 0); `flow-selector` + `gate-walker`
      run/recorded.
+ [x] **Human sign-off (2026-06-16)** — create/edit/delete a query of both source kinds verified
      in the real app; dataset-delete cascade confirmed; `pnpm dev:seed` works. **Complete.**

## Act

**Outcome (signed off 2026-06-16).** A Query's driving source is now the single polymorphic
`sourceId` everywhere — DB, contract, backend, FE — with the legacy `datasetId` fully retired.
The DB change shipped as the **first real feature migration on the R78 foundation**
(`0002_query_source_id`: backfill → column drop, batch mode), and the dataset-delete → query
cascade is preserved **by design** (an app-level `DELETE FROM queries WHERE source_id = ?`) rather
than by the dropped FK — exactly one level, matching the old `ON DELETE CASCADE`.

**Lessons worth keeping:**

+ **The first post-baseline migration exposed a latent test-DB seam** — `create_all_for_tests()`
  builds the *head* schema but left it unstamped, so the app lifespan's `run_startup_migrations()`
  mis-read it as a pre-Alembic baseline DB and replayed `0002` (which assumed the dropped column).
  R78's parity test only caught it because head ≠ baseline for the first time. Fix: a models-built
  test DB is stamped at head (it IS `upgrade head`). _Generalizable to every future migration._
+ **SQLite batch-recreate can't reflect an unnamed `CHECK` or an FK `ON DELETE` action** — both
  are silently dropped on recreate. Use `copy_from` with an explicit pre-change table, not
  reflection, whenever a batch migration must preserve them. The schema-parity test is the guard
  that makes this non-negotiable.
+ **A wire-field removal is rarely purely mechanical** — dropping `datasetId` removed the FE's
  cheap "root dataset" for a *composed* query, surfacing that the single-root model never fully fit
  composition. Dataset-rooted stayed pixel-identical; composed now reads its source from `sourceId`
  (`qr_` → base query). The deeper composed-join affordance is correctly the canvas theme's job.

## Feeds into → the canvas theme and the incremental ORM port

With the driving source unified under `sourceId`, the polymorphic-source model is clean for the
**canvas theme** (the free-form source graph reads/writes one source field, not two) and for the
**consumer-save** and **dashboard** themes downstream. The **raw-SQL → ORM data-access port**
continues incrementally as later rounds touch each router (R78 deferral); the **`qr_`-on-the-right
-of-a-hop** generalization and the **canvas** remain deferred with their named triggers.
