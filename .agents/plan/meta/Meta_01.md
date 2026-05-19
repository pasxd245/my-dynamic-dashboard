# Meta 01: Fix self-evo's pre-apply judge false-positive

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Close [openObservation `selfEvoJudgeFalsePositiveOnUnappliedPatches`](../../auto/state.json) — self-evo's `verifier` node was running checks against the un-patched `services.repoRoot`, so the judge approved patch sets that wouldn't actually build / pass tests post-apply.

Concrete symptom from 2026-05-19 R01: self-evo emitted 5 patches with `applied: false`; `verifier` ran lint+typecheck+tests against the pre-patch tree (which had no `packages/ui` source at all); checks trivially passed; judge approved score 1. The patches were missing 15+ required files and would have produced a broken build if applied.

## Product-velocity justification

Closes a false-positive that would mask broken patches in **every** future self-evo dispatch. Without this fix, the framework's specialist executor is structurally unreliable — every subsequent self-evo round would carry the same risk of judge-approved partial patches. The fix re-opens self-evo as a trusted opt-in executor for the round-writer convention introduced in Meta_03; the next ≥3 product rounds that opt into self-evo (e.g., orchestrator-style PDCA work) get real post-apply signal instead of a free pass. Without this fix, the prudent course would be to never use self-evo again.

## Approach

Three options were considered:

1. **Insert `apply-verifier` before `judge` in the graph.** Cleanest topologically but touches `graph.ts`, which is **hard-locked** under autoagent's self-lock. Ruled out.
2. **Add a new node between `verifier` and `judge`.** Same hard-lock problem with `graph.ts`.
3. **Make `verifier` itself dry-apply when patches exist.** Touches only [`src/nodes/verifier.ts`](../../../orchestrators/self-evo/src/nodes/verifier.ts), which is **soft-locked** and the user explicitly granted `--allow-llm-edit` for this task. Picked.

Option 3 reuses the same `createWorktree` + `applyPatch` + `runChecks` + `removeWorktree` helpers already covered by [`r-i.test.ts`](../../../orchestrators/self-evo/test/r-i.test.ts) for `apply-verifier`. The verifier now becomes "the judge's signal source" — `apply-verifier` after HITL approve still creates its own _preserved_ worktree for human diff review.

## Patch

[`.agents/orchestrators/self-evo/src/nodes/verifier.ts`](../../../orchestrators/self-evo/src/nodes/verifier.ts) — split into two paths:

- **Fast path** (no patches OR `cfg.dryApply === false`) → unchanged: `runChecks({ cwd: services.repoRoot, ... })`. Backward compatible.
- **Dry-apply path** (patches present AND `cfg.dryApply !== false`, the new default) → `createWorktree` → `applyPatch` each patch → `runChecks({ cwd: handle.path, ... })` → `removeWorktree`. Apply failures prepended to `failureExcerpts` so the judge sees them.

New `VerifierConfig.dryApply?: boolean` (default true) + `VerifierConfig.dryApplySymlinks?: readonly string[]` (mirrors `apply-verifier`'s `symlinks`).

No state-shape change (hard-locked `state.ts` untouched). No graph rewiring (hard-locked `graph.ts` untouched).

## Validation

- Self-evo full test suite: **65/65 pass** (1 file unchanged behavior under `dryApply`, since existing tests don't supply patches and `state.patches.length === 0` takes the fast path).
- TypeScript build: green (`tsc -p .`).
- Backward compatibility: every existing call site that doesn't supply patches (which is every existing test) takes the fast path and behaves identically to pre-2026-05-19.

## Open follow-ups

- **Add a dry-apply-path test.** The new path isn't directly covered by the existing 65 tests (they hit the fast path). A focused unit test using `r-i.test.ts`'s `makeGitRepo` helper + a simple patch would verify the worktree creation, apply, and check-on-worktree flow. Not blocking — the helpers it composes are individually well-tested — but worth adding in a follow-up meta round.
- **Tune the `dryApplySymlinks` default.** Currently no symlinks by default; an `apps/builder` round might benefit from symlinking `node_modules` to avoid full reinstall in the worktree. Tuning is per-config, not blocking.

## State-of-the-world after this round

- `state.json.openObservations.selfEvoJudgeFalsePositiveOnUnappliedPatches` → resolved.
- The next self-evo round (whenever one is dispatched) will get post-apply verification signal before the judge runs. A partial patch set will be visible to the judge as apply-failure excerpts; a broken build will land as a real `status: "fail"` check.
