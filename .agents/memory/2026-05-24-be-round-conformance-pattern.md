# BE round — OpenAPI YAML conformance pattern

**Date**: 2026-05-24
**Agent**: claude-opus-4-7
**Confidence**: Medium (one BE round; pairs with the contract-round
methodology memo from R15)
**Status**: Promoted
**Promoted to**: [`context/contract-driven-feature.md`](../context/_archive/contract-driven-feature.md)
([Round_18](../plan/cycles/Round_18.md), 2026-05-24)

## Problem

R15 introduced the 4-round-per-feature shape (Design → Contract →
BE → FE) with OpenAPI 3.1 YAML as the authoritative wire shape and
Markdown as the rationale annotation. R16 was the first BE round
under that shape. The question this memo answers: **what does
"the BE implements against the contract" actually look like in
code?** Where does conformance live, how cheap is it to maintain,
and what tooling makes it stick?

## Finding

Per-endpoint conformance lives in a single helper used from every
test file, plus one cross-cutting smoke test:

```text
backend/tests/
├── _conformance.py        ← helper: load YAML + inline $refs + validate
├── test_<endpoint>.py     ← per-endpoint tests, each with one
│                            validate_response(...) on the happy
│                            path
└── test_conformance.py    ← belt-and-braces sweep: one canonical
                              response per endpoint, validated
                              against the same helper
```

The helper has three jobs: (1) load the contract YAML; (2)
recursively inline every `$ref` (cross-file and same-doc) into a
single fully-expanded schema dict; (3) extract the response schema
for a given status code + content type and pass it to
`jsonschema.Draft202012Validator.validate(...)`.

**Per-endpoint assertion + cross-cutting sweep is the right
shape.** The per-endpoint assertion catches drift the moment it
happens, with the relevant test as the failure narrative. The
cross-cutting sweep catches the case where a future agent forgets
to add the per-endpoint assertion at all. Both are cheap to run;
both stay co-located with the BE code.

**Inline `$ref`s once at load time, not lazily.** OpenAPI tooling
that resolves `$ref` lazily creates harder-to-debug failures
("type missing" errors deep inside the validator). Walking the
loaded dict once and substituting every `$ref` with the resolved
schema produces a self-contained dict that's trivial to inspect
when something fails.

**`exclude_none=True` for optional response fields.** OpenAPI says
"present iff X"; Pydantic defaults to "always present, maybe
null". The contract YAML doesn't permit null for `sheetName` —
it permits absence. `response_model_exclude_none=True` on the
relevant routes is the bridge. Catch this at the per-endpoint
conformance test and you catch it before the FE arrives.

**Hand-written Pydantic with `extra='forbid'` matches the contract's
`additionalProperties: false`.** Closed objects in the YAML must be
closed on the Python side too. Without `extra='forbid'`, a typo'd
client field silently gets ignored. The closed-by-default
discipline mirrors the contract.

**Shape conformance ≠ behavior conformance.** _(Amended R22 from
two-instance evidence.)_ A field accepted by the contract and
parsed into the request model can still be ignored end-to-end.
The original R16 conformance net asserted wire shape was honored
— it did not catch that CSV `parse_options` were parsed and then
discarded inside the CSV commit path. R20 closed that gap with
behavior tests (dispatch the input → assert the observable result
changes accordingly), and R21 mirrored the pattern on the FE
reducer (dispatch the action → assert the next-state reflects the
effect, not just that the action was accepted). Sub-rule: **every
field the contract accepts gets one behavior test**, in addition
to its shape coverage. The two instances (BE in
[Round_20](../plan/cycles/Round_20.md); FE reducer in
[Round_21](../plan/cycles/Round_21.md)) prove the rule transfers
across the wire boundary.

## Evidence

- **R16 round file**:
  [.agents/plan/cycles/Round_16.md](../plan/cycles/Round_16.md) —
  the BE round that established the pattern.
- **Conformance helper**:
  [`tests/_conformance.py`](../../workspace/apps/backend/tests/_conformance.py)
  — ~60 lines: YAML load, recursive `$ref` inlining, response
  schema extraction, `Draft202012Validator.validate`.
- **Per-endpoint use sites**: every R16 test file (`test_workspaces.py`,
  `test_uploads_post.py`, `test_uploads_parse.py`,
  `test_datasets_batch.py`, `test_datasets_list.py`) imports
  `validate_response` and asserts at least one canonical success
  body conforms to its YAML.
- **Cross-cutting smoke test**: `tests/test_conformance.py` walks
  all six R15 contracts end-to-end in a single test.
