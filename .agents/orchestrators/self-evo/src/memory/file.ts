import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  Mem0ClientLike,
  MemoryAddInput,
  MemoryRecord,
  MemorySearchOptions,
} from "./types.js";
import { overlapScore } from "./scoring.js";

/**
 * JSONL-backed Mem0-compatible store. Each `add` appends one line;
 * `search` / `list` re-read the file on every call (cheap for the
 * memory volumes self-evo generates — hundreds of rows at most).
 *
 * Path defaults to `.agents/orchestrators/self-evo/memories.jsonl`
 * (relative to cwd), overridable via the `file` option or
 * `SELFEVO_MEM0_FILE`.
 */
export class FileMemoryClient implements Mem0ClientLike {
  readonly mode = "file" as const;
  readonly path: string;

  constructor(opts: { path?: string } = {}) {
    const fromEnv = process.env.SELFEVO_MEM0_FILE;
    this.path = resolve(
      process.cwd(),
      opts.path ?? fromEnv ?? ".agents/orchestrators/self-evo/memories.jsonl",
    );
  }

  private async ensureFile(): Promise<void> {
    if (existsSync(this.path)) return;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, "", "utf8");
  }

  private async readAll(): Promise<MemoryRecord[]> {
    if (!existsSync(this.path)) return [];
    const raw = await readFile(this.path, "utf8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const out: MemoryRecord[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as MemoryRecord);
      } catch {
        // Skip malformed lines — keep the rest readable.
      }
    }
    return out;
  }

  async add(input: MemoryAddInput): Promise<MemoryRecord> {
    await this.ensureFile();
    const record: MemoryRecord = {
      id: randomUUID(),
      text: input.text,
      user_id: input.user_id,
      metadata: input.metadata ?? {},
      createdAt: Date.now(),
    };
    await appendFile(this.path, JSON.stringify(record) + "\n", "utf8");
    return record;
  }

  async search(query: string, opts: MemorySearchOptions): Promise<MemoryRecord[]> {
    const all = await this.readAll();
    const limit = opts.limit ?? 5;
    const ranked: MemoryRecord[] = [];
    for (const r of all) {
      if (r.user_id !== opts.user_id) continue;
      if (opts.type && r.metadata?.type !== opts.type) continue;
      const score = overlapScore(query, r.text);
      if (score <= 0) continue;
      ranked.push({ ...r, score });
    }
    ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return ranked.slice(0, limit);
  }

  async list(opts: MemorySearchOptions): Promise<MemoryRecord[]> {
    const all = await this.readAll();
    const limit = opts.limit ?? 50;
    const out = all.filter(
      (r) =>
        r.user_id === opts.user_id &&
        (!opts.type || r.metadata?.type === opts.type),
    );
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out.slice(0, limit);
  }
}
