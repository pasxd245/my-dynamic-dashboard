# Round 194: typed parameters — the engine (item 3.7a)

**Status**: Review — built and reviewed (BA twice, code review twice, QA: no open P0/P1). No UI this round: the owner's walk of parameters happens with 3.7b's UI (Round_195), whose walk exercises this engine end to end.
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — typed query parameters (engine).

- **Declaring and using a parameter:** a query declares `params` (≤ 8; `date | number | string`;
  optional default, and a date default may be "today ± n days" in `backend.time_zone`). It writes
  `{"param": name}` in filter atoms, filter-step and `case` WHEN operands, and nowhere else.
- **Picking the value on a read:** each read resolves the parameters the query uses in this order:
  viewer (`p.<name>` / `params`), then the dashboard's saved value (read by the server from
  `dashboard` + `widget`), then the default. If none applies the read refuses with `422
param_unbound`, listing every parameter still missing. A value that doesn't fit is
  `param_invalid`, which names the expected type and the level the value came from; a reversed
  range is reported as `range_reversed`.
- **Echoing what was used:** every read echoes `resolvedParams`. A query without parameters
  answers exactly as before; QA checked this byte for byte against the previous commit on 11
  query shapes.
- **Date parameters on datetime columns** compare by calendar day.
- **Export:** XLSX gains a Parameters block, and both formats carry `X-MDD-Params`.
- **Workflows:** sources run on their defaults, with one "today" for the whole run. The run stamp
  (and therefore published lineage) records the values. A source parameter without a default
  refuses the run, naming the parameter and the source.

**Studied** — the reviewers' best catch: a value that is valid for its type but wrong for its column
(5.5 on an integer column, a reversed range) used to surface as `409 query_stale`, which blames the
query for a viewer's input. Binding now checks these, so a bad value is named as `param_invalid`
instead of being reported as drift.

## Goal

**Inherits from ← [Round_193](Round_193.md)**: a manager can freeze a week's numbers as a read-only copy.

This round is the other half: the same report can be re-read for a different period without
rewriting a query. A query declares typed parameters, and its filter operands use them. Every read
picks a value (viewer → dashboard → default) and says which value it used.

_Track: 1 (product). Pulled by: release program item 3.7 (typed parameters, starting with `as_of`)
and the accepted design `dashboards/dashboard-filters.md` D1–D3, D6, D7 — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- `QueryDefinition.params` (≤ 8; `date | number | string`; optional default; a date default may be
  relative) and `{"param": name}` operands, allowed only in the D2 places.
- Save checks return 422 naming the field.
- Reads resolve values in this order: viewer, then dashboard, then default, otherwise
  `422 param_unbound`. A wrong-typed value gives `422 param_invalid`.
  - `GET /rows` takes `p.<name>`.
  - `/aggregate`, `/totals`, `/export` and preview take `params` (and `dashboard`).
  - Every read that resolved a parameter answers `resolvedParams`. A query without params answers
    exactly as before.
- `backend.time_zone` resolves `today`.
- Workflow sources run on defaults only. The run stamps `sources[].params`, and a run whose source
  parameter has no default is refused, naming both the parameter and the source.
- The export carries a `Parameters` block (XLSX) and an `X-MDD-Params` header (CSV).

**Falsified if** any of these happens:

- a value lands in the stored definition;
- two `as_of` values change the `definitionVersion`;
- a query without params answers differently from rc.2;
- a reference is accepted outside D2;
- a read guesses a value.

- [x] **D** — no new design doc. `dashboard-filters.md` (Accepted) is the design; wire choices
      are recorded in Do.
- [x] **C** — contracts: `_shared/query.yaml`, `_shared/api-error.yaml`, `_shared/workflow.yaml`,
      `queries/{rows-get, aggregate, totals, export, preview}`, `workflows/{run-post, post, put}`.
      BA review at Contract exit.
- [x] **B** — `app/params.py` (resolve, bind, save checks, `today` in the zone); reads, preview, save;
      workflow sources + stamp; export block + header; tests (design criteria 1–4, 7 params part, 8)
- [x] **F** — MSW and builder types only (the builder UI is 3.7b)
- [x] Reviews: code review, QA, BA after build — rc3.md § Execution

## Risks / unknowns

- **A read path that skips binding** would hand `{"param": …}` to the engine. Mitigation: bind
  centrally, right after a definition is loaded, at every load site (queries router, workflow
  source resolution, resolved columns). A test reads every path with a parameterised query.
- **Byte-identity for queries without params.** `params` is stored as `null` when absent (the hash
  drops nulls) and omitted on the wire; `resolvedParams` is omitted unless something was resolved.
- **Column-family check inside steps** needs the column space at the step's position; computed
  per step from the step plan.

## Do

- 2026-10-18 — D: none new; `dashboard-filters.md` D1–D7 accepted 2026-10-18.

