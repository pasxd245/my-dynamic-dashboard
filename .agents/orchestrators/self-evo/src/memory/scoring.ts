// Keyword-overlap scoring used by both InMemory and File backends.
// This is intentionally NOT a real embedding — v1 is dev-only and
// works without an API key. When Mem0 Cloud / a real embedder is
// wired in a later round, the adapter swaps these out for semantic
// search and this file goes away.

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "and", "or", "for", "on",
  "in", "at", "by", "with", "as", "be", "this", "that", "it", "from",
  "we", "you", "i", "do", "have", "has", "had", "was", "were", "but",
  "not", "no", "yes", "if", "then", "else",
]);

export function tokenize(text: string): string[] {
  // Hyphens count as separators so a search "upload flow" matches a
  // record containing "upload-flow". Underscores stay inside tokens
  // (`item_id` is one symbol, not two).
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Jaccard-ish overlap, weighted so longer queries don't drown out
 * single-token records. Returns a score in [0, 1].
 */
export function overlapScore(query: string, candidate: string): number {
  const q = new Set(tokenize(query));
  const c = new Set(tokenize(candidate));
  if (q.size === 0 || c.size === 0) return 0;
  let hits = 0;
  for (const tok of q) if (c.has(tok)) hits++;
  const denom = Math.max(q.size, Math.min(c.size, q.size * 2));
  return Math.min(1, hits / denom);
}
