import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SelfEvoStateT, SelfEvoUpdate } from "../state.js";
import type { AgentServices } from "../agent-services.js";
import type { MemoryAddInput, MemoryType } from "../memory/types.js";
import { SELF_EVO_USER_ID } from "../memory/types.js";
import {
  renderRoundMarkdown,
  roundFilename,
} from "../renderers/round-template.js";
import { appendPromotion } from "../renderers/promotions.js";

export interface RoundWriterConfig {
  /**
   * Directory holding `Round_NN.md` files. Defaults to
   * `<repoRoot>/.agents/plan/cycles`.
   */
  cyclesDir?: string;
  /**
   * Promotions log path. Defaults to
   * `<repoRoot>/.agents/plan/promotions.md`.
   */
  promotionsPath?: string;
}

const ROUND_RE = /^Round_(\d+)\.md$/i;

async function nextRoundNumber(cyclesDir: string): Promise<number> {
  if (!existsSync(cyclesDir)) return 1;
  const entries = await readdir(cyclesDir);
  let max = 0;
  for (const name of entries) {
    const m = ROUND_RE.exec(name);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

interface DerivedMemory {
  text: string;
  type: MemoryType;
  stage: string;
}

// Derive a small set of cross-round memories from state. These are
// drafts — `metadata.draft = true` — that a future round-cleanup pass
// (or the human, by editing the JSONL file) can promote/demote. We
// stay conservative on volume: one decision per round + one
// convention per assumption + one pitfall per failing channel.
function deriveMemoryCandidates(state: SelfEvoStateT): DerivedMemory[] {
  const out: DerivedMemory[] = [];

  if (state.topic) {
    out.push({
      text: `Round closed for: ${state.topic}`,
      type: "decision",
      stage: "round-writer",
    });
  }

  for (const a of state.scope?.assumptions ?? []) {
    out.push({ text: a, type: "convention", stage: "boundary-scoper" });
  }

  for (const c of state.verification?.checks ?? []) {
    if (c.status !== "fail" || !c.excerpt) continue;
    const summary = c.excerpt.split(/\r?\n/)[0] ?? c.excerpt;
    out.push({
      text: `verifier:${c.name} failed — ${summary}`,
      type: "pitfall",
      stage: "verifier",
    });
  }

  return out;
}

// R-G: rewrites the round-writer node. On approve, we:
//   1. mint the next round number from `.agents/plan/cycles/`,
//   2. render `Round_NN.md` from state via the template renderer,
//   3. write it next to existing rounds,
//   4. append a one-line entry to `promotions.md`,
//   5. push derived memory candidates into `services.memory` (if
//      wired) so the next round's intake can surface them.
// Everything is best-effort — even if mem0.add throws, the round file
// still lands, and the orchestrator finishes with `state.round` set.
export function makeRoundWriterNode(services: AgentServices, cfg: RoundWriterConfig = {}) {
  return async function roundWriterNode(state: SelfEvoStateT): Promise<SelfEvoUpdate> {
    const repoRoot = services.repoRoot;
    const cyclesDir = resolve(repoRoot, cfg.cyclesDir ?? ".agents/plan/cycles");
    const promotionsPath = resolve(
      repoRoot,
      cfg.promotionsPath ?? ".agents/plan/promotions.md",
    );

    await mkdir(cyclesDir, { recursive: true });

    const number = await nextRoundNumber(cyclesDir);
    const filename = roundFilename(number);
    const filePath = join(cyclesDir, filename);
    const startedAt = new Date().toISOString().slice(0, 10);
    const markdown = renderRoundMarkdown(state, { number, startedAt });
    await writeFile(filePath, markdown, "utf8");

    try {
      await appendPromotion(promotionsPath, {
        date: startedAt,
        topic: state.topic || `Round ${number}`,
        source: filePath.replace(repoRoot + "/", ""),
        rationale:
          "auto-emitted by `self-evo` round-writer; human curates before promotion",
        promotedBy: "self-evo (auto)",
      });
    } catch (err) {
      console.error(
        `[round-writer] promotions.md append failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (services.memory) {
      const candidates = deriveMemoryCandidates(state);
      for (const c of candidates) {
        const input: MemoryAddInput = {
          text: c.text,
          user_id: SELF_EVO_USER_ID,
          metadata: {
            round: number,
            stage: c.stage,
            topic: state.topic,
            type: c.type,
            draft: true,
          },
        };
        try {
          await services.memory.add(input);
        } catch (err) {
          console.error(
            `[round-writer] memory.add failed (${c.type}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return {
      round: {
        number,
        path: filePath,
      },
    };
  };
}
