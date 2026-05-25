# Contract-Driven Feature Methodology (DCBF)

> The default round shape for any multi-layer feature in this repo:
> **Design → Contract → Backend → Frontend**, four bounded rounds.
> Use this when lesson-extraction is the goal (tracks 2 and 3 — agent
> method and self-evo) or when sub-tasks may be parallelised across
> agents/sessions. Use vertical-slice rounds only when bench pressure
> is high and learning isn't the round's primary product.

_Track: agent-method. Pulled by: three concrete instances
([Round 15](../plan/cycles/Round_15.md) contract,
[Round 16](../plan/cycles/Round_16.md) BE,
[Round 17](../plan/cycles/Round_17.md) FE) under
[Round 14](../plan/cycles/Round_14.md)'s design.
Promoted in [Round 18](../plan/cycles/Round_18.md)._

## The four phases

```text
Round N     — Design        markdown design doc(s) + optional preview
Round N+1   — Contract      OpenAPI 3.1 YAML + paired rationale MD
Round N+2   — Backend       hand-aligned models + conformance helper
Round N+3   — Frontend      hand-aligned TS types + fetch-mock tests
```

One feature per chain. Each round is small enough for one autopilot
agent or one focused session. Multi-contract per round is fine — the
shape is about phase separation, not file count.

## The five principles

1. **The contract is the unit of agent coordination.** Once the
   `<verb>.contract.{yaml,md}` pair is locked, BE and FE can be
   implemented independently — same session, different sessions, or
   different agents. The contract pays for itself the moment two
   parties consume it.

2. **YAML is authoritative; MD is annotation.** OpenAPI 3.1 YAML
   defines wire shape — machines validate against it. The paired
   `<verb>.contract.md` captures the _why_: semantics (idempotency,
   ordering, retry safety), error meaning, worked examples,
   cross-links. The MD never redefines shape.

3. **Per-endpoint granularity.** One `<verb>.contract.{yaml,md}`
   pair per endpoint; cross-endpoint types live in `_shared/` and
   are referenced via `$ref`. Smallest atomic boundary for "implement
   endpoint X."

4. **Hand-align across all three layers.** BE Pydantic models, FE
   TypeScript types, and OpenAPI YAML are all written by hand to
   match each other. Per layer:
   - BE: `extra='forbid'` mirrors `additionalProperties: false`;
     `response_model_exclude_none=True` mirrors "present iff …"
     wording.
   - FE: closed literal unions for enums; discriminated unions for
     polymorphic responses; multipart `fetch` never sets
     `Content-Type` manually.
   - Contracts package: an OpenAPI-validity test iterates every
     `*.contract.yaml` and asserts schema + `$ref` resolution.

5. **Fail loudly, pain first.** Shape decisions happen during the
   Contract round, not during integration. A per-endpoint
   conformance test on the BE side + `tsc --noEmit` + fetch-mocked
   integration tests on the FE side are the regression net. Each
   layer is independently cheap; the composite catches drift before
   it ships.

## What this methodology refuses to add (default = don't add)

The conformance discipline only stays cheap because the following
are explicit non-goals until a real drift bites — per the
[Evolution Rule](../AGENTS.md):

- **No codegen.** Hand-write Pydantic + TS types per contract.
  Promote to codegen when 3+ contracts exist _and_ one observed
  drift has escaped to a test failure.
- **No MSW handlers in the FE round.** Direct `vi.stubGlobal("fetch",
…)` per test file. MSW becomes its own track-2 round when (a) FE
  needs an offline demo or (b) e2e regressions surface.
- **No shared TS-types package (`@mdd/contracts` re-export).** FE
  ships types in its feature folder. Promote when a second consumer
  (mock server, CLI, telemetry) appears.
- **No request-body conformance from the BE.** Pydantic's
  hand-alignment + `extra='forbid'` is the first line; rely on it
  until a real drift bites.
- **No composite `api.yaml`.** Each endpoint YAML is standalone
  until a real consumer (Swagger UI, SDK gen) needs the merged form.
- **No sample-payload cross-validation.** The MDs' example
  payloads are docs, not test fixtures, until one example drifts
  visibly.

If a future round wants to lift any of these, the trigger is a
**concrete drift incident**, not an aesthetic argument.

## What the D-step decides

The Design round doesn't merely produce a design doc — it picks
the chain. Not every feature takes all four phases. The D-step
enumerates which downstream phases the feature actually needs,
and the chain reflects that enumeration. Two instances bear this
out:

- **Upload feature** ([Round_14](../plan/cycles/Round_14.md) →
  [Round_17](../plan/cycles/Round_17.md)): took all four phases
  (D + C + B + F). New endpoints, new payload shapes, new wizard
  UI — the full chain.
- **Parse-options feature** ([Round_19](../plan/cycles/Round_19.md)
  → [Round_21](../plan/cycles/Round_21.md)): took D + B + F. The
  C-step collapsed because
  [Round_15](../plan/cycles/Round_15.md) had already landed
  `ParseOptions` on the relevant contracts — R19's D-step found
  the contract was complete and declared "no C needed."

The D-step's job, then, is to **scope the chain to the
downstream rounds the feature actually moves through.** A chain
that's "D + B + F" or "D + F" or even just "D" is honest if the
D round's design genuinely lands without contract or BE work.
Refuse to spawn rounds for phases the feature doesn't need —
the chain is a tool, not a quota.

## When _not_ to use DCBF

- **Single-layer changes** (BE-only fix, FE-only refactor) — no
  contract surface, no chain.
- **High bench pressure + no learning goal** — vertical-slice ships
  faster; use it and accept that cross-round lessons are harder to
  extract.
- **Pre-design exploration** — if the feature shape isn't clear
  enough to write a design doc, run a spike instead and decide
  whether DCBF is warranted afterwards.

## Operating artifacts (not duplicated here)

- **Round template + post-round audit** —
  [plan/PDCA.md](../plan/PDCA.md).
- **Detailed how-to per phase** — three source memos that pre-date
  this promotion:
  - [[2026-05-24-contract-round-methodology]] — the C-step pattern
    (per-endpoint files, YAML+MD split, retroactive contracts).
  - [[2026-05-24-be-round-conformance-pattern]] — the B-step
    pattern (`_conformance.py` helper, per-endpoint
    `validate_response`, atomic commit shape).
  - [[2026-05-24-fe-round-typecheck-pattern]] — the F-step pattern
    (hand-aligned `types.ts`, reducer-driven wizard state,
    fetch-mock tests over MSW).
- **Design-round methodology that feeds the D-step** —
  [[2026-05-24-design-first-reframe-absorption]] (cross-linked
  preview + HIxAI Q&A loop absorbing multiple reframes per design
  round).

This file is the _why and when_. The memos are the _how_. The
round template + audit checklist are the _what to do this round_.
Don't grow this file into a how-to — keep the principles lean and
let the memos carry the operational detail.
