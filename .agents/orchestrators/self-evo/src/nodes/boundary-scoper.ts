import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Scope } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";

const SYSTEM_BASE = [
  "You are the `boundary-scoper` agent in a self-evolution orchestrator.",
  "Given a topic, requirements, and findings, draft the round scope",
  "following the PDCA `Allowed Change Boundary` rule: explicitly list",
  "which globs may be modified and which must NOT be touched.",
  "",
  "Return ONLY a JSON object of the shape:",
  "{",
  '  "inScope": string[],',
  '  "outScope": string[],',
  '  "assumptions": string[],',
  '  "allowedFiles": string[]      // globs',
  "}",
  "",
  "`allowedFiles` is the contract the patch-author will enforce — be",
  "conservative; out-of-glob diffs are rejected. 1–8 globs is typical.",
].join("\n");

interface ScopeResponse {
  inScope?: unknown;
  outScope?: unknown;
  assumptions?: unknown;
  allowedFiles?: unknown;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function renderUserPrompt(state: SelfEvoStateT): string {
  const reqs = state.requirements.length
    ? state.requirements.map((r) => `- ${r.id}: ${r.text}`).join("\n")
    : "(none)";
  const findings = state.findings.length
    ? state.findings.map((f) => `- [${f.source}] ${f.claim} — ${f.evidence}`).join("\n")
    : "(none)";
  return [
    `Topic: ${state.topic}`,
    "",
    "Requirements:",
    reqs,
    "",
    "Findings:",
    findings,
    "",
    "Produce the scope JSON as described in the system prompt.",
  ].join("\n");
}

export function makeBoundaryScoperNode(services: AgentServices) {
  return async function boundaryScoperNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const llm = services.resolver.for("boundary-scoper");
    const skillNames = services.resolver.skillsFor("boundary-scoper");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const user = renderUserPrompt(state);
    const res = await llm.complete({ system, user, tag: "boundary-scoper" });
    const parsed = parseJsonResponse<ScopeResponse>(res.text);
    const scope: Scope = {
      inScope: asStringArray(parsed.inScope),
      outScope: asStringArray(parsed.outScope),
      assumptions: asStringArray(parsed.assumptions),
      allowedFiles: asStringArray(parsed.allowedFiles),
    };
    return { scope };
  };
}
