import type { DocsGraph } from "../graph.js";
import type { Finding, EntityRecord, MentionRecord, CodeUsageRecord } from "../db.js";
import type { DictEntity } from "../entities/dictionary.js";
import type { Heading } from "../headings.js";
import { brokenRefs } from "./broken-refs.js";
import { orphans } from "./orphans.js";
import { roundReportPair } from "./round-report-pair.js";
import { crossTrack } from "./cross-track.js";
import { docVsCode } from "./doc-vs-code.js";
import { claimOrphan } from "./claim-orphan.js";

export function runAllDetectors(graph: DocsGraph, scanId: string): Finding[] {
  return [
    ...brokenRefs(graph, scanId),
    ...orphans(graph, scanId),
    ...roundReportPair(graph, scanId),
    ...crossTrack(graph, scanId),
  ];
}

export interface SemanticDetectorInput {
  graph: DocsGraph;
  headings: Heading[];
  entities: EntityRecord[];
  mentions: MentionRecord[];
  codeUsages: CodeUsageRecord[];
  dictById: Map<string, DictEntity>;
  root: string;
}

export async function runSemanticDetectors(
  input: SemanticDetectorInput,
  scanId: string,
): Promise<Finding[]> {
  const dvc = docVsCode(input, scanId);
  const co = await claimOrphan(input, scanId);
  return [...dvc, ...co];
}

export { brokenRefs, orphans, roundReportPair, crossTrack, docVsCode, claimOrphan };
