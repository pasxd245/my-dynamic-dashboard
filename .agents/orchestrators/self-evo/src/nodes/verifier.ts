import { join } from "node:path";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Command } from "../tools/shell.js";
import { runChecks } from "../tools/shell.js";
import { layoutFor } from "../persistence/workspace.js";
import {
  applyPatch,
  createWorktree,
  removeWorktree,
} from "../tools/worktree.js";

export interface VerifierConfig {
  /** Channels to run when no per-changeType override matches. */
  defaultChannels: readonly string[];
  /** Per-changeType channels (e.g. `{ "doc": ["lint"] }`). */
  byChangeType: Readonly<Record<string, readonly string[]>>;
  /** Per-command timeout in ms. */
  timeoutMs?: number;
  /** Optional channel→commands override for tests. */
  commands?: Record<string, Command[]>;
  /**
   * When true (default) and the state carries proposed patches,
   * verifier creates a detached worktree, dry-applies each patch,
   * and runs checks against the post-patch tree — so the judge sees
   * real signal about whether the patches actually build.
   *
   * When false (or no patches in state), checks run against the live
   * repoRoot — fast path, but the judge gets pre-patch signal only.
   *
   * Fixes `selfEvoJudgeFalsePositiveOnUnappliedPatches` (2026-05-19).
   * Default true so the fix is on by default; tests that need the
   * pre-patch path can set false.
   */
  dryApply?: boolean;
  /** Top-level entries to symlink from repoRoot → dry-apply worktree. */
  dryApplySymlinks?: readonly string[];
}

// Rewritten 2026-05-19 to close `selfEvoJudgeFalsePositiveOnUnappliedPatches`.
// If the state carries patches AND `cfg.dryApply !== false`, create a
// detached worktree, `git apply` each patch into it, and run the
// configured checks against the worktree. Apply failures are
// surfaced in `failureExcerpts` so the judge can tell a patch set
// apart from a clean build. The worktree is cleaned up after the
// run — apply-verifier will create its own preserved worktree later
// when the human accepts apply at HITL.
//
// When the state has no patches OR `cfg.dryApply === false`, falls
// back to the original behavior (checks against `services.repoRoot`).
// Never throws — catastrophic spawn / git errors land as
// `status: "fail"` so HITL still sees the run.
export function makeVerifierNode(
  services: AgentServices,
  cfg: VerifierConfig,
) {
  return async function verifierNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const layout = layoutFor(state.runId, services.workspaceRoot);
    const changeType = state.changeType ?? "spike";
    const channels =
      cfg.byChangeType[changeType] ?? cfg.defaultChannels ?? ["lint"];

    const dryApplyEnabled = cfg.dryApply !== false;
    const hasPatches = state.patches.length > 0;

    // Fast path — no patches to apply OR dryApply disabled.
    if (!hasPatches || !dryApplyEnabled) {
      const result = await runChecks({
        channels: [...channels],
        cwd: services.repoRoot,
        logPath: layout.verificationLog,
        commands: cfg.commands,
        timeoutMs: cfg.timeoutMs,
      });
      return {
        verification: {
          checks: result.checks,
          failureExcerpts: result.failureExcerpts,
        },
      };
    }

    // Dry-apply path — create a throwaway worktree, apply, check, clean up.
    const worktreePath = join(layout.runDir, "verifier-worktree");
    let handle;
    try {
      handle = await createWorktree({
        repoRoot: services.repoRoot,
        basePath: worktreePath,
        symlinks: cfg.dryApplySymlinks,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        verification: {
          checks: [],
          failureExcerpts: [`[verifier] worktree creation failed: ${msg}`],
        },
      };
    }

    const applyFailures: string[] = [];
    for (const p of state.patches) {
      const res = await applyPatch(handle.path, p.diff);
      if (!res.ok) {
        applyFailures.push(`[apply ${p.path}] ${res.error ?? "(no stderr)"}`);
      }
    }

    const result = await runChecks({
      channels: [...channels],
      cwd: handle.path,
      logPath: layout.verificationLog,
      commands: cfg.commands,
      timeoutMs: cfg.timeoutMs,
    });

    try {
      await removeWorktree(services.repoRoot, handle.path);
    } catch {
      // best-effort cleanup; don't fail the stage
    }

    return {
      verification: {
        checks: result.checks,
        failureExcerpts: [...applyFailures, ...result.failureExcerpts],
      },
    };
  };
}
