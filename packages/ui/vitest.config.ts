import base from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    oxc: { jsx: { runtime: "automatic" } },
  }),
);
