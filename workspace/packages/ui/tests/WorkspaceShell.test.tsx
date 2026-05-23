import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AntdConfig } from "../src/Providers/AntdConfig";
import {
  WorkspaceShell,
  type NavGroup,
  type NavItem,
} from "../src/Components/WorkspaceShell";

const flatItems: NavItem[] = [
  { key: "data-management", label: "Data", icon: "▣" },
  { key: "other", label: "Other", icon: "○" },
];

const groups: NavGroup[] = [
  {
    key: "data-management",
    label: "Data Management",
    icon: "▣",
    defaultExpanded: true,
    items: [
      { key: "workspaces", label: "Workspaces", icon: "▦" },
      { key: "datasets", label: "Datasets" },
    ],
  },
];

function renderShellFlat(
  props?: Partial<
    Omit<React.ComponentProps<typeof WorkspaceShell>, "groups">
  >,
) {
  const onSelect = props?.onSelect ?? vi.fn();
  const utils = render(
    <AntdConfig>
      <WorkspaceShell
        items={flatItems}
        activeKey={props?.activeKey ?? "data-management"}
        onSelect={onSelect}
        collapsed={props?.collapsed}
        onToggleCollapse={props?.onToggleCollapse}
        title={props?.title}
        header={props?.header}
        buildVersion={props?.buildVersion}
      >
        {props?.children ?? <p data-testid="content">page content</p>}
      </WorkspaceShell>
    </AntdConfig>,
  );
  return { ...utils, onSelect };
}

function renderShellGrouped(
  props?: Partial<
    Omit<React.ComponentProps<typeof WorkspaceShell>, "items">
  >,
) {
  const onSelect = props?.onSelect ?? vi.fn();
  const utils = render(
    <AntdConfig>
      <WorkspaceShell
        groups={groups}
        activeKey={props?.activeKey ?? "workspaces"}
        onSelect={onSelect}
        collapsed={props?.collapsed}
        onToggleCollapse={props?.onToggleCollapse}
        title={props?.title}
        header={props?.header}
        buildVersion={props?.buildVersion}
      >
        {props?.children ?? <p data-testid="content">page content</p>}
      </WorkspaceShell>
    </AntdConfig>,
  );
  return { ...utils, onSelect };
}

describe("WorkspaceShell — flat items variant", () => {
  it("renders content children", () => {
    const { getByTestId } = renderShellFlat();
    expect(getByTestId("content")).toBeInTheDocument();
  });

  it("renders one AntD menu-item per flat item", () => {
    const { container } = renderShellFlat();
    const items = container.querySelectorAll(
      '[role="menuitem"], li.ant-menu-item',
    );
    // AntD renders Menu.Item with class ant-menu-item; we expect 2.
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("invokes onSelect with the clicked menu key", () => {
    const { container, onSelect } = renderShellFlat();
    const otherItem = container.querySelector<HTMLElement>(
      'li.ant-menu-item[data-menu-id$="other"]',
    );
    if (!otherItem) throw new Error("other menu item missing");
    fireEvent.click(otherItem);
    expect(onSelect).toHaveBeenCalledWith("other");
  });
});

describe("WorkspaceShell — groups variant", () => {
  it("renders SubMenu for groups + child items", () => {
    const { container } = renderShellGrouped();
    const submenu = container.querySelector("li.ant-menu-submenu");
    expect(submenu).not.toBeNull();
    const childItems = container.querySelectorAll("li.ant-menu-item");
    expect(childItems.length).toBeGreaterThanOrEqual(2);
  });

  it("invokes onSelect with the clicked leaf key (workspaces)", () => {
    const { container, onSelect } = renderShellGrouped();
    const leaf = container.querySelector<HTMLElement>(
      'li.ant-menu-item[data-menu-id$="workspaces"]',
    );
    if (!leaf) throw new Error("workspaces leaf missing");
    fireEvent.click(leaf);
    expect(onSelect).toHaveBeenCalledWith("workspaces");
  });

  it("marks the active leaf as selected (ant-menu-item-selected)", () => {
    const { container } = renderShellGrouped({ activeKey: "workspaces" });
    const selected = container.querySelector<HTMLElement>(
      "li.ant-menu-item.ant-menu-item-selected",
    );
    expect(selected).not.toBeNull();
    expect(selected?.dataset.menuId).toMatch(/workspaces$/);
  });
});

describe("WorkspaceShell — top-bar + collapse", () => {
  it("renders hamburger toggle in the top-bar when onToggleCollapse is provided", () => {
    const { container } = renderShellGrouped({ onToggleCollapse: vi.fn() });
    const toggle = container.querySelector(
      '[data-testid="workspace-shell-toggle"]',
    );
    expect(toggle).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("omits the toggle when onToggleCollapse is absent", () => {
    const { container } = renderShellGrouped();
    expect(
      container.querySelector('[data-testid="workspace-shell-toggle"]'),
    ).toBeNull();
  });

  it("invokes onToggleCollapse on click", () => {
    const onToggleCollapse = vi.fn();
    const { container } = renderShellGrouped({ onToggleCollapse });
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="workspace-shell-toggle"]',
    );
    if (!toggle) throw new Error("toggle missing");
    fireEvent.click(toggle);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("flips aria-expanded to false and renders unfold icon when collapsed", () => {
    const { container } = renderShellGrouped({
      collapsed: true,
      onToggleCollapse: vi.fn(),
    });
    const toggle = container.querySelector(
      '[data-testid="workspace-shell-toggle"]',
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "Expand sidebar");
  });

  it("renders the title in the top-bar when no custom header is passed", () => {
    const { container } = renderShellGrouped({ title: "My Title" });
    expect(container.textContent).toContain("My Title");
  });

  it("renders custom header content when provided (header wins over title)", () => {
    const { container } = renderShellGrouped({
      header: <span data-testid="custom-header">Custom</span>,
      title: "Should not show",
    });
    expect(container.querySelector('[data-testid="custom-header"]'))
      .not.toBeNull();
    expect(container.textContent).not.toContain("Should not show");
  });

  it("renders buildVersion in the sidebar footer when provided", () => {
    const { container } = renderShellGrouped({ buildVersion: "0.0.1" });
    expect(container.textContent).toContain("build 0.0.1");
  });

  it("hides the 'build' label prefix when collapsed (version only)", () => {
    const { container } = renderShellGrouped({
      collapsed: true,
      onToggleCollapse: vi.fn(),
      buildVersion: "0.0.1",
    });
    expect(container.textContent).toContain("0.0.1");
    expect(container.textContent).not.toMatch(/build 0\.0\.1/);
  });
});
