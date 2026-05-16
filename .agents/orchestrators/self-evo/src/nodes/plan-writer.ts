import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { PlanStep } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";

const SYSTEM_BASE = [
  "You are the `plan-writer` agent. Produce the `## Plan` checklist",
  "that will land in the round's PDCA file. Steps are imperative,",
  "ordered, and each one is independently verifiable.",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"plan":[{"id":string,"text":string}]}',
  "",
  "`id` is a stable 2–3 char slug (e.g. `P1`, `P2a`). Aim for 3–8",
  "steps. Don't restate the scope or the assumptions — those live in",
  "their own state fields.",
].join("\n");

interface PlanResponse {
  plan?: Array<{ id?: unknown; text?: unknown }>;
}

function renderUserPrompt(state: SelfEvoStateT): string {
  return [
    `Topic: ${state.topic}`,
    `ChangeType: ${state.changeType ?? "(unset)"}`,
    "",
    "Scope.inScope:",
    state.scope?.inScope.join("\n") || "(none)",
    "",
    "Scope.assumptions:",
    state.scope?.assumptions.join("\n") || "(none)",
    "",
    "Allowed file globs:",
    state.scope?.allowedFiles.join("\n") || "(none)",
    "",
    "Findings:",
    state.findings.map((f) => `- ${f.claim}`).join("\n") || "(none)",
  ].join("\n");
}

function normalisePlan(raw: PlanResponse): PlanStep[] {
  if (!raw?.plan || !Array.isArray(raw.plan)) return [];
  const out: PlanStep[] = [];
  raw.plan.forEach((step, i) => {
    const text = typeof step.text === "string" ? step.text.trim() : "";
    if (!text) return;
    const id =
      typeof step.id === "string" && step.id.trim()
        ? step.id.trim()
        : `P${i + 1}`;
    out.push({ id, text, done: false });
  });
  return out;
}

export function makePlanWriterNode(services: AgentServices) {
  return async function planWriterNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const llm = services.resolver.for("plan-writer");
    const skillNames = services.resolver.skillsFor("plan-writer");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const user = renderUserPrompt(state);
    const res = await llm.complete({ system, user, tag: "plan-writer" });
    const parsed = parseJsonResponse<PlanResponse>(res.text);
    return { plan: normalisePlan(parsed) };
  };
}
