import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { RevertTarget, Verdict } from "../types.js";

export interface JudgeConfig {
  /** Score >= threshold ⇒ approve. Default 0.8. */
  approveThreshold?: number;
  /**
   * Hard cap on consecutive judge runs. Once `state.judgeIterations`
   * reaches this number, the judge force-approves so the loop can
   * surface to HITL.
   */
  maxIterations?: number;
}

interface Dimension {
  stage: RevertTarget;
  ok: boolean;
  note?: string;
}

// Holistic scorecard. Each dimension is 0 or 1; final score is the
// mean. The weakest *failed* dimension becomes `revertTo` so the
// reflection loop re-runs from there. Heuristic-only — no LLM call —
// because deterministic scoring keeps the loop bounded and debuggable.
// A future round can swap this for an LLM-backed judge that satisfies
// the same `Verdict` interface.
function scoreState(state: SelfEvoStateT): { score: number; dims: Dimension[] } {
  const dims: Dimension[] = [];

  const expectedFindings = Math.max(1, state.requirements.length);
  dims.push({
    stage: "repo-scanner",
    ok: state.findings.length >= expectedFindings,
    note:
      state.findings.length < expectedFindings
        ? `repo-scanner: ${state.findings.length} finding(s) for ${expectedFindings} expected`
        : undefined,
  });

  const scopeOk =
    !!state.scope &&
    state.scope.inScope.length > 0 &&
    state.scope.allowedFiles.length > 0;
  dims.push({
    stage: "boundary-scoper",
    ok: scopeOk,
    note: scopeOk
      ? undefined
      : "boundary-scoper: inScope or allowedFiles empty",
  });

  dims.push({
    stage: "change-classifier",
    ok: !!state.changeType,
    note: state.changeType ? undefined : "change-classifier: changeType unset",
  });

  dims.push({
    stage: "plan-writer",
    ok: state.plan.length >= 1,
    note: state.plan.length >= 1 ? undefined : "plan-writer: empty plan",
  });

  // verifier: skip → neutral pass (the changeType may legitimately
  // skip every channel); fail → strong negative.
  const failed = state.verification?.checks.filter((c) => c.status === "fail") ?? [];
  dims.push({
    stage: "verifier",
    ok: failed.length === 0,
    note: failed.length
      ? `verifier: ${failed.length} channel(s) failed: ${failed.map((f) => f.name).join(", ")}`
      : undefined,
  });

  const score = dims.reduce((acc, d) => acc + (d.ok ? 1 : 0), 0) / dims.length;
  return { score, dims };
}

function pickRevertTarget(dims: Dimension[]): RevertTarget | undefined {
  // First failed dimension in pipeline order — re-running upstream
  // makes downstream stages cheaper to refine on the next pass.
  for (const d of dims) if (!d.ok) return d.stage;
  return undefined;
}

// R-G: real judge. Increments `judgeIterations`, runs the holistic
// scorecard, and either approves (above threshold OR cap reached) or
// asks the graph to re-enter at `verdict.revertTo`. The reflection
// loop terminates in one of three ways:
//   - score >= approveThreshold → approve (normal path).
//   - judgeIterations >= maxIterations → force-approve with a note.
//   - any other case → refine + revertTo weakest failed stage.
export function makeJudgeNode(_services: AgentServices, cfg: JudgeConfig = {}) {
  const approveThreshold = cfg.approveThreshold ?? 0.8;
  const maxIterations = cfg.maxIterations ?? 3;

  return async function judgeNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const iteration = (state.judgeIterations ?? 0) + 1;
    const { score, dims } = scoreState(state);
    const failedNotes = dims.filter((d) => !d.ok && d.note).map((d) => d.note!);

    if (score >= approveThreshold) {
      const verdict: Verdict = {
        verdict: "approve",
        score,
        notes: failedNotes,
      };
      return { verdict, judgeIterations: iteration };
    }
    if (iteration >= maxIterations) {
      const verdict: Verdict = {
        verdict: "approve",
        score,
        notes: [
          ...failedNotes,
          `reflection cap (${maxIterations}) reached; forced approve`,
        ],
      };
      return { verdict, judgeIterations: iteration };
    }
    const verdict: Verdict = {
      verdict: "refine",
      score,
      revertTo: pickRevertTarget(dims),
      notes: failedNotes,
    };
    return { verdict, judgeIterations: iteration };
  };
}
