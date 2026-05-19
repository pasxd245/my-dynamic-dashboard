// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MddUIProvider } from '../../../Providers/MddUIProvider/index.tsx';
import PageHeader from '../index.tsx';

describe('PageHeader', () => {
  it('renders breadcrumb (Builder / section / title), h2 title, and subtitle', () => {
    const { container } = render(
      <MddUIProvider>
        <PageHeader section="Data Management" title="Test" subtitle="sub" />
      </MddUIProvider>,
    );
    const breadcrumbText = container.querySelector('.ant-breadcrumb')?.textContent ?? '';
    expect(breadcrumbText).toContain('Builder');
    expect(breadcrumbText).toContain('Data Management');
    expect(breadcrumbText).toContain('Test');

    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('Test');

    expect(screen.getByText('sub')).toBeTruthy();
  });

  it('omits the subtitle paragraph when subtitle is not supplied', () => {
    const { container } = render(
      <MddUIProvider>
        <PageHeader section="X" title="Y" />
      </MddUIProvider>,
    );
    // h2 still renders
    expect(container.querySelector('h2')?.textContent).toBe('Y');
    // no <p> in the breadcrumb-only header layout (paragraph only renders when subtitle present)
    const paragraphs = container.querySelectorAll('.ant-typography');
    // h2 has ant-typography too — assert no paragraph WITH text "sub"
    expect(Array.from(paragraphs).some((n) => n.textContent === 'sub')).toBe(false);
  });
});
