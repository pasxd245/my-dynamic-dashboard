import { AntdConfig } from "@mdd/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders the page title inside an AntdConfig provider", () => {
    render(
      <AntdConfig>
        <App />
      </AntdConfig>,
    );
    expect(
      screen.getByRole("heading", { name: /my-dynamic-dashboard.*Builder/i }),
    ).toBeInTheDocument();
  });

  it("renders the theme-proof antd button", () => {
    render(
      <AntdConfig>
        <App />
      </AntdConfig>,
    );
    const button = screen.getByRole("button", { name: /theme proof/i });
    expect(button).toBeInTheDocument();
    // antd buttons render with an `ant-btn` class — proves the antd
    // component tree is active (and therefore @mdd/ui's AntdConfig is wired)
    expect(button.className).toMatch(/ant-btn/);
  });
});
