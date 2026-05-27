---
# ─── Identity ─────────────────────────────────────────────────────
decided: YYYY-MM-DD
source-round: <RNN | "conv:YYYY-MM-DD" | memory file>

# ─── Classification ───────────────────────────────────────────────
track: <1 | 2 | 3>
status: <proposed | active | landed | parked | superseded>

# ─── Substance ────────────────────────────────────────────────────
applies-when: <one-line scope — WHERE / WHEN this constrains>
failure-mode: <one-line — WHAT bad outcome this guards against>

# ─── Lifecycle ────────────────────────────────────────────────────
revisit-trigger: <named condition — round, event, or measurable threshold>
promoted-to: <path | null>
---

# Decision: <one-line title>

**Commitment**: <the binding statement, in one or two sentences>

## Why

<The pull that produced this decision. Cite the conversation date, round
id, memory file, or product gap. State the failure mode this prevents
(also captured in `failure-mode:` for retrieval).>

## What this allows

<Concrete carve-outs — what work is still permitted under the decision.>

## What this forbids

<Concrete prohibitions — the work this decision explicitly blocks.>

## Trade-off accepted

<What we are giving up by binding ourselves this way, and why the
alternative is worse.>

*Track: {1|2|3}. Pulled by: <round id | memory file | conversation date | product gap>.*
