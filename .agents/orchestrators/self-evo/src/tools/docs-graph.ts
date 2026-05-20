// Read-only docs-graph tool for self-evo pipeline nodes.
//
// All functions open the SQLite db read-only, run a query, and close. They
// never mutate; writes happen through the HTTP server (UI) or the CLI
// (full scans). This keeps the agent contract narrow and safe.

import {
  getCodeUsages,
  getEdges,
  getEntity,
  getInbound,
  getMentions,
  getNode,
  getNodes,
  getOutbound,
  latestScan,
  listAnnotations,
  listEntities,
  listFindings,
  listScans,
  openDb,
  type CodeUsageRecord,
  type EntityRecord,
  type Finding,
  type MentionRecord,
  type Scan,
  type Severity,
} from "../docs-graph/db.js";
import type { GraphEdge, GraphNode } from "../docs-graph/graph.js";

const DEFAULT_DB = ".agents/orchestrators/self-evo/data/docs-graph.db";

export interface DocsGraphToolOptions {
  /** Path to the SQLite file. Defaults to the standard self-evo location. */
  dbPath?: string;
}

function withDb<T>(opts: DocsGraphToolOptions | undefined, fn: (db: ReturnType<typeof openDb>) => T): T {
  const db = openDb({ file: opts?.dbPath ?? DEFAULT_DB, readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function resolveScanId(db: ReturnType<typeof openDb>, scanId?: string): string {
  if (scanId) return scanId;
  const s = latestScan(db);
  if (!s) throw new Error("docs-graph: no scans in db; run `docs-graph scan` first.");
  return s.id;
}

export interface NodeRecord {
  scanId: string;
  node: GraphNode;
  outbound: GraphEdge[];
  inbound: GraphEdge[];
  findings: Finding[];
  annotations: Array<{
    id: number;
    author: string;
    body: string;
    tags: string[];
    createdAt: number;
  }>;
}

export function readNode(path: string, opts?: DocsGraphToolOptions & { scanId?: string }): NodeRecord {
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts?.scanId);
    const node = getNode(db, scanId, path);
    if (!node) throw new Error(`docs-graph: unknown path "${path}" in scan ${scanId}`);
    const outbound = getOutbound(db, scanId, path);
    const inbound = getInbound(db, scanId, path);
    const findings = listFindings(db, scanId).filter((f) => f.nodePath === path);
    const annotations = listAnnotations(db, path).map((a) => ({
      id: a.id,
      author: a.author,
      body: a.body,
      tags: a.tagsJson ? (JSON.parse(a.tagsJson) as string[]) : [],
      createdAt: a.createdAt,
    }));
    return { scanId, node, outbound, inbound, findings, annotations };
  });
}

export interface ListFindingsOptions extends DocsGraphToolOptions {
  scanId?: string;
  severity?: Severity;
  detector?: string;
  track?: string;
}

export function listFindingsTool(opts: ListFindingsOptions = {}): Finding[] {
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts.scanId);
    return listFindings(db, scanId, {
      severity: opts.severity,
      detector: opts.detector,
      track: opts.track,
    });
  });
}

export interface NeighborsResult {
  scanId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function neighbors(
  path: string,
  depth = 1,
  opts?: DocsGraphToolOptions & { scanId?: string },
): NeighborsResult {
  if (depth < 1) throw new Error("neighbors: depth must be >= 1");
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts?.scanId);
    const allNodes = new Map(getNodes(db, scanId).map((n) => [n.path, n]));
    const allEdges = getEdges(db, scanId);
    const visited = new Set<string>([path]);
    const fringe = new Set<string>([path]);
    const collectedEdges: GraphEdge[] = [];
    for (let d = 0; d < depth; d++) {
      const next = new Set<string>();
      for (const p of fringe) {
        for (const e of allEdges) {
          if (e.broken) continue;
          if (e.src === p && !visited.has(e.dst)) {
            collectedEdges.push(e);
            next.add(e.dst);
          } else if (e.dst === p && !visited.has(e.src)) {
            collectedEdges.push(e);
            next.add(e.src);
          }
        }
      }
      for (const p of next) visited.add(p);
      if (next.size === 0) break;
      fringe.clear();
      for (const p of next) fringe.add(p);
    }
    const nodes: GraphNode[] = [];
    for (const p of visited) {
      const n = allNodes.get(p);
      if (n) nodes.push(n);
    }
    return { scanId, nodes, edges: collectedEdges };
  });
}

export interface DriftSummary {
  scanId: string;
  bySeverity: Record<string, number>;
  byDetector: Record<string, number>;
  byTrack: Record<string, number>;
  topOffenders: Array<{ path: string; count: number; severity: Severity }>;
}

