import { findMarkdownFiles, parseMarkdownFile, type MarkdownFile, type ScanOptions } from "./parser.js";
import { inferKind, inferTrack, type Kind, type Track } from "./classifier.js";
import { parseHeadings, type Heading } from "./headings.js";

export interface GraphNode {
  path: string;
  track: Track;
  kind: Kind;
  lastModified: number;
  wordCount: number;
  outboundRefs: number;
  inboundRefs: number;
  /** Parent file path for heading nodes; null for file nodes. */
  parentPath?: string | null;
  /** 0 for file nodes; 1..6 for heading nodes. */
  depth?: number;
  /** Heading slug; null for file nodes. */
  anchor?: string | null;
}

export interface GraphEdge {
  src: string;
  dst: string;
  kind: "md-link" | "code-ref" | "wikilink" | "pair" | "child-of";
  line: number;
  broken: boolean;
}

export interface DocsGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BuildGraphOptions extends ScanOptions {
  /** Include heading-level nodes (and child-of edges to their file). */
  includeHeadings?: boolean;
}

/** Build the full graph from a repo root. */
export async function buildGraph(opts: BuildGraphOptions = {}): Promise<DocsGraph> {
  const files = await findMarkdownFiles(opts);
  const parsed: MarkdownFile[] = [];
  for (const f of files) parsed.push(await parseMarkdownFile(f, opts));
  const headings: Heading[] = [];
  if (opts.includeHeadings) {
    const root = opts.root ?? process.cwd();
    for (const f of files) {
      const hs = await parseHeadings(f, root);
      for (const h of hs) headings.push(h);
    }
  }
  return assembleGraph(parsed, headings);
}

/** Pure assembly step — given parsed files (+ optional headings), produce nodes + edges + counts. */
export function assembleGraph(files: MarkdownFile[], headings: Heading[] = []): DocsGraph {
  const inbound = new Map<string, number>();
  const edges: GraphEdge[] = [];
  for (const f of files) {
    for (const l of f.links) {
      edges.push({
        src: f.path,
        dst: l.resolvedTarget,
        kind: l.kind,
        line: l.line,
        broken: l.broken,
      });
      if (!l.broken) {
        inbound.set(l.resolvedTarget, (inbound.get(l.resolvedTarget) ?? 0) + 1);
      }
    }
  }

  const nodes: GraphNode[] = files.map((f) => ({
    path: f.path,
    track: inferTrack(f.path),
    kind: inferKind(f.path),
    lastModified: f.lastModified,
    wordCount: f.wordCount,
    outboundRefs: f.links.length,
    inboundRefs: inbound.get(f.path) ?? 0,
    parentPath: null,
    depth: 0,
    anchor: null,
  }));

  // Heading nodes are children of their file. We piggyback on the existing
  // GraphNode shape: track/kind inherit from the parent file; word_count is
  // unused for headings (kept 0). Anchor edge is kind "child-of".
  const fileByPath = new Map(nodes.map((n) => [n.path, n]));
  for (const h of headings) {
    const parent = fileByPath.get(h.filePath);
    if (!parent) continue;
    nodes.push({
      path: h.id,
      track: parent.track,
      kind: parent.kind,
      lastModified: parent.lastModified,
      wordCount: 0,
      outboundRefs: 0,
      inboundRefs: 0,
      parentPath: h.filePath,
      depth: h.depth,
      anchor: h.anchor,
    });
    edges.push({
      src: h.filePath,
      dst: h.id,
      kind: "child-of",
      line: h.line,
      broken: false,
    });
  }

  // Synthetic pair edges: Round_NN.md <-> Round_NN.report.md (same for Meta_NN).
  const byBase = new Map<string, string[]>(); // base ("Round_07") -> all matching paths
  for (const n of nodes) {
    const base = pairBase(n.path);
    if (!base) continue;
    const arr = byBase.get(base) ?? [];
    arr.push(n.path);
    byBase.set(base, arr);
  }
  for (const [_, paths] of byBase) {
    if (paths.length < 2) continue;
    const round = paths.find((p) => !p.endsWith(".report.md"));
    const report = paths.find((p) => p.endsWith(".report.md"));
    if (round && report) {
      edges.push({ src: round, dst: report, kind: "pair", line: 0, broken: false });
    }
  }

  return { nodes, edges };
}

function pairBase(p: string): string | null {
  const basename = p.split("/").pop() ?? "";
  const m = basename.match(/^(Round_\d+|Meta_\d+)/);
  return m ? m[1]! : null;
}
