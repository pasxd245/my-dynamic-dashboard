#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import minimist from "minimist";
import { buildGraph } from "./graph.js";
import { findMarkdownFiles, parseMarkdownFile } from "./parser.js";
import { parseHeadings } from "./headings.js";
import { runAllDetectors, runSemanticDetectors } from "./detectors/index.js";
import { loadDictionary, DEFAULT_DICT_PATH } from "./entities/dictionary.js";
import { extractWithDictionary, extractWithLLM } from "./entities/extractors.js";
import { scanCodeUsages } from "./entities/code-usage.js";
import {
  latestScan,
  listFindings,
  listScans,
  newScanId,
  openDb,
  writeScan,
  getNodes,
  getEdges,
} from "./db.js";
import { startServer } from "./server.js";

const HELP = `
@self/orchestrator — docs-graph

Usage:
  docs-graph scan   [--root <path>] [--db <path>] [--json] [--report <path>]
                    [--no-headings] [--no-entities] [--dict <path>]
                    [--llm-entities]
  docs-graph latest [--db <path>]
  docs-graph diff <scanA> <scanB> [--db <path>]
  docs-graph serve  [--db <path>] [--port <n>] [--host <addr>]
  docs-graph help

Defaults:
  --root            process.cwd()
  --db              .agents/orchestrators/self-evo/data/docs-graph.db
  --dict            .agents/orchestrators/self-evo/config/docs-graph-entities.yaml
  --port            7733
  --host            127.0.0.1

Flags:
  --no-headings     skip heading-level nodes
  --no-entities     skip entity extraction + semantic detectors
  --llm-entities    (opt-in) augment dict extractor with LLM (currently stub)
`;

const DEFAULT_DB_REL = ".agents/orchestrators/self-evo/data/docs-graph.db";

interface CommonArgs {
  root: string;
  db: string;
}

function commonArgs(argv: minimist.ParsedArgs): CommonArgs {
  const root = resolve(String(argv.root ?? process.cwd()));
  const dbArg = typeof argv.db === "string" && argv.db ? String(argv.db) : undefined;
  // Resolve --db against repo root so callers can invoke the script from
  // any cwd without seeding a stray data/ directory.
  const db = dbArg ? resolve(dbArg) : resolve(root, DEFAULT_DB_REL);
  return { root, db };
}

function gitInfo(root: string): { sha: string | null; branch: string | null } {
  const safe = (cmd: string): string | null => {
    try {
      return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      return null;
    }
  };
  return {
    sha: safe("git rev-parse --short=12 HEAD"),
    branch: safe("git rev-parse --abbrev-ref HEAD"),
  };
}

