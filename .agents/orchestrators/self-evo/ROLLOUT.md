# `self-evo` — Rollout Plan & Handoff

This file is the source of truth for how the orchestrator is being
built out, what's already landed, and what the next session should
pick up. It lives next to the package so it travels with the code.

## Locked decisions

- **Package**: `@self/orchestrator` at [.agents/orchestrators/self-evo/](.).
  Auto-discovered by [pnpm-workspace.yaml](../../../pnpm-workspace.yaml)
  via the `.agents/orchestrators/*` glob.
- **Orchestration runtime**: LangGraph.js 1.x (`@langchain/langgraph`)
  with `SqliteSaver` checkpointer (one `checkpoint.sqlite` per run).
- **Cross-round memory**: Mem0 (`mem0ai`), in-memory backend in v1
  (zero-setup). Wired in R-D.
- **LLM transport default**: subprocess `claude -p`, no API key.
  Anthropic SDK adapter is in [src/llm/anthropic.ts](src/llm/anthropic.ts)
  for the `mode: api` path. Per-node routing via
  [config/llm.example.yaml](config/llm.example.yaml).
- **HITL**: LangGraph's `interrupt(value)` + `Command({ resume })`.
  Detection via `isInterrupted(result)` after `invoke()` — NOT
  try/catch on `GraphInterrupt`. LangGraph 1.x doesn't throw with a
  checkpointer attached; it returns state with `__interrupt__` marker.
- **HITL node name**: `hitl-gate` (NOT `hitl` — collides with the
  `hitl` state field; LangGraph rejects same-name node+channel).
- **Judge**: included from R-A as a stub (returns `approve` so the
  conditional edge wires through). Real holistic judge in R-G.
- **Patch author**: dry-run only through R-G. Real `--apply` mode is
  R-I, post-MVP.

## Status — what's landed

### R-A (DONE) — Skeleton + LangGraph wiring (25 files)

- Package scaffolding: [package.json](package.json), [tsconfig.json](tsconfig.json),
  [tsconfig.test.json](tsconfig.test.json), [.gitignore](.gitignore),
  [README.md](README.md).
- State: [src/state.ts](src/state.ts) — `SelfEvoState` Annotation.Root
  with overwrite reducers; types in [src/types.ts](src/types.ts).
- Persistence: [src/persistence/workspace.ts](src/persistence/workspace.ts)
  (runId, layout, state.json), [src/persistence/checkpointer.ts](src/persistence/checkpointer.ts)
  (SqliteSaver factory).
- Nodes: stub bodies for the 10-node pipeline at [src/nodes/](src/nodes/)
  plus [src/nodes/\_reset.ts](src/nodes/_reset.ts) (topological reset
  table).
- Graph: [src/graph.ts](src/graph.ts) — `buildGraph()` / `compileGraph()`
  with `withResetGuard()` wrapper around revertable nodes, conditional
  edges from `judge` and `hitl-gate`.
- CLI: [src/cli.ts](src/cli.ts) — `round <topic>` / `resume <runId>`.
- Config: [src/config.ts](src/config.ts) + [config/self-evo.ini](config/self-evo.ini).
- Dispatcher: [scripts/self-evo.sh](scripts/self-evo.sh).
- Tests: [test/skeleton.test.ts](test/skeleton.test.ts) — interrupt
  detection, approve→END, revise→reset.

### R-B (DONE) — LLM transport + skills compose

- LLM kernel: [src/llm/client.ts](src/llm/client.ts) (interface),
  [src/llm/subprocess.ts](src/llm/subprocess.ts) (spawns `claude -p`,
  EPIPE-tolerant), [src/llm/anthropic.ts](src/llm/anthropic.ts)
  (SDK adapter), [src/llm/resolver.ts](src/llm/resolver.ts) (per-node
  routing, env overrides via `SELFEVO_LLM_<NODE>_<FIELD>`).
