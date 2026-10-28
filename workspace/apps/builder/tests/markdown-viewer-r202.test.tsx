// R202 (item 5.2) — the markdown viewer: GFM tables, task lists and nested
// lists render; an intraword `_` stays a character; and the R179 invariant
// holds for every hostile input — no element from raw HTML, no image, no link
// whose target is not http(s); each is shown as its source text.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafeMarkdown } from '@/features/dashboard/SafeMarkdown';

function md(text: string) {
  return render(<SafeMarkdown md={text} />).container;
}

describe('R202 viewer — what it now draws', () => {
  it('draws a GFM table with header and cells', () => {
    const c = md('| Check | Rows |\n|---|---:|\n| Blank date | 46 |\n| Unknown pair | 3 |\n');
    expect(c.querySelector('[data-component="SafeMarkdownTable"] table')).not.toBeNull();
    expect([...c.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Check', 'Rows']);
    expect(c.querySelectorAll('tbody tr').length).toBe(2);
    expect(c.querySelector('td:last-child')?.getAttribute('style')).toContain('text-align: right');
  });

  it('draws task-list marks, not form controls', () => {
    const c = md('- [ ] open item\n- [x] done item\n');
    expect(c.querySelector('input')).toBeNull();
    const marks = [...c.querySelectorAll('[data-component="SafeMarkdownTask"]')].map((m) =>
      m.getAttribute('data-checked'),
    );
    expect(marks).toEqual(['false', 'true']);
  });

  it('keeps an intraword underscore as a character', () => {
    const c = md('Edit `x` in file_name_here and status_pair_list.');
    expect(c.querySelector('em')).toBeNull();
    expect(c.textContent).toContain('file_name_here');
  });

  it('draws nested lists, strikethrough and fenced code', () => {
    const c = md('- a\n  - b\n\n~~gone~~\n\n```\nx = 1\n```\n');
    expect(c.querySelector('ul ul')).not.toBeNull();
    expect(c.querySelector('del')?.textContent).toBe('gone');
    expect(c.querySelector('[data-component="SafeMarkdownCode"] code')?.textContent).toBe('x = 1\n');
  });

  it('renders a 64 KiB note (prose, lists and a table)', () => {
    const block =
      '## Part\n\nSome text with **bold** and `code`.\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n';
    const text = block.repeat(Math.ceil((64 * 1024) / block.length)).slice(0, 64 * 1024);
    const c = md(text);
    expect(c.querySelectorAll('h4').length).toBeGreaterThan(500);
  });
});

describe('R202 viewer — the R179 invariant on hostile input', () => {
  const hostile: Array<[string, string]> = [
    ['inline script', 'a <script>alert(1)</script> b'],
    ['block html', '<div onclick="x()">hi</div>\n\nafter'],
    ['comment', '<!-- hidden -->'],
    ['iframe', '<iframe src="https://x.y"></iframe>'],
    ['image', '![p](https://x.y/p.png)'],
    ['image reference', '![p][r]\n\n[r]: https://x.y/p.png'],
    ['javascript link', '[x](javascript:alert(1))'],
    ['data link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript link', '[x](vbscript:msgbox)'],
    ['reference to javascript', '[x][r]\n\n[r]: javascript:alert(1)'],
    ['email autolink', 'write to a@b.co'],
    ['angle autolink', '<javascript:alert(1)>'],
    ['html in a table cell', '| a |\n|---|\n| <b>x</b> |'],
    ['html in a list', '- <img src=x onerror=alert(1)>'],
  ];

  it.each(hostile)('%s: no element from it', (_name, text) => {
    const c = md(text);
    expect(c.querySelector('script, iframe, img, div[onclick], b')).toBeNull();
    for (const a of c.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').toMatch(/^https?:\/\//);
  });

  it('shows the source text of what it refused', () => {
    expect(md('a <script>alert(1)</script> b').textContent).toContain('<script>alert(1)</script>');
    expect(md('[x](javascript:alert(1))').textContent).toContain('[x](javascript:alert(1))');
    expect(md('![p](https://x.y/p.png)').textContent).toContain('![p](https://x.y/p.png)');
    expect(md('<div>hi</div>').textContent).toContain('<div>hi</div>');
  });

  it('keeps an http(s) link a link that opens in a new tab', () => {
    const a = md('[go](https://example.com/a?b=1)').querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com/a?b=1');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });
});