export function driftSummary(opts: DocsGraphToolOptions & { scanId?: string } = {}): DriftSummary {
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts.scanId);
    const findings = listFindings(db, scanId);
    const nodes = getNodes(db, scanId);
    const nodeTrack = new Map(nodes.map((n) => [n.path, n.track]));
    const bySeverity: Record<string, number> = {};
    const byDetector: Record<string, number> = {};
    const byTrack: Record<string, number> = {};
    const byPath = new Map<string, { count: number; severity: Severity }>();
    const sevRank: Record<Severity, number> = { info: 1, warn: 2, error: 3 };
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byDetector[f.detector] = (byDetector[f.detector] ?? 0) + 1;
      const t = f.nodePath ? nodeTrack.get(f.nodePath) : undefined;
      if (t) byTrack[t] = (byTrack[t] ?? 0) + 1;
      if (f.nodePath) {
        const cur = byPath.get(f.nodePath) ?? { count: 0, severity: "info" as Severity };
        cur.count += 1;
        if (sevRank[f.severity] > sevRank[cur.severity]) cur.severity = f.severity;
        byPath.set(f.nodePath, cur);
      }
    }
    const topOffenders = [...byPath.entries()]
      .map(([path, v]) => ({ path, count: v.count, severity: v.severity }))
      .sort((a, b) => (sevRank[b.severity] - sevRank[a.severity]) || (b.count - a.count))
      .slice(0, 10);
    return { scanId, bySeverity, byDetector, byTrack, topOffenders };
  });
}

export interface DiffResult {
  a: string;
  b: string;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: number;
  removedEdges: number;
  addedFindings: Finding[];
  fixedFindings: Finding[];
}

export function diff(
  scanA: string,
  scanB: string,
  opts?: DocsGraphToolOptions,
): DiffResult {
  return withDb(opts, (db) => {
    const nodesA = new Set(getNodes(db, scanA).map((n) => n.path));
    const nodesB = new Set(getNodes(db, scanB).map((n) => n.path));
    const addedNodes: string[] = [];
    const removedNodes: string[] = [];
    for (const p of nodesB) if (!nodesA.has(p)) addedNodes.push(p);
    for (const p of nodesA) if (!nodesB.has(p)) removedNodes.push(p);
    const ek = (e: GraphEdge) => `${e.src}|${e.dst}|${e.line}|${e.kind}`;
    const edgesA = new Set(getEdges(db, scanA).map(ek));
    const edgesB = new Set(getEdges(db, scanB).map(ek));
    let addedEdges = 0;
    let removedEdges = 0;
    for (const k of edgesB) if (!edgesA.has(k)) addedEdges++;
    for (const k of edgesA) if (!edgesB.has(k)) removedEdges++;
    const fk = (f: Finding) => `${f.detector}|${f.nodePath ?? ""}|${f.body}`;
    const findingsA = listFindings(db, scanA);
    const findingsB = listFindings(db, scanB);
    const aKeys = new Set(findingsA.map(fk));
    const bKeys = new Set(findingsB.map(fk));
    const addedFindings = findingsB.filter((f) => !aKeys.has(fk(f)));
    const fixedFindings = findingsA.filter((f) => !bKeys.has(fk(f)));
    return { a: scanA, b: scanB, addedNodes, removedNodes, addedEdges, removedEdges, addedFindings, fixedFindings };
  });
}

export function listScansTool(opts: DocsGraphToolOptions = {}): Scan[] {
  return withDb(opts, (db) => listScans(db, 20));
}

export interface EntitySummary extends EntityRecord {
  mentionCount: number;
  codeUsageCount: number;
}

export function listEntitiesTool(
  opts: DocsGraphToolOptions & { scanId?: string } = {},
): EntitySummary[] {
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts.scanId);
    return listEntities(db, scanId);
  });
}

export interface EntityDetail {
  scanId: string;
  entity: EntityRecord;
  mentions: MentionRecord[];
  codeUsages: CodeUsageRecord[];
}

export function entityDetail(
  id: string,
  opts: DocsGraphToolOptions & { scanId?: string } = {},
): EntityDetail {
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts.scanId);
    const entity = getEntity(db, scanId, id);
    if (!entity) throw new Error(`docs-graph: unknown entity "${id}" in scan ${scanId}`);
    return {
      scanId,
      entity,
      mentions: getMentions(db, scanId, id),
      codeUsages: getCodeUsages(db, scanId, id),
    };
  });
}

export interface EntityDriftRow {
  id: string;
  display: string;
  kind: string;
  docMentions: number;
  codeUsages: number;
  ratio: number;
}

/**
 * Return the entities most over-claimed by docs vs. code: high mention count
 * with low code-usage count. Use this to surface "the docs say X is wired up;
 * the code disagrees" candidates for human review.
 */
export function entityDrift(
  opts: DocsGraphToolOptions & {
    scanId?: string;
    minDocMentions?: number;
    maxCodeUsages?: number;
    limit?: number;
  } = {},
): EntityDriftRow[] {
  const minDoc = opts.minDocMentions ?? 3;
  const maxCode = opts.maxCodeUsages ?? 1;
  const limit = opts.limit ?? 20;
  return withDb(opts, (db) => {
    const scanId = resolveScanId(db, opts.scanId);
    return listEntities(db, scanId)
      .filter((e) => e.mentionCount >= minDoc && e.codeUsageCount <= maxCode)
      .map((e) => ({
        id: e.id,
        display: e.display,
        kind: e.kind,
        docMentions: e.mentionCount,
        codeUsages: e.codeUsageCount,
        ratio: e.codeUsageCount === 0 ? Infinity : e.mentionCount / e.codeUsageCount,
      }))
      .sort((a, b) => (b.ratio === a.ratio ? b.docMentions - a.docMentions : b.ratio - a.ratio))
      .slice(0, limit);
  });
}
