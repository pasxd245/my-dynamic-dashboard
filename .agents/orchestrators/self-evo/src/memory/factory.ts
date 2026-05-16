import type { Mem0ClientLike } from "./types.js";
import { InMemoryMemoryClient } from "./in-memory.js";
import { FileMemoryClient } from "./file.js";

export type Mem0Mode = "memory" | "file" | "cloud";

export interface Mem0Config {
  mode: Mem0Mode;
  /** Path for `file` mode. */
  file?: string;
  /** Reserved for `cloud` mode in a later round. */
  apiKey?: string;
}

export const DEFAULT_MEM0_CONFIG: Mem0Config = {
  mode: "memory",
};

export function buildMemoryClient(cfg: Mem0Config): Mem0ClientLike {
  switch (cfg.mode) {
    case "memory":
      return new InMemoryMemoryClient();
    case "file":
      return new FileMemoryClient({ path: cfg.file });
    case "cloud":
      throw new Error(
        "mem0.mode = cloud is reserved for a later round; install `mem0ai` and wire the adapter then.",
      );
    default:
      throw new Error(`Unknown mem0.mode: ${(cfg as { mode: string }).mode}`);
  }
}
