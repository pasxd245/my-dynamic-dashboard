// R179 — the safe markdown subset, rendered as React nodes.
// R202 (item 5.2) — rendered through `react-markdown` + `remark-gfm` (tables,
// task lists, strikethrough, nested lists; an intraword `_` stays a character).
//
// The R179 invariant is kept: no element is ever produced from raw HTML, and a
// construct outside the safe subset is shown AS THE TEXT IT IS. `literalUnsafe`
// (a remark step that runs before anything becomes HTML) turns raw HTML, images
// and links whose target is not http(s) back into their exact source text; a
// non-http(s) reference definition is dropped, so its `[x]` reads as text. The
// `urlTransform` and `skipHtml` options are a second line behind it. The server
// refuses all three before anything is stored (`app/markdown_safe.py`);
// `markdownProblems` here is the same rule, so the builder can say so before a
// save round-trips.

import { Typography } from 'antd';
import type { ComponentProps, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TAG = /<\s*\/?\s*[A-Za-z!?]/;
const IMAGE = /!\[/;
const INLINE_LINK = /\]\(\s*<?([^)\s>]+)/g;
const REF_LINK = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+)/gm;
const HTTP = /^https?:\/\//i;

export const MARKDOWN_MAX_CHARS = 4000;

export type MarkdownProblem = 'html' | 'image' | 'link_scheme';

/** Mirror of the server rule: why `md` is outside the safe subset (empty = clean). */
export function markdownProblems(md: string): MarkdownProblem[] {
  const out: MarkdownProblem[] = [];
  if (TAG.test(md)) out.push('html');
  if (IMAGE.test(md)) out.push('image');
  for (const re of [INLINE_LINK, REF_LINK]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) !== null) {
      if (!HTTP.test(m[1] ?? '')) {
        out.push('link_scheme');
        break;
      }
    }
    if (out.includes('link_scheme')) break;
  }
  return out;
}

// ─── the remark step ───────────────────────────────────────────────────────

/** The few mdast fields this step reads (the full types live in a transitive
 *  package the builder does not depend on directly). */
type MdNode = {
  type: string;
  url?: string;
  value?: string;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

const UNSAFE_ALWAYS = new Set(['html', 'image', 'imageReference']);

function sourceOf(node: MdNode, src: string): string {
  const a = node.position?.start.offset;
  const b = node.position?.end.offset;
  if (a === undefined || b === undefined) return node.value ?? '';
  return src.slice(a, b);
}

function unsafe(node: MdNode): boolean {
  if (UNSAFE_ALWAYS.has(node.type)) return true;
  return node.type === 'link' && !HTTP.test(node.url ?? '');
}

function walk(parent: MdNode, src: string): void {
  const kids = parent.children;
  if (!kids) return;
  for (let i = kids.length - 1; i >= 0; i--) {
    const node = kids[i] as MdNode;
    if (node.type === 'definition' && !HTTP.test(node.url ?? '')) {
      kids.splice(i, 1);
      continue;
    }
    if (unsafe(node)) {
      // Raw HTML in block position is its own node; as text it must still sit
      // in a paragraph to render (a bare text node at the root is dropped).
      const text: MdNode = { type: 'text', value: sourceOf(node, src) };
      kids[i] = parent.type === 'root' ? { type: 'paragraph', children: [text] } : text;
      continue;
    }
    walk(node, src);
  }
}

/** Remark plugin: unsafe constructs back to their source text. */
export function literalUnsafe() {
  return (tree: MdNode, file: { value?: unknown }) => {
    walk(tree, typeof file.value === 'string' ? file.value : String(file.value ?? ''));
  };
}

function httpOnly(url: string): string {
  return HTTP.test(url) ? url : '';
}

// ─── elements ──────────────────────────────────────────────────────────────

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const FILL = 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.04))';
const BORDER = 'var(--ant-color-border-secondary, #f0f0f0)';

const heading =
  (level: 1 | 2 | 3 | 4 | 5) =>
  ({ children }: { children?: ReactNode }) => (
    <Typography.Title level={level} style={{ marginTop: 12, marginBottom: 8 }}>
      {children}
    </Typography.Title>
  );

const COMPONENTS: Components = {
  h1: heading(3),
  h2: heading(4),
  h3: heading(5),
  h4: heading(5),
  h5: heading(5),
  h6: heading(5),
  p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  ul: ({ children, className }) => (
    <ul
      className={className}
      style={{ paddingLeft: className ? 4 : 20, margin: '0 0 8px', listStyle: className ? 'none' : undefined }}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} style={{ paddingLeft: 20, margin: '0 0 8px' }}>
      {children}
    </ol>
  ),
  // A task list's box is a mark, not a control: metadata and notes are read-only.
  input: ({ checked }: ComponentProps<'input'>) => (
    <span
      role="img"
      aria-label={checked ? 'done' : 'not done'}
      data-component="SafeMarkdownTask"
      data-checked={checked ? 'true' : 'false'}
      style={{ display: 'inline-block', width: '1.2em' }}
    >
      {checked ? '☑' : '☐'}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '0 0 8px',
        paddingLeft: 12,
        borderLeft: '3px solid var(--ant-color-border, #d9d9d9)',
        color: 'var(--ant-color-text-secondary, rgba(0,0,0,0.65))',
      }}
    >
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre
      data-component="SafeMarkdownCode"
      style={{
        margin: '0 0 8px',
        padding: 8,
        borderRadius: 4,
        background: FILL,
        overflow: 'auto',
        fontFamily: CODE_FONT,
      }}
    >
      {children}
    </pre>
  ),
  // A fenced block's `code` spans lines (its fences); inline code sits on one.
  code: ({ children, className, node }) =>
    (node?.position?.end.line ?? 0) > (node?.position?.start.line ?? 0) ? (
      <code className={className}>{children}</code>
    ) : (
      <code
        className={className}
        style={{ fontFamily: CODE_FONT, fontSize: '0.9em', padding: '0 4px', borderRadius: 3, background: FILL }}
      >
        {children}
      </code>
    ),
  hr: () => <hr style={{ border: 0, borderTop: '1px solid var(--ant-color-border, #d9d9d9)', margin: '8px 0' }} />,
  table: ({ children }) => (
    <div data-component="SafeMarkdownTable" style={{ overflowX: 'auto', margin: '0 0 8px', wordBreak: 'normal' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '50%' }}>{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th
      style={{
        ...style,
        padding: '4px 8px',
        borderBottom: '1px solid var(--ant-color-border, #d9d9d9)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={{ ...style, padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' }}>
      {children}
    </td>
  ),
};

const REMARK = [remarkGfm, literalUnsafe];

export function SafeMarkdown({ md }: Readonly<{ md: string }>) {
  return (
    <div data-component="SafeMarkdown" style={{ fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>
      <ReactMarkdown remarkPlugins={REMARK} skipHtml urlTransform={httpOnly} components={COMPONENTS}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
