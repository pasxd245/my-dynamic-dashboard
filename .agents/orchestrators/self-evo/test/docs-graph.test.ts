import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/docs-graph/graph.js";
import { runAllDetectors } from "../src/docs-graph/detectors/index.js";
import { inferKind, inferTrack } from "../src/docs-graph/classifier.js";
import { newScanId, openDb, writeScan, latestScan, listFindings, setPosition, getPosition, addAnnotation, listAnnotations } from "../src/docs-graph/db.js";
import { findMarkdownFiles, parseMarkdownFile } from "../src/docs-graph/parser.js";
import { readNode, listFindingsTool, neighbors, driftSummary, diff } from "../src/tools/docs-graph.js";
import { startServer } from "../src/docs-graph/server.js";

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "docs-graph-test-"));
  await mkdir(join(root, "docs", "features"), { recursive: true });
  await mkdir(join(root, ".agents", "plan", "cycles"), { recursive: true });
  await mkdir(join(root, ".agents", "plan", "meta"), { recursive: true });
  await mkdir(join(root, ".agents", "auto", "reports", "20260521"), { recursive: true });
  await mkdir(join(root, "apps", "backend"), { recursive: true });

  await writeFile(
    join(root, "README.md"),
    [
      "# Repo",
      "",
      "See [features](docs/features/spec-001-profiling.md) and [missing](specs/ghost.md).",
      "",
      "Inline backtick `code` is not a link.",
      "",
      "```",
      "[ignored](docs/should-not-extract.md)",
      "```",
    ].join("\n"),
  );

  await writeFile(
    join(root, "docs", "features", "spec-001-profiling.md"),
    [
      "# Spec 001",
      "",
      "References the backend at [main.py](../../apps/backend/main.py).",
      "Also links back to [README](../../README.md).",
    ].join("\n"),
  );

  await writeFile(
    join(root, "docs", "features", "spec-002-orphan.md"),
    "# Orphan spec — nothing links here\n",
  );

  await writeFile(
    join(root, "apps", "backend", "main.py"),
    "print('hello')\n",
  );

  // Round without a matching report -> should trigger round-report-pair
  await writeFile(
    join(root, ".agents", "plan", "cycles", "Round_01.md"),
    "# Round 01\n\nSee [readme](../../../README.md).\n",
  );

  // Meta round with a matching report -> should NOT trigger
  await writeFile(
    join(root, ".agents", "plan", "meta", "Meta_01.md"),
    "# Meta 01\n",
  );
  await writeFile(
    join(root, ".agents", "auto", "reports", "20260521", "Meta_01.report.md"),
    "# Meta 01 report\n",
  );

  return root;
}

test("classifier infers track and kind", () => {
  assert.equal(inferTrack("docs/features/spec-001-profiling.md"), "product");
  assert.equal(inferTrack(".agents/plan/cycles/Round_01.md"), "agent-method");
  assert.equal(inferTrack(".agents/plan/meta/Meta_01.md"), "self-evo");
  assert.equal(inferTrack(".agents/orchestrators/self-evo/README.md"), "self-evo");
  assert.equal(inferTrack("README.md"), "product");
  assert.equal(inferTrack("apps/backend/main.py"), "product");
  assert.equal(inferTrack("random/thing.md"), "unknown");

  assert.equal(inferKind("docs/features/spec-001-profiling.md"), "spec");
  assert.equal(inferKind(".agents/plan/cycles/Round_07.md"), "round");
  assert.equal(inferKind(".agents/plan/meta/Meta_06.md"), "meta");
  assert.equal(inferKind(".agents/auto/reports/20260521/Round_07.report.md"), "report");
  assert.equal(inferKind(".agents/memory/whatever.md"), "memory");
  assert.equal(inferKind(".agents/skills/foo/SKILL.md"), "skill");
  assert.equal(inferKind("docs/operations/oncall.md"), "runbook");
  assert.equal(inferKind("README.md"), "readme");
  assert.equal(inferKind("docs/README.md"), "readme");
});

