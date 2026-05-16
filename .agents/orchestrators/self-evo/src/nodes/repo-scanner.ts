import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Finding } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";
import { ripgrep, ripgrepAvailable, type RipgrepHit } from "../tools/ripgrep.js";

const SYSTEM_BASE = [
  "You are the `repo-scanner` agent in a self-evolution orchestrator.",
  "Given a topic, a set of requirements, and (optionally) a list of",
  "ripgrep hits from this repository, produce a JSON object listing",
  "findings the downstream planner can act on. Each finding maps to",
  "evidence in the codebase or a clear inference from the topic.",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"findings":[{"source":string,"claim":string,"evidence":string}]}',
  "",
  "`source` is a file path or `inference`. `claim` is one sentence.",
  "`evidence` is at most one sentence. Aim for 3–8 findings.",
].join("\n");

interface FindingsResponse {
  findings: Array<{ source?: unknown; claim?: unknown; evidence?: unknown }>;
}

// Keywords for ripgrep are extracted from requirement text — quoted
// substrings, then bare alpha-numeric tokens ≥ 4 chars. Heuristic;
// good enough to surface anchor points the LLM can reason against.
export function extractRipgrepPatterns(state: SelfEvoStateT): string[] {
  const corpus = [state.topic, ...state.requirements.map((r) => r.text)].join(" ");
  const quoted = Array.from(corpus.matchAll(/"([^"]{2,})"/g)).map((m) => m[1]!);
  const tokens = Array.from(
    new Set(
      corpus
        .split(/[^A-Za-z0-9_-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !/^\d+$/.test(t)),
    ),
  ).slice(0, 6);
  return [...quoted, ...tokens].slice(0, 8);
}

function renderHits(hits: RipgrepHit[]): string {
  if (!hits.length) return "(no ripgrep hits)";
  return hits
    .slice(0, 40)
    .map((h) => `- ${h.path}:${h.line}  ${h.text}`)
    .join("\n");
}

function renderUserPrompt(state: SelfEvoStateT, hits: RipgrepHit[]): string {
  const reqs = state.requirements.length
    ? state.requirements.map((r) => `- ${r.id}: ${r.text}`).join("\n")
    : "(none specified — infer from topic)";
  return [
    `Topic: ${state.topic}`,
    "",
    "Requirements:",
    reqs,
    "",
    "Ripgrep hits (codebase anchors):",
    renderHits(hits),
    "",
    "Produce findings as described in the system prompt.",
  ].join("\n");
}

function normaliseFindings(raw: FindingsResponse): Finding[] {
  if (!raw?.findings || !Array.isArray(raw.findings)) return [];
  const out: Finding[] = [];
  for (const f of raw.findings) {
    const source = typeof f.source === "string" ? f.source : "";
    const claim = typeof f.claim === "string" ? f.claim.trim() : "";
    const evidence = typeof f.evidence === "string" ? f.evidence.trim() : "";
    if (!claim) continue;
    out.push({ source: source || "inference", claim, evidence });
  }
  return out;
}

export function makeRepoScannerNode(services: AgentServices) {
  return async function repoScannerNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    let hits: RipgrepHit[] = [];
    if (await ripgrepAvailable()) {
      const patterns = extractRipgrepPatterns(state);
      for (const p of patterns) {
        try {
          const part = await ripgrep(p, { cwd: services.repoRoot, limit: 20 });
          hits.push(...part);
        } catch {
          // Per-pattern failure shouldn't kill the whole scan.
        }
        if (hits.length >= 80) break;
      }
    }

    const llm = services.resolver.for("repo-scanner");
    const skillNames = services.resolver.skillsFor("repo-scanner");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const user = renderUserPrompt(state, hits);
    const res = await llm.complete({ system, user, tag: "repo-scanner" });
    const parsed = parseJsonResponse<FindingsResponse>(res.text);
    return { findings: normaliseFindings(parsed) };
  };
}
