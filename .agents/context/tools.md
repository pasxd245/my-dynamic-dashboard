# Repository Tools (Canonical)

> Tools available in this repo that agents should know about. Authoritative —
> if a tool's behavior here conflicts with what you observe, prefer the
> observed behavior and flag the mismatch in `.agents/memory/`.

---

## `./scripts/crg` — code-review-graph wrapper

A bash wrapper around the [`code-review-graph`](https://pypi.org/project/code-review-graph/)
Python CLI. Builds a code graph across the repo's `apps/*/` subrepos and
exposes it to Claude Code via an MCP server.

**Sub-commands**:

| Command                                                        | What it does                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `./scripts/crg setup`                                          | Creates `.venv` (via `uv`), installs `code-review-graph` + `igraph`, registers the MCP server with Claude Code. Run this once per machine. |
| `./scripts/crg apps [root] [--register] [--build] [-- <args>]` | Iterates `apps/*/` (or a custom root) and runs register/build/passthrough commands per repo.                                               |
| `./scripts/crg unregister <alias \| --all \| --grep <text>>`   | Removes repos from the CLI registry.                                                                                                       |
| `./scripts/crg -- <args>`                                      | Passes args directly to the underlying `code-review-graph` CLI.                                                                            |

**Prerequisites**: [`uv`](https://docs.astral.sh/uv/) on PATH. After
`setup`, restart Claude Code (or run `/mcp`) to pick up the MCP server.

### When agents should reach for `crg`

Use it (or recommend it) when a task involves:

- **Cross-repo investigation** across `apps/*/` — "where is X used?",
  "what depends on Y?", "what would this rename break?".
- **Impact tracing** before non-trivial refactors that span multiple apps.
- **Community / cluster detection** — finding cohesive subsystems
  (uses Leiden via `igraph`).
- **Code-review prep** — generating a graph view for a PR that touches
  several apps.

Do **not** reach for `crg` when:

- The question is about a single file or function — read the code directly.
- The graph isn't built yet AND the task is small — running `setup` + `build`
  costs more than direct code reading. Ask the user before kicking off setup.

### Workflow integration

The [`repo-explainer`](../skills/repo-explainer/SKILL.md) skill is the
natural caller: when its "read the relevant code first" step would benefit
from graph data (large/multi-repo scope), invoke `crg` instead of grepping
file by file.

This complements **SDD (spec-driven development)** — SDD drives _what_ to
build (specs in [specs/](../../specs/)), while `crg` provides _understanding
of what already exists_ before specs are written or implemented.
