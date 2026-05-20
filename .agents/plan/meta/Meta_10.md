# Meta 10: docs-graph semantic drift — heading nodes + entity graph (BookRAG-inspired)

**Status**: Drafted (not started)
**Date drafted**: 2026-05-21
**Master plan**: [docs-graph.plan.md](docs-graph.plan.md)
**Depends on**: [Meta_06](Meta_06.md), [Meta_07](Meta_07.md), [Meta_08](Meta_08.md), [Meta_09](Meta_09.md)
**Reference**: [BookRAG (arXiv 2512.03413)](https://arxiv.org/abs/2512.03413) — dual hierarchical-tree + entity-graph index for RAG over complex documents.

## Goal

Promote docs-graph from a **structural** drift detector to a **semantic** one by adding two layers:

1. **Heading-level nodes** (`file.md#section`) and parent/child edges into the file node — the "tree half" of BookRAG's BookIndex.
2. **Entity extraction + cross-doc concept edges** — the "graph half" of BookIndex, applied at repo scale.

After this round, docs-graph can answer questions like "5 product docs claim _DuckDB executes queries_, but the only code reference to `duckdb` is in `relationship_service.py`" — i.e., turn the hand-audit in [docs/agents/docs-graph.md](../../../docs/agents/docs-graph.md) ("DuckDB is intended, not implemented") into a deterministic finding.

## Why now / why not now

This is **deferred** from the original chain on purpose. The five DG-1/2/3 + Meta_09 rounds shipped a deterministic, structural tool. Adding semantic detection trades determinism for richer signal. Do this round only when:

- the structural drift queue is small enough that adding semantic noise won't drown the signal, and
- there's an actual self-evo node (`judge` / `round-writer`) that would consume the semantic findings.

Until both are true, file the BookRAG URL as the reference and leave Meta_10 as a draft.

## Scope (immutable, when this round opens)

New files under `.agents/orchestrators/self-evo/src/docs-graph/`:

- `headings.ts` — parse `#`-headings out of every `*.md`, emit heading nodes with `parent_path`, `depth`, `anchor`.
- `entities/extractors.ts` — produce `{entity, kind, surfaces[]}` records. Two extractors, tried in order:
  1. **Curated dictionary** (deterministic) — `entities/dictionary.yaml` lists known repo entities (DuckDB, Polars, FastAPI, Spec 001..006, MasterLayout, App.tsx, BuilderWorkflowPage, …) and their aliases. Cheap, no LLM, no nondeterminism.
  2. **LLM extractor** (opt-in) — small Claude call per file with `complete-extract` prompt; only runs if `--llm-entities` flag is set on `scan`. Caches by content hash.
- `entities/graph.ts` — build the entity graph: `entities` table + `mentions` edges (`entity_id → file or heading node`).
- `detectors/doc-vs-code.ts` — for each entity with a code-ref hint (e.g. `DuckDB` → grep `import duckdb`), compare frequency of mentions in docs vs. real code usages; flag entities where `docs_mentions ≥ 3` and `code_usages ≤ 1` as **`doc-ahead-of-code`** with severity `warn`.
- `detectors/claim-orphan.ts` — heading nodes whose body asserts a feature (e.g. body contains "complete", "✅", "delivered") but whose linked code targets are all broken or missing → `error`.

Schema additions (purely additive — existing tables untouched):

```sql
ALTER TABLE nodes ADD COLUMN parent_path TEXT;   -- file-node parent for heading nodes; null for file nodes
ALTER TABLE nodes ADD COLUMN depth       INTEGER DEFAULT 0;
ALTER TABLE nodes ADD COLUMN anchor      TEXT;   -- heading slug; null for file nodes

CREATE TABLE entities (
  scan_id   TEXT NOT NULL,
  id        TEXT NOT NULL,            -- normalized canonical form, e.g. "duckdb"
  display   TEXT NOT NULL,
  kind      TEXT NOT NULL,            -- tool | spec | symbol | file | concept
  PRIMARY KEY (scan_id, id),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE TABLE mentions (
  scan_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  node_path  TEXT NOT NULL,           -- file or heading node
  line       INTEGER,
  surface    TEXT NOT NULL,           -- the exact substring matched
  source     TEXT NOT NULL,           -- dict | llm
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX idx_mentions_scan_entity ON mentions(scan_id, entity_id);

CREATE TABLE code_usages (
  scan_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  file_path  TEXT NOT NULL,
  line       INTEGER,
  surface    TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX idx_code_usages_scan_entity ON code_usages(scan_id, entity_id);
```

API additions on `server.ts`:

- `GET /api/entities?scan=<id>` — list entities with mention + code-usage counts.
- `GET /api/entity?id=<entity>&scan=<id>` — entity detail: mentions, code usages, doc-vs-code ratio.

UI additions (`web/app.js`, `web/index.html`):

- Top-bar "view: structural | semantic" toggle. Semantic view re-renders the same Cytoscape/G6 canvas with **entity nodes** (purple) connected to doc-nodes via `mentions` edges.
- Side panel grows a "concepts mentioned" section listing entities found in the selected file.

Agent tool additions (`src/tools/docs-graph.ts`):

- `listEntities(filter)`, `entityDetail(id)`, `entityDrift({maxCodeUsages?, minDocMentions?})` — returns the doc-ahead-of-code candidates as a structured list.

## Decisions baked in

1. **Dictionary first, LLM optional.** The deterministic dictionary extractor is the load-bearing component; LLM extraction is an `--llm-entities` opt-in for repos where the dictionary doesn't cover the surface. This preserves the deterministic posture of docs-graph by default.
2. **Heading nodes are additive, not replacing file nodes.** File nodes stay the primary unit (matches BookRAG's "tree mirrors TOC, entities map onto tree"). Heading nodes are children with `parent_path` set.
3. **Mentions != edges in the structural graph.** Stored in a separate `mentions` table so the original `edges` table stays "explicit references the author typed." This keeps Meta_06–Meta_09 detectors unaffected — they continue to operate on structural edges only.
4. **Code-usage scan is ripgrep-based, not full parse.** For each entity with a `code_hint` field (e.g. `DuckDB`'s hint is `import duckdb`), run `rg -n` for the hint across `apps/`, `packages/`, `devops/`. Cheap, language-agnostic, good enough for "is this concept actually wired up?" judgement.
5. **No vector embeddings in this round.** BookRAG itself doesn't require embeddings; the dual-index is structural + entity-symbolic. Stay symbolic. If embedding-based retrieval is needed later it gets its own round.
6. **One LLM call per file, cached by content hash.** If `--llm-entities` is on, the LLM extractor receives only the file body and emits a JSON list. The cache lives in `.agents/orchestrators/self-evo/data/entity-cache.db` so re-scans on unchanged files are free.
7. **Severity is `warn`, not `error`, for doc-ahead-of-code.** Documents claiming more than code delivers is a _signal_, not a _bug_ — sometimes the doc is the roadmap. The judge / round-writer can choose to escalate per round.

## Validation strategy

- Fixture-based unit tests on heading extraction + dictionary extractor.
- One **golden fixture** asserting the DuckDB case: a small docs tree that mentions DuckDB N times, code that imports it once, and `doc-vs-code` detector emits exactly one warn finding with the right counts.
- End-to-end: scan this repo with `--llm-entities=off` (dict-only), assert at least the `DuckDB` and `specs/` cases appear in `entityDrift()` output.
- Manual: open the semantic view in the UI; the entity node "DuckDB" should be densely linked to docs and sparsely linked to code.

## Out of scope (this round)

- Free-form `ask(question)` agent endpoint or any RAG QA loop. BookRAG ships an agent-style retriever; we deliberately don't.
- Vector embeddings.
- Query-routing agent layer (BookRAG's 3rd contribution).
- Heading-level positions / annotations in the UI — positions remain file-level for now to keep the layout stable.
- LLM-assisted _claim_ extraction beyond the simple heuristic in `claim-orphan.ts`. Anything deeper is a separate Meta round.

## State of the world after this round

- docs-graph can detect _semantic_ drift (doc-ahead-of-code) deterministically, with LLM extraction as an opt-in upgrade.
- The structural detector set from Meta_06 is unchanged; new detectors are additive.
- The UI has a 2nd view exposing entity-level structure.
- `judge` / `round-writer` get one more drift signal to consult before approving a round.

## Open questions to resolve before opening this round

1. **Where does `entities/dictionary.yaml` live and who owns it?** Repo-local (checked-in) keeps it versioned but couples docs-graph to repo content. Standalone (self-evo internal) keeps the tool generic but requires re-seeding per repo.
2. **Code-usage scope.** Today's proposal is `apps/ packages/ devops/`. Should `.agents/orchestrators/` count as "code" for self-evo entity drift? Probably yes — it _is_ code — but that creates cross-track entity drift (the cooperate-but-don't-blur risk).
3. **LLM provider.** Subprocess `claude -p` (same path as self-evo nodes) vs. direct Anthropic SDK (same path as `patch-author`). Probably mirror `patch-author`.
4. **Is heading-level drag/annotation worth deferring entirely?** Likely yes — `positions` keyed on `node_path` would need composite keys or scoping. Decide before schema lands.

Answer those four before opening this round.
