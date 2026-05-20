import { ripgrep, ripgrepAvailable } from "../../tools/ripgrep.js";
import type { CodeUsageRecord } from "../db.js";
import type { EntityDictionary } from "./dictionary.js";

const CODE_GLOBS = [
  "apps/**",
  "packages/**",
  "devops/**",
  ".agents/orchestrators/**",
  "!**/dist/**",
  "!**/dist-test/**",
  "!**/node_modules/**",
  "!**/.code-review-graph/**",
];

/**
 * For each entity with code hints, ripgrep them across the source dirs and
 * record one CodeUsageRecord per match (capped per hint to avoid runaway
 * counts on common substrings).
 */
export async function scanCodeUsages(
  dict: EntityDictionary,
  root: string,
): Promise<CodeUsageRecord[]> {
  if (!(await ripgrepAvailable())) {
    // No rg → return empty. Detectors that need code counts will gracefully
    // emit "unknown" instead of "drifted".
    return [];
  }
  const out: CodeUsageRecord[] = [];
  for (const e of dict.entities) {
    if (!e.codeHints || e.codeHints.length === 0) continue;
    for (const hint of e.codeHints) {
      const hits = await ripgrep(escapeRgRegex(hint), {
        cwd: root,
        globs: CODE_GLOBS,
        limit: 200,
        includeHidden: true,
        maxCount: 50,
      });
      for (const h of hits) {
        out.push({
          entityId: e.id,
          filePath: h.path,
          line: h.line,
          surface: h.text.slice(0, 200),
        });
      }
    }
  }
  return out;
}

// Escape regex specials for ripgrep's Rust regex dialect (same special set
// as PCRE for our purposes).
function escapeRgRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
