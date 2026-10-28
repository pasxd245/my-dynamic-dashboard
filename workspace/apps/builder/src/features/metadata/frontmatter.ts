// R180 — the product does NOT interpret frontmatter. It only splits a leading
// `---` block off the markdown and shows its `key: value` lines as a table;
// nested YAML, lists or anything else stay as the text they are.
// R202 — three keys are read by the builder (`reserved.ts`); the rest stay pairs.

export type Frontmatter = { pairs: [string, string][]; body: string };

const FENCE = /^---[ \t]*\r?\n/;

export function splitFrontmatter(md: string): Frontmatter {
  if (!FENCE.test(md)) return { pairs: [], body: md };
  const rest = md.replace(FENCE, '');
  const end = rest.search(/^---[ \t]*(\r?\n|$)/m);
  if (end === -1) return { pairs: [], body: md };
  const block = rest.slice(0, end);
  const body = rest.slice(end).replace(/^---[ \t]*\r?\n?/, '');
  const pairs: [string, string][] = [];
  for (const line of block.split(/\r?\n/)) {
    // R180 ASCII keys as before (any length); R202 — or a key in any script with inner
    // spaces (`Dữ liệu đến`), ≤ 40 chars, not starting with a list marker.
    const m = /^([A-Za-z0-9_.-]+|[\p{L}\p{N}_][\p{L}\p{N}\p{M}_. -]{0,39}?)\s*:\s*(.*)$/u.exec(line);
    if (m) pairs.push([m[1] ?? '', (m[2] ?? '').trim()]);
    else if (line.trim()) pairs.push(['', line.trim()]);
  }
  return { pairs, body: body.replace(/^\s*\n/, '') };
}
