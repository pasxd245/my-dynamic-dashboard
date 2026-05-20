# Meta 09: docs-graph polish — swap Cytoscape.js → @antv/g6 v5

**Status**: In progress
**Date started**: 2026-05-21
**Date completed**: —
**Master plan**: [docs-graph.plan.md](docs-graph.plan.md)
**Depends on**: [Meta_07](Meta_07.md) (DG-2)

## Goal

Replace the Cytoscape.js renderer in `.agents/orchestrators/self-evo/src/docs-graph/web/app.js` with **@antv/g6 v5**, keeping every existing architectural decision intact:

- Still ESM-from-CDN — no bundler, no `node_modules` under `web/`.
- Still three static files (`index.html`, `app.js`, `style.css`).
- Still served by the same bare `node:http` server.
- Same SQLite contract, same REST API, same persistence behavior.

The win is visual: G6's built-in card-style nodes, modern edge routing, native d3-force layout, and richer event model replace the layered "Cytoscape + node-html-label + popper + fcose" stack that would otherwise be needed to reach the same polish.

## Scope (immutable)

Rewrite, not edit:

- `src/docs-graph/web/app.js` — full rewrite against G6 v5 API. Keep filter wiring, side-panel render, annotation form, footer findings list — the change is the renderer, not the page structure.

Touch:

- `src/docs-graph/web/style.css` — adjust selectors that referenced Cytoscape-specific structure (the `<canvas>` inside `#cy` becomes G6's container layout); add card-chip styles used by node labels.
- `src/docs-graph/web/index.html` — no structural change; reuse the existing layout. Bump version comment.

Out of scope:

- Server, DB, parser, detectors, agent tool — untouched.
- Reagraph / React Flow / Vite path — explicitly rejected in [docs-graph.plan.md](docs-graph.plan.md) under Decision 1; this round does not reopen that decision.

## Decisions baked in

1. **ESM CDN import**: `https://esm.sh/@antv/g6@5`. No `package.json` entry, no install. The dist remains "copy three files."
2. **Rect nodes with composed labels + corner badges** for now. HTML-typed nodes are powerful but increase DOM cost on ~111 nodes; rect + badge gives the card look at ~10× lower draw cost and is API-stable in G6 v5.
3. **Layout**: `d3-force`. G6 ships it as a built-in; replaces Cytoscape's `cose`. Pinned nodes (`data.fixed = true`) are excluded from force iteration so drag-pinning still survives re-layout.
4. **Behaviors**: `drag-canvas`, `zoom-canvas`, `drag-element`, `hover-activate`, `click-select`. Direct equivalents of the Cytoscape behaviors we relied on.
5. **One-way data sync**: position drags POST to `/api/positions`; the server stays the source of truth. No optimistic state in the client beyond what's needed to redraw.

## Validation

- `pnpm --filter @self/orchestrator build` clean.
- Existing tests pass (`pnpm test`) — none of them load the UI, so this is a "no regression in server / db / tool" check.
- Manual: `scripts/docs-graph.sh serve --root .` opens the same URL; nodes now render as track-coloured cards with filename + kind chip + severity border; drag persists; click highlights neighbours; side panel + footer behave identically.
- Curl smoke: `/`, `/app.js`, `/style.css` all return 200 with the new app.js referencing `@antv/g6`.

## State of the world after this round

- The UI looks like a tool, not a stress test.
- Architectural decisions from Meta_07 (no bundler, three static files, loopback Node server) are untouched.
- If we later need card-as-HTML nodes for badges/animations Cytoscape couldn't reach, the swap is one more `type: 'html'` config away, not a re-architecture.
