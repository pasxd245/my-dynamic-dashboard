import { themeTokens } from "../themeTokens";

const fontFamily = themeTokens.token?.fontFamily ?? "sans-serif";

export function ThemeStyle() {
  return <style>{`body { font-family: ${fontFamily}; }`}</style>;
}
