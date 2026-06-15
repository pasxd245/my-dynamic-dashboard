# Seed data and MSW verify different layers — seed never replaces MSW

**Date**: 2026-06-16
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

R77's human sign-off ran the real app against a **non-mock** seeded backend
(`pnpm dev:seed` — a sales star + relationships + base queries). With real data
flowing, it is tempting to treat the seed run as *the* verification and quietly
discount the MSW-backed FE gate tests as redundant ("the real thing works, why keep
the mocks?"). The human flagged this explicitly: **do not claim seed can replace
MSW.**

## Finding

They verify **different layers**, and collapsing them hollows out the gate that
catches contract drift:

- **MSW** verifies **FE ↔ contract conformance**: backend-free, deterministic,
  enforces `additionalProperties: false` response validation against the
  `@mdd/contracts` YAML. It is what proves the frontend speaks the contract — and
  it is the substrate of the F / F1 / F2 gate tests. (It also has known sharp edges,
  cf. [msw-swallows-resolver-throws](2026-05-27-msw-swallows-resolver-throws.md).)
- **Seed data** verifies the **actual integrated implementation**: real backend,
  real DuckDB engine, the real `source_id` resolver, real CORS/preflight. It is what
  a human run-the-app sign-off rides on — the class of defect MSW/TestClient
  structurally cannot see (cf.
  [dfcfbi-f1-needs-human-review](2026-06-14-dfcfbi-f1-needs-human-review.md)).

Seed is **additive** to MSW, not a substitute. Dropping MSW because seed "covers it"
would remove the only check that the FE conforms to the contract in isolation —
exactly the drift the DCFBI/DFCFBI gates exist to stop.

### They align to different gates (DCFBI vocabulary)

Both are Track-1 tooling, but they sit at **different gates** — that asymmetry is the
whole point. If both were C-aligned they would be redundant and "seed can't replace
MSW" would be false.

| Gate  | What it pins down                  | Instrument                              |
| ----- | ---------------------------------- | --------------------------------------- |
| **D** | the surface is declared (UI/UX)    | design docs + `ui-design`               |
| **C** | the **wire shape** (FE↔BE interface) | `@mdd/contracts` YAML / OpenAPI         |
| F / B | each side conforms to C            | FE tests (**MSW**) · BE `validate_response` |
| **I** | the **integrated whole** runs      | dual-conformance + **run-the-app**      |

- **MSW → C-aligned.** Its assertion *target* is the contract (FE side, no backend).
- **Seed → I-aligned, not C-aligned.** A run-the-app exercises every layer at once —
  real engine (B), real wire (C), rendered UI (D), CORS/glue (I) — and its unique
  value is the things C-conformance structurally cannot see (CORS/preflight = I,
  layout/feel = D-fidelity, engine correctness = B). Its target is the running system,
  not the contract.

So: `MSW → C` (one layer); `seed → I (∋ D, C, B)` (all layers real).

### Why the conflation feels right — and the cure

The pull to file *both* under C is **not** because both are Track-1 (Track-1 owns the
whole chain — D and I just as much as C, so that can't single out C). It is because
**both are *data***, and C is the mental shorthand for "the data gate."

The dissolving distinction is **type vs. instance**: **C is a *definition*** (the
schema/type of the wire); **MSW and seed are *populations*** of that type (synthetic
instances vs. real instances). Both *conform to* C — but *conforming-to-C* ≠
*being-the-C-check*. MSW's job is to **assert** conformance (so it earns C-alignment);
seed merely **rides on** C-shaped data as a vehicle to prove the integrated system runs
(I). Confusing the type (C) with its instances (the data) — and the data-*noun* with
the verification-*verb* — is what makes them feel like the same gate.

## Evidence

- Round: [Round_77 § Act — Verification](../plan/cycles/Round_77.md) (seed vs MSW kept
  distinct; human sign-off ran with MSW off + `pnpm dev:seed`).
- Tooling: `scripts/dev/seed.py` (`pnpm dev:seed`), `scripts/dev/seed-data/` — commit
  `1059f57`.
- The contract-conformance substrate it must not displace:
  `workspace/packages/contracts/` + the FE gate's `withContractValidation` /
  BE's `validate_response` dual conformance.

## Recommendation

**Do**:

- Use seed + `pnpm dev:local:up` to verify the **real implementation** for human
  sign-off (run-the-app, the F1/Complete checkpoint).
- Keep MSW-backed F-gate tests as the **contract-conformance** check, independent of
  any seeded backend.
- When presenting seed, frame it as "verifies the real implementation" — additive.

**Don't**:

- Claim or imply seed data makes MSW redundant.
- Let a green real-backend seed run substitute for the FE↔contract gate (or vice
  versa) — they catch different failures.

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable
- [ ] `skills/` – Reusable procedure/checklist
- [x] Not yet – Needs more validation (one round; revisit if it recurs)

---

> Filename convention: `YYYY-MM-DD-short-topic.md` or `agent-name-topic.md`.
> Status lifecycle: `New` → `Needs Review` → `Promoted` → `Archived`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.
