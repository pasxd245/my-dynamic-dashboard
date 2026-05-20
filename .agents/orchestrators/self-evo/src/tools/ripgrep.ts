import { spawn } from "node:child_process";

export interface RipgrepHit {
  path: string;
  line: number;
  text: string;
}

export interface RipgrepOptions {
  /** Search root, relative or absolute. Default `process.cwd()`. */
  cwd?: string;
  /** Glob includes; defaults to a sensible code-only allowlist. */
  globs?: string[];
  /** Max hits returned (truncated client-side). Default 80. */
  limit?: number;
  /** Path to the ripgrep binary. Default `rg`. */
  binary?: string;
  /** Pass --hidden so dot-dirs (e.g. `.agents/`) are searched. */
  includeHidden?: boolean;
  /** Per-file max-count (default 5). */
  maxCount?: number;
}

const DEFAULT_GLOBS = [
  "apps/**",
  "src/**",
  ".agents/context/**",
  ".agents/plan/**",
  "scripts/**",
  "config/**",
  "*.{md,ts,tsx,js,jsx,py,sh}",
];

// Returns ripgrep JSON-lines hits as a flat array. Non-zero exit codes
// other than "no matches" are surfaced as a thrown error — the caller
// usually wants to know if rg itself is misconfigured.
export async function ripgrep(
  pattern: string,
  opts: RipgrepOptions = {},
): Promise<RipgrepHit[]> {
  const cwd = opts.cwd ?? process.cwd();
  const limit = opts.limit ?? 80;
  const globs = opts.globs ?? DEFAULT_GLOBS;
  const maxCount = opts.maxCount ?? 5;
  const args = ["--json", "--max-count", String(maxCount), "--no-messages"];
  if (opts.includeHidden) args.push("--hidden");
  for (const g of globs) args.push("--glob", g);
  args.push(pattern);

  const child = spawn(opts.binary ?? "rg", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  child.stdout.on("data", (c) => chunks.push(Buffer.from(c)));
  child.stderr.on("data", (c) => errChunks.push(Buffer.from(c)));
  const code: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (c) => resolve(c ?? 0));
  });
  // rg exits 1 when there are no matches — treat as empty result.
  if (code !== 0 && code !== 1) {
    const stderr = Buffer.concat(errChunks).toString("utf8");
    throw new Error(`ripgrep exited ${code}: ${stderr.slice(0, 300)}`);
  }
  const lines = Buffer.concat(chunks).toString("utf8").split(/\n/).filter(Boolean);
  const hits: RipgrepHit[] = [];
  for (const line of lines) {
    let evt: { type?: string; data?: { path?: { text?: string }; line_number?: number; lines?: { text?: string } } };
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type !== "match" || !evt.data) continue;
    const path = evt.data.path?.text;
    const lineNumber = evt.data.line_number;
    const text = evt.data.lines?.text?.trim() ?? "";
    if (!path || !lineNumber) continue;
    hits.push({ path, line: lineNumber, text });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function ripgrepAvailable(binary = "rg"): Promise<boolean> {
  try {
    const child = spawn(binary, ["--version"], { stdio: "ignore" });
    const code: number = await new Promise((resolve) => {
      child.on("error", () => resolve(127));
      child.on("close", (c) => resolve(c ?? 0));
    });
    return code === 0;
  } catch {
    return false;
  }
}