- **Drift caught at test time**: the `sheetName: null` ↔ "present
  iff excel" mismatch surfaced on the first run of the dataset
  tests — exactly the "fail loudly" property the contract chain is
  designed to deliver, but on the BE side this time instead of
  the contract-author side (R15 caught `nullable: true` vs
  3.1's `type: [..., null]`).

## Recommendation

**Do**:

- **One helper, two callers per endpoint.** The helper is the
  single source of YAML-loading + ref-resolution + validator wiring.
  Per-endpoint tests call it once on a happy-path body; the
  cross-cutting smoke test calls it once per endpoint.
- **`extra='forbid'` on every Pydantic model that mirrors a
  closed contract object.** Without this, the BE silently accepts
  what the contract rejects. Catching at request-time is much
  better than the FE discovering the laxity.
- **`response_model_exclude_none=True` on routes whose contract
  marks fields conditionally present.** The YAML's
  "Present iff …" wording maps to `exclude_none`, not to
  `null`-as-value.
- **Hand-derive the DuckDB / pandas / openpyxl dtype mapping
  table.** OpenAPI's enum (`string|integer|float|boolean|date|datetime`)
  doesn't map 1:1 to any single library's dtype names. Keeping the
  mapping in a small dict next to the parser keeps drift local
  and visible.
- **Atomic commit = "stage files, then commit DB, then promote";
  or "validate everything first, then write everything, then
  commit DB."** R16 chose the second. Either is fine; what's not
  fine is committing DB rows that reference files not yet
  written, or writing files keyed to DB rows that may never get
  inserted. Tests on the rollback path confirm the no-dangling
  invariant.
- **Every accepted field gets one behavior test.** _(Amended R22.)_
  Shape conformance accepts the field; the behavior test asserts
  the field actually moves the system. Without it, silent-ignore
  bugs slip through (the R16 carry-over R20 closed). Applies on
  both sides of the wire: BE accepts `parse_options` → assert the
  parsed payload reflects them; FE dispatches an action → assert
  the next state shows the effect. One test per field is the
  density — exhaustive matrices are not the goal; observable
  effect is.

**Don't**:

- **Don't trust `swagger-parser`-equivalent libraries to expose
  inlined schemas in Python.** The OpenAPI Python tooling space
  is fragmented (`openapi-schema-validator`,
  `openapi-spec-validator`, `prance`, etc.). A 60-line
  hand-rolled inliner is more legible and easier to debug than
  any of them; reach for a library only when the contract count
  passes the Evolution Rule's 3+ threshold.
- **Don't validate every test response.** One canonical happy
  path per endpoint is the right density — error paths
  (404 / 422 / 409 / 413 / 415) are validated by their status
  code, not by schema conformance, because most contracts
  intentionally leave error bodies loose.
- **Don't auto-generate Pydantic models from the YAML.** Same
  reason as the contract round: hand alignment is the discipline.
  Codegen lands when 3+ contracts exist and a real drift has
  bitten.
- **Don't bootstrap SQLite schema at module-import time.** The
  drifted R15's failure mode. Use FastAPI's `lifespan` so the
  schema lives in the same lifecycle as the app itself, which
  also makes per-test DB swapping (via env var + `set_db_path`)
  trivial.

## Open questions for future rounds

- **Request-body conformance from the BE side.** R16 validates BE
  responses against the YAML; it does not validate incoming
  request bodies, because FastAPI's Pydantic already does that.
  But the Pydantic models are hand-aligned to the YAML — if they
  drift, the BE accepts requests the contract rejects. Lean:
  add request-body conformance only if a real drift bites; the
  hand-alignment discipline is the first line of defense.
- **End-to-end (BE-up + FE-against-real-BE) conformance.** R16's
  conformance is via FastAPI's `TestClient`. R17 will add FE
  type-tests against the YAML and (eventually) a Playwright
  harness against a real BE. The complete chain becomes: YAML →
  BE Pydantic → BE conformance test → FE TS types → FE type
  test → Playwright. Each layer is independently cheap; the
  composite is the regression net.
- **Conformance helper distribution.** R16's helper lives in
  `backend/tests/_conformance.py`. If R17 lands a parallel
  TS-side helper, the two share a name pattern (`_conformance`)
  but not code. Lean: keep separate per-language helpers until
  a third language joins; cross-language sharing is YAGNI.

## Promotion Candidate?

- [x] `context/` — promoted in [Round_18](../plan/cycles/Round_18.md)
      to [`context/contract-driven-feature.md`](../context/_archive/contract-driven-feature.md),
      bundled with the contract-round and FE-round memos under
      the single DCBF rule.
- [ ] `skills/` — still possibly, once the pattern is reusable
      across multi-language stacks (Node BE + Python FE, etc.).
      Several rounds out.

See also: [[2026-05-24-contract-round-methodology]] — the R15 memo
this pattern extends.
