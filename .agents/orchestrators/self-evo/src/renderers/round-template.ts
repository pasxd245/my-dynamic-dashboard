import type { SelfEvoStateT } from "../state.js";
import type { CheckResult, PlanStep } from "../types.js";

export interface RenderRoundOptions {
  number: number;
  /** ISO date string `YYYY-MM-DD`. Defaults to today (UTC). */
  startedAt?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function titleFromTopic(topic: string): string {
  const t = topic.trim().replace(/\s+/g, " ");
  if (t.length <= 60) return t || "(no topic)";
  return t.slice(0, 57) + "...";
}

function renderPlan(plan: PlanStep[]): string {
  if (!plan.length) return "- [ ] (no plan steps)";
  return plan.map((p) => `- [${p.done ? "x" : " "}] **${p.id}** — ${p.text}`).join("\n");
}

function renderDoBlock(state: SelfEvoStateT): string {
  const lines: string[] = [];
  lines.push(`### Findings (${state.findings.length})`);
  if (state.findings.length === 0) {
    lines.push("(none)");
  } else {
    for (const f of state.findings) {
      lines.push(`- **${f.source}** — ${f.claim}${f.evidence ? ` _(${f.evidence})_` : ""}`);
    }
  }
  lines.push("");

  if (state.scope) {
    lines.push("### Boundary");
    lines.push(`- **In scope**: ${state.scope.inScope.join(", ") || "(none)"}`);
    if (state.scope.outScope.length) {
      lines.push(`- **Out of scope**: ${state.scope.outScope.join(", ")}`);
    }
    if (state.scope.allowedFiles.length) {
      lines.push(`- **Allowed file globs**: \`${state.scope.allowedFiles.join("`, `")}\``);
    }
    if (state.scope.assumptions.length) {
      lines.push("- **Assumptions**:");
      for (const a of state.scope.assumptions) lines.push(`  - ${a}`);
    }
    lines.push("");
  }

  lines.push(`### Change type: \`${state.changeType ?? "(unset)"}\``);
  lines.push("");

  lines.push(`### Patches (dry-run, ${state.patches.length})`);
  if (state.patches.length === 0) {
    lines.push("(none)");
  } else {
    for (const p of state.patches) {
      lines.push(`- \`${p.path}\` — applied: ${p.applied}`);
    }
  }
  return lines.join("\n");
}

function statusBox(check: CheckResult): string {
  if (check.status === "pass") return "x";
  if (check.status === "skip") return "~";
  return " ";
}

function renderCheckBlock(
  title: string,
  v: SelfEvoStateT["verification"],
): string {
  const lines: string[] = [];
  lines.push(`### ${title}`);
  if (!v) {
    lines.push("- [ ] (did not run)");
    return lines.join("\n");
  }
  for (const c of v.checks) {
    const ms = c.durationMs ? ` _(${c.durationMs}ms)_` : "";
    lines.push(`- [${statusBox(c)}] **${c.name}** — ${c.status}${ms}`);
  }
  if (v.failureExcerpts.length) {
    lines.push("");
    lines.push("**Failure excerpts** (first 40 lines per failing channel):");
    for (const ex of v.failureExcerpts) {
      lines.push("");
      lines.push("```text");
      lines.push(ex);
      lines.push("```");
    }
  }
  return lines.join("\n");
}

function renderCheck(state: SelfEvoStateT): string {
  const blocks: string[] = [renderCheckBlock("Pre-patch (current HEAD)", state.verification)];
  if (state.appliedVerification) {
    blocks.push("");
    blocks.push(
      renderCheckBlock("Post-patch (worktree, after `apply`)", state.appliedVerification),
    );
    if (state.appliedWorktree) {
      blocks.push("");
      blocks.push(`_Worktree preserved at_: \`${state.appliedWorktree}\``);
    }
  }
  return blocks.join("\n");
}

function renderAct(state: SelfEvoStateT): string {
  const verdictLine = state.verdict
    ? `_Judge verdict_: **${state.verdict.verdict}** at score ${state.verdict.score.toFixed(2)}` +
      (state.verdict.notes.length
        ? `\n\n_Notes_:\n${state.verdict.notes.map((n) => `- ${n}`).join("\n")}`
        : "")
    : "_(judge did not run)_";
  return [
    verdictLine,
    "",
    "**Learnings**:",
    "",
    "- _(human to fill in during review)_",
    "",
    "**Promotions**:",
    "",
    "- [ ] → context/ : _topic_",
    "- [ ] → skills/ : _topic_",
  ].join("\n");
}

function renderRequirements(state: SelfEvoStateT): string {
  if (state.requirements.length === 0) return "(none specified)";
  return state.requirements
    .map((r) => `- **${r.id}** — ${r.text}`)
    .join("\n");
}

export function renderRoundMarkdown(
  state: SelfEvoStateT,
  opts: RenderRoundOptions,
): string {
  const num = String(opts.number).padStart(2, "0");
  const title = titleFromTopic(state.topic);
  const startedAt = opts.startedAt ?? today();

  return `# Round ${num}: ${title}

**Status**: Review
**Date started**: ${startedAt}
**Date completed**: _(set on human approval)_

## Goal

${state.topic || "(no topic)"}

### Requirements

${renderRequirements(state)}

## Plan

${renderPlan(state.plan)}

## Do

${renderDoBlock(state)}

## Check

${renderCheck(state)}

## Act

${renderAct(state)}
`;
}

export function roundFilename(number: number): string {
  return `Round_${String(number).padStart(2, "0")}.md`;
}
