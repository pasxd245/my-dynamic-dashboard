# Round 24: Contract — CRUD hygiene (DCBF C-step)

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_23](Round_23.md)** — R23 designed the
CRUD hygiene feature end-to-end (rename + delete on both
workspaces and datasets, with block-on-non-empty 409 cascade
rule). The wire shape is locked at the design level — four
endpoints, four response shapes, three error codes (`not_found`,
`name_taken`, `non_empty`). R23 declared a full DCBF chain;
R24 is the C-step.

R24 formalizes the wire shape into OpenAPI 3.1 YAML +
rationale-MD pairs in
[workspace/packages/contracts/](../../../workspace/packages/contracts/),
matching the R15 precedent. Per the C-step methodology, the
YAML is authoritative shape; the MD captures the why
(semantics, idempotency, error meaning, worked examples).

_Track: 1 (product — POC/MVP CRUD chain). Pulled by
[Round_23](Round_23.md)'s chain declaration. Per
[contract-driven-feature.md](../../context/contract-driven-feature.md):
"The contract is the unit of agent coordination" — once R24
locks the YAML, R25 (BE) and R26 (FE) can be implemented
independently against the same locked spec._

## What is IN scope

- **Four endpoint contract pairs**, one per endpoint introduced
  by R23:
  - `workspaces/patch.contract.{yaml,md}` — rename workspace
    (200 → `Workspace`; 404 `not_found`; 409 `name_taken`).
  - `workspaces/delete.contract.{yaml,md}` — delete workspace
    (204 success; 404 `not_found`; 409 `non_empty` with
    `datasetCount`).
  - `datasets/patch.contract.{yaml,md}` — rename dataset
    (200 → `Dataset`; 404 `not_found`; 409 `name_taken`).
  - `datasets/delete.contract.{yaml,md}` — delete dataset
    (204 success; 404 `not_found`; parquet cleanup atomic
    per BE round; no 409 path).
- **One new shared schema**: `_shared/api-error.yaml` —
  discriminated `ApiError` envelope keyed on `code`. Three
  variants: `not_found`, `name_taken`, `non_empty` (the last
  carries `datasetCount: integer`). All four R23 endpoints
  reference this via `$ref`. Existing contracts (uploads,
  datasets/batch-post, datasets/get) are not retro-fitted —
  they keep their FastAPI `{ detail: [...] }` 422 envelopes;
  the new R23 endpoints use the new code-first envelope
  because that's what R23's FE branching needs.
- **Reuse of existing `_shared/`** schemas:
  - `_shared/workspace.yaml` for `PATCH /workspaces/{id}`
    response shape (no change to existing `Workspace` schema).
  - `_shared/dataset.yaml` for `PATCH /datasets/{id}` response
    shape (no change to existing `Dataset` schema).
