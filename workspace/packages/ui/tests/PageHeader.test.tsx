import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AntdConfig } from "../src/Providers/AntdConfig";
import { PageHeader } from "../src/Components/PageHeader";

describe("PageHeader", () => {
  it("renders breadcrumb labels + title", () => {
    const { container } = render(
      <AntdConfig>
        <PageHeader
          breadcrumb={[
            { label: "Home", route: "/" },
            { label: "Data Management" },
          ]}
          title="Data Management"
        />
      </AntdConfig>,
    );
    // R94 (D4b): the root `/` crumb renders as a Home icon, keeping its label
    // as the accessible name (aria-label) — not as visible text. Assert the
    // affordance via that accessible name, not raw textContent.
    expect(container.querySelector('[aria-label="Home"]')).not.toBeNull();
    expect(container.textContent).toContain("Data Management");
  });

  it("renders subtitle when provided", () => {
    const { container } = render(
      <AntdConfig>
        <PageHeader
          breadcrumb={[{ label: "Home" }]}
          title="Home"
          subtitle="A short description"
        />
      </AntdConfig>,
    );
    expect(container.textContent).toContain("A short description");
  });

  it("renders actions slot on the right", () => {
    const { getByTestId } = render(
      <AntdConfig>
        <PageHeader
          breadcrumb={[{ label: "Home" }]}
          title="Home"
          actions={<button data-testid="create-btn">Create</button>}
        />
      </AntdConfig>,
    );
    expect(getByTestId("create-btn")).toBeInTheDocument();
  });

  it("invokes onNavigate when a clickable breadcrumb is activated", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <AntdConfig>
        <PageHeader
          breadcrumb={[
            { label: "Home", route: "/" },
            { label: "Data Management" },
          ]}
          title="Data Management"
          onNavigate={onNavigate}
        />
      </AntdConfig>,
    );
    const link = container.querySelector<HTMLAnchorElement>('a[href="/"]');
    if (!link) throw new Error("breadcrumb link missing");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("/");
  });

  it("does not render breadcrumb as link when route is absent", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <AntdConfig>
        <PageHeader
          breadcrumb={[{ label: "Current Page" }]}
          title="Current Page"
          onNavigate={onNavigate}
        />
      </AntdConfig>,
    );
    expect(container.querySelector("a")).toBeNull();
  });
});
