import type { DocsGraph } from "../graph.js";
import type { Finding } from "../db.js";
import { ROOT_NODES } from "../classifier.js";

export function crossTrack(graph: DocsGraph, scanId: string): Finding[] {
  const nodeTrack = new Map<string, string>();
  for (const n of graph.nodes) nodeTrack.set(n.path, n.track);

  const out: Finding[] = [];
  for (const e of graph.edges) {
    if (e.broken) continue;
    if (e.kind === "pair") continue;
    if (ROOT_NODES.has(e.dst)) continue; // linking into universal roots is fine
    const ts = nodeTrack.get(e.src);
    const td = nodeTrack.get(e.dst);
    if (!ts || !td) continue;
    if (ts === td) continue;
    if (ts === "unknown" || td === "unknown") continue;
    out.push({
      scanId,
      detector: "cross-track",
      nodePath: e.src,
      severity: "info",
      body: `${e.src}:${e.line} (${ts}) → ${e.dst} (${td})`,
    });
  }
  return out;
}
