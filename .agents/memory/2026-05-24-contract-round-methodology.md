# Contract round — the 4-round-per-feature methodology

**Date**: 2026-05-24
**Agent**: claude-opus-4-7
**Confidence**: Medium (one instance; track-2/3 research)
**Status**: New

## Problem

How should rounds be shaped when the work spans both backend and
frontend? Prior rounds (R12, R13) used **vertical slices** —
each round shipped one feature end-to-end across both layers.
That worked for shippable cadence but bundled multiple kinds of
work (BE shape decisions, FE state decisions, integration
glue) into one round, making cross-round lessons hard to extract.

User framing (2026-05-24 brainstorm): _"We are practicing to
get lesson-learn when implementing track 2&3 for self-evo,
autopilot."_ The cadence question is also a research question —
the round shape **is** the agent-method finding.

## Finding

R15 introduced a **4-round-per-feature** shape, named D in the
brainstorm:

```text
Round N     — Design        (md + optional preview)
Round N+1   — Contract      (OpenAPI YAML + rationale MD)
Round N+2   — Backend       (implements against the locked contract)
Round N+3   — Frontend      (implements against the locked contract)
```

The contract is the **unit of agent coordination**. Two parallel
agents (or two future-Claude sessions) can implement BE and FE
independently if the contract is the authoritative source of
truth. This is the foundational pattern for any multi-agent
system — including the track-3 self-evo orchestrator that calls
sub-agents.

**Per-endpoint contracts.** Not per-feature. Each `<verb>.contract.yaml`
covers one endpoint; cross-endpoint types live in `_shared/` and
are referenced via `$ref`. Smallest atomic boundary for an
autopilot agent assigned "implement endpoint X."

**Multi-contract per round is fine.** A contract round can author
all of a feature's endpoint contracts together — the 4-round
shape is about phase separation, not file count. R15 authored 6
endpoint contracts (4 new for the upload feature + 2 retroactive
for workspaces) in one round.

**YAML is authoritative, MD is annotation.** OpenAPI 3.1 YAML
defines the wire shape (machines validate against it). The
paired `<verb>.contract.md` captures the **why**: behavior
semantics (idempotency, ordering, retry safety), error meaning,
worked examples, cross-links. The MD does not redefine shape —
it annotates it. User framing: _"the contract md file mostly not
the definition, but the info for both HIxAI to better understand
the contract."_

**"Fail loudly, pain first."** The contract round forces shape
decisions before either implementation. Schema validators catch
malformed YAML at test time; BE conformance tests (R16+) catch
backend drift; FE type-checking + future MSW catch frontend
drift. The "pain first" of contract authoring substitutes for the
hidden cost of late integration bugs.

## Evidence

- **R15 round file**:
  [.agents/plan/cycles/Round_15.md](../plan/cycles/Round_15.md) —
  full PDCA for the first contract round.
- **R15 deliverables**:
  - [`workspace/packages/contracts/`](../../workspace/packages/contracts/) —
    new `@mdd/contracts` workspace package
  - 6 endpoint contracts authored as `<verb>.contract.{yaml,md}`
    pairs across `workspaces/`, `uploads/`, `datasets/`
  - 6 shared type files in `_shared/`
  - OpenAPI validity test at
    [`tests/openapi-validity.test.ts`](../../workspace/packages/contracts/tests/openapi-validity.test.ts) —
    iterates every `*.contract.yaml`, validates via
    `@apidevtools/swagger-parser`
  - 7 tests pass (1 discovery + 6 contract validations)
- **Conversation transcript** captured in R15's Act section
  documenting the variant decisions (A vs B vs C vs D vs
  vertical-slice; D selected for track 2/3 research).

## Recommendation

**Do**:

- **For multi-layer features**, default to the 4-round shape:
  Design → Contract → BE → FE. Each round is bounded enough for
  one autopilot agent to execute.
- **Per-endpoint contracts**. One folder per URL segment; one
  `<verb>.contract.yaml` + `<verb>.contract.md` pair per endpoint.
  Cross-endpoint types in `_shared/` via `$ref`.
- **YAML for shape, MD for rationale**. Don't redefine shape in
  the MD; cross-link from MD to YAML and to the design doc.
- **Retroactive contracts are valid scope**. When an existing
  endpoint has no contract, a contract round can pull it in
  (R15 retroactively contracted R13's `GET /workspaces` and
  `POST /workspaces`).
- **OpenAPI validity test at the package boundary**. Lints YAML
  syntax + `$ref` resolution + meta-schema compliance. Cheap;
  catches malformed contracts immediately.

**Don't**:

- **Don't bundle contract + BE + FE into one round** — that's
  the vertical-slice pattern. Use vertical slices when bench
  pressure is high and lesson-extraction isn't the goal; use
  the 4-round shape when track 2/3 lessons are the goal.
- **Don't author MSW handlers in the contract round** (unless
  the FE consumer already exists). They become their own
  track-2 round when the FE arrives, paired with mock-mode
  toggles + Playwright. R15 explicitly deferred.
- **Don't add codegen tooling on the first contract round.**
  Hand-write Pydantic + TS types matching the YAML in R16 / R17.
  Codegen lands when 3+ contracts exist and hand-alignment
  drifts (the Evolution Rule's _"Default = don't add"_ guard).
- **Don't drift work outside the design chain.** R15's first
  iteration drifted to "workspace persistence (DuckDB swap)"
  — outside R14's design scope. Reverted as part of the redo.
  Lesson: if the round's work isn't named by the prior round's
  Feeds-into, pause and either amend the design or split into
  a separate round.

## Open questions for future rounds

- **Composite whole-API spec.** Each endpoint YAML is standalone
  today. When does a merged `api.yaml` (for Swagger UI or
  similar) become useful? Lean: not until a real consumer
  needs it.
- **Sample-payload validation.** R15 lints YAML syntax only;
  payload examples in the MDs are not yet cross-checked against
  the YAML response schemas. Lean: add when one MD example
  drifts (3-instance rule).
- **Behavior contract.** OpenAPI captures shape but not
  semantics (idempotency, retry safety, ordering). R15 puts those
  in the MD's prose; is that enough? Lean: yes for single-user
  product; revisit if multi-agent BE work surfaces semantic
  drift not caught by shape conformance.
- **Cross-language type generation.** Pydantic ↔ zod ↔ TS-types
  alignment is currently hand-discipline. When does codegen
  become net-positive? Lean: 3+ contracts and 1 instance of
  observed drift.

## Promotion Candidate?

- [ ] `context/` — possibly, once R16 (BE round) + R17 (FE
      round) confirm the methodology under their layers. Two
      more instances needed before promotion criterion is met.
- [ ] `skills/` — possibly, once the pattern is stable enough
      to be a reusable skill (`feature-contract-driven` or
      similar) future agents follow automatically. Several
      rounds out.
- [x] Not yet — single instance (R15 contract round). Re-evaluate
      after R17's FE round completes.
