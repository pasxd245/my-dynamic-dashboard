# Round 79: `datasetId → sourceId` rename cleanup — finish the R76 widening

**Status**: In Progress (Plan gate — J-0 ratified; J-1/J-2 held open for Design)
**Date started**: 2026-06-16
**Flow**: TBD — set at the Design gate (`flow-selector`). Unlike R78, this round **re-opens the
wire contract** (the query schema's source-of-record field) and touches **BE + FE**, so it is a
full feature-flow round — expected **DCFBI** (a field rename carries no new interaction pattern;
likely 0–1 selector conditions fire). It is also the **first real feature migration on the R78
foundation** — a backfill + column drop shipped as an Alembic revision.

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

### Held open for the Design gate (J-1, J-2)

| #   | Question                                          | The design problem                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-1 | **Preserve the dataset-delete → query cascade** (the central catch) | Today `queries.dataset_id` carries `FK … ON DELETE CASCADE`: deleting a dataset deletes its dataset-rooted queries. `source_id` is **plain polymorphic `TEXT` with no FK** (it can hold a `qr_`, which has no single FK target). So **dropping `dataset_id` silently loses that cascade** — deleting a dataset would orphan queries whose `sourceId` is that `ds_`. The Design gate must choose how to preserve current delete behaviour: (a) keep an FK-bearing column under the hood for the `ds_` case; (b) move the cascade to the dataset-delete **handler** (app-level); (c) a partial-FK / trigger. Whatever is chosen, the existing delete tests must stay green. |
| J-2 | **DB change shape + does the ORM port ride along** | The migration: **backfill `source_id = dataset_id WHERE source_id IS NULL`, then drop `dataset_id`** (SQLite → Alembic batch mode, already enabled in R78's `env.py`). Two sub-questions: ordering within one revision (data-migrate before schema-drop), and whether to opportunistically port the **queries router's raw SQL → ORM** here (R78 deferred the 71-site port to "as feature rounds touch each router"). **Lean: keep the ORM port OUT** — do the rename only, so the round stays a tight, revertible rename; the ORM port is its own incremental call. |

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
  until its trigger ([query-builder.md](../../design/data-management/queries/query-builder.md) —
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

## Check

+ [ ] **J-0 ratified** (Plan gate); **J-1, J-2 held open** → Design gate.
+ [ ] _Design gate — pending_ (cascade preservation + migration shape + flow selection).
+ [ ] _Contract / Backend / FE / Integration gates — pending._
+ [ ] **Human sign-off** — create/edit/delete a query of both source kinds in the real app;
      dataset-delete cascade verified; `pnpm dev:seed` works (Complete = signed-off).

## Act

_Pending — filled at round close._ The intended outcome: a Query's driving source is the single
polymorphic `sourceId` everywhere — no legacy `datasetId` — with the DB change delivered as a
versioned Alembic migration (backfill + column drop) on the R78 foundation, and the
dataset-delete cascade preserved by design rather than by the dropped FK.

## Feeds into → the canvas theme and the incremental ORM port

With the driving source unified under `sourceId`, the polymorphic-source model is clean for the
**canvas theme** (the free-form source graph reads/writes one source field, not two) and for the
**consumer-save** and **dashboard** themes downstream. The **raw-SQL → ORM data-access port**
continues incrementally as later rounds touch each router (R78 deferral); the **`qr_`-on-the-right
-of-a-hop** generalization and the **canvas** remain deferred with their named triggers.
