import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { SelfEvoState, type SelfEvoStateT } from "./state.js";
import type { AgentServices } from "./agent-services.js";
import { makeIntakeNode } from "./nodes/intake.js";
import {
  makeRepoScannerNode,
  type RepoScannerConfig,
} from "./nodes/repo-scanner.js";
import { makeBoundaryScoperNode } from "./nodes/boundary-scoper.js";
import { makeChangeClassifierNode } from "./nodes/change-classifier.js";
import { makePlanWriterNode } from "./nodes/plan-writer.js";
import { makePatchAuthorNode } from "./nodes/patch-author.js";
import { makeVerifierNode, type VerifierConfig } from "./nodes/verifier.js";
import {
  makeApplyVerifierNode,
  type ApplyVerifierConfig,
} from "./nodes/apply-verifier.js";
import { makeJudgeNode, type JudgeConfig } from "./nodes/judge.js";
import { makeHitlNode } from "./nodes/hitl.js";
import {
  makeRoundWriterNode,
  type RoundWriterConfig,
} from "./nodes/round-writer.js";
import { resetFor } from "./nodes/_reset.js";
import type { RevertTarget } from "./types.js";

const REVERT_NODES: RevertTarget[] = [
  "intake",
  "repo-scanner",
  "boundary-scoper",
  "change-classifier",
  "plan-writer",
  "patch-author",
  "verifier",
];

// Wraps a node so the resetFor() side-effect runs once whenever the
// graph re-enters the node after a `revise <stage>` HITL decision.
// The reset returns a Partial<State> the node then merges with its
// own output. Without this, a revise loop would replay against stale
// downstream fields and produce nonsense.
function withResetGuard(
  stage: RevertTarget,
  node: (s: SelfEvoStateT) => Promise<Partial<SelfEvoStateT>>,
) {
  return async (s: SelfEvoStateT) => {
    const reentry = s.hitl?.kind === "revise" && s.hitl.stage === stage;
    const base = reentry ? resetFor(stage) : {};
    const out = await node({ ...s, ...base });
    return { ...base, ...out, ...(reentry ? { hitl: undefined } : {}) };
  };
}

export interface GraphConfig {
  verifier: VerifierConfig;
  /**
   * R-I: config for the `apply-verifier` node. When omitted, the node
   * mirrors `verifier` config and uses default worktree placement.
   */
  applyVerifier?: ApplyVerifierConfig;
  judge?: JudgeConfig;
  roundWriter?: RoundWriterConfig;
  /** R-L: knobs for the repo-scanner's tool-grounded probes. */
  repoScanner?: RepoScannerConfig;
}

export function buildGraph(services: AgentServices, cfg: GraphConfig) {
  const g = new StateGraph(SelfEvoState)
    .addNode("intake", withResetGuard("intake", makeIntakeNode(services)))
    .addNode(
      "repo-scanner",
      withResetGuard(
        "repo-scanner",
        makeRepoScannerNode(services, cfg.repoScanner),
      ),
    )
    .addNode(
      "boundary-scoper",
      withResetGuard("boundary-scoper", makeBoundaryScoperNode(services)),
    )
    .addNode(
      "change-classifier",
      withResetGuard("change-classifier", makeChangeClassifierNode(services)),
    )
    .addNode(
      "plan-writer",
      withResetGuard("plan-writer", makePlanWriterNode(services)),
    )
    .addNode(
      "patch-author",
      withResetGuard("patch-author", makePatchAuthorNode(services)),
    )
    .addNode(
      "verifier",
      withResetGuard("verifier", makeVerifierNode(services, cfg.verifier)),
    )
    .addNode("judge", makeJudgeNode(services, cfg.judge))
    .addNode("hitl-gate", makeHitlNode(services))
    .addNode(
      "apply-verifier",
      makeApplyVerifierNode(services, cfg.applyVerifier ?? cfg.verifier),
    )
    .addNode("round-writer", makeRoundWriterNode(services, cfg.roundWriter))
    .addEdge(START, "intake")
    .addEdge("intake", "repo-scanner")
    .addEdge("repo-scanner", "boundary-scoper")
    .addEdge("boundary-scoper", "change-classifier")
    .addEdge("change-classifier", "plan-writer")
    .addEdge("plan-writer", "patch-author")
    .addEdge("patch-author", "verifier")
    .addEdge("verifier", "judge")
    .addConditionalEdges(
      "judge",
      (s: SelfEvoStateT) =>
        s.verdict?.verdict === "refine"
          ? (s.verdict.revertTo ?? "plan-writer")
          : "hitl-gate",
      // Possible destinations (LangGraph 1.x requires this enumeration
      // when the router returns dynamic strings):
      [...REVERT_NODES, "hitl-gate"],
    )
    .addConditionalEdges(
      "hitl-gate",
      (s: SelfEvoStateT) => {
        if (!s.hitl) return END;
        if (s.hitl.kind === "approve") return "round-writer";
        if (s.hitl.kind === "apply") return "apply-verifier";
        if (s.hitl.kind === "revise") return s.hitl.stage ?? "plan-writer";
        return END;
      },
      [...REVERT_NODES, "round-writer", "apply-verifier", END],
    )
    .addEdge("apply-verifier", "hitl-gate")
    .addEdge("round-writer", END);
  return g;
}

export function compileGraph(
  services: AgentServices,
  checkpointer: BaseCheckpointSaver,
  cfg: GraphConfig = {
    verifier: { defaultChannels: ["lint"], byChangeType: {} },
  },
) {
  return buildGraph(services, cfg).compile({ checkpointer });
}
