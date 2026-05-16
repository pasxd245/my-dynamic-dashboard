import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HEADER = `# Promotion Log

> Append-only log of memory entries promoted to \`context/\` or \`skills/\`.
> See [PDCA.md](PDCA.md) for methodology.

---

`;

export interface PromotionEntry {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  topic: string;
  destination?: string;
  source: string;
  rationale: string;
  promotedBy: string;
}

function formatEntry(e: PromotionEntry): string {
  const dest = e.destination ? ` → ${e.destination}` : "";
  return [
    "",
    `## ${e.date}: ${e.topic}${dest}`,
    "",
    `**Source**: ${e.source}`,
    `**Rationale**: ${e.rationale}`,
    `**Promoted by**: ${e.promotedBy}`,
    "",
  ].join("\n");
}

/**
 * Append a promotion entry to `promotions.md`. Creates the file with
 * a minimal header if it doesn't exist yet; otherwise the entry lands
 * at the end. Never rewrites existing content — the file is append-only
 * per the PDCA governance rule.
 */
export async function appendPromotion(
  path: string,
  entry: PromotionEntry,
): Promise<void> {
  if (!existsSync(path)) {
    await writeFile(path, HEADER, "utf8");
  } else {
    // Ensure the file ends with a newline before we append.
    const current = await readFile(path, "utf8");
    if (current.length && !current.endsWith("\n")) {
      await appendFile(path, "\n", "utf8");
    }
  }
  await appendFile(path, formatEntry(entry), "utf8");
}