- Skills: [src/skills/loader.ts](src/skills/loader.ts) (reads
  `.agents/skills/<name>/SKILL.md`, sha256 fingerprint, strict name
  regex), [src/skills/compose.ts](src/skills/compose.ts) (versioned
  delimiter wrap).
- Config: [config/llm.example.yaml](config/llm.example.yaml) — copy
  to `llm.yaml` to activate.
- Tests: [test/llm-skills.test.ts](test/llm-skills.test.ts) — uses
  `cat` and `false` as canned subprocesses to avoid needing the real
  `claude` binary.

### R-C (DONE) — Real read-only nodes

- Service injection: [src/agent-services.ts](src/agent-services.ts)
  (`AgentServices` shape — resolver, skillsRoot, repoRoot). Factory
  pattern: every node exports `makeXxxNode(services)`.
- Parsers: [src/parsers.ts](src/parsers.ts) — `stripCodeFence`,
  `parseJsonResponse` (tolerates ```json fences, free text wrapping).
- Tools: [src/tools/ripgrep.ts](src/tools/ripgrep.ts) — JSON-mode
  wrapper, exits gracefully when `rg` isn't installed.
- Real impls:
  [intake](src/nodes/intake.ts) (normalises requirements),
  [repo-scanner](src/nodes/repo-scanner.ts) (ripgrep + LLM consolidate),
  [boundary-scoper](src/nodes/boundary-scoper.ts) (LLM produces scope
  and `allowedFiles` globs),
  [change-classifier](src/nodes/change-classifier.ts) (bug-fix /
  feature / refactor / doc / spike; falls back to `spike` on bad
  label),
  [plan-writer](src/nodes/plan-writer.ts) (emits `PlanStep[]`).
- Tests: [test/read-only-nodes.test.ts](test/read-only-nodes.test.ts)
  — uses a `FakeLLM` keyed off `req.tag` so each node's contract is
  exercised without spawning a real model.

### R-D (DONE) — Mem0 read-side

- Memory interface + backends:
  [src/memory/types.ts](src/memory/types.ts) (`Mem0ClientLike`,
  `MemoryRecord`, `MemoryType`, `SELF_EVO_USER_ID`),
  [src/memory/scoring.ts](src/memory/scoring.ts) (token-overlap
  ranking — hyphens split, stopwords + short/numeric tokens dropped),
  [src/memory/in-memory.ts](src/memory/in-memory.ts) (RAM-only,
  test-friendly), [src/memory/file.ts](src/memory/file.ts) (JSONL,
  cross-process persistence), [src/memory/factory.ts](src/memory/factory.ts)
  (`mode = memory | file | cloud | disabled`; `cloud` throws until a
  later round wires `mem0ai`).
- Service wiring:
  [src/agent-services.ts](src/agent-services.ts) gains `memory?: Mem0ClientLike`;
  cli builds it from `[mem0]` config when mode ≠ disabled.
- Intake reads memory: [src/nodes/intake.ts](src/nodes/intake.ts)
  calls `memory.search(query, {user_id: "self-evo", limit: 5})` with
  `query = topic + reqs.map(text).join(" ")` when the client is
  present. Maps hits → `PriorMemory[]` on state.
- CLI surface:
  [src/cli.ts](src/cli.ts) gains `self-evo memories list [--type] [--limit]`
  and `self-evo memories search <query> [--type] [--limit]`.
- Config:
  [config/self-evo.ini](config/self-evo.ini) gains a `[mem0]` block;
  [src/config.ts](src/config.ts) loads it.
- Tests: [test/memory.test.ts](test/memory.test.ts) — 9 cases covering
  tokenizer, scoring, both backends, factory, intake-with-memory,
  intake-without-memory.

### R-E (DONE) — Patch author (dry-run)

- Patch tools: [src/tools/patch.ts](src/tools/patch.ts) —
  `extractPathFromDiff(diff)` (reads `+++ b/<path>`),
  `withinBoundary(path, globs)` (minimatch, fail-closed on empty),
  `gitApplyCheck(diff, cwd)` (read-only, returns
  `{ok, error?}` with up to 300 chars of stderr).
- Node rewrite: [src/nodes/patch-author.ts](src/nodes/patch-author.ts)
  — LLM produces `{"diffs":[{path, explanation, diff}]}`, each
  candidate runs through `validateCandidate()` (shape →
  boundary → `git apply --check`), accepted diffs land both in
  `state.patches[]` (`applied: false`) and as
  `runs/<runId>/patches/<NN>-<basename>.patch`. Rejected diffs print
  to stderr but never throw.
- Services: [src/agent-services.ts](src/agent-services.ts) gains
  `workspaceRoot: string`; cli passes `config.run.workspaceDir`.
- Deps: added `minimatch@10`.
- TS target bumped to `ES2023` (uses `toSorted`).
- Tests: [test/patch-author.test.ts](test/patch-author.test.ts) — 4
  cases: header extraction, boundary glob, real `git apply --check`
  against a temp `git init` repo, end-to-end (3-diff fixture where
  only the in-boundary applies-cleanly diff lands).

### R-F (DONE) — Verifier (shell allowlist)

- Generalised `Verification` type: [src/types.ts](src/types.ts) now has
  `checks: CheckResult[]` (each with `name`, `status`, `durationMs`,
  optional `excerpt`) plus a flattened `failureExcerpts` convenience
  copy. Fixed lint/typecheck/tests/smoke fields are gone.
- Shell runner: [src/tools/shell.ts](src/tools/shell.ts) — `runChecks()`
  walks a channel list, spawns each command as `{bin, args}` (NO shell
  string), streams stdout+stderr through a TailBuffer (last 40 lines),
  appends every line to `runs/<runId>/verification.log` prefixed with
  the channel name, and per-channel short-circuits on first non-zero
  exit. Built-in `VERIFY_COMMANDS` map: `lint → pnpm md:lint`,
  `typecheck → pnpm -r typecheck`, `tests → pnpm -r test`,
  `smoke → pnpm dev:builder:smoke:stub`.
- Verifier node: [src/nodes/verifier.ts](src/nodes/verifier.ts) — takes
  channel routing from `config.verify.byChangeType[state.changeType]`
  (fallback `defaultChannels`), runs them, populates
  `state.verification`. Never throws — even spawn errors land as
  `status: "fail"`.
- Config: [src/config.ts](src/config.ts) parses `[verify.default]` and
  per-changeType `[verify.bug-fix]` / `[verify.feature]` / etc.
  Defaults in code so empty INI still works.
- Graph wiring: [src/graph.ts](src/graph.ts) gains `GraphConfig` with
  `verifier: VerifierConfig`; tests can inject a custom commands map.
- Tests: [test/verifier.test.ts](test/verifier.test.ts) — 6 cases:
  empty channels, pass + noisy fail with tail excerpt, unknown channel
  → skip, command short-circuit on first failure, end-to-end through
  the graph with changeType routing, failure excerpt visible at HITL.
  Uses `true` / `false` / `node -e` as canned commands.

### R-G (DONE) — Round-writer + judge + Mem0 write-side — **MVP COMPLETE**

- Real holistic judge: [src/nodes/judge.ts](src/nodes/judge.ts) —
  five-dimension scorecard (`repo-scanner`, `boundary-scoper`,
  `change-classifier`, `plan-writer`, `verifier`). Score = mean of
  passing dimensions. `score >= approveThreshold` → approve. Below →
  refine with `revertTo` set to first failed dim in pipeline order.
  Reflection cap: `state.judgeIterations` counts entries; once it
  reaches `maxIterations`, the judge force-approves with a notes
  entry so HITL always gets a turn.
- State: [src/state.ts](src/state.ts) gains `judgeIterations: number`.
  [src/nodes/\_reset.ts](src/nodes/_reset.ts) clears it on revise so a
  manual revision restarts the reflection budget.
- Round template: [src/renderers/round-template.ts](src/renderers/round-template.ts)
  renders the full PDCA `Round_NN.md` from state — Status=Review,
  Date started=today, Goal=topic, Plan (checkboxes), Do (findings +
  boundary + change type + patches), Check (verification with fenced
  failure excerpts), Act (verdict + Learnings / Promotions
  placeholders).
- Promotions: [src/renderers/promotions.ts](src/renderers/promotions.ts)
  appends an entry under the existing
  [.agents/plan/promotions.md](../../plan/promotions.md) format —
  never rewrites existing content.
- Round-writer: [src/nodes/round-writer.ts](src/nodes/round-writer.ts)
  — mints the next round number from `.agents/plan/cycles/Round_NN.md`,
  writes the rendered Round file, appends to `promotions.md`, and
  pushes derived memory candidates (decision/topic, convention/each
  assumption, pitfall/each failed channel) into
  `services.memory.add(...)` with `metadata.draft = true` so future
  rounds can promote/demote.
- Config: [src/config.ts](src/config.ts) + INI gain `[reflection]`
  (enabled / maxIterations / approveThreshold). When `enabled = false`,
  cli passes `{maxIterations: 1, approveThreshold: 0}` so the judge
  always approves on first pass.
- Graph: [src/graph.ts](src/graph.ts) `GraphConfig` extended with
  optional `judge` and `roundWriter` configs.
- Tests: [test/r-g.test.ts](test/r-g.test.ts) — 7 cases: judge approve,
  judge refine + revertTo, reflection cap force-approve, template
  rendering (full PDCA shape + failure excerpts), round-writer mints
  next number, round-writer persists derived memories, end-to-end
  round-to-approval with Round_NN.md written.

### What works end-to-end today (MVP)

```sh
pnpm --filter @self/orchestrator build
scripts/self-evo.sh round "your topic" --req "..." --req "..."
# → intake (Mem0 search) → repo-scanner → boundary-scoper
#   → change-classifier → plan-writer → patch-author (dry-run diffs
#   under runs/<id>/patches/) → verifier (channels from
#   [verify.<changeType>] into runs/<id>/verification.log)
#   → judge (holistic scorecard; refine up to maxIterations)
#   → pauses at hitl-gate

echo "approve" | scripts/self-evo.sh resume <runId>
# → round-writer writes .agents/plan/cycles/Round_NN.md, appends to
#   .agents/plan/promotions.md, persists derived memories into Mem0.

scripts/self-evo.sh memories list
scripts/self-evo.sh memories search "upload flow"
```

`state.json` after a closed run holds: topic, requirements,
priorMemories, findings, scope, changeType, plan, patches, verification,
verdict, hitl, **round** (`{ number, path }`), judgeIterations.

Tests: `pnpm --filter @self/orchestrator test` → **50/50 passing**.

### R-I (DONE) — `apply` mode + verifier delta

- HitlKind extended: `apply` joins `approve | revise | quit`. CLI
  parser + prompt updated.
- State: [src/state.ts](src/state.ts) gains `appliedVerification` and
  `appliedWorktree` — verifier results from the worktree plus the
  worktree path so the human can `git diff` it before final approve.
- Worktree tool: [src/tools/worktree.ts](src/tools/worktree.ts) —
  `createWorktree({repoRoot, basePath, symlinks})` does
  `git worktree add --detach` at HEAD and symlinks requested
  top-level entries (default `node_modules`) so pnpm scripts resolve
  their deps. `applyPatch(worktree, diff)` pipes the diff into
  `git apply -`. `removeWorktree(repoRoot, worktree)` is
  idempotent and falls back to `fs.rm` if metadata is already pruned.
- Apply-verifier node: [src/nodes/apply-verifier.ts](src/nodes/apply-verifier.ts)
  — creates worktree, applies each `state.patches[]` (marks
  `applied: true/false` per outcome), re-runs the verifier with
  `cwd = worktree`, writes a separate
  `runs/<id>/applied-verification.log`, and stamps state with the
  results. `preserveWorktree` flag (default true) keeps the dir on
  disk for human review.
- Graph edge: [src/graph.ts](src/graph.ts) — `hitl-gate` router routes
  `apply` → `apply-verifier`; an unconditional edge wires
  `apply-verifier` → `hitl-gate` so the user gets a fresh HITL pause
  with the delta visible in state.
- Round template: [src/renderers/round-template.ts](src/renderers/round-template.ts)
  Check section now shows _Pre-patch_ + _Post-patch_ blocks side by
  side, plus the worktree path when preserved.
- Tests: [test/r-i.test.ts](test/r-i.test.ts) — 5 cases: worktree
  isolation (main untouched after apply), applyPatch failure surface,
  apply-verifier delta against a real git repo with `true`-only
  channels, per-patch apply-failure recording without throwing,
  end-to-end `round → apply → re-pause → approve → Round_NN.md`
  with the post-patch verification block rendered.

### R-M (DONE) — Chunked patch-author + recommended LLM routing

- [src/nodes/patch-author.ts](src/nodes/patch-author.ts) rewritten to
  loop one LLM call per plan step (tag `patch-author:<stepId>`) instead
  of one giant call for the whole plan. Per-step shape is
  `{diff, path, explanation}`; `diff: null` means "non-code step,
  skip" (not a rejection). Each step's failure mode is isolated — one
  parse error or timeout no longer kills the stage.
- Per-step patch filenames embed the stepId
  (`runs/<id>/patches/01-P1-foo.patch`) so a glance at the directory
  shows which plan step produced which diff.
- [config/llm.example.yaml](config/llm.example.yaml) now demonstrates
  the recommended routing: everything on `subprocess`, `patch-author`
  on `mode: api` with `maxTokens: 16384` and `timeoutMs: 120000`. Copy
  to `llm.yaml` + set `ANTHROPIC_API_KEY` to activate.
- README has a "Recommended LLM setup" section explaining the toggle.

### R-L (DONE) — Tool-grounded repo-scanner

- [src/tools/probe.ts](src/tools/probe.ts) — `probeLint(paths)` runs
  `pnpm exec markdownlint-cli2` and returns the real output (including
  "exit 0 — no issues" on success); `probeFileRead(paths)` returns up
  to `maxChars` per existing file; `detectDocTopic(topic, reqs)` picks
  doc-flavoured topics by keyword.
- [src/nodes/repo-scanner.ts](src/nodes/repo-scanner.ts) now seeds
  candidate paths from ripgrep hits, runs lint probe for doc topics
  and file-read probe for everything, and renders the probe outputs
  into the user prompt under a delimited section. The system prompt
  carries a hard GROUNDING RULE: every finding's `evidence` must
  reference a specific probe or hit; if the linter exited 0, the
  finding has to say so. Fixes the first-real-round failure mode
  where the scanner invented six lint complaints on a clean file.
- Per-test toggle: `RepoScannerConfig.disableProbes = true` skips
  probe execution so the existing read-only-nodes / r-i tests stay
  hermetic.

### R-K (DONE) — LangSmith tracing hook

- [src/tracing.ts](src/tracing.ts) — `traceableInvokeConfig(runId)`
  returns the `{configurable, runName, tags, metadata}` shape every
  invoke passes to LangGraph. Each invoke is tagged `self-evo` +
  `run:<runId>` and named `self-evo:<runId>`. Helper
  `tracingEnabled()` reflects `LANGCHAIN_TRACING_V2` for callers that
  want to gate logging.
- LangChain core auto-forwards spans to LangSmith when the standard
  env vars (`LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, optional
  `LANGCHAIN_PROJECT` / `LANGCHAIN_ENDPOINT`) are set; we don't read
  any of them ourselves. README documents the toggle.
