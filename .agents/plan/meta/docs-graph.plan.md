# Master Plan — `docs-graph` (Obsidian-like markdown graph + drift detector for self-evo)

**Track**: self-evo research (measurement of repo drift)
**Owner**: self-evo orchestrator (`.agents/orchestrators/self-evo/`)
**Date**: 2026-05-21

## Why this exists

[docs/agents/docs-graph.md](../../../docs/agents/docs-graph.md) showed that this repo carries three intertwined tracks (product / agent-method / self-evo research) and that documentation regularly drifts ahead of (or behind) the code. The deep-scan finding list — `specs/` referenced but missing, Spec 003 claimed complete while services are stubs, `App.tsx` vs `BuilderWorkflowPage` ownership blur, docs claiming "SQLAlchemy ORM" where there are no mapped classes — was assembled by hand. It should be the output of a tool that runs every round.

The tool is an **Obsidian-style graph of every `*.md` in the repo, plus structural drift detectors, plus an interactive UI, plus an agent-callable read API** — all sharing a single SQLite database so writes from the UI are visible to the agent and vice versa.

## What we are _not_ building

- A markdown editor. Use Obsidian / VS Code if you want to edit notes.
- A new product feature. docs-graph is self-evo research tooling; it lives under `.agents/orchestrators/self-evo/`, not `apps/`.
- A general-purpose graph DB. SQLite is enough; nodes ≈ 280, edges < 2000.
- An LLM-judge pipeline (yet). All DG-1 detectors are deterministic / structural. LLM-assisted drift detection can be a later round.

## Three-track justification

Per Principle P8 (product-velocity justification), meta-work must pay for itself in product terms:

- **Cost**: ~2 dev sessions split across three meta rounds (no new heavy deps; reuses self-evo's existing `better-sqlite3` and the repo's Node toolchain).
- **Velocity gain**: every future PDCA round closes with a one-command drift snapshot. The "documentation drift" finding from [docs/agents/docs-graph.md](../../../docs/agents/docs-graph.md) becomes a regression test, not an artisanal hand-audit. The `round-writer` and `judge` self-evo nodes can read `driftSummary()` and refuse to mark a round complete if it adds new drift.

## Round chain (three meta rounds, each shippable on its own)

| Round                                                          | Scope                                                                                                                                                                           | Demo                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Meta_06](Meta_06.md) — **DG-1 parser + db + detectors + CLI** | Walk all `*.md`, extract md→md and md→code refs, classify nodes by track/kind, persist scan in SQLite, run four structural detectors, emit `findings.md`.                       | `scripts/docs-graph.sh scan` populates `data/docs-graph.db` and prints findings.                           |
| [Meta_07](Meta_07.md) — **DG-2 HTTP server + Cytoscape UI**    | Tiny Node HTTP server in self-evo serving the graph as JSON + a single-file Cytoscape.js viewer with pan/zoom/drag/highlight; node positions and annotations persist to SQLite. | `scripts/docs-graph.sh serve` → `http://127.0.0.1:7733` opens a draggable graph with track-coloured nodes. |
| Meta_08 — **DG-3 agent tool + diff view**                      | `src/tools/docs-graph.ts` exposing `readNode / listFindings / neighbors / driftSummary / diff` for self-evo's pipeline nodes (`repo-scanner`, `judge`, `round-writer`).         | A self-evo round can call `driftSummary()` and reject completion if drift grew.                            |

This document covers DG-1 and DG-2 in detail; DG-3 gets its own round file when DG-2 lands.

## Data model (immutable contract across rounds)

One SQLite file: `.agents/orchestrators/self-evo/data/docs-graph.db` (gitignored).

```sql
-- Per-scan, immutable history
CREATE TABLE scans (
  id           TEXT PRIMARY KEY,         -- yyyy-mm-dd-hh-mm-ss-xxxx
  started_at   INTEGER NOT NULL,         -- unix ms
  commit_sha   TEXT,
  branch       TEXT,
  node_count   INTEGER,
  edge_count   INTEGER,
  finding_count INTEGER
);

CREATE TABLE nodes (
  scan_id      TEXT NOT NULL,
  path         TEXT NOT NULL,            -- repo-relative
  track        TEXT NOT NULL,            -- product | agent-method | self-evo | unknown
  kind         TEXT NOT NULL,            -- spec | round | meta | report | readme | skill | memory | runbook | other
  last_modified INTEGER NOT NULL,
  word_count   INTEGER NOT NULL,
  outbound_refs INTEGER NOT NULL,
  inbound_refs INTEGER NOT NULL,
  PRIMARY KEY (scan_id, path),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE TABLE edges (
  scan_id      TEXT NOT NULL,
  src          TEXT NOT NULL,
  dst          TEXT NOT NULL,            -- repo-relative; may not exist on disk if broken=1
  kind         TEXT NOT NULL,            -- md-link | code-ref | pair | wikilink
  line         INTEGER NOT NULL,
  broken       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX idx_edges_scan_src ON edges(scan_id, src);
CREATE INDEX idx_edges_scan_dst ON edges(scan_id, dst);

CREATE TABLE findings (
  scan_id      TEXT NOT NULL,
  detector     TEXT NOT NULL,            -- broken-refs | orphans | round-report-pair | cross-track
  node_path    TEXT,                     -- may be null for global findings
  severity     TEXT NOT NULL,            -- info | warn | error
  body         TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- Cross-scan, mutable (user/agent state)
CREATE TABLE positions (
  node_path    TEXT PRIMARY KEY,
  x            REAL NOT NULL,
  y            REAL NOT NULL,
  pinned       INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  updated_by   TEXT NOT NULL             -- "ui" | "auto" | "agent:<name>"
);

CREATE TABLE annotations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  node_path    TEXT NOT NULL,
  author       TEXT NOT NULL,
  body         TEXT NOT NULL,
  tags_json    TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_annotations_node ON annotations(node_path);
```

