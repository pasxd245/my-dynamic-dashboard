---
# Identity
decided: 2026-05-27
source-round: conv:2026-05-27

# Classification
track: 3
status: active

# Substance
applies-when: any Track-3 work is proposed before Round 99 (system-building beyond artifacts)
failure-mode: drifted iteration — Track-2/3 scaffolding outruns Track-1 pull, repo accretes unused complexity (R5→R40 of the previous iteration)

# Lifecycle
revisit-trigger: Round 99 reached, OR a named-failure event invalidates the horizon
promoted-to: null
---

# Decision: No Track-3 system-building before R99

**Commitment**: No Track-3 _system-building_ lands before Round 99.
Until then, Track-3 work is **artifact-only** — capture maturity as
documents and metrics, never as code that consumes them.

## Why

The previous iteration of this repo drifted at ~40 rounds because
Track-2/3 scaffolding outran Track-1 pull
(see [drifted-iteration](../context/drifted-iteration.md)). We escaped
that by binding every Track-2 addition to a named Track-1 pull. The
Evolution Rule worked.

At R36 we have a real demoable POC (ingest → list → upload → inspect)
and 11 captured lessons in [memory/](../memory/). The temptation to
build the "self-evo" system _now_, while it feels earned, is exactly
the trap. A meaningful Track-3 system needs:

1. Memory retrieval at scale — deferred per the verification queue.
2. A verifier loop with measurable KPIs — KPIs not yet defined.
3. Enough lessons to be worth consuming — 11 is below threshold.

R99 is the chosen horizon because by then we expect to have:

- ~3× current memory volume → real retrieval pressure
- Multiple demoable Track-1 features → real product value to protect
- Measured drift / recovery events → verifier KPIs grounded in data
- An `arc.md` retrospective spanning the full journey

## What this allows

- `arc.md` (Track-3 artifact): updated per round, narrative-only.
- Metrics capture (rounds-to-feature, drift events, memory growth): record only.
- Pattern-import / research notes: feed design rounds, not a meta-agent.
- Memory tagging (e.g. `applies-when:`): infrastructure for the eventual
  retriever, no retriever yet.
- Track-2 promotions of crystallized lessons into skills (these are
  agent-method, not self-evo).

## What this forbids until R99

- Meta-agent that consumes round docs or memory.
- Automated promotion / graduation systems.
- Self-modifying prompts or skills.
- Any "agent improves the agent OS" loop.
- Speculative scaffolding for any of the above ("we'll need this later").

## Trade-off accepted

Maturity signal accumulates unused for ~63 more rounds. We accept this
because the cost of premature Track-3 (the previous 40-round drift) is
empirically far higher than the cost of delayed Track-3 (none observed
yet). If the horizon proves too distant, the `revisit-when` trigger is
named-failure events, not impatience.

_Track: 3. Pulled by: 2026-05-27 conversation reflecting on the R5→R36
recovery; [drifted-iteration](../context/drifted-iteration.md) precedent._
