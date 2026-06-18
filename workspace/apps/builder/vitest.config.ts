import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // Integration-style tests drive heavy AntD Select/dropdown interactions
    // (e.g. building a multi-hop join chain) that legitimately run ~5s in
    // happy-dom; the 5s default flaked under load. Give them headroom.
    testTimeout: 15000,
  },
});