- CLI: both `round` and `resume` now use `traceableInvokeConfig`
  instead of the bare `{configurable: {thread_id}}`.
- Tests: [test/tracing.test.ts](test/tracing.test.ts) — 2 cases:
  shape of the invoke config + env-var sensing.

## Learnings — round a (`Add a /self-evo Claude Code slash command stub`)

First real round to close end-to-end via the orchestrator. Closed
clean with a real `Round_01.md` written and the slash command applied
to `.claude/commands/self-evo.md` (now visible in Claude Code's
slash-command list).

Bugs surfaced (all fixed in the follow-up hardening commit):

1. **Chunked patch-author + new file → N "create from /dev/null"
   diffs.** Each plan step's LLM call is independent, so when steps
   all target the same not-yet-existing file, every step emits a
   "create" diff. Only the first applies; the rest fail with "file
   already exists." Mitigation: `dedupByPath()` after the loop, keep
   the largest diff per path. Future round may add inter-step
   awareness (each step sees the running file state).
2. **`cfg.preserveWorktree` default was inverted.** Undefined falsy
   meant "remove"; the docstring said "preserve." Fixed: only
   `preserveWorktree: false` triggers cleanup.
3. **Round-template renderer produced files that fail markdownlint.**
   The dual Pre/Post check blocks butted headings against lists
   without blank lines (MD022/MD032). Fixed in
   `renderCheckBlock` to insert blanks around the heading.
