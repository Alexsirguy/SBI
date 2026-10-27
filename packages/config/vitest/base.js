import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "eslint/**/*.test.js"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**", "eslint/**"],
      exclude: ["**/*.test.*", "**/fixtures/**"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
