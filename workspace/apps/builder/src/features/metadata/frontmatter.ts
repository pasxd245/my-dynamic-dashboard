// R180 — the product does NOT interpret frontmatter. It only splits a leading
// `---` block off the markdown and shows its `key: value` lines as a table;
// nested YAML, lists or anything else stay as the text they are.

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
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (m) pairs.push([m[1] ?? '', (m[2] ?? '').trim()]);
    else if (line.trim()) pairs.push(['', line.trim()]);
  }
  return { pairs, body: body.replace(/^\s*\n/, '') };
}
