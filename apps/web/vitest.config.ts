import base from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    // Next keeps JSX for its own compiler (tsconfig "preserve"); tests need it compiled.
    oxc: { jsx: { runtime: "automatic" } },
    test: {
      include: ["app/**/*.test.{ts,tsx}"],
      setupFiles: ["app/test-setup.ts"],
      coverage: { include: ["app/**"] },
    },
  }),
);
