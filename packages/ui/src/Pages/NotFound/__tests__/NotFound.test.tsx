// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NotFound from '../index.tsx';

// Container-scoped query helper — see Round_09's FormField test file for
// the rationale (happy-dom's document.body persists across files, so
// document-scoped queries pick up portal residue from sibling suites).
const linkIn = (container: HTMLElement): HTMLAnchorElement | null =>
  container.querySelector('a');

describe('NotFound', () => {
  it('renders the default title, message, and home link', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('Page not found');
    expect(container.textContent).toContain("doesn't exist");
    const link = linkIn(container);
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe('Go home');
    expect(link!.getAttribute('href')).toBe('/');
  });

  it('overrides every string via props', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound title="404" message="Nope" homeHref="/dashboard" homeLabel="Dashboard" />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('404');
    expect(container.textContent).toContain('Nope');
    const link = linkIn(container);
    expect(link!.textContent).toBe('Dashboard');
    expect(link!.getAttribute('href')).toBe('/dashboard');
  });

  it('exports a function component (smoke)', () => {
    expect(typeof NotFound).toBe('function');
    expect(NotFound.name).toBe('NotFound');
  });
});
