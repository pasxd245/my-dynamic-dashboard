import { interrupt } from "@langchain/langgraph";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { HitlDecision } from "../types.js";
import { layoutFor } from "../persistence/workspace.js";

export interface HitlPayload {
  runId: string;
  statePath: string;
  patchesDir: string;
  prompt: string;
}

const PROMPT = "approve | revise <stage> [note] | quit";

// The HITL node throws GraphInterrupt the first time it runs and
// returns the resumed HitlDecision the second time. The CLI loop
// catches the interrupt, prints `paths.statePath` + `prompt`, reads
// the human's reply, parses it into a HitlDecision, and resumes the
// graph via `Command({ resume: decision })`.
export function makeHitlNode(_services: AgentServices) {
  return async function hitlNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const layout = layoutFor(state.runId);
    const payload: HitlPayload = {
      runId: state.runId,
      statePath: layout.statePath,
      patchesDir: layout.patchesDir,
      prompt: PROMPT,
    };
    const decision = interrupt<HitlPayload, HitlDecision>(payload);
    return { hitl: decision };
  };
}
