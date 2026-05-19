// @vitest-environment happy-dom
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button from '../index.tsx';

describe('Button', () => {
  it('renders a <button> with the given children', () => {
    const { container } = render(<Button>Click</Button>);
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Click');
  });

  it('passes through type and disabled, and does not invoke onClick on mount', () => {
    const spy = vi.fn();
    const { container } = render(
      <Button type="primary" disabled onClick={spy}>
        X
      </Button>,
    );
    const btn = container.querySelector('button')!;
    expect(btn.className.split(/\s+/)).toContain('ant-btn-primary');
    expect(btn.disabled).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('invokes onClick when the button is clicked (prop pass-through)', () => {
    const spy = vi.fn();
    const { container } = render(<Button onClick={spy}>X</Button>);
    const btn = container.querySelector('button')!;
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
