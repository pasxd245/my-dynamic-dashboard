import { spawn } from "node:child_process";
import { minimatch } from "minimatch";

export interface ApplyCheckResult {
  ok: boolean;
  /** First ~300 chars of stderr when ok = false. */
  error?: string;
}

/**
 * Extract the target path from a unified diff. Reads the `+++ b/path`
 * line, stripping the `b/` (or `a/`) prefix. Returns `undefined` when
 * the diff header is malformed — the caller should treat that as a
 * reject signal.
 */
export function extractPathFromDiff(diff: string): string | undefined {
  for (const line of diff.split(/\r?\n/, 64)) {
    if (!line.startsWith("+++ ")) continue;
    const path = line.slice(4).trim();
    // Skip /dev/null (file-deletion). For dry-run R-E we only land
    // edits and additions, not deletions.
    if (path === "/dev/null") return undefined;
    if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
    return path;
  }
  return undefined;
}

/**
 * True when `path` matches at least one of the configured glob
 * patterns. Patterns are minimatch-style — same dialect callers
 * already know from `.gitignore` / `pnpm-workspace.yaml`. An empty
 * `globs` list rejects everything (fail-closed).
 */
export function withinBoundary(path: string, globs: readonly string[]): boolean {
  if (globs.length === 0) return false;
  return globs.some((g) => minimatch(path, g, { dot: true }));
}

/**
 * Spawns `git apply --check` against `cwd`, piping the diff to stdin.
 * Returns `{ ok: true }` when the diff would apply cleanly, otherwise
 * `{ ok: false, error }` with the first chunk of stderr. The repo
 * itself is never modified — `--check` is read-only.
 */
export async function gitApplyCheck(diff: string, cwd: string): Promise<ApplyCheckResult> {
  return runGitApply(diff, cwd, ["apply", "--check", "-"]);
}

function runGitApply(
  diff: string,
  cwd: string,
  args: string[],
): Promise<ApplyCheckResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stderrChunks: Buffer[] = [];
    child.stderr.on("data", (c) => stderrChunks.push(Buffer.from(c)));
    child.stdin.on("error", () => undefined);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ ok: true });
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      resolve({ ok: false, error: stderr.slice(0, 300) });
    });
    try {
      child.stdin.write(diff);
      if (!diff.endsWith("\n")) child.stdin.write("\n");
      child.stdin.end();
    } catch {
      // child already closed — close handler still fires.
    }
  });
}
