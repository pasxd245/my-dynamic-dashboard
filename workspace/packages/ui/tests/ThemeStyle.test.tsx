import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeStyle } from "../src/Providers/ThemeStyle";
import { themeTokens } from "../src/themeTokens";

describe("ThemeStyle", () => {
  it("renders a <style> element targeting body font-family", () => {
    const { container } = render(<ThemeStyle />);
    const styleEl = container.querySelector("style");

    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toMatch(/body\s*\{\s*font-family:/);
  });

  it("uses themeTokens.token.fontFamily as the single source of truth", () => {
    const { container } = render(<ThemeStyle />);
    const styleEl = container.querySelector("style");
    const expectedFont = themeTokens.token?.fontFamily;

    expect(expectedFont).toBeTruthy();
    expect(styleEl?.textContent).toContain(expectedFont!);
  });
});
