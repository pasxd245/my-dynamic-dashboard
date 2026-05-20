import type { DocsGraph } from "../graph.js";
import type { Finding } from "../db.js";

export function brokenRefs(graph: DocsGraph, scanId: string): Finding[] {
  const out: Finding[] = [];
  for (const e of graph.edges) {
    if (!e.broken) continue;
    out.push({
      scanId,
      detector: "broken-refs",
      nodePath: e.src,
      severity: "error",
      body: `${e.src}:${e.line} → ${e.dst} (target not found)`,
    });
  }
  return out;
}
