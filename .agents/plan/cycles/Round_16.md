# Round 16: BE round — upload backend against R15's locked contracts

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-24

## Goal

**Inherits from ← [Round_15](Round_15.md)** — locked contract layer
at [`workspace/packages/contracts/`](../../../workspace/packages/contracts/):
six OpenAPI 3.1 YAML files (4 new + 2 retroactive), six shared
type fragments in `_shared/`, OpenAPI validity test green. The 4
upload-feature endpoint contracts plus the 2 retroactive workspaces
contracts are the authoritative input for this round; the
[contract-round methodology memo](../../memory/2026-05-24-contract-round-methodology.md)
locks the "BE implements against the YAML; Pydantic is hand-aligned"
discipline.

R16 is the **B** in the DCBF chain (Design → Contract → BE → FE).
Per the methodology memo: hand-write Pydantic models matching the
locked YAML; add a per-endpoint conformance test that validates
each actual response against the YAML schema; no UI work, no design
churn, no FE-side mocks. R17 (F) consumes the same contracts.

_Track: 1 (product — upload feature backend lands) + 3 (lessons —
re-derive the SQLite + DuckDB split that the drifted iteration
arrived at; document what BE conformance against an OpenAPI YAML
looks like in practice). Pulled by: Round_15 Q4 (BOTH-engines
decision) + Q1 (all 4 endpoints in scope) — per [Evolution
Rule](../../AGENTS.md)._

## What is IN scope

