import { Annotation } from "@langchain/langgraph";
import type {
  ChangeType,
  Finding,
  HitlDecision,
  Patch,
  PlanStep,
  PriorMemory,
  Requirement,
  RoundInfo,
  Scope,
  Verdict,
  Verification,
} from "./types.js";

// Overwrite-on-next reducers throughout — matches the
// `Object.assign(state, patch)` semantics that the multi-agents-planner
// uses, and keeps each node's return value the single source of truth
// for the fields it owns.
const overwrite = <T>() => ({
  reducer: (_prev: T, next: T) => next,
});

export const SelfEvoState = Annotation.Root({
  runId: Annotation<string>({ ...overwrite<string>(), default: () => "" }),
  topic: Annotation<string>({ ...overwrite<string>(), default: () => "" }),
  requirements: Annotation<Requirement[]>({
    ...overwrite<Requirement[]>(),
    default: () => [],
  }),

  priorMemories: Annotation<PriorMemory[]>({
    ...overwrite<PriorMemory[]>(),
    default: () => [],
  }),
  findings: Annotation<Finding[]>({
    ...overwrite<Finding[]>(),
    default: () => [],
  }),
  scope: Annotation<Scope | undefined>({
    ...overwrite<Scope | undefined>(),
    default: () => undefined,
  }),
  changeType: Annotation<ChangeType | undefined>({
    ...overwrite<ChangeType | undefined>(),
    default: () => undefined,
  }),
  plan: Annotation<PlanStep[]>({
    ...overwrite<PlanStep[]>(),
    default: () => [],
  }),
  patches: Annotation<Patch[]>({
    ...overwrite<Patch[]>(),
    default: () => [],
  }),
  verification: Annotation<Verification | undefined>({
    ...overwrite<Verification | undefined>(),
    default: () => undefined,
  }),
  verdict: Annotation<Verdict | undefined>({
    ...overwrite<Verdict | undefined>(),
    default: () => undefined,
  }),
  hitl: Annotation<HitlDecision | undefined>({
    ...overwrite<HitlDecision | undefined>(),
    default: () => undefined,
  }),
  round: Annotation<RoundInfo | undefined>({
    ...overwrite<RoundInfo | undefined>(),
    default: () => undefined,
  }),
  // R-G: counts judge iterations to enforce the reflection cap.
  judgeIterations: Annotation<number>({
    ...overwrite<number>(),
    default: () => 0,
  }),
});

export type SelfEvoStateT = typeof SelfEvoState.State;
export type SelfEvoUpdate = Partial<SelfEvoStateT>;
