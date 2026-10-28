import base from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["app/**/*.test.{ts,tsx}"],
      coverage: { include: ["app/**"] },
    },
  }),
);
