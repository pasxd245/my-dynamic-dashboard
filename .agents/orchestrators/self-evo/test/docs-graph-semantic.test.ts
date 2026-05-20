import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHeadings, slugify } from "../src/docs-graph/headings.js";
import { buildGraph } from "../src/docs-graph/graph.js";
import { loadDictionary } from "../src/docs-graph/entities/dictionary.js";
import { extractWithDictionary, extractWithLLM } from "../src/docs-graph/entities/extractors.js";
import { docVsCode } from "../src/docs-graph/detectors/doc-vs-code.js";
import { claimOrphan } from "../src/docs-graph/detectors/claim-orphan.js";
import {
  newScanId,
  openDb,
  writeScan,
  listEntities,
  getMentions,
  getCodeUsages,
} from "../src/docs-graph/db.js";
import { entityDrift, entityDetail, listEntitiesTool } from "../src/tools/docs-graph.js";

async function makeSemanticFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "docs-graph-sem-"));
  await mkdir(join(root, "docs", "features"), { recursive: true });
  await mkdir(join(root, ".agents", "plan", "cycles"), { recursive: true });
  await mkdir(join(root, ".agents", "auto", "reports", "20260521"), { recursive: true });
  await mkdir(join(root, "config"), { recursive: true });

  // Three docs mention DuckDB; no code references DuckDB.
  for (let i = 1; i <= 3; i++) {
    await writeFile(
      join(root, "docs", "features", `spec-00${i}.md`),
      [
        `# Spec 00${i}`,
        "",
        "## Implementation",
        "",
        `Status: complete. The query engine uses DuckDB over Parquet.`,
        "",
      ].join("\n"),
    );
  }

  // README — root node so it's not flagged orphan.
  await writeFile(join(root, "README.md"), "# Test\n\nSee [spec1](docs/features/spec-001.md).\n");

  // Round file claiming Status: complete but with no code-ref.
  await writeFile(
    join(root, ".agents", "plan", "cycles", "Round_01.md"),
    [
      "# Round 01",
      "",
      "**Status**: Complete",
      "",
      "## Phase 4 close-out",
      "",
      "Status: complete. The shipping path is done.",
      "",
    ].join("\n"),
  );

  // Matching report so round-report-pair doesn't trigger noise we care about.
  await writeFile(
    join(root, ".agents", "auto", "reports", "20260521", "Round_01.report.md"),
    "# Round 01 report\n",
  );

  // Test dictionary with only DuckDB.
  await writeFile(
    join(root, "config", "entities.yaml"),
    [
      "entities:",
      "  - id: duckdb",
      "    display: DuckDB",
      "    kind: tool",
      "    aliases: ['DuckDB', 'duckdb']",
      "    codeHints: ['import duckdb']",
    ].join("\n"),
  );

  return root;
}

test("slugify produces github-style anchors", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("`code` is fine"), "code-is-fine");
  assert.equal(slugify("Multiple   spaces"), "multiple-spaces");
});

