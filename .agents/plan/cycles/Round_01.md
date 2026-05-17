# Round 01: Add a /self-evo Claude Code slash command stub

**Status**: Review
**Date started**: 2026-05-17
**Date completed**: _(set on human approval)_

## Goal

Add a /self-evo Claude Code slash command stub

### Requirements

- **R01** — Boundary: only .claude/commands/self-evo.md may be created or modified
- **R02** — Wrap the existing scripts/self-evo.sh dispatcher so /self-evo in chat forwards round/resume/memories to it
- **R03** — Follow the existing .claude/commands/pdca.md as the formatting + frontmatter template

## Plan

- [ ] **P1** — Read .claude/commands/pdca.md to capture the exact frontmatter keys, section headings, and Bash invocation pattern to mirror.
- [ ] **P2** — Draft .claude/commands/self-evo.md with YAML frontmatter (description, argument-hint) describing the /self-evo command and its sub-commands.
- [ ] **P3** — Write the # /self-evo section with a one-liner purpose statement.
- [ ] **P4** — Write the ## User Input section mapping $ARGUMENTS to the three sub-commands (round, resume, memories) with a brief description of each.
- [ ] **P5** — Write the ## Behavior section containing the Bash invocation that forwards $ARGUMENTS to .agents/orchestrators/self-evo/scripts/self-evo.sh via $@.
- [ ] **P6** — Write the ## Output and ## Notes sections with expected output guidance and edge-case notes (missing sub-command, unknown argument).
- [ ] **P7** — Run markdownlint on .claude/commands/self-evo.md and fix any violations until it passes clean.

## Do

### Findings (6)