4. **Worktree node_modules symlink covers only the top level.** In a
   pnpm monorepo each package has its own `node_modules/` symlinked
   into `.pnpm/`; those aren't recreated in the worktree, so any
   verifier channel that runs `pnpm -r typecheck`/`pnpm -r test`
   fails for missing-module reasons unrelated to the patch. Deferred
   — the smoke channel still passes, and the failure mode is loud
   and easy to recognise. Fix planned: either run `pnpm install
--frozen-lockfile` in the worktree, or stop using `-r` in the
   verifier command table and target the affected package only.
5. **The pre-apply verifier's "all green" verdict is over-confident**:
   it ran against current HEAD, not against the patched tree, so it
   tells the judge nothing about whether the patch is good. The
   apply-verifier delta is what actually matters. Open question:
   should the judge weight `appliedVerification` more heavily than
   `verification`?

Net effect after the hardening commit: the orchestrator can produce
a clean, lint-passing `Round_NN.md` and apply a single-file new-file
patch end-to-end without the noise round a introduced.

## What's NEXT — locked sequence

R-A → R-M are done. The orchestrator can close its own PDCA rounds
end-to-end and now has chunked patch-author + tool-grounded
repo-scanner (both fixes landed in R-M + R-L after the first real
round surfaced their issues).

