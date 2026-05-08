---
name: skill-creator
description: Scaffold, update, and validate Agent Skills in this repo. Use whenever the user asks to create, add, scaffold, rename, or substantially restructure a skill under .agents/skills/ or .claude/skills/. Prefer a2scaffold when available so generated skills follow the Agent Skills spec referenced in .agents/AGENTS.md.
metadata:
  author: human
  version: '1.0'
---

## Trigger

Activate this skill when the user asks for any of:

- "Create a skill", "add a skill", "scaffold a skill", "new skill for X".
- Adding a directory under [.agents/skills/](../) or [.claude/skills/](../../../.claude/skills/).
- Editing an existing SKILL.md in a way that would be cleaner as a regenerate
  (e.g. renaming, restructuring frontmatter).

Do **not** activate for:

- Reading or explaining an existing skill — answer directly.
- Editing prose inside an existing SKILL.md's Procedure section — edit in place.

## Why prefer a2scaffold

`a2scaffold` helps keep generated skills consistent with the
[Agent Skills spec](https://agentskills.io/specification): frontmatter shape,
directory layout, and the `name`/directory match rule. Prefer it for new skill
creation and structural regeneration.

Manual edits are acceptable when adapting an existing skill's wording,
triggers, or procedure. Validate the result against
[AGENTS.md §Skills Format](../../AGENTS.md) either way.

## Procedure

### 1. Gather the skill spec

Ask the user (or infer from the request) and confirm:

- **`name`**: kebab-case, lowercase, must match the target directory name.
- **`description`**: one sentence — what it does and **when to use it**.
  This is what future agents read to decide relevance.
- **Target location**:
  - `.agents/skills/` — repo-wide skill, governed by AGENTS.md.
  - `.claude/skills/` — Claude-Code-specific skill.
- **Trigger conditions**: 2–4 bullets describing when to activate.
- **Procedure outline**: numbered steps the skill will perform.

If any of these are missing, ask one clarifying question before scaffolding.
Do not invent a name or description.

### 2. Choose a reproducible scaffold command

Check the repo root **once** and prefer commands in this order:

| Condition                                      | Command to use                                      |
| ---------------------------------------------- | --------------------------------------------------- |
| `a2scaffold` is installed in repo scripts/deps | repo-local command, e.g. `pnpm exec a2scaffold ...` |
| `pnpm-lock.yaml` and no local install          | `pnpm dlx a2scaffold@<version> ...`                 |
| `yarn.lock` and no local install               | `yarn dlx a2scaffold@<version> ...`                 |
| `package-lock.json` and no local install       | `npx a2scaffold@<version> ...`                      |
| no lockfile                                    | ask before choosing `npx a2scaffold@<version> ...`  |

Avoid global installs and avoid floating "latest" commands. If the repo does
not already pin `a2scaffold`, use a specific version and include it in the
confirmation prompt.

### 3. Confirm the exact command

Before running anything, show the user the **literal command string** that
will execute, e.g.:

```text
pnpm dlx a2scaffold@<version> skill add <name> --dir .agents/skills --description "<desc>"
```

Wait for explicit "yes" / "go" / "ok". Do **not** auto-run on the user's
prior consent — each scaffold is a separate authorization, because each one
writes new files under governance directories (see
[AGENTS.md §Exception: Explicit Human Instructions](../../AGENTS.md)).

### 4. Run the scaffold

Execute the confirmed command. If it fails:

- Surface the stderr verbatim to the user.
- Do **not** fall back to hand-writing a new scaffolded structure unless the
  user explicitly chooses manual creation. Fix the input/tooling and re-run
  when the goal is scaffold consistency.

### 5. Validate the result

After scaffold, read the generated `SKILL.md` and verify:

- [ ] Frontmatter has `name` matching the directory name (kebab-case).
- [ ] Frontmatter has a `description` that includes **what** and **when**.
- [ ] Body has a `## Trigger` section and a `## Procedure` section
      (per [AGENTS.md §Skills Format](../../AGENTS.md)).
- [ ] No secrets, credentials, or absolute machine-local paths leaked in.

If any check fails, edit the SKILL.md to fix it and tell the user what
was adjusted.

### 6. Log the promotion

Append a one-line entry to [.agents/plan/promotions.md](../../plan/promotions.md):

```markdown
## YYYY-MM-DD: <skill-name> → .agents/skills/

**Source**: human-authored (a2scaffold)
**Rationale**: <one sentence on why this skill was added>
**Promoted by**: <user name or email>
```

Use today's date in `YYYY-MM-DD`. This keeps the governance trail intact.

## Anti-patterns

- ❌ Hand-writing a new skill structure when a reproducible `a2scaffold`
  command is available — use the tool, then refine the generated prose.
- ❌ Skipping step 3's confirmation gate — each scaffold is a separate
  authorization under `.agents/` governance.
- ❌ Creating skills under `.agents/context/` or `.agents/prompts/` — those
  are read-only authoritative directories, not skill homes.
- ❌ Defaulting to floating `npx`/`dlx` commands — they reduce reproducibility
  and can generate different output later.
- ❌ Reusing a name that already exists under the target directory —
  a2scaffold should refuse, but check first to give a cleaner error.

## Quick reference

```text
1. Spec    → name, description, dir, trigger, procedure
2. Command → repo-local/pinned a2scaffold preferred
3. Confirm → show literal command, wait for "yes"
4. Run     → a2scaffold@<version> skill add ...
5. Verify  → frontmatter + Trigger + Procedure sections
6. Log     → append to .agents/plan/promotions.md
```
