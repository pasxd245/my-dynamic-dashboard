import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve, extname } from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import {
  addAnnotation,
  getCodeUsages,
  getEdges,
  getEntity,
  getInbound,
  getMentions,
  getMentionsForNode,
  getNode,
  getNodes,
  getOutbound,
  getPosition,
  getPositions,
  latestScan,
  listAnnotations,
  listEntities,
  listFindings,
  listScans,
  newScanId,
  openDb,
  setPosition,
  writeScan,
  type Severity,
} from "./db.js";
import { buildGraph } from "./graph.js";
import { runAllDetectors } from "./detectors/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(HERE, "web");

export interface ServeOptions {
  dbPath: string;
  /** Repo root for /api/scan calls. */
  root: string;
  port: number;
  host: string;
  /** If true, return the Server without listening (for tests). */
  noListen?: boolean;
}

export interface ServerHandle {
  server: Server;
  port: number;
  host: string;
  close: () => Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

export async function startServer(opts: ServeOptions): Promise<ServerHandle> {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
    }
  });

  if (opts.noListen) {
    return {
      server,
      port: opts.port,
      host: opts.host,
      close: () => new Promise((resolve_) => server.close(() => resolve_())),
    };
  }

  await new Promise<void>((resolve_) => server.listen(opts.port, opts.host, () => resolve_()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;
  console.log(`docs-graph serving at http://${opts.host}:${port}`);
  console.log(`db: ${opts.dbPath}`);
  return {
    server,
    port,
    host: opts.host,
    close: () => new Promise((resolve_) => server.close(() => resolve_())),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: ServeOptions): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${opts.host}:${opts.port}`);
  const path = url.pathname;
  if (req.method === "GET") {
    if (path === "/" || path === "/index.html") return serveStatic(res, "index.html");
    if (path === "/app.js") return serveStatic(res, "app.js");
    if (path === "/style.css") return serveStatic(res, "style.css");
    if (path === "/api/scans") return apiScans(res, opts);
    if (path === "/api/graph") return apiGraph(res, url, opts);
    if (path === "/api/node") return apiNode(res, url, opts);
    if (path === "/api/findings") return apiFindings(res, url, opts);
    if (path === "/api/diff") return apiDiff(res, url, opts);
    if (path === "/api/entities") return apiEntities(res, url, opts);
    if (path === "/api/entity") return apiEntity(res, url, opts);
  }
  if (req.method === "POST") {
    if (path === "/api/positions") return apiPostPosition(req, res, opts);
    if (path === "/api/annotations") return apiPostAnnotation(req, res, opts);
    if (path === "/api/scan") return apiPostScan(res, opts);
  }
  sendJson(res, 404, { error: `not found: ${req.method} ${path}` });
}

async function serveStatic(res: ServerResponse, name: string): Promise<void> {
  const filePath = join(WEB_DIR, name);
  try {
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(name)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(body);
  } catch {
    sendJson(res, 404, { error: `static not found: ${name}` });
  }
}

function apiScans(res: ServerResponse, opts: ServeOptions): void {
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    sendJson(res, 200, { scans: listScans(db, 20) });
  } finally {
    db.close();
  }
}

function apiGraph(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const scanId = url.searchParams.get("scan") ?? latestScan(db)?.id;
    if (!scanId) {
      sendJson(res, 200, { scanId: null, nodes: [], edges: [], positions: {} });
      return;
    }
    const track = url.searchParams.get("track");
    const kind = url.searchParams.get("kind");
    const nodes = getNodes(db, scanId).filter(
      (n) => (!track || n.track === track) && (!kind || n.kind === kind),
    );
    const allow = new Set(nodes.map((n) => n.path));
    const edges = getEdges(db, scanId).filter((e) => allow.has(e.src) && (allow.has(e.dst) || e.broken));
    const positions: Record<string, { x: number; y: number; pinned: boolean }> = {};
    for (const p of getPositions(db)) {
      positions[p.nodePath] = { x: p.x, y: p.y, pinned: p.pinned };
    }
    sendJson(res, 200, { scanId, nodes, edges, positions });
  } finally {
    db.close();
  }
}

function apiNode(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const path = url.searchParams.get("path");
  if (!path) {
    sendJson(res, 400, { error: "missing path" });
    return;
  }
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const scanId = url.searchParams.get("scan") ?? latestScan(db)?.id;
    if (!scanId) {
      sendJson(res, 404, { error: "no scans" });
      return;
    }
    const node = getNode(db, scanId, path);
    if (!node) {
      sendJson(res, 404, { error: `unknown path: ${path}` });
      return;
    }
    const outbound = getOutbound(db, scanId, path);
    const inbound = getInbound(db, scanId, path);
    const findings = listFindings(db, scanId).filter((f) => f.nodePath === path);
    const annotations = listAnnotations(db, path);
    const position = getPosition(db, path);
    const mentions = getMentionsForNode(db, scanId, path);
    sendJson(res, 200, { scanId, node, outbound, inbound, findings, annotations, position, mentions });
  } finally {
    db.close();
  }
}

function apiEntities(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const scanId = url.searchParams.get("scan") ?? latestScan(db)?.id;
    if (!scanId) {
      sendJson(res, 200, { scanId: null, entities: [] });
      return;
    }
    sendJson(res, 200, { scanId, entities: listEntities(db, scanId) });
  } finally {
    db.close();
  }
}

function apiEntity(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const id = url.searchParams.get("id");
  if (!id) {
    sendJson(res, 400, { error: "missing id" });
    return;
  }
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const scanId = url.searchParams.get("scan") ?? latestScan(db)?.id;
    if (!scanId) {
      sendJson(res, 404, { error: "no scans" });
      return;
    }
    const entity = getEntity(db, scanId, id);
    if (!entity) {
      sendJson(res, 404, { error: `unknown entity: ${id}` });
      return;
    }
    const mentions = getMentions(db, scanId, id);
    const codeUsages = getCodeUsages(db, scanId, id);
    sendJson(res, 200, { scanId, entity, mentions, codeUsages });
  } finally {
    db.close();
  }
}

function apiFindings(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const scanId = url.searchParams.get("scan") ?? latestScan(db)?.id;
    if (!scanId) {
      sendJson(res, 200, { scanId: null, findings: [] });
      return;
    }
    const severity = url.searchParams.get("severity") as Severity | null;
    const detector = url.searchParams.get("detector");
    const track = url.searchParams.get("track");
    const findings = listFindings(db, scanId, {
      severity: severity ?? undefined,
      detector: detector ?? undefined,
      track: track ?? undefined,
    });
    sendJson(res, 200, { scanId, findings });
  } finally {
    db.close();
  }
}

function apiDiff(res: ServerResponse, url: URL, opts: ServeOptions): void {
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) {
    sendJson(res, 400, { error: "missing a or b" });
    return;
  }
  const db = openDb({ file: opts.dbPath, readonly: true });
  try {
    const nodesA = new Set(getNodes(db, a).map((n) => n.path));
    const nodesB = new Set(getNodes(db, b).map((n) => n.path));
    const addedNodes: string[] = [];
    const removedNodes: string[] = [];
    for (const p of nodesB) if (!nodesA.has(p)) addedNodes.push(p);
    for (const p of nodesA) if (!nodesB.has(p)) removedNodes.push(p);
    const ek = (e: { src: string; dst: string; line: number; kind: string }) =>
      `${e.src}|${e.dst}|${e.line}|${e.kind}`;
    const edgesA = new Set(getEdges(db, a).map(ek));
    const edgesB = new Set(getEdges(db, b).map(ek));
    let addedEdges = 0;
    let removedEdges = 0;
    for (const k of edgesB) if (!edgesA.has(k)) addedEdges++;
    for (const k of edgesA) if (!edgesB.has(k)) removedEdges++;
    const fk = (f: { detector: string; nodePath: string | null; body: string }) =>
      `${f.detector}|${f.nodePath ?? ""}|${f.body}`;
    const fA = new Set(listFindings(db, a).map(fk));
    const fB = new Set(listFindings(db, b).map(fk));
    let addedFindings = 0;
    let fixedFindings = 0;
    for (const k of fB) if (!fA.has(k)) addedFindings++;
    for (const k of fA) if (!fB.has(k)) fixedFindings++;
    sendJson(res, 200, {
      a,
      b,
      addedNodes,
      removedNodes,
      addedEdges,
      removedEdges,
      addedFindings,
      fixedFindings,
    });
  } finally {
    db.close();
  }
}

async function apiPostPosition(req: IncomingMessage, res: ServerResponse, opts: ServeOptions): Promise<void> {
  const body = await readBody(req);
  const data = JSON.parse(body) as { path?: string; x?: number; y?: number; pinned?: boolean };
  if (!data.path || typeof data.x !== "number" || typeof data.y !== "number") {
    sendJson(res, 400, { error: "path, x, y required" });
    return;
  }
  const db = openDb({ file: opts.dbPath });
  try {
    setPosition(db, {
      nodePath: data.path,
      x: data.x,
      y: data.y,
      pinned: data.pinned ?? true,
      updatedBy: "ui",
    });
    sendJson(res, 200, { ok: true });
  } finally {
    db.close();
  }
}

async function apiPostAnnotation(req: IncomingMessage, res: ServerResponse, opts: ServeOptions): Promise<void> {
  const body = await readBody(req);
  const data = JSON.parse(body) as {
    path?: string;
    author?: string;
    body?: string;
    tags?: string[];
  };
  if (!data.path || !data.author || !data.body) {
    sendJson(res, 400, { error: "path, author, body required" });
    return;
  }
  const db = openDb({ file: opts.dbPath });
  try {
    const id = addAnnotation(db, {
      nodePath: data.path,
      author: data.author,
      body: data.body,
      tags: data.tags,
    });
    sendJson(res, 200, { id });
  } finally {
    db.close();
  }
}

async function apiPostScan(res: ServerResponse, opts: ServeOptions): Promise<void> {
  const started = Date.now();
  const graph = await buildGraph({ root: opts.root });
  const scanId = newScanId();
  const findings = runAllDetectors(graph, scanId);
  const db = openDb({ file: opts.dbPath });
  try {
    writeScan(db, { scanId, startedAt: started, graph, findings });
  } finally {
    db.close();
  }
  sendJson(res, 200, {
    scanId,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    findings: findings.length,
    durationMs: Date.now() - started,
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve_, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve_(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
