import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Finding } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";
import { ripgrep, ripgrepAvailable, type RipgrepHit } from "../tools/ripgrep.js";
import {
  detectDocTopic,
  probeFileRead,
  probeLint,
  renderProbes,
  type ProbeResult,
} from "../tools/probe.js";

const SYSTEM_BASE = [
  "You are the `repo-scanner` agent in a self-evolution orchestrator.",
  "Given a topic, a set of requirements, ripgrep hits, and one or more",
  "tool probes (linter output, file reads), produce findings the",
  "downstream planner can act on.",
  "",
  "GROUNDING RULE: every finding's `evidence` must quote or directly",
  "reference a specific ripgrep hit or tool probe. Do NOT invent",
  "issues the probes did not show. If the linter exited 0, say so —",
  "don't claim formatting problems exist anyway. If file-read shows",
  "the code is fine for the topic, surface that as a finding (the",
  "downstream planner needs to know nothing's broken).",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"findings":[{"source":string,"claim":string,"evidence":string}]}',
  "",
  "`source` is either a file path, `tool:lint`, `tool:file-read`,",
  "or `inference` (use `inference` ONLY for cross-cutting observations",
  "the probes hint at but don't directly state). `claim` is one",
  "sentence. `evidence` is at most one sentence and quotes the probe",
  "or hit it draws on. Aim for 2–6 findings.",
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

function renderUserPrompt(
  state: SelfEvoStateT,
  hits: RipgrepHit[],
  probes: ProbeResult[],
): string {
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
    "Tool probes (authoritative evidence — findings MUST be grounded here):",
    renderProbes(probes),
    "",
    "Produce findings as described in the system prompt.",
  ].join("\n");
}

// Extract candidate paths from ripgrep hits, biased toward the top
// of the hit list. Used to seed the lint and file-read probes so we
// only probe files the scanner already has reason to think matter.
function candidatePaths(hits: RipgrepHit[], limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (seen.has(h.path)) continue;
    seen.add(h.path);
    out.push(h.path);
    if (out.length >= limit) break;
  }
  return out;
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

export interface RepoScannerConfig {
  /** Skip the lint/file-read probes (used by tests). */
  disableProbes?: boolean;
  /**
   * Cap on the rendered user-prompt size (chars). When the prompt
   * exceeds this, the probes + hits sections are truncated from the
   * tail until it fits. Default 18000 — chosen to leave headroom
   * under `claude -p`'s practical input limit while keeping the
   * findings grounded.
   *
   * Surfaced by autoagent Round 06: a broad topic ("Add OpenAI Codex
   * CLI adapter") matched many vendored files via ripgrep, the
   * file-read probe slurped 4 of them at 2000 chars each, plus
   * ripgrep hits, plus skills — total prompt blew the `claude -p`
   * input budget and the subprocess died with "Prompt is too long".
   */
  maxUserPromptChars?: number;
}

const DEFAULT_MAX_USER_PROMPT_CHARS = 18_000;

// Apply the cap to a rendered user prompt by trimming the
// hits + probes sections (the largest, most replaceable content)
// from the tail. The topic, requirements, and the "Produce findings"
// trailer always survive.
export function truncateUserPrompt(prompt: string, max: number): string {
  if (prompt.length <= max) return prompt;
  const marker = "\n\n[truncated by repo-scanner: prompt over " +
    String(max) + " chars]\n";
  const trailer = "Produce findings as described in the system prompt.";
  const trailerIdx = prompt.lastIndexOf(trailer);
  // Keep the head (topic + reqs + start of hits/probes) and the
  // trailing instruction; drop the middle.
  const keepTail = trailer.length + 8;
  const keepHead = max - keepTail - marker.length;
  if (keepHead <= 0) return prompt.slice(0, max - marker.length) + marker;
  const head = prompt.slice(0, keepHead);
  const tail = trailerIdx >= 0
    ? prompt.slice(trailerIdx)
    : prompt.slice(prompt.length - keepTail);
  return head + marker + tail;
}

const defaultRepoScannerConfig: RepoScannerConfig = {};

export function makeRepoScannerNode(
  services: AgentServices,
  cfg: RepoScannerConfig = defaultRepoScannerConfig,
) {
  const maxPromptChars = cfg.maxUserPromptChars ?? DEFAULT_MAX_USER_PROMPT_CHARS;
  return async function repoScannerNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const hits: RipgrepHit[] = [];
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

    // R-L: pull tool-grounded evidence so findings can cite real
    // probe output instead of plausible-sounding inferences.
    const probes: ProbeResult[] = [];
    if (!cfg.disableProbes) {
      const paths = candidatePaths(hits);
      const isDoc = detectDocTopic(state.topic, state.requirements.map((r) => r.text));
      if (isDoc) {
        try {
          const lintProbe = await probeLint(paths, services.repoRoot);
          if (lintProbe) probes.push(lintProbe);
        } catch {
          // Probe failures aren't fatal — the scanner just runs with
          // less grounding.
        }
      }
      try {
        probes.push(...(await probeFileRead(paths, services.repoRoot)));
      } catch {
        // ditto
      }
    }

    const llm = services.resolver.for("repo-scanner");
    const skillNames = services.resolver.skillsFor("repo-scanner");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const rawUser = renderUserPrompt(state, hits, probes);
    const user = truncateUserPrompt(rawUser, maxPromptChars);
    if (user.length < rawUser.length) {
      console.error(
        `[repo-scanner] user prompt truncated ${rawUser.length} → ${user.length} chars (cap ${maxPromptChars})`,
      );
    }
    const res = await llm.complete({ system, user, tag: "repo-scanner" });
    const parsed = parseJsonResponse<FindingsResponse>(res.text);
    return { findings: normaliseFindings(parsed) };
  };
}