The next stretch is a locked chain — each step's design is informed
by what the previous step taught:

1. **Round a (manual smoke)** — Add a `/self-evo` Claude Code slash
   command stub. Tiny scope (single new file under
   `.claude/commands/`), exercises plan-writer + chunked patch-author
   on a doc-flavoured topic.
2. **Round b (manual smoke)** — Promote `bug-fix` SKILL.md
   frontmatter to current Agent-Skills spec. Single SKILL.md edit;
   R-L's lint probe should run.
3. **Round c (manual smoke)** — Tighten error messages in
   `scripts/dev/builder-workflow-smoke.sh`. Code-flavoured; R-L's
   file-read probe runs, verifier hits `pnpm dev:builder:smoke:stub`.
4. **R-N (infrastructure)** — `/autoagent` overnight loop. I
   implement; spec includes self-lock on `src/llm/**`,
   `.claude/commands/autoagent.md`, and `.agents/skills/autoagent/**`;
   plus tier-1/tier-2 authority gates and per-round branch chaining.
   Format ported from the planner's
   [.claude/commands/autoagent.md](../../../tmp/apps/multi-agents-planner/.claude/commands/autoagent.md).
5. **R-O (first autoagent-driven feature)** — multi-provider LLM
   transport: GitHub Copilot, OpenAI Codex, Google Gemini adapters
   alongside the existing Claude API + subprocess. Self-evo edits its
   own `src/llm/` to add them, watched by autoagent. This is the
   recursive moment — orchestrator changing its own transport layer.

