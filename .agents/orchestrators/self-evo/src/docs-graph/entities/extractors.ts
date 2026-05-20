import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DictEntity, EntityDictionary } from "./dictionary.js";
import type { EntityRecord, MentionRecord } from "../db.js";
import type { MarkdownFile } from "../parser.js";

const FENCE_RE = /^\s*```/;

export interface ExtractResult {
  entities: EntityRecord[];
  mentions: MentionRecord[];
}

/**
 * Dictionary extractor — deterministic. For each file body, scan each line
 * outside fenced code blocks for any alias (matched with word boundaries to
 * avoid `polars` ⊂ `polarsworld`-style false positives). Emits one mention
 * per match.
 */
export async function extractWithDictionary(
  files: MarkdownFile[],
  dict: EntityDictionary,
  root: string,
): Promise<ExtractResult> {
  const matchers = buildMatchers(dict);
  const mentions: MentionRecord[] = [];
  const hitEntities = new Set<string>();

  for (const f of files) {
    const abs = resolve(root, f.path);
    let body: string;
    try {
      body = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const lines = body.split(/\r?\n/);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      for (const m of matchers) {
        m.re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = m.re.exec(line)) !== null) {
          mentions.push({
            entityId: m.entity.id,
            nodePath: f.path,
            line: i + 1,
            surface: match[0],
            source: "dict",
          });
          hitEntities.add(m.entity.id);
        }
      }
    }
  }

  const entities: EntityRecord[] = dict.entities
    .filter((e) => hitEntities.has(e.id))
    .map((e) => ({ id: e.id, display: e.display, kind: e.kind }));

  return { entities, mentions };
}

interface Matcher {
  entity: DictEntity;
  re: RegExp;
}

function buildMatchers(dict: EntityDictionary): Matcher[] {
  return dict.entities.map((e) => {
    // Sort aliases by length desc so longer phrases match before shorter
    // substrings ("@mdd/ui" before "ui").
    const aliases = [...new Set(e.aliases)].sort((a, b) => b.length - a.length);
    const escaped = aliases.map(escapeRe).join("|");
    // Word-boundary-ish guard: not preceded/followed by an alphanumeric.
    // We don't use \b because aliases may contain non-word chars ("@mdd/ui").
    const re = new RegExp(`(?<![A-Za-z0-9_])(?:${escaped})(?![A-Za-z0-9_])`, "g");
    return { entity: e, re };
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * LLM extractor stub — Meta_10 plumbs the `--llm-entities` flag through to
 * here, but actual LLM extraction is deferred until self-evo's LLMResolver
 * is threaded into the docs-graph CLI. Throwing makes the gap explicit;
 * callers can catch and fall back to dict-only.
 */
export function extractWithLLM(): Promise<ExtractResult> {
  return Promise.reject(
    new Error(
      "LLM entity extraction is not yet wired into docs-graph CLI. " +
        "Dictionary extraction works without --llm-entities.",
    ),
  );
}
