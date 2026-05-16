import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Patch } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";
import { layoutFor } from "../persistence/workspace.js";
import {
  extractPathFromDiff,
  gitApplyCheck,
  withinBoundary,
} from "../tools/patch.js";

const SYSTEM_BASE = [
  "You are the `patch-author` agent in a self-evolution orchestrator.",
  "Given a plan, a scope, and findings, produce a JSON object of",
  "unified diffs that, taken together, advance the plan.",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"diffs":[{"path":string,"explanation":string,"diff":string}]}',
  "",
  "Each `diff` MUST:",
  "- be a single-file unified diff with `--- a/<path>` and `+++ b/<path>`",
  "  headers,",
  "- target a `path` that matches one of `scope.allowedFiles` (glob),",
  "- apply cleanly to the current HEAD of the repository,",
  "- include accurate hunk headers (`@@ -L,N +L,N @@`).",
  "",
  "Do NOT include deletions (`+++ /dev/null`). Keep diffs small and",
  "self-contained — one hunk per file is preferred. Aim for 1–4",
  "diffs total. If you cannot produce a clean diff for a step, omit",
  "it rather than guessing line numbers.",
].join("\n");

interface DiffsResponse {
  diffs?: Array<{ path?: unknown; explanation?: unknown; diff?: unknown }>;
}

interface RejectedDiff {
  index: number;
  path?: string;
  reason: string;
}

type ValidateResult =
  | { ok: true; path: string; diff: string }
  | { ok: false; path?: string; reason: string };

async function validateCandidate(
  candidate: { path?: unknown; diff?: unknown },
  allowedFiles: readonly string[],
  repoRoot: string,
): Promise<ValidateResult> {
  const diff = typeof candidate.diff === "string" ? candidate.diff : "";
  if (!diff) return { ok: false, reason: "empty diff" };
  const headerPath = extractPathFromDiff(diff);
  const declaredPath =
    typeof candidate.path === "string" ? candidate.path : undefined;
  const path = headerPath ?? declaredPath;
  if (!path) return { ok: false, reason: "missing +++ b/<path> header" };
  if (!withinBoundary(path, allowedFiles)) {
    return { ok: false, path, reason: "outside scope.allowedFiles" };
  }
  const check = await gitApplyCheck(diff, repoRoot);
  if (!check.ok) {
    return {
      ok: false,
      path,
      reason: `git apply --check failed: ${check.error ?? "(no stderr)"}`,
    };
  }
  return { ok: true, path, diff };
}

function renderUserPrompt(state: SelfEvoStateT): string {
  return [
    `Topic: ${state.topic}`,
    `ChangeType: ${state.changeType ?? "(unset)"}`,
    "",
    "Scope.inScope:",
    state.scope?.inScope.join("\n") || "(none)",
    "",
    "Scope.allowedFiles (you may ONLY modify paths matching these globs):",
    state.scope?.allowedFiles.join("\n") || "(none)",
    "",
    "Plan:",
    state.plan.map((p) => `- [${p.id}] ${p.text}`).join("\n") || "(none)",
    "",
    "Findings (first 5):",
    state.findings.slice(0, 5).map((f) => `- ${f.claim}`).join("\n") || "(none)",
  ].join("\n");
}

function safeBasename(path: string): string {
  const b = basename(path);
  return b.replace(/[^a-zA-Z0-9._-]+/g, "_") || "patch";
}

// Rewritten in R-E. Calls the LLM for unified diffs, then runs each
// through (a) shape validation, (b) `scope.allowedFiles` boundary
// check, (c) `git apply --check`. Accepted diffs land in
// `state.patches[]` with `applied: false`, and the raw text is also
// written under `runs/<runId>/patches/`. Rejected diffs are logged via
// stderr but never make the orchestrator throw — patch-author always
// finishes the stage so HITL can see what the model tried.
export function makePatchAuthorNode(services: AgentServices) {
  return async function patchAuthorNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const layout = layoutFor(state.runId, services.workspaceRoot);
    await mkdir(layout.patchesDir, { recursive: true });

    const allowedFiles = state.scope?.allowedFiles ?? [];
    if (allowedFiles.length === 0) {
      // No boundary defined — refuse to write anything. The HITL gate
      // sees an empty `patches` array and a stderr warning.
      console.error(
        "[patch-author] scope.allowedFiles is empty; skipping diff generation",
      );
      return { patches: [] };
    }

    const llm = services.resolver.for("patch-author");
    const skillNames = services.resolver.skillsFor("patch-author");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE, skills);
    const user = renderUserPrompt(state);
    const res = await llm.complete({ system, user, tag: "patch-author" });
    const parsed = parseJsonResponse<DiffsResponse>(res.text);
    const candidates = Array.isArray(parsed?.diffs) ? parsed.diffs : [];

    const accepted: Patch[] = [];
    const rejected: RejectedDiff[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const result = await validateCandidate(
        candidates[i] ?? {},
        allowedFiles,
        services.repoRoot,
      );
      if (!result.ok) {
        rejected.push({ index: i, path: result.path, reason: result.reason });
        continue;
      }
      const seq = String(accepted.length + 1).padStart(2, "0");
      const filename = `${seq}-${safeBasename(result.path)}.patch`;
      const filePath = join(layout.patchesDir, filename);
      const content = result.diff.endsWith("\n") ? result.diff : result.diff + "\n";
      await writeFile(filePath, content, "utf8");
      accepted.push({ path: result.path, diff: result.diff, applied: false });
    }

    if (rejected.length) {
      console.error(
        `[patch-author] rejected ${rejected.length}/${candidates.length} diff(s):`,
      );
      for (const r of rejected) {
        const pathLabel = r.path ? " " + r.path : "";
        console.error(`  [${r.index}]${pathLabel} — ${r.reason}`);
      }
    }

    return { patches: accepted };
  };
}
