import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AntdConfig } from "../src/Providers/AntdConfig";
import { PageCard } from "../src/Components/PageCard";

describe("PageCard", () => {
  it("renders children inside a section element", () => {
    const { container, getByTestId } = render(
      <AntdConfig>
        <PageCard>
          <p data-testid="content">page content</p>
        </PageCard>
      </AntdConfig>,
    );
    expect(getByTestId("content")).toBeInTheDocument();
    expect(container.querySelector("section")).not.toBeNull();
  });

  it("defaults to the 'default' variant", () => {
    const { container } = render(
      <AntdConfig>
        <PageCard>content</PageCard>
      </AntdConfig>,
    );
    const card = container.querySelector<HTMLElement>(
      '[data-component="PageCard"]',
    );
    expect(card).not.toBeNull();
    expect(card?.dataset.variant).toBe("default");
  });

  it("accepts the 'flush' variant in the type signature", () => {
    // R12 ships default only; flush is declared but unimplemented.
    // This test guards the prop signature against accidental removal.
    const { container } = render(
      <AntdConfig>
        <PageCard variant="flush">content</PageCard>
      </AntdConfig>,
    );
    const card = container.querySelector<HTMLElement>(
      '[data-component="PageCard"]',
    );
    expect(card?.dataset.variant).toBe("flush");
  });
});
