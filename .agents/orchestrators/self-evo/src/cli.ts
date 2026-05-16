#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import minimist from "minimist";
import { resolve } from "node:path";
import { Command, isInterrupted } from "@langchain/langgraph";
import { compileGraph } from "./graph.js";
import { loadConfig, type Config } from "./config.js";
import { LLMResolver, loadLlmConfig } from "./llm/resolver.js";
import type { AgentServices } from "./agent-services.js";
import { buildMemoryClient } from "./memory/factory.js";
import { SELF_EVO_USER_ID, type MemoryType } from "./memory/types.js";
import {
  ensureWorkspace,
  layoutFor,
  newRunId,
  writeStateSnapshot,
} from "./persistence/workspace.js";
import { makeCheckpointer } from "./persistence/checkpointer.js";
import type { HitlDecision, RevertTarget } from "./types.js";

async function buildServices(config: Config): Promise<AgentServices> {
  const llmConfig = await loadLlmConfig(config.llm.configPath);
  const services: AgentServices = {
    resolver: new LLMResolver(llmConfig),
    skillsRoot: resolve(process.cwd(), config.skills.dir),
    repoRoot: process.cwd(),
    workspaceRoot: resolve(process.cwd(), config.run.workspaceDir),
  };
  if (config.mem0.mode !== "disabled") {
    services.memory = buildMemoryClient({
      mode: config.mem0.mode,
      file: config.mem0.file,
      apiKey: config.mem0.apiKey,
    });
  }
  return services;
}

const HELP = `
@self/orchestrator — self-evo

Usage:
  self-evo round <topic> [--req <text> ...] [--reqfile <path>] [--config <path>]
  self-evo resume <runId> [--config <path>] [--decision <line>]
  self-evo memories list   [--type <type>] [--limit <n>] [--config <path>]
  self-evo memories search <query> [--type <type>] [--limit <n>] [--config <path>]
  self-evo help

Examples:
  self-evo round "Replace upload-flow state" --req "Keep tests green"
  echo "approve" | self-evo resume 2026-05-16-...
  self-evo memories search "upload flow"
`;

const REVERT_STAGES: ReadonlySet<RevertTarget> = new Set([
  "intake",
  "repo-scanner",
  "boundary-scoper",
  "change-classifier",
  "plan-writer",
  "patch-author",
  "verifier",
]);

function parseDecision(line: string): HitlDecision {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "quit" };
  const parts = trimmed.split(/\s+/);
  const head = parts[0]?.toLowerCase();
  if (head === "approve") return { kind: "approve" };
  if (head === "quit" || head === "exit") return { kind: "quit" };
  if (head === "revise") {
    const stage = parts[1] as RevertTarget | undefined;
    if (!stage || !REVERT_STAGES.has(stage)) {
      throw new Error(
        `revise requires a stage. Got "${stage ?? ""}". ` +
          `Stages: ${[...REVERT_STAGES].join(", ")}`,
      );
    }
    const note = parts.slice(2).join(" ");
    return { kind: "revise", stage, note: note || undefined };
  }
  throw new Error(`Unrecognised HITL line: "${line}"`);
}

async function readReqsFile(path: string): Promise<string[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

async function runRound(argv: minimist.ParsedArgs): Promise<void> {
  const topic = (argv._[1] ?? argv.t ?? argv.topic ?? "").toString();
  if (!topic) {
    console.error("round: topic is required");
    console.error(HELP);
    process.exit(2);
  }
  const reqArg = argv.req ?? [];
  const reqs = (Array.isArray(reqArg) ? reqArg : [reqArg]).map(String);
  if (argv.reqfile) reqs.push(...(await readReqsFile(String(argv.reqfile))));

  const config = await loadConfig(argv.config);
  const runId = newRunId();
  const layout = layoutFor(runId, config.run.workspaceDir);
  await ensureWorkspace(layout);

  const services = await buildServices(config);
  const checkpointer = makeCheckpointer(layout);
  const graph = compileGraph(services, checkpointer, {
    verifier: {
      defaultChannels: config.verify.defaultChannels,
      byChangeType: config.verify.byChangeType,
      timeoutMs: config.verify.timeoutMs,
    },
    judge: config.reflection.enabled
      ? {
          approveThreshold: config.reflection.approveThreshold,
          maxIterations: config.reflection.maxIterations,
        }
      : {
          // Effectively disable reflection by capping at 1 iteration.
          approveThreshold: 0,
          maxIterations: 1,
        },
  });
  const threadConfig = { configurable: { thread_id: runId } };

  const input = {
    runId,
    topic,
    requirements: reqs.map((text, i) => ({
      id: `R${String(i + 1).padStart(2, "0")}`,
      text,
    })),
  };

  const out = await graph.invoke(input, threadConfig);
  const snap = await graph.getState(threadConfig);
  await writeStateSnapshot(layout, snap.values ?? out);
  if (isInterrupted(out)) {
    console.log(`runId: ${runId}`);
    console.log(`state: ${layout.statePath}`);
    console.log(`patches: ${layout.patchesDir}`);
    console.log(`HITL: approve | revise <stage> [note] | quit`);
    console.log(`resume with: self-evo resume ${runId}`);
    return;
  }
  console.log(`runId: ${runId}`);
  console.log(`state: ${layout.statePath}`);
  console.log(`status: completed (no HITL)`);
}

async function readDecisionFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const line = await rl.question("> ");
    rl.close();
    return line;
  }
  return new Promise((resolve_) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => resolve_(buf.split(/\r?\n/)[0] ?? ""));
  });
}

