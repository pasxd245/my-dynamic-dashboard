export type Track = "product" | "agent-method" | "self-evo" | "unknown";

export type Kind =
  | "spec"
  | "round"
  | "meta"
  | "report"
  | "memory"
  | "skill"
  | "runbook"
  | "readme"
  | "other";

const SELF_EVO_PATTERNS = [
  /^\.agents\/orchestrators\/self-evo\//,
  /^\.agents\/plan\/meta\//,
  /^\.agents\/auto\/reports\/.*\/Meta_/,
  /^\.agents\/memory\//,
];

const AGENT_METHOD_PATTERNS = [
  /^\.agents\//,
  /^\.claude\//,
  /^\.codex\//,
  /^\.github\/agents\//,
  /^\.github\/prompts\//,
  /^\.kiro\//,
  /^AGENTS\.md$/,
  /^GEMINI\.md$/,
  /^\.github\/copilot-instructions\.md$/,
];

const PRODUCT_PATTERNS = [
  /^apps\//,
  /^packages\//,
  /^docs\//,
  /^devops\//,
  /^README\.md$/,
];

export function inferTrack(repoRelPath: string): Track {
  for (const re of SELF_EVO_PATTERNS) if (re.test(repoRelPath)) return "self-evo";
  for (const re of AGENT_METHOD_PATTERNS) if (re.test(repoRelPath)) return "agent-method";
  for (const re of PRODUCT_PATTERNS) if (re.test(repoRelPath)) return "product";
  return "unknown";
}

export function inferKind(repoRelPath: string): Kind {
  const basename = repoRelPath.split("/").pop() ?? "";
  if (/^docs\/features\/spec-\d+.*\.md$/i.test(repoRelPath)) return "spec";
  if (/\/Round_\d+.*\.report\.md$/i.test(repoRelPath)) return "report";
  if (/\/Meta_\d+.*\.report\.md$/i.test(repoRelPath)) return "report";
  if (/\.report\.md$/i.test(basename)) return "report";
  if (/^\.agents\/plan\/cycles\/Round_\d+/i.test(repoRelPath)) return "round";
  if (/^\.agents\/plan\/meta\/Meta_\d+/i.test(repoRelPath)) return "meta";
  if (/^\.agents\/memory\//i.test(repoRelPath)) return "memory";
  if (/\/SKILL\.md$/i.test(repoRelPath) || basename === "SKILL.md") return "skill";
  if (/^docs\/operations\//i.test(repoRelPath)) return "runbook";
  if (basename.toLowerCase() === "readme.md") return "readme";
  return "other";
}

/** Universally-rooted docs that should never count as orphans. */
export const ROOT_NODES: ReadonlySet<string> = new Set([
  "README.md",
  "AGENTS.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".agents/AGENTS.md",
  "docs/README.md",
  ".agents/auto/queue.md",
  ".agents/auto/README.md",
  ".agents/plan/cycles/README.md",
  ".agents/plan/meta/README.md",
  ".agents/orchestrators/self-evo/README.md",
  ".claude/CLAUDE.md",
]);
