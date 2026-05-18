---
name: verifier-trust-gap
description: self-evo worker's worktree verifier has known noise that masks real type errors. master-agent must re-validate in main after every "approve" verdict.
metadata:
  type: project
---

self-evo's verifier runs in a sandbox worktree where nested
`node_modules/@types/node` isn't symlinked. Result: `tsc --noEmit`
reports `Cannot find name 'Buffer'`, `Cannot find namespace 'NodeJS'`,
etc. on every TS file that uses Node APIs. We classify these as "known
noise" per
[.claude/commands/autoagent.md](../../.claude/commands/autoagent.md)'s
Known-noise section.

**The trap**: the same compilation pass silently swallows real new type
errors landing in the patch under review. The worker reports
`typecheck: pass` even when the patch introduces a hard type error.

**Observed failure**: Round 08 on 2026-05-18. The LLM-generated
`test/codex.test.ts` called `complete({ user: "..." })` missing the
required `LLMRequest.system` field. The worker's worktree typecheck
passed; main-checkout typecheck failed immediately on apply. Patch
reverted at tier-2.

**How master-agent applies this**:

1. Never trust a worker's `verdict: approve` blindly. After applying
   the worker's patches to main, run `pnpm md:lint && pnpm --filter
@self/orchestrator test` and inspect the FULL output, not just the
   summary.
2. If the round touches TypeScript, treat the worker's typecheck
   channel as "advisory only" — main-checkout typecheck is the ground
   truth.
3. If a real regression appears: revert the applied patch, tier-2 the
   round, write blockers.md with root-cause not symptom.

**The proper fix** (deferred to a dedicated round): close the verifier
trust gap. Options listed in
[.agents/auto/reports/20260518/round_08.report.md](../auto/reports/20260518/round_08.report.md)
under "Route C" — symlink `@types/node` into the worktree, or scope
typecheck to changed files only, or use a workspace-root tsc invocation.

Related: [[agent-tier-taxonomy]], [[llm-mode-taxonomy]].
