# Project Purpose — Three Tracks

> The durable anchor for this repo. All planning, governance, and capability
> growth must trace back to one of the three tracks defined here.

## The Three Tracks

This repo is not one thing. It is a real product, a working AI-agent
development practice, and a self-evolution research experiment sharing the
same disk.

| Track                                  | Meaning                                                                                                                                                       | Why it matters                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **1. Product: `my-dynamic-dashboard`** | A data discovery and analytics platform for replacing a broken CRM → Excel reporting workflow.                                                                | This is the real-world problem and the concrete deliverable. It keeps the work grounded.                            |
| **2. AI-agent build practice**         | The product is built with vibe-coding, multi-agent workflows, autoagent/autopilot, PDCA rounds, memory, skills, and governance.                               | This is the development method being tested in a real codebase, not a toy benchmark.                                |
| **3. Agent self-evo research**         | The repo also studies whether agents can improve their own operating system through lessons, reports, verifier loops, meta-rounds, and cold-start discipline. | This is the research layer: how AI agents learn, preserve context, avoid drift, and become more reliable over time. |

🧑‍💻 What we have learned: The previous iteration of this repo drifted because these three tracks are
intertwined. Product files, agent operating files, generated reports, plans,
docs, and experiments all grew together. The discipline is to separate them
without pretending any track is unimportant.

## Ideal Shape

Three layers that cooperate but do not blur, enforced by physical
directory boundaries:

1. **Product source** — `workspace/` contains the product's `apps/`,
   `packages/`, and `docs/`. New product contributors should be able to
   live mostly inside `workspace/`. A `workspace/scripts/` only appears
   if/when the product genuinely needs its own scripts; until then,
   repo-wide scripts live at root.
2. **Repo-wide tooling at root** — `package.json`, `pnpm-workspace.yaml`,
   `pnpm-lock.yaml`, `node_modules/`, `scripts/` (repo-wide dev
   utilities), and lint/format/commit configs (`.prettierrc.json`,
   `.markdownlint-cli2.jsonc`, `.lintstagedrc.json`,
   `commitlint.config.mjs`), plus (when wired) `.husky/`. These are
   git-root-native: husky/lint-staged/commitlint attach to git hooks, and
   prettier/markdownlint need to see all repo markdown including
   `.agents/*.md` and `AGENTS.md`. `pnpm-workspace.yaml` points at
   `workspace/apps/*` and `workspace/packages/*`.
3. **Agent OS (`.agents/`)** — `.agents/context`, `.agents/skills`,
   `.agents/plan`, `.agents/memory`, `.agents/prompts`, and (later)
   `.agents/auto`, `.agents/orchestrators`. Describes how AI agents help
   build and govern the product, plus how the agent system itself evolves.
   Tracks 2 and 3 share infrastructure (memory, promotions, authority
   rules); they are separated by subdirectory, not by root.
4. **Vendor adapters at root** — `.github/`, `.claude/`, `.codex/`,
   `.gemini/`, and `.a2scaffold/` (which generates them). Thin per-tool
   configs pointing back at `.agents/AGENTS.md`. Forced to root by their
   tooling; kept minimal.

Each layer has its own source of truth, success criterion, and backlog:

| Layer             | Ideal success criterion                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product           | A user can upload CRM exports, profile data, govern joins, run real DuckDB-backed queries, save reports, and view dashboards.                                    |
| Agent method      | Human + agents can start cold, choose the next useful round, implement it within declared boundaries, and leave durable context for the next session.            |
| Self-evo research | Agent-system changes are justified by product velocity or research value, measured by reports/verifier evidence, and kept separate from product delivery claims. |

## Key Design Decisions

1. **Real problem first** — The CRM/Excel reporting pain is the anchor;
   product delivery keeps the agent research honest.
2. **Builder first, dashboard second** — Without uploaded data and defined
   relationships, there is nothing reliable to visualize.
3. **Excel output first** — Users already know Excel; the system should
   offload heavy processing and return manageable result files.
4. **Relationships are central and not fixed** — Join paths change per
   report; relationship governance is a product requirement, not a technical
   extra.
5. **Schema flexibility over rigidity** — CRM exports change; the platform
   should version, flag, and adapt rather than reject normal business drift.
6. **AI agents are part of the experiment** — Vibe-coding, multi-agent
   workflows, autoagent, autopilot, and self-evo are legitimate repo goals,
   but they must be separated from product completion claims.
7. **Spec-driven development needs truth checks** — Specs and docs are useful
   only if regularly reconciled with actual implementation.

## Planning Frame

For every round, the useful question is not "is the repo good or bad?" It is:

> Given the three-track purpose, what is the smallest next move that reduces
> drift and increases real value?

### Dynamic equilibrium

**Accelerate ⇌ brake.** That question already names both forces; hold them
in tension rather than maximising either. Two failure modes bound the path:

- **Accelerate without brake → accident.** Shipping fast with no guard
  against LLM failure modes — hallucination, **stale grounding** (acting on
  info that moved or changed), context rot, instruction drift,
  claiming-done-without-verifying — compounds drift into wreckage.
- **Brake without accelerate → lose the race.** All process, no delivery:
  ceremony accretes, velocity dies, the product never lands.

So move in **dynamic equilibrium**, calibrated each round:

- **Accelerate on Track 1 (product value)** — bias to shipping real user
  value; it is the anchor and the point.
- **Brake on Track 2/3 (agent mechanism)** — add a gate, lint, or
  convention only when it counters a _named_ LLM failure mode at the
  **least mechanism that works**. This is the operational form of
  "Default = don't add" ([AGENTS.md](../AGENTS.md)); more process is not
  more leverage. Its inverse is the discipline to **prune** what no longer
  earns its place.

Maximise neither. No pain, no gain — and no brake, no future.

---

_Origin_: Distilled from the prior drifted iteration's docs-graph
analysis during the 2026-05-20 deep scan. See
[drifted-iteration.md](drifted-iteration.md) for how this repo uses
and retires that local-only reference.
