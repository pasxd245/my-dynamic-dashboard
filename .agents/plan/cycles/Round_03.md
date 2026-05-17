# Round 03: Tighten error messages in scripts/dev/builder-workflow-smoke.sh

**Status**: Review
**Date started**: 2026-05-17
**Date completed**: _(set on human approval)_

## Goal

Tighten error messages in scripts/dev/builder-workflow-smoke.sh

### Requirements

- **R01** — Boundary: only scripts/dev/builder-workflow-smoke.sh may be modified
- **R02** — Make stage-failure messages more actionable: include the stage name, the BUILDER_SMOKE_MODE, and a one-line hint for the operator
- **R03** — Preserve the existing exit-code contract and the print_stage_summary format other tooling parses
- **R04** — Script must still pass pnpm dev:builder:smoke:stub

## Plan

- [ ] **P1** — Enrich stub-mode stage-failure messages (lines 27, 29): append `mode=${MODE}` context and a one-line operator hint (e.g. 'set BUILDER_SMOKE_FAIL_STAGE to override') to the `message=` value in the `print_stage_summary` calls inside `run_stub_mode`.
- [ ] **P2** — Add `mode=${MODE}` field to the summary line on failure (line 34) — insert it after the existing `first_failed_stage=` key so operators can identify which code-path ran. Apply the same addition to the success summary line (line 38) for parity.
- [ ] **P3** — Wrap api-mode `curl` call (lines 49-53) in an error handler that, on failure, prints stage name (`POST builder-workflow`), mode (`api`), and a remediation hint (e.g. 'check API_BASE / server health') before re-raising the non-zero exit code.
- [ ] **P4** — Wrap api-mode `python3 -c` JSON-parse call (line 56) and the second `curl` (line 58) with analogous contextual error output (stage name, mode, hint) so a parse or fetch failure is immediately actionable.
- [ ] **P5** — Verify `print_stage_summary` output preserves exact `[builder-workflow-smoke] stage= status= message=` prefix and key order — new fields only appear _after_ the existing keys or in separate human-only echo lines.
- [ ] **P6** — Run `pnpm dev:builder:smoke:stub` (stub mode) and confirm enriched messages appear, exit codes are unchanged (0 on success, 1 on simulated failure), and parseable prefix is intact.

## Do

### Findings (6)

- **scripts/dev/builder-workflow-smoke.sh** — Stage-failure messages in stub mode (lines 27, 29) are generic and do not include BUILDER*SMOKE_MODE or an operator hint.*(Line 27: `print_stage_summary "failed" "$stage" "Simulated stage failure"` — message lacks MODE context and remediation hint.)\_
- **scripts/dev/builder-workflow-smoke.sh** — The summary line on failure (line 34) omits BUILDER*SMOKE_MODE, making it hard for operators to tell which code-path produced the failure.*(Line 34: `echo "[builder-workflow-smoke] status=failed first_failed_stage=${first_failed}"` — no mode= field.)\_
- **scripts/dev/builder-workflow-smoke.sh** — In api mode, a curl or JSON-parse failure will produce only the default `set -e` error with no stage name, mode, or hint. _(Lines 49-56: curl and python3 commands run under `set -euo pipefail` with no trap or wrapper providing contextual error output.)_
- **scripts/dev/builder-workflow-smoke.sh** — The `print_stage_summary` format (line 12) uses a parseable `stage= status= message=` structure that downstream tooling relies on; any changes must preserve this exact key order and prefix. _(Line 12: `echo "[builder-workflow-smoke] stage=${stage} status=${status} message=${message}"` — R03 requires preserving this format.)_
- **scripts/dev/builder-workflow-smoke.sh** — Exit-code contract is clean: stub mode returns 1 on failure (line 35) and 0 on success (line 39); api mode exits non-zero via `raise SystemExit(1)` (line 75). Both paths are safe to augment messages without altering exit codes. _(Lines 35, 39, 74-75 show the only exit-code–producing statements; adding text to messages won't change return values.)_
- **tool:lint** — Lint probe (markdownlint on README.md) exited 0; no lint was run against the shell script itself, so no shell-lint evidence is available from probes. _(markdownlint-cli2 exit 0 — ran on apps/dashboard/README.md, not on the target script.)_

### Boundary

- **In scope**: Enrich stage-failure messages in stub mode (lines ~27-29) to include BUILDER_SMOKE_MODE and a one-line operator hint, Add mode= field to the summary line on failure (line ~34) so operators can identify which code-path ran, Wrap api-mode curl/python3 calls (lines ~49-56) with contextual error output that includes stage name, mode, and remediation hint, Preserve print_stage_summary key order (stage= status= message=) and prefix exactly as-is
- **Out of scope**: Changing the print_stage_summary format or key order (downstream tooling depends on it), Altering exit codes (stub: 0/1, api: 0/non-zero via SystemExit), Modifying any file outside the target script, Adding new dependencies, sourcing new files, or changing the script's interface (flags, env-var contract), Refactoring unrelated logic (e.g. success paths, argument parsing)
- **Allowed file globs**: `scripts/dev/builder-workflow-smoke.sh`
- **Assumptions**:
  - BUILDER_SMOKE_MODE is always set when the script runs (sourced from env or defaulted internally)
  - The parseable format '[builder-workflow-smoke] stage=${stage} status=${status} message=${message}' is the only machine-parsed output; free-text lines (echo) are human-only
  - Adding extra key=value fields after the existing keys in the summary line (line ~34) is safe because downstream tooling matches by prefix/key, not by exact line length
  - pnpm dev:builder:smoke:stub exercises stub mode only; api-mode changes are validated by inspection and exit-code preservation

### Change type: `refactor`

### Patches (dry-run, 3)

- `scripts/dev/builder-workflow-smoke.sh` — applied: true
- `scripts/dev/builder-workflow-smoke.sh` — applied: true
- `scripts/dev/builder-workflow-smoke.sh` — applied: false

## Check

### Pre-patch (current HEAD)

- [x] **lint** — pass _(965ms)_
- [x] **typecheck** — pass _(1073ms)_
- [x] **tests** — pass _(34416ms)_

### Post-patch (worktree, after `apply`)

- [x] **lint** — pass _(888ms)_
- [ ] **typecheck** — fail _(998ms)_
- [ ] **tests** — fail _(334ms)_

**Failure excerpts** (first 40 lines per failing channel):

```text
[apply scripts/dev/builder-workflow-smoke.sh] error: patch failed: scripts/dev/builder-workflow-smoke.sh:24
error: scripts/dev/builder-workflow-smoke.sh: patch does not apply
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
/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-34-10-5dae/worktree/.agents/orchestrators/self-evo:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @self/orchestrator@0.0.1 typecheck: `tsc --noEmit`
Exit status 2
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

```text
[tests] Scope: 2 of 3 workspace projects
.agents/orchestrators/self-evo test$ pnpm run build:test && node --test dist-test/test/
apps/builder test$ vitest run
apps/builder test: sh: 1: vitest: not found
/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-34-10-5dae/worktree/apps/builder:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  builder@0.0.1 test: `vitest run`
spawn ENOENT
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

_Worktree preserved at_: `/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-14-34-10-5dae/worktree`

## Act

_Judge verdict_: **approve** at score 1.00

**Learnings**:

- _(human to fill in during review)_

**Promotions**:

- [ ] → context/ : _topic_
- [ ] → skills/ : _topic_
