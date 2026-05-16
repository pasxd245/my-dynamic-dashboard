import { spawn } from "node:child_process";
import { mkdir, rm, symlink, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface WorktreeHandle {
  /** Absolute path to the worktree. */
  path: string;
  /** Detached HEAD revision the worktree was created from. */
  ref: string;
  /** Roots that we symlinked from <repoRoot> → <worktree>. */
  linkedRoots: readonly string[];
}

export interface CreateWorktreeOptions {
  repoRoot: string;
  /** Where to create the worktree dir. */
  basePath: string;
  /** Files/dirs to symlink from <repoRoot> → <worktree> (e.g. `node_modules`). */
  symlinks?: readonly string[];
}

export interface ApplyPatchResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_SYMLINKS = ["node_modules"];

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runGit(args: string[], cwd: string, stdin?: string): Promise<RunResult> {
  return new Promise((resolve_, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (c) => outChunks.push(Buffer.from(c)));
    child.stderr.on("data", (c) => errChunks.push(Buffer.from(c)));
    child.stdin.on("error", () => undefined);
    child.on("error", reject);
    child.on("close", (code) => {
      resolve_({
        code: code ?? 0,
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
      });
    });
    if (stdin !== undefined) {
      try {
        child.stdin.write(stdin);
        if (!stdin.endsWith("\n")) child.stdin.write("\n");
        child.stdin.end();
      } catch {
        // child already closed — close handler still fires.
      }
    } else {
      child.stdin.end();
    }
  });
}

async function safeSymlink(target: string, link: string): Promise<boolean> {
  try {
    const s = await stat(target);
    if (!s.isDirectory() && !s.isFile()) return false;
  } catch {
    return false;
  }
  await mkdir(dirname(link), { recursive: true });
  try {
    await symlink(target, link);
    return true;
  } catch {
    // existing link/file at destination → leave it, caller continues
    return false;
  }
}

/**
 * Resolve current HEAD revision. Returned ref is used to create a
 * detached worktree so a branch checkout in `repoRoot` doesn't move
 * what the worktree sees.
 */
async function headRev(repoRoot: string): Promise<string> {
  const r = await runGit(["rev-parse", "HEAD"], repoRoot);
  if (r.code !== 0) {
    throw new Error(`git rev-parse HEAD failed in ${repoRoot}: ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

/**
 * `git worktree add --detach <basePath> <ref>` against `repoRoot`,
 * then symlink any requested top-level entries (default
 * `node_modules`) from the repo into the worktree so pnpm scripts
 * resolve their deps. Returns a handle the caller passes to
 * `removeWorktree`.
 */
export async function createWorktree(opts: CreateWorktreeOptions): Promise<WorktreeHandle> {
  const repoRoot = resolve(opts.repoRoot);
  const path = resolve(opts.basePath);
  const ref = await headRev(repoRoot);
  await mkdir(dirname(path), { recursive: true });
  const r = await runGit(["worktree", "add", "--detach", path, ref], repoRoot);
  if (r.code !== 0) {
    throw new Error(`git worktree add failed: ${r.stderr.trim()}`);
  }
  const linkedRoots: string[] = [];
  for (const name of opts.symlinks ?? DEFAULT_SYMLINKS) {
    const target = join(repoRoot, name);
    const link = join(path, name);
    if (existsSync(link)) continue;
    if (await safeSymlink(target, link)) linkedRoots.push(name);
  }
  return { path, ref, linkedRoots };
}

/**
 * `git apply` a unified diff to the worktree. Returns
 * `{ ok: true }` on a clean apply, `{ ok: false, error }` otherwise.
 * Stderr is truncated to 300 chars so failure rows fit comfortably
 * in `state.json`.
 */
export async function applyPatch(
  worktree: string,
  diff: string,
): Promise<ApplyPatchResult> {
  const r = await runGit(["apply", "-"], worktree, diff);
  if (r.code === 0) return { ok: true };
  return { ok: false, error: r.stderr.trim().slice(0, 300) };
}

/**
 * Removes the worktree directory and prunes its git metadata. Idempotent
 * — succeeds even if `worktree` no longer exists.
 */
export async function removeWorktree(
  repoRoot: string,
  worktree: string,
): Promise<void> {
  if (existsSync(worktree)) {
    await runGit(["worktree", "remove", "--force", worktree], repoRoot);
  }
  // Defensive: if the worktree dir still exists (e.g. metadata was
  // already pruned), fall back to fs.rm so we don't leak a dir.
  if (existsSync(worktree)) {
    await rm(worktree, { recursive: true, force: true });
  }
  await runGit(["worktree", "prune"], repoRoot);
}
