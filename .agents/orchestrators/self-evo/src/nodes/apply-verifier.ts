import { join } from "node:path";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Patch } from "../types.js";
import { runChecks } from "../tools/shell.js";
import {
  applyPatch,
  createWorktree,
  removeWorktree,
} from "../tools/worktree.js";
import type { VerifierConfig } from "./verifier.js";
import { layoutFor } from "../persistence/workspace.js";

export interface ApplyVerifierConfig extends VerifierConfig {
  /**
   * Where worktrees are created. Defaults to
   * `<workspaceRoot>/worktrees/<runId>`.
   */
  worktreeRoot?: string;
  /** Top-level entries to symlink from repoRoot → worktree. */
  symlinks?: readonly string[];
  /**
   * When true, the worktree is left on disk after the node finishes
   * so a human can `git diff` it. Default true — the cleanup happens
   * in `round-writer` (R-G) instead.
   */
  preserveWorktree?: boolean;
}

// R-I: implements `apply` mode. On `hitl.kind === "apply"` the graph
// routes here. We create a detached git worktree from current HEAD,
// `git apply` each accepted patch into it, re-run the verifier with
// `cwd = worktree`, and stamp the results onto state as
// `appliedVerification` + `appliedWorktree`. Each patch's `applied`
// flag is updated based on whether `git apply` succeeded for it.
//
// The worktree is left on disk by default — the human reviews the
// diff there before final approve. Round-writer (R-G) doesn't yet
// clean it up; that's an opt-in for a future round.
export function makeApplyVerifierNode(
  services: AgentServices,
  cfg: ApplyVerifierConfig,
) {
  return async function applyVerifierNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    if (state.patches.length === 0) {
      return {
        appliedVerification: {
          checks: [],
          failureExcerpts: ["[apply-verifier] no patches to apply; skipped"],
        },
      };
    }

    const layout = layoutFor(state.runId, services.workspaceRoot);
    const worktreePath =
      cfg.worktreeRoot ?? join(layout.runDir, "worktree");

    let handle;
    try {
      handle = await createWorktree({
        repoRoot: services.repoRoot,
        basePath: worktreePath,
        symlinks: cfg.symlinks,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        appliedVerification: {
          checks: [],
          failureExcerpts: [`[apply-verifier] worktree creation failed: ${msg}`],
        },
      };
    }

    const updatedPatches: Patch[] = [];
    const applyFailures: string[] = [];
    for (const p of state.patches) {
      const res = await applyPatch(handle.path, p.diff);
      if (res.ok) {
        updatedPatches.push({ ...p, applied: true });
      } else {
        applyFailures.push(`[apply ${p.path}] ${res.error ?? "(no stderr)"}`);
        updatedPatches.push({ ...p, applied: false });
      }
    }

    const channels =
      cfg.byChangeType[state.changeType ?? ""] ?? cfg.defaultChannels ?? ["lint"];

    const verifyLog = join(layout.runDir, "applied-verification.log");
    const result = await runChecks({
      channels: [...channels],
      cwd: handle.path,
      logPath: verifyLog,
      commands: cfg.commands,
      timeoutMs: cfg.timeoutMs,
    });

    // R-I default flip: undefined → preserve (the docstring promise);
    // only an explicit `preserveWorktree: false` triggers cleanup.
    // Found by round a: leaving the worktree around is essential for
    // the HITL reviewer to `git diff` the proposed change.
    const shouldRemove = cfg.preserveWorktree === false;
    if (shouldRemove) {
      try {
        await removeWorktree(services.repoRoot, handle.path);
      } catch {
        // best-effort cleanup; don't fail the stage
      }
    }

    return {
      patches: updatedPatches,
      appliedWorktree: shouldRemove ? undefined : handle.path,
      appliedVerification: {
        checks: result.checks,
        failureExcerpts: [...applyFailures, ...result.failureExcerpts],
      },
    };
  };
}
