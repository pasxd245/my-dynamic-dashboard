import type { RevertTarget } from "../types.js";
import type { SelfEvoUpdate } from "../state.js";

// Pipeline topological order. Reverting to a stage resets that stage's
// outputs *and every stage downstream of it* — same invariant as
// orchestrator/hitl.ts in the multi-agents-planner. Keeping this in
// one place means future stage insertions (e.g. R-D's mem0 layer)
// only touch this table, not every node.
const ORDER: RevertTarget[] = [
  "intake",
  "repo-scanner",
  "boundary-scoper",
  "change-classifier",
  "plan-writer",
  "patch-author",
  "verifier",
];

export function resetFor(stage: RevertTarget): SelfEvoUpdate {
  const start = ORDER.indexOf(stage);
  if (start < 0) return {};
  const update: SelfEvoUpdate = {};
  for (let i = start; i < ORDER.length; i++) {
    switch (ORDER[i]) {
      case "intake":
        // intake outputs runId/topic/requirements — preserved across
        // revisions; only priorMemories are recomputed.
        update.priorMemories = [];
        break;
      case "repo-scanner":
        update.findings = [];
        break;
      case "boundary-scoper":
        update.scope = undefined;
        break;
      case "change-classifier":
        update.changeType = undefined;
        break;
      case "plan-writer":
        update.plan = [];
        break;
      case "patch-author":
        update.patches = [];
        break;
      case "verifier":
        update.verification = undefined;
        break;
    }
  }
  update.verdict = undefined;
  update.hitl = undefined;
  // R-G: a manual revise restarts the reflection budget for the
  // resumed pass. Without this reset, an earlier auto-reflect could
  // consume the cap and force-approve a human-driven revision.
  update.judgeIterations = 0;
  return update;
}
