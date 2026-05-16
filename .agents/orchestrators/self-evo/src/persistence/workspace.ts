import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { SelfEvoStateT } from "../state.js";

const DEFAULT_ROOT = ".agents/orchestrators/self-evo/runs";

export interface WorkspaceLayout {
  root: string;
  runDir: string;
  statePath: string;
  patchesDir: string;
  checkpointPath: string;
  verificationLog: string;
}

export function newRunId(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19);
  const suffix = randomBytes(2).toString("hex");
  return `${iso}-${suffix}`;
}

export function resolveRoot(configured?: string): string {
  return resolve(process.cwd(), configured ?? DEFAULT_ROOT);
}

export function layoutFor(runId: string, root?: string): WorkspaceLayout {
  const r = resolveRoot(root);
  const runDir = join(r, runId);
  return {
    root: r,
    runDir,
    statePath: join(runDir, "state.json"),
    patchesDir: join(runDir, "patches"),
    checkpointPath: join(runDir, "checkpoint.sqlite"),
    verificationLog: join(runDir, "verification.log"),
  };
}

export async function ensureWorkspace(layout: WorkspaceLayout): Promise<void> {
  await mkdir(layout.runDir, { recursive: true });
  await mkdir(layout.patchesDir, { recursive: true });
}

export async function writeStateSnapshot(
  layout: WorkspaceLayout,
  state: SelfEvoStateT | Partial<SelfEvoStateT>,
): Promise<void> {
  await writeFile(layout.statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}
