import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, posix, sep } from "node:path";

export interface MarkdownLink {
  rawTarget: string;
  /** Repo-relative target after resolution; same path even if the file does not exist. */
  resolvedTarget: string;
  /** True if `resolvedTarget` does not exist on disk. */
  broken: boolean;
  /** 1-indexed line number where the link was found. */
  line: number;
  /** Heuristic edge kind. */
  kind: "md-link" | "code-ref" | "wikilink";
}

export interface MarkdownFile {
  /** Repo-relative path with forward slashes. */
  path: string;
  /** Bytes-on-disk modified time. */
  lastModified: number;
  /** Word count outside fenced code blocks. */
  wordCount: number;
  /** Extracted outbound links. */
  links: MarkdownLink[];
}

export interface ScanOptions {
  /** Repo root (absolute path). Defaults to process.cwd(). */
  root?: string;
  /** Directory names to skip during traversal. */
  ignoreDirs?: ReadonlySet<string>;
  /** Memory directory for wikilink resolution (absolute or repo-relative). */
  memoryRoot?: string;
}

const DEFAULT_IGNORE_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-test",
  "build",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".cache",
  ".turbo",
  ".next",
  ".vite",
  "coverage",
  "runs",
  "data",
  ".code-review-graph",
]);

const MD_LINK_RE = /\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKILINK_RE = /\[\[([^\]\n|]+)(?:\|[^\]\n]+)?\]\]/g;
const FENCE_RE = /^\s*```/;

/** Walk the repo and return every .md file (repo-relative paths, forward slashes). */
export async function findMarkdownFiles(opts: ScanOptions = {}): Promise<string[]> {
  const root = opts.root ?? process.cwd();
  const ignore = opts.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const out: string[] = [];
  await walk(root, root, ignore, out);
  return out.sort();
}

async function walk(
  root: string,
  cur: string,
  ignore: ReadonlySet<string>,
  out: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(cur, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.isDirectory()) {
      // Allow well-known dotted dirs that hold docs we want to scan.
      const allow = new Set([
        ".agents",
        ".claude",
        ".codex",
        ".github",
        ".kiro",
      ]);
      if (!allow.has(e.name)) continue;
    }
    if (e.isDirectory()) {
      if (ignore.has(e.name)) continue;
      await walk(root, join(cur, e.name), ignore, out);
      continue;
    }
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith(".md")) continue;
    const rel = relative(root, join(cur, e.name)).split(sep).join("/");
    out.push(rel);
  }
}

/** Parse a single .md file at repo-relative path. */
export async function parseMarkdownFile(
  repoRelPath: string,
  opts: ScanOptions = {},
): Promise<MarkdownFile> {
  const root = opts.root ?? process.cwd();
  const abs = resolve(root, repoRelPath);
  const [body, st] = await Promise.all([readFile(abs, "utf8"), stat(abs)]);
  const lines = body.split(/\r?\n/);

  const wordCount = countWordsOutsideFences(lines);
  const links: MarkdownLink[] = [];

  // Track fenced code blocks so we don't extract links from examples.
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Markdown links [text](target)
    for (const m of line.matchAll(MD_LINK_RE)) {
      const target = (m[2] ?? "").trim();
      if (!target) continue;
      if (isExternal(target)) continue;
      if (target.startsWith("#")) continue; // intra-doc anchor
      if (target.startsWith("mailto:")) continue;
      if (target.startsWith("vscode://")) continue;
      const linkInfo = await resolveLink(target, repoRelPath, root);
      links.push({ ...linkInfo, line: i + 1 });
    }

    // Wikilinks [[slug]] — only meaningful inside the memory namespace
    if (opts.memoryRoot && isMemoryFile(repoRelPath, opts.memoryRoot)) {
      for (const m of line.matchAll(WIKILINK_RE)) {
        const slug = (m[1] ?? "").trim();
        if (!slug) continue;
        const candidate = join(opts.memoryRoot, slug.endsWith(".md") ? slug : `${slug}.md`);
        const exists = await pathExists(candidate);
        const rel = relative(root, candidate).split(sep).join("/");
        links.push({
          rawTarget: slug,
          resolvedTarget: rel,
          broken: !exists,
          line: i + 1,
          kind: "wikilink",
        });
      }
    }
  }

  return {
    path: repoRelPath,
    lastModified: st.mtimeMs,
    wordCount,
    links,
  };
}

async function resolveLink(
  target: string,
  fromRel: string,
  root: string,
): Promise<Omit<MarkdownLink, "line">> {
  // Strip URL fragment and query.
  const cleaned = target.split("#")[0]!.split("?")[0]!;
  if (!cleaned) {
    return { rawTarget: target, resolvedTarget: "", broken: true, kind: "md-link" };
  }
  const fromDir = dirname(fromRel);
  // posix-join + normalize since md links are always forward-slash.
  const resolvedPosix = posix.normalize(posix.join(fromDir, cleaned));
  // If the link goes above the repo root, treat as broken.
  if (resolvedPosix.startsWith("..")) {
    return { rawTarget: target, resolvedTarget: resolvedPosix, broken: true, kind: "md-link" };
  }
  const abs = join(root, resolvedPosix);
  const exists = await pathExists(abs);
  const kind: MarkdownLink["kind"] = cleaned.toLowerCase().endsWith(".md")
    ? "md-link"
    : "code-ref";
  return { rawTarget: target, resolvedTarget: resolvedPosix, broken: !exists, kind };
}

async function pathExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
}

function isExternal(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(target) || target.startsWith("//");
}

function isMemoryFile(repoRel: string, memoryRoot: string): boolean {
  // memoryRoot may be absolute or repo-relative; we only care about prefix match
  // of the *original* path used in scanning. Memory files live outside the repo
  // in the standard setup, so this is mostly a placeholder for future support.
  return repoRel.startsWith(memoryRoot);
}

function countWordsOutsideFences(lines: string[]): number {
  let inFence = false;
  let count = 0;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const words = line.match(/\S+/g);
    if (words) count += words.length;
  }
  return count;
}
