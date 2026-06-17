# Tools — Agent Capabilities & Repo Toolchain

> The canonical "what do I reach for?" reference for this repo. Three
> sections: **(A)** common prefer/fallback tool defaults (cross-cutting),
> **(B)** the agent-capability playbook (skills, subagents, orchestration —
> Track 2/3), and **(C)** the repo dev-toolchain reference (commands that
> build, test, and lint the product — Track 1). `context/` is the home
> [governance.md](governance.md) reserves for "tools" knowledge:
> human-maintained, agent **READ-ONLY**.
>
> _Track: 2 (agent-method capability index) with a Track-1 dev-tooling
> reference. Pulled by: the skill + harness surface having grown (R81 added
> [`design-sync`](../skills/design-sync/SKILL.md); five skills now ship) with
> no single index telling an agent which capability to reach for, and the dev
> toolchain (`pnpm` scripts, `uv` backend, lint scripts) being scattered
> across `package.json` and per-app configs._

---

## A. Common

Prefer / fallback registry — reach for the **preferred** tool first; drop to
the **fallback** only when the preferred one is absent or unsuited. Add a row
when a clear default emerges.

| Task | Prefer | Fallback | Why |
| ---- | ------ | -------- | --- |
| Search file contents | `rg` (ripgrep, v13 installed) | `grep -r` | `rg` is faster, respects `.gitignore`, and skips `node_modules`/`.git` by default; `grep` only when `rg` is unavailable |

---

## B. Agent capability playbook

Reach for the **least mechanism that works** (per [purpose.md § Dynamic equilibrium](purpose.md#dynamic-equilibrium)).
Hints only — open the linked source for the full procedure.

- **Skills** ([index + how to add](../skills/README.md); bodies in
  `.agents/skills/<name>/SKILL.md`):
  [`flow-selector`](../skills/flow-selector/SKILL.md) (pick DCFBI/DFCFBI at
  Design exit) · [`gate-walker`](../skills/gate-walker/SKILL.md) (verify a
  Hard Gate before advancing) ·
  [`design-sync`](../skills/design-sync/SKILL.md) (re-sync a domain's design
  docs to the code) · [`ui-design`](../skills/ui-design/SKILL.md) (review a UI
  vs the six UX facets) · [`research`](../skills/research/SKILL.md) (sourced
  investigation) ·
  [`markdown-check-link`](../skills/markdown-check-link/SKILL.md) (markdown
  links resolve).
- **Subagents** (`Agent` tool) — delegate cross-file reading so its context
  stays out of yours: `Explore` (read-only search), `Plan` (strategy, no
  edits), `general-purpose`/`claude` (catch-all), `claude-code-guide`
  (Claude Code / SDK / API questions). Launch independent ones in one message.
- **`Workflow`** — deterministic multi-agent orchestration; high token cost,
  **only on explicit opt-in**. Otherwise a single subagent suffices.
- **`ToolSearch`** — load schemas for deferred tools (`WebSearch`, `WebFetch`,
  `TodoWrite`, …) before calling them.
- **Memory** — reusable lessons only. Shared/version-controlled →
  `.agents/memory/`; personal cross-session → the user's auto-memory. Rule:
  [memory-placement.md](memory-placement.md).

---

## C. Repo dev-toolchain reference

Source of truth: root [`package.json`](../../package.json) scripts + per-app
configs — this is a map, not a copy. `pnpm@10.33.0` workspace
(`workspace/apps/*`, `workspace/packages/*`); run repo scripts from root.

- **Run the stack** — `pnpm dev` (backend `:8000` + builder `:3000`;
  `dev:local:{down,status}` to stop/inspect, `dev:builder` for FE only).
  `pnpm dev:seed` loads real data through the DuckDB/CORS path (complements
  MSW, doesn't replace it).
- **Test / check** — builder & contracts: `pnpm --filter <pkg> test`
  (vitest), builder also `type-check` (`tsc --noEmit`); backend: `uv run
  pytest` + `uv run alembic …` (FastAPI/DuckDB/SQLModel, `uv`-managed).
- **Lint / format** (root) — `pnpm md:lint`, `pnpm format[:check]`,
  `pnpm {design:lint,design:tokens,plan:lint}` (scripts under
  [`scripts/lint/`](../../scripts/lint/)).
- **Hooks** — husky + lint-staged + commitlint (Conventional Commits);
  `a2scaffold` regenerates the thin vendor adapters that point back at
  [AGENTS.md](../AGENTS.md).
