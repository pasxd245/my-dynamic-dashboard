# Round roadmap — long-running deferral decisions

**Date**: 2026-05-22
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

Some round-level decisions are _deferrals_ ("not yet doing X, here's
why") rather than _commitments_ ("doing X this round"). Without
explicit capture, deferrals get re-litigated every session or quietly
violated. Round-by-round _status_ belongs in
[plan/cycles/Round_XX.md](../plan/cycles/) — this memory captures only
the deferral rationales, which are not derivable from cycle files.

## Finding

Three deferrals are in effect as of 2026-05-22:

1. **Streamlit dashboard: deferred indefinitely.** The drifted iteration
   had a two-frontend split (React builder + Streamlit dashboard).
   That was a drift signal — two UI tech stacks for one product.
   Revisit only when the builder genuinely can't serve a needed
   read-only view.
2. **docs-graph: deferred — and its track classification must be
   resolved before its round starts.** docs-graph (repo-semantic
   graph + drift indicators) is a known forward pull. Open question:
   track-1 if end-user-facing, track-2/3 if agent-internal. Current
   lean: track-2/3 — it's how _we_ keep the repo from drifting again,
   not what CRM end-users pay for. Don't draft a docs-graph round
   without first answering the track question in writing.
3. **`@mdd/ui` BIZ-adjacent exports: permanently excluded.** Pages,
   Contexts, `react-router-dom`, `@tanstack/react-query`, `zod` were
   peer deps in the drifted `@mdd/ui` and contributed to the BIZ
   leak. They stay in the builder this iteration, no exceptions
   without re-opening the boundary decision.

## Evidence

- Drifted Streamlit/dashboard split, BIZ-coupled `@mdd/ui` peers, and
  docs-graph artifact are summarized through
  [drifted-iteration.md](../context/drifted-iteration.md); this memory
  keeps the durable decisions rather than depending on local ignored
  paths.
- Companion lesson: [2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)

## Recommendation

**Do**:

- When considering a Streamlit / second-frontend round, first name a
  specific builder limitation the second frontend would solve
- Before drafting any docs-graph round, resolve its track
  classification in writing
- Reject any PR that adds the excluded peer deps to `@mdd/ui`

**Don't**:

- Re-open the Streamlit decision without naming a concrete builder gap
- Build docs-graph functionality before its track question is answered
- Treat this memory as a status report for active rounds —
  [plan/cycles/](../plan/cycles/) is the source of truth for round
  status

## Promotion Candidate?

- [ ] `context/` — possibly, once a deferral is re-evaluated and
      promoted as a stable architectural principle (e.g., "this repo
      is single-frontend")
- [ ] `skills/`
- [x] Not yet — these are project-level live decisions; revisit
      before promoting
