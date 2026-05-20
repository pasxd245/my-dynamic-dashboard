# Meta 07: docs-graph DG-2 — HTTP server + Cytoscape UI

**Status**: In progress
**Date started**: 2026-05-21
**Date completed**: —
**Master plan**: [docs-graph.plan.md](docs-graph.plan.md)
**Depends on**: [Meta_06](Meta_06.md) (DG-1)

## Goal

Add a Node HTTP server + a single-file Cytoscape.js UI on top of the DG-1 SQLite store. After this round, `scripts/docs-graph.sh serve` opens an interactive graph at `http://127.0.0.1:7733` with pan, zoom, drag, highlight, side-panel inspection, and persistence of drag-positions / annotations back into SQLite.

## Scope (immutable)

New files:

- `src/docs-graph/server.ts` — bare `node:http` server implementing the API contract from the master plan.
- `src/docs-graph/web/index.html` — static UI shell.
- `src/docs-graph/web/app.js` — Cytoscape.js wiring (ESM import via CDN).
- `src/docs-graph/web/style.css` — minimal styling.

Edited files:

- `src/docs-graph/cli.ts` — add `serve` subcommand.
- `tsconfig.json` — exclude `src/docs-graph/web/**` from tsc (static assets).
- Build script — copy `src/docs-graph/web/**` into `dist/docs-graph/web/**`.

## Decisions baked in

1. **Cytoscape.js, vanilla, via CDN.** Loaded with `import('https://esm.sh/cytoscape@3.30.4')` inside `app.js`. Lets the UI run offline if the CDN is cached but doesn't add anything to `node_modules`.
2. **Single static file per asset.** No bundler. Three files in `web/`.
3. **Loopback only.** Server binds `127.0.0.1`; no auth. Same trust model as the LangGraph checkpointer file.
4. **Position pinning is automatic on drag.** Dragging a node POSTs `{x, y, pinned: true}`. There's no explicit pin button — the user's intent ("I want this node here") is read from the drag itself.
5. **Auto-layout via Cytoscape `cose`.** Pinned nodes are excluded from the next layout via `fixed: true`.

## Validation

- New test cases under `test/docs-graph.test.ts`:
  - Start server on port 0, GET `/api/graph`, assert shape.
  - POST `/api/positions`, then GET `/api/node`, assert position round-trips.
  - POST `/api/annotations`, then GET `/api/node`, assert annotation round-trips.
- Manual: start the server, open the browser, drag a node, refresh — position persists. Click a node — side panel shows attrs/findings/annotations.

## State of the world after this round

- The drift snapshot from DG-1 is now explorable visually.
- Humans can pin layout + leave notes on nodes.
- The agent still doesn't consume the data yet — that's DG-3.
