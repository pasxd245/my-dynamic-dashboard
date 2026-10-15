// R179 — the safe markdown subset, rendered as React nodes.
//
// No markdown library, no HTML injection: the text is parsed by hand into a
// small block/inline tree and emitted as elements, so a `<script>` in the text
// can only ever appear as the literal characters `<script>`. The server
// refuses raw HTML, images and non-http(s) links before anything is stored
// (`app/markdown_safe.py`); `markdownProblems` here is the same rule, so the
// builder can say so before the save round-trips.
//
// Subset: `#`–`###` headings · paragraphs · `**bold**` · `*italic*` / `_italic_`
// · `` `code` `` · fenced ``` code blocks · `-` / `*` bullets · `1.` numbered
// lists · `>` quotes · `---` rules · `[text](https://…)` links. Anything else
// is shown as the text it is.

import { Typography } from 'antd';
import type { ReactNode } from 'react';

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

// ─── inline ────────────────────────────────────────────────────────────────

const INLINE = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(\s*(https?:\/\/[^)\s]+)\s*\))|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/;

function inline(text: string, key = 0): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let i = key;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      nodes.push(rest);
      break;
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const k = `i${i++}`;
    if (m[1]) nodes.push(<strong key={k}>{inline(m[2] ?? '', i * 100)}</strong>);
    else if (m[3])
      nodes.push(
        <code
          key={k}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.9em',
            padding: '0 4px',
            borderRadius: 3,
            background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.04))',
          }}
        >
          {m[4]}
        </code>,
      );
    else if (m[5])
      nodes.push(
        <a key={k} href={m[7]} target="_blank" rel="noopener noreferrer">
          {m[6]}
        </a>,
      );
    else if (m[8]) nodes.push(<em key={k}>{inline(m[9] ?? '', i * 100)}</em>);
    else if (m[10]) nodes.push(<em key={k}>{inline(m[11] ?? '', i * 100)}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

// ─── blocks ────────────────────────────────────────────────────────────────

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'hr' };

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const flushPara = (buf: string[]) => {
    if (buf.length) blocks.push({ kind: 'p', text: buf.join(' ') });
    buf.length = 0;
  };
  const para: string[] = [];
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (/^\s*$/.test(line)) {
      flushPara(para);
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      flushPara(para);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i] ?? '')) buf.push(lines[i] ?? ''), i++;
      i++;
      blocks.push({ kind: 'code', text: buf.join('\n') });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara(para);
      blocks.push({ kind: 'h', level: h[1]?.length as 1 | 2 | 3, text: h[2] ?? '' });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara(para);
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, '')), i++;
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i] ?? ''))
        items.push((lines[i] ?? '').replace(/^\s*\d+[.)]\s+/, '')), i++;
      blocks.push({ kind: 'ol', items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushPara(para);
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? '')) buf.push((lines[i] ?? '').replace(/^\s*>\s?/, '')), i++;
      blocks.push({ kind: 'quote', text: buf.join(' ') });
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara(para);
  return blocks;
}

export function SafeMarkdown({ md }: Readonly<{ md: string }>) {
  const blocks = parseBlocks(md);
  return (
    <div data-component="SafeMarkdown" style={{ fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.kind) {
          case 'h':
            return (
              <Typography.Title key={key} level={(b.level + 2) as 3 | 4 | 5} style={{ marginTop: idx === 0 ? 0 : 12 }}>
                {inline(b.text)}
              </Typography.Title>
            );
          case 'p':
            return (
              <Typography.Paragraph key={key} style={{ marginBottom: 8 }}>
                {inline(b.text)}
              </Typography.Paragraph>
            );
          case 'ul':
            return (
              <ul key={key} style={{ paddingLeft: 20, marginBottom: 8 }}>
                {b.items.map((it, j) => (
                  <li key={`${key}-${j}`}>{inline(it)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} style={{ paddingLeft: 20, marginBottom: 8 }}>
                {b.items.map((it, j) => (
                  <li key={`${key}-${j}`}>{inline(it)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={key}
                style={{
                  margin: '0 0 8px',
                  paddingLeft: 12,
                  borderLeft: '3px solid var(--ant-color-border, #d9d9d9)',
                  color: 'var(--ant-color-text-secondary, rgba(0,0,0,0.65))',
                }}
              >
                {inline(b.text)}
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={key}
                style={{
                  margin: '0 0 8px',
                  padding: 8,
                  borderRadius: 4,
                  background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.04))',
                  overflow: 'auto',
                }}
              >
                <code>{b.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={key} style={{ border: 0, borderTop: '1px solid var(--ant-color-border, #d9d9d9)', margin: '8px 0' }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
