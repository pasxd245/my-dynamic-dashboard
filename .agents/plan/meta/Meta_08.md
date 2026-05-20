# Meta 08: docs-graph DG-3 — agent tool

**Status**: In progress
**Date started**: 2026-05-21
**Date completed**: —
**Master plan**: [docs-graph.plan.md](docs-graph.plan.md)
**Depends on**: [Meta_06](Meta_06.md), [Meta_07](Meta_07.md)

## Goal

Expose the docs-graph as a read API the self-evo agent can call. After this round, pipeline nodes can ask "what's drifted in the docs?" without spawning a CLI.

## Scope (immutable)

New files:

- `src/tools/docs-graph.ts` — direct TS tool: `readNode`, `listFindings`, `neighbors`, `driftSummary`, `diff`. Reads the same SQLite db the CLI writes.

Edited files:

- `test/docs-graph.test.ts` — additional cases covering the tool surface.

Out of scope: actually wiring `judge` / `round-writer` / `repo-scanner` to the tool. That's downstream of this round once the tool has bedded in.

## Decisions baked in

1. **Read-only tool.** Writes happen through the HTTP server (so the UI sees them) or through the CLI (which writes scans). The agent doesn't mutate the graph.
2. **One process opens the db read-only.** `new Database(file, {readonly: true, fileMustExist: true})`. Avoids any chance of the agent corrupting the UI's view.
3. **Latest-scan default.** All `scanId?` parameters default to "most recent scan". Forces the agent to be explicit when comparing history but makes the common case ergonomic.

## Validation

- `node --test` covers each of the five tool methods against a scan seeded by DG-1.
- Manual: launch a self-evo round in dry-mode, have `repo-scanner` print `driftSummary()` of the latest scan.

## State of the world after this round

- The agent can ask "what's broken in the docs right now?" in one function call.
- Wiring the answer into HITL gates / round reports is a follow-up, intentionally not part of this round.
