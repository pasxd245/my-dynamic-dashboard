export type ChangeType = "bug-fix" | "feature" | "refactor" | "doc" | "spike";

export type RevertTarget =
  | "intake"
  | "repo-scanner"
  | "boundary-scoper"
  | "change-classifier"
  | "plan-writer"
  | "patch-author"
  | "verifier";

export interface Requirement {
  id: string;
  text: string;
}

export interface Finding {
  source: string;
  claim: string;
  evidence: string;
}

export interface Scope {
  inScope: string[];
  outScope: string[];
  assumptions: string[];
  allowedFiles: string[];
}

export interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Patch {
  path: string;
  diff: string;
  applied: boolean;
}

export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
  /** Channel name (e.g. `lint`, `typecheck`, `tests`, `smoke`, custom). */
  name: string;
  status: CheckStatus;
  durationMs: number;
  /** First ~40 tail lines of stdout+stderr when status === "fail". */
  excerpt?: string;
}

export interface Verification {
  /** Result per channel, in declared order. */
  checks: CheckResult[];
  /** Flat list of `excerpt` values from failed checks — convenience copy. */
  failureExcerpts: string[];
}

export interface Verdict {
  verdict: "approve" | "refine";
  score: number;
  revertTo?: RevertTarget;
  notes: string[];
}

export type HitlKind = "approve" | "revise" | "quit";

export interface HitlDecision {
  kind: HitlKind;
  stage?: RevertTarget;
  note?: string;
}

export interface PriorMemory {
  id: string;
  text: string;
  score: number;
}

export interface RoundInfo {
  number: number;
  path: string;
}
