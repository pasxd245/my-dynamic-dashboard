// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageCard from '../index.tsx';

describe('PageCard', () => {
  it('renders a section with class page-card by default', () => {
    const { container } = render(
      <PageCard>
        <div data-testid="body">body</div>
      </PageCard>,
    );
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section!.classList.contains('page-card')).toBe(true);
    expect(section!.classList.contains('page-card--flush')).toBe(false);
  });

  it('variant="flush" adds page-card--flush', () => {
    const { container } = render(<PageCard variant="flush">x</PageCard>);
    const section = container.querySelector('section')!;
    expect(section.classList.contains('page-card--flush')).toBe(true);
  });

  it('composes an extra className after page-card', () => {
    const { container } = render(<PageCard className="extra">x</PageCard>);
    const section = container.querySelector('section')!;
    expect(section.className.split(/\s+/)).toContain('page-card');
    expect(section.className.split(/\s+/)).toContain('extra');
  });
});
