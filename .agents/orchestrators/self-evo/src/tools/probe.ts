import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// R-L: tool-grounded probes for the repo-scanner. Today repo-scanner
// is happy to invent findings the LLM thinks are plausible (the first
// real round produced six confident lint complaints about a file that
// lints clean). These probes return real, verifiable evidence so the
// scanner can ground its findings instead of imagining them.

export interface ProbeResult {
  tool: "lint" | "file-read" | "ripgrep-empty";
  source: string;
  content: string;
}

const DOC_TOPIC_KEYWORDS = [
  "lint", "format", "markdown", ".md", "rollout", "readme",
  "prettier", "docs", "documentation", "typo",
];

export function detectDocTopic(topic: string, requirements: string[]): boolean {
  const corpus = [topic, ...requirements].join(" ").toLowerCase();
  return DOC_TOPIC_KEYWORDS.some((kw) => corpus.includes(kw));
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCmd(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs = 30_000,
): Promise<RunResult> {
  return new Promise((resolveP) => {
    const child = spawn(bin, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (c) => out.push(Buffer.from(c)));
    child.stderr.on("data", (c) => err.push(Buffer.from(c)));
    child.on("error", () => {
      clearTimeout(timer);
      resolveP({ code: 127, stdout: "", stderr: "spawn error" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({
        code: timedOut ? 124 : code ?? 0,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
  });
}

/**
 * Run `pnpm exec markdownlint-cli2` against the named .md files inside
 * `repoRoot`. Returns the raw stdout+stderr trimmed to a few KB so the
 * LLM prompt stays manageable. Empty result with `content: ""` means
 * the linter passed on every candidate.
 */
export async function probeLint(
  candidatePaths: readonly string[],
  repoRoot: string,
  maxChars = 4000,
): Promise<ProbeResult | undefined> {
  const mds = candidatePaths
    .filter((p) => /\.md$/i.test(p))
    .filter((p) => existsSync(resolve(repoRoot, p)));
  if (mds.length === 0) return undefined;
  const result = await runCmd(
    "pnpm",
    ["exec", "markdownlint-cli2", ...mds],
    repoRoot,
  );
  const combined = (result.stdout + "\n" + result.stderr).trim();
  // Exit 0 → all clean; we still surface that as the *evidence*.
  if (result.code === 0) {
    return {
      tool: "lint",
      source: mds.join(", "),
      content: "markdownlint-cli2 exit 0 — no issues reported",
    };
  }
  return {
    tool: "lint",
    source: mds.join(", "),
    content: combined.slice(0, maxChars) +
      (combined.length > maxChars ? "\n...(truncated)" : ""),
  };
}

/**
 * Read up to `maxChars` from each file. Returns one ProbeResult per
 * file that exists and is non-empty.
 */
export async function probeFileRead(
  paths: readonly string[],
  repoRoot: string,
  maxChars = 2000,
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const p of paths.slice(0, 4)) {
    const abs = resolve(repoRoot, p);
    if (!existsSync(abs)) continue;
    try {
      const s = await stat(abs);
      if (!s.isFile()) continue;
      const raw = await readFile(abs, "utf8");
      out.push({
        tool: "file-read",
        source: p,
        content:
          raw.slice(0, maxChars) +
          (raw.length > maxChars ? "\n...(truncated)" : ""),
      });
    } catch {
      // Skip unreadable files silently — the LLM gets less context
      // for them, which is fine.
    }
  }
  return out;
}

export function renderProbes(probes: readonly ProbeResult[]): string {
  if (probes.length === 0) return "(no tool probes available)";
  return probes
    .map(
      (p) =>
        `--- [${p.tool}] ${p.source} ---\n${p.content || "(empty output)"}\n`,
    )
    .join("\n");
}