- **Persistence layer — SQLite + filesystem (Q4 decision).**
  - **SQLite** at `apps/backend/data/app.sqlite` for transactional
    metadata: `workspaces` (replaces R13's in-memory list) +
    `datasets` (new — populated at commit time by
    `POST /workspaces/{id}/datasets/batch`). Schema created at app
    startup via FastAPI `lifespan` (the reverted R15 bootstrapped
    at module-import time; that was the bug — fix it here).
  - **DuckDB** stays in the analytics path (called against Parquet
    on disk in `parse_csv` / `parse_excel`). No DuckDB DB file.
  - **Filesystem** layout: temp uploads land at
    `data/uploads_tmp/<temp_id>/{original.<ext>, meta.json}`, and
    committed datasets land at
    `data/datasets/<ws_id>/<ds_id>/{original.<ext>, parsed.parquet,
source.json}`.
- **Four upload-feature endpoints** implementing the locked
  contracts:
  - `POST /uploads` — multipart; CSV inline-parses via DuckDB
    `read_csv_auto`; Excel enumerates sheets via openpyxl
    read-only.
  - `POST /uploads/{temp_id}/parse` — per-sheet Excel parse; body
    carries per-item success/failure (partial-success returns 200,
    not 207).
  - `POST /workspaces/{id}/datasets/batch` — atomic batch commit;
    `target_dataset_id` field is parsed but always rejected with
    422 (R∞ append-mode reservation).
  - `GET /datasets[?workspace_id=…]` — list datasets, most-recent
    first, optional workspace filter.
- **Pydantic models** matching the locked YAML schemas. Hand-
  written, organised by router file:
  - `app/models/common.py` — shared types: `Workspace`, `Dataset`,
    `Column`, `Dtype`, `ParseOptions`, `ColumnOverride`,
    `SheetSummary`, `CsvParsePreview`, `TempUploadCsv`,
    `TempUploadExcel`.
  - Router-local request bodies stay in their router file.
- **Conformance tests — one per endpoint.** A single helper loads
  the corresponding `*.contract.yaml`, dereferences `$ref`s with
  `jsonschema-spec` / `referencing`, and validates each actual
  response body against the relevant `responses.<code>.content`
  schema. Lives at
  `apps/backend/tests/_conformance.py` (helper) and inline in
  each `test_<endpoint>.py` (one assertion per route).
- **Pytest coverage** matching the R13 pattern:
  - `tests/test_workspaces.py` — keep R13's four tests; add a
    fifth that survives a SQLite restart (in-process reconnect).
  - `tests/test_uploads_post.py` — CSV success, Excel success,
    size-too-big (413), format-mismatch (415), unparseable CSV
    (422).
  - `tests/test_uploads_parse.py` — Excel multi-sheet parse with
    per-sheet success + per-sheet failure (body-carried), unknown
    `temp_id` (404), CSV `temp_id` (404 — same surface, deliberate).
  - `tests/test_datasets_batch.py` — single-item CSV commit,
    multi-item Excel commit, unknown workspace (404), unknown
    `temp_id` (404), `target_dataset_id` set (422),
    `excluded_columns` empties the schema (422),
    `column_overrides` references missing column (409).
  - `tests/test_datasets_list.py` — empty list, post-commit listing,
    workspace_id filter (positive + negative).
  - `tests/test_conformance.py` — the cross-cutting conformance
    test: for each of the 6 contracts, hit a representative success
    response and validate it against the YAML.
- **Dependencies.** Add to backend `pyproject.toml`:
  - Runtime: `openpyxl`, `pandas`, `python-multipart`, `pyyaml`,
    `jsonschema`, `referencing`. (FastAPI multipart needs
    `python-multipart`. `pandas` chosen over pure-`pyarrow` for
    Excel + parquet I/O ergonomics; the BE doesn't ship to a
    bandwidth-sensitive deploy yet.)
  - DuckDB stays at the existing 1.1.3.
- **`.gitignore` entry** for `apps/backend/data/` (SQLite file and
  temp/committed upload trees are never committed).
- **R13 backward compatibility.** The four R13 workspaces tests
  still pass against the new SQLite-backed router (same wire shape,
  same status codes, same sort order).
- **Cross-link in [datasets.md](../../design/data-management/datasets/datasets.md)
  and [upload.md](../../design/data-management/datasets/upload.md)** —
  add a "Backend: R16" note at the top so design ↔ implementation
  is browseable.

## What is OUT of scope (explicit deferrals)

- **No FE work.** R17 implements the wizard against the same
  contracts. R16 does not touch `apps/builder/`.
- **No MSW handlers, no mock-mode toggle.** Same as R15 — a
  separate track-2 round paired with the FE arrival.
- **No codegen (zod ↔ Pydantic ↔ TS types).** Hand-written.
  Codegen lands when 3+ contracts exist and hand-alignment drifts
  (per [Evolution Rule](../../AGENTS.md) — default = don't add).
- **No 24h temp-upload sweep / TTL job.** The contract documents
  the TTL; the sweep is a separate later round.
- **No composite whole-API `api.yaml`.** Each endpoint stays
  standalone.
- **No DuckDB Excel extension.** Sniffing + parsing uses openpyxl
  combined with pandas; DuckDB stays on the CSV / Parquet path. The Excel
  extension is faster but adds a non-trivial runtime download —
  cost not yet justified.
- **No SQLAlchemy / ORM.** Direct `sqlite3` with parameterised
  SQL via a thin `app/db.py` helper. Two tables don't earn an
  ORM; revisit at 4+ tables (per Evolution Rule).
- **No DB migrations framework.** Schema is created `IF NOT
EXISTS` at startup; the round documents the column set and the
  one-row-per-table state machine. Alembic / yoyo / similar lands
  when the first schema-change round arrives.
- **No auth / multi-tenant.** Same as R13.
- **No CORS expansion** — `localhost:3000` only, as in R13.
- **No promotion of the contract-round methodology to
  `context/`.** Per R15's Act, two more instances (R16 + R17) are
  needed before promotion criteria are met. R16's Act re-evaluates
  the candidate; the actual promotion is at earliest after R17.
- **Sample-payload-against-YAML cross-validation in the contracts
  package.** R15 deferred; R16's conformance test arrives from the
  BE side (real response ↔ YAML); the MD example ↔ YAML cross-check
  is still its own future round.

## Plan

- [x] Author Round_16.md (this file) and flip to `In Progress`.
- [x] Add backend runtime deps to
      [`pyproject.toml`](../../../workspace/apps/backend/pyproject.toml):
      `openpyxl`, `pandas`, `python-multipart`, `pyyaml`,
      `jsonschema`, `referencing`. Re-sync `uv.lock`.
- [x] Add `apps/backend/data/` to repo `.gitignore`.
- [x] Implement `app/db.py` — SQLite connection helper +
      `bootstrap_schema(con)` creating `workspaces` and `datasets`
      tables with `IF NOT EXISTS`. Module exports `get_conn()`
      yielding a `sqlite3.Connection` configured with
      `row_factory = sqlite3.Row` and `PRAGMA foreign_keys = ON`.
- [x] Wire `bootstrap_schema` into `app/main.py` via a FastAPI
      `lifespan` async context manager (the reverted R15 used
      module-level execution at import time — re-do as lifespan).
- [x] Implement `app/models/common.py` — Pydantic v2 models
      mirroring the 6 contracts: `Workspace`, `Dataset`, `Column`,
      `Dtype` (Literal enum), `ParseOptions`, `ColumnOverride`,
      `SheetSummary`, `CsvParsePreview`, `TempUploadCsv`,
      `TempUploadExcel`. Each model uses
      `model_config = ConfigDict(extra='forbid')` to enforce the
      contracts' `additionalProperties: false`.
- [x] Migrate `app/routers/workspaces.py` to read/write via SQLite
      instead of the module-level list. Same wire shape, same id
      pattern, same sort order. `reset_store_for_tests()` becomes
      `reset_db_for_tests()` (deletes from both tables;
      foreign-keyed cascade is fine).
- [x] Implement `app/ingest/__init__.py` (empty marker) and
      ingest helpers: - `app/ingest/csv_parser.py` — `parse_csv(path: Path) ->
ParseResult` using DuckDB `read_csv_auto`. Returns columns
      (name+dtype), rowCount, sampleRows[<= 10]. - `app/ingest/excel_parser.py` — - `enumerate_sheets(path: Path) -> list[SheetSummary]`
      via openpyxl read-only mode (no full parse). - `parse_sheet(path: Path, sheet: str, opts:
ParseOptions) -> ParseResult` via openpyxl + pandas.
- [x] Implement `app/routers/uploads.py`: - `POST /uploads` — multipart receives `file`,
      `sourceFormat`. Generate `temp_id =
"tmp_" + secrets.token_hex(8)`. Persist `original.<ext>` under
      `data/uploads_tmp/<temp_id>/`. CSV: call `parse_csv`,
      return `TempUploadCsv`. Excel: call `enumerate_sheets`,
      return `TempUploadExcel`. Errors map to 413/415/422 per
      the contract. - `POST /uploads/{temp_id}/parse` — per-sheet parse with
      body-carried success/failure (always returns 200 unless
      request-shape invalid → 422 or temp not found → 404).
- [x] Implement `app/routers/datasets.py`: - `POST /workspaces/{id}/datasets/batch` — atomic commit.
      Insert dataset rows inside a single SQLite transaction;
      copy `original.<ext>` + write `parsed.parquet` per item;
      roll back on any failure. `target_dataset_id` set → 422. Return 201 + array of `Dataset` rows in request
      order. - `GET /datasets` — list with optional `workspace_id`
      query param. Most-recent first.
- [x] Register `uploads` + `datasets` routers in `app/main.py`.
- [x] Implement `tests/_conformance.py` — `validate_response(
contract_path: str, status: int, body: object) -> None`
      helper. Uses `pyyaml` to load the YAML, resolves cross-file
      `$ref`s via `referencing` (or inlines them with a small
      pre-pass — pick whichever is simpler), and validates via
      `jsonschema.Draft202012Validator`.
- [x] Author the per-endpoint pytest files listed in scope. Each
      success-path test includes a
      `validate_response(<contract>, …)` assertion to catch BE ↔
      contract drift.
- [x] Author `tests/test_conformance.py` — a single test that
      iterates the 6 contracts and validates a canonical success
      response against each. Belt-and-braces over the per-endpoint
      assertion; cheap.
- [x] `pnpm install` re-resolves the contracts package (no
      change); `uv sync --extra test --extra dev` from the backend
      directory installs new deps and refreshes the lock.
- [x] Run `cd workspace/apps/backend && uv run pytest` — confirm
      all 5 R13 tests + new tests pass. Target: ≥ 25 passing tests.
- [x] Run `pnpm test` from `workspace/packages/contracts` — confirm
      the OpenAPI validity test still passes (no contract files
      were edited; this is a sanity check).
- [x] Run `pnpm md:lint` — confirm 0 errors across all new + edited
      MD files.
- [x] Run `pnpm format:check` — confirm clean for R16-authored
      MDs (R02/R04/R13/promotions.md carry-overs remain — not in
      scope).
- [x] Update [datasets.md](../../design/data-management/datasets/datasets.md) + [upload.md](../../design/data-management/datasets/upload.md) with a
      one-line "Backend: R16" stamp under the round-introduced
      header.
- [x] Author
      `.agents/memory/2026-05-24-be-round-conformance-pattern.md`
      capturing the per-endpoint YAML-conformance pattern (what
      worked, what tooling, what to repeat for R17 on the FE
      side).
- [x] Cross-link: `Inherits from ← Round_15` (above); `Feeds into
→ Round_17` naming the FE-round scope.
- [x] Post-round audit per [PDCA.md](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **`additionalProperties: false` strictness.** The contracts
  forbid extra properties; FastAPI's default Pydantic v2 models
  permit them. Mitigation: set
  `model_config = ConfigDict(extra='forbid')` on every model
  matching a closed contract object. Note: this rejects
  client-side typos with 422, which is the contract's stated
  behaviour.
- **Multipart vs JSON in `POST /uploads`.** FastAPI requires
  `python-multipart` for `multipart/form-data` parsing; omitting
  it gives a confusing 422. Add to deps explicitly.
- **DuckDB `read_csv_auto` dtype inference.** DuckDB returns
  `VARCHAR`, `BIGINT`, `DOUBLE`, `BOOLEAN`, `DATE`, `TIMESTAMP`.
  The contract enum is `string|integer|float|boolean|date|datetime`.
  Mitigation: write a small dtype-mapping table in
  `app/ingest/csv_parser.py` so the wire-side dtype names are
  contract-compliant.
- **openpyxl + pandas memory footprint.** A 100 MB Excel file with
  many sheets can blow memory if loaded in one go. Mitigation: use
  `openpyxl.load_workbook(read_only=True, data_only=True)` for
  enumeration; for parse, load one sheet at a time and limit
  `sampleRows` to 10. Don't full-read at enumeration time.
- **`temp_id` collision.** `secrets.token_hex(8)` gives 64 bits of
  entropy — collision probability is negligible at this scale.
  Document, don't guard.
- **Conformance test cross-file `$ref` resolution.** Python's
  `jsonschema` package needs a registry to resolve cross-file
  `$ref`s. `referencing` is the modern way. Alternative:
  pre-resolve via `swagger-parser` invoked from a Node shell —
  rejected, keeps BE self-contained. Mitigation: write a small
  loader in `_conformance.py` that walks `_shared/*.yaml` and
  registers each schema under its file URI; if `referencing`
  proves quirky, fall back to inlining `$ref`s with a custom
  pre-pass.
- **Per-sheet parse partial-success surface.** The contract returns
  200 with body-carried per-item `status: ok|failed`. Mitigation:
  the router always returns 200 unless the request body itself is
  malformed (→ 422) or the `temp_id` is unknown (→ 404). Wrap each
  per-sheet parse in `try/except` so a single broken sheet doesn't
  fail the batch.
- **Atomic batch commit + filesystem.** SQLite transaction is
  atomic; filesystem writes are not. If filesystem writes succeed
  but the SQLite commit fails, we leak parquet files under
  `data/datasets/<ws>/<unused_ds_id>/`. Mitigation: stage writes
  under a per-commit scratch dir, only `os.rename` to the final
  location after the SQLite commit returns. If SQLite fails, the
  scratch dir is `shutil.rmtree`'d.
- **R13 in-memory tests assume process isolation.** The R13 tests
  use `reset_store_for_tests()` autouse fixture. With SQLite, the
  same surface name (`reset_db_for_tests`) clears both tables.
  Risk: if the file path is fixed and parallel pytest workers
  share it, tests interfere. Mitigation: tests run sequentially
  (pytest default); use a `tmp_path` factory to relocate the DB
  per-test if parallelism is later enabled.
- **Markdownlint `+` carry-over.** Same R07–R15 pattern. Use `-`
  bullets; avoid `+` at start of continuation lines.

## Do

- **Round_16.md authored and flipped to `In Progress`.** Single
  feature (the upload backend) per the round-cadence rule; multi-
  endpoint per the contract-round methodology (phase separation,
  not file count). Status flipped on the same commit as the Plan
  draft so the Do log starts immediately.
- **Backend dependency additions.** `pyproject.toml` runtime deps
  extended by `openpyxl==3.1.5`, `pandas==2.2.3`, `pyarrow==18.1.0`
  (pandas parquet backend; pulled in mid-run when the first commit
  test surfaced the missing engine), `python-multipart==0.0.20`,
  `pyyaml==6.0.2`, `jsonschema==4.23.0`, `referencing==0.35.1`.
  `uv sync --extra test --extra dev` re-resolved the lock cleanly;
  16 packages installed, no version conflicts. `pyarrow` was the
  one mid-round addition not in the original Plan — it surfaced as
  a `pandas.DataFrame.to_parquet` import error during the first
  full pytest run.
- **`.gitignore` extended** with `workspace/apps/backend/data/` so
  the SQLite file + temp / committed upload trees never enter git.
- **`app/db.py` authored** —
  [`workspace/apps/backend/app/db.py`](../../../workspace/apps/backend/app/db.py).
  `get_conn()` is a context manager yielding a `sqlite3.Connection`
  with `Row` factory and `PRAGMA foreign_keys = ON`. `bootstrap_schema()`
  creates both tables idempotently. `set_db_path(...)` allows
  tests to relocate the DB to a per-test `tmp_path`. The schema
  bootstraps from a single `executescript` block so adding a new
  table later is a one-line append.
- **FastAPI `lifespan` wired in `app/main.py`.** Calls
  `bootstrap_schema()` on startup. The reverted R15 bootstrapped
  at module-import; doing so at lifespan time means tests can swap
  `MDD_DB_PATH` / `set_db_path(...)` before the app starts and
  pick up the fresh location.
- **Pydantic models authored** at
  [`app/models/common.py`](../../../workspace/apps/backend/app/models/common.py).
  Every closed contract object uses
  `model_config = ConfigDict(extra='forbid')`. `Dtype` and
  `SourceFormat` are `Literal` aliases — matching the contract
  enums and giving editor autocomplete. Id-typed fields (`WsId`,
  `DsId`, `TempId`) are `Annotated[str, Field(pattern=...)]` for
  the same id patterns the contract enforces.
- **Workspaces router migrated to SQLite.** Same wire shape, same
  id pattern, same sort order. `reset_store_for_tests()` removed
  in favour of the conftest-level `tmp_path` isolation. A new
  fifth workspaces test (`test_workspaces_survive_reconnect`)
  confirms data persists across two `TestClient` lifecycles
  against the same DB file — the surface invariant the R13 in-
  memory store didn't have.
- **Ingest helpers landed** under
  [`app/ingest/`](../../../workspace/apps/backend/app/ingest/) —
  `csv_parser.parse_csv(path)` via DuckDB `read_csv_auto` with a
  small DuckDB → contract dtype mapping table; `excel_parser`'s
  `enumerate_sheets(path)` via openpyxl read-only mode and
  `parse_sheet(path, sheet, range_, has_header)` via openpyxl +
  pandas. Mid-round addition: `parse_csv` rejects empty files
  with `CsvParseError("empty file")` so the contract's 422 path
  is reachable; DuckDB itself accepts empties.
- **Uploads router authored** at
  [`app/routers/uploads.py`](../../../workspace/apps/backend/app/routers/uploads.py).
  `POST /uploads` validates source/format extension match (415),
  size (413), parseability (CSV 422), then writes
  `data/uploads_tmp/<temp_id>/{original.<ext>, meta.json}`.
  Response shape branches on `sourceFormat`. `POST /uploads/{temp_id}/parse`
  rejects unknown temp ids (404), validates the requested sheet
  names exist (422), then per-sheet returns either `status: ok`
  with columns + rowCount + sampleRows or `status: failed` with
  `error` + `detail`. Per-sheet failures are body-carried — the
  HTTP status stays 200 unless the request itself is malformed.
- **Datasets router authored** at
  [`app/routers/datasets.py`](../../../workspace/apps/backend/app/routers/datasets.py).
  Batch commit follows the "validate every item up front; write
  filesystem trees; commit SQLite transaction" sequence. Failure
  at any point during writes triggers `shutil.rmtree` on the
  partially-created dataset dirs, so the filesystem never leads the
  DB by more than one in-progress commit. `GET /datasets` honors
  the optional `workspace_id` query param. Both routes carry
  `response_model_exclude_none=True` so the contract's
  conditional-presence shape for `sheetName` is respected.
- **Routers registered** in `app/main.py` alongside the existing
  workspaces router. App now exposes 11 routes (was 5 in R13 +
  health).
- **Conformance helper authored** at
  [`tests/_conformance.py`](../../../workspace/apps/backend/tests/_conformance.py).
  ~60 LOC: YAML load via `pyyaml`, recursive `$ref` inlining for
  both same-doc (`#/...`) and cross-file
  (`../_shared/<x>.yaml#/...`) references, OpenAPI response-
  schema extraction, validation via `jsonschema.Draft202012Validator`.
  Chose the hand-rolled inliner over `referencing` after a
  10-minute side-by-side — the inliner is ~30 LOC and produces a
  fully-resolved schema dict that's trivial to print and debug.
  See the BE conformance memo for the full rationale.
- **Per-endpoint tests authored.** Test counts (all `unit` mark):
  `test_workspaces.py` 5 (was 4 R13), `test_uploads_post.py` 5,
  `test_uploads_parse.py` 5, `test_datasets_batch.py` 7,
  `test_datasets_list.py` 4, `test_conformance.py` 1
  (`@pytest.mark.contract`), `test_health.py` 1 (unchanged).
  Total: **28 tests pass**.
- **Mid-run learnings caught by the conformance net.**
  - The first dataset-commit test reported
    `jsonschema.ValidationError: None is not of type 'string'` for
    `sheetName` on a CSV commit — caught by the per-endpoint
    `validate_response(...)`. Root cause: Pydantic serializes `None`
    as `null`; the contract says `sheetName` is present iff
    `sourceFormat === 'excel'`. Fix: `response_model_exclude_none=True`.
  - First parquet write attempt errored on `pyarrow` import. Fix:
    added `pyarrow==18.1.0` to runtime deps.
  - Both are the contract round paying its dividend: cheap test-
    time failure now instead of expensive integration-time failure
    when R17 lands.
- **Baseline elsewhere preserved.** `pnpm --filter @mdd/contracts test`
  7 passed; `pnpm --filter @mdd/ui test` 26 passed; `pnpm --filter
builder test` 8 passed; backend pytest 28 passed. **69 total
  tests pass across 4 packages** (was 46 pre-R16; net +23 from
  the new BE tests + 1 added workspaces persistence test).
- **`pnpm md:lint` and `pnpm format:check` clean.** Mid-round
  fix: the new backend `.venv/` directories shipped vendored
  `.md` license files into the lint scope. Extended
  [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
  with `**/.venv/**` and `**/venv/**` ignores so nested venvs are
  filtered. Round_04.md remains the one carry-over Prettier
  warning (per R15's Act); R16-authored files all clean.
- **Cross-links added** to `datasets.md` and `upload.md` under a
  new `**Backend**:` line pointing at this round. Design ↔
  implementation is one click away in both directions.
- **Memory memo authored** at
  [`2026-05-24-be-round-conformance-pattern.md`](../../memory/2026-05-24-be-round-conformance-pattern.md)
  capturing the conformance pattern, the `extra='forbid'` +
  `exclude_none` discipline, and the rollback-staging shape for
  atomic batch commits. Linked to the R15 contract-round memo via
  `[[2026-05-24-contract-round-methodology]]`.

## Check

- [x] `workspace/apps/backend/pyproject.toml` lists the new runtime
      deps; `uv.lock` resolves cleanly; `uv sync` from the backend
      succeeds.
- [x] `apps/backend/data/` is gitignored; SQLite file is created
      at app startup and not committed.
- [x] `app/db.py` exports `get_conn()` + `bootstrap_schema()`;
      lifespan call site in `app/main.py` exists.
- [x] R13 workspaces tests (4 of them) still pass against the
      SQLite-backed router with no wire-shape changes.
- [x] `POST /uploads` accepts CSV (200 + `TempUploadCsv`), Excel
      (200 + `TempUploadExcel`), and rejects oversize (413),
      mismatched format (415), unparseable CSV (422).
- [x] `POST /uploads/{temp_id}/parse` returns 200 with mixed
      ok/failed per-sheet results; 404 on unknown `temp_id`; 422
      on malformed body.
- [x] `POST /workspaces/{id}/datasets/batch` commits atomically;
      returns 201 + dataset array in request order. 404 on unknown
      workspace OR unknown `temp_id`. 409 on column-override
      conflicts. 422 on `target_dataset_id` set, empty items, or
      excluded-columns leaving zero columns.
- [x] `GET /datasets[?workspace_id=…]` returns datasets
      most-recent-first; empty array under filters with no match.
- [x] `tests/test_conformance.py` validates a canonical success
      response from each of the 6 endpoints against its YAML.
      Each per-endpoint test file also includes one
      `validate_response(...)` assertion on its primary success
      path.
- [x] `cd workspace/apps/backend && uv run pytest` returns 0
      failures with ≥ 25 tests passing.
- [x] `pnpm test` from `workspace/packages/contracts` still passes
      (no contract YAML edited).
- [x] `pnpm md:lint` clean.
- [x] `pnpm format:check` clean for R16-authored files (R02 /
      R04 / R13 / promotions.md carry-overs remain).
- [x] Methodology memo (`2026-05-24-be-round-conformance-pattern.md`)
      captured in `.agents/memory/`.
- [x] Cross-links present.

## Act

**Status**: Complete (human-approved 2026-05-24).

**Learnings**:

- **Conformance helper paid for itself on day one.** Two BE-side
  drifts (`sheetName: null` vs "present iff excel"; missing
  `pyarrow` engine on `to_parquet`) both surfaced as test failures
  on the first run of the new endpoint tests — exactly the "pain
  first" property the contract round is designed to deliver. Cost
  to catch each: ~30 seconds and one targeted fix. Cost without
  the conformance net: discovered in R17 (FE round) or worse, at
  manual demo time. Same payoff signature as R15's `nullable: true`
  ↔ `type: [..., null]` catch, but on the implementation side this
  time.
- **`response_model_exclude_none=True` is the missing link between
  Pydantic and OpenAPI "Present iff …".** OpenAPI's
  conditional-presence shape doesn't permit `null` — only
  absence. Pydantic defaults to "always present, value can be
  None." `response_model_exclude_none=True` is the route-level
  bridge. Worth documenting because Pydantic's own docs don't
  surface this against OpenAPI consumers as cleanly as they
  could.
- **`extra='forbid'` mirrors `additionalProperties: false`.** Easy
  to forget on Pydantic models; easy to spot when a request that
  the contract should reject silently passes through. Mechanical
  to apply once the rule is named.
- **Hand-rolled `$ref` inliner beat the library route.** 30 LOC
  of recursion + memoisation gave a fully-resolved schema dict
  that's print-friendly. `referencing` / `prance` / similar each
  brought their own resolver semantics and would have made
  debugging a future drift harder, not easier. The Evolution
  Rule's "default = don't add" guard correctly steered toward the
  hand-rolled path; revisit if the contract count passes 3+ and
  the inliner needs to handle features it currently doesn't (e.g.,
  nested `allOf` resolution).
- **Atomic batch commit sequence: validate, write filesystem,
  commit DB, with file rollback on DB failure.** Worked cleanly
  for both single-item CSV and multi-item Excel commits. The
  rmtree-on-failure path is exercised by the negative tests (409
  on missing-column override, 422 on excluded-columns leaving
  zero, etc.) — DB rollback is automatic because we only call
  `commit()` inside the try-block; SQLite's auto-rollback handles
  the rest.
- **`lifespan` over module-import-time bootstrap.** The reverted
  R15's persistence drift had bootstrapped at import time;
  re-doing it as a FastAPI `lifespan` made per-test DB isolation
  (`tmp_path` + `set_db_path`) drop-in. Tests are hermetic; no
  cross-test bleed; parallel-safe if pytest-xdist ever joins.

**Promotions** _(decision: none this round)_:

- The 4-round contract methodology now has its second concrete
  instance (R15 contract round + R16 BE round). One more
  successful instance (R17 FE round) and the promotion-to-`context/`
  bar is met. R17's Act re-evaluates.
- The conformance pattern is captured in the BE-round memo but
  is BE-specific until R17 lands a mirror on the FE side. Don't
  promote it standalone; promote it (with the FE companion) as
  part of the unified 4-round methodology promotion.
- Build-first lesson + AntD-wrapper-testing pattern still
  deferred from R12–R14. The 4-round methodology research is the
  active focus; folding other promotions in would dilute the
  lesson sequence.

**Follow-ups (not promotions, just notes):**

- **R17 imports the contracts package's TS types.** Today the
  contracts package has no exports. R17's Plan-phase should
  decide: add a `types.ts` to `@mdd/contracts` and re-export from
  the package, OR hand-write types in
  `apps/builder/src/features/data-management/datasets/types.ts`.
  The methodology memo leans toward the latter for R17
  (hand-aligned discipline, codegen comes later). Either is fine.
- **End-to-end (Playwright + real BE) lands in a later round.**
  R16 + R17 land in sequence (per R15 Q5); the e2e harness is
  separate track-2 work. Until then, the contract is the
  coordination primitive.
- **24h temp-upload sweep.** Documented in the contract; not
  implemented. Add when the dev disk first complains.
- **Request-body conformance test** (the BE side validating
  incoming bodies against the YAML beyond what Pydantic checks).
  Probably not needed until a real drift surfaces.

## Questions for user before next round

R17 implements the **frontend** wizard + datasets table against
R15's locked contracts + R16's running backend. Per the
`../../memory/feedback_round_cadence.md`,
single-feature scope; per the 4-round methodology, R17 implements
contracts only — no design churn, no BE changes.

1. **Wizard state — page-local `useReducer` vs lifting to a
   Zustand slice?** Lean: page-local reducer (single page, no
   cross-page survival; existing TanStack Query already covers
   server-data state).
2. **Parse step — sequential `useMutation` per click vs batched
   "Parse all sheets" up front?** Lean: per-sheet on demand
   matches the design (user selects sheets, then advances).
   Batched would round-trip more but renders all-at-once; either
   maps cleanly to the contract.
3. **AntD `Upload.Dragger` vs a custom drop zone?** Lean:
   `Upload.Dragger` (matches the design preview, behaviour is
   already wired).
4. **R17 commits to `@mdd/contracts` TS types as a sibling export,
   or to hand-written types in the feature folder?** Lean:
   hand-written in the feature folder (matches R16's Pydantic
   discipline; codegen lands when 3+ contracts drift).
5. **Should R17 also land a minimal MSW harness for the wizard, or
   defer per R15's plan?** Lean: defer (MSW is its own track-2
   round when the FE consumer arrives; R17 hits the live BE
   directly).

## Feeds into → Round_17 (TBD)

What R16 hands forward:

- **A running upload backend** at the locked contract URLs:
  `POST /uploads`, `POST /uploads/{temp_id}/parse`,
  `POST /workspaces/{id}/datasets/batch`, `GET /datasets`. R17
  hits these from the wizard UI directly.
- **The "BE conformance against an OpenAPI YAML" pattern** —
  documented in `.agents/memory/2026-05-24-be-round-conformance-
pattern.md`. R17 mirrors it with TS-side type alignment: hand-
  written types, one per-endpoint type-test, and (when the
  contract round gets a future MSW companion) a request-side
  conformance check.
- **SQLite + filesystem layout** — R17 doesn't care about
  storage details, but the dataset rows it lists / displays are
  populated from `data/datasets/`. Useful context when
  debugging end-to-end flows.

**R17 scope** (FE round — outlines only, R17's own Plan-phase
confirms):

- TS types in `apps/builder/src/features/data-management/datasets/types.ts`
  matching the 6 YAML contracts. Hand-aligned (no codegen).
- `useUploadInitMutation`, `useUploadParseMutation`,
  `useDatasetsCommitMutation`, `useDatasetsQuery` — TanStack
  Query hooks against the live backend.
- Wizard pages: `DatasetNewPage` shell, `UploadSourceStep`,
  `UploadSheetStep` (Excel), `UploadMetadataStep`,
  `UploadPreviewStep`, `UploadConfirmStep`.
- `DatasetsPage` table + `WorkspaceFilter`.

End-of-round Q&A for the user (resolved before R17 starts):

1. **Wizard state — global Zustand vs page-local `useReducer`?**
   Lean: page-local reducer (single page, no cross-page survival).
2. **Polling vs blocking for parse step?** Lean: blocking
   (sub-second on small files; `useMutation` is straightforward;
   add polling later if a real long-tail emerges).
3. **AntD `Upload.Dragger` vs a custom drop zone?** Lean:
   `Upload.Dragger` (matches the design preview, behaviour is
   already wired).
