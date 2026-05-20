import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface Heading {
  /** Source file (repo-relative). */
  filePath: string;
  /** Heading depth, 1..6. */
  depth: number;
  /** Heading text after the leading hashes. */
  text: string;
  /** GitHub-style slug. */
  anchor: string;
  /** 1-indexed line number. */
  line: number;
  /** "filePath#anchor", unique within a file. Suffixed -2, -3, … on collisions. */
  id: string;
}

const ATX_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^\s*```/;

export async function parseHeadings(repoRelPath: string, root: string): Promise<Heading[]> {
  const body = await readFile(resolve(root, repoRelPath), "utf8");
  const lines = body.split(/\r?\n/);
  const out: Heading[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(ATX_RE);
    if (!m) continue;
    const depth = m[1]!.length;
    const text = m[2]!.trim();
    const baseSlug = slugify(text);
    if (!baseSlug) continue;
    const n = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, n + 1);
    const anchor = n === 0 ? baseSlug : `${baseSlug}-${n + 1}`;
    out.push({
      filePath: repoRelPath,
      depth,
      text,
      anchor,
      line: i + 1,
      id: `${repoRelPath}#${anchor}`,
    });
  }
  return out;
}

// GitHub-compatible slugifier. Lowercase, remove punctuation except hyphens,
// collapse whitespace to single hyphen.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N} \-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}
