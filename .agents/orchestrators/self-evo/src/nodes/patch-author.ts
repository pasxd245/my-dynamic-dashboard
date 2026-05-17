import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { Patch, PlanStep } from "../types.js";
import { loadSkills } from "../skills/loader.js";
import { composeSystemPrompt } from "../skills/compose.js";
import { parseJsonResponse } from "../parsers.js";
import { layoutFor } from "../persistence/workspace.js";
import {
  extractPathFromDiff,
  gitApplyCheck,
  withinBoundary,
} from "../tools/patch.js";

const SYSTEM_BASE_STEP = [
  "You are the `patch-author` agent in a self-evolution orchestrator.",
  "Given a single plan step, a scope, and findings, produce ONE unified",
  "diff that implements that step — or return an empty diff list if the",
  "step is non-code (documentation note, verification reminder, etc.).",
  "",
  "Return ONLY a JSON object of the shape:",
  '{"diff":string|null,"path":string|null,"explanation":string}',
  "",
  "When `diff` is a string it MUST:",
  "- be a single-file unified diff with `--- a/<path>` and `+++ b/<path>`",
  "  headers,",
  "- target a `path` that matches one of `scope.allowedFiles` (glob),",
  "- apply cleanly to the current HEAD of the repository,",
  "- include accurate hunk headers (`@@ -L,N +L,N @@`).",
  "",
  "If you cannot produce a clean diff for this step, return",
  '`{"diff":null,"path":null,"explanation":"<one-line reason>"}` —',
  "never invent line numbers.",
].join("\n");

interface StepDiffResponse {
  diff?: unknown;
  path?: unknown;
  explanation?: unknown;
}

