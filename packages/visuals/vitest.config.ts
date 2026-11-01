import base from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  // Validators load Mermaid, MuJoCo and Vega cold, which takes longer than 5 s on CI runners.
  defineConfig({ test: { testTimeout: 30_000 } }),
);
