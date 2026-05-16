import { spawn } from "node:child_process";
import type {
  LLMCapabilities,
  LLMClient,
  LLMRequest,
  LLMResponse,
} from "./client.js";

export interface SubprocessClientOptions {
  /** Binary to invoke. Default: `claude`. */
  command?: string;
  /** Args passed before the prompt. Default: `["-p"]`. */
  args?: string[];
  /** Max ms before SIGTERM. Default: 120_000. */
  timeoutMs?: number;
  /** Override capabilities. Default: sequential, maxConcurrency 1. */
  capabilities?: LLMCapabilities;
  /** Optional env overlay. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT = 120_000;

// Spawns `claude -p "<system+user>"` (or a configured equivalent) and
// reads stdout as the model's response. The system + user prompts are
// concatenated with a separator the model knows to treat as the role
// boundary — `claude -p` doesn't expose separate channels, so we lean
// on a delimiter that prompts are written against.
const PROMPT_SEPARATOR = "\n\n---\n\n";

function buildPrompt(req: LLMRequest): string {
  if (!req.system) return req.user;
  return `${req.system}${PROMPT_SEPARATOR}${req.user}`;
}

export function makeSubprocessClient(
  opts: SubprocessClientOptions = {},
): LLMClient {
  const command = opts.command ?? "claude";
  const args = opts.args ?? ["-p"];
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const capabilities = opts.capabilities ?? {
    supportsParallel: false,
    maxConcurrency: 1,
  };

  return {
    mode: "subprocess",
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
      // EPIPE if the child exits before we finish writing — treat as
      // benign; the close handler still surfaces the exit code.
      child.stdin.on("error", () => undefined);
      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch {
        // ignore — same reason as the on("error") above
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
          `Subprocess LLM timed out after ${timeoutMs}ms (command=${command})`,
        );
      }
      if (exitCode !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        throw new Error(
          `Subprocess LLM exited ${exitCode} (command=${command}): ${stderr.slice(0, 500)}`,
        );
      }
      const text = Buffer.concat(stdoutChunks).toString("utf8").trim();
      return { text };
    },
  };
}