After R-O is closed: revisit R-H (Send fan-out) and R-J (graph
determinism tests) only if there's a measurable symptom.

### R-G — Round-writer + judge + Mem0 write-side (DONE — see above)

**Goal**: On approve, the orchestrator (a) renders `Round_NN.md`
following the [.agents/plan/PDCA.md](../../plan/PDCA.md) template,
(b) appends a row to [.agents/plan/promotions.md](../../plan/promotions.md),
(c) persists approved memories into Mem0 via the **already-wired**
`services.memory.add(...)` call (the read side from R-D). Also turns
on the real holistic `judge` (replaces the R-A stub).

**Files**:

- `src/renderers/round-template.ts` — fills the PDCA round template
  from state.
- `src/renderers/promotions.ts` — append-only writer.
- Rewrite `src/nodes/round-writer.ts`:
  - Mint the next round number by reading
    `.agents/plan/cycles/Round_*.md` and bumping.
  - Render Round_NN.md, write it.
  - For each "promotion candidate" in state (collected at HITL via
    follow-up prompts), call `services.memory.add(...)` with
    `metadata: { round, type, stage, ts }`.
- Rewrite `src/nodes/judge.ts` — port the holistic scorecard from
  `multi-agents-planner/apps/planner/src/agents/judge.ts` (lines
  1–80), adapted for `SelfEvoState`: score completeness of findings,
  scope, plan, patches, verification (use the new `checks[]` shape
  — a failed `lint`/`tests`/`smoke` check is a strong negative
  signal). Score >= threshold → approve. Otherwise → revertTo the
  weakest stage.