interface RejectedDiff {
  stepId: string;
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

function renderStepPrompt(state: SelfEvoStateT, step: PlanStep): string {
  return [
    `Topic: ${state.topic}`,
    `ChangeType: ${state.changeType ?? "(unset)"}`,
    "",
    `Plan step ${step.id}:`,
    step.text,
    "",
    "Scope.inScope:",
    state.scope?.inScope.join("\n") || "(none)",
    "",
    "Scope.allowedFiles (you may ONLY modify paths matching these globs):",
    state.scope?.allowedFiles.join("\n") || "(none)",
    "",
    "Findings (for context — only relevant ones):",
    state.findings.slice(0, 5).map((f) => `- ${f.claim}`).join("\n") || "(none)",
    "",
    "Produce ONE diff (or null) for this single step.",
  ].join("\n");
}

function safeBasename(path: string): string {
  const b = basename(path);
  return b.replace(/[^a-zA-Z0-9._-]+/g, "_") || "patch";
}

// R-M: chunked patch-author. Instead of one giant LLM call asking for
// a JSON array of diffs across the whole plan (which timed out on the
// first real round), the node now loops over `state.plan` and makes
// one focused call per step. Each call's output is small enough to
// land within a sane per-call timeout on either transport, and the
// stage's failure mode is "this step couldn't produce a diff" rather
// than "the whole stage hung."
//
// Recommended transport: route `patch-author` to `mode: api` via
// `config/llm.example.yaml` so we get the SDK's lower per-call
// overhead. Subprocess `claude -p` still works but pays the startup
// cost N times — fine for short plans, painful past ~4 steps.
export function makePatchAuthorNode(services: AgentServices) {
  return async function patchAuthorNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const layout = layoutFor(state.runId, services.workspaceRoot);
    await mkdir(layout.patchesDir, { recursive: true });

    const allowedFiles = state.scope?.allowedFiles ?? [];
    if (allowedFiles.length === 0) {
      console.error(
        "[patch-author] scope.allowedFiles is empty; skipping diff generation",
      );
      return { patches: [] };
    }
    if (state.plan.length === 0) {
      console.error(
        "[patch-author] state.plan is empty; nothing to author against",
      );
      return { patches: [] };
    }

    const llm = services.resolver.for("patch-author");
    const skillNames = services.resolver.skillsFor("patch-author");
    const skills = await loadSkills(skillNames, {
      dir: services.skillsRoot,
      ignoreMissing: true,
    });
    const system = composeSystemPrompt(SYSTEM_BASE_STEP, skills);

    const accepted: Patch[] = [];
    const rejected: RejectedDiff[] = [];

    for (const step of state.plan) {
      const user = renderStepPrompt(state, step);
      let res;
      try {
        res = await llm.complete({
          system,
          user,
          tag: `patch-author:${step.id}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        rejected.push({ stepId: step.id, reason: `llm call failed: ${msg}` });
        continue;
      }

      let parsed: StepDiffResponse;
      try {
        parsed = parseJsonResponse<StepDiffResponse>(res.text);
      } catch (err) {
        rejected.push({
          stepId: step.id,
          reason: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      if (parsed.diff === null || parsed.diff === undefined) {
        // Model explicitly declined a diff for this step — not a
        // rejection in the validation sense; just a non-code step.
        continue;
      }

      const result = await validateCandidate(
        { diff: parsed.diff, path: parsed.path },
        allowedFiles,
        services.repoRoot,
      );
      if (!result.ok) {
        rejected.push({
          stepId: step.id,
          path: result.path,
          reason: result.reason,
        });
        continue;
      }

      const seq = String(accepted.length + 1).padStart(2, "0");
      const filename = `${seq}-${step.id}-${safeBasename(result.path)}.patch`;
      const filePath = join(layout.patchesDir, filename);
      const content = result.diff.endsWith("\n") ? result.diff : result.diff + "\n";
      await writeFile(filePath, content, "utf8");
      accepted.push({ path: result.path, diff: result.diff, applied: false });
    }

    if (rejected.length) {
      console.error(
        `[patch-author] rejected ${rejected.length}/${state.plan.length} step(s):`,
      );
      for (const r of rejected) {
        const pathLabel = r.path ? " " + r.path : "";
        console.error(`  [${r.stepId}]${pathLabel} — ${r.reason}`);
      }
    }

    // R-M follow-up #2 (found by round c): the original dedup was
    // too aggressive — it collapsed any same-path diffs to "the
    // largest one." That works for round a's case (N plan steps each
    // emit a `--- /dev/null` creation diff of a new file), but fails
    // for round c's case (N legitimate non-overlapping edits to
    // different regions of an existing file). Fix: only collapse
    // when ALL same-path diffs are creation diffs. For existing
    // files, keep all diffs; apply-verifier (R-I) is the right place
    // to surface sequential apply conflicts.
    const collapsed = collapseCreationDiffs(accepted);
    if (collapsed.length < accepted.length) {
      console.error(
        `[patch-author] collapsed ${accepted.length - collapsed.length} duplicate creation-diff(s); ` +
          "kept the largest per new file",
      );
    }
    return { patches: collapsed };
  };
}

function isCreationDiff(diff: string): boolean {
  // Unified diffs that create a new file start with `--- /dev/null`.
  return /^---\s+\/dev\/null\b/m.test(diff);
}

function collapseCreationDiffs(patches: Patch[]): Patch[] {
  // Group by path. If every diff for a path is a creation diff, keep
  // only the largest. Otherwise (mix of edits, or all edits): pass
  // through unchanged.
  const byPath = new Map<string, Patch[]>();
  for (const p of patches) {
    const arr = byPath.get(p.path) ?? [];
    arr.push(p);
    byPath.set(p.path, arr);
  }
  const out: Patch[] = [];
  for (const p of patches) {
    const group = byPath.get(p.path)!;
    if (group.length === 1) {
      out.push(p);
      continue;
    }
    if (group.every((g) => isCreationDiff(g.diff))) {
      // Same-path creation-diff group: emit only when we hit the
      // largest member, in original order so the patches[] ordering
      // is stable.
      const largest = group.reduce((a, b) =>
        a.diff.length >= b.diff.length ? a : b,
      );
      if (p === largest) out.push(p);
      continue;
    }
    // Mixed or all-edit group: pass through unchanged.
    out.push(p);
  }
  return out;
}
