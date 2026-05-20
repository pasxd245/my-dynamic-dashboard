import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Finding } from "../db.js";
import type { DocsGraph } from "../graph.js";
import type { Heading } from "../headings.js";

// Words that suggest a feature is claimed complete inside the heading's body.
// `✅` is intentionally excluded — agent process docs use it for checklist
// items, not feature claims, which produced too many false positives.
const CLAIM_TOKENS = [
  "status: complete",
  "status: shipped",
  "status: delivered",
  "fully implemented",
  "ready for production",
  "production-ready",
];

// Only kinds where "this feature exists" claims are load-bearing. Skills,
// READMEs, runbooks, memories use claim language without implying code.
const CLAIM_KINDS = new Set(["spec", "round", "meta", "report"]);

export interface ClaimOrphanInput {
  graph: DocsGraph;
  headings: Heading[];
  root: string;
}

/**
 * Flag heading sections whose body asserts the feature is delivered but whose
 * outbound links are all either broken or only md-links (no actual code-ref).
 * The strong signal is: claim language + no code-ref evidence in the section.
 */
export async function claimOrphan(input: ClaimOrphanInput, scanId: string): Promise<Finding[]> {
  const out: Finding[] = [];
  const fileKind = new Map<string, string>();
  for (const n of input.graph.nodes) {
    if (!n.parentPath) fileKind.set(n.path, n.kind);
  }
  // Group structural edges by source file to look up by-file outbound kinds.
  const outboundsByFile = new Map<string, Array<{ kind: string; broken: boolean }>>();
  for (const e of input.graph.edges) {
    if (e.kind === "child-of" || e.kind === "pair") continue;
    const arr = outboundsByFile.get(e.src) ?? [];
    arr.push({ kind: e.kind, broken: e.broken });
    outboundsByFile.set(e.src, arr);
  }
  // For each file with headings, read once and check each heading's body.
  const headingsByFile = new Map<string, Heading[]>();
  for (const h of input.headings) {
    const arr = headingsByFile.get(h.filePath) ?? [];
    arr.push(h);
    headingsByFile.set(h.filePath, arr);
  }
  for (const [filePath, headings] of headingsByFile) {
    const kind = fileKind.get(filePath);
    if (!kind || !CLAIM_KINDS.has(kind)) continue; // Only flag spec/round/meta/report.
    const outbounds = outboundsByFile.get(filePath) ?? [];
    const hasCodeRef = outbounds.some((e) => e.kind === "code-ref" && !e.broken);
    if (hasCodeRef) continue; // The file backs at least one claim with a real code ref.
    let body: string;
    try {
      body = await readFile(resolve(input.root, filePath), "utf8");
    } catch {
      continue;
    }
    const sections = splitIntoSections(body, headings);
    for (const { heading, text } of sections) {
      const lower = text.toLowerCase();
      const matched = CLAIM_TOKENS.find((t) => lower.includes(t.toLowerCase()));
      if (!matched) continue;
      out.push({
        scanId,
        detector: "claim-orphan",
        nodePath: heading.id,
        severity: "error",
        body: `${heading.id} claims "${matched}" but the file has no working code-ref to back it`,
      });
    }
  }
  return out;
}

function splitIntoSections(body: string, headings: Heading[]): Array<{ heading: Heading; text: string }> {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ heading: Heading; text: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    const next = headings[i + 1];
    const start = h.line; // 1-indexed; skip the heading line itself
    const end = next ? next.line - 1 : lines.length;
    const text = lines.slice(start, end).join("\n");
    sections.push({ heading: h, text });
  }
  return sections;
}
