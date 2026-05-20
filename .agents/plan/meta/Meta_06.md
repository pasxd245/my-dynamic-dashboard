# Meta 06: docs-graph DG-1 — parser + db + detectors + CLI

**Status**: In progress
**Date started**: 2026-05-21
**Date completed**: —
**Master plan**: [docs-graph.plan.md](docs-graph.plan.md)
**Workflow**: [docs-graph.workflow.md](docs-graph.workflow.md)

## Goal

Land the parser → graph → SQLite → detectors → CLI half of the docs-graph chain. After this round, `scripts/docs-graph.sh scan` populates `.agents/orchestrators/self-evo/data/docs-graph.db` with one scan's worth of nodes/edges/findings and prints a markdown summary.

## Scope (immutable)

New files under `.agents/orchestrators/self-evo/`:

- `src/docs-graph/parser.ts` — walk repo, extract md→md and md→code refs with line numbers; ignore fenced code blocks and external URLs.
- `src/docs-graph/classifier.ts` — `track` + `kind` inference per the rules in [docs-graph.plan.md](docs-graph.plan.md#node-classification-rules-deterministic).
- `src/docs-graph/graph.ts` — assemble nodes + edges, compute inbound/outbound counts.
- `src/docs-graph/db.ts` — schema bootstrap + per-scan insert + query helpers.
- `src/docs-graph/detectors/{broken-refs,orphans,round-report-pair,cross-track,index}.ts` — the four DG-1 detectors.
- `src/docs-graph/cli.ts` — `scan | latest | diff` subcommands.
- `scripts/docs-graph.sh` — bash wrapper mirroring the existing `self-evo.sh` pattern.
- `test/docs-graph.test.ts` — parser + db + detectors + end-to-end fixture.

Edited files:

- `package.json` — `docs-graph` bin entry pointing at `dist/docs-graph/cli.js`.
- `.gitignore` — add `data/`.

## Decisions baked in

1. **No new npm deps.** Markdown parsing is one regex (`/\[([^\]]*)\]\(([^)]+)\)/g`) plus a fenced-code stripper. `better-sqlite3`, `minimatch`, and `minimist` are already present.
2. **Single scan, immutable.** Each `scan` writes its own row + rows; no in-place updates. Drift over time is observed by comparing scan ids.
3. **Repo root is `process.cwd()` by default**, overridable via `--root`. Lets tests target a temp dir without leaking into the live repo.
4. **`data/docs-graph.db` is per-checkout, gitignored.** Mirrors how `runs/` is handled.

## Validation

- `pnpm --filter @self/orchestrator test` — all existing tests still pass, plus the new `docs-graph.test.ts` cases:
  - parser extracts md-link + code-ref + broken edges from a tiny fixture tree.
  - classifier returns the expected (track, kind) for representative paths.
  - db round-trips a scan.
  - each detector fires on a constructed bad-state fixture and stays silent on a clean one.
  - end-to-end: scan a temp dir, assert finding counts > 0 and db rows exist.
- `pnpm --filter @self/orchestrator build` — clean tsc.
- One real scan against this repo at HEAD: `scripts/docs-graph.sh scan` reports at least one finding (we expect `broken-refs` on the README→`specs/` issue called out in [docs/agents/docs-graph.md](../../../docs/agents/docs-graph.md)).

## State of the world after this round

- A new self-evo capability exists, callable from the CLI, that scans `*.md` and produces a drift report.
- No UI yet (DG-2). No agent integration yet (DG-3).
- `docs/agents/docs-graph.md`'s findings become reproducible from a tool.
