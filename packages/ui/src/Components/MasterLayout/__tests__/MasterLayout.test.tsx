// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MddUIProvider } from '../../../Providers/MddUIProvider/index.tsx';
import { MasterLayout } from '../index.tsx';
import type { NavigationItem } from '../../../types/index.ts';

const NAV: NavigationItem[] = [
  { id: 'a', path: '/a', title: 'A', sidebar: true },
  { id: 'b', path: '/b', title: 'B', sidebar: true },
];

describe('MasterLayout', () => {
  it('renders Sider, Header, and Content; marks the active route selected', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/a']}>
        <MddUIProvider>
          <MasterLayout navigation={NAV} title="Test">
            <div data-testid="body">hello body</div>
          </MasterLayout>
        </MddUIProvider>
      </MemoryRouter>,
    );

    expect(container.querySelector('.ant-layout-sider')).not.toBeNull();
    expect(container.querySelector('.ant-layout-header')).not.toBeNull();
    expect(container.querySelector('.ant-layout-content')).not.toBeNull();
    expect(screen.getByText('Test')).toBeTruthy();
    expect(screen.getByTestId('body').textContent).toBe('hello body');

    const selected = container.querySelectorAll('.ant-menu-item-selected');
    expect(selected.length).toBeGreaterThan(0);
    expect(Array.from(selected).some((n) => n.textContent?.includes('A'))).toBe(true);
  });

  it('header collapse button toggles the Sider', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/a']}>
        <MddUIProvider>
          <MasterLayout navigation={NAV} title="Test">
            body
          </MasterLayout>
        </MddUIProvider>
      </MemoryRouter>,
    );

    const sider = container.querySelector('.ant-layout-sider') as HTMLElement;
    const before = sider.className;
    const btn = container.querySelector('button[aria-label]') as HTMLButtonElement;
    fireEvent.click(btn);
    const after = (container.querySelector('.ant-layout-sider') as HTMLElement).className;
    expect(after).not.toBe(before);
  });
});