- **.claude/commands/pdca.md** — The pdca.md template exists and provides a clear frontmatter + section structure (description, argument-hint, $ARGUMENTS, Behavior, Output, Notes) that self-evo.md should mirror. _(tool:file-read of .claude/commands/pdca.md shows YAML frontmatter with `description:` and `argument-hint:` keys, followed by # /pdca, ## User Input with $ARGUMENTS, ## Behavior, ## Output, and ## Notes sections.)_
- **.claude/commands/self-evo.md** — The target file does not yet exist, so the planner must create it from scratch rather than patch an existing file. _(Glob for `.claude/commands/self-evo.md` returned 'No files found'.)_
- **.agents/orchestrators/self-evo/scripts/self-evo.sh** — The dispatcher lives at .agents/orchestrators/self-evo/scripts/self-evo.sh (not at scripts/self-evo.sh in the repo root), so the slash command must reference the correct nested path. _(Glob for `scripts/self-evo*` at repo root returned no files; the actual file was found at `.agents/orchestrators/self-evo/scripts/self-evo.sh`.)_
- **.agents/orchestrators/self-evo/scripts/self-evo.sh** — The dispatcher accepts sub-commands positionally (e.g. `round`, `resume`, `memories`) and forwards all arguments to `node dist/cli.js "$@"`, so the slash command must map $ARGUMENTS to those sub-commands. _(tool:file-read shows `exec node "$CLI*ENTRY" "$@"` at line 26, and the header comment says 'callers do scripts/self-evo.sh round "topic"'.)*
- **tool:lint** — No markdown formatting issues were found in the repo README; the new self-evo.md should pass markdownlint as well if it follows the pdca.md style. _(markdownlint-cli2 exit 0 — no issues reported on README.md.)_
- **inference** — The ripgrep hits for 'Claude Code' are all documentation references or node*modules metadata and contain no existing slash-command registration logic; the only convention to follow is the .claude/commands/ directory pattern established by pdca.md.*(All 'Claude Code' ripgrep hits land in METADATA, README.md, docs/governance.md, and scripts/crg — none reference .claude/commands/ or slash-command wiring.)\_

### Boundary

- **In scope**: Create .claude/commands/self-evo.md with YAML frontmatter (description, argument-hint) and sections (# /self-evo, ## User Input, ## Behavior, ## Output, ## Notes) mirroring pdca.md, Map $ARGUMENTS to sub-commands (round, resume, memories) forwarded to .agents/orchestrators/self-evo/scripts/self-evo.sh, Ensure the file passes markdownlint
- **Out of scope**: Any changes to .agents/orchestrators/self-evo/scripts/self-evo.sh or its internals, Any changes to .claude/commands/pdca.md or other existing commands, Registration logic, hook wiring, or settings.json changes (Claude Code discovers commands from .claude/commands/ automatically), Changes to docs/, README.md, CLAUDE.md, or any other documentation, Changes to the self-evo orchestrator source code (LangGraph.js, Mem0, cli.js)
- **Allowed file globs**: `.claude/commands/self-evo.md`
- **Assumptions**:
  - Claude Code auto-discovers slash commands from .claude/commands/\*.md — no explicit registration is needed
  - The dispatcher at .agents/orchestrators/self-evo/scripts/self-evo.sh is functional and accepts positional sub-commands (round, resume, memories) forwarded via $@
  - pdca.md's frontmatter keys (description, argument-hint) are the only required metadata fields for a slash command
  - The slash command will invoke the dispatcher via a Bash call in the behavior section, not by importing Node modules directly

### Change type: `feature`

### Patches (dry-run, 4)

- `.claude/commands/self-evo.md` — applied: true
- `.claude/commands/self-evo.md` — applied: false
- `.claude/commands/self-evo.md` — applied: false
- `.claude/commands/self-evo.md` — applied: false

## Check

### Pre-patch (current HEAD)

- [x] **lint** — pass _(1200ms)_
- [x] **typecheck** — pass _(1426ms)_
- [x] **tests** — pass _(33719ms)_
- [x] **smoke** — pass _(187ms)_

### Post-patch (worktree, after `apply`)

- [x] **lint** — pass _(818ms)_
- [ ] **typecheck** — fail _(1184ms)_
- [ ] **tests** — fail _(388ms)_
- [x] **smoke** — pass _(222ms)_

**Failure excerpts** (first 40 lines per failing channel):

```text
[apply .claude/commands/self-evo.md] error: .claude/commands/self-evo.md: already exists in working directory
```

```text
[apply .claude/commands/self-evo.md] error: .claude/commands/self-evo.md: already exists in working directory
```

```text
[apply .claude/commands/self-evo.md] error: .claude/commands/self-evo.md: already exists in working directory
```

```text
[typecheck] .agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(49,20): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(50,28): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(50,46): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(51,28): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(51,49): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(54,24): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(58,20): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(61,17): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/ripgrep.ts(86,26): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(1,23): error TS2591: Cannot find name 'node:child_process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(2,46): error TS2591: Cannot find name 'node:fs/promises'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(3,25): error TS2591: Cannot find name 'node:path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(39,9): error TS2503: Cannot find namespace 'NodeJS'.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(83,9): error TS2503: Cannot find namespace 'NodeJS'.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(88,17): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(92,19): error TS2304: Cannot find name 'setTimeout'.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(96,34): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(105,24): error TS7006: Parameter 'err' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(106,7): error TS2304: Cannot find name 'clearTimeout'.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(110,24): error TS7006: Parameter 'code' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/shell.ts(111,7): error TS2304: Cannot find name 'clearTimeout'.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(1,23): error TS2591: Cannot find name 'node:child_process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(2,42): error TS2591: Cannot find name 'node:fs/promises'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(3,28): error TS2591: Cannot find name 'node:fs'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(4,40): error TS2591: Cannot find name 'node:path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(42,22): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(43,22): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(44,30): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(44,51): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(45,30): error TS7006: Parameter 'c' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(45,51): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(48,24): error TS7006: Parameter 'code' implicitly has an 'any' type.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(51,17): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tools/worktree.ts(52,17): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: src/tracing.ts(31,13): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
.agents/orchestrators/self-evo typecheck: Failed
/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-07-28-6050/worktree/.agents/orchestrators/self-evo:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @self/orchestrator@0.0.1 typecheck: `tsc --noEmit`
Exit status 2
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

```text
[tests] Scope: 2 of 3 workspace projects
.agents/orchestrators/self-evo test$ pnpm run build:test && node --test dist-test/test/
apps/builder test$ vitest run
apps/builder test: sh: 1: vitest: not found
/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-07-28-6050/worktree/apps/builder:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  builder@0.0.1 test: `vitest run`
spawn ENOENT
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

_Worktree preserved at_: `/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-07-28-6050/worktree`

## Act

_Judge verdict_: **approve** at score 1.00

**Learnings**:

- _(human to fill in during review)_

**Promotions**:

- [ ] → context/ : _topic_
- [ ] → skills/ : _topic_
