import type { LLMResolver } from "./llm/resolver.js";
import type { Mem0ClientLike } from "./memory/types.js";

// Services injected into every node. The same shape is used by tests
// (where `resolver.for(...)` returns a fake LLM) and by the real CLI
// (where `resolver` reads `config/llm.yaml`). Future rounds extend
// this object — R-D adds the Mem0 client, R-F adds the shell runner.
export interface AgentServices {
  resolver: LLMResolver;
  /** Root directory of `.agents/skills/`. Resolved against cwd. */
  skillsRoot: string;
  /** Repo root used by ripgrep / patch tools. Defaults to cwd. */
  repoRoot: string;
  /**
   * Workspaces root — every run's artefacts live at
   * `<workspaceRoot>/<runId>/`. The patch-author writes diffs under
   * `<workspaceRoot>/<runId>/patches/` here.
   */
  workspaceRoot: string;
  /** Cross-round memory. Undefined ≡ memory disabled. */
  memory?: Mem0ClientLike;
}