async function runResume(argv: minimist.ParsedArgs): Promise<void> {
  const runId = (argv._[1] ?? "").toString();
  if (!runId) {
    console.error("resume: runId is required");
    process.exit(2);
  }
  const config = await loadConfig(argv.config);
  const layout = layoutFor(runId, config.run.workspaceDir);

  const decisionLine =
    typeof argv.decision === "string" && argv.decision
      ? argv.decision
      : await readDecisionFromStdin();
  const decision = parseDecision(decisionLine);

  const services = await buildServices(config);
  const checkpointer = makeCheckpointer(layout);
  const graph = compileGraph(services, checkpointer, {
    verifier: {
      defaultChannels: config.verify.defaultChannels,
      byChangeType: config.verify.byChangeType,
      timeoutMs: config.verify.timeoutMs,
    },
    judge: config.reflection.enabled
      ? {
          approveThreshold: config.reflection.approveThreshold,
          maxIterations: config.reflection.maxIterations,
        }
      : {
          // Effectively disable reflection by capping at 1 iteration.
          approveThreshold: 0,
          maxIterations: 1,
        },
  });
  const threadConfig = { configurable: { thread_id: runId } };

  const out = await graph.invoke(new Command({ resume: decision }), threadConfig);
  const snap = await graph.getState(threadConfig);
  await writeStateSnapshot(layout, snap.values ?? out);
  if (isInterrupted(out)) {
    console.log(`runId: ${runId}`);
    console.log(`state: ${layout.statePath}`);
    console.log(`HITL: approve | revise <stage> [note] | quit`);
    return;
  }
  console.log(`runId: ${runId}`);
  console.log(`state: ${layout.statePath}`);
  const stageSuffix = decision.stage ? " " + decision.stage : "";
  console.log(`decision: ${decision.kind}${stageSuffix}`);
  console.log(`status: completed`);
}

function asScalarString(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function formatMemoryRow(r: {
  id: string;
  text: string;
  score?: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}): string {
  const score = r.score !== undefined ? ` score=${r.score.toFixed(2)}` : "";
  const roundStr = asScalarString(r.metadata.round);
  const typeStr = asScalarString(r.metadata.type);
  const round = roundStr ? ` round=${roundStr}` : "";
  const type = typeStr ? ` type=${typeStr}` : "";
  const date = new Date(r.createdAt).toISOString().slice(0, 19);
  return `${date}  ${r.id.slice(0, 8)}${round}${type}${score}  ${r.text}`;
}

async function runMemories(argv: minimist.ParsedArgs): Promise<void> {
  const sub = argv._[1];
  const isKnown = sub === "list" || sub === "search";
  if (!isKnown) {
    console.error(`memories: unknown subcommand "${sub ?? ""}"`);
    console.error(HELP);
    process.exit(2);
  }
  const config = await loadConfig(argv.config);
  if (config.mem0.mode === "disabled") {
    console.error("memories: mem0.mode is `disabled` — nothing to list/search");
    process.exit(2);
  }
  const services = await buildServices(config);
  const mem = services.memory;
  if (!mem) {
    console.error("memories: no memory client constructed");
    process.exit(2);
  }
  const limit = Number(argv.limit ?? 20);
  const type = (argv.type as MemoryType | undefined) || undefined;
  const records =
    sub === "list"
      ? await mem.list({ user_id: SELF_EVO_USER_ID, limit, type })
      : await mem.search(String(argv._[2] ?? ""), {
          user_id: SELF_EVO_USER_ID,
          limit,
          type,
        });
  if (records.length === 0) {
    console.log("(no memories)");
    return;
  }
  for (const r of records) console.log(formatMemoryRow(r));
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ["config", "reqfile", "decision", "topic", "t", "type", "limit"],
    alias: { t: "topic" },
  });
  const cmd = argv._[0];
  if (cmd === "round") return runRound(argv);
  if (cmd === "resume") return runResume(argv);
  if (cmd === "memories") return runMemories(argv);
  if (cmd === "help" || cmd === undefined || argv.h || argv.help) {
    console.log(HELP);
    return;
  }
  console.error(`Unknown command: ${cmd}`);
  console.error(HELP);
  process.exit(2);
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
}
