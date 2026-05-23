# Agent Governance

> Authority, write policy, and promotion rules for the `.agents/` knowledge
> base.

## Agent Base Directory

The `.agents/` directory is the shared knowledge base for all AI agents. It
separates stable human-curated knowledge from evolving agent learnings.

| Path       | Purpose                                          | Authority        | Agent Permissions              |
| ---------- | ------------------------------------------------ | ---------------- | ------------------------------ |
| `context/` | Canonical knowledge (purpose, principles, tools) | Human-maintained | READ-ONLY                      |
| `prompts/` | Auto-loaded runtime prompts (`*.prompt.md`)      | Human-curated    | READ-ONLY                      |
| `skills/`  | Reusable procedures ([Agent Skills spec])        | Human-approved   | READ-ONLY                      |
| `memory/`  | Agent-drafted learnings (insights, drafts)       | Agent-writable   | READ + WRITE                   |
| `plan/`    | PDCA cycles + `promotions.md` + `PDCA.md`        | Mixed            | APPEND-ONLY to `promotions.md` |

[Agent Skills spec]: https://agentskills.io/specification

Sub-structure:

- `skills/<name>/SKILL.md` follows the [Skills Format](#skills-format).
- `plan/cycles/Round_XX.md` follows [plan/PDCA.md](../plan/PDCA.md).

## Conflict Handling

- If any conflict exists between directories, `context/` is authoritative.
- If a discovery contradicts `context/`, do not edit `context/`; write the
  finding to `memory/` and flag it for human review in the memory file.
- If `memory/` contains outdated or incorrect information, do not delete it;
  update the file header to `**Status**: Needs Review`.

## Agent Write Policy

Agents MAY:

- Capture reusable insights in `.agents/memory/`.
- Suggest promotions to `context/` or `skills/` in memory files.

Agents MUST NOT:

- Store secrets, credentials, or personal data.
- Delete or modify existing files in `context/` or `skills/`.
- Write to `context/` or `skills/` without explicit human instruction.
- Generate speculative rules without concrete evidence.

Memory format: see [.agents/memory/\_TEMPLATE.md](../memory/_TEMPLATE.md).
Promotion log format: see [plan/promotions.md](../plan/promotions.md).

Principle: Stability > Speed. Promotion requires validation.

## Evolution Model

```text
1. Agent captures insight -> memory/
2. Human reviews periodically
3. Valid insights promoted -> context/ or skills/
4. Promotion logged in plan/promotions.md
```

Human feedback loop: see [plan/PDCA.md](../plan/PDCA.md).

Promotion criteria:

- To `context/`: stable pattern, validated 3+ times, broadly applicable.
- To `skills/`: reusable procedure with clear triggers and steps.

## Skills Format

Skills follow the [Agent Skills spec](https://agentskills.io/specification).
Each skill lives at `skills/<skill-name>/SKILL.md` using kebab-case; the
`name` field must match the directory name.

`SKILL.md` is required. Optional siblings:

- `scripts/` for executable code.
- `references/` for additional docs.
- `assets/` for templates and data files.

## Explicit Human Instructions

When a human explicitly instructs an agent to modify, create, or delete files
under `.agents/context/`, `.agents/skills/`, or `.agents/plan/`, the agent MAY
proceed only after it:

1. Warns the human that authoritative or governance knowledge will be modified.
2. Waits for explicit confirmation.
3. Logs the change in `plan/promotions.md` or the appropriate governance log.

Example warning:

> Warning: You've asked me to modify authoritative knowledge under `.agents/`.
> This may affect future agent behavior and project governance. Please confirm
> you want to proceed.
