# Round 08: Self-evo writes Round_NN.md after apply-verifier clean — close the lesson-learn loop's input gap

**Status**: Review
**Date started**: 2026-05-18
**Date completed**: _(set on human approval)_
**Mode**: manual (autoagent blocked on plan-writer over-decomposition; see `.agents/auto/blockers.md`)

## Goal

Extend `src/nodes/apply-verifier.ts` so that when the post-apply verifier's checks all pass (or are skipped), the node also emits a `Round_NN.md` artifact to `<repoRoot>/.agents/plan/cycles/`. Today the only writer of cycles artifacts is `round-writer`, which is reachable only via the `approve` HITL branch. Autoagent defaults to `apply`, so rounds 04–07 produced 7 commits and 0 PDCA artifacts. The lesson-learn loop documented in `docs/agents/workflows/agent-architecture.workflow.md` has no input as a result.

### Requirements

- **R1** — Boundary: only `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts` may be modified.
- **R2** — Mint the next round number by reading existing entries in the cycles directory and matching `/^Round_(\d+)\.md$/i` (mirror the regex at `src/nodes/round-writer.ts:27`).
- **R3** — Render the artifact via `renderRoundMarkdown` from `src/renderers/round-template.js`, the same helper round-writer uses.
- **R4** — Best-effort write: catch any failure and log via `console.error("[apply-verifier] cycles artifact write failed: …")`. Never let an artifact-write failure break the round.
- **R5** — Do NOT duplicate round-writer's promotions-log append or memory.add candidate emission. Those remain on the approve path.
- **R6** — Update the leading comment block of `apply-verifier.ts` to describe the new behaviour.
- **R7** — `pnpm --filter @self/orchestrator test` must remain at 65/65 green; do not add a new test file.

## Plan

- [x] **P1** — Add imports (`existsSync`, `mkdir`, `readdir`, `writeFile`, `resolve`, `renderRoundMarkdown`, `roundFilename`, `CheckResult` type); add `ROUND_RE` + `nextRoundNumber` helper mirroring round-writer; add `checksAllClean` predicate that returns true iff every check is `pass`/`skip` and there is at least one check; add `writeCyclesArtifact` that resolves `<repoRoot>/.agents/plan/cycles`, mkdir-recursive, mints the number, renders the markdown, writes the file, and try/catch-logs failure. Extend the leading comment with the new behaviour note. In `applyVerifierNode`, lift the inline `appliedVerification` object into a local binding so it can be passed into `writeCyclesArtifact`; gate the call on `checksAllClean(...)`.

## Do

### Findings (3)

- **repo-scanner** — `.agents/plan/cycles/` contains only `.gitkeep`; no `Round_NN.md` files exist despite 7 closed rounds today. _(empirical, `ls -la .agents/plan/cycles/`)_
- **boundary-scoper** — `round-writer.ts` is reachable only via `hitl.kind === "approve"` (verified at `src/graph.ts:127`); apply-verifier routes to `hitl-gate` directly (`src/graph.ts:134`). _(graph read)_
- **patch-author** — Renderer expects `state` to carry `appliedVerification` for the post-patch check block (`round-template.ts:130-139`); patching state to include the just-computed `appliedVerification` makes the artifact symmetric with round-writer's output. _(template read)_

### Boundary

- **In scope**: `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts`
- **Out of scope**: `src/nodes/round-writer.ts`, `src/renderers/round-template.ts`, any test file
- **Allowed file globs**: `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts`
- **Assumptions**:
  - `renderRoundMarkdown` is safe to call with `state.requirements: []`, `state.plan: []`, `state.findings: []` (renderer guards each section against empty input — verified at `round-template.ts:27, 49, 165`).
  - `CheckStatus` values are `"pass" | "fail" | "skip"` (verified at `types.ts:42`).
  - `services.repoRoot` is an absolute filesystem path on real runs; in r-i.test.ts it is a tmpdir.

### Change type: `feature`

### Patches (1)

- `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts` — applied: true (manual edit)

## Check

### Pre-patch (current HEAD)

- [x] **lint** — pass _(pnpm md:lint: 142 files, 0 errors)_
- [x] **tests** — pass _(pnpm --filter @self/orchestrator test: 65/65 green)_

### Post-patch (manual checkout, after edit)

- [x] **lint** — pass _(pnpm md:lint: 142 files, 0 errors)_
- [x] **tests** — pass _(pnpm --filter @self/orchestrator test: 65/65 green, no regressions)_
- [~] **smoke** — skip _(deferred — real proof comes when the next autoagent round on this branch lands and a `Round_09.md` shows up in `cycles/`)_

## Act

_Judge verdict_: **approve** at score 0.90 _(human verdict; orchestrator did not run this round — see Mode header)_

_Notes_:

- Per-test side effects in `test/r-i.test.ts`: each apply-verifier test now also writes `<tmpdir>/.agents/plan/cycles/Round_01.md` because the predicate fires when checks pass. The tmpdir is `rm -rf`'d in `finally`, so this is invisible — but a future contributor reading the test should know.
- `checksAllClean` deliberately returns `false` on `checks.length === 0`. The early return at apply-verifier:99-105 already short-circuits the no-patches case with an empty `checks` array; we do not want that path to emit a Round_NN.md.
- The `state.scope` shape used by the test (no `outScope`) is now also valid input to `renderRoundMarkdown`; the renderer guards each scope sub-field independently. No type-safety drift.

**Learnings**:

- Plan-writer over-decomposition is the **dominant failure mode** for self-evo today. Two consecutive Round_08 attempts (the codex-test version and the apply-verifier version) both produced 6 plan steps for what was a 1-file change with an explicit `req: exactly 1 plan step`. Memory note `project_plan_writer_overdecomposes.md` captures this.
- "Smart-autopilot fixes itself" is currently a chicken-and-egg: the bug is in the planner that would plan its own fix. The first iteration must be human-driven; subsequent ones can be autonomous once the planner is hardened.
- Hand-writing this artifact surfaced a renderer concern: `renderRoundMarkdown` produces a `## Act` section with hard-coded `Learnings: _(human to fill in during review)_`. For autoagent-closed rounds, that field will always be a placeholder — the orchestrator has no way to populate it. Either the renderer needs a "learnings from verdict" branch, or autoagent needs to post-process the file to inject a learnings line. Defer to a future round.
- The `cycles/` dir was committed empty with just `.gitkeep`. Until today, that emptiness was invisible — nobody read the directory. The blocker pattern (autoagent step 1 reads "latest `.agents/plan/cycles/Round_NN.md` and its status") will now actually have data to act on, which means **the next blocker will be: what does autoagent _do_ with the latest Round_NN.md?** Today, nothing — no node ingests it. That is the next unwired link.

**Promotions**:

- [ ] → `context/` : `.agents/orchestrators/self-evo/src/nodes/apply-verifier.ts` writes a Round_NN.md after clean checks (architectural note)
- [ ] → `skills/` : "When `req: exactly N plan steps` matters, do the round by hand until plan-writer enforces it deterministically"
- [x] → memory : `project_plan_writer_overdecomposes.md` (already created)
