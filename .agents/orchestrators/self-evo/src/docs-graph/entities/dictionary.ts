import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yaml from "js-yaml";

export interface DictEntity {
  id: string;
  display: string;
  kind: "tool" | "spec" | "symbol" | "file" | "concept";
  aliases: string[];
  codeHints: string[];
}

export interface EntityDictionary {
  entities: DictEntity[];
}

export const DEFAULT_DICT_PATH =
  ".agents/orchestrators/self-evo/config/docs-graph-entities.yaml";

export async function loadDictionary(path: string): Promise<EntityDictionary> {
  const body = await readFile(resolve(path), "utf8");
  const parsed = yaml.load(body) as Partial<EntityDictionary> | null;
  if (!parsed || !Array.isArray(parsed.entities)) {
    throw new Error(`dictionary at ${path} is empty or malformed`);
  }
  const seen = new Set<string>();
  for (const e of parsed.entities) {
    if (!e.id) throw new Error(`dictionary entry missing id: ${JSON.stringify(e)}`);
    if (seen.has(e.id)) throw new Error(`dictionary has duplicate id "${e.id}"`);
    seen.add(e.id);
    e.aliases = Array.isArray(e.aliases) ? e.aliases : [];
    e.codeHints = Array.isArray(e.codeHints) ? e.codeHints : [];
    // The display string is always a valid match for the entity.
    if (!e.aliases.includes(e.display)) e.aliases.unshift(e.display);
  }
  return { entities: parsed.entities as DictEntity[] };
}
