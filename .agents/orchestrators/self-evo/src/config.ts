import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import ini from "ini";

import type { Mem0Mode } from "./memory/factory.js";

export interface Config {
  run: {
    workspaceDir: string;
    checkpointer: "sqlite" | "memory";
  };
  llm: {
    configPath?: string;
  };
  skills: {
    dir: string;
    maxChars: number;
  };
  mem0: {
    /** `disabled` skips memory entirely (intake leaves priorMemories empty). */
    mode: Mem0Mode | "disabled";
    file?: string;
    apiKey?: string;
  };
  verify: {
    /** Channels to run when no `verify.<changeType>` block matches. */
    defaultChannels: string[];
    /** Per-changeType override, e.g. `byChangeType["doc"] = ["lint"]`. */
    byChangeType: Record<string, string[]>;
    timeoutMs?: number;
  };
  reflection: {
    enabled: boolean;
    maxIterations: number;
    approveThreshold: number;
  };
}

export const DEFAULT_CONFIG: Config = {
  run: {
    workspaceDir: ".agents/orchestrators/self-evo/runs",
    checkpointer: "sqlite",
  },
  llm: {},
  skills: {
    dir: ".agents/skills",
    maxChars: 12000,
  },
  mem0: {
    mode: "memory",
  },
  verify: {
    defaultChannels: ["lint"],
    byChangeType: {
      "bug-fix": ["lint", "typecheck", "tests"],
      feature: ["lint", "typecheck", "tests", "smoke"],
      refactor: ["lint", "typecheck", "tests"],
      doc: ["lint"],
      spike: ["lint"],
    },
  },
  reflection: {
    enabled: true,
    maxIterations: 3,
    approveThreshold: 0.8,
  },
};

function parseChannels(value: string | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function pickPath(explicit?: string): string | undefined {
  if (explicit) return resolve(process.cwd(), explicit);
  const env = process.env.SELFEVO_CONFIG;
  if (env) return resolve(process.cwd(), env);
  const cwdPath = resolve(process.cwd(), "config/self-evo.ini");
  if (existsSync(cwdPath)) return cwdPath;
  // The package's own bundled default.
  const pkgPath = resolve(
    process.cwd(),
    ".agents/orchestrators/self-evo/config/self-evo.ini",
  );
  if (existsSync(pkgPath)) return pkgPath;
  return undefined;
}

export async function loadConfig(explicit?: string): Promise<Config> {
  const path = pickPath(explicit);
  if (!path) return DEFAULT_CONFIG;
  const raw = await readFile(path, "utf8");
  const parsed = ini.parse(raw) as Record<string, Record<string, string>>;
  return {
    run: {
      workspaceDir: parsed.run?.workspaceDir ?? DEFAULT_CONFIG.run.workspaceDir,
      checkpointer:
        (parsed.run?.checkpointer as Config["run"]["checkpointer"]) ??
        DEFAULT_CONFIG.run.checkpointer,
    },
    llm: {
      configPath: parsed.llm?.configPath || undefined,
    },
    skills: {
      dir: parsed.skills?.dir ?? DEFAULT_CONFIG.skills.dir,
      maxChars: parsed.skills?.maxChars
        ? Number(parsed.skills.maxChars)
        : DEFAULT_CONFIG.skills.maxChars,
    },
    mem0: {
      mode:
        (parsed.mem0?.mode as Config["mem0"]["mode"]) ?? DEFAULT_CONFIG.mem0.mode,
      file: parsed.mem0?.file || undefined,
      apiKey: parsed.mem0?.apiKey || undefined,
    },
    verify: {
      defaultChannels:
        parseChannels(parsed["verify.default"]?.channels) ??
        DEFAULT_CONFIG.verify.defaultChannels,
      byChangeType: (() => {
        const out: Record<string, string[]> = { ...DEFAULT_CONFIG.verify.byChangeType };
        for (const key of Object.keys(parsed)) {
          if (!key.startsWith("verify.") || key === "verify.default") continue;
          const ct = key.slice("verify.".length);
          const ch = parseChannels(parsed[key]?.channels);
          if (ch) out[ct] = ch;
        }
        return out;
      })(),
      timeoutMs: parsed.verify?.timeoutMs
        ? Number(parsed.verify.timeoutMs)
        : undefined,
    },
    reflection: {
      enabled:
        parsed.reflection?.enabled !== undefined
          ? parsed.reflection.enabled !== "false"
          : DEFAULT_CONFIG.reflection.enabled,
      maxIterations: parsed.reflection?.maxIterations
        ? Number(parsed.reflection.maxIterations)
        : DEFAULT_CONFIG.reflection.maxIterations,
      approveThreshold: parsed.reflection?.approveThreshold
        ? Number(parsed.reflection.approveThreshold)
        : DEFAULT_CONFIG.reflection.approveThreshold,
    },
  };
}