- **BA review at Contract exit: CHANGES** (P1 ×3, P2 ×4). Folded in before code:
  - **F1** — the client-asserted `dashboardParams` is replaced by `dashboard: {id, widgetId}`
    (`dashboard=` + `widget=` on `GET /rows`, the widget load path). The server reads that
    dashboard's saved control values itself. That level is empty until 3.7b adds `controls`, so a
    "dashboard" source can never be a client's say-so.
  - **F2** — only parameters the definition **uses** are resolved, required and echoed (and stamped
    on a run). A declared but unused parameter never claims to have been applied.
  - **F3** — a `date` parameter on a `datetime` column compares by calendar day (lower bounds 00:00,
    upper bounds end of day). `equals` / `ne` / `in` / `not_in` there are refused at save.
  - P2s folded: `label`, `expected`, `source` on the errors; ≤ 24 values; `X-MDD-Params` as ASCII
    JSON on both formats; workflow notes (refs refused, `today` never makes a run stale).
  - Kept: an undeclared `p.` value is ignored silently (D5).

### B, F and the reviews

- **B (`d681839`).** `app/params.py`:
  - resolve: used parameters only;
  - bind: day semantics on datetime; step dtypes folded per step;
  - save checks;
  - `today()` in the zone;
  - the dashboard level, read from `controls`.

  Routes wired:
  - rows `p.`, `dashboard`, `widget`;
  - aggregate, totals, export, preview;
  - save and preview checks, using placeholders;
  - the workflow source resolution and its stamp;
  - XLSX block + header;
  - CORS.

  Builder: types and the error union. 13 pytest.

- **Reviews after build:**
  - **Code review: CHANGES.** P1 ×3: a non-whole number on an integer column → 409; a huge
    integer → 500; a reversed `between` → 409. Plus 6 P2s.
  - **QA: CHANGES.** The same P1, plus a byte-identical regression proof over 11 shapes at HEAD
    vs `9532064`; P2 ×3 plus one pre-existing bug (a non-ASCII export title → 500).
  - **BA: PASS.** P2 ×7: `missing[]`; an empty value counts as none; the widget must show the
    query; test gaps; a CSV that does not say its period; the stamp re-resolving `today`.
- **Fix (`6c17a89` + close-out):**
  - whole numbers on integer sites; ±2^63 and ASCII decimals only; strict JSON values;
  - `range_reversed`, including a string literal bound and `source: default`;
  - `missing[]`; an empty value counts as none;
  - the widget must show the query;
  - `one_today` per run;
  - `site_dtypes` with between-aware placeholders;
  - RFC 5987 `filename*` for a non-ASCII export title (a plain ASCII header is unchanged).

  Code review re-check: **PASS**. +6 pytest.

### C — what changed in the contracts

- `_shared/query.yaml`:
  - new `Operand` (literal or `ParamRef`), `ParamRef`, `RelativeDate`, `QueryParam`,
    `ParamValues`, `DashboardRef`, `ResolvedParams`;
  - atom and filter-step operands are now `Operand`;
  - `QueryDefinition.params` (≤ 8);
  - `AggregateRequest.params` / `dashboard` (`DashboardRef`).
- `_shared/api-error.yaml`: `ApiErrorParamUnbound` (`param`, and `sourceId` on a run) and
  `ApiErrorParamInvalid`. The closed code enum gains `read_only_workspace` (missed in R193),
  `param_unbound` and `param_invalid`.
- `_shared/workflow.yaml`: `WorkflowRunSource.params`.
- `rows-get`: `p.<name>`, `resolvedParams`, 422 `oneOf`.
- `aggregate`, `totals`, `export`, `preview`: `params` (+ `dashboard` except preview), and
  `resolvedParams` (for export: the `X-MDD-Params` header).
- `run-post`: 422 `param_unbound`.
- `post` / `put` workflows: a step reference is refused.
- `values.yaml`: `backend.time_zone: UTC`, plus the two codes.

## Check

- [x] backend 645 · builder 513 · contracts 48 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Design criteria 1–4, 7 (params part), 8 as tests (`tests/test_params.py`, 19), plus QA's
      byte-identical regression proof for queries without parameters
- [x] BA · code review · QA — no open P0/P1
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** — with Round_195 (the UI that drives this engine); none on its own.

## Act

- Rolling log: four rows.
  - A saved CSV doesn't say its period (the values ride only in a header). A filename suffix is
    for 3.7b or the owner.
  - The reach badge needs the "used parameters" rule. 3.7b either mirrors it or the API exposes
    it.
  - A `today` default that moves past a literal bound refuses with `range_reversed`
    (`source: default`) instead of answering an empty result. To be revisited with 4.2 presets.
  - Pre-existing and fixed here: a non-ASCII export title.
- Promotion: none. Candidate lesson (memory, if it recurs): when a value is bound late, make sure
  the engine's later validation cannot report the value's fault as drift. Check the value at bind
  time, against the column it lands on.
- Prune check: the code review found the three P1s that QA and the BA did not (QA found one of
  them). The loop earns its place.

## Feeds into → Round_195

Item 3.7b covers the builder side:

- the query page's Parameters panel and "Use parameter" switch;
- dashboard `controls` (`kind: param`), the bar, URL `p.*`, Reset to saved, Copy link;
- the reach badge.
