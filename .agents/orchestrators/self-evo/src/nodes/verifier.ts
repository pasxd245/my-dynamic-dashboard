import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Command } from "../tools/shell.js";
import { runChecks } from "../tools/shell.js";
import { layoutFor } from "../persistence/workspace.js";

export interface VerifierConfig {
  /** Channels to run when no per-changeType override matches. */
  defaultChannels: readonly string[];
  /** Per-changeType channels (e.g. `{ "doc": ["lint"] }`). */
  byChangeType: Readonly<Record<string, readonly string[]>>;
  /** Per-command timeout in ms. */
  timeoutMs?: number;
  /** Optional channel→commands override for tests. */
  commands?: Record<string, Command[]>;
}

// Rewritten in R-F. Picks the channel set from
// `config.verify.byChangeType[state.changeType]` (falling back to
// `defaultChannels`), runs each channel's commands via
// `tools/shell.runChecks`, captures pass/fail + tail excerpts, writes
// a full log to `runs/<runId>/verification.log`. Never throws — even
// catastrophic spawn errors land as `status: "fail"` so HITL still
// sees the run.
export function makeVerifierNode(
  services: AgentServices,
  cfg: VerifierConfig,
) {
  return async function verifierNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const layout = layoutFor(state.runId, services.workspaceRoot);
    const changeType = state.changeType ?? "spike";
    const channels =
      cfg.byChangeType[changeType] ?? cfg.defaultChannels ?? ["lint"];

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
  };
}
