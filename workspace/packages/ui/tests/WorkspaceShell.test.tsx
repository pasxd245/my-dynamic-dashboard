import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AntdConfig } from "../src/Providers/AntdConfig";
import { WorkspaceShell, type NavItem } from "../src/Components/WorkspaceShell";

const items: NavItem[] = [
  { key: "data-management", label: "Data", icon: "▣" },
  { key: "other", label: "Other", icon: "○" },
];

function renderShell(
  props?: Partial<React.ComponentProps<typeof WorkspaceShell>>,
) {
  const onSelect = props?.onSelect ?? vi.fn();
  const utils = render(
    <AntdConfig>
      <WorkspaceShell
        items={items}
        activeKey={props?.activeKey ?? "data-management"}
        onSelect={onSelect}
        collapsed={props?.collapsed}
        onToggleCollapse={props?.onToggleCollapse}
      >
        {props?.children ?? <p data-testid="content">page content</p>}
      </WorkspaceShell>
    </AntdConfig>,
  );
  return { ...utils, onSelect };
}

const navButton = (container: HTMLElement, key: string) => {
  const el = container.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`);
  if (!el) throw new Error(`No nav button with data-key="${key}"`);
  return el;
};

describe("WorkspaceShell", () => {
  it("renders one button per nav item + children", () => {
    const { container, getByTestId } = renderShell();
    expect(navButton(container, "data-management").textContent).toContain("Data");
    expect(navButton(container, "other").textContent).toContain("Other");
    expect(getByTestId("content")).toBeInTheDocument();
  });

  it("marks the active item with aria-current and data-active", () => {
    const { container } = renderShell({ activeKey: "data-management" });
    const active = navButton(container, "data-management");
    const inactive = navButton(container, "other");
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-active", "true");
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive).not.toHaveAttribute("data-active");
  });

  it("invokes onSelect with the clicked item's key", () => {
    const { container, onSelect } = renderShell();
    fireEvent.click(navButton(container, "other"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("other");
  });

  describe("collapse state", () => {
    it("renders hamburger toggle button when onToggleCollapse is provided", () => {
      const { container } = renderShell({ onToggleCollapse: vi.fn() });
      const toggle = container.querySelector(
        '[data-testid="workspace-shell-toggle"]',
      );
      expect(toggle).not.toBeNull();
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("omits the hamburger toggle when onToggleCollapse is absent", () => {
      const { container } = renderShell();
      const toggle = container.querySelector(
        '[data-testid="workspace-shell-toggle"]',
      );
      expect(toggle).toBeNull();
    });

    it("invokes onToggleCollapse when the hamburger is clicked", () => {
      const onToggleCollapse = vi.fn();
      const { container } = renderShell({ onToggleCollapse });
      const toggle = container.querySelector<HTMLButtonElement>(
        '[data-testid="workspace-shell-toggle"]',
      );
      if (!toggle) throw new Error("toggle missing");
      fireEvent.click(toggle);
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it("hides nav labels and marks toggle aria-expanded=false when collapsed", () => {
      const { container } = renderShell({
        collapsed: true,
        onToggleCollapse: vi.fn(),
      });
      const dataBtn = navButton(container, "data-management");
      const labelSpan = dataBtn.querySelector("span:last-child");
      expect(labelSpan).not.toBeNull();
      expect(labelSpan).toHaveStyle({ display: "none" });
      const toggle = container.querySelector(
        '[data-testid="workspace-shell-toggle"]',
      );
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps labels visible when not collapsed (default)", () => {
      const { container } = renderShell();
      const dataBtn = navButton(container, "data-management");
      const labelSpan = dataBtn.querySelector("span:last-child");
      expect(labelSpan).toHaveStyle({ display: "inline" });
    });
  });
});
