import type { DocsGraph } from "../graph.js";
import type { Finding } from "../db.js";
import { ROOT_NODES } from "../classifier.js";

export function orphans(graph: DocsGraph, scanId: string): Finding[] {
  const out: Finding[] = [];
  for (const n of graph.nodes) {
    if (n.parentPath) continue; // heading nodes — parent file is the orphan unit
    if (n.inboundRefs > 0) continue;
    if (ROOT_NODES.has(n.path)) continue;
    // Memory files live outside the repo in the standard layout — most won't appear
    // here, but if they do they're root-level by convention.
    if (n.kind === "memory") continue;
    out.push({
      scanId,
      detector: "orphans",
      nodePath: n.path,
      severity: "warn",
      body: `${n.path} has no inbound link (track=${n.track}, kind=${n.kind})`,
    });
  }
  return out;
}
