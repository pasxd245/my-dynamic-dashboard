# my-dynamic-dashboard

CRM-export → analytics platform. Replaces a broken CRM → Excel
reporting workflow with a data-discovery, relationship-governance,
and reporting product.

This repo is intentionally three intertwined tracks:

1. **Product** — `my-dynamic-dashboard` (CRM-export → analytics).
2. **Agent-method** — how AI agents help build and govern the product.
3. **Self-evo research** — how agents improve their own operating system.

See [.agents/AGENTS.md](.agents/AGENTS.md) for the working
constitution and [.agents/context/purpose.md](.agents/context/purpose.md)
for the three-track frame.

## Quickstart

```bash
# Install Node deps + Python deps for the backend
pnpm install
( cd workspace/apps/backend && uv sync --extra test --extra dev )

# Boot the full local dev stack (backend :8000 + builder :3000)
pnpm dev

# Open the builder
# → http://localhost:3000

# Check what's running
pnpm dev:local:status

# Stop everything
pnpm dev:local:down
```

The dev scripts spawn background processes, persist PIDs to
`tmp/dev/pid/`, and stream logs to `tmp/dev/log/{backend,builder}.log`.

## Repo layout

```text
workspace/
  apps/
    backend/   FastAPI + DuckDB (Python, uv)
    builder/   Vite + React 19 + antd (TypeScript, pnpm)
  packages/
    ui/        @mdd/ui — look-and-feel package (themeTokens + AntdConfig)
.agents/       Agent operating system (context, plan, memory, skills)
scripts/dev/   Repo-wide dev scripts (local-up, local-down, local-status)
```

## Scripts cheat sheet

| Script                  | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `pnpm dev`              | Boot backend + builder (alias for `dev:local:up`) |
| `pnpm dev:local:up`     | Boot backend + builder; wait until both respond   |
| `pnpm dev:local:down`   | Stop both; clean up orphan processes              |
| `pnpm dev:local:status` | Show PIDs, ports, log tails for both apps         |
| `pnpm md:lint`          | Markdownlint across all `.md`                     |
| `pnpm format`           | Prettier write across all `.md`                   |
| `pnpm format:check`     | Prettier check across all `.md`                   |

## Working in this repo

- Round-based PDCA workflow — see
  [.agents/plan/PDCA.md](.agents/plan/PDCA.md).
- Round history under [.agents/plan/cycles/](.agents/plan/cycles/).
- Agent memory:
  [.agents/memory/](.agents/memory/) +
  [.agents/context/memory-placement.md](.agents/context/memory-placement.md).