The split between scan tables (history) and persistence tables (positions / annotations) is the load-bearing design choice — it lets the UI pin a mental map across rescans and lets the agent leave durable notes on a node.

## Node classification rules (deterministic)

Track is inferred from path prefix; first match wins:

| Track          | Prefix patterns                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `self-evo`     | `.agents/orchestrators/self-evo/**`, `.agents/plan/meta/**`, `.agents/auto/reports/**/Meta_*`, `.agents/memory/**`                                          |
| `agent-method` | `.agents/**`, `.claude/**`, `.codex/**`, `.github/agents/**`, `.github/prompts/**`, `.kiro/**`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md` |
| `product`      | `apps/**`, `packages/**`, `docs/**`, `devops/**`, `README.md`                                                                                               |
| `unknown`      | anything else                                                                                                                                               |

Kind from filename / path:

| Kind      | Match                                 |
| --------- | ------------------------------------- |
| `spec`    | `docs/features/spec-*.md`             |
| `round`   | `.agents/plan/cycles/Round_*.md`      |
| `meta`    | `.agents/plan/meta/Meta_*.md`         |
| `report`  | `.agents/auto/reports/**/*.report.md` |
| `memory`  | `.agents/memory/**.md`                |
| `skill`   | `**/SKILL.md`                         |
| `runbook` | `docs/operations/*.md`                |
| `readme`  | basename = `README.md`                |
| `other`   | fallback                              |

## Edge extraction rules

For each `*.md` file:

1. **Markdown links** `[text](target)` — split on `#` to drop anchor; resolve target relative to the file. If target ends in `.md`, emit `md-link`; otherwise (and target exists in repo) `code-ref`; otherwise emit with `broken=1`.
2. **Wikilinks** `[[slug]]` — resolve against `~/.claude/projects/.../memory/<slug>.md` (memory namespace) if the source is a memory file, else skip. Emit `wikilink`.
3. **Round / report pairing** — synthetic edge: if both `Round_NN.md` (under cycles or meta) and a matching `Round_NN.report.md` exist, emit a `pair` edge. Drives the `round-report-pair` detector.
4. **External URLs** (`http://`, `https://`) — ignored in DG-1 (they're not part of the local drift surface).

Code references inside fenced code blocks are also ignored — they're examples, not contracts.

## Detector set (DG-1)

All deterministic; one finding row per issue:

1. **broken-refs** — every edge with `broken=1` becomes one `error` finding on the source node.
2. **orphans** — any node with `inbound_refs == 0` that isn't in the root-set (`README.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.agents/AGENTS.md`, `docs/README.md`, `.agents/auto/queue.md`, `.agents/plan/cycles/README.md`, `.agents/plan/meta/README.md`) is `warn`.
3. **round-report-pair** — round file without matching report (or vice versa) is `warn`.
4. **cross-track** — edge whose `src.track` ≠ `dst.track` and both ≠ `unknown` is `info` (cooperate-but-don't-blur signal). Edges into universal roots (READMEs, top-level AGENTS.md) are exempt.

## UI features (DG-2)

| Feature                           | Implementation                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Render                            | Cytoscape.js loaded via ESM CDN (no npm dep); one `index.html` + one `app.js`              |
| Drag                              | `cy.on('dragfree', node => POST /positions)`                                               |
| Zoom + pan                        | Built-in                                                                                   |
| Highlight                         | On node tap, fade non-neighbours; show side panel with node attrs + findings + annotations |
| Colour by track                   | Style mapper on `data(track)`                                                              |
| Sized by inbound_refs             | Style mapper on `data(inbound_refs)`                                                       |
| Filter by track / kind / severity | Top-bar toggles → re-fetch `/api/graph?...`                                                |
| Annotation                        | Side-panel form → `POST /api/annotations`                                                  |
| Pin layout across scans           | `pinned=1` on row keeps node at saved (x, y); fresh scan re-layouts only unpinned          |

## API contract (DG-2)

Tiny REST surface on `127.0.0.1:7733`. All JSON. No auth (loopback-only).

| Method | Path                                                | Body / query                  | Returns                                                                              |
| ------ | --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/scans`                                        | —                             | latest 20 scans                                                                      |
| GET    | `/api/graph?scan=<id>&track=...&kind=...`           | —                             | `{nodes:[], edges:[]}` for Cytoscape                                                 |
| GET    | `/api/node?path=<repo-rel>`                         | —                             | node + outbound + inbound + annotations                                              |
| GET    | `/api/findings?scan=<id>&severity=...&detector=...` | —                             | finding list                                                                         |
| GET    | `/api/diff?a=<scanA>&b=<scanB>`                     | —                             | `{addedNodes, removedNodes, addedEdges, removedEdges, addedFindings, fixedFindings}` |
| POST   | `/api/positions`                                    | `{path,x,y,pinned?}`          | `{ok}`                                                                               |
| POST   | `/api/annotations`                                  | `{path, author, body, tags?}` | `{id}`                                                                               |
| POST   | `/api/scan`                                         | —                             | runs a scan in-process, returns new `scan_id`                                        |
| GET    | `/`                                                 | —                             | static `index.html`                                                                  |
| GET    | `/app.js`                                           | —                             | static UI bundle                                                                     |

## Agent contract (DG-3, sketch)

`.agents/orchestrators/self-evo/src/tools/docs-graph.ts` — direct TS module imported by self-evo pipeline nodes. Read-only by default; writes go through the HTTP server so the UI sees them live.

```ts
readNode(path: string): NodeRecord
listFindings(filter?: {severity?, detector?, track?}): Finding[]
neighbors(path: string, depth?: number): {nodes, edges}
driftSummary(scanId?: string): {by_detector, by_severity, top_offenders}
diff(scanA: string, scanB: string): DiffResult
```

`judge` and `round-writer` will be updated in DG-3 to call `driftSummary()` and surface "new drift introduced this round" as a `revise` reason.

## Decisions baked in

1. **Cytoscape.js, not React Flow.** Single HTML file, no build step, no new npm deps. React Flow needs a Vite app — competes with `apps/builder` for attention and adds a second frontend toolchain to self-evo.
2. **SQLite as the one contract.** UI, CLI, agent tool, and the future MCP wrapper all read/write the same file. Any layer can be rewritten without breaking the others.
3. **Standalone, not embedded in apps/builder.** docs-graph is self-evo research; co-locating with the product would blur tracks (exactly the drift this tool is trying to detect).
4. **Bare `node:http`, no Express/Hono.** Surface is ~10 endpoints; framework is overhead.
5. **Position pinning is opt-in via UI drag.** Auto-layout always runs; user drag promotes a node to `pinned=1`. This is what makes the mental map stable across scans without locking everything down.
6. **No anchors/headings as nodes in DG-1.** File-level only. Heading nodes can be added later if/when drift detectors need them; structural detectors don't.
7. **Wikilinks only resolve inside the memory namespace.** They're a memory convention, not a doc convention. Treating `[[name]]` as a generic link would create false edges everywhere.
8. **`cross-track` is `info`, not `warn`.** The three-track model says layers should cooperate — flagging every cross-track link as a problem would be wrong. Surface them; don't fail on them.

## Out of scope (this chain)

- LLM-assisted "doc-ahead-of-code" claims judge (could be a Meta_09).
- MCP server wrapping the tool (could be a Meta_10 once direct tool stabilises).
- Diffing scans in the UI (DG-3 ships the API; UI rendering is a Meta_11 if useful).
- Heading-level nodes / anchor edges.
- Auto-running docs-graph as a self-evo pipeline node (lands in DG-3 as `repo-scanner` calls; no new graph node yet).

## Validation strategy

- DG-1: `node --test` unit tests on parser (link extraction, classification), db (round-trip nodes/edges/findings), detectors (each detector on a tiny fixture). One end-to-end test that scans a temp dir with a known md tree.
- DG-2: smoke test that starts the server on a random port, GETs `/api/graph`, POSTs a position, GETs the node, asserts position persisted.
- DG-3: tool-level test that reads back the same db the CLI wrote.

## Files this chain touches

New (under `.agents/orchestrators/self-evo/`):

- `src/docs-graph/{parser,graph,db,cli,server,classifier}.ts`
- `src/docs-graph/detectors/{broken-refs,orphans,round-report-pair,cross-track,index}.ts`
- `src/docs-graph/web/{index.html,app.js,style.css}`
- `src/tools/docs-graph.ts` (in DG-3)
- `scripts/docs-graph.sh`
- `test/docs-graph.test.ts`

Edited:

- `package.json` (one bin entry for `docs-graph`)
- `.gitignore` (add `data/`)
- `tsconfig.json` (add `src/docs-graph/web/**` to `exclude` since it's static)
