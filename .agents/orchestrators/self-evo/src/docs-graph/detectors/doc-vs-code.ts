import type { Finding, EntityRecord, MentionRecord, CodeUsageRecord } from "../db.js";
import type { DictEntity } from "../entities/dictionary.js";

export interface DocVsCodeInput {
  entities: EntityRecord[];
  mentions: MentionRecord[];
  codeUsages: CodeUsageRecord[];
  dictById: Map<string, DictEntity>;
}

const MIN_DOC_MENTIONS = 3;
const MAX_CODE_USAGES = 1;

export function docVsCode(input: DocVsCodeInput, scanId: string): Finding[] {
  const docMentionsBy = countBy(input.mentions, (m) => m.entityId);
  const codeUsagesBy = countBy(input.codeUsages, (u) => u.entityId);
  const out: Finding[] = [];
  for (const e of input.entities) {
    const dictEntry = input.dictById.get(e.id);
    if (!dictEntry || dictEntry.codeHints.length === 0) continue;
    const docs = docMentionsBy.get(e.id) ?? 0;
    const code = codeUsagesBy.get(e.id) ?? 0;
    if (docs < MIN_DOC_MENTIONS) continue;
    if (code > MAX_CODE_USAGES) continue;
    out.push({
      scanId,
      detector: "doc-vs-code",
      nodePath: null,
      severity: "warn",
      body: `${e.display}: docs mention=${docs}, code usage=${code} (hints: ${dictEntry.codeHints.join(", ")})`,
    });
  }
  return out;
}

function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