async function runScan(argv: minimist.ParsedArgs): Promise<void> {
  const { root, db: dbPath } = commonArgs(argv);
  const includeHeadings = argv["no-headings"] !== true && argv.headings !== false;
  const includeEntities = argv["no-entities"] !== true && argv.entities !== false;
  const llmEntities = argv["llm-entities"] === true;
  const dictArg = typeof argv.dict === "string" && argv.dict ? String(argv.dict) : undefined;
  const dictPath = dictArg ? resolve(dictArg) : resolve(root, DEFAULT_DICT_PATH);

  const started = Date.now();
  const files = await findMarkdownFiles({ root });
  const parsed = [];
  for (const f of files) parsed.push(await parseMarkdownFile(f, { root }));

  const headings = [];
  if (includeHeadings) {
    for (const f of files) {
      const hs = await parseHeadings(f, root);
      for (const h of hs) headings.push(h);
    }
  }

  const graph = await buildGraph({ root, includeHeadings });
  const scanId = newScanId();
  const structural = runAllDetectors(graph, scanId);

  let entities: import("./db.js").EntityRecord[] = [];
  let mentions: import("./db.js").MentionRecord[] = [];
  let codeUsages: import("./db.js").CodeUsageRecord[] = [];
  let semantic: typeof structural = [];
  if (includeEntities) {
    try {
      const dict = await loadDictionary(dictPath);
      const dictById = new Map(dict.entities.map((e) => [e.id, e]));
      const result = await extractWithDictionary(parsed, dict, root);
      entities = result.entities;
      mentions = result.mentions;
      if (llmEntities) {
        try {
          await extractWithLLM();
        } catch (err) {
          console.warn(`[docs-graph] --llm-entities: ${(err as Error).message}`);
        }
      }
      codeUsages = await scanCodeUsages(dict, root);
      semantic = await runSemanticDetectors(
        { graph, headings, entities, mentions, codeUsages, dictById, root },
        scanId,
      );
    } catch (err) {
      console.warn(`[docs-graph] entity extraction skipped: ${(err as Error).message}`);
    }
  }

  const findings = [...structural, ...semantic];
  const { sha, branch } = gitInfo(root);

  const db = openDb({ file: dbPath });
  try {
    writeScan(db, {
      scanId,
      startedAt: started,
      commitSha: sha,
      branch,
      graph,
      findings,
      entities,
      mentions,
      codeUsages,
    });
  } finally {
    db.close();
  }

  const summary = {
    scanId,
    root,
    db: dbPath,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    headings: headings.length,
    entities: entities.length,
    mentions: mentions.length,
    code_usages: codeUsages.length,
    findings: findings.length,
    by_severity: countBy(findings, (f) => f.severity),
    by_detector: countBy(findings, (f) => f.detector),
    by_track: countBy(graph.nodes.filter((n) => !n.parentPath), (n) => n.track),
    durationMs: Date.now() - started,
  };

  if (argv.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
    printTopFindings(findings, 12);
  }

  if (typeof argv.report === "string" && argv.report) {
    writeFileSync(resolve(String(argv.report)), renderMarkdown(summary, findings), "utf8");
    console.log(`report: ${argv.report}`);
  }
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function printSummary(s: ReturnType<typeof JSON.parse> & { scanId: string }): void {
  console.log(`scan:     ${s.scanId}`);
  console.log(`root:     ${s.root}`);
  console.log(`db:       ${s.db}`);
  console.log(`nodes:    ${s.nodes}  (headings: ${s.headings ?? 0})`);
  console.log(`edges:    ${s.edges}`);
  console.log(`entities: ${s.entities ?? 0}  mentions: ${s.mentions ?? 0}  code_usages: ${s.code_usages ?? 0}`);
  console.log(`findings: ${s.findings}  (${formatCounts(s.by_severity)})`);
  console.log(`by_det:   ${formatCounts(s.by_detector)}`);
  console.log(`by_trk:   ${formatCounts(s.by_track)}`);
  console.log(`took:     ${s.durationMs}ms`);
}

function formatCounts(c: Record<string, number>): string {
  const keys = Object.keys(c).sort();
  return keys.map((k) => `${k}=${c[k]}`).join(" ");
}

function printTopFindings(findings: Array<{ detector: string; severity: string; body: string }>, limit: number): void {
  const sev = { error: 3, warn: 2, info: 1 } as const;
  const sorted = [...findings].sort(
    (a, b) => (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0),
  );
  if (sorted.length === 0) {
    console.log("\nno findings — repo is clean per current detectors.");
    return;
  }
  console.log(`\ntop ${Math.min(limit, sorted.length)} findings:`);
  for (const f of sorted.slice(0, limit)) {
    console.log(`  [${f.severity}] ${f.detector}: ${f.body}`);
  }
  if (sorted.length > limit) console.log(`  … ${sorted.length - limit} more`);
}

function renderMarkdown(
  s: { scanId: string; nodes: number; edges: number; findings: number; by_severity: Record<string, number>; by_detector: Record<string, number> },
  findings: Array<{ detector: string; severity: string; body: string; nodePath: string | null }>,
): string {
  const lines: string[] = [];
  lines.push(`# docs-graph scan ${s.scanId}`, "");
  lines.push(`- nodes: ${s.nodes}`);
  lines.push(`- edges: ${s.edges}`);
  lines.push(`- findings: ${s.findings} (${formatCounts(s.by_severity)})`);
  lines.push(`- by detector: ${formatCounts(s.by_detector)}`, "");
  for (const sev of ["error", "warn", "info"]) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`## ${sev} (${group.length})`, "");
    for (const f of group) lines.push(`- **${f.detector}**: ${f.body}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function runLatest(argv: minimist.ParsedArgs): Promise<void> {
  const { db: dbPath } = commonArgs(argv);
  const db = openDb({ file: dbPath, readonly: true });
  try {
    const s = latestScan(db);
    if (!s) {
      console.log("(no scans)");
      return;
    }
    console.log(`scan:    ${s.id}`);
    console.log(`when:    ${new Date(s.startedAt).toISOString()}`);
    console.log(`branch:  ${s.branch ?? "(unknown)"}`);
    console.log(`commit:  ${s.commitSha ?? "(unknown)"}`);
    console.log(`nodes:   ${s.nodeCount}`);
    console.log(`edges:   ${s.edgeCount}`);
    console.log(`findings:${s.findingCount}`);
    const findings = listFindings(db, s.id);
    printTopFindings(findings, 12);
  } finally {
    db.close();
  }
}

async function runDiff(argv: minimist.ParsedArgs): Promise<void> {
  const { db: dbPath } = commonArgs(argv);
  const a = String(argv._[1] ?? "");
  const b = String(argv._[2] ?? "");
  if (!a || !b) {
    console.error("diff requires <scanA> <scanB>");
    console.error(HELP);
    process.exit(2);
  }
  const db = openDb({ file: dbPath, readonly: true });
  try {
    const nodesA = new Set(getNodes(db, a).map((n) => n.path));
    const nodesB = new Set(getNodes(db, b).map((n) => n.path));
    const added: string[] = [];
    const removed: string[] = [];
    for (const p of nodesB) if (!nodesA.has(p)) added.push(p);
    for (const p of nodesA) if (!nodesB.has(p)) removed.push(p);
    const edgeKey = (e: { src: string; dst: string; line: number; kind: string }) =>
      `${e.src}|${e.dst}|${e.line}|${e.kind}`;
    const edgesA = new Set(getEdges(db, a).map(edgeKey));
    const edgesB = new Set(getEdges(db, b).map(edgeKey));
    let addedEdges = 0;
    let removedEdges = 0;
    for (const k of edgesB) if (!edgesA.has(k)) addedEdges++;
    for (const k of edgesA) if (!edgesB.has(k)) removedEdges++;
    const findingsA = listFindings(db, a);
    const findingsB = listFindings(db, b);
    const findingKey = (f: { detector: string; nodePath: string | null; body: string }) =>
      `${f.detector}|${f.nodePath ?? ""}|${f.body}`;
    const fA = new Set(findingsA.map(findingKey));
    const fB = new Set(findingsB.map(findingKey));
    let addedFindings = 0;
    let fixedFindings = 0;
    for (const k of fB) if (!fA.has(k)) addedFindings++;
    for (const k of fA) if (!fB.has(k)) fixedFindings++;
    console.log(`scan A:        ${a}`);
    console.log(`scan B:        ${b}`);
    console.log(`+nodes:        ${added.length}`);
    console.log(`-nodes:        ${removed.length}`);
    console.log(`+edges:        ${addedEdges}`);
    console.log(`-edges:        ${removedEdges}`);
    console.log(`+findings:     ${addedFindings}`);
    console.log(`fixed:         ${fixedFindings}`);
    if (added.length) console.log(`added paths:\n  ${added.slice(0, 10).join("\n  ")}`);
    if (removed.length) console.log(`removed paths:\n  ${removed.slice(0, 10).join("\n  ")}`);
  } finally {
    db.close();
  }
}

async function runServe(argv: minimist.ParsedArgs): Promise<void> {
  const { db: dbPath, root } = commonArgs(argv);
  const port = Number(argv.port ?? 7733);
  const host = String(argv.host ?? "127.0.0.1");
  await startServer({ dbPath, port, host, root });
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    string: ["root", "db", "report", "port", "host"],
    boolean: ["json"],
  });
  const cmd = argv._[0];
  if (cmd === "scan") return runScan(argv);
  if (cmd === "latest") return runLatest(argv);
  if (cmd === "diff") return runDiff(argv);
  if (cmd === "serve") return runServe(argv);
  if (cmd === "help" || cmd === undefined || argv.h || argv.help) {
    console.log(HELP);
    return;
  }
  console.error(`Unknown command: ${cmd}`);
  console.error(HELP);
  process.exit(2);
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
}