- Add `[reflection] enabled / maxIterations / approveThreshold` to
  the INI; wire into a conditional edge cap (count iterations on a
  state field `state.judgeIterations`).
- Tests: `test/round-writer.test.ts` + `test/judge.test.ts`.

**Acceptance**: `self-evo round "Port reference orchestrator"` →
HITL approve → `.agents/plan/cycles/Round_NN.md` exists and matches
the PDCA template; one Mem0 record retrievable.

### After R-G (post-MVP, deferred)

- **R-H**: `Send`-based fan-out for parallel research / per-finding
  classification (optional; the planner has R-19 plumbing).
- **R-I**: `--apply` flag — clean temp worktree, `git apply` accepted
  diffs there, verifier re-runs against the applied tree.
- **R-J**: Graph driver parity tests (this orchestrator is already on
  the graph driver; this round just adds determinism tests).
- **R-K**: LangSmith tracing (`LANGCHAIN_TRACING_V2=true`).

## First real-round learnings (2026-05-17)

Drove the first end-to-end round with topic `"Tighten ROLLOUT.md
formatting"` against this repo (run `2026-05-17-01-46-...`). The
pipeline ran intake → repo-scanner → boundary-scoper →
change-classifier → plan-writer cleanly — produced a coherent 8-step
plan with correct boundary (`.agents/orchestrators/self-evo/ROLLOUT.md`
only) and classification (`doc`). Three concrete findings worth a
follow-up round each:

1. **`repo-scanner` doesn't ground findings in tool output.** It
   produced 7 lint "findings" that turned out to be speculative —
   `markdownlint-cli2 ROLLOUT.md` reports zero errors. The scanner
   uses ripgrep + LLM inference; for doc / lint topics it should
   _run the lint channel during scanning_ and feed the actual report
   into the prompt. Fix scope: extend `repo-scanner` to call a
   read-only `verifier` pass when changeType hints at doc/lint
   work.
2. **`patch-author` over `claude -p` subprocess can't fit the
   time budget.** Subprocess startup is ~30–60s, and producing a
   JSON document of multi-KB unified diffs is another 2–4 min of
   thinking. Even with `timeoutMs = 300_000` it timed out. Fix
   scope: switch `patch-author` to Anthropic SDK direct
   (`mode: api`), OR break diff generation into per-plan-step calls
   so each one stays small.
