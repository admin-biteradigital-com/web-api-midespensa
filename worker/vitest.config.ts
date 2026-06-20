import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 85,
      },
      exclude: ["node_modules/**", "src/utils/smoke.ts", "src/tests/**"],
    },
  },
});
