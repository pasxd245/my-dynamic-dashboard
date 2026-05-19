// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MddUIProvider } from '../../../Providers/MddUIProvider/index.tsx';
import { MasterLayout } from '../index.tsx';
import type { NavigationGroup, NavigationItem } from '../../../types/index.ts';

const NAV: NavigationItem[] = [
  { id: 'a', path: '/a', title: 'A', sidebar: true },
  { id: 'b', path: '/b', title: 'B', sidebar: true },
];

const NAV_GROUPS: NavigationGroup[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      { id: 'a', path: '/a', title: 'A', sidebar: true },
      { id: 'b', path: '/b', title: 'B', sidebar: true },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    items: [{ id: 'c', path: '/c', title: 'C', sidebar: true }],
  },
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

  it('R03 extended shape: renders navGroups + header + brand without throwing; selection still works across groups', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/c']}>
        <MddUIProvider>
          <MasterLayout
            navGroups={NAV_GROUPS}
            header={<div data-testid="custom-header">search · locale · bell · avatar</div>}
            brand={<div data-testid="custom-brand">BUILDER</div>}
          >
            <div data-testid="body">body</div>
          </MasterLayout>
        </MddUIProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('custom-header').textContent).toContain('search');
    expect(screen.getByTestId('custom-brand').textContent).toContain('BUILDER');
    const groups = container.querySelectorAll('.ant-menu-item-group');
    expect(groups.length).toBe(2);
    const selected = container.querySelectorAll('.ant-menu-item-selected');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain('C');
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
