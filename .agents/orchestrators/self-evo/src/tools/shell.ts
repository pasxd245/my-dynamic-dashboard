import { spawn } from "node:child_process";
import { appendFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CheckResult, CheckStatus } from "../types.js";

export interface Command {
  /** Binary or shell builtin (must be on PATH or absolute). */
  bin: string;
  /** Argv — never a single shell string. No interpolation. */
  args: string[];
}

/**
 * Built-in channel → commands table. Hardcoded so config doesn't carry
 * shell strings. Tests substitute via `RunChecksOptions.commands`.
 */
export const VERIFY_COMMANDS: Record<string, Command[]> = {
  lint: [{ bin: "pnpm", args: ["md:lint"] }],
  typecheck: [{ bin: "pnpm", args: ["-r", "typecheck"] }],
  tests: [{ bin: "pnpm", args: ["-r", "test"] }],
  smoke: [{ bin: "pnpm", args: ["dev:builder:smoke:stub"] }],
};

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const TAIL_LINES = 40;

export interface RunChecksOptions {
  /** Channel names to run. */
  channels: readonly string[];
  /** Working directory. */
  cwd: string;
  /** Where to write the full verification log. Truncated at start. */
  logPath: string;
  /** Override the channel→commands map (tests). */
  commands?: Record<string, Command[]>;
  /** Per-command timeout in ms. */
  timeoutMs?: number;
  /** Optional env overlay. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Tail buffer that keeps only the last N non-empty lines across one or
 * more streams. Cheap, no external deps; appends each line to a file
 * as it arrives.
 */
class TailBuffer {
  private buf: string[] = [];
  private leftover = "";
  constructor(private readonly capacity: number) {}
  push(chunk: string): string[] {
    const combined = this.leftover + chunk;
    const parts = combined.split(/\r?\n/);
    this.leftover = parts.pop() ?? "";
    const written: string[] = [];
    for (const line of parts) {
      const ln = line.trimEnd();
      if (ln.length === 0) continue;
      this.buf.push(ln);
      written.push(ln);
      if (this.buf.length > this.capacity) this.buf.shift();
    }
    return written;
  }
  flush(): void {
    if (this.leftover.trim().length === 0) return;
    this.buf.push(this.leftover.trim());
    if (this.buf.length > this.capacity) this.buf.shift();
    this.leftover = "";
  }
  tail(): string {
    return this.buf.join("\n");
  }
}

async function runOne(
  cmd: Command,
  cwd: string,
  logPath: string,
  channel: string,
  tail: TailBuffer,
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<{ ok: boolean; signal?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.bin, cmd.args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    const onData = async (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const lines = tail.push(text);
      if (lines.length) {
        await appendFile(logPath, lines.map((l) => `[${channel}] ${l}\n`).join(""), "utf8");
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timer);
      tail.push(`spawn error: ${err.message}\n`);
      resolve({ ok: false });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      tail.flush();
      if (timedOut) {
        tail.push(`(timed out after ${timeoutMs}ms)\n`);
        resolve({ ok: false, signal: "SIGTERM" });
        return;
      }
      resolve({ ok: code === 0 });
    });
  });
}

export async function runChecks(opts: RunChecksOptions): Promise<{
  checks: CheckResult[];
  failureExcerpts: string[];
  logPath: string;
}> {
  const table = opts.commands ?? VERIFY_COMMANDS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  await mkdir(dirname(opts.logPath), { recursive: true });
  await writeFile(opts.logPath, `# verification log — ${new Date().toISOString()}\n`, "utf8");

  const checks: CheckResult[] = [];
  const failureExcerpts: string[] = [];

  for (const channel of opts.channels) {
    const commands = table[channel];
    const startedAt = Date.now();
    if (!commands || commands.length === 0) {
      checks.push({ name: channel, status: "skip", durationMs: 0 });
      continue;
    }
    const tail = new TailBuffer(TAIL_LINES);
    let status: CheckStatus = "pass";
    for (const cmd of commands) {
      const result = await runOne(
        cmd,
        opts.cwd,
        opts.logPath,
        channel,
        tail,
        timeoutMs,
        opts.env,
      );
      if (!result.ok) {
        status = "fail";
        break;
      }
    }
    const excerpt = status === "fail" ? tail.tail() : undefined;
    checks.push({
      name: channel,
      status,
      durationMs: Date.now() - startedAt,
      excerpt,
    });
    if (excerpt) failureExcerpts.push(`[${channel}] ${excerpt}`);
  }

  return { checks, failureExcerpts, logPath: opts.logPath };
}
