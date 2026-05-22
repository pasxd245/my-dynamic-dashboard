import { describe, expect, it } from "vitest";
import { themeTokens } from "../src/themeTokens";

describe("themeTokens", () => {
  it("declares an algorithm and a populated token object", () => {
    expect(themeTokens.algorithm).toBeDefined();
    expect(themeTokens.token).toBeDefined();
    expect(Object.keys(themeTokens.token ?? {}).length).toBeGreaterThan(0);
  });

  it("exposes the design-system primitives the UI baseline depends on", () => {
    const token = themeTokens.token;
    expect(token).toBeDefined();
    expect(typeof token?.colorPrimary).toBe("string");
    expect(typeof token?.fontFamily).toBe("string");
    expect(typeof token?.fontSize).toBe("number");
    expect(typeof token?.borderRadius).toBe("number");
  });
});