test("parseHeadings extracts ATX headings with anchors, skips fenced", async () => {
  const root = await makeSemanticFixture();
  try {
    const headings = await parseHeadings("docs/features/spec-001.md", root);
    assert.equal(headings.length, 2);
    assert.equal(headings[0]!.depth, 1);
    assert.equal(headings[0]!.text, "Spec 001");
    assert.equal(headings[0]!.anchor, "spec-001");
    assert.equal(headings[1]!.text, "Implementation");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildGraph(includeHeadings) emits heading nodes + child-of edges", async () => {
  const root = await makeSemanticFixture();
  try {
    const graph = await buildGraph({ root, includeHeadings: true });
    const headingNodes = graph.nodes.filter((n) => n.parentPath);
    assert.ok(headingNodes.length >= 4);
    const childOf = graph.edges.filter((e) => e.kind === "child-of");
    assert.equal(childOf.length, headingNodes.length);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dictionary loader rejects malformed YAML and resolves aliases", async () => {
  const root = await makeSemanticFixture();
  try {
    const dict = await loadDictionary(join(root, "config", "entities.yaml"));
    assert.equal(dict.entities.length, 1);
    assert.equal(dict.entities[0]!.id, "duckdb");
    // Display string auto-prepended to aliases:
    assert.ok(dict.entities[0]!.aliases.includes("DuckDB"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dict extractor finds DuckDB mentions across all docs", async () => {
  const root = await makeSemanticFixture();
  try {
    const dict = await loadDictionary(join(root, "config", "entities.yaml"));
    const { findMarkdownFiles, parseMarkdownFile } = await import("../src/docs-graph/parser.js");
    const files = await findMarkdownFiles({ root });
    const parsed = [];
    for (const f of files) parsed.push(await parseMarkdownFile(f, { root }));
    const result = await extractWithDictionary(parsed, dict, root);
    assert.equal(result.entities.length, 1);
    assert.ok(result.mentions.length >= 3);
    assert.equal(result.entities[0]!.id, "duckdb");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LLM extractor stub rejects until wired", async () => {
  await assert.rejects(() => extractWithLLM(), /not yet wired/);
});

test("doc-vs-code flags an over-claimed entity", () => {
  const dictById = new Map([
    ["duckdb", { id: "duckdb", display: "DuckDB", kind: "tool" as const, aliases: ["DuckDB"], codeHints: ["import duckdb"] }],
  ]);
  const entities = [{ id: "duckdb", display: "DuckDB", kind: "tool" }];
  const mentions = Array.from({ length: 5 }, (_, i) => ({
    entityId: "duckdb",
    nodePath: `docs/spec-${i}.md`,
    line: 1,
    surface: "DuckDB",
    source: "dict" as const,
  }));
  const findings = docVsCode({ entities, mentions, codeUsages: [], dictById }, "test");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.detector, "doc-vs-code");
  assert.equal(findings[0]!.severity, "warn");
});

test("doc-vs-code stays silent when code matches docs", () => {
  const dictById = new Map([
    ["polars", { id: "polars", display: "Polars", kind: "tool" as const, aliases: ["Polars"], codeHints: ["import polars"] }],
  ]);
  const entities = [{ id: "polars", display: "Polars", kind: "tool" }];
  const mentions = Array.from({ length: 5 }, (_, i) => ({
    entityId: "polars",
    nodePath: `docs/d${i}.md`,
    line: 1,
    surface: "Polars",
    source: "dict" as const,
  }));
  const codeUsages = Array.from({ length: 10 }, (_, i) => ({
    entityId: "polars",
    filePath: `apps/f${i}.py`,
    line: 1,
    surface: "import polars",
  }));
  const findings = docVsCode({ entities, mentions, codeUsages, dictById }, "test");
  assert.equal(findings.length, 0);
});

test("claim-orphan fires on Round_NN.md with 'Status: complete' and no code-ref", async () => {
  const root = await makeSemanticFixture();
  try {
    const graph = await buildGraph({ root, includeHeadings: true });
    const { parseHeadings } = await import("../src/docs-graph/headings.js");
    const allHeadings = [];
    for (const f of new Set(graph.nodes.filter((n) => !n.parentPath).map((n) => n.path))) {
      const hs = await parseHeadings(f, root);
      for (const h of hs) allHeadings.push(h);
    }
    const findings = await claimOrphan({ graph, headings: allHeadings, root }, "test");
    const target = findings.find((f) => f.nodePath?.startsWith(".agents/plan/cycles/Round_01.md"));
    assert.ok(target, "expected claim-orphan finding on Round_01.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("db persists entities/mentions/code_usages and tool reads them back", async () => {
  const root = await makeSemanticFixture();
  const dbPath = join(root, "data", "test.db");
  try {
    const graph = await buildGraph({ root, includeHeadings: true });
    const scanId = newScanId();
    const db = openDb({ file: dbPath });
    writeScan(db, {
      scanId,
      startedAt: Date.now(),
      graph,
      findings: [],
      entities: [{ id: "duckdb", display: "DuckDB", kind: "tool" }],
      mentions: [
        { entityId: "duckdb", nodePath: "docs/features/spec-001.md", line: 5, surface: "DuckDB", source: "dict" },
        { entityId: "duckdb", nodePath: "docs/features/spec-002.md", line: 5, surface: "DuckDB", source: "dict" },
        { entityId: "duckdb", nodePath: "docs/features/spec-003.md", line: 5, surface: "DuckDB", source: "dict" },
      ],
      codeUsages: [],
    });
    const all = listEntities(db, scanId);
    assert.equal(all.length, 1);
    assert.equal(all[0]!.mentionCount, 3);
    assert.equal(all[0]!.codeUsageCount, 0);
    assert.equal(getMentions(db, scanId, "duckdb").length, 3);
    assert.equal(getCodeUsages(db, scanId, "duckdb").length, 0);
    db.close();

    const summary = listEntitiesTool({ dbPath });
    assert.equal(summary[0]!.id, "duckdb");
    const drift = entityDrift({ dbPath, minDocMentions: 3, maxCodeUsages: 0 });
    assert.equal(drift.length, 1);
    assert.equal(drift[0]!.id, "duckdb");
    const detail = entityDetail("duckdb", { dbPath });
    assert.equal(detail.mentions.length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("server exposes /api/entities and /api/entity", async () => {
  const root = await makeSemanticFixture();
  const dbPath = join(root, "data", "test.db");
  try {
    const graph = await buildGraph({ root, includeHeadings: true });
    const scanId = newScanId();
    const db = openDb({ file: dbPath });
    writeScan(db, {
      scanId,
      startedAt: Date.now(),
      graph,
      findings: [],
      entities: [{ id: "duckdb", display: "DuckDB", kind: "tool" }],
      mentions: [
        { entityId: "duckdb", nodePath: "docs/features/spec-001.md", line: 5, surface: "DuckDB", source: "dict" },
      ],
      codeUsages: [],
    });
    db.close();

    const { startServer } = await import("../src/docs-graph/server.js");
    const handle = await startServer({ dbPath, port: 0, host: "127.0.0.1", root });
    try {
      const base = `http://${handle.host}:${handle.port}`;
      const entRes = await fetch(`${base}/api/entities`);
      const entJson = (await entRes.json()) as { scanId: string; entities: Array<{ id: string }> };
      assert.equal(entJson.scanId, scanId);
      assert.equal(entJson.entities.length, 1);
      assert.equal(entJson.entities[0]!.id, "duckdb");

      const detRes = await fetch(`${base}/api/entity?id=duckdb`);
      const detJson = (await detRes.json()) as {
        entity: { id: string };
        mentions: unknown[];
        codeUsages: unknown[];
      };
      assert.equal(detJson.entity.id, "duckdb");
      assert.equal(detJson.mentions.length, 1);
    } finally {
      await handle.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("schema migration adds parent_path/depth/anchor to a pre-Meta_10 db", async () => {
  const root = await mkdtemp(join(tmpdir(), "docs-graph-mig-"));
  try {
    const dbPath = join(root, "old.db");
    // Hand-craft a pre-Meta_10 nodes table.
    const Database = (await import("better-sqlite3")).default;
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE scans (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, commit_sha TEXT, branch TEXT,
                          node_count INTEGER, edge_count INTEGER, finding_count INTEGER);
      CREATE TABLE nodes (scan_id TEXT, path TEXT, track TEXT, kind TEXT, last_modified INTEGER,
                          word_count INTEGER, outbound_refs INTEGER, inbound_refs INTEGER,
                          PRIMARY KEY (scan_id, path));
    `);
    raw.close();

    const db = openDb({ file: dbPath });
    const cols = (db.prepare("PRAGMA table_info(nodes)").all() as Array<{ name: string }>).map((c) => c.name);
    assert.ok(cols.includes("parent_path"));
    assert.ok(cols.includes("depth"));
    assert.ok(cols.includes("anchor"));
    db.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