3. **Hardening shipped from this round** (already in tree):
   - `subprocess.ts` default `timeoutMs` bumped 120s → 300s; per-node
     override via `SELFEVO_LLM_<NODE>_TIMEOUT_MS`.
   - `cli.ts` snapshots `state.json` in a `finally` block so a
     thrown invoke still leaves an inspectable state on disk.
   - `scripts/self-evo.sh` `ensure_built` now detects stale builds
     (any `src/**.ts` newer than `dist/cli.js` triggers a rebuild) —
     caught a "running yesterday's graph" bug on the first run.

## Known gotchas / things future-you should know

1. **`isInterrupted(result)` is the right detection signal in
   LangGraph 1.x.** Do NOT try/catch `GraphInterrupt` — with a
   checkpointer attached, the exception is caught internally.
2. **Node names must not collide with state field names.** That's
   why the HITL node is `hitl-gate`, not `hitl`. If you add new
   state fields in R-D+, double-check the node names.
3. **`better-sqlite3` requires native build.** pnpm 10 blocks
   install scripts; run `npm run install` inside the
   `node_modules/.pnpm/better-sqlite3@*/.../better-sqlite3/` dir
   if the binding is missing. The repo's pnpm config doesn't
   pre-approve it.
4. **Tests use a separate tsconfig** ([tsconfig.test.json](tsconfig.test.json))
   so `.ts` test files compile under `dist-test/test/`. Run
   `pnpm test` — not `node --test test/` directly.
5. **`withResetGuard`** in [src/graph.ts](src/graph.ts) is the only
   place that knows about the revise→reset semantics. New revertable
   stages must be added to both `REVERT_NODES` and `_reset.ts`'s
   `ORDER` array.
6. **LLM subprocess driver concatenates** `system`, a `\n\n---\n\n`
   separator, and `user` because `claude -p` has one stdin channel. The Anthropic
   adapter sends them as separate fields. Don't assume drivers are
   structurally identical at the wire.
7. **The verifier in R-F should never assume tests are green at
   HEAD.** Capture a baseline pass/fail per channel before judging
   the round's diff.

## Test surface today

```text
test/skeleton.test.ts            # 3 tests — graph wiring, HITL, revise
test/llm-skills.test.ts          # 8 tests — skills loader/compose,
                                 #            subprocess client, resolver
test/read-only-nodes.test.ts     # 4 tests — fake LLM walks repo-scanner,
                                 #            boundary-scoper, classifier,
                                 #            plan-writer; JSON parsing
                                 #            edge cases
test/memory.test.ts              # 9 tests — tokenizer/scoring, InMemory,
                                 #            File, factory, intake with
                                 #            and without memory
test/patch-author.test.ts        # 5 tests — header extraction, boundary,
                                 #            real git apply --check,
                                 #            3-diff fixture filter,
                                 #            empty-allowedFiles skip
test/verifier.test.ts            # 6 tests — runChecks empty/pass/fail,
                                 #            unknown channel → skip,
                                 #            command short-circuit,
                                 #            end-to-end through graph,
                                 #            failure excerpt at HITL
test/r-g.test.ts                 # 7 tests — judge approve / refine /
                                 #            reflection-cap force-approve,
                                 #            round-template render,
                                 #            failure excerpts in render,
                                 #            round-writer mints number,
                                 #            round-writer Mem0 add,
                                 #            end-to-end round → approve
                                 #            → Round_NN.md lands
test/r-i.test.ts                 # 5 tests — worktree isolation,
                                 #            applyPatch error path,
                                 #            apply-verifier delta,
                                 #            per-patch apply failures,
                                 #            end-to-end round → apply
                                 #            → re-pause → approve
test/tracing.test.ts             # 2 tests — invoke-config shape,
                                 #            env-var sensing
```

60/60 passing.

```text
test/r-l.test.ts                 # 7 tests — detectDocTopic,
                                 #            probeFileRead truncation,
                                 #            probeLint output shape,
                                 #            probeLint with no .md,
                                 #            renderProbes formatting,
                                 #            repo-scanner injects
                                 #            probes into prompt,
                                 #            disableProbes toggle
```
