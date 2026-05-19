// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ZodIssue } from 'zod';
import FormField from '../index.tsx';

const makeIssue = (path: (string | number)[], message: string): ZodIssue =>
  ({
    code: 'custom',
    path,
    message,
  }) as ZodIssue;

// Scope assertions to the test's own container — happy-dom's document.body
// persists across files, so antd portals from sibling test suites can leak
// into `queryByRole` lookups. `container.querySelector` is unaffected.
const alertIn = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[role="alert"]') as HTMLElement | null;

describe('FormField', () => {
  it('renders label + child + no error when issues is empty; help text shows when supplied', () => {
    const { container } = render(
      <FormField name="email" label="Email" help="we will not spam you">
        <input type="email" />
      </FormField>,
    );
    expect(container.textContent).toContain('Email');
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(alertIn(container)).toBeNull();
    expect(container.textContent).toContain('we will not spam you');
  });

  it('surfaces a matching issue under role="alert" and hides help when an error is present', () => {
    const issues = [makeIssue(['email'], 'Invalid email')];
    const { container } = render(
      <FormField name="email" label="Email" issues={issues} help="hint">
        <input />
      </FormField>,
    );
    expect(alertIn(container)?.textContent).toBe('Invalid email');
    expect(container.textContent).not.toContain('hint');
  });

  it('ignores non-matching issues and falls back to showing help', () => {
    const issues = [makeIssue(['name'], 'Required')];
    const { container } = render(
      <FormField name="email" label="Email" issues={issues} help="hint">
        <input />
      </FormField>,
    );
    expect(alertIn(container)).toBeNull();
    expect(container.textContent).toContain('hint');
  });

  it('matches nested issue paths via path.join(".")', () => {
    const issues = [makeIssue(['user', 'email'], 'Bad email')];
    const { container } = render(
      <FormField name="user.email" label="Email" issues={issues}>
        <input />
      </FormField>,
    );
    expect(alertIn(container)?.textContent).toBe('Bad email');
  });

  it('renders the required marker when required={true}', () => {
    const { container } = render(
      <FormField name="email" label="Email" required>
        <input />
      </FormField>,
    );
    const label = container.querySelector('label');
    expect(label?.textContent).toContain('*');
    expect(label?.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });
});
