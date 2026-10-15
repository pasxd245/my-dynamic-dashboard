// R179 — the `note` widget: markdown text on a dashboard, no query. The text
// is rendered by a hand-written parser into React nodes, so markup can never
// become HTML; the same subset rule the server enforces (`markdownProblems`)
// runs in the builder before a save.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafeMarkdown, markdownProblems, parseBlocks } from '@/features/dashboard/SafeMarkdown';
import { draftToConfig } from '@/features/dashboard/WidgetBuilder';
import { WidgetView } from '@/features/dashboard/WidgetView';
import type { Widget } from '@/features/dashboard/types';

describe('R179 markdownProblems (mirror of app/markdown_safe.py)', () => {
  it('accepts the safe subset', () => {
    expect(markdownProblems('## T\n\n- a\n- b\n\n> q\n\n`c` **b** [l](https://x.y/z?q=1)\n\n```\nf\n```\n')).toEqual([]);
  });
  it('rejects tags, images and non-http links', () => {
    expect(markdownProblems('<script>x</script>')).toEqual(['html']);
    expect(markdownProblems('a <b>b</b>')).toEqual(['html']);
    expect(markdownProblems('<!-- c -->')).toEqual(['html']);
    expect(markdownProblems('![p](https://x/p.png)')).toEqual(['image']);
    expect(markdownProblems('[x](javascript:alert(1))')).toEqual(['link_scheme']);
    expect(markdownProblems('[x]: ftp://x\n\n[x]')).toEqual(['link_scheme']);
    expect(markdownProblems('<https://x>')).toEqual(['html']);
  });
});

describe('R179 SafeMarkdown', () => {
  it('parses headings, lists, quotes, code and rules into blocks', () => {
    const kinds = parseBlocks('# H\n\npara\n\n- a\n- b\n\n1. one\n2. two\n\n> q\n\n```\nc\n```\n\n---\n').map((b) => b.kind);
    expect(kinds).toEqual(['h', 'p', 'ul', 'ol', 'quote', 'code', 'hr']);
  });

  it('renders bold, code and an http link as elements', () => {
    const { container } = render(<SafeMarkdown md={'**bold** and `code` and [go](https://example.com/a)'} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com/a');
    expect(a?.getAttribute('rel')).toContain('noopener');
    expect(a?.getAttribute('target')).toBe('_blank');
  });

  it('never turns text into HTML: a script tag is literal text, a javascript: link stays text', () => {
    const { container } = render(<SafeMarkdown md={'<script>alert(1)</script> [x](javascript:alert(1))'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('[x](javascript:alert(1))');
  });
});

describe('R179 note widget', () => {
  const note: Widget = { id: 'wdg_00000179', title: 'Read me', chartType: 'note', md: '## Hello\n\nA **note**.', span: 1 };

  it('draftToConfig emits title + md + size only', () => {
    expect(draftToConfig({ title: ' Read me ', chartType: 'note', md: 'x', agg: 'sum', span: 2, queryId: 'qr_12345678' })).toEqual({
      title: 'Read me',
      chartType: 'note',
      md: 'x',
      span: 2,
    });
  });

  it('renders the text inside the card without any provider or fetch', () => {
    const { container } = render(<WidgetView widget={note} />);
    expect(container.querySelector('[data-component="NoteWidget"]')).not.toBeNull();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('note');
    expect(container.querySelector('[data-component="DashboardChartCard"]')?.getAttribute('data-rows')).toBe('1');
  });
});
