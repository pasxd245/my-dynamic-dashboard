import type { DocsGraph } from "../graph.js";
import type { Finding } from "../db.js";

export function roundReportPair(graph: DocsGraph, scanId: string): Finding[] {
  const out: Finding[] = [];
  const rounds = new Map<string, string>(); // base -> path
  const reports = new Map<string, string>();
  for (const n of graph.nodes) {
    const basename = n.path.split("/").pop() ?? "";
    const m = basename.match(/^(Round_\d+|Meta_\d+)/);
    if (!m) continue;
    const base = m[1]!;
    if (n.path.endsWith(".report.md")) reports.set(base, n.path);
    else if (n.kind === "round" || n.kind === "meta") rounds.set(base, n.path);
  }
  for (const [base, roundPath] of rounds) {
    if (!reports.has(base)) {
      out.push({
        scanId,
        detector: "round-report-pair",
        nodePath: roundPath,
        severity: "warn",
        body: `${roundPath} has no matching ${base}.report.md`,
      });
    }
  }
  for (const [base, reportPath] of reports) {
    if (!rounds.has(base)) {
      out.push({
        scanId,
        detector: "round-report-pair",
        nodePath: reportPath,
        severity: "warn",
        body: `${reportPath} has no matching round file for ${base}`,
      });
    }
  }
  return out;
}
