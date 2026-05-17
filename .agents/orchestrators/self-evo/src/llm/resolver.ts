import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import type { LLMClient } from "./client.js";
import { makeSubprocessClient } from "./subprocess.js";
import { makeAnthropicClient } from "./anthropic.js";

export type LLMMode = "subprocess" | "api";

export interface LLMNodeConfig {
  mode?: LLMMode;
  model?: string;
  command?: string;
  args?: string[];
  apiKey?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Skill names appended to this node's system prompt. */
  skills?: string[];
}

export interface LLMConfig {
  default: LLMNodeConfig;
  nodes: Record<string, LLMNodeConfig>;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  default: {
    mode: "subprocess",
    command: "claude",
    args: ["-p"],
  },
  nodes: {},
};

// Envvar pattern: SELFEVO_LLM_<NODE>_<FIELD>. NODE is upper-snake; node
// names with dashes (e.g. `plan-writer`) become `PLAN_WRITER`. `DEFAULT`
// is reserved for the fallback used when a node has no override.
function envOverride(node: string): Partial<LLMNodeConfig> {
  const tag = node.toUpperCase().replace(/-/g, "_");
  const pick = (field: string) => process.env[`SELFEVO_LLM_${tag}_${field}`];
  const out: Partial<LLMNodeConfig> = {};
  const mode = pick("MODE");
  if (mode === "subprocess" || mode === "api") out.mode = mode;
  const model = pick("MODEL");
  if (model) out.model = model;
  const command = pick("COMMAND");
  if (command) out.command = command;
  const args = pick("ARGS");
  if (args) out.args = args.split(/\s+/).filter(Boolean);
  const apiKey = pick("API_KEY");
  if (apiKey) out.apiKey = apiKey;
  const maxTokens = pick("MAX_TOKENS");
  if (maxTokens && Number.isFinite(Number(maxTokens))) {
    out.maxTokens = Number(maxTokens);
  }
  const timeoutMs = pick("TIMEOUT_MS");
  if (timeoutMs && Number.isFinite(Number(timeoutMs))) {
    out.timeoutMs = Number(timeoutMs);
  }
  return out;
}

function merge(...layers: Partial<LLMNodeConfig>[]): LLMNodeConfig {
  return layers.reduce<LLMNodeConfig>((acc, l) => ({ ...acc, ...l }), {} as LLMNodeConfig);
}

export async function loadLlmConfig(path?: string): Promise<LLMConfig> {
  const explicit = path && resolve(process.cwd(), path);
  const pkgDefault = resolve(
    process.cwd(),
    ".agents/orchestrators/self-evo/config/llm.yaml",
  );
  const candidate = explicit ?? pkgDefault;
  if (!existsSync(candidate)) return DEFAULT_LLM_CONFIG;
  const raw = await readFile(candidate, "utf8");
  const parsed = (yaml.load(raw) ?? {}) as Partial<LLMConfig>;
  return {
    default: { ...DEFAULT_LLM_CONFIG.default, ...(parsed.default ?? {}) },
    nodes: parsed.nodes ?? {},
  };
}

export class LLMResolver {
  private cache = new Map<string, LLMClient>();
  constructor(private readonly config: LLMConfig) {}

  /** Returns the effective config for a node (merged + env overrides). */
  effective(node: string): LLMNodeConfig {
    return merge(
      this.config.default,
      this.config.nodes[node] ?? {},
      envOverride("DEFAULT"),
      envOverride(node),
    );
  }

  /** Skills bound to a node (after env override). */
  skillsFor(node: string): string[] {
    const env = process.env[`SELFEVO_SKILLS_${node.toUpperCase().replace(/-/g, "_")}`];
    if (env !== undefined) return env.split(",").map((s) => s.trim()).filter(Boolean);
    return this.config.nodes[node]?.skills ?? this.config.default.skills ?? [];
  }

  for(node: string): LLMClient {
    const cached = this.cache.get(node);
    if (cached) return cached;
    const cfg = this.effective(node);
    const client =
      cfg.mode === "api"
        ? makeAnthropicClient({
            apiKey: cfg.apiKey,
            model: cfg.model,
            maxTokens: cfg.maxTokens,
          })
        : makeSubprocessClient({
            command: cfg.command,
            args: cfg.args,
            timeoutMs: cfg.timeoutMs,
          });
    this.cache.set(node, client);
    return client;
  }
}
