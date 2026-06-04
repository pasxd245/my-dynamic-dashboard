---
# ─── Identity ─────────────────────────────────────────────────────
decided: 2026-06-01
source-round: conv:2026-06-01

# ─── Classification ───────────────────────────────────────────────
track: 3
status: active

# ─── Substance ────────────────────────────────────────────────────
applies-when: a memory-consolidation system (auto dedupe / stale-flag / re-index of memory) is proposed
failure-mode: building a memory pipeline before it is needed — scaffolding outruns the pull (the R5→R40 drift)

# ─── Lifecycle ────────────────────────────────────────────────────
revisit-trigger: auto-memory outgrows per-write dedup + the weekly manual review (upkeep stops being trivial), AND Round ≥ 99
promoted-to: null
---

# Decision: Memory-consolidation ("Dreaming-lite") is deferred — Track-3, ≥ R99

**Commitment**: We will **not** build an automated memory-consolidation
system (the multi-agent "dedupe → stale-flag → re-index" pipeline described
in the 2026-06-01 genk.vn article on Anthropic's "Dreaming"). It is
**Track-3 system-building**, so it is gated by the
[R99 evo-horizon](2026-05-27-r99-evo-horizon.md) and additionally has no
pull behind it today.

## Why

Surfaced in the 2026-06-01 conversation while deciding where the
intent-handshake preference and memory practices should live. The genk.vn
article maps Anthropic's agent-memory design (file store + session
instructions + "Dreaming" consolidation + human review). Three of those
four pillars already exist here (file memory + git history; `CLAUDE.md` /
`AGENTS.md` instructions; PDCA "review before commit"). The only gap is
automated consolidation — and a running multi-agent pipeline is exactly the
"system beyond artifacts" the R99 horizon defers. Failure mode: building it
now repeats the R5→R40 drift where Track-2/3 scaffolding outran Track-1
pull.

## What this allows

- **Per-write dedup discipline** (check-for-existing, update-don't-duplicate,
  delete-wrong) — already in force, continues.
- **The weekly manual review** ([AGENTS.md § For humans](../AGENTS.md)),
  optionally extended by hand to tidy / stale-flag the memory index. This is
  Track-2 method-use, not system-building.
- **A Track-3 _artifact_** (a design doc / checklist for consolidation) if a
  future round wants one — artifact-only work is permitted pre-R99 per the
  R99 horizon (cf. `arc.md`).

## What this forbids

- Building or wiring an **automated/scheduled consolidation pipeline**
  (multi-agent batch, separate output store, auto-diff) before R99.

## Trade-off accepted

Memory may accumulate minor redundancy that a pipeline would catch
automatically. Accepted because per-write discipline + weekly review keep
the corpus truthful at today's scale, and the cost of premature Track-3
(empirically, the prior 40-round drift) far exceeds the cost of occasional
manual tidy-up.

_Track: 3. Pulled by: conversation 2026-06-01 (genk.vn "Dreaming" article;
memory-placement discussion)._
