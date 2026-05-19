// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SidebarMenu } from '../index.tsx';
import type { NavigationGroup, NavigationItem } from '../../../types/index.ts';

const FLAT: NavigationItem[] = [
  { id: 'a', path: '/a', title: 'A', sidebar: true },
  { id: 'b', path: '/b', title: 'B', sidebar: true },
];

const GROUPS: NavigationGroup[] = [
  {
    id: 'g1',
    title: 'Group One',
    items: [
      { id: 'a', path: '/a', title: 'A', sidebar: true },
      { id: 'b', path: '/b', title: 'B', sidebar: true },
    ],
  },
  {
    id: 'g2',
    title: 'Group Two',
    items: [{ id: 'c', path: '/c', title: 'C', sidebar: true }],
  },
];

describe('SidebarMenu', () => {
  it('flat items: renders one ant-menu-item per nav item, selects active', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/a']}>
        <SidebarMenu items={FLAT} />
      </MemoryRouter>,
    );
    const items = container.querySelectorAll('.ant-menu-item');
    expect(items.length).toBe(2);
    const selected = container.querySelectorAll('.ant-menu-item-selected');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain('A');
  });

  it('groups: renders one ant-menu-item-group per group with nested items', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/c']}>
        <SidebarMenu groups={GROUPS} />
      </MemoryRouter>,
    );
    const groups = container.querySelectorAll('.ant-menu-item-group');
    expect(groups.length).toBe(2);
    const items = container.querySelectorAll('.ant-menu-item');
    expect(items.length).toBe(3);
    const selected = container.querySelectorAll('.ant-menu-item-selected');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain('C');
  });

  it('groups: selection works across groups (selecting an item inside group two)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/b']}>
        <SidebarMenu groups={GROUPS} />
      </MemoryRouter>,
    );
    const selected = container.querySelectorAll('.ant-menu-item-selected');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain('B');
  });
});
