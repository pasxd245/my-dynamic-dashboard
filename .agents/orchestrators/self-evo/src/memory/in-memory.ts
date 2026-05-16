import { randomUUID } from "node:crypto";
import type {
  Mem0ClientLike,
  MemoryAddInput,
  MemoryRecord,
  MemorySearchOptions,
} from "./types.js";
import { overlapScore } from "./scoring.js";

/**
 * Pure-RAM Mem0-compatible store. Resets on process exit — intended
 * for tests and `mem0.mode = memory` dev runs.
 */
export class InMemoryMemoryClient implements Mem0ClientLike {
  readonly mode = "memory" as const;
  private readonly records = new Map<string, MemoryRecord>();

  async add(input: MemoryAddInput): Promise<MemoryRecord> {
    const record: MemoryRecord = {
      id: randomUUID(),
      text: input.text,
      user_id: input.user_id,
      metadata: input.metadata ?? {},
      createdAt: Date.now(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async search(query: string, opts: MemorySearchOptions): Promise<MemoryRecord[]> {
    const limit = opts.limit ?? 5;
    const ranked: MemoryRecord[] = [];
    for (const r of this.records.values()) {
      if (r.user_id !== opts.user_id) continue;
      if (opts.type && r.metadata.type !== opts.type) continue;
      const score = overlapScore(query, r.text);
      if (score <= 0) continue;
      ranked.push({ ...r, score });
    }
    ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return ranked.slice(0, limit);
  }

  async list(opts: MemorySearchOptions): Promise<MemoryRecord[]> {
    const limit = opts.limit ?? 50;
    const out: MemoryRecord[] = [];
    for (const r of this.records.values()) {
      if (r.user_id !== opts.user_id) continue;
      if (opts.type && r.metadata.type !== opts.type) continue;
      out.push(r);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out.slice(0, limit);
  }

  /** Test helper. */
  size(): number {
    return this.records.size;
  }

  /** Test helper. */
  clear(): void {
    this.records.clear();
  }
}
