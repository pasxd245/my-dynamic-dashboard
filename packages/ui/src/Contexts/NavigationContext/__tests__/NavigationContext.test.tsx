// @vitest-environment happy-dom
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MddUIProvider } from '../../../Providers/MddUIProvider/index.tsx';
import {
  INITIAL_DATA,
  useNavigationContext,
  type NavigationContextType,
} from '../index.tsx';

describe('NavigationContext', () => {
  it('initial data matches INITIAL_DATA, and updateData re-renders consumers', () => {
    let captured: NavigationContextType | null = null;

    const Probe = () => {
      captured = useNavigationContext();
      return null;
    };

    render(
      <MddUIProvider>
        <Probe />
      </MddUIProvider>,
    );

    expect(captured).not.toBeNull();
    expect(captured!.data).toEqual(INITIAL_DATA);

    act(() => {
      captured!.updateData('sidebarOpen', false);
    });

    expect(captured!.data.sidebarOpen).toBe(false);
  });
});
