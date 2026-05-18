import { spawn } from "node:child_process";
import type {
  LLMCapabilities,
  LLMClient,
  LLMRequest,
  LLMResponse,
} from "./client.js";

export interface CodexClientOptions {
  /** Binary to invoke. Default: `codex`. */
  command?: string;
  /** Args passed before the prompt. Default: `["exec", "-"]`. */
  args?: string[];
  /** Max ms before SIGTERM. Default: 300_000. */
  timeoutMs?: number;
  /** Override capabilities. Default: sequential, maxConcurrency 1. */
  capabilities?: LLMCapabilities;
  /** Optional env overlay. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT = 300_000;

const PROMPT_SEPARATOR = "\n\n---\n\n";

function buildPrompt(req: LLMRequest): string {
  if (!req.system) return req.user;
  return `${req.system}${PROMPT_SEPARATOR}${req.user}`;
}

export function makeCodexClient(
  opts: CodexClientOptions = {},
): LLMClient {
  const command = opts.command ?? "codex";
  const args = opts.args ?? ["exec", "-"];
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const capabilities = opts.capabilities ?? {
    supportsParallel: false,
    maxConcurrency: 1,
  };

  return {
    mode: "codex",
    capabilities,
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const prompt = buildPrompt(req);
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...opts.env },
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (c) => stdoutChunks.push(Buffer.from(c)));
      child.stderr.on("data", (c) => stderrChunks.push(Buffer.from(c)));
      child.stdin.on("error", () => undefined);
      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch {
        // ignore — EPIPE if child exits before write completes
      }

      const exitCode: number = await new Promise((resolve, reject) => {
        child.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve(code ?? 0);
        });
      });

      if (timedOut) {
        throw new Error(
          `Codex LLM timed out after ${timeoutMs}ms (command=${command})`,
        );
      }
      if (exitCode !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        throw new Error(
          `Codex LLM exited ${exitCode} (command=${command}): stderr=${stderr.slice(0, 500)} stdout=${Buffer.concat(stdoutChunks).toString("utf8").slice(0, 500)}`,
        );
      }
      const text = Buffer.concat(stdoutChunks).toString("utf8").trim();
      return { text };
    },
  };
}
