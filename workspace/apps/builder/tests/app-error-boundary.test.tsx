import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <AppErrorBoundary>
        <div>healthy tree</div>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('healthy tree')).toBeInTheDocument();
  });

  it('renders the fallback Result with the error message when a child throws', () => {
    // React logs caught errors to console.error in dev mode — silence it
    // so the test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });
});
