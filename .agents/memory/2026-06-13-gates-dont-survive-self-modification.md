# The now-discipline is the Track-3 immune system — gates don't survive self-modification

**Date**: 2026-06-13
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

Why insist on understanding *behind the scenes* — why a gate fires, what it's a
proxy for, discovered-vs-imposed, conformance-vs-truth — instead of just running
the tool and trusting the verdict? On a Track-1 product round (e.g. R71's
flow-selector → DCFBI) the mechanical answer and the understood answer give the
**same output today**. So what is the extra rigor buying?

The answer surfaced in a human↔AI reflex on R71 (2026-06-13): it is buying
**Track-3 readiness**. Per the [R99 evo-horizon](../decisions/2026-05-27-r99-evo-horizon.md),
Track-3 (agents improving their own operating system) is deferred but inevitable.
The risk if we coast: arrive at R99 with the *tooling* for self-evolution but not
the *judgment* — and re-enter the [drifted iteration](../context/drifted-iteration.md),
now with a faster engine.

## Finding

**A gate only brakes an agent that cannot edit it.** In Track-1/2 the gates
(flow-selector, gate-walker, the lints, the contract) sit *above* the agent; the
human is the final brake. **Track-3 is, by definition, the agent reaching into
its own operating system — including the gates.** The moment the agent can edit a
gate, the gate stops being a brake and becomes just another thing it can
"improve" into compliance.

So the question for R99+ is: **when the external brakes become editable, what is
left?** Exactly one thing — the **internalized why**: the reflex that asks "is
this discovered or imposed?", "conformance or truth?", "am I cutting scope on
merits or to dodge the gate?" That reflex survives self-modification because it
lives in judgment, not in a script the agent can rewrite.

This is why **mechanical gate-following is dangerous *as preparation*.** An agent
that learned to pass gates without understanding them is the worst candidate for
self-modification: given the power, it optimizes the measurable (green, coherent,
organized) over the true, and — per
[specious-model-lock-in](2026-06-13-specious-model-lock-in.md) mechanism #1 —
**manufactures its own evidence the whole way.** The result would not *look* like
drift; it would look like progress, until it is wreckage — the drifted iteration
with a self-improving engine for fooling itself.

So the [R99 horizon](../decisions/2026-05-27-r99-evo-horizon.md) is not "Track-3
is forbidden." It is a **readiness gate**: don't hand self-modification to a
system that hasn't yet *earned the judgment*. "Work hard now" is how the judgment
is earned — every Track-1 round that holds the model open, truth-tests against
the **code/reality not the green suite**, and records the *why* not just the
verdict, is a **cheap rep of the immune system Track-3 must later run on itself,
without the human.** Cheap reps now (stakes = a join feature, human still the
brake); expensive to learn later (stakes = the operating system, brake gone).

The product rounds are the cover under which the real Track-3 safety work is
done. R71 was not about joins; it was a rep.

## Evidence

- The reflex conversation on [Round_71](../plan/cycles/Round_71.md) (Design gate,
  2026-06-13): J-2 held open + truth-tested against the real read path (not R70's
  suite) — a rep of discovered-vs-imposed under low stakes.
- [specious-model-lock-in](2026-06-13-specious-model-lock-in.md) — conformance ≠
  truth; a premature model manufactures its own evidence (the failure mode
  self-modification would amplify).
- [R99 evo-horizon](../decisions/2026-05-27-r99-evo-horizon.md) — Track-3 deferred,
  artifact-only until R99 (re-read here as a *readiness* gate, not a ban).
- [purpose.md § dynamic equilibrium](../context/purpose.md#dynamic-equilibrium) —
  accelerate (conformance, automatable) ⇌ brake (truth, the human); the brake is
  the part tests structurally can't reach.
- [drifted-iteration.md](../context/drifted-iteration.md) — the null hypothesis:
  what coherence-outrunning-truth produced last time.

## Recommendation

**Do**:

- Treat every gate/tool output as a **proxy with a recorded justification**, never
  a bare verdict. Write *why each condition fired / didn't* — the repo already
  forces this (flow-selector's Justification column, gate-walker's per-verdict
  pointer); honor the spirit, not just the cell.
- Run the discovered-vs-imposed and conformance-vs-truth checks **even when the
  gate would pass anyway** — that is the rep that builds the reflex for when no
  external gate is watching.
- When scope-cutting changes a gate outcome (R71: defer builder → DCFBI), verify
  the cut was made **on merits before** the gate ran, not reverse-engineered to
  pass it cheaply. Direction of causality is the tell.

**Don't**:

- Pass a gate mechanically because the count came out right — a verdict you can't
  *explain* is a verdict you can't trust, and an agent that can't explain its
  gates cannot be trusted to *edit* them.
- Treat the R99 horizon as a calendar to wait out. It is earned readiness; coasting
  to R99 yields self-evo tooling without self-evo judgment — the dangerous combination.
- Let conformance (green, coherent) stand in for truth (is this *right*?),
  especially as the agent gains power over its own checks
  ([specious-model-lock-in](2026-06-13-specious-model-lock-in.md)).

## Promotion Candidate?

- [x] `context/` — broadly-applicable governance rationale; promote into
      `.agents/context/` (likely beside the Evolution Rule / R99 horizon) once a
      second round re-applies the "gates-don't-survive-self-modification" frame.
      Until then, hold as a New lesson (fired once — the R71 reflex).
- [ ] `skills/` — possibly later: a gate-walker / flow-selector note ("explain the
      verdict, don't just record it").
- [ ] Not yet

---

> Filename convention: `YYYY-MM-DD-short-topic.md`.
> Status lifecycle: `New` → `Needs Review` → `Promoted` → `Archived`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.
