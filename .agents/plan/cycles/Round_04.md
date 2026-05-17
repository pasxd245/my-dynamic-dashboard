# Round 04: Add a one-line cross-link to /autoagent at the top of the self-evo RE…

**Status**: Review
**Date started**: 2026-05-17
**Date completed**: _(set on human approval)_

## Goal

Add a one-line cross-link to /autoagent at the top of the self-evo README

### Requirements

- **R01** — Boundary: only .agents/orchestrators/self-evo/README.md may be modified
- **R02** — Add a single short sentence near the top mentioning that /autoagent (defined at .claude/commands/autoagent.md) drives self-evo through autonomous overnight rounds
- **R03** — Preserve all existing sections and headings; only insert a brief reference, do not restructure
- **R04** — File must still pass markdownlint

## Plan

- [ ] **P1** — Read `.agents/orchestrators/self-evo/README.md` and identify the insertion point (after the title or first paragraph)
- [ ] **P2** — Read `.claude/commands/autoagent.md` to confirm the command path and one-line purpose for the cross-link
- [ ] **P3** — Insert a single cross-link sentence near the top of `.agents/orchestrators/self-evo/README.md` referencing `/autoagent`
- [ ] **P4** — Run `npx markdownlint .agents/orchestrators/self-evo/README.md` and fix any lint errors

## Do

### Findings (4)

- **inference** — All ripgrep hits are from vendored dependencies (venv, dist, builder bundles) and are completely irrelevant to the target file `.agents/orchestrators/self-evo/README.md`. _(Every ripgrep hit path starts with `apps/backend/.venv-*`, `apps/builder/dist/*`, `scripts/ghx`, or `README.md` at the root — none reference `.agents/orchestrators/self-evo/README.md`.)_
- **tool:file-read** — The file-read probes targeted vendored third-party code (`_pytest`, `pyarrow`, `pygments`) and contain no information about the self-evo README or the /autoagent command. _(All four file-read probes returned contents from `.venv-*` site-packages — e.g. `_pytest/_code/code.py`, `pyarrow function.h`, `_lilypond_builtins.py` — with no relation to the task.)_
- **inference** — No probe examined the actual target file (.agents/orchestrators/self-evo/README.md) or the autoagent command definition (.claude/commands/autoagent.md), so their current content is unknown from these probes. _(Neither .agents/orchestrators/self-evo/README.md nor .claude/commands/autoagent.md appears in any ripgrep hit or file-read probe.)_
- **inference** — The task is a single-line insertion bounded to one file; the planner should read .agents/orchestrators/self-evo/README.md and .claude/commands/autoagent.md before editing, then validate with markdownlint. _(R01 restricts changes to .agents/orchestrators/self-evo/README.md; R04 requires markdownlint pass; neither file was probed so the planner must read them first.)_

### Boundary

- **In scope**: Add a single cross-link sentence near the top of the self-evo README referencing /autoagent, Read .agents/orchestrators/self-evo/README.md to understand current structure, Read .claude/commands/autoagent.md to confirm the command path and purpose, Validate the edited file passes markdownlint
- **Out of scope**: Any file other than .agents/orchestrators/self-evo/README.md, Restructuring, reordering, or removing existing sections/headings in the README, Modifying the /autoagent command definition itself, Adding new sections, tables, or multi-line blocks — insertion is one brief sentence only
- **Allowed file globs**: `.agents/orchestrators/self-evo/README.md`
- **Assumptions**:
  - The file .agents/orchestrators/self-evo/README.md exists and is a valid Markdown file
  - The /autoagent command is defined at .claude/commands/autoagent.md and drives autonomous overnight PDCA rounds
  - markdownlint is available in the repo toolchain (npx markdownlint or equivalent)
  - A suitable insertion point exists near the top of the README (e.g., after the title or introductory paragraph)

### Change type: `doc`

### Patches (dry-run, 1)

- `.agents/orchestrators/self-evo/README.md` — applied: true

## Check

### Pre-patch (current HEAD)

- [x] **lint** — pass _(982ms)_

### Post-patch (worktree, after `apply`)

- [x] **lint** — pass _(986ms)_

_Worktree preserved at_: `/home/ubuntu/pf/my-dynamic-dashboard/.agents/tmp/workspace/runs/2026-05-17-15-22-35-e896/worktree`

## Act

_Judge verdict_: **approve** at score 1.00

**Learnings**:

- _(human to fill in during review)_

**Promotions**:

- [ ] → context/ : _topic_
- [ ] → skills/ : _topic_
