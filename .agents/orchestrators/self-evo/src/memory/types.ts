// Mem0-compatible client interface. We define our own so v1 can ship
// a zero-dep in-memory backend AND a file-backed backend without
// installing `mem0ai`. When real Mem0 is wired in a later round, we
// add an adapter that satisfies this same interface, and intake +
// round-writer keep working.

export type MemoryType =
  | "decision"
  | "pitfall"
  | "convention"
  | "fix-recipe"
  | "boundary-rule";

export interface MemoryMetadata {
  /** PDCA round number (e.g. 1, 14). Required when written by round-writer. */
  round?: number;
  /** Source pipeline stage. */
  stage?: string;
  /** Topic of the round that produced this memory. */
  topic?: string;
  type?: MemoryType;
  /** Free-form tags. */
  tags?: string[];
  /** Arbitrary extensions — never relied on by the orchestrator core. */
  [key: string]: unknown;
}

export interface MemoryRecord {
  id: string;
  text: string;
  user_id: string;
  metadata: MemoryMetadata;
  createdAt: number;
  /** Populated only on search results. 0 .. 1. */
  score?: number;
}

export interface MemoryAddInput {
  text: string;
  user_id: string;
  metadata?: MemoryMetadata;
}

export interface MemorySearchOptions {
  user_id: string;
  /** Cap on returned records. Default 5. */
  limit?: number;
  /** Optional type filter; matches against metadata.type. */
  type?: MemoryType;
}

export interface Mem0ClientLike {
  readonly mode: "memory" | "file" | "cloud";
  add(input: MemoryAddInput): Promise<MemoryRecord>;
  search(query: string, opts: MemorySearchOptions): Promise<MemoryRecord[]>;
  list(opts: MemorySearchOptions): Promise<MemoryRecord[]>;
}

export const SELF_EVO_USER_ID = "self-evo";