test("parser extracts md/code links, skips fenced + external + anchors", async () => {
  const root = await makeFixture();
  try {
    const files = await findMarkdownFiles({ root });
    const readme = files.find((f) => f === "README.md");
    assert.ok(readme);
    const parsed = await parseMarkdownFile(readme!, { root });
    const targets = parsed.links.map((l) => l.resolvedTarget);
    assert.deepEqual(targets.sort(), ["docs/features/spec-001-profiling.md", "specs/ghost.md"]);
    const broken = parsed.links.find((l) => l.resolvedTarget === "specs/ghost.md");
    assert.equal(broken?.broken, true);
    const ok = parsed.links.find((l) => l.resolvedTarget === "docs/features/spec-001-profiling.md");
    assert.equal(ok?.broken, false);
    assert.equal(ok?.kind, "md-link");
    // Fenced-code link must not appear.
    assert.equal(parsed.links.find((l) => l.resolvedTarget.endsWith("should-not-extract.md")), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildGraph computes inbound counts and pair edges", async () => {
  const root = await makeFixture();
  try {
    const graph = await buildGraph({ root });
    const readme = graph.nodes.find((n) => n.path === "README.md");
    const spec = graph.nodes.find((n) => n.path === "docs/features/spec-001-profiling.md");
    const orphan = graph.nodes.find((n) => n.path === "docs/features/spec-002-orphan.md");
    assert.ok(readme && spec && orphan);
    // README is linked by spec-001 and Round_01
    assert.ok((readme?.inboundRefs ?? 0) >= 2);
    assert.equal(spec?.inboundRefs, 1);
    assert.equal(orphan?.inboundRefs, 0);

    // Pair edge Meta_01 ↔ Meta_01.report.md must exist.
    const pair = graph.edges.find(
      (e) => e.kind === "pair" &&
        e.src === ".agents/plan/meta/Meta_01.md" &&
        e.dst.endsWith("Meta_01.report.md"),
    );
    assert.ok(pair, "expected pair edge between Meta_01 and Meta_01.report.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detectors fire on the constructed fixture", async () => {
  const root = await makeFixture();
  try {
    const graph = await buildGraph({ root });
    const findings = runAllDetectors(graph, "test-scan");
    const detectors = new Set(findings.map((f) => f.detector));
    assert.ok(detectors.has("broken-refs"), "broken-refs should fire (specs/ghost.md)");
    assert.ok(detectors.has("orphans"), "orphans should fire (spec-002-orphan.md)");
    assert.ok(detectors.has("round-report-pair"), "round-report-pair should fire (Round_01 has no report)");
    // Spec-001 is product → README is product → should NOT be cross-track.
    // Round_01 is agent-method → README is product → IS cross-track.
    const xtrack = findings.filter((f) => f.detector === "cross-track");
    // README is a ROOT_NODE so cross-track edges INTO it are exempt; expect none.
    assert.equal(xtrack.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("db round-trips a scan", async () => {
  const root = await makeFixture();
  const dbPath = join(root, "data", "test.db");
  try {
    const graph = await buildGraph({ root });
    const scanId = newScanId();
    const findings = runAllDetectors(graph, scanId);
    const db = openDb({ file: dbPath });
    writeScan(db, { scanId, startedAt: Date.now(), graph, findings });
    const s = latestScan(db);
    assert.equal(s?.id, scanId);
    assert.equal(s?.nodeCount, graph.nodes.length);
    const fs2 = listFindings(db, scanId);
    assert.equal(fs2.length, findings.length);
    db.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("agent tool reads back what the CLI/db wrote", async () => {
  const root = await makeFixture();
  const dbPath = join(root, "data", "test.db");
  try {
    const graph = await buildGraph({ root });
    const scanIdA = newScanId(new Date(Date.now() - 60_000));
    const findingsA = runAllDetectors(graph, scanIdA);
    const dbW = openDb({ file: dbPath });
    writeScan(dbW, { scanId: scanIdA, startedAt: Date.now() - 60_000, graph, findings: findingsA });
    dbW.close();

    const summary = driftSummary({ dbPath });
    assert.equal(summary.scanId, scanIdA);
    assert.ok(summary.bySeverity.error >= 1);

    const fs2 = listFindingsTool({ dbPath, severity: "error" });
    assert.ok(fs2.every((f) => f.severity === "error"));

    const node = readNode("README.md", { dbPath });
    assert.equal(node.node.path, "README.md");
    assert.ok(node.outbound.length >= 1);

    const nbrs = neighbors("README.md", 1, { dbPath });
    assert.ok(nbrs.nodes.length >= 2);

    // Second scan for diff.
    const scanIdB = newScanId();
    // Mutate the graph slightly: drop the broken edge by ignoring the README outbound to specs/ghost.
    const graph2 = { nodes: graph.nodes, edges: graph.edges.filter((e) => e.dst !== "specs/ghost.md") };
    const findingsB = runAllDetectors(graph2, scanIdB);
    const dbW2 = openDb({ file: dbPath });
    writeScan(dbW2, { scanId: scanIdB, startedAt: Date.now(), graph: graph2, findings: findingsB });
    dbW2.close();

    const d = diff(scanIdA, scanIdB, { dbPath });
    assert.ok(d.fixedFindings.some((f) => f.detector === "broken-refs"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("server round-trips position and annotation", async () => {
  const root = await makeFixture();
  const dbPath = join(root, "data", "test.db");
  try {
    const graph = await buildGraph({ root });
    const scanId = newScanId();
    const findings = runAllDetectors(graph, scanId);
    const dbW = openDb({ file: dbPath });
    writeScan(dbW, { scanId, startedAt: Date.now(), graph, findings });
    dbW.close();

    const handle = await startServer({ dbPath, port: 0, host: "127.0.0.1", root });
    try {
      const base = `http://${handle.host}:${handle.port}`;

      const graphRes = await fetch(`${base}/api/graph`);
      const graphJson = (await graphRes.json()) as { scanId: string; nodes: unknown[] };
      assert.equal(graphJson.scanId, scanId);
      assert.ok(graphJson.nodes.length > 0);

      const posRes = await fetch(`${base}/api/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "README.md", x: 123, y: 456, pinned: true }),
      });
      assert.equal(posRes.status, 200);

      const annoRes = await fetch(`${base}/api/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "README.md", author: "test", body: "hello" }),
      });
      const annoJson = (await annoRes.json()) as { id: number };
      assert.ok(typeof annoJson.id === "number");

      const nodeRes = await fetch(`${base}/api/node?path=${encodeURIComponent("README.md")}`);
      const nodeJson = (await nodeRes.json()) as {
        position: { x: number; y: number } | null;
        annotations: Array<{ body: string }>;
      };
      assert.equal(nodeJson.position?.x, 123);
      assert.equal(nodeJson.position?.y, 456);
      assert.equal(nodeJson.annotations.length, 1);
      assert.equal(nodeJson.annotations[0]!.body, "hello");
    } finally {
      await handle.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("position + annotation low-level db helpers", async () => {
  const root = await mkdtemp(join(tmpdir(), "docs-graph-db-"));
  try {
    const dbPath = join(root, "test.db");
    const db = openDb({ file: dbPath });
    setPosition(db, { nodePath: "x.md", x: 1, y: 2 });
    setPosition(db, { nodePath: "x.md", x: 3, y: 4, pinned: true });
    const p = getPosition(db, "x.md");
    assert.equal(p?.x, 3);
    assert.equal(p?.pinned, true);
    const id = addAnnotation(db, { nodePath: "x.md", author: "a", body: "b", tags: ["t1"] });
    assert.ok(id > 0);
    const list = listAnnotations(db, "x.md");
    assert.equal(list.length, 1);
    assert.equal(list[0]!.author, "a");
    db.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
