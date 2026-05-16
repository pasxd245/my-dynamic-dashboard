import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { ChangeType } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";

const VALID: readonly ChangeType[] = ["bug-fix", "feature", "refactor", "doc", "spike"];

const SYSTEM_BASE = [
  "You are the `change-classifier` agent. Pick exactly one label for",
  "this round from the set:",
  "  bug-fix | feature | refactor | doc | spike",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"changeType":"bug-fix|feature|refactor|doc|spike","reason":string}',
  "",
  "Use `bug-fix` for visible defects with a reproducer or assertion.",
  "Use `feature` for adding new capability under an existing surface.",
  "Use `refactor` for behaviour-preserving structural change.",
  "Use `doc` when the diff is markdown / comments only.",
  "Use `spike` for time-boxed exploration with no commitment to land.",
].join("\n");

interface ClassifyResponse {
  changeType?: unknown;
  reason?: unknown;
}

function renderUserPrompt(state: SelfEvoStateT): string {
  return [
    `Topic: ${state.topic}`,
    "",
    "Requirements:",
    state.requirements.map((r) => `- ${r.id}: ${r.text}`).join("\n") || "(none)",
    "",
    "Scope.inScope:",
    state.scope?.inScope.join("\n") || "(none)",
    "",
    "Findings (first 5):",
    state.findings.slice(0, 5).map((f) => `- ${f.claim}`).join("\n") || "(none)",
  ].join("\n");
}

export function makeChangeClassifierNode(services: AgentServices) {
  return async function changeClassifierNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const llm = services.resolver.for("change-classifier");
    const skillNames = services.resolver.skillsFor("change-classifier");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const user = renderUserPrompt(state);
    const res = await llm.complete({ system, user, tag: "change-classifier" });
    const parsed = parseJsonResponse<ClassifyResponse>(res.text);
    const raw = typeof parsed.changeType === "string" ? parsed.changeType : "";
    const changeType = (VALID as readonly string[]).includes(raw)
      ? (raw as ChangeType)
      : "spike";
    return { changeType };
  };
}
