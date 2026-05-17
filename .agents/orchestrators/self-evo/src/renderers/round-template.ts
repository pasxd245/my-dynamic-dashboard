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

// Markdown sub-section with a heading + body. Every sub-section
// emits the same shape — heading, blank, body lines, trailing blank —
// so markdownlint MD022/MD032 stay happy without the caller having to
// remember the pattern. Found by round a: the Findings/Boundary/Patches
// sections all butted heading-to-list and failed lint. Found by round
// b: when `body` is empty (e.g. the "Change type" line which carries
// its info in the heading itself), the standard shape would double-
// blank against the next section's heading and fail MD012. The
// empty-body branch collapses to `[heading, ""]` to keep adjacent
// sections clean.
function subSection(heading: string, body: readonly string[]): string[] {
  if (body.length === 0) return [heading, ""];
  return [heading, "", ...body, ""];
}

function renderDoBlock(state: SelfEvoStateT): string {
  const out: string[] = [];

  const findings = state.findings.length === 0
    ? ["(none)"]
    : state.findings.map((f) => {
        const evidence = f.evidence ? ` _(${f.evidence})_` : "";
        return `- **${f.source}** — ${f.claim}${evidence}`;
      });
  out.push(...subSection(`### Findings (${state.findings.length})`, findings));

  if (state.scope) {
    const body: string[] = [];
    body.push(`- **In scope**: ${state.scope.inScope.join(", ") || "(none)"}`);
    if (state.scope.outScope.length) {
      body.push(`- **Out of scope**: ${state.scope.outScope.join(", ")}`);
    }
    if (state.scope.allowedFiles.length) {
      body.push(`- **Allowed file globs**: \`${state.scope.allowedFiles.join("`, `")}\``);
    }
    if (state.scope.assumptions.length) {
      body.push("- **Assumptions**:");
      for (const a of state.scope.assumptions) body.push(`  - ${a}`);
    }
    out.push(...subSection("### Boundary", body));
  }

  out.push(...subSection(
    `### Change type: \`${state.changeType ?? "(unset)"}\``,
    [],
  ));

  const patches = state.patches.length === 0
    ? ["(none)"]
    : state.patches.map((p) => `- \`${p.path}\` — applied: ${p.applied}`);
  out.push(...subSection(`### Patches (dry-run, ${state.patches.length})`, patches));

  // Strip the final trailing blank so the rendered block ends cleanly
  // — the outer template controls the next section's spacing.
  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out.join("\n");
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
  // markdownlint wants MD022 (blank around headings) + MD032 (blank
  // around lists). The first round we wrote (Round_01.md after round a)
  // failed lint because the heading + list pair butted up against each
  // other. Inserting a blank line after the heading and before any
  // subsequent block keeps the rendered round file self-clean.
  const lines: string[] = [];
  lines.push(`### ${title}`);
  lines.push("");
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
