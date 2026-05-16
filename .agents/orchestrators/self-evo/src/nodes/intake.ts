import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { PriorMemory } from "../types.js";
import { SELF_EVO_USER_ID } from "../memory/types.js";

const MAX_PRIOR_MEMORIES = 5;

function memoryQuery(state: SelfEvoStateT): string {
  return [state.topic, ...state.requirements.map((r) => r.text)]
    .filter((s) => s && s.length > 0)
    .join(" ");
}

// Intake normalises the CLI input AND surfaces prior-round memories
// matching the topic — populated only when `services.memory` is wired
// (R-D onwards). Downstream nodes can read `state.priorMemories` to
// avoid relitigating decisions the user already approved.
export function makeIntakeNode(services: AgentServices) {
  return async function intakeNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const requirements = (state.requirements ?? []).map((r, i) => ({
      id: r.id || `R${String(i + 1).padStart(2, "0")}`,
      text: (r.text ?? "").trim(),
    }));

    let priorMemories: PriorMemory[] = [];
    if (services.memory) {
      const hits = await services.memory.search(
        memoryQuery({ ...state, requirements }),
        { user_id: SELF_EVO_USER_ID, limit: MAX_PRIOR_MEMORIES },
      );
      priorMemories = hits.map((h) => ({
        id: h.id,
        text: h.text,
        score: h.score ?? 0,
      }));
    }

    return {
      runId: state.runId,
      topic: (state.topic ?? "").trim(),
      requirements,
      priorMemories,
    };
  };
}
