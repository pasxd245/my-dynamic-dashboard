# Gate ≠ commit — how the DCFBI collapse silently dropped the revert seam

**Date**: 2026-06-13
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

R69 (Saved Query) ran D→C→F→B→I as **one uncommitted changeset** and a
single Design-altitude error (Query-as-noun) forced discarding **all
four layers** — there was no revert point. The question: *why do we run
the whole chain in one round at all?* The harness came from real pain —
which pain, and does it still justify the no-seam shape?

## Finding

**The one-round chain was never designed to be one *changeset*. The
revert seam was un-priced collateral of an optimization aimed at a
different pain.** Lineage:

| Era | Shape | Phase = ? |
| --- | --- | --- |
| R12–R13 | Vertical slice — one feature end-to-end per round | bundled, 1 round |
| R15–R21 (**DCBF**) | Design → Contract → Backend → Frontend, **each its own round** | **phase = round = commit** |
| R47+ (**DCFBI/DFCFBI**) | D→C→F→B→I as **phases within one round**, hard gates between | phase = gate-in-round |

- DCBF **explicitly forbade** R69's shape:
  [contract-round-methodology](2026-05-24-contract-round-methodology.md)
  — *"Don't bundle contract + BE + FE into one round."* Phases were
  separate **committed** rounds, so every phase boundary was a revert
  seam, for free.
- R47 ([hybrid-flow-governance](../decisions/2026-05-28-hybrid-flow-governance.md))
  collapsed phases into one round to fix **real** pain: **(1)** token
  drift from *two parallel UX sources of truth* (`.preview.html` vs FE
  code — the #1 critical issue); **(2)** D-phase overwhelm; **(3)**
  fair-only results for over-effort. Revert granularity is **absent**
  from that list.
- **The conflation:** DCBF aligned three things — `phase = round =
  commit`. R47 collapsed `phase` into a *gate-within-a-round* and
  **silently dropped the `= commit` half.** R47 defines a gate as
  *"exit criterion documented as met in the round file"* — a **prose
  checkpoint, not a git commit.** So R69 passed every gate and still
  had zero revert points.

**Two gaps R69 exposed (both fixed in the governance amendment
2026-06-13):**

1. **Gate ≠ commit** → re-bind: each gate commits. Not a new process —
   re-welding the seam R47 unsoldered.
2. **R47's only uncertainty valve is F1, which is UX-*flow* uncertainty,
   not design-*model* uncertainty.** F1 confirms a flow; it cannot
   question the noun/model that bit R69. Added a model-confidence valve
   (D-only round / discardable spike) alongside F1.

## Evidence

- Amended doctrine: [hybrid-flow-governance § Amendment 2026-06-13](../decisions/2026-05-28-hybrid-flow-governance.md)
  (gate=commit binding; design-model confidence valve).
- Lineage sources: [contract-round-methodology](2026-05-24-contract-round-methodology.md)
  (DCBF phase=round=commit + the explicit "don't bundle" rule),
  [dcbf-to-dcfbi-pivot](2026-05-28-dcbf-to-dcfbi-pivot.md) (the R47
  break-point and its UX-SoT pull).
- The trap that produced R69's altitude error:
  [specious-model-lock-in](2026-06-13-specious-model-lock-in.md).
- R69 post-mortem record: [`tmp/queries/README.md`](../../tmp/queries/README.md).

## Recommendation

**Do**:

- **Commit at every gate** inside a DCFBI/DFCFBI round — the gate *is*
  the seam; bind it to git history, not just to a checkbox in the round
  file.
- **Separate the two uncertainty axes.** UX-flow uncertainty → 2-of-5
  selector / F1. Design-model uncertainty → D-only round or discardable
  spike (commit the validated design before the chain builds on it).
- **When reading methodology history, look for the *un-priced
  side-effect*.** R47 was a good fix for its pain; its cost showed up
  two curves later. The "comes from real pain" framing means: find the
  *original* pain, then check what the fix quietly traded away.

**Don't**:

- **Don't read "DCFBI is one round" as "one feature = one changeset."**
  The chain is one round; the round commits per gate.
- **Don't trust a gate that's only a documented checkpoint** with no
  commit underneath. R69 passed all of them.
- **Don't assume F1 catches model errors.** It catches flow errors. A
  faithful build of a wrong model passes F1.

## Promotion Candidate?

- [x] `context/` — promote alongside the governance amendment once a
      post-R69 round validates commit-per-gate + the model-confidence
      valve in practice.
- [ ] `skills/` — candidate: `gate-walker` could enforce "gate closed →
      commit present" and surface the noun-vs-mode / discovered-vs-imposed
      question at the Design gate.
- [ ] Not yet