- **`RenameBody` shape** — _per-resource_, not a shared
  `_shared/rename-body.yaml`, because the `name` constraints
  differ (workspace 80 chars vs dataset 120 chars; see "Open
  questions" below). Each endpoint's request body is inlined.
- **OpenAPI-validity test pass**: the existing iterating test
  at `tests/openapi-validity.test.ts` picks up the four new
  YAML files automatically — verify it still passes after the
  new contracts land.

## What is OUT of scope (explicit deferrals)

- **No BE implementation.** R25's job. The C-round does not
  touch `apps/backend/`.
- **No FE implementation.** R26's job. The C-round does not
  touch `apps/builder/`.
- **No retroactive error-envelope alignment** for existing
  endpoints (uploads, batch-post, get). They keep their 422
  envelopes; only the R23 endpoints use the new `ApiError`
  code-first envelope. A future round can unify if drift
  bites.
- **No codegen.** Hand-aligned Pydantic and TS land in R25 +
  R26 respectively. Per the
  [Evolution Rule](../../AGENTS.md): codegen lands when 3+
  contracts drift in a real way; not yet.
- **No methodology amendments.** Track-2/3 freeze per the
  R22 → R23 pivot.
- **No autopilot-readiness work** (UX-infra, app config,
  constants/enums) — queued post-R26 per R23 Act § Follow-ups.

## Plan

- [x] Author Round_24.md (this file) and flip to `In Progress`.
- [x] Resolve the name-max-length question — aligned to
      existing schemas (workspace=80, dataset=120). Documented
      inline in datasets/patch.contract.md § Length-bound
      rationale.
- [x] Draft `_shared/api-error.yaml` with the three-code
      discriminated envelope.
- [x] Draft `workspaces/patch.contract.{yaml,md}` —
      authoritative shape + rationale.
- [x] Draft `workspaces/delete.contract.{yaml,md}` — same.
- [x] Draft `datasets/patch.contract.{yaml,md}` — same.
- [x] Draft `datasets/delete.contract.{yaml,md}` — same.
- [x] Run `pnpm --filter @mdd/contracts test` — 11 tests pass
      (was 7 pre-R24; four new YAMLs each get their own
      iterating test, plus the discoverability sentinel).
- [x] Update
      [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
      with a `**Contract**: R24` stamp under the existing
      `**Round introduced**` header.
- [x] `pnpm md:lint` (repo-wide) and `pnpm format:check` for
      R24-touched files.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **Name-length consistency.** R23's design said 80 chars for
  both. Existing `_shared/workspace.yaml` is 80; existing
  `_shared/dataset.yaml` is 120. Lean: keep existing schemas
  unchanged (workspace=80, dataset=120) — tightening dataset
  to 80 retroactively would invalidate already-committed
  dataset names that fall in the 81-120 range. Surface in Do
  with the choice made.
- **Error-envelope shape divergence.** The new R23 endpoints
  return `{ code, ... }` bodies; existing endpoints return
  FastAPI's `{ detail: [...] }` 422 envelopes. This is a
  deliberate divergence — R23's FE branches on `code` (cheap
  switch), whereas the existing 422 handler parses an array.
  A future round may unify; R24 does not.
- **`additionalProperties: false` on the error body.** Per
  the R16 BE conformance pattern, closed shapes catch
  client-side typo bugs. `ApiError` should be closed on all
  three variants; verify in the YAML and exercise in the BE
  round's conformance tests.
- **`PATCH` semantics vs `PUT`.** R23 design uses `PATCH` to
  match the partial-update intent (only `name` is mutable).
  OpenAPI allows both; PATCH is the right shape because not
  all fields are required in the body. Stick with PATCH.
- **Idempotency on DELETE.** R23 design specifies 404 (not 204) on already-deleted resources, so the FE can distinguish
  "you did this" from "someone else did this." Honor this in
  the contract; do NOT specify 204 for the not-found case.
- **Cascade body shape.** The 409 `non_empty` body carries
  `datasetCount: integer`. Make sure the YAML's
  `discriminator` block lets the validator type-narrow on
  `code` so the FE's discriminated-union TS type maps cleanly.
- **OpenAPI 3.1 discriminator quirks.** OpenAPI 3.1's
  `discriminator` requires every variant to be reachable from
  a `oneOf`; using `oneOf` + `discriminator` is the right
  shape. Reference existing
  [`uploads/post.contract.yaml`](../../../workspace/packages/contracts/uploads/post.contract.yaml)
  if it uses discriminated unions, otherwise hand-craft from
  the OpenAPI 3.1 spec.

## Do

### Resolved: name-max-length consistency

R23's design said `maxLength: 80` for both resources, but the
existing
[`_shared/dataset.yaml`](../../../workspace/packages/contracts/_shared/dataset.yaml)
already uses `120` for `Dataset.name`. R24 chose to **keep the
existing schemas unchanged**: workspace=80, dataset=120.
Tightening dataset names to 80 retroactively would invalidate
already-committed datasets in the 81-120 range (possible for
Excel multi-sheet uploads where the default name is
`<filename_stem>_<sheet_name>`). The mismatch is documented
inline in
[`datasets/patch.contract.md` § Length-bound rationale](../../../workspace/packages/contracts/datasets/patch.contract.md)
so future readers find the call.

### Shared error envelope

[`_shared/api-error.yaml`](../../../workspace/packages/contracts/_shared/api-error.yaml)
defines the new code-first error envelope: `oneOf` over three
closed variants (`ApiErrorNotFound`, `ApiErrorNameTaken`,
`ApiErrorNonEmpty`) discriminated on `code`. The `non_empty`
variant carries `datasetCount: integer` so the FE's blocked
modal can show "Marketing has 4 datasets". All variants use
`additionalProperties: false` to mirror BE Pydantic's
`extra='forbid'` discipline (per the R16 conformance pattern).

Note on scope: existing endpoints (uploads, datasets/get,
datasets/batch-post) keep their FastAPI `{ detail: [...] }`
envelopes — the new envelope applies only to the four R23
endpoints. A future round may unify if drift bites.

### Four contract pairs

| Endpoint                  | YAML / MD pair                                                                                                | Wire shape (success / errors)                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `PATCH /workspaces/{id}`  | [workspaces/patch.contract.{yaml,md}](../../../workspace/packages/contracts/workspaces/patch.contract.yaml)   | 200 `Workspace` / 404 `not_found` / 409 `name_taken` / 422 |
| `DELETE /workspaces/{id}` | [workspaces/delete.contract.{yaml,md}](../../../workspace/packages/contracts/workspaces/delete.contract.yaml) | 204 / 404 `not_found` / 409 `non_empty` + `datasetCount`   |
| `PATCH /datasets/{id}`    | [datasets/patch.contract.{yaml,md}](../../../workspace/packages/contracts/datasets/patch.contract.yaml)       | 200 `Dataset` / 404 `not_found` / 409 `name_taken` / 422   |
| `DELETE /datasets/{id}`   | [datasets/delete.contract.{yaml,md}](../../../workspace/packages/contracts/datasets/delete.contract.yaml)     | 204 / 404 `not_found` (no 409 — no dependents)             |

- **PATCH bodies** are inlined (not shared) because the
  `name` constraints differ per resource (80 vs 120). A
  shared `_shared/rename-body.yaml` would force one limit on
  both; inlined bodies preserve resource-correct bounds.
- **PATCH responses** reuse the existing
  [`_shared/workspace.yaml`](../../../workspace/packages/contracts/_shared/workspace.yaml)
  /
  [`_shared/dataset.yaml`](../../../workspace/packages/contracts/_shared/dataset.yaml)
  schemas — no churn on the existing Workspace / Dataset
  shapes.
- **DELETE responses** carry no body on 204; the error
  bodies reference the new `_shared/api-error.yaml`.

### Tightened uniqueness on workspace `name`

[`workspaces/patch.contract.md`](../../../workspace/packages/contracts/workspaces/patch.contract.md)
documents a **behavior change** introduced by the R23 chain:
workspace names become globally unique. The existing
[`workspaces/post.contract.md`](../../../workspace/packages/contracts/workspaces/post.contract.md)
explicitly notes that POST currently allows duplicate names
(_"not idempotent; same `name` permitted on multiple rows"_).
R25 (BE) tightens uniqueness on both PATCH and the existing
POST — the contract update lands here so R25 has a locked
target, and the FE handles 409 `name_taken` on create flows
too as a downstream consequence (FE update is small; falls
inside R26's surface).

The migration question for any pre-existing duplicate names
in the live DB: R25 picks an approach (most likely a startup
audit + manual rename of the offender). Logged as a follow-up
for the BE round.

### Verification

- `pnpm --filter @mdd/contracts test` — **11 / 11 passing**
  (was 7 pre-R24). Each new YAML gets its own iterating test
  via `SwaggerParser.validate`; the `_shared/api-error.yaml`
  is excluded from iteration (per the test's `_shared` skip)
  and exercised transitively through `$ref` resolution.
- `pnpm md:lint` — _to run_.
- `pnpm format:check` — _to run_.

## Check

- [x] Four contract `.yaml` files exist under
      `workspace/packages/contracts/{workspaces,datasets}/`
      with PATCH and DELETE verb names.
- [x] Four matching `.md` rationale files exist alongside.
- [x] `_shared/api-error.yaml` defines the discriminated
      `ApiError` envelope and the three variant schemas.
- [x] All four new YAMLs reference `_shared/api-error.yaml`
      for their 404 / 409 responses.
- [x] PATCH endpoints reference the existing
      `_shared/workspace.yaml` / `_shared/dataset.yaml` for
      200-response shape; DELETE endpoints return 204
      (no body schema needed).
- [x] `pnpm --filter @mdd/contracts test` (the
      `openapi-validity` iterating test) — 11 / 11 passing.
- [x] `crud-hygiene.md` gains a `**Contract**: R24` stamp
      under the existing `**Round introduced**` row.
- [x] `pnpm md:lint` 0 errors repo-wide.
- [x] `pnpm format:check` clean for R24-touched files (R04 + R18 prettier carry-overs persist as expected;
      not R24's job).
- [x] All Plan + Check checkboxes flipped `[x]` before
      Status moves to Review.

## Act

**Status**: Complete (human-approved 2026-05-25).

**Learnings**:

- **R23's design + preview made the C-round mechanical.**
  Almost the entire C-round was translation: R23 had locked
  the wire shape (response codes, error codes, body
  structure) in
  [crud-hygiene.md § Wire shape](../../design/data-management/crud-hygiene.md)
  and the
  [`crud-hygiene.preview.html`](../../design/data-management/crud-hygiene.preview.html)
  modal-state toggle had already validated the 409 cascade
  flow visually. R24 only surfaced two new decisions: the
  name-length consistency call (kept existing schemas) and
  the uniqueness back-fill question (logged for R25). When
  the D-round produces a real preview, C-round work shrinks.
- **`additionalProperties: false` on every error variant.**
  The R16 BE conformance pattern's discipline transfers
  one-for-one to error envelopes — closed variants force
  the BE's Pydantic model to match exactly, catching
  client-side drift early. Cheap to add at design time;
  expensive to retrofit.
- **Per-endpoint request body, not shared.** Tempting to
  factor `RenameBody` to `_shared/`, but the `name` length
  bounds differ (80 vs 120). Sharing would force one bound
  on both, which would either invalidate existing dataset
  data (if tightened to 80) or loosen the workspace surface
  (if relaxed to 120). Inlining is the right shape when
  bounds are resource-correct.
- **Catching a design-vs-existing-data mismatch in the C-
  round is the C-round's job.** R23 designed `maxLength: 80`
  for both; the C-round noticed the dataset schema already
  uses 120 and called it out. Caught early at zero cost; if
  it had landed in R25 (BE) or R26 (FE), it would have
  caused a contract amendment mid-implementation.

**Promotions** _(none this round)_: standard for C-rounds —
they implement against locked methodology, they don't change
it.

**Follow-ups (not promotions, just notes):**

- **R25 BE round task: workspace name uniqueness back-fill.**
  The contract update tightens workspace `name` to globally
  unique. The live DB may have duplicates today (existing
  `POST /workspaces` accepted them). R25 should add a
  startup-time audit that lists collisions for manual
  resolution before enabling the new constraint — OR force
  rename one of each pair with a `(2)` suffix and document
  the migration. Surface the choice in R25's HIxAI Q&A.
- **R26 FE round task: handle 409 `name_taken` on the
  existing create flow.** The uniqueness tightening means
  `POST /workspaces` will also start returning 409 when a
  collision happens. The create modal needs the same inline-
  error treatment as the rename modal (R23 modal state 3).
  Small delta to R26's FE work.
- **Sample-payload cross-validation deferred** per the
  Evolution Rule. The `examples:` blocks in the YAMLs are
  documentation, not test fixtures. If a future drift bites
  (an example diverges from the schema), promote to test
  fixtures.

## Feeds into → Round_25 (Backend — CRUD hygiene BE handlers)

What R24 hands forward to R25:

- **Locked contracts** for the four endpoints. R25
  implements `PATCH/DELETE` handlers on both routers against
  these YAMLs; the BE conformance helper
  ([`_conformance.py`](../../../workspace/apps/backend/tests/_conformance.py))
  picks up the new YAMLs automatically per its iterating
  test (one happy-path response per endpoint validated).
- **The new `ApiError` envelope shape** — R25 hand-aligns
  Pydantic models (`ApiErrorNotFound`, `ApiErrorNameTaken`,
  `ApiErrorNonEmpty`) mirroring the YAML. Each model uses
  `extra='forbid'` to match `additionalProperties: false`.
- **Two named back-fill / migration tasks** (workspace name
  uniqueness audit; handle the implied tightening on the
  existing POST). Both for R25 to resolve in its HIxAI
  pass.
- **The atomic dataset-delete discipline.** Reuses R16's
  pattern in reverse (validate → delete DB row → unlink
  parquet, atomic). The contract specifies "no half-deleted
  state visible"; R25's tests cover the rollback path.
