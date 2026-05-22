import { describe, expect, it } from "vitest";
import { themeTokens } from "../src/themeTokens";

describe("themeTokens", () => {
  it("exports a ThemeConfig with a stable token shape", () => {
    expect(themeTokens).toMatchSnapshot();
  });

  it("declares the algorithm and a populated token object", () => {
    expect(themeTokens.algorithm).toBeDefined();
    expect(themeTokens.token).toBeDefined();
    expect(Object.keys(themeTokens.token ?? {}).length).toBeGreaterThan(0);
  });
});
