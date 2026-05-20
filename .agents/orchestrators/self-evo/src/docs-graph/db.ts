import Database, { type Database as Db } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { DocsGraph, GraphEdge, GraphNode } from "./graph.js";

export type Severity = "info" | "warn" | "error";

export interface Finding {
  scanId: string;
  detector: string;
  nodePath: string | null;
  severity: Severity;
  body: string;
}

export interface Scan {
  id: string;
  startedAt: number;
  commitSha: string | null;
  branch: string | null;
  nodeCount: number;
  edgeCount: number;
  findingCount: number;
}

export interface Position {
  nodePath: string;
  x: number;
  y: number;
  pinned: boolean;
  updatedAt: number;
  updatedBy: string;
}

export interface Annotation {
  id: number;
  nodePath: string;
  author: string;
  body: string;
  tagsJson: string | null;
  createdAt: number;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scans (
  id            TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,
  commit_sha    TEXT,
  branch        TEXT,
  node_count    INTEGER NOT NULL DEFAULT 0,
  edge_count    INTEGER NOT NULL DEFAULT 0,
  finding_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nodes (
  scan_id        TEXT NOT NULL,
  path           TEXT NOT NULL,
  track          TEXT NOT NULL,
  kind           TEXT NOT NULL,
  last_modified  INTEGER NOT NULL,
  word_count     INTEGER NOT NULL,
  outbound_refs  INTEGER NOT NULL,
  inbound_refs   INTEGER NOT NULL,
  parent_path    TEXT,
  depth          INTEGER NOT NULL DEFAULT 0,
  anchor         TEXT,
  PRIMARY KEY (scan_id, path),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges (
  scan_id  TEXT NOT NULL,
  src      TEXT NOT NULL,
  dst      TEXT NOT NULL,
  kind     TEXT NOT NULL,
  line     INTEGER NOT NULL,
  broken   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_edges_scan_src ON edges(scan_id, src);
CREATE INDEX IF NOT EXISTS idx_edges_scan_dst ON edges(scan_id, dst);

CREATE TABLE IF NOT EXISTS findings (
  scan_id   TEXT NOT NULL,
  detector  TEXT NOT NULL,
  node_path TEXT,
  severity  TEXT NOT NULL,
  body      TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);

CREATE TABLE IF NOT EXISTS positions (
  node_path  TEXT PRIMARY KEY,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  node_path  TEXT NOT NULL,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  tags_json  TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotations_node ON annotations(node_path);

CREATE TABLE IF NOT EXISTS entities (
  scan_id  TEXT NOT NULL,
  id       TEXT NOT NULL,
  display  TEXT NOT NULL,
  kind     TEXT NOT NULL,
  PRIMARY KEY (scan_id, id),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentions (
  scan_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  node_path  TEXT NOT NULL,
  line       INTEGER,
  surface    TEXT NOT NULL,
  source     TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mentions_scan_entity ON mentions(scan_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_scan_node ON mentions(scan_id, node_path);

CREATE TABLE IF NOT EXISTS code_usages (
  scan_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  file_path  TEXT NOT NULL,
  line       INTEGER,
  surface    TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_code_usages_scan_entity ON code_usages(scan_id, entity_id);
`;

export interface OpenDbOptions {
  /** Absolute or repo-relative path to the SQLite file. */
  file: string;
  /** Open read-only (for agent tools / read API). */
  readonly?: boolean;
}

export function openDb(opts: OpenDbOptions): Db {
  const file = resolve(opts.file);
  if (!opts.readonly) mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file, opts.readonly ? { readonly: true, fileMustExist: true } : {});
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  if (!opts.readonly) {
    db.exec(SCHEMA_SQL);
    runMigrations(db);
  }
  return db;
}

// Additive migrations for pre-Meta_10 dbs that already have a `nodes` table
// but lack parent_path/depth/anchor columns. `CREATE TABLE IF NOT EXISTS`
// is a no-op when the table exists, so we ALTER explicitly.
function runMigrations(db: Db): void {
  const cols = db.prepare(`PRAGMA table_info(nodes)`).all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("parent_path")) db.exec(`ALTER TABLE nodes ADD COLUMN parent_path TEXT`);
  if (!names.has("depth")) db.exec(`ALTER TABLE nodes ADD COLUMN depth INTEGER NOT NULL DEFAULT 0`);
  if (!names.has("anchor")) db.exec(`ALTER TABLE nodes ADD COLUMN anchor TEXT`);
}

export function newScanId(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19);
  return `${iso}-${randomBytes(2).toString("hex")}`;
}

export interface EntityRecord {
  id: string;
  display: string;
  kind: string;
}

export interface MentionRecord {
  entityId: string;
  nodePath: string;
  line: number | null;
  surface: string;
  source: "dict" | "llm";
}

export interface CodeUsageRecord {
  entityId: string;
  filePath: string;
  line: number | null;
  surface: string;
}

export interface WriteScanInput {
  scanId: string;
  startedAt: number;
  commitSha?: string | null;
  branch?: string | null;
  graph: DocsGraph;
  findings: Finding[];
  entities?: EntityRecord[];
  mentions?: MentionRecord[];
  codeUsages?: CodeUsageRecord[];
}

export function writeScan(db: Db, input: WriteScanInput): void {
  const tx = db.transaction((arg: WriteScanInput) => {
    db.prepare(
      `INSERT INTO scans(id, started_at, commit_sha, branch, node_count, edge_count, finding_count)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      arg.scanId,
      arg.startedAt,
      arg.commitSha ?? null,
      arg.branch ?? null,
      arg.graph.nodes.length,
      arg.graph.edges.length,
      arg.findings.length,
    );
    const insNode = db.prepare(
      `INSERT INTO nodes(scan_id, path, track, kind, last_modified, word_count, outbound_refs, inbound_refs, parent_path, depth, anchor)
       VALUES(@scan_id, @path, @track, @kind, @last_modified, @word_count, @outbound_refs, @inbound_refs, @parent_path, @depth, @anchor)`,
    );
    for (const n of arg.graph.nodes) {
      insNode.run({
        scan_id: arg.scanId,
        path: n.path,
        track: n.track,
        kind: n.kind,
        last_modified: Math.floor(n.lastModified),
        word_count: n.wordCount,
        outbound_refs: n.outboundRefs,
        inbound_refs: n.inboundRefs,
        parent_path: n.parentPath ?? null,
        depth: n.depth ?? 0,
        anchor: n.anchor ?? null,
      });
    }
    const insEdge = db.prepare(
      `INSERT INTO edges(scan_id, src, dst, kind, line, broken)
       VALUES(?, ?, ?, ?, ?, ?)`,
    );
    for (const e of arg.graph.edges) {
      insEdge.run(arg.scanId, e.src, e.dst, e.kind, e.line, e.broken ? 1 : 0);
    }
    const insFinding = db.prepare(
      `INSERT INTO findings(scan_id, detector, node_path, severity, body)
       VALUES(?, ?, ?, ?, ?)`,
    );
    for (const f of arg.findings) {
      insFinding.run(arg.scanId, f.detector, f.nodePath, f.severity, f.body);
    }
    if (arg.entities && arg.entities.length > 0) {
      const insEntity = db.prepare(
        `INSERT INTO entities(scan_id, id, display, kind) VALUES(?, ?, ?, ?)`,
      );
      for (const e of arg.entities) insEntity.run(arg.scanId, e.id, e.display, e.kind);
    }
    if (arg.mentions && arg.mentions.length > 0) {
      const insMention = db.prepare(
        `INSERT INTO mentions(scan_id, entity_id, node_path, line, surface, source) VALUES(?, ?, ?, ?, ?, ?)`,
      );
      for (const m of arg.mentions) {
        insMention.run(arg.scanId, m.entityId, m.nodePath, m.line, m.surface, m.source);
      }
    }
    if (arg.codeUsages && arg.codeUsages.length > 0) {
      const insUsage = db.prepare(
        `INSERT INTO code_usages(scan_id, entity_id, file_path, line, surface) VALUES(?, ?, ?, ?, ?)`,
      );
      for (const u of arg.codeUsages) {
        insUsage.run(arg.scanId, u.entityId, u.filePath, u.line, u.surface);
      }
    }
  });
  tx(input);
}

export function listEntities(db: Db, scanId: string): Array<EntityRecord & { mentionCount: number; codeUsageCount: number }> {
  return db
    .prepare(
      `SELECT e.id, e.display, e.kind,
              (SELECT COUNT(*) FROM mentions m WHERE m.scan_id = e.scan_id AND m.entity_id = e.id) AS mentionCount,
              (SELECT COUNT(*) FROM code_usages c WHERE c.scan_id = e.scan_id AND c.entity_id = e.id) AS codeUsageCount
         FROM entities e WHERE e.scan_id = ?
         ORDER BY mentionCount DESC, e.id`,
    )
    .all(scanId) as Array<EntityRecord & { mentionCount: number; codeUsageCount: number }>;
}

export function getEntity(db: Db, scanId: string, entityId: string): EntityRecord | undefined {
  return db
    .prepare(`SELECT id, display, kind FROM entities WHERE scan_id = ? AND id = ?`)
    .get(scanId, entityId) as EntityRecord | undefined;
}

export function getMentions(db: Db, scanId: string, entityId: string): MentionRecord[] {
  return db
    .prepare(
      `SELECT entity_id as entityId, node_path as nodePath, line, surface, source
         FROM mentions WHERE scan_id = ? AND entity_id = ?`,
    )
    .all(scanId, entityId) as MentionRecord[];
}

export function getCodeUsages(db: Db, scanId: string, entityId: string): CodeUsageRecord[] {
  return db
    .prepare(
      `SELECT entity_id as entityId, file_path as filePath, line, surface
         FROM code_usages WHERE scan_id = ? AND entity_id = ?`,
    )
    .all(scanId, entityId) as CodeUsageRecord[];
}

export function getMentionsForNode(db: Db, scanId: string, nodePath: string): MentionRecord[] {
  return db
    .prepare(
      `SELECT entity_id as entityId, node_path as nodePath, line, surface, source
         FROM mentions WHERE scan_id = ? AND node_path = ?`,
    )
    .all(scanId, nodePath) as MentionRecord[];
}

export function latestScan(db: Db): Scan | undefined {
  const row = db
    .prepare(
      `SELECT id, started_at as startedAt, commit_sha as commitSha, branch,
              node_count as nodeCount, edge_count as edgeCount, finding_count as findingCount
         FROM scans ORDER BY started_at DESC LIMIT 1`,
    )
    .get() as Scan | undefined;
  return row;
}

export function listScans(db: Db, limit = 20): Scan[] {
  return db
    .prepare(
      `SELECT id, started_at as startedAt, commit_sha as commitSha, branch,
              node_count as nodeCount, edge_count as edgeCount, finding_count as findingCount
         FROM scans ORDER BY started_at DESC LIMIT ?`,
    )
    .all(limit) as Scan[];
}

export function getNodes(db: Db, scanId: string): GraphNode[] {
  const rows = db
    .prepare(
      `SELECT path, track, kind, last_modified as lastModified, word_count as wordCount,
              outbound_refs as outboundRefs, inbound_refs as inboundRefs,
              parent_path as parentPath, depth, anchor
         FROM nodes WHERE scan_id = ? ORDER BY path`,
    )
    .all(scanId) as GraphNode[];
  return rows;
}

interface EdgeRow {
  src: string;
  dst: string;
  kind: GraphEdge["kind"];
  line: number;
  broken: number;
}

function rowToEdge(r: EdgeRow): GraphEdge {
  return { src: r.src, dst: r.dst, kind: r.kind, line: r.line, broken: !!r.broken };
}

export function getEdges(db: Db, scanId: string): GraphEdge[] {
  const rows = db
    .prepare(`SELECT src, dst, kind, line, broken FROM edges WHERE scan_id = ?`)
    .all(scanId) as EdgeRow[];
  return rows.map(rowToEdge);
}

export function getNode(db: Db, scanId: string, path: string): GraphNode | undefined {
  const row = db
    .prepare(
      `SELECT path, track, kind, last_modified as lastModified, word_count as wordCount,
              outbound_refs as outboundRefs, inbound_refs as inboundRefs,
              parent_path as parentPath, depth, anchor
         FROM nodes WHERE scan_id = ? AND path = ?`,
    )
    .get(scanId, path) as GraphNode | undefined;
  return row;
}

export function getOutbound(db: Db, scanId: string, path: string): GraphEdge[] {
  const rows = db
    .prepare(
      `SELECT src, dst, kind, line, broken FROM edges WHERE scan_id = ? AND src = ?`,
    )
    .all(scanId, path) as EdgeRow[];
  return rows.map(rowToEdge);
}

export function getInbound(db: Db, scanId: string, path: string): GraphEdge[] {
  const rows = db
    .prepare(
      `SELECT src, dst, kind, line, broken FROM edges WHERE scan_id = ? AND dst = ?`,
    )
    .all(scanId, path) as EdgeRow[];
  return rows.map(rowToEdge);
}

export function listFindings(
  db: Db,
  scanId: string,
  filter: { severity?: Severity; detector?: string; track?: string } = {},
): Finding[] {
  const clauses: string[] = ["f.scan_id = ?"];
  const params: unknown[] = [scanId];
  if (filter.severity) {
    clauses.push("f.severity = ?");
    params.push(filter.severity);
  }
  if (filter.detector) {
    clauses.push("f.detector = ?");
    params.push(filter.detector);
  }
  let sql =
    `SELECT f.scan_id as scanId, f.detector, f.node_path as nodePath, f.severity, f.body
       FROM findings f`;
  if (filter.track) {
    sql += ` LEFT JOIN nodes n ON n.scan_id = f.scan_id AND n.path = f.node_path`;
    clauses.push("(n.track = ? OR f.node_path IS NULL)");
    params.push(filter.track);
  }
  sql += ` WHERE ${clauses.join(" AND ")} ORDER BY f.severity DESC, f.detector, f.node_path`;
  return db.prepare(sql).all(...params) as Finding[];
}

export function setPosition(
  db: Db,
  p: { nodePath: string; x: number; y: number; pinned?: boolean; updatedBy?: string },
): void {
  db.prepare(
    `INSERT INTO positions(node_path, x, y, pinned, updated_at, updated_by)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(node_path) DO UPDATE SET
       x = excluded.x,
       y = excluded.y,
       pinned = excluded.pinned,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).run(
    p.nodePath,
    p.x,
    p.y,
    p.pinned ? 1 : 0,
    Date.now(),
    p.updatedBy ?? "ui",
  );
}

interface PositionRow {
  nodePath: string;
  x: number;
  y: number;
  pinned: number;
  updatedAt: number;
  updatedBy: string;
}

function rowToPosition(r: PositionRow): Position {
  return {
    nodePath: r.nodePath,
    x: r.x,
    y: r.y,
    pinned: !!r.pinned,
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy,
  };
}

export function getPositions(db: Db): Position[] {
  const rows = db
    .prepare(
      `SELECT node_path as nodePath, x, y, pinned, updated_at as updatedAt, updated_by as updatedBy
         FROM positions`,
    )
    .all() as PositionRow[];
  return rows.map(rowToPosition);
}

export function getPosition(db: Db, nodePath: string): Position | undefined {
  const row = db
    .prepare(
      `SELECT node_path as nodePath, x, y, pinned, updated_at as updatedAt, updated_by as updatedBy
         FROM positions WHERE node_path = ?`,
    )
    .get(nodePath) as PositionRow | undefined;
  return row ? rowToPosition(row) : undefined;
}

export function addAnnotation(
  db: Db,
  a: { nodePath: string; author: string; body: string; tags?: string[] },
): number {
  const res = db
    .prepare(
      `INSERT INTO annotations(node_path, author, body, tags_json, created_at)
       VALUES(?, ?, ?, ?, ?)`,
    )
    .run(
      a.nodePath,
      a.author,
      a.body,
      a.tags && a.tags.length > 0 ? JSON.stringify(a.tags) : null,
      Date.now(),
    );
  return Number(res.lastInsertRowid);
}

export function listAnnotations(db: Db, nodePath: string): Annotation[] {
  return db
    .prepare(
      `SELECT id, node_path as nodePath, author, body, tags_json as tagsJson, created_at as createdAt
         FROM annotations WHERE node_path = ? ORDER BY created_at DESC`,
    )
    .all(nodePath) as Annotation[];
}
