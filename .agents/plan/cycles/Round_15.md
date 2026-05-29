# Round 15: Contract round — `@mdd/contracts` package + 6 endpoint contracts

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-24

## Goal

**Inherits from ← [Round_14](Round_14.md)** — two locked design
contracts ([datasets.md](../../design/data-management/datasets.md) +
[upload.md](../../design/data-management/upload.md)), 17 HIxAI
decisions, three cross-linked previews.

R15 is the **first contract round** in a new 4-round-per-feature
methodology (D in the recent brainstorm): **Design → Contract → BE →
FE**. Each step is its own round; each step is the smallest
boundary one autonomous agent could realistically execute. The
contract is the unit of agent coordination — the artifact two
parallel agents (or two future-Claude sessions) can implement BE
and FE against without integration debt.

R15 establishes the contract layer: a new `@mdd/contracts`
workspace package containing OpenAPI 3.1 YAML files (the
**authoritative** wire shape) paired with Markdown companion
files (the **rationale** — behavior semantics, idempotency,
error meaning, examples — written for HIxAI to "better
understand the contract," not for machines).

_Track: 2 (agent-method — contracts as the multi-agent
coordination primitive; track-3 lesson research toward
autopilot/self-evo); secondary Track 1 (product — locks the wire
shape R16/R17 will implement against). Pulled by: user brainstorm
2026-05-24 selecting variant D over vertical-slice/UI-first;
documented in conversation transcript, captured in this round's
Act. Per [Evolution Rule](../../AGENTS.md)._

## What is IN scope

- **Scaffold `workspace/packages/contracts/`** — new workspace
  package named `@mdd/contracts`. Peer to `@mdd/ui`. Minimal
  `package.json` + `tsconfig.json` + `vitest.config.ts` + README.
  Source-only; no build step (matches `@mdd/ui` convention).
- **Six endpoint contracts** authored as OpenAPI 3.1 YAML +
  Markdown companion. Each endpoint gets its own folder; each
  folder has `<verb>.contract.yaml` + `<verb>.contract.md`:
  - `workspaces/get.contract.{yaml,md}` — `GET /workspaces`
    (retroactive — R13 wire shape gets a contract for the first
    time)
  - `workspaces/post.contract.{yaml,md}` — `POST /workspaces`
    (retroactive)
  - `uploads/post.contract.{yaml,md}` — `POST /uploads`
    (multipart; CSV inline-parse or Excel sheet-enumeration)
  - `uploads/parse.contract.{yaml,md}` —
    `POST /uploads/{temp_id}/parse` (per-sheet parse with
    `ParseOptions`)
  - `datasets/batch-post.contract.{yaml,md}` —
    `POST /workspaces/{id}/datasets/batch` (atomic commit)
  - `datasets/get.contract.{yaml,md}` — `GET /datasets`
- **Shared types in `_shared/`** — reused across endpoints,
  referenced via `$ref`. Authored as standalone OpenAPI
  components fragments:
  - `_shared/workspace.yaml` — `Workspace` (R13 model promoted)
  - `_shared/dataset.yaml` — `Dataset` (per R14 design)
  - `_shared/column.yaml` — `Column { name, dtype }`
  - `_shared/parse-options.yaml` — `ParseOptions { range?,
skip_rows?, has_header? }`
  - `_shared/column-override.yaml` — `ColumnOverride { dtype,
format? }`
  - `_shared/temp-upload.yaml` — temp-upload response shape
    (`{ temp_id, sourceFormat, sheets[], csvPreview? }` —
    discriminated by source type)
- **OpenAPI validity test** — `tests/openapi-validity.test.ts`
  in the contracts package. Uses
  `@apidevtools/swagger-parser` to dereference and validate each
  per-endpoint YAML against the OpenAPI 3.1 spec. Catches
  malformed YAML, broken `$ref`, missing required keys. Runs as
  part of `pnpm test` from the contracts package.
- **Contracts README** — `workspace/packages/contracts/README.md`
  documenting:
  - what this package is (the wire-shape contract layer)
  - file layout convention (one folder per endpoint; `.yaml` =
    authoritative; `.md` = rationale)
  - the 4-round methodology context (Design → Contract → BE →
    FE) with a pointer to this round
  - how to add a new contract (mini-checklist)
- **Methodology memo** — capture the 4-round shape as a
  `.agents/memory/` entry once R15 completes, so future rounds
  inherit the pattern explicitly.

## What is OUT of scope (explicit deferrals)

- **No BE implementation.** R16 implements the upload backend
  against these contracts. R15 doesn't touch
  `apps/backend/app/routers/` or models.
- **No FE implementation.** R17 implements the wizard UI against
  these contracts. R15 doesn't touch `apps/builder/`.
- **No MSW handlers, no mock mode.** User-confirmed: MSW + a
  mock-mode toggle become their own track-2 round when the FE
  consumer arrives. R15 stays single-concern.
- **No Playwright / e2e harness.** Same reasoning — separate
  later round.
- **No codegen (zod ↔ Pydantic ↔ TS types).** Hand-written
  conformance lands in R16 (Pydantic models matching YAML) and
  R17 (TS types matching YAML). Codegen tooling lands only when
  drift bites (3+ contracts is the threshold under the Evolution
  Rule's "Default = don't add").
- **No workspace persistence.** The previous (now-reverted) R15
  swapped the in-memory list for DuckDB; that work was outside
  R14's design chain and has been reverted to preserve the
  design-driven methodology. Persistence comes back in R16 (BE
  round) as a prerequisite for the dataset surfaces, designed
  in-round if it stays small.
- **Sample-payload-validation tests.** User-confirmed: lint that
  the YAML is valid OpenAPI 3.x; defer payload-against-YAML
  validation to a later round if drift surfaces.
- **Whole-API composite spec.** Each endpoint YAML is a
  standalone OpenAPI 3.1 doc. A composite `api.yaml` that merges
  all endpoints (for Swagger UI etc.) is R∞.
- **Behavior contracts beyond what the design docs already lock.**
  R15 transcribes upload.md / datasets.md into machine-readable
  form; it does not re-litigate decisions or add new ones.

## Plan

- [x] Scaffold `workspace/packages/contracts/` — `package.json`
      (name `@mdd/contracts`, private, type: module),
      `tsconfig.json` (matches `@mdd/ui` shape),
      `vitest.config.ts` (node environment, no React),
      `README.md`.
- [x] Author `_shared/workspace.yaml` — `Workspace` schema (id
      pattern `^ws_[0-9a-f]{8}$`, name 1–80 chars, createdAt
      ISO-8601 UTC `Z`-suffixed).
- [x] Author `_shared/column.yaml`, `_shared/dataset.yaml`,
      `_shared/parse-options.yaml`, `_shared/column-override.yaml`,
      `_shared/temp-upload.yaml`.
- [x] Author `workspaces/get.contract.yaml` + `.md` — retroactive
      `GET /workspaces`. Confirms wire shape matches the running
      R13 implementation (R16 BE round will validate this).
- [x] Author `workspaces/post.contract.yaml` + `.md` —
      retroactive `POST /workspaces` with 201 + 422 paths.
- [x] Author `uploads/post.contract.yaml` + `.md` — multipart
      file upload; response discriminator on `sourceFormat`
      (CSV inline-parse vs Excel sheet-enumeration).
- [x] Author `uploads/parse.contract.yaml` + `.md` — per-sheet
      parse; request body `{ items: [{ sheet?, parse_options? }] }`;
      response carries per-sheet success/failure.
- [x] Author `datasets/batch-post.contract.yaml` + `.md` — atomic
      multi-dataset commit; request items carry `temp_id`, name,
      optional `sheet`, optional `column_overrides`, optional
      `excluded_columns`, optional `parse_options`.
- [x] Author `datasets/get.contract.yaml` + `.md` — list with
      optional `workspace_id` query param; response includes
      `sourceFormat` + optional `sheetName`.
- [x] Add `@apidevtools/swagger-parser` to contracts package
      `devDependencies`; author
      `tests/openapi-validity.test.ts` (one `describe` block
      iterating all `*.contract.yaml` files; each gets a
      `swaggerParser.validate(...)` assertion).
- [x] Author `workspace/packages/contracts/README.md` — purpose,
      layout, 4-round methodology pointer, contract-authoring
      checklist.
- [x] `pnpm install` from repo root to register the new
      package in the workspace. _Result: 4 workspace projects
      detected; @mdd/contracts resolved cleanly._
- [x] Run `pnpm test` from the contracts package — confirm all
      6 contract YAML files validate as OpenAPI 3.1. _Result:
      7 tests pass (1 discovery + 6 contract validations)._
- [x] Confirm baseline elsewhere unchanged: builder 8 + ui 26 +
      backend 5 tests still pass.
- [x] `pnpm md:lint` clean across all new MD files. _Result:
      62 files linted, 0 errors._
- [x] `pnpm format:check` clean for all new files. _Carry-over
      warnings on R02/R04/R13/promotions.md remain — not in R15
      scope._
- [x] Author
      `.agents/memory/2026-05-24-contract-round-methodology.md`
      capturing the 4-round-per-feature shape for future agents.
- [x] Cross-link: `Inherits from ← Round_14` (above);
      `Feeds into → Round_16` naming the BE-round scope.
- [x] Post-round audit per [PDCA.md](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **OpenAPI 3.1 vs 3.0 choice.** OpenAPI 3.1 aligns JSON Schema
  with the JSON Schema 2020-12 spec — more expressive. Some
  tooling (older swagger-parser, older spectacular) still
  targets 3.0. Lean: **3.1**. The validator we're using
  (`@apidevtools/swagger-parser`) supports both; FastAPI's
  emitter is OpenAPI 3.1 by default in recent versions; future
  codegen tools land more cleanly on 3.1.
- **`$ref` across files vs single mega-spec.** Per-endpoint
  files with cross-file `$ref` to `_shared/*.yaml` is the chosen
  shape. Risk: some validators have quirks with relative file
  refs. Mitigation: validity test catches this immediately; if
  it bites, fall back to inlining shared schemas in each endpoint
  file (with the cost of duplication).
- **Retroactive workspaces contract drift.** The R13
  `Workspace` Pydantic model and its wire shape exist; the
  contract must match exactly. Risk: I author the contract from
  memory and it diverges from the running code in a subtle way
  (e.g., `createdAt` format spec). Mitigation: read the R13
  router code first, write the YAML against the code, then the
  R16 BE round adds a conformance test that catches any
  remaining drift.
- **Contract round looks "easy" but isn't.** Authoring 6
  contracts + 6 shared types + validator + README is real work.
  Risk: I rush and ship contracts that look plausible but bake
  in semantic errors (loose types where strict was meant,
  missing error responses, wrong status codes). Mitigation: each
  contract MD has a behavior-semantics section forcing me to
  write down "what does this endpoint do, what does it return,
  what fails it" before committing.
- **Workspace persistence orphaned.** R14 + R15 design path
  never named persistence as a feature; previous R15 drifted to
  do it as a side-goal. Risk: R16 BE round needs persistence as
  a prerequisite and pulls it in implicitly, drifting again.
  Mitigation: R15's Feeds-into explicitly names persistence as a
  visible dependency of R16, either folded in with a one-line
  design note in R16's Plan-phase, or split into R15b.
- **`@mdd/contracts` import path** — at this round, no FE/BE
  code imports it. The package's purpose is human-authoring +
  shape lock + validator. Risk: I over-engineer the package.json
  exports field. Mitigation: minimal — just `"type": "module"`,
  no exports field yet. R17 adds TS-types exports when the FE
  imports them.
- **Markdownlint `+` carry-over.** Same R07–R14 pattern. Use `-`
  bullets; avoid `+` at start of continuation lines.
- **OpenAPI YAML formatting.** Prettier formats YAML differently
  from markdown. R15 includes YAML files for the first time;
  Prettier's default YAML printer is acceptable. `pnpm format`
  picks them up via the existing `**/*.md` glob (it doesn't —
  only `.md`). So YAML formatting is unchecked at the
  repo-prettier level. Lean: don't widen the glob this round.
  Hand-format YAML cleanly.

## Do

- **Pre-flight: revert prior R15 drift.** Previous (now-deleted)
  R15 drifted to "workspace persistence (DuckDB swap)" — outside
  R14's design scope. Reverted via `git checkout` on tracked
  files + `rm` on untracked `app/db.py`, `data/`, and the old
  `Round_15.md`. R13 baseline restored (5 backend tests pass).
- **Plan-phase Q&A — three-question multi-select.** User
  confirmed scope:
  1. **All 6 endpoints** — 4 upload-feature + 2 retroactive
     workspaces. Multi-contract per round is fine because the
     4-round shape is about phase separation, not file count.
  2. **Contracts only — no MSW yet.** MSW + Playwright are
     separate track-2 rounds when the FE consumer arrives. R15
     stays single-concern.
  3. **OpenAPI validity lint only.** Sample-payload validation
     against schemas defers to a later round if drift surfaces.
- **`@mdd/contracts` package scaffolded.**
  [`workspace/packages/contracts/`](../../../workspace/packages/contracts/) —
  peer to `@mdd/ui`. Source-only, no build step (matches `@mdd/ui`
  convention). `package.json` (private, type: module),
  `tsconfig.json` (no React, ES2022/ESNext/strict),
  `vitest.config.ts` (node environment), `README.md`.
  `pnpm install` from repo root registered the package; pnpm now
  reports 4 workspace projects (was 3).
- **Six shared types authored in `_shared/`** — `workspace.yaml`
  (retroactive R13 model), `column.yaml` (with `Dtype` enum),
  `dataset.yaml` (with `SourceFormat` enum), `parse-options.yaml`
  (range / skip_rows / has_header), `column-override.yaml`
  (dtype + format), `temp-upload.yaml` (the discriminated
  `TempUploadCsv` / `TempUploadExcel` response shapes plus
  `SheetSummary` + `CsvParsePreview`).
- **Six endpoint contracts authored.** Each as a standalone
  OpenAPI 3.1 doc with `$ref` to shared schemas. Endpoint folders
  named by URL segment (`workspaces/`, `uploads/`, `datasets/`);
  sub-routes (`uploads/{id}/parse`) live in the parent folder
  with a verb-prefixed filename:
  - `workspaces/get.contract.yaml` + `.md` — retroactive list
  - `workspaces/post.contract.yaml` + `.md` — retroactive create
  - `uploads/post.contract.yaml` + `.md` — multipart Phase 1
    with `oneOf`/`discriminator` on `sourceFormat`
  - `uploads/parse.contract.yaml` + `.md` — Excel Phase 2
    per-sheet; body-carried per-item failures
  - `datasets/batch-post.contract.yaml` + `.md` — atomic batch
    commit; `target_dataset_id` slot reserved for R∞ append-mode
  - `datasets/get.contract.yaml` + `.md` — list with optional
    `workspace_id` filter
- **MD-vs-YAML role separation honored.** Each `.contract.md`
  follows the user-confirmed framing: _"info for HIxAI to better
  understand the contract,"_ not the definition itself. MD
  sections: Purpose · Behavior · Error semantics · Examples ·
  Cross-links. The YAML is the authoritative shape; the MD
  carries semantics (idempotency, retry safety, sort order,
  rationale) that OpenAPI alone can't.
- **Discriminator pattern used for `POST /uploads` response.**
  CSV and Excel responses differ structurally (CSV has
  `csvPreview`; Excel has `sheets[]`); OpenAPI's `oneOf` +
  `discriminator.propertyName: sourceFormat` captures the union
  cleanly. Future TS-types codegen will produce a discriminated
  union; future Pydantic will use a `Literal` discriminator field.
- **OpenAPI validity test authored** at
  [`tests/openapi-validity.test.ts`](../../../workspace/packages/contracts/tests/openapi-validity.test.ts).
  Walks every `*.contract.yaml` under the package (skipping
  `node_modules`, dot-dirs, and `_shared/` which is referenced via
  `$ref` and is not a standalone OpenAPI doc), then runs
  `SwaggerParser.validate(file)` against each — dereferences
  `$ref`s and validates against the OpenAPI 3.x meta-schema.
  `pnpm test` from the package: 7 passed (1 discovery sanity +
  6 contract validations).
- **First-draft compile errors learned from.** Initial
  `temp-upload.yaml` used `nullable: true` per OpenAPI 3.0
  convention; OpenAPI 3.1 prefers `type: ["string", "null"]`
  (JSON-Schema-aligned). The validator caught the wrong shape
  immediately — exactly the "fail loudly" property the contract
  round is designed to deliver. Switched to 3.1 idiom and the
  validator passed.
- **Methodology memo authored** at
  [`.agents/memory/2026-05-24-contract-round-methodology.md`](../../memory/2026-05-24-contract-round-methodology.md)
  — captures the 4-round shape (Design → Contract → BE → FE),
  the contract-as-agent-coordination-primitive framing, the
  MD-vs-YAML role split, the "fail loudly, pain first" rationale,
  and the explicit don'ts (no MSW yet, no codegen yet, no
  drift outside the design chain).
- **Baseline elsewhere preserved.** `pnpm md:lint` 62 files,
  0 errors. `pnpm format:check` clean for all R15-authored
  files (R02/R04/R13/promotions.md carry-over remain). Backend
  pytest: 5 passed. Builder vitest: 8 passed. UI vitest: 26
  passed. Contracts vitest: 7 passed. Total: **46 tests pass**
  across 4 packages (was 39 pre-R15).

## Check

- [x] `workspace/packages/contracts/` exists as a registered pnpm
      workspace package. `pnpm install` reports 4 workspace
      projects; `@mdd/contracts` resolves.
- [x] Six endpoint contract YAML files authored, each a valid
      OpenAPI 3.1 document with `$ref` to shared types.
- [x] Six endpoint contract Markdown files authored, each
      covering: purpose, behavior, errors, examples,
      idempotency / retry semantics, cross-link to YAML + design
      doc.
- [x] Six shared-type YAML files in `_shared/` referenced by at
      least one endpoint each (no dead schemas — verified by
      grep across endpoint YAMLs).
- [x] `pnpm test` from the contracts package returns 0 failures
      (7 passed = 1 discovery + 6 contract validations).
- [x] Baseline elsewhere unchanged: backend 5 + builder 8 + ui
      26 = 39 tests still pass. Plus contracts 7 = 46 total.
- [x] `pnpm md:lint` clean.
- [x] `pnpm format:check` clean for R15-authored files
      (carry-over R02/R04/R13/promotions.md remain — not in
      scope).
- [x] Contracts README authored.
- [x] Methodology memo captured in `.agents/memory/`.
- [x] Cross-links present.

## Act

**Status**: Complete (human-approved 2026-05-24).

**Learnings**:

- **OpenAPI validator delivers "fail loudly" on schedule.** The
  3.0 `nullable: true` vs 3.1 `type: [..., "null"]` mistake was
  caught by `SwaggerParser.validate()` on the first test run.
  Without the validator, that drift would have surfaced at
  codegen time, or worse, at runtime when a Pydantic model
  rejected a null value the FE was happily sending. The cost of
  catching it now: 30 seconds. The cost of catching it at
  integration: hours. This is the contract-round payoff
  concretely demonstrated.
- **MD-vs-YAML role split is load-bearing.** Writing the YAML
  alone surfaced shape questions ("what's the discriminator key
  for the upload response union?"); writing the paired MD
  surfaced semantic questions ("is this idempotent? what's the
  retry behavior on parse failure? what does 409 vs 422
  mean?"). Each MD section forced a decision the YAML alone
  doesn't accommodate. **Contracts without semantic prose are
  incomplete** — but the prose has to live somewhere humans
  read first, not in YAML descriptions buried under schema
  syntax.
- **Per-endpoint files scale cleanly with `$ref`.** Six endpoint
  contracts share six `_shared/` types via cross-file `$ref`
  resolution. `@apidevtools/swagger-parser` handles the
  dereferencing transparently — no special tooling, no
  preprocessing. The structure stays browseable: an MD reader
  can `cd workspaces/` and see the two endpoints; an OpenAPI
  reader can dereference and get a complete spec.
- **Retroactive contracts are valid scope.** R13's
  `GET /workspaces` + `POST /workspaces` had no contract; R15
  added them retroactively. The contract authoring was cheap
  (the wire shape already exists in code) and produced
  immediate value: R16's BE round can validate the running
  implementation against the contract as a sanity check. Future
  rounds inherit the same pattern for any legacy endpoint that
  gains a contract.
- **Revert-when-drifted reinforced the design-driven chain.**
  The previous R15's persistence work was good code but wrong
  round — outside R14's design scope. Reverting (vs amending
  the round to retroactively cover it) preserved the
  methodology: rounds inherit explicitly via `Inherits from ←
…`, and the chain has to stay coherent. Anti-drift discipline.
- **Discriminator unions translate cleanly to both languages.**
  The CSV-vs-Excel response shape for `POST /uploads` is
  modeled as `oneOf` + `discriminator: sourceFormat`. R16's
  Pydantic implementation maps to a `Literal` discriminator
  field (Pydantic supports this natively). R17's TS types map
  to a discriminated union (TS supports this natively). Both
  sides arrive at the same shape from the same contract
  without coordination — exactly the multi-agent-coordination
  primitive the methodology is meant to establish.

**Promotions** _(decision: none this round)_:

- The 4-round methodology memo is the candidate promotion
  artifact. Two more instances needed before
  `.agents/memory/` → `.agents/context/` promotion criteria are
  met: R16's BE-round outcome + R17's FE-round outcome both
  need to validate the pattern. If they do, R18 or later
  promotes a one-paragraph governance rule into `context/`.
- Build-first lesson + AntD-wrapper-testing pattern queued
  from R12/R13/R14 Acts still deferred. The 4-round methodology
  is the active research; bundling other promotions into the
  contract-round Act would dilute the lesson.

**Follow-ups (not promotions, just notes):**

- **R16 needs workspace persistence.** Datasets carry
  `workspaceId` as an FK — losing workspace rows on restart
  breaks the dataset surface. R16's Plan-phase decides whether
  persistence is folded in (one-round BE) or split (R15b
  prelude + R16). The contracts make this decision easy
  because the shape is locked either way.
- **MSW + mock-mode toggle is a separate track-2 round.** Comes
  when R17 (FE) needs to demo the wizard before R16 (BE) is
  complete. Until then, the contract is the source of truth;
  MSW just becomes one consumer of the same source when it
  arrives.
- **OpenAPI 3.1 idioms.** Use `type: [..., "null"]` (JSON
  Schema 2020-12), not `nullable: true` (OpenAPI 3.0). Use
  `examples` (array or object) on schema fields, not the
  singular `example`. Reference shared types via cross-file
  `$ref: '../_shared/<file>.yaml#/components/schemas/<Name>'`.
- **Sample-payload validation deferred.** The MD examples are
  not currently cross-checked against the YAML response
  schemas. When one drifts (and it will), add a test that
  parses example blocks from MDs and validates each against the
  matching YAML's response schema.

## Questions for user before next round — RESOLVED (2026-05-24)

R16 implements the **backend** against R15's locked contracts.
Per the `../../memory/feedback_round_cadence.md`,
single-feature scope; per the 4-round-methodology, R16 implements
contracts only — no UI work, no design churn.

User responses recorded below.

1. **R16 endpoint scope — all 4 upload-feature endpoints, or
   start narrower?** **Decision: all 4** (user accepted lean).
   `POST /uploads`, `POST /uploads/{temp_id}/parse`,
   `POST /workspaces/{id}/datasets/batch`, `GET /datasets`. The
   contracts are locked; the BE work is mechanical conformance.
2. **Workspace persistence — fold into R16 or split as R15b?**
   **Decision: fold into R16's Plan-phase** (user accepted lean).
   The persistence swap is a one-line design note in R16's Plan
   acknowledging the dataset-FK dependency.
3. **Retroactive workspaces conformance — R16, R17, or never?**
   **Decision: R16** (user accepted lean). Conformance tests for
   the retroactive
   [`get.contract.yaml`](../../../workspace/packages/contracts/workspaces/get.contract.yaml)
   and
   [`post.contract.yaml`](../../../workspace/packages/contracts/workspaces/post.contract.yaml)
   land in R16 alongside the upload-feature endpoint tests.
4. **Persistence engine for R16 — DuckDB or SQLite?**
   **Decision: BOTH — same split as the drifted iteration** (user
   revised the lean). Metadata (workspaces table, datasets table)
   lives in **SQLite** at `apps/backend/data/app.sqlite`. Uploaded
   file contents (CSV originals, parsed Parquet) live on
   **filesystem** and are queried by **DuckDB** at analytics time.
   The two engines coexist by role: SQLite for transactional
   row state, DuckDB for columnar reads over the parquet companion
   files. R16 inherits this split as a track-1 + track-3 lesson
   pulled forward from the drifted iteration. See
   [drifted-iteration.md](../../context/drifted-iteration.md) for
   the original context.
5. **R17 (FE) blocker — does R17 wait for R16 to complete, or
   start in parallel with MSW?** **Decision: wait for R16
   sequentially** (user accepted lean). First DCBF cycle stays
   serial so the lesson stays clean; parallel-with-MSW is a
   separate track-2/3 round once we have the sequential baseline
   to compare against.

## Feeds into → Round_16 (TBD)

What R15 hands forward:

- **A locked contract layer** at
  [`workspace/packages/contracts/`](../../../workspace/packages/contracts/).
  Six endpoint contracts (4 new + 2 retroactive) authored as
  OpenAPI 3.1 YAML + Markdown rationale pairs. Six shared types
  in `_shared/`. OpenAPI validity test passes; the contract is
  green-CI before any implementation begins.
- **The 4-round-per-feature methodology** captured at
  [`.agents/memory/2026-05-24-contract-round-methodology.md`](../../memory/2026-05-24-contract-round-methodology.md).
  R16 is the second link in the chain (Contract → BE); R17 is
  the third (Contract → FE). R16's Plan-phase opens by quoting
  this memo's "Recommendation" section.
- **Conformance-test pattern.** R16's BE tests should include
  one conformance test per endpoint: load the YAML via Python
  (use `pyyaml` + `jsonschema` 4.x), build the OpenAPI schema
  resolver, validate each route's response against the
  schema. The pattern is well-documented in OpenAPI tooling;
  R16's Plan-phase confirms the exact library choice.

**R16 scope** (per the resolved Q1–Q5 decisions above; R16's own
Plan-phase confirms the exact slicing):

- **Persistence layer — SQLite + DuckDB split** (Q4 decision,
  pulled from the drifted iteration):
  - **SQLite** at `apps/backend/data/app.sqlite` holds
    transactional metadata: the `workspaces` table (replaces R13's
    in-memory list) and the `datasets` table (new — populated at
    commit time by the batch endpoint). Schema bootstrapped at
    app startup via FastAPI lifespan (lesson from the reverted
    R15: don't bootstrap at module-import time).
  - **DuckDB** stays in the analytics path — it reads the
    `parsed.parquet` companion files at query time. No DuckDB
    DB file at the persistence layer; the engine is invoked
    in-process against Parquet on disk.
  - **Filesystem** holds the file content:
    `data/uploads_tmp/<temp_id>/{original.<ext>, parsed.<sheet_key>.parquet,
preview.<sheet_key>.json}` for temp uploads;
    `data/datasets/<ws_id>/<ds_id>/{original.<ext>, parsed.parquet,
source.json}` for committed datasets.
  - The split is a track-1 architecture call ("right tool per
    role") and a track-3 lesson capture ("the drifted iteration
    arrived at this split; we re-derive it deliberately rather
    than re-discover it"). Capture this in R16's Act as the
    first concrete drifted-iteration learning the
    contract-driven chain has pulled forward.
- **Four upload-feature backend routes** implementing the locked
  contracts:
  - `POST /uploads` (multipart, CSV inline-parse via DuckDB
    `read_csv_auto`, Excel sheet enumeration via openpyxl)
  - `POST /uploads/{temp_id}/parse` (per-sheet Excel parse with
    `ParseOptions`, body-carried per-item failures)
  - `POST /workspaces/{id}/datasets/batch` (atomic commit;
    `target_dataset_id` returns 422 per the contract until
    append-mode lands)
  - `GET /datasets[?workspace_id=...]`
- **Pydantic models** matching the locked YAML schemas
  (`Workspace`, `Dataset`, `Column`, `ParseOptions`,
  `ColumnOverride`, `TempUploadCsv`, `TempUploadExcel`, etc.).
  Hand-written; codegen lands later if drift bites.
- **Conformance tests** — one per endpoint, validating actual
  responses against the YAML.
- **File-storage layout** — `data/uploads_tmp/<temp_id>/{original.<ext>,
parsed.<sheet_key>.parquet, preview.<sheet_key>.json}` for
  temp; `data/datasets/<ws>/<ds>/{original.<ext>, parsed.parquet,
source.json}` for committed. The 24h sweep is deferred to a
  later round.
- **Pytest coverage** matching the R13 pattern — success +
  validation-failure + parse-failure paths, both source types.

R17 (FE) consumes the same contracts: TS types hand-written to
match the YAML; TanStack Query hooks for each endpoint; the
upload wizard pages render against the locked shape.
