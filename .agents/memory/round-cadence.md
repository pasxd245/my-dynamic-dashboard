---
name: round-cadence
description: One feature per PDCA round; master-agent enforces this upstream of the worker (in queue authorship). Bundled rounds cause plan-step bloat and patch-author timeouts.
metadata:
  type: feedback
---

Each PDCA round drives **one** feature, bug fix, or refactor. If a
topic is too large for one round, split it into a chain and surface the
chain to the human, do not collapse it.

**Why**: bundled rounds cause the plan-writer to emit 5–7 plan steps
(one per file touched), and each step is its own chunked patch-author
LLM call. Patch-author has a 300s `claude -p` ceiling per step; a
7-step round burns the full subprocess budget mid-run, with
JSON-parse / malformed-patch / timeout failures dropping random steps.
Observed 2026-05-17 Round 06 (4 of 7 plan steps lost). After splitting
the same work into single-feature rounds, the 2026-05-18 sequence
(Round 06: dist-test cleanup; Round 07: codex.ts only; Round 08: codex
test only) had 0 patch-author rejections except where the underlying
type design itself was wrong.

**How to apply** (master-agent's queue-authorship rule):

- When authoring a queue topic, ask: "does this change touch one file
  or a tight cluster of files all subordinate to one decision?" If yes,
  one round. If no, split.
- Mirror the existing
  [[feedback-round-cadence-one-feature-per-round]] user-memory rule.
- Every round file ends with a `## Questions for user before next round`
  block — those questions become the decision gates for the next round.
- When drafting multiple consecutive rounds at once, mark non-current
  rounds as `Status: Planning (drafted ahead of Round X close —
review-only until Round X completes)`.

**Concrete check**: if your queue topic's req list mentions 3+ distinct
files OR uses the word "and" to bridge two independently-testable
behaviours, split before enqueueing.

Related: [[agent-tier-taxonomy]] (master-agent owns queue authorship),
[[llm-mode-taxonomy]] (the canonical anti-bundling example —
codex+gemini+copilot was originally one topic).
